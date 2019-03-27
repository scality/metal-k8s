{% set kubeconfig = "/etc/kubernetes/admin.conf" %}
{% set context = "kubernetes-admin@kubernetes" %}

Create metalk8s-ui deployment:
  kubernetes.deployment_present:
    - name: metalk8s-ui
    - namespace: kube-system
    - kubeconfig: {{ kubeconfig }}
    - context: {{ context }}
    - source: salt://metalk8s/metalk8s-ui/files/metalk8s-ui_deployment.yaml
    - template: jinja
  require:
    - pkg: Install Python Kubernetes client

Create metalk8s-ui service:
  kubernetes.service_present:
    - name: metalk8s-ui
    - namespace: kube-system
    - kubeconfig: {{ kubeconfig }}
    - context: {{ context }}
    - metadata:
        labels:
          run: metalk8s-ui
        name: metalk8s-ui
    - spec:
        ports:
        - port: 80
          protocol: TCP
          targetPort: 80
        selector:
          k8s-app: ui
        type: NodePort
  require:
    - pkg: Install Python Kubernetes client
