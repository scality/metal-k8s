import requests
import json

from urllib3.exceptions import HTTPError

from kubernetes.client import CoreV1Api
from kubernetes.client.rest import ApiException

from pytest_bdd import scenario, given, then, parsers

from tests import kube_utils
from tests import utils


# Scenarios {{{

@scenario('../features/monitoring.feature', 'Create Persistent Volume')
def test_create_persistent_volume(host):
    pass


@scenario('../features/monitoring.feature', 'List Pods')
def test_list_pods(host):
    pass


@scenario('../features/monitoring.feature', 'Expected Pods')
def test_expected_pods(host):
    pass


@scenario('../features/monitoring.feature', 'Monitored components statuses')
def test_monitored_components(host):
    pass


# }}}
# Given {{{


@given(
    "Persistent Volume Claim '{name}' in namespace '{namespace}' is available"
    )
def check_persistent_volume_claim(
    host,
    name,
    namespace,
    k8s_apiclient
):
    try:
        k8s_client = CoreV1Api(api_client=k8s_apiclient)
        pvc = k8s_client.read_namespaced_persistent_volume_claim(
            name,
            namespace
        )
        assert pvc.metadata.name == "prometheus-monitoring"
        assert pvc.spec.storage_class_name == "metalk8s-prometheus"
    except (ApiException, HTTPError) as exc:
        if isinstance(exc, ApiException) and exc.status == 404:
            assert False, 'Persistent volume claim {} not found'.format(name)
        raise


@given("the Prometheus API is available")
def check_prometheus_api(host):
    response = _query_prometheus_api(host, 'targets')

    assert response.status_code == 200, response.text


# }}}
# Then {{{

@then(parsers.parse(
    "create persistent volume '{name}' for pods in monitoring namespace with \
         storageclass '{storageclassName}' of size '{capacity}'"
))
def persistent_volume_present(
    host,
    name,
    storageclassName,
    capacity,
    k8s_apiclient
):
    try:
        k8s_client = CoreV1Api(api_client=k8s_apiclient)
        body = {
            "apiVersion": "storage.metalk8s.scality.com/v1alpha1",
            "kind": "Volume",
            "metadata": {
              "name": name
            },
            "spec": {
              "storageClassName": storageclassName,
              "sparseLoopDevice": {
                "size": capacity
              }
            }
          }
        k8s_client.V1PersistentVolume(body) is not None
    except (ApiException, HTTPError) as exc:
        if isinstance(exc, ApiException) and exc.status == 404:
            assert False, 'Unable to create volume {}'.format(name)
        raise


@then(parsers.parse(
    "job '{job}' in namespace '{namespace}' is '{health}'"
))
def check_job_health(host, job, namespace, health):
    def _wait_job_status():
        response = _query_prometheus_api(host, 'targets')
        active_targets = response.json()['data']['activeTargets']

        job_found = False
        for target in active_targets:
            if target['labels']['job'] == job and \
                    target['labels']['namespace'] == namespace:
                assert target['health'] == health, target['lastError']
                job_found = True

        assert job_found, 'Unable to find {} in Prometheus targets'.format(job)

    # Here we do a lot of retries because some pods can be really slow to start
    # e.g. kube-state-metrics
    utils.retry(
        _wait_job_status,
        times=30,
        wait=3,
        name="wait for job '{}' in namespace '{}' being '{}'".format(
            job, namespace, health)
    )


# }}}
# Helpers {{{

def _query_prometheus_api(host, route):
    ip = _get_local_grain(host, 'metalk8s:workload_plane_ip')
    port = _get_nodeport(host, 'prometheus', 'monitoring')

    return requests.get(
        'http://{ip}:{port}/api/v1/{route}'
        .format(ip=ip, port=port, route=route)
    )


def _get_nodeport(host, name, namespace):
    with host.sudo():
        port = host.check_output(
            'kubectl --kubeconfig=/etc/kubernetes/admin.conf '
            'get svc -n {namespace} {name} --no-headers '
            '-o custom-columns=":spec.ports[0].nodePort"'
            .format(namespace=namespace, name=name)
        )

    return port


def _get_local_grain(host, key):
    with host.sudo():
        output = host.check_output(
            'salt-call --local --out=json grains.get "{}"'.format(key)
        )
        ip = json.loads(output)['local']

    return ip


# }}}
