include:
  - .installed

Create kubectl bash completion file:
  file.managed:
    - name: /etc/bash_completion.d/kubectl
    - contents: __slot__:salt:cmd.run('kubectl completion bash')
    - makedirs: True
    - dir_mode: 755
    - mode: 644
    - user: root
    - group: root
    - require:
      - metalk8s_package_manager: Install kubectl
