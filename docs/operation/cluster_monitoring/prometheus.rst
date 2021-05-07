Prometheus
==========

In a MetalK8s cluster, the Prometheus service records real-time metrics in a
time series database. Prometheus can query a list of data sources called
"exporters" at a specific polling frequency, and aggregate this data across the
various sources.

Prometheus uses a special language, Prometheus Query Language (PromQL),
to write alerting and recording rules.

Default Alert Rules
-------------------

Alert rules enable a user to specify a condition that must occur before an
external system like Slack is notified. For example, a MetalK8s administrator
might want to raise an alert for any node that is unreachable for more than
one minute.

Out of the box, MetalK8s ships with preconfigured alert rules, which are
written as PromQL queries.
The table below outlines all the preconfigured alert rules exposed from
a newly deployed MetalK8s cluster.

To customize predefined alert rules, refer to
:ref:`csc-prometheus-customization`.

.. csv-table:: Default Prometheus Alerting rules
   :file: ../../../tools/rule_extractor/alerting_rules.csv
   :header: "Name", "Severity", "Description"

Snapshot Prometheus Database
----------------------------

Snapshotting Prometheus database can be useful for backup and restore,
but also to export the platform metrics in order to investigate, for
example, a performance issue.

To snapshot the database, you must first
:ref:`enable the Prometheus admin API<csc-enable-prometheus-admin-api>`.

To generate a snapshot, use the
:ref:`sosreport utility<sosreport-generate-report>` with the following options:

.. code-block:: console

   root@host # sosreport --batch -o metalk8s -kprometheus-snapshot=True

The name of the generated archive is printed on the console output and
the Prometheus snapshot can be found under ``prometheus_snapshot`` directory.

.. warning::

   You must ensure you have sufficient disk space (at least the size
   of the Prometheus volume) under ``/var/tmp`` or change the archive
   destination with ``--tmp-dir=<new_dest>`` option.
