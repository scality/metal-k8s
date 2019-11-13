#!/usr/bin/env python3

'''
This script takes a Helm release name, a namespace name, a Helm chart
`values` file and a chart, and turns it into a YAML document that can be
deployed in a Kubernetes cluster as part of MetalK8s.

It performs the following tasks:

- Run `helm template` to render the chart, passing in the values provided on the
  command-line
- Fix up the resulting objects to include the desired namespace (which is not
  always part of chart templates) in the metadata section
- Fix up the resulting objects labels and annotations replace their `Tiller`
  heritage by `metalk8s`, set the `app.kubernetes.io/part-of` and
  `app.kubernetes.io/managed-by` to `salt`, and copy any `app` and
  `component` fields to the canonical `app.kubernetes.io/name` and
  `app.kubernetes.io/component` fields
'''

import sys
import subprocess

import yaml


BOILERPLATE = '''
#!jinja | metalk8s_kubernetes kubeconfig=/etc/kubernetes/admin.conf&context=kubernetes-admin@kubernetes
{%- from "metalk8s/repo/macro.sls" import build_image_name with context %}

{% raw %}
'''

BOILERPLATE_END = '''
{% endraw %}
'''

def fixup_metadata(namespace, doc):
    if 'metadata' in doc and 'namespace' not in doc['metadata']:
        doc['metadata']['namespace'] = namespace

    if doc.get('kind', None) == 'ConfigMapList':
        doc['items'] = [fixup_metadata(namespace, configmap)
                        for configmap in doc['items']]

    return doc


def maybe_copy(doc, src, dest):
    try:
        doc[dest] = doc[src]
    except KeyError:
        pass


def fixup_dict(doc):
    if doc.get('heritage') == 'Tiller' or \
            doc.get('app.kubernetes.io/managed-by') == 'Tiller':
        maybe_copy(doc, 'app', 'app.kubernetes.io/name')
        maybe_copy(doc, 'component', 'app.kubernetes.io/component')

        doc['heritage'] = 'metalk8s'
        doc['app.kubernetes.io/part-of'] = 'metalk8s'
        doc['app.kubernetes.io/managed-by'] = 'salt'

    return dict((key, fixup_doc(value)) for (key, value) in doc.items())


def fixup_doc(doc):
    if isinstance(doc, dict):
        return fixup_dict(doc)
    elif isinstance(doc, list):
        return [fixup_doc(d) for d in doc]
    else:
        return doc


def keep_doc(doc):
    if not doc:
        return False

    if doc.get('metadata', {}) \
            .get('annotations', {}) \
            .get('helm.sh/hook') == 'test-success':
        return False

    return True


def main():
    (name, namespace, values, path) = sys.argv[1:]

    template = subprocess.check_output([
        'helm', 'template',
        '--name', name,
        '--namespace', namespace,
        '--values', values,
        path,
    ])

    fixup = lambda doc: \
        fixup_metadata(
            namespace=namespace,
            doc=fixup_doc(
                doc=doc
            )
        )

    sys.stdout.write(BOILERPLATE.lstrip())
    sys.stdout.write('\n')

    yaml.safe_dump_all(
        (fixup(doc)
            for doc in yaml.safe_load_all(template)
            if keep_doc(doc)),
        sys.stdout,
        default_flow_style=False,
    )

    sys.stdout.write(BOILERPLATE_END)


if __name__ == '__main__':
    main()
