# coding: utf-8

"""Tasks to put container images on the ISO.

This module provides two services:
- building an image from a local Dockerfile
- downloading a prebuilt image from a registry

In either cases, those images are saved in a specific directory under the
ISO's root.

Overview:

                                  ┌───────────┐
                            ╱────>│pull:image1│───────     ┌─────────┐
                 ┌────────┐╱      └───────────┘       ╲    │         │
                 │        │       ┌───────────┐        ╲   │  dedup  │
             ───>│  pull  │──────>│pull:image2│───────────>│  layers │
            ╱    │        │       └───────────┘        ╱   │         │
┌─────────┐╱     └────────┘╲      ┌───────────┐       ╱    └─────────┘
│         │                 ╲────>│pull:image3│───────      ╱
│  mkdir  │                       └───────────┘            ╱
│         │                                               ╱
└─────────┘╲     ┌────────┐                              ╱
            ╲    │        │       ┌────────────┐        ╱
             ───>│  build │──────>│build:image3│───────╱
                 │        │       └────────────┘
                 └────────┘
"""


import datetime
from typing import Iterator, Tuple

from buildchain import config
from buildchain import constants
from buildchain import coreutils
from buildchain import targets
from buildchain import types
from buildchain import utils


def task_images() -> types.TaskDict:
    """Pull/Build the container images."""
    return {
        'actions': None,
        'task_dep': [
            '_image_mkdir_root',
            '_image_pull',
            '_image_build',
            '_image_dedup_layers',
        ],
    }


def task__image_mkdir_root() -> types.TaskDict:
    """Create the images root directory."""
    return targets.Mkdir(
        directory=constants.ISO_IMAGE_ROOT, task_dep=['_iso_mkdir_root']
    ).task


def task__image_pull() -> Iterator[types.TaskDict]:
    """Download the container images."""
    for image in TO_PULL:
        yield image.task


def task__image_build() -> Iterator[types.TaskDict]:
    """Download the container images."""
    for image in TO_BUILD:
        yield image.task


def task__image_dedup_layers() -> types.TaskDict:
    """De-duplicate the images' layers with hard links."""
    def show() -> str:
        return '{cmd: <{width}} {path}'.format(
            cmd='HARDLINK', width=constants.CMD_WIDTH,
            path=utils.build_relpath(constants.ISO_IMAGE_ROOT)
        )

    task = targets.Target(
        task_dep=['check_for:hardlink', '_image_pull', '_image_build']
    ).basic_task
    task['title']   = lambda _: show()
    task['actions'] = [
        [config.ExtCommand.HARDLINK.value, '-c', constants.ISO_IMAGE_ROOT]
    ]
    return task


NGINX_IMAGE_VERSION : str = '1.15.8'
NODE_IMAGE_VERSION : str = '10.16.0'

# List of container images to pull.
#
# Digests are quite a mouthful, so:
# pylint:disable=line-too-long
TO_PULL : Tuple[targets.RemoteImage, ...] = (
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='addon-resizer',
        version='1.8.3',
        digest='sha256:07353f7b26327f0d933515a22b1de587b040d3d85c464ea299c1b9f242529326',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.PROMETHEUS_REGISTRY,
        name='alertmanager',
        version='v0.16.0',
        digest='sha256:ba7f0a57348774f46d4476b71a2033914c1f1437920b5188eec54b145a5b7433',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry='calico',
        name='calico-node',
        remote_name='node',
        version='3.7.2',
        digest='sha256:8b565422f4cabd9652e0e912f3ea8707734cbc69f5835642f094d1ed0a087d5b',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry='calico',
        name='calico-kube-controllers',
        remote_name='kube-controllers',
        version='3.7.2',
        digest='sha256:d5533cb8df6150123cad26e369383a3e665c5e376f8c9dd7d80a8c86fa907e7c',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.COREOS_REGISTRY,
        name='configmap-reload',
        version='v0.0.1',
        digest='sha256:e2fd60ff0ae4500a75b80ebaa30e0e7deba9ad107833e8ca53f0047c42c5a057',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='coredns',
        version='1.3.1',
        digest='sha256:02382353821b12c21b062c59184e227e001079bb13ebd01f9d3270ba0fcbf1e4',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='etcd',
        version='3.2.24',
        digest='sha256:905d7ca17fd02bc24c0eba9a062753aba15db3e31422390bc3238eb762339b20',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GRAFANA_REGISTRY,
        name='grafana',
        version='5.2.4',
        digest='sha256:aaf50da5faf2596bfb0caed81f08b5569110e7b5468b291fedad25d8cbc51f2b',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.COREOS_REGISTRY,
        name='k8s-prometheus-adapter-amd64',
        version='v0.4.1',
        digest='sha256:cd44106e853564873e6bf261a672f0ee2122cdbd70800dafce2c3c26d0b4be95',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='kube-apiserver',
        version=constants.K8S_VERSION,
        digest='sha256:a6733a3ec08e4a84d5d1492c0fa2833b6d067ea78e37c87fcffc47bd1ab4ed9c',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='kube-controller-manager',
        version=constants.K8S_VERSION,
        digest='sha256:f5ddb81466e7467dacc8b6498bdd117ab77fb2fdb0b333c4ebe3e95e5493a661',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='kube-proxy',
        version=constants.K8S_VERSION,
        digest='sha256:fd6c29a779b3e30ad4072a1c77aef49f20bd3ea6cbd290c6f47be28ef333bb69',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.COREOS_REGISTRY,
        name='kube-rbac-proxy',
        version='v0.4.1',
        digest='sha256:9d07c391aeb1a9d02eb4343c113ed01825227c70c32b3cae861711f90191b0fd',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.GOOGLE_REGISTRY,
        name='kube-scheduler',
        version=constants.K8S_VERSION,
        digest='sha256:119fcd453469b7a3cc644ea7cda992371c5b746ef705dd88d7a8bfefae48b3be',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.COREOS_REGISTRY,
        name='kube-state-metrics',
        version='v1.5.0',
        digest='sha256:b7a3143bd1eb7130759c9259073b9f239d0eeda09f5210f1cd31f1a530599ea1',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.DOCKER_REGISTRY,
        name='nginx',
        version=NGINX_IMAGE_VERSION,
        digest='sha256:dd2d0ac3fff2f007d99e033b64854be0941e19a2ad51f174d9240dda20d9f534',
        destination=constants.ISO_IMAGE_ROOT,
        save_as_tar=True,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.PROMETHEUS_REGISTRY,
        name='node-exporter',
        version='v0.17.0',
        digest='sha256:1b129a3801a0440f9c5b2afb20082dfdb31bf6092b561f5f249531130000cb83',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.PROMETHEUS_REGISTRY,
        name='prometheus',
        version='v2.5.0',
        digest='sha256:478d0b68432ea289a2e8455cbc30ee38b7ade6d13b4f73877203184c64914d9b',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.COREOS_REGISTRY,
        name='prometheus-config-reloader',
        version='v0.27.0',
        digest='sha256:61b7969fd1336fd4bbac0622f9e4281f2a2b4ae02ad55748b6fdc65e2be69b73',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
    targets.RemoteImage(
        registry=constants.COREOS_REGISTRY,
        name='prometheus-operator',
        version='v0.27.0',
        digest='sha256:933cd5bf380cf7db330808ff54f75f26fda0b1501021d499a1766b7d16224188',
        destination=constants.ISO_IMAGE_ROOT,
        task_dep=['_image_mkdir_root'],
    ),
)


# The build ID is to be augmented whenever we rebuild the `salt-master` image,
# e.g. because the `Dockerfile` is changed, or one of the dependencies installed
# in the image needs to be updated.
# This should be reset to 1 when SALT_VERSION is changed.
SALT_MASTER_BUILD_ID : int = 1

KEEPALIVED_IMAGE_TAG = '{}-{}'.format(
    constants.KEEPALIVED_VERSION,
    constants.KEEPALIVED_BUILD_ID,
)

# List of container images to build.
TO_BUILD : Tuple[targets.LocalImage, ...] = (
    targets.LocalImage(
        name='salt-master',
        version='{}-{}'.format(constants.SALT_VERSION, SALT_MASTER_BUILD_ID),
        dockerfile=constants.ROOT/'images'/'salt-master'/'Dockerfile',
        destination=constants.ISO_IMAGE_ROOT,
        save_on_disk=True,
        build_args={'SALT_VERSION': constants.SALT_VERSION},
        task_dep=['_image_mkdir_root'],
    ),
    targets.LocalImage(
        name='keepalived',
        version=KEEPALIVED_IMAGE_TAG,
        dockerfile=constants.ROOT/'images'/'keepalived'/'Dockerfile',
        destination=constants.ISO_IMAGE_ROOT,
        save_on_disk=True,
        build_args={
            'KEEPALIVED_IMAGE_SHA256': constants.CENTOS_BASE_IMAGE_SHA256,
            'KEEPALIVED_IMAGE': constants.CENTOS_BASE_IMAGE,
            'KEEPALIVED_VERSION': constants.KEEPALIVED_VERSION,
            'BUILD_DATE': datetime.datetime.now(datetime.timezone.utc)
                            .astimezone()
                            .isoformat(),
            'VCS_REF': constants.GIT_REF or '<unknown>',
            'VERSION': KEEPALIVED_IMAGE_TAG,
            'METALK8S_VERSION': constants.VERSION,
        },
        task_dep=['_image_mkdir_root'],
        file_dep=[constants.ROOT/'images'/'keepalived'/'entrypoint.sh'],
    ),
    targets.LocalImage(
        name='metalk8s-ui',
        version=constants.VERSION,
        dockerfile=constants.ROOT/'ui'/'Dockerfile',
        destination=constants.ISO_IMAGE_ROOT,
        save_on_disk=True,
        build_args={
            'NGINX_IMAGE_VERSION': NGINX_IMAGE_VERSION,
            'NODE_IMAGE_VERSION': NODE_IMAGE_VERSION
        },
        task_dep=['_image_mkdir_root'],
        file_dep=(
            list(coreutils.ls_files_rec(constants.ROOT/'ui'/'public')) +
            list(coreutils.ls_files_rec(constants.ROOT/'ui'/'src')) +
            [
                constants.ROOT/'ui'/'package.json',
                constants.ROOT/'ui'/'package-lock.json',
                constants.ROOT/'ui'/'conf'/'nginx.conf'
            ]
        )
    ),
)


__all__ = utils.export_only_tasks(__name__)
