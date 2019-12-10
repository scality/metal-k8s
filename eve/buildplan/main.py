"""Generate the Eve YAML description of build plan for MetalK8s."""
import pathlib
import sys

from buildplan import core
from buildplan import dsl
from buildplan import shell
from buildplan import yamlprint


def build_project():
    project = core.Project()
    project.add(pre_merge())
    return project


# Stages {{{
@dsl.WithStatus(is_root=True)
def pre_merge():
    return core.Stage(
        name="pre-merge",
        worker=core.LocalWorker(),
        branches=[
            "user/*",
            "feature/*",
            "improvement/*",
            "bugfix/*",
            "w/*",
            "q/*",
            "hotfix/*",
            "dependabot/*",
            "documentation/*",
            "release/*",
        ],
        steps=[
            core.TriggerStages(
                "Trigger build, docs, and lint stages",
                stages=[build(), docs(), lint()],
                halt_on_failure=True,
            ),
            set_version_property(),
            core.TriggerStages(
                "Trigger single-node and multiple-nodes steps with built ISO",
                stages=[single_node(), multiple_nodes()],
                halt_on_failure=True,
            ),
        ],
    )


@dsl.WithStatus()
@dsl.WithArtifacts(urls=["metalk8s.iso", "SHA256SUM", "product.txt"])
@dsl.WithSetup([dsl.SetupStep.DOCKER, dsl.SetupStep.GIT, dsl.SetupStep.CACHE])
def build():
    return core.Stage(
        name="build",
        worker=core.KubePodWorker(
            path="eve/workers/pod-builder/pod.yaml",
            images=[
                core.KubePodWorker.Image(
                    name="docker-builder", context="eve/workers/pod-builder"
                )
            ],
        ),
        steps=[
            build_all(),
            *dsl.copy_artifacts(
                [
                    "_build/metalk8s.iso",
                    "_build/SHA256SUM",
                    "_build/root/product.txt",
                ]
            ),
        ],
    )


@dsl.WithStatus()
@dsl.WithArtifacts(urls=["docs/html/index.html", "docs/latex/MetalK8s.pdf"])
@dsl.WithSetup([dsl.SetupStep.GIT, dsl.SetupStep.CACHE])
def docs():
    return core.Stage(
        name="docs",
        worker=core.KubePodWorker(
            path="eve/workers/pod-docs-builder/pod.yaml",
            images=[
                core.KubePodWorker.Image(
                    name="doc-builder",
                    context=".",
                    dockerfile="docs/Dockerfile",
                )
            ],
        ),
        steps=[
            build_docs(),
            *dsl.copy_artifacts(["docs/_build/*"], destination="docs",),
        ],
    )


@dsl.WithStatus()
@dsl.WithSetup([dsl.SetupStep.GIT, dsl.SetupStep.CACHE])
def lint():
    return core.Stage(
        name="lint",
        worker=core.KubePodWorker(
            path="eve/workers/pod-linter/pod.yaml",
            images=[
                core.KubePodWorker.Image(
                    name="docker-linter", context="eve/workers/pod-linter"
                )
            ],
        ),
        steps=[lint_all()],
    )


@dsl.WithStatus()
@dsl.WithArtifacts(urls=["sosreport/single-node"])
@dsl.WithSetup([dsl.SetupStep.GIT, dsl.SetupStep.CACHE, dsl.SetupStep.SSH])
def single_node():
    return core.Stage(
        name="single-node",
        worker=core.OpenStackWorker(
            path="eve/workers/openstack-single-node",
            flavor=core.OpenStackWorker.Flavor.LARGE,
            image=core.OpenStackWorker.Image.CENTOS7,
        ),
        steps=[
            *get_iso_from_artifacts(),
            *prepare_bootstrap(),
            install_bootstrap(),
            *run_tests(
                {"fast": "not slow", "slow": "slow"},
                mode="local",
                common_filter="post and ci and not multinode",
            ),
            collect_sosreport(),
            *dsl.copy_artifacts(
                ["/var/tmp/sosreport*"], destination="sosreport/single-node",
            ),
        ],
    )


@dsl.WithStatus()
@dsl.WithSetup([dsl.SetupStep.GIT, dsl.SetupStep.CACHE, dsl.SetupStep.SSH])
def multiple_nodes():
    return core.Stage(
        name="multiple-nodes",
        worker=core.OpenStackWorker(
            path="eve/workers/openstack-multiple-nodes",
            flavor=core.OpenStackWorker.Flavor.MEDIUM,
            image=core.OpenStackWorker.Image.CENTOS7,
        ),
        steps=[],
    )


# }}}
# Steps {{{
def set_version_property():
    return core.SetPropertyFromCommand(
        "Set version as property from built artifacts",
        property_name="metalk8s_version",
        command="bash -c '{}'".format(
            shell._and(
                '. <(curl -s "%(prop:artifacts_private_url)s/product.txt")',
                "echo $VERSION",
            )
        ),
        halt_on_failure=True,
    )


def build_all():
    return shell.Shell(
        "Build everything",
        command="./doit.sh -n 4",
        env={"PYTHON_SYS": "python3.6"},
        use_pty=True,
        halt_on_failure=True,
    )


def build_docs():
    return shell.Shell(
        "Build documentation",
        command="tox --workdir /tmp/tox -e docs -- html latexpdf",
        env={"READTHEDOCS": "True"},
        halt_on_failure=True,
    )


def lint_all():
    return shell.Shell(
        "Run all linting targets",
        command="./doit.sh lint",
        use_pty=True,
        halt_on_failure=False,
    )


ARTIFACTS_URL = pathlib.Path("%(prop:artifacts_private_url)s")


def get_iso_from_artifacts(destination=None, source=None):
    base_url = ARTIFACTS_URL
    name_suffix = ""
    if source is not None:
        base_url = base_url / source
        name_suffix = " ({})".format(source)

    dest_dir = pathlib.Path(".")
    if destination is not None:
        dest_dir = pathlib.Path(destination)

    def _curl_cmd(filename):
        return 'curl -s -XGET -o "{out_path}" "{in_url}"'.format(
            out_path=dest_dir / filename, in_url=base_url / filename,
        )

    # Get ISO checksum
    yield shell.Shell(
        "Retrieve ISO image checksum" + name_suffix,
        command=_curl_cmd("SHA256SUM"),
        halt_on_failure=True,
    )

    # Get ISO archive, with retry
    yield shell.Bash(
        "Retrieve ISO image" + name_suffix,
        command=shell._seq(
            shell._for(
                "{{1..{max_attempts}}}",
                shell._seq(
                    'echo "Attempt $i out of {max_attempts}"',
                    "{curl_cmd} && exit",
                    "sleep 2",
                ),
                var="i",
            ),
            'echo "Could not retrieve ISO after {max_attempts} attempts" >&2',
            "exit 1",
        ).format(max_attempts=20, curl_cmd=_curl_cmd("metalk8s.iso")),
        inline=True,
        halt_on_failure=True,
    )

    # Validate checksum
    yield shell.Shell(
        "Check ISO image with checksum" + name_suffix,
        command="sha256sum -c {}".format(dest_dir / "SHA256SUM"),
        halt_on_failure=True,
    )


SRV_SCAL = pathlib.Path("/srv/scality")
DEFAULT_MOUNTPOINT = SRV_SCAL / "metalk8s-%(prop:metalk8s_version)s"


def prepare_bootstrap(
    iso="$(realpath metalk8s.iso)",
    mountpoint=DEFAULT_MOUNTPOINT,
    minion_id=None,
):
    # Create mountpoint
    yield shell.Shell(
        "Create ISO mountpoint",
        command='mkdir -p "{}"'.format(mountpoint),
        sudo=True,
        halt_on_failure=True,
    )

    # Mount ISO
    yield shell.Shell(
        "Mount ISO image",
        command='mount -o loop "{}" "{}"'.format(iso, mountpoint),
        sudo=True,
        halt_on_failure=True,
    )

    # Create BootstrapConfiguration
    bootstrap_config_env = {
        "ARCHIVE_PATH": iso,
    }
    if minion_id is not None:
        bootstrap_config_env["MINION_ID"] = minion_id

    yield shell.Bash(
        "Create bootstrap configuration file",
        "deploy/scripts/bootstrap-config.sh",
        env=bootstrap_config_env,
        wrap_env=True,
        sudo=True,
        inline=True,
        halt_on_failure=True,
    )


def install_bootstrap(mountpoint=DEFAULT_MOUNTPOINT):
    return shell.Bash(
        "Start the bootstrap process",
        mountpoint / "bootstrap.sh",
        "--verbose",
        sudo=True,
        halt_on_failure=True,
    )


def run_tests(
    filters,
    mode="default",
    common_filter=None,
    branch="%(prop:branch)s",
    iso_mountpoint=DEFAULT_MOUNTPOINT,
    ssh_config=None,
):
    yield shell.Shell(
        "Checkout required version before running tests",
        'git checkout "{}" --quiet'.format(branch),
        halt_on_failure=True,
        hide_step_if=True,
    )

    env = {"ISO_MOUNTPOINT": iso_mountpoint}
    if mode != "local":
        env["SSH_CONFIG"] = ssh_config

    for label, extra_filter in filters.items():
        final_filter = shell._fmt_args(
            common_filter, extra_filter, join_with=" and "
        )

        yield shell.Shell(
            "Run tests - {}".format(label),
            command=shell._fmt_args(
                "tox",
                "-e",
                "tests-local" if mode == "local" else "tests",
                '-- -m "{}"'.format(final_filter) if final_filter else None,
        ),
        env=env,
            wrap_env=True,
        halt_on_failure=True,
    )


def collect_sosreport(owner="eve", group="eve"):
    return shell.Shell(
        "Collect logs using sosreport",
        command=shell._and(
            shell._fmt_args(
                "sudo sosreport --all-logs",
                "-o metalk8s -kmetalk8s.podlogs=True",
                "-o containerd -kcontainerd.all=True -kcontainerd.logs=True",
                "--batch --tmp-dir /var/tmp",
            ),
            "sudo chown {}:{} /var/tmp/sosreport*".format(owner, group),
        ),
    )


# }}}

if __name__ == "__main__":
    build_plan = build_project().dump()
    yamlprint.dump(build_plan, stream=sys.stdout)
