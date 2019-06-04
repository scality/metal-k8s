Change the hostname of a cluster node
=====================================

On the node
^^^^^^^^^^^

Change the hostname:

.. code-block:: shell

        $ hostnamectl set-hostname <your hostname, here: ControlPlane2>
        $ systemctl restart systemd-hostnamed

Check that the hostname has changed

.. code-block:: shell

        $ hostnamectl status

        Static hostname: controlplane2
        Pretty hostname: ControlPlane2
          Icon name: computer-vm
           Chassis: vm
        Machine ID: 5003025f93c1a84914ea5ae66519c100
           Boot ID: f28d5c64f06c48a3a775e24c4f03d00c
           Virtualization: kvm
        Oerating System: CentOS Linux 7 (Core)
           CPE OS Name: cpe:/o:centos:centos:7
               Kernel: Linux 3.10.0-957.12.2.el7.x86_64
           Architecture: x86-64 


On the bootstrap node
^^^^^^^^^^^^^^^^^^^^^

Verify the hostname change allowed a change of status on the bootstrap, the node has now a status ``NotReady``.

.. code-block:: shell
        $ kubectl get nodes
        node2.novalocal    NotReady   etcd,master                   19h       v1.11.7

Change the name of the node in the YAML file used to created it

.. code-block:: yaml

        apiVersion: v1
        kind: Node
        metadata:
          name: <NEW HOSTNAME>
          annotations:
            metalk8s.scality.com/ssh-key-path: /etc/metalk8s/pki/id_rsa
            metalk8s.scality.com/ssh-host: <IP Address>
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





Then apply the configuration: 
.. code-block:: shell

        $ kubectl apply -f new-node-master3.yaml

Delete the old node (here ``node2.novalocal``):
.. code-block:: shell
        $ kubectl delete node node2.novalocal

Log on the salt master:
.. code-block:: shell
        $ kubectl -it -n kube-system exec salt-master-master.novalocal bash

Then: 
.. code-block:: shell
            $ salt-run state.orchestrate metalk8s.orchestrate.deploy_node saltenv=metalk8s-2.0 pillar="{'orchestrate': {'node_name': 'controlplane2'}}"


                Summary for master.novalocal_master
                ------------- 
                Succeeded: 11 (changed=9)
                Failed:     0
                -------------
                Total states run:     11
                Total run time:  132.435 s


On the Control Plane node delete the certificates:
.. code-block:: shell

        $ rm -f /var/lib/kubelet/pki/*.pem

Then restart the kubelet service:
.. code-block:: shell
        $ systemctl restart kubelet

    
