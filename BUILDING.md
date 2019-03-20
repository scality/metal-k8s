# How to build MetalK8s

Our build system is based on [doit](http://pydoit.org/).

## Dependencies

- [Python3.6+](https://www.python.org/)

## Setup

```shell
python3 -m venv buildenv
source buildenv/bin/activate
pip install -r requirements/build-requirements.txt
```

To build, simply type `doit`.

Note that:
- you can speed up the build by spawning more workers, e.g. `doit -n 4`.
- you can have a JSON output with `doit --reporter json`

When a task is prefixed by:
- `--`: the task is skipped because already up-to-date
- `.`: the task is executed
- `!!`: the task is ignored.

## Main tasks

To get a list of the available targets, you can run `doit list`.

The most important ones are:
- `iso`:  build the MetalK8s ISO
- `vagrantup`: spawn a development environment using Vagrant
- `lint`: run the linting tools on the codebase

By default, i.e. if you only type `doit` with no arguments, the `iso` task is
executed.

You can also run a subset of the build only:
- `packaging`: download and build the software packages and repositories
- `images`: download and build the container images
- `salt_tree`: deploy the Salt tree inside the ISO

## Cheatsheet

Here are some useful doit commands/features, for more information, the official
documentation is [here](http://pydoit.org/contents.html).

### doit tabcompletion

This generates completion for `bash` or `zsh` (to use it with your shell, see
the instructions [here](http://pydoit.org/cmd_other.html#tabcompletion))

### doit list

By default, `doit list` only shows the "public" tasks.

If you want to see the subtasks as well, you can use the option `--all`.

```shell
% doit list --all
images       Pull/Build the container images.
iso          Build the MetalK8s image.
lint         Run the linting tools.
lint:shell   Run shell scripts linting.
lint:yaml    Run YAML linting.
[…]
```

Useful if you only want to run a part of a task (e.g. running the lint tool only
on the YAML files).

You can also display the internal (a.k.a. "private" or "hidden") tasks with the
`-p` (or `--private`) options.

And if you want to see **all** the tasks, you can combine both: `doit list --all
--private`.

### doit clean

You can cleanup the build tree with the `doit clean` command.

Note that you can have fine-grained cleaning, i.e. cleaning only the result of a
single task, instead of trashing the whole build tree: e.g. if you want to
delete the container images, you can run `doit clean images`.

You can also execute a dry-run to see what would be deleted by a clean command:
`doit clean -n images`.


### doit info

Useful to understand how tasks interact with each others (and for
troubleshooting), the `info` command display the task's metadata.

Example:

```shell
% doit info _build_packages:calico-cni-plugin:pkg_srpm

_build_packages:calico-cni-plugin:pkg_srpm

Build calico-cni-plugin-3.5.1-1.el7.src.rpm

status     : up-to-date

file_dep   :
 - /home/foo/dev/metalk8s/_build/metalk8s-build-latest.tar.gz
 - /home/foo/dev/metalk8s/_build/packages/calico-cni-plugin/SOURCES/v3.5.1.tar.gz
 - /home/foo/dev/metalk8s/_build/packages/calico-cni-plugin/SOURCES/calico-ipam-amd64
 - /home/foo/dev/metalk8s/packages/calico-cni-plugin.spec
 - /home/foo/dev/metalk8s/_build/packages/calico-cni-plugin/SOURCES/calico-amd64

task_dep   :
 - _package_mkdir_root
 - _build_packages:calico-cni-plugin:pkg_mkdir

targets    :
 - /home/foo/dev/metalk8s/_build/packages/calico-cni-plugin-3.5.1-1.el7.src.rpm
```

### Wildcard selection

You can use wildcard in task names, which allows you to either:
- execute all the sub-tasks of a specific task:
  `_build_packages:calico-cni-plugin:*` will execute all the tasks required to
  build the package.
- execute a specific sub-task for all the tasks:
  `_build_packages:*:pkg_get_source` will retrieve the source files for all the
  packages.

## Development

If you want to develop on the buildchain, you can add the development
dependencies with `pip install -r requirements/build-dev-requirements.txt`
