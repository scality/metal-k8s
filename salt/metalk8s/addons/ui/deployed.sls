include:
  - .precheck

{%- set kubeconfig = "/etc/kubernetes/admin.conf" %}
{%- set context = "kubernetes-admin@kubernetes" %}

{%- set apiserver = 'https://' ~ pillar.metalk8s.api_server.host ~ ':6443' %}
{%- set saltapi = 'http://' ~ pillar.metalk8s.endpoints['salt-master'].ip ~ ':' ~ pillar.metalk8s.endpoints['salt-master'].ports.api %}
{%- set prometheus = 'http://' ~ pillar.metalk8s.endpoints.prometheus.ip ~ ':' ~ pillar.metalk8s.endpoints.prometheus.ports.api.node_port  %}

Create metalk8s-ui namespace:
  metalk8s_kubernetes.namespace_present:
    - name: metalk8s-ui
    - kubeconfig: {{ kubeconfig }}
    - context: {{ context }}

Create metalk8s-ui deployment:
  metalk8s_kubernetes.deployment_present:
    - name: metalk8s-ui
    - namespace: metalk8s-ui
    - kubeconfig: {{ kubeconfig }}
    - context: {{ context }}
    - source: salt://{{ slspath }}/files/metalk8s-ui-deployment.yaml
    - template: jinja

Create metalk8s-ui service:
  metalk8s_kubernetes.service_present:
    - name: metalk8s-ui
    - namespace: metalk8s-ui
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

Create metalk8s-ui ConfigMap:
  metalk8s_kubernetes.configmap_present:
    - name: metalk8s-ui
    - namespace: metalk8s-ui
    - kubeconfig: {{ kubeconfig }}
    - context: {{ context }}
    - data:
        config.json: |
          {
            "url": "{{ apiserver }}",
            "url_salt": "{{ saltapi }}",
            "url_prometheus": "{{ prometheus }}"
          }
        theme.json: |
          {"brand": {"primary": "#403e40", "secondary": "#e99121"}}
