# CHANGELOG

## Release 2.4.3

### Features added
- [#1993](https://github.com/scality/metalk8s/issues/1993) - Add Solutions
management, CLI tooling to deploy Solutions (complex Kubernetes applications)
(PR [#2279](https://github.com/scality/metalk8s/pull/2279))

### Enhancements
- Add `label_selector` in MetalK8s custom kubernetes salt module for listing
kubernetes objects (PR [#2236](https://github.com/scality/metalk8s/pull/2236))

- [#2328](https://github.com/scality/metalk8s/issues/2328) - Bump K8S version
to 1.15.11 (PR [#2362](https://github.com/scality/metalk8s/pull/2362))

- Salt grains cache is now enabled
(PR [#2417](https://github.com/scality/metalk8s/pull/2417)

### Bug fixes
- [#2334](https://github.com/scality/metalk8s/issues/2334) - Add and
install `yum-utils` package required for cluster expansion
(PR [#2343](https://github.com/scality/metalk8s/pull/2343))

- [#2245](https://github.com/scality/metalk8s/issues/2245) - Rephrase volume
status from `Available` to `Ready`
(PR [#2248](https://github.com/scality/metalk8s/pull/2248))

- [#2409](https://github.com/scality/metalk8s/issues/2409) - Deletion
on pending volumes (PR [#2410](https://github.com/scality/metalk8s/pull/2410))

## Release 2.4.2

### Breaking changes
- If `apiServer.host` is configured in `BootstrapConfiguration`, this is no
longer used (and must no longer be defined).
- If `apiServer.keepalived` is configured in `BootstrapConfiguration`, this is
no longer used, and Keepalived is no longer deployed at all.
- Generated `admin.conf` `KubeConfig` files point to the control-plane IP of the
host on which they are generated. You can override this when using them using
`kubectl`s `-s`/`--server` argument to point to another address.

### Features added
- [#1891](https://github.com/scality/metalk8s/issues/1891) - Allow adding
labels to *Volume*s from the UI
(PRs [#1979](https://github.com/scality/metalk8s/pull/1979) and
[#2066](https://github.com/scality/metalk8s/pull/2066))

- [#2049](https://github.com/scality/metalk8s/issues/2049) - Deploy
[prometheus-adapter](https://github.com/DirectXMan12/k8s-prometheus-adapter/)
to implement the `metrics.k8s.io` API, to support `kubectl top` and other
consumers of this API
(PR [#2057](https://github.com/scality/metalk8s/pull/2057))

- [#2103](https://github.com/scality/metalk8s/issues/2103) - Add a host-local
`nginx` on every node to provide highly-available and load-balanced access to
`kube-apiserver` (PR [#2106](https://github.com/scality/metalk8s/pull/2106))

- [#2052](https://github.com/scality/metalk8s/issues/2052) - Handle
configuration of an HTTP proxy for `containerd` (PRs
[#2071](https://github.com/scality/metalk8s/pull/2071) and
[#2201](https://github.com/scality/metalk8s/pull/2201))

- [#2149](https://github.com/scality/metalk8s/issues/2149) - Provide access to
the product documentation from the UI
(PR [#2176](https://github.com/scality/metalk8s/pull/2176))

### Bug fixes

- [#2083](https://github.com/scality/metalk8s/issues/2083) +
[#2102](https://github.com/scality/metalk8s/issues/2102) - Ensure safer
approach when expanding the `etcd` cluster
(PRs [#2099](https://github.com/scality/metalk8s/pull/2099) and
[#2198](https://github.com/scality/metalk8s/pull/2198))

## Release 2.4.1

### Features added

- ~~[#1891](https://github.com/scality/metalk8s/issues/1891) - Allow adding
labels to *Volume*s from the UI
(PR [#1979](https://github.com/scality/metalk8s/pull/1979))~~ _Note: this only
sets labels on the Volume object, not the created PV. Fixed in 2.4.2_

### Bug fixes

- [#1970](https://github.com/scality/metalk8s/issues/1970) - Ensure yum
history, repositories and RPM databases are properly closed after a
transaction (PR [#1971](https://github.com/scality/metalk8s/pull/1971))
