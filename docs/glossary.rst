Glossary
========
.. glossary::

  LVM Physical Volume : LVM
  LVM PV : LVM
    An volume (disk or partition) consumed by a :term:`Volume Group<LVM VG>` to
    provide storage to :term:`Logical Volumes<LVM LV>`.

  LVM Volume Group : LVM
  LVM VG : LVM
    A logical unit which aggregates :term:`Physical Volumes<LVM PV>` to
    provision :term:`Logical Volumes<LVM LV>`

  LVM Logical Volume : LVM
  LVM LV : LVM
    A volume, part of a :term:`Volume Group<LVM LV>`, which exposes a slice of
    its backing storage.

  Kubernetes PersistentVolume : Kubernetes
  Kubernetes PV : Kubernetes
    An existing persistent storage volume available to Kubernetes workloads.

  Kubernetes PersistentVolumeClaim : Kubernetes
  Kubernetes PVC : Kubernetes
    A claim on a :term:`PersistentVolume<Kubernetes PersistentVolume>`, consumed
    by one or more *Pods*.
