#!/bin/bash
set -e
set -u
set -o pipefail

VERBOSE=${VERBOSE:-0}
LOGFILE=/var/log/metalk8s/downgrade.log
DRY_RUN=0
SALTENV=""
DESTINATION_VERSION=""
SALT=""
SALT_CALL=${SALT_CALL:-salt-call}
CRICTL=${CRICTL:-crictl}


_usage() {
    echo "downgrade.sh [options]"
    echo "Options:"
    echo "--destination-version "
    echo "   <destination-version>:        Destination version to downgrade to"
    echo "-l/--log-file <logfile_path>:    Path to log file"
    echo "-v/--verbose:                    Run in verbose mode"
    echo "-d/--dry-run:                    Run actions in dry run mode"
    echo "-h/--help:                       Show this help menu"
}

while (( "$#" )); do
  case "$1" in
    -d|--dry-run)
      DRY_RUN=1
      shift
      ;;
    -v|--verbose)
      VERBOSE=1
      shift
      ;;
    --destination-version)
      DESTINATION_VERSION="$2"
      shift 2
      ;;
    -l|--log-file)
      LOGFILE="$2"
      shift 2
      ;;
    -h|--help)
      _usage
      exit
      ;;
    *) # unsupported flags
      echo "Error: Unsupported flag $1" >&2
      _usage
      exit 1
      ;;
  esac
done

TMPFILES=$(mktemp -d)

mkdir -p "$(dirname "${LOGFILE}")"

cat << EOF >> "${LOGFILE}"
--- MetalK8s downgrade started on $(date -u -R) ---
EOF

exec > >(tee -ia "${LOGFILE}") 2>&1

cleanup() {
    rm -rf "${TMPFILES}" || true
}

trap cleanup EXIT

run_quiet() {
    local name=$1
    shift 1

    echo -n "> ${name}..."
    local start
    start=$(date +%s)
    set +e
    "$@" 2>&1 | tee -ia "${LOGFILE}" > "${TMPFILES}/out"
    local RC=$?
    set -e
    local end
    end=$(date +%s)

    local duration=$(( end - start ))

    if [ $RC -eq 0 ]; then
        echo " done [${duration}s]"
    else
        echo " fail [${duration}s]"
        cat >/dev/stderr << EOM

Failure while running step '${name}'

Command: $@

Output:

<< BEGIN >>
EOM
        cat "${TMPFILES}/out" > /dev/stderr

        cat >/dev/stderr << EOM
<< END >>

This script will now exit

EOM

        exit 1
    fi
}

run_verbose() {
    local name=$1
    shift 1

    echo "> ${name}..."
    "$@"
}

run() {
    if [ "$VERBOSE" -eq 1 ]; then
        run_verbose "${@}"
    else
        run_quiet "${@}"
    fi
}

die() {
    echo 1>&2 "$@"
    return 1
}

_set_env() {
    if [ -z "$SALTENV" ]; then
        SALTENV="metalk8s-$($SALT_CALL --out txt slsutil.renderer \
            string="{{ pillar.metalk8s.nodes[grains.id].version }}" \
            | cut -c 8-)"
    fi
}

_check_salt_master() {
  [ -z "$SALTENV" ] && die "Cannot detect current salt env"
  # check if salt master is up
  master_ps=$($CRICTL ps -q --label io.kubernetes.container.name=salt-master)
  [ -z "$master_ps" ] && die "Cannot find salt master container"
  SALT="$CRICTL exec $master_ps "
  return 0
}

_init () {
    _set_env
    _check_salt_master
}

precheck_downgrade () {
  $SALT salt-run state.orchestrate metalk8s.orchestrate.downgrade.precheck \
      saltenv="$SALTENV" \
      pillar="{'metalk8s': {'cluster_version': '$DESTINATION_VERSION'}}"

}

launch_downgrade () {
  $SALT salt-run state.orchestrate metalk8s.orchestrate.downgrade \
    saltenv="$SALTENV"
}

downgrade_bootstrap () {
  $SALT_CALL --local state.sls metalk8s.roles.bootstrap \
    saltenv="metalk8s-$DESTINATION_VERSION" \
    pillar="{'metalk8s': {'endpoints': $(salt-call \
    --out txt pillar.get metalk8s:endpoints | cut -c 8-)}}" \
    --retcode-passthrough
  _check_salt_master
  local bootstrap_id
  bootstrap_id=$(
    $SALT_CALL grains.get id --out txt \
    | awk '/^local\: /{ print $2 }')
  [ -z "$bootstrap_id" ] && die "Cannot retrieve bootstrap id"
  $SALT salt-run salt.cmd state.single metalk8s_kubernetes.node_label_present \
    metalk8s.scality.com/version \
    node="$bootstrap_id" value="$DESTINATION_VERSION" \
    kubeconfig=/etc/kubernetes/admin.conf
  $SALT salt-run state.sls metalk8s.orchestrate.deploy_node saltenv="$SALTENV" \
    pillar="{'orchestrate': {'node_name': '$bootstrap_id'}}"
   _check_salt_master
  $SALT salt-run saltutil.sync_all saltenv="DESTINATION_VERSION"
}

# patch the kube-system namespace annotation with <destination-version> input
patch_kubesystem_namespace() {
  #update the annotation with the new destination value
  $SALT salt-run state.orchestrate_single \
      metalk8s_kubernetes.namespace_annotation_present \
      "kube-system" \
      kubeconfig="/etc/kubernetes/admin.conf" \
      context="kubernetes-admin@kubernetes" \
      annotation_key="metalk8s.scality.com/cluster-version" \
      annotation_value="$DESTINATION_VERSION" \
      test="$DRY_RUN"
}

get_cluster_version() {
  DESTINATION_VERSION=$($SALT_CALL \
      pillar.get metalk8s:cluster_version --out txt | cut -c 8-)
}

# Main
_init
if [ -n "$DESTINATION_VERSION" ]; then
    run "Setting cluster version to $DESTINATION_VERSION" patch_kubesystem_namespace
else
    get_cluster_version
    run "Getting cluster version $DESTINATION_VERSION"
fi

run "Performing Pre-Downgrade checks" precheck_downgrade
[ $DRY_RUN -eq 1 ] && exit 0
run "Launching the downgrade" launch_downgrade
run "Downgrading bootstrap" downgrade_bootstrap
