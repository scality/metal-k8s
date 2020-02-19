locals {
  metalk8s_iso = {
    mode        = var.metalk8s_iso.mode,
    source      = var.metalk8s_iso.source,
    destination = var.metalk8s_iso.destination,
    mountpoint  = var.metalk8s_iso.mountpoint,
  }
}

resource "null_resource" "upload_local_iso" {
  count = (
    local.metalk8s_iso.mode == "local" && local.metalk8s_iso.source != ""
  ) ? 1 : 0

  depends_on = [
    openstack_compute_instance_v2.bootstrap,
  ]

  connection {
    host        = local.bootstrap_ip
    type        = "ssh"
    user        = local.bootstrap.user
    private_key = openstack_compute_keypair_v2.local.private_key
  }

  provisioner "remote-exec" {
    inline = ["sudo mkdir -p ${dirname(local.metalk8s_iso.destination)}"]
  }

  provisioner "file" {
    source      = local.metalk8s_iso.source
    destination = local.metalk8s_iso.destination
  }
}

resource "null_resource" "download_remote_iso" {
  count = (
    local.metalk8s_iso.mode == "remote" && local.metalk8s_iso.source != ""
  ) ? 1 : 0

  depends_on = [
    null_resource.bootstrap_use_proxy,
  ]

  connection {
    host        = local.bootstrap_ip
    type        = "ssh"
    user        = local.bootstrap.user
    private_key = openstack_compute_keypair_v2.local.private_key
  }

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p ${dirname(local.metalk8s_iso.destination)}",
      join(" ", compact([
        "sudo env",
        local.bastion.enabled
        ? "http_proxy=http://${local.bastion_ip}:${local.bastion.proxy_port} https_proxy=http://${local.bastion_ip}:${local.bastion.proxy_port}"
        : "",
        "curl -o ${local.metalk8s_iso.destination} ${local.metalk8s_iso.source}",
      ])),
    ]
  }
}

resource "null_resource" "configure_bootstrap" {
  count = var.metalk8s_bootstrap ? 1 : 0

  depends_on = [
    # null_resource.bootstrap_iface_config,
    null_resource.provision_scripts_bootstrap,
  ]

  connection {
    host        = local.bootstrap_ip
    type        = "ssh"
    user        = local.bootstrap.user
    private_key = openstack_compute_keypair_v2.local.private_key
  }

  # Prepare for bootstrap installation
  provisioner "remote-exec" {
    inline = [
      join(" ", [
        "sudo python /tmp/metalk8s/scripts/prepare-bootstrap.py",
        "--control-plane-net",
        local.control_plane_network.enabled
        ? local.control_plane_subnet[0].cidr
        : data.openstack_networking_subnet_v2.public_subnet.cidr,
        "--workload-plane-net",
        local.workload_plane_network.enabled
        ? local.workload_plane_subnet[0].cidr
        : data.openstack_networking_subnet_v2.public_subnet.cidr,
        "--archive-path", local.metalk8s_iso.destination,
        "--copy-ssh-key", "/home/${local.bootstrap.user}/.ssh/bootstrap",
      ]),
    ]
  }
}

resource "null_resource" "run_bootstrap" {
  count = var.metalk8s_bootstrap ? 1 : 0

  depends_on = [
    null_resource.upload_local_iso,
    null_resource.download_remote_iso,
    null_resource.configure_bootstrap,
    null_resource.bootstrap_use_proxy,
  ]

  connection {
    host        = local.bootstrap_ip
    type        = "ssh"
    user        = local.bootstrap.user
    private_key = openstack_compute_keypair_v2.local.private_key
  }

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p ${local.metalk8s_iso.mountpoint}",
      join(" ", [
        "sudo mount -o loop",
        local.metalk8s_iso.destination,
        local.metalk8s_iso.mountpoint,
      ]),
      "sudo ${local.metalk8s_iso.mountpoint}/bootstrap.sh --verbose",
    ]
  }
}

resource "null_resource" "enable_ipip" {
  # If one of the networks used by Metal is the default network, PortSecurity
  # will still be enabled, so we need IPIP encapsulation
  count = var.metalk8s_bootstrap && local.enable_ipip ? 1 : 0

  depends_on = [
    null_resource.run_bootstrap,
  ]

  connection {
    host        = local.bootstrap_ip
    type        = "ssh"
    user        = local.bootstrap.user
    private_key = openstack_compute_keypair_v2.local.private_key
  }

  provisioner "remote-exec" {
    inline = ["bash scripts/enable_ipip.sh"]
  }
}

resource "null_resource" "provision_volumes" {
  count = (var.metalk8s_bootstrap && var.metalk8s_provision_volumes) ? 1 : 0

  connection {
    host        = local.bootstrap_ip
    type        = "ssh"
    user        = local.bootstrap.user
    private_key = openstack_compute_keypair_v2.local.private_key
  }

  depends_on = [
    null_resource.run_bootstrap,
  ]

  provisioner "remote-exec" {
    inline = [
      join(" ", [
        "sudo env",
        "PRODUCT_TXT=${local.metalk8s_iso.mountpoint}/product.txt",
        "PRODUCT_MOUNT=${local.metalk8s_iso.mountpoint}",
        "/home/centos/scripts/create-volumes.sh",
      ]),
    ]
  }
}
