.. spelling::

   Quickstart
   subdirectory
   Todo

Quickstart Guide
================

To set up a testing cluster quickly using MetalK8s_ requires three machines
running CentOS_ 7.4 to which you have SSH access (these can be VMs). Each
machine acting as a Kubernetes_ node (all of them, in this example) must also
have at least one disk available to provision storage volumes.

.. todo:: Give some sizing examples

.. _MetalK8s: https://github.com/scality/metal-k8s/
.. _CentOS: https://www.centos.org
.. _Kubernetes: https://kubernetes.io

Clone or Copy the MetalK8s Git Repo
-----------------------------------

Clone the MetalK8s project from GitHub:

.. code-block:: shell

   $ git clone https://github.com/scality/metal-k8s

Define an Inventory
-------------------

To tell the Ansible_-based deployment system which machines MetalK8s shall be
installed on, you must provide an *inventory*. This inventory contains a file
that lists all hosts in the cluster, as well as some configuration.

.. _Ansible: https://www.ansible.com

To create an inventory:

  1. Create a directory inside MetalK8s (for example,
     :file:`inventory/quickstart-cluster`) in which the inventory will
     be stored.

     .. code-block:: shell

       $ cd metal-k8s
       $ mkdir -p inventory/quickstart-cluster
       $ cd inventory/quickstart-cluster/

  2. Create the :file:`hosts` file, which contains a listing of all hosts.

     .. code-block:: ini

        node-01 ansible_host=10.0.0.1 ansible_user=centos
        node-02 ansible_host=10.0.0.2 ansible_user=centos
        node-03 ansible_host=10.0.0.3 ansible_user=centos

        [kube-master]
        node-01
        node-02
        node-03

        [etcd]
        node-01
        node-02
        node-03

        [kube-node]
        node-01
        node-02
        node-03

        [k8s-cluster:children]
        kube-node
        kube-master

    Change the IP addresses, host names, and user names to conform to
    your infrastructure.

  3. Create a :file:`group_vars` subdirectory in the inventory directory.

   - A second file, called :file:`kube-node.yml`, in :file:`group_vars`
     subdirectory of the inventory, declares how to set up storage (in the
     default configuration) on hosts in the *kube-node* group; that is,
     hosts on which Pods will be scheduled

     .. code-block:: shell

       $ mkdir group_vars ; cd group_vars

   - In :file:`group_vars`, create a file named :file:`kube-node.yml`.
     This file declares the default storage configuration on hosts in
     the *kube-node* group—that is, hosts on which Pods shall be
     scheduled:

     .. code-block:: yaml

          metal_k8s_lvm:
            vgs:
              kubevg:
                drives: ['/dev/vdb']

     In this example, every *kube-node* host is assumed to have a disk available
     as :file:`/dev/vdb` which can be used to set up Kubernetes
     *PersistentVolumes*. For more information about storage, see
     :doc:`../architecture/storage`.

Enter the MetalK8s Shell
------------------------

To install a supported version of Ansible and its dependencies, along with some
Kubernetes tools (:program:`kubectl` and :program:`helm`), MetalK8s
provides a :program:`make` target that installs these in a local
environment. To enter this environment, run ``make shell`` (this takes
a few seconds when first run).

.. code-block:: shell

    $ make shell
    Creating virtualenv...
    Installing Python dependencies...
    Downloading kubectl...
    Downloading Helm...
    Launching MetalK8s shell environment. Run 'exit' to quit.
    (metal-k8s) $

Now, you're all set to deploy a cluster::

    (metal-k8s) $ ansible-playbook -i inventory/quickstart-cluster -b playbooks/deploy.yml

Grab a coffee and wait for deployment to end.

Inspect the Cluster
-------------------

Once deployment finishes, a file containing credentials to access the cluster is
created: :file:`inventory/quickstart-cluster/artifacts/admin.conf`. Export this
location in the shell so that the :program:`kubectl` and :program:`helm` tools
know how to contact the cluster *kube-master* nodes, and authenticate properly::

    (metal-k8s) $ export KUBECONFIG=`pwd`/inventory/quickstart-cluster/artifacts/admin.conf

Assuming port *6443* on the first *kube-master* node can be reached from your
system, you should be able to list the nodes::

    (metal-k8s) $ kubectl get nodes
    NAME        STATUS    ROLES            AGE       VERSION
    node-01     Ready     master,node      1m        v1.9.5+coreos.0
    node-02     Ready     master,node      1m        v1.9.5+coreos.0
    node-03     Ready     master,node      1m        v1.9.5+coreos.0

or list all pods::

    (metal-k8s) $ kubectl get pods --all-namespaces
    NAMESPACE      NAME                                                   READY     STATUS      RESTARTS   AGE
    kube-ingress   nginx-ingress-controller-9d8jh                         1/1       Running     0          1m
    kube-ingress   nginx-ingress-controller-d7vvg                         1/1       Running     0          1m
    kube-ingress   nginx-ingress-controller-m8jpq                         1/1       Running     0          1m
    kube-ingress   nginx-ingress-default-backend-6664bc64c9-xsws5         1/1       Running     0          1m
    kube-ops       alertmanager-kube-prometheus-0                         2/2       Running     0          2m
    kube-ops       alertmanager-kube-prometheus-1                         2/2       Running     0          2m
    kube-ops       es-client-7cf569f5d8-2z974                             1/1       Running     0          2m
    kube-ops       es-client-7cf569f5d8-qq4h2                             1/1       Running     0          2m
    kube-ops       es-data-cd5446fff-pkmhn                                1/1       Running     0          2m
    kube-ops       es-data-cd5446fff-zzd2h                                1/1       Running     0          2m
    kube-ops       es-exporter-elasticsearch-exporter-7df5bcf58b-k9fdd    1/1       Running     3          1m
    ...

Similarly, you can list all deployed Helm_ applications::

    (metal-k8s) $ helm list
    NAME                    REVISION        UPDATED                         STATUS          CHART                           NAMESPACE
    es-exporter             3               Wed Apr 25 23:10:13 2018        DEPLOYED        elasticsearch-exporter-0.1.2    kube-ops
    fluentd                 3               Wed Apr 25 23:09:59 2018        DEPLOYED        fluentd-elasticsearch-0.1.4     kube-ops
    heapster                3               Wed Apr 25 23:09:37 2018        DEPLOYED        heapster-0.2.7                  kube-system
    kibana                  3               Wed Apr 25 23:10:06 2018        DEPLOYED        kibana-0.2.2                    kube-ops
    kube-prometheus         3               Wed Apr 25 23:09:22 2018        DEPLOYED        kube-prometheus-0.0.33          kube-ops
    nginx-ingress           3               Wed Apr 25 23:09:09 2018        DEPLOYED        nginx-ingress-0.11.1            kube-ingress
    prometheus-operator     3               Wed Apr 25 23:09:14 2018        DEPLOYED        prometheus-operator-0.0.15      kube-ops

.. _Helm: https://www.helm.sh

Cluster Services
----------------
Various services to operate and monitor your MetalK8s cluster are provided. To
access these, first create a secure tunnel into your cluster by running
``kubectl proxy``. Then, while the tunnel is up and running, the following tools
are available:

+-------------------------+---------------------------------------------------------+-------------------------------------------------------------------------------------------------+---------------------------------------+
| Service                 | Role                                                    | Link                                                                                            | Notes                                 |
+=========================+=========================================================+=================================================================================================+=======================================+
| `Kubernetes dashboard`_ | A general purpose, web-based UI for Kubernetes clusters | http://localhost:8001/api/v1/namespaces/kube-system/services/https:kubernetes-dashboard:/proxy/ |                                       |
+-------------------------+---------------------------------------------------------+-------------------------------------------------------------------------------------------------+---------------------------------------+
| `Grafana`_              | Monitoring dashboards for cluster services              | http://localhost:8001/api/v1/namespaces/kube-ops/services/kube-prometheus-grafana:http/proxy/   |                                       |
+-------------------------+---------------------------------------------------------+-------------------------------------------------------------------------------------------------+---------------------------------------+
| `Cerebro`_              | An administration and monitoring console for            | http://localhost:8001/api/v1/namespaces/kube-ops/services/cerebro:http/proxy/                   | When accessing Cerebro, connect it to |
|                         | Elasticsearch clusters                                  |                                                                                                 | http://elasticsearch:9200 to operate  |
|                         |                                                         |                                                                                                 | the MetalK8s Elasticsearch cluster.   |
+-------------------------+---------------------------------------------------------+-------------------------------------------------------------------------------------------------+---------------------------------------+
| `Kibana`_               | A search console for logs indexed in Elasticsearch      | http://localhost:8001/api/v1/namespaces/kube-ops/services/http:kibana:/proxy/                   | When accessing Kibana for the first   |
|                         |                                                         |                                                                                                 | time, set up an *index pattern* for   |
|                         |                                                         |                                                                                                 | the ``logstash-*`` index, using the   |
|                         |                                                         |                                                                                                 | ``@timestamp`` field as *Time Filter  |
|                         |                                                         |                                                                                                 | field name*.                          |
+-------------------------+---------------------------------------------------------+-------------------------------------------------------------------------------------------------+---------------------------------------+

See :doc:`../architecture/cluster-services` for more about these services
and their configuration.

.. _Kubernetes dashboard: https://github.com/kubernetes/dashboard
.. _Grafana: https://grafana.com
.. _Cerebro: https://github.com/lmenezes/cerebro
.. _Kibana: https://www.elastic.co/products/kibana/
