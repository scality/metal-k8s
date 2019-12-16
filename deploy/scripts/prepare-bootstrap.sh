#!/bin/bash

set -xue -o pipefail

# Parameters
OUTPUT_FILE="/etc/metalk8s/bootstrap.yaml"
ARCHIVE_PATH=${ARCHIVE_PATH:-"/var/tmp/metalk8s.iso"}
API_SERVER_VIP=${API_SERVER_VIP:-}
CONTROL_PLANE_IFACE=${CP_IFACE:-"eth0"}
WORKLOAD_PLANE_IFACE=${WP_IFACE:-"eth0"}
MINION_ID=${MINION_ID:-"$(hostname)"}
SSH_IDENTITY=${SSH_IDENTITY:-"/home/centos/.ssh/bootstrap"}

# Prepare output directory
mkdir -p "$(dirname $OUTPUT_FILE)"

# Pre-seed Salt minion ID
mkdir -p /etc/salt
echo "$MINION_ID" > /etc/salt/minion_id

# Prepare Salt master SSH identity
mkdir /etc/salt/pki
if [ ! -f "$SSH_IDENTITY" ]; then
  ssh-keygen -t rsa -b 4096 -N '' -f "$SSH_IDENTITY"
fi
cp "$SSH_IDENTITY" /etc/metalk8s/pki/salt_bootstrap

# Retrieve networks info
get_ip_netmask_from_iface() {
  local -r iface=${1:-"eth0"}

  ip -4 address show "$iface" | sed -rn 's/^\s*inet ([0-9.\/]+).*$/\1/p'
}

get_network_from_iface() {
  local -r iface=${1:-"eth0"}
  local NETWORK PREFIX ip_netmask

  ip_netmask="$(get_ip_netmask_from_iface "$iface")"
  eval "$(ipcalc --network --prefix "$ip_netmask")"
  echo "$NETWORK/$PREFIX"
}

get_ip_from_iface() {
  local -r iface=${1:-"eth0"}
  local ip_netmask
  ip_netmask="$(get_ip_netmask_from_iface "$iface")"
  echo "${ip_netmask%/*}"
}

WORKLOAD_PLANE_NETWORK="$(get_network_from_iface "$WORKLOAD_PLANE_IFACE")"
CONTROL_PLANE_NETWORK="$(get_network_from_iface "$CONTROL_PLANE_IFACE")"
CONTROL_PLANE_IP="$(get_ip_from_iface "$CONTROL_PLANE_IFACE")"

# Write actual BootstrapConfiguration
cat > "$OUTPUT_FILE" << EOF
apiVersion: metalk8s.scality.com/v1alpha2
kind: BootstrapConfiguration
networks:
  controlPlane: $CONTROL_PLANE_NETWORK
  workloadPlane: $WORKLOAD_PLANE_NETWORK
ca:
  minion: $(cat /etc/salt/minion_id)
apiServer:
  host: ${API_SERVER_VIP:-$CONTROL_PLANE_IP}
  keepalived:
    enabled: $KEEPALIVED_ENABLED
archives:
  - $ARCHIVE_PATH
EOF

# Print the result
ls "$(dirname $OUTPUT_FILE)"
cat "$OUTPUT_FILE"
