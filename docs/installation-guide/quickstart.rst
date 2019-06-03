Quickstart Guide
================

This guide describes how to set up a MetalK8s_ cluster to play with. It
offers general requirements and describes sizing, configuration, and
deployment. With respect to installation procedures, the only significant
difference between a test cluster and a full production environment is
the amount of resources required to implement the design.

.. _MetalK8s: https://github.com/scality/metalk8s/
.. _CentOS: https://www.centos.org


General Cluster Requirements
----------------------------
Setting up a MetalK8s_ cluster quickly requires at least three machines
running CentOS_ 7.6 or higher (these can be VMs) to which you have SSH access.
Each machine acting as a :term:`Kubernetes node` (all three in the present
example) must also have at least one disk available to provision storage
volumes.
You will need to install a bootstrap node then other nodes (2 in our case).

Sizing
^^^^^^

Each node must satisfy the following sizing requirements.

.. note::
   The root file system requires at least 40 GB.

+-----------------+--------+--------+-------+
|    Component    | etcd   | Master | Node  |
+=================+========+========+=======+
| Cores           | 2      | 4      | 4     |
+-----------------+--------+--------+-------+
| RAM             | 4 GB   | 8 GB   | 8 GB  |
+-----------------+--------+--------+-------+
| Minimum         |        |        |       |
| dedicated       |        |        |       |
| storage capacity|        |        |       |
| required        |    -   |    -   | 128 GB|
+-----------------+--------+--------+-------+

Proxies
^^^^^^^
For nodes operating behind a proxy, add the following lines to each cluster
server's :file:`/etc/environment` file:

.. code-block:: shell

   http_proxy=http://user;pass@<HTTP proxy IP address>:<port>
   https_proxy=http://user;pass@<HTTPS proxy IP address>:<port>
   no_proxy=localhost,127.0.0.1,<local IP of each node>

Mount MetalK8s ISO
-------------------
On your bootstrap node, download the ISO file. Mount this ISO file at the
specific following path:

.. code-block:: shell

   $ mkdir -p /srv/scality/metalk8s-2.0
   $ mount <path-to-iso> /srv/scality/metalk8s-2.0


Prepare the bootstap node
-------------------------
1. Create the :file:`/etc/metalk8s/bootstrap.yaml` file. Change the netmask,
   IP address, and name to conform to your infrastructure.

.. code-block:: shell

   $ mkdir /etc/metalk8s

.. code-block:: yaml

   apiVersion: metalk8s.scality.com/v1alpha2
   kind: BootstrapConfiguration
   networks:
    controlPlane: <netmask>/24
    workloadPlane: <netmask>/24
   ca:
    minion: <name-of-the-bootstrap-node>
   apiServer:
    host: <IP-of-the-bootstrap-node>

2. Generate an SSH key that will be used for authentication
   to future new nodes.

.. code-block:: shell

   $ ssh-keygen
   $ ssh-copy-id <IP-of-the-bootstrap-node>

3. Copy the private key in the pki folder of MetalK8s. This will be the
   file path against which MetalK8s checks for the initial authentication to
   the future new nodes.

.. code-block:: shell

   $ mkdir -p /etc/metalk8s/pki/
   $ cp /root/.ssh/id_rsa /etc/metalk8s/pki/id_rsa

Install the bootstrap node
--------------------------
1. Run the bootstrap script to install binaries and services required on the
   bootstrap node.

.. code-block:: shell

   $ /srv/scality/metalk8s-2.0/bootstrap.sh

2. Check if all :term:`pods <Kubernetes pod>` on the bootstrap node are in the
   ``Running`` state.

.. note::
   On all subsequent :term:`kubectl <kubectl>` commands, you may omit the
   ``--kubeconfig`` argument if you have exported the ``KUBECONFIG``
   environment variable with value the path to the administrator configuration
   file for the cluster.

   By default, this path is ``/etc/kubernetes/admin.conf``.

   .. code-block:: shell

      $ export KUBECONFIG=/etc/kubernetes/admin.conf


.. code-block:: shell

   $ kubectl get node --kubeconfig /etc/kubernetes/admin.conf
   NAME                   STATUS    ROLES                         AGE       VERSION
   bootstrap              Ready     bootstrap,etcd,infra,master   17m       v1.11.7

   $ kubectl get pods --all-namespaces -o wide --kubeconfig /etc/kubernetes/admin.conf
   NAMESPACE     NAME                                          READY     STATUS    RESTARTS   AGE       IP             NODE                  NOMINATED NODE
   kube-system   calico-node-zw74v                             1/1       Running   0          18m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   coredns-6b9cb79bf4-jbtxc                      1/1       Running   0          18m       10.233.0.2     bootstrap.novalocal   <none>
   kube-system   coredns-6b9cb79bf4-tdmz8                      1/1       Running   0          18m       10.233.0.4     bootstrap.novalocal   <none>
   kube-system   etcd-bootstrap                                1/1       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   kube-apiserver-bootstrap                      1/1       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   kube-controller-manager-bootstrap             1/1       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   kube-proxy-mwxhf                              1/1       Running   0          18m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   kube-scheduler-bootstrap                      1/1       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   metalk8s-ui-656f6857b-cdt5p                   1/1       Running   0          18m       10.233.0.3     bootstrap.novalocal   <none>
   kube-system   package-repositories-bootstrap                1/1       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   registry-bootstrap                            1/1       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>
   kube-system   salt-master-bootstrap                         2/2       Running   0          17m       172.21.254.7   bootstrap.novalocal   <none>

Add a master to the cluster
---------------------------

Now it's time to add more nodes to the cluster. First you need to add
2 nodes with etcd and master roles to improve redundancy of
the control-plane. Here is the procedure to add one, simply do it
twice to have 3 masters (bootstrap + 2 new master).

1. Copy the ssh-key to the new control-plane node

.. code-block:: shell

   $ ssh-copy-id <IP-of-the-new-control-plane-node>

2. Create a :term:`node manifest <Kubernetes node manifest>` for
   this new control-plane node as :file:`new-control-plane-node.yaml`.

.. code-block:: yaml

   apiVersion: v1
   kind: Node
   metadata:
     name: new-cp-node
     annotations:
       metalk8s.scality.com/ssh-key-path: /etc/metalk8s/pki/id_rsa
       metalk8s.scality.com/ssh-host: <IP-of-the-new-master-node>
       metalk8s.scality.com/ssh-sudo: 'false'
     labels:
       metalk8s.scality.com/version: '2.0'
       node-role.kubernetes.io/master: ''
       node-role.kubernetes.io/etcd: ''
   spec:
     taints:
     - effect: NoSchedule
       key: node-role.kubernetes.io/master
     - effect: NoSchedule
       key: node-role.kubernetes.io/etcd

3. Declare the new master node in K8s API.

.. code-block:: shell

   $ kubectl apply -f new-control-plane-node.yaml
   node/new-cp-node created

4. Check that the new control-plane node was added to the cluster.

.. code-block:: shell

   $ kubectl get nodes --kubeconfig /etc/kubernetes/admin.conf
   NAME                   STATUS    ROLES                         AGE       VERSION
   bootstrap              Ready     bootstrap,etcd,infra,master   12d       v1.11.7
   new-cp-node            Unknown   etcd,master                   29s

5. The new control-plane node now need to be installed to change its
   status from Unknown to Ready. Obtaining a shell into the
   salt-master-bootstrap pod ...

.. code-block:: shell

   $ kubectl exec salt-master-bootstrap -n kube-system -c salt-master -it bash --kubeconfig /etc/kubernetes/admin.conf

Try to ping the new control-plane node:

.. code-block:: shell

   $ salt-ssh --roster kubernetes new-cp-node test.ping
   new-cp-node:
       True

Launch the command to perform the installation

.. code-block:: shell

   $ salt-run state.orchestrate metalk8s.orchestrate.deploy_node saltenv=metalk8s-2.0 \
     pillar="{'orchestrate': {'node_name': 'new-cp-node'}}"

   ... lots of output ...
   Summary for bootstrap_master
   ------------
   Succeeded: 7 (changed=7)
   Failed:    0
   ------------
   Total states run:     7
   Total run time: 121.468 s


You can exit from the salt-master pod and check if the etcd cluster is healthy

.. code-block:: shell

   $ kubectl -n kube-system exec -ti etcd-bootstrap sh --kubeconfig /etc/kubernetes/admin.conf
   $ etcdctl --endpoints=https://[127.0.0.1]:2379 \
     --ca-file=/etc/kubernetes/pki/etcd/ca.crt \
     --cert-file=/etc/kubernetes/pki/etcd/healthcheck-client.crt \
     --key-file=/etc/kubernetes/pki/etcd/healthcheck-client.key cluster-health

     member 46af28ca4af6c465 is healthy: got healthy result from https://172.21.254.6:2379
     member 81de403db853107e is healthy: got healthy result from https://172.21.254.7:2379
     member 8878627efe0f46be is healthy: got healthy result from https://172.21.254.8:2379
     cluster is healthy



Add a node to the cluster
-------------------------
You can now add more nodes without any control-plane roles. These nodes are
workload-plane nodes, used to handle applications you will install on the cluster.

1. Add the SSH key used to access the new node to the new node's authorized
   keys.

.. code-block:: shell

   $ ssh-copy-id <IP-of-the-new-node>

2. Create a :term:`node manifest <Kubernetes node manifest>`
   :file:`new-node.yaml` for this new node.

.. code-block:: yaml

   apiVersion: v1
   kind: Node
   metadata:
     name: <new-node-name>
     annotations:
       metalk8s.scality.com/ssh-key-path: /etc/metalk8s/pki/id_rsa
       metalk8s.scality.com/ssh-host: <IP-of-the-new-node>
       metalk8s.scality.com/ssh-sudo: 'false'
     labels:
       metalk8s.scality.com/version: '2.0'
       node-role.kubernetes.io/node: ''

3. Declare the new node in K8s API.

.. code-block:: shell

   $ kubectl apply -f new-node.yaml --kubeconfig /etc/kubernetes/admin.conf
   node/new-node created

4. Check that the new node was added to the cluster.

.. code-block:: shell

   $ kubectl get nodes
   NAME                   STATUS    ROLES                         AGE       VERSION
   bootstrap              Ready     bootstrap,etcd,infra,master   1h        v1.11.7
   master-node-01         Ready     etcd,master                   1h        v1.11.7
   master-node-02         Ready     etcd,master                   1h        v1.11.7
   node-01                Unknown   node                          17s

5. The new node now needs to be deployed to change its status from Unknown
   to Ready. Obtaining a shell into the master-bootstrap pod ...

.. code-block:: shell

   $ kubectl -ti -n kube-system exec salt-master-bootstrap bash --kubeconfig /etc/kubernetes/admin.conf

Try first to ping the new node

.. code-block:: shell

   $ salt-ssh -i --roster kubernetes <new-node-name> test.ping
   <new-node-name>:
      True

Launch the command to perform the deployment

.. code-block:: shell

   $ salt-run state.orchestrate metalk8s.orchestrate.deploy_node saltenv=metalk8s-2.0 \
     pillar="{'orchestrate': {'node_name': '<new-node-name>'}}"

   ... lots of output ...
   Summary for bootstrap_master
   ------------
   Succeeded: 7 (changed=7)
   Failed:    0
   ------------
   Total states run:     7
   Total run time: 121.468 s
