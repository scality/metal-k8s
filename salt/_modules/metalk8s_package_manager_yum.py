'''
Describes our custom way to deal with yum packages
so that we can support downgrade in metalk8s
'''
import logging

from contextlib import contextmanager
from salt.exceptions import CommandExecutionError

try:
    import yum
    HAS_YUM_LIB = True
except ImportError:
    HAS_YUM_LIB = False

log = logging.getLogger(__name__)


__virtualname__ = 'metalk8s_package_manager'


def __virtual__():
    if __grains__['os_family'] == 'RedHat' and HAS_YUM_LIB:
        return __virtualname__
    return False


def _list_dependents(
    name, version, fromrepo=None, allowed_versions=None
):
    '''List and filter all packages requiring package `{name}-{version}`.

    Filter based on the `allowed_versions` provided, within the provided
    `fromrepo` repositories.
    '''
    log.info(
        'Listing packages depending on "%s" with version "%s"',
        str(name),
        str(version)
    )

    allowed_versions = allowed_versions or {}

    command = [
        'repoquery', '--whatrequires', '--recursive',
        '--qf', '%{NAME} %{VERSION}-%{RELEASE}',
        '{}-{}'.format(name, version)
    ]

    if fromrepo:
        command.extend(['--disablerepo', '*', '--enablerepo', fromrepo])

    ret = __salt__['cmd.run_all'](command)

    if ret['retcode'] != 0:
        log.error(
            'Failed to list packages requiring "%s": %s',
            '{}-{}'.format(name, version),
            ret['stderr'] or ret['stdout']
        )
        return None

    dependents = {}
    for line in ret['stdout'].splitlines():
        req_name, req_version = line.strip().split()

        # NOTE: The following test filters out unknown packages and versions
        #       not referenced in `allowed_versions` (there can be only one)
        if req_version == allowed_versions.get(req_name):
            dependents[req_name] = req_version

    return dependents


def list_pkg_dependents(
    name, version=None, fromrepo=None, pkgs_info=None
):
    '''
    Check dependents of the package `name`-`version` to install, to add in a
    later `pkg.installed` state along with the original package.

    Ensure all selected versions are compliant with those listed in `pkgs_info`
    if provided.

    name
        Name of the package installed

    version
        Version number of the package

    pkgs_info
        Value of pillar key `repo:packages` to consider for the requiring
        packages to update (format {"<name>": {"version": "<version>"}, ...})

    Usage :
        salt '*' metalk8s_package_manager.list_pkg_dependents kubelet 1.11.10
    '''
    if pkgs_info:
        versions_dict = {
            p_name: p_info['version']
            for p_name, p_info in pkgs_info.items()
        }
    else:
        versions_dict = {}

    if pkgs_info and name not in versions_dict:
        log.error(
            'Trying to list dependents for "%s", which is not referenced in '
            'the packages information provided',
            name
        )
        return None

    all_pkgs = {name: version}

    if not version:
        return all_pkgs

    if pkgs_info and str(versions_dict[name]) != str(version):
        log.error(
            'Trying to list dependents for "%s" with version "%s", '
            'while version configured is "%s"',
            name,
            version,
            versions_dict[name]
        )
        return None

    # NOTE: Currently dependencies are not properly handle for downgrade
    # purpose, only add a special case for `salt` as it's one known issue
    # during downgrade
    # https://github.com/scality/metalk8s/issues/2523
    if name.startswith('salt-'):
        all_pkgs['salt'] = version

    dependents = _list_dependents(
        name,
        version,
        fromrepo=fromrepo,
        allowed_versions=versions_dict,
    )

    all_pkgs.update(dependents)

    for pkg_name, desired_version in all_pkgs.items():
        ret = __salt__['cmd.run_all'](['rpm', '-qa', pkg_name])

        if ret['retcode'] != 0:
            log.error(
                'Failed to check if package "%s" is installed: %s',
                pkg_name,
                ret['stderr'] or ret['stdout']
            )
            return None

        is_installed = bool(ret['stdout'].strip())
        if not is_installed and pkg_name != name:
            # Any package requiring the target `name` that is not yet installed
            # should not be installed
            del all_pkgs[pkg_name]

    return all_pkgs


def _disable_yum_loggers():
    yum_loggers = [
        'yum.filelogging.RPMInstallCallback', 'yum.verbose.Repos',
        'yum.verbose.plugin', 'yum.Depsolve', 'yum.verbose', 'yum.plugin',
        'yum.Repos', 'yum', 'yum.verbose.YumBase', 'yum.filelogging',
        'yum.verbose.YumPlugins', 'yum.RepoStorage', 'yum.YumBase',
        'yum.filelogging.YumBase', 'yum.verbose.Depsolve',
    ]

    for logger_name in yum_loggers:
        yum_logger = logging.getLogger(logger_name)
        yum_logger.setLevel(yum.logginglevels.__NO_LOGGING)


@contextmanager
def _get_yum_base():
    ybase = yum.YumBase()
    try:
        yield ybase
    finally:
        ybase.closeRpmDB()
        ybase.close()


def check_pkg_availability(pkgs_info):
    '''
    Check that provided packages and their dependencies are available

    pkgs_info
        Value of pillar key `repo:packages` to consider for the requiring
        packages to check (format {"<name>": {"version": "<version>"}, ...})
    '''
    with _get_yum_base() as ybase:
        ybase.preconf.errorlevel = 0
        ybase.preconf.debuglevel = 0
        ybase.conf.tsflags = 'test'
        ybase.conf.assumeyes = True

        _disable_yum_loggers()

        for name, info in pkgs_info.items():

            version = info.get('version')
            release = None

            if version:
                version_with_release = version.split('-', 1)
                if len(version_with_release) == 2:
                    version = version_with_release[0]
                    release = version_with_release[1]

            try:
                ybase.install(name=name, version=version, release=release)
            except yum.Errors.InstallError as exc:
                error = 'No candidate found for package: {0}{1}'.format(
                    name, '-' + str(version) if version else ''
                )
                raise CommandExecutionError(error)

        ybase.resolveDeps()
        ybase.buildTransaction()

        try:
            ybase.processTransaction()
        except (yum.Errors.YumDownloadError,
                yum.Errors.YumRPMCheckError) as exc:
            error = 'Some package dependencies are missing: {0}'.format(exc)
            raise CommandExecutionError(error)
