"""A renderer for Kubernetes YAML manifests.

Given a Kubernetes YAML file (which may be a stream of objects, i.e. YAML
snippets separated by `---` lines), this will render a sequence of states
(represented as an OrderedDict), mapping every such object to an invocation
of our custom `object_[present|absent]` state function.

To use it, add a shebang like `#!kubernetes` as the first line of your
manifests SLS file. Optionally, you can use rendering pipelines (if templating
is required), e.g. `#!jinja | metalk8s_kubernetes`.

The shebang also supports passing options to this renderer, in the format
`#!metalk8s_kubernetes argument1=value1&argument2=value2` (basically, a query
string in the `application/x-www-form-urlencoded` format).
The supported options are:
- `kubeconfig`, the path to the kubeconfig file to use for communicating with
  K8s API
- `context`, the context from the kubeconfig to use
- `absent`, a boolean to toggle which state function variant (`object_present`
  or `object_absent`) to use (defaults to False)

TODO: improve management of `kubeconfig` and `context` parameters, relying on
      master configuration and sane defaults - look into `__opts__`
"""
from salt.exceptions import SaltRenderError
from salt.ext import six
from salt.utils.yaml import SaltYamlSafeLoader
from salt.utils.odict import OrderedDict
import yaml

__virtualname__ = 'metalk8s_kubernetes'


def __virtual__():
    return __virtualname__


def _step_name(obj, absent=False):
    try:
        name = obj.metadata.name
    except AttributeError:
        raise SaltRenderError('Object `metadata.name` must be set.')

    namespace = getattr(obj.metadata, 'namespace', None)
    if namespace is not None:
        full_name = '{}/{}'.format(namespace, name)
    else:
        full_name = name

    return "{verb} {api_version}/{kind} '{name}'".format(
        verb='Remove' if absent else 'Apply',
        api_version=obj.api_version,
        kind=obj.kind,
        name=full_name,
    )


def _step(manifest, kubeconfig=None, context=None, absent=False):
    """Render a single Kubernetes object into a state 'step'."""
    try:
        obj = __utils__['metalk8s_kubernetes.convert_manifest_into_object'](
            manifest
        )
    except ValueError as exc:
        raise SaltRenderError('Invalid manifest: {!s}'.format(exc))

    valid, diff = __utils__['metalk8s_kubernetes.validate_conversion'](
        obj, manifest
    )
    if not valid:
        raise SaltRenderError(
            'Conversion of manifest is invalid. '
            'Removed fields: {}. Changed fields: {}.'.format(
                ', '.join(diff.removed()), ', '.join(diff.changed())
            )
        )

    step_name = _step_name(obj, absent)
    state_func = 'metalk8s_kubernetes.object_{}'.format(
        'absent' if absent else 'present'
    )
    state_args = [
        {'name': obj.metadata.name},
        {'kubeconfig': kubeconfig},
        {'context': context},
        {'manifest': manifest},
    ]

    return step_name, {state_func: state_args}


def render(source, saltenv='', sls='', argline='', **kwargs):
    args = six.moves.urllib.parse.parse_qs(argline)

    kubeconfig = args.get('kubeconfig', [None])[0]
    context = args.get('context', [None])[0]
    absent = args.get('absent', [False])[0]

    if not isinstance(source, six.string_types):
        # Assume it is a file handle
        source = source.read()

    data = yaml.load_all(source, Loader=SaltYamlSafeLoader)

    return OrderedDict(
        _step(manifest, kubeconfig=kubeconfig, context=context, absent=absent)
        for manifest in data if manifest
    )
