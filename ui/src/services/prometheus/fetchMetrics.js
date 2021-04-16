// @flow
import { queryPrometheus, queryPrometheusRange } from './api';
import {
  LAST_SEVEN_DAYS,
  LAST_TWENTY_FOUR_HOURS,
  LAST_ONE_HOUR,
  SAMPLE_DURATION_LAST_SEVEN_DAYS,
  SAMPLE_DURATION_LAST_TWENTY_FOUR_HOURS,
  SAMPLE_DURATION_LAST_ONE_HOUR,
  SAMPLE_FREQUENCY_LAST_SEVEN_DAYS,
  SAMPLE_FREQUENCY_LAST_TWENTY_FOUR_HOURS,
  SAMPLE_FREQUENCY_LAST_ONE_HOUR,
  PORT_NODE_EXPORTER,
} from '../../constants';

import type { PrometheusQueryResult } from './api';

export function queryNodeFSUsage(
  instanceIP: string,
): Promise<PrometheusQueryResult> {
  // All system partitions, except the ones mounted by containerd.
  // Ingoring the Filesystem ISSO 9660 and tmpfs & share memory devices.
  const nodeFilesystemUsageQuery = `(1 - node_filesystem_avail_bytes{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}",job=~"node-exporter",device!~'rootfs|shm|tmpfs', fstype!='iso9660'} / node_filesystem_size_bytes{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}",job=~"node-exporter",device!~'rootfs|shm', fstype!='iso9660'}) * 100`;

  return queryPrometheus(nodeFilesystemUsageQuery).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}

export function queryNodeFSSize(
  instanceIP: string,
): Promise<PrometheusQueryResult> {
  const nodeFilesystemSizeBytesQuery = `node_filesystem_size_bytes{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}",job=~"node-exporter",device!~'rootfs|shm|tmpfs', fstype!='iso9660'}`;

  return queryPrometheus(nodeFilesystemSizeBytesQuery).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}

const getMetricsTimeValues = (
  timeSpan: string,
): {
  startingTimeISO: string,
  currentTimeISO: string,
  sampleFrequency: number,
} => {
  let sampleDuration: number = 0;
  let sampleFrequency: number = 0;

  if (timeSpan === LAST_TWENTY_FOUR_HOURS) {
    sampleDuration = SAMPLE_DURATION_LAST_TWENTY_FOUR_HOURS;
    sampleFrequency = SAMPLE_FREQUENCY_LAST_TWENTY_FOUR_HOURS;
  } else if (timeSpan === LAST_SEVEN_DAYS) {
    sampleDuration = SAMPLE_DURATION_LAST_SEVEN_DAYS;
    sampleFrequency = SAMPLE_FREQUENCY_LAST_SEVEN_DAYS;
  } else if (timeSpan === LAST_ONE_HOUR) {
    sampleDuration = SAMPLE_DURATION_LAST_ONE_HOUR;
    sampleFrequency = SAMPLE_FREQUENCY_LAST_ONE_HOUR;
  }

  const currentTime = new Date();
  const currentTimeISO = currentTime.toISOString(); // To query Prometheus the date should follow `RFC3339` format
  const startingTimestamp =
    Math.round(currentTime.getTime() / 1000) - sampleDuration;
  const startingTimeISO = new Date(startingTimestamp * 1000).toISOString();

  return { startingTimeISO, currentTimeISO, sampleFrequency };
};

export function queryNodeCPUMetrics(
  instanceIP: string,
  timeSpan: string,
): Promise<PrometheusQueryResult> {
  const cpuUsageQuery = `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",instance=~"${instanceIP}:${PORT_NODE_EXPORTER}"}[5m])) * 100)`;
  const {
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
  } = getMetricsTimeValues(timeSpan);

  return queryPrometheusRange(
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
    cpuUsageQuery,
  ).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}

export function queryNodeMemoryMetrics(
  instanceIP: string,
  timeSpan: string,
): Promise<PrometheusQueryResult> {
  const memoryQuery = `sum(100 - ((node_memory_MemAvailable_bytes{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}"} * 100) / node_memory_MemTotal_bytes{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}"}))`;
  const {
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
  } = getMetricsTimeValues(timeSpan);

  return queryPrometheusRange(
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
    memoryQuery,
  ).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}

export function queryNodeLoadMetrics(
  instanceIP: string,
  timeSpan: string,
): Promise<PrometheusQueryResult> {
  const systemLoadQuery = `avg(node_load1{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}"}) / count(count(node_cpu_seconds_total{instance=~"${instanceIP}:${PORT_NODE_EXPORTER}"}) by (cpu)) * 100`;
  const {
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
  } = getMetricsTimeValues(timeSpan);

  return queryPrometheusRange(
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
    systemLoadQuery,
  ).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}

export function queryThroughputRead(
  timeSpan: string,
): Promise<PrometheusQueryResult> {
  const nodeThroughputReadQuery = `sum(sum(irate(node_disk_read_bytes_total[1m])) by (instance, device) * 0.000001) by(instance)`;
  const {
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
  } = getMetricsTimeValues(timeSpan);

  return queryPrometheusRange(
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
    nodeThroughputReadQuery,
  ).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}

export function queryThroughputWrite(
  timeSpan: string,
): Promise<PrometheusQueryResult> {
  const nodeThroughputWriteQuery = `sum(sum(irate(node_disk_written_bytes_total[1m])) by (instance, device) * 0.000001)by(instance)`;
  const {
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
  } = getMetricsTimeValues(timeSpan);

  return queryPrometheusRange(
    startingTimeISO,
    currentTimeISO,
    sampleFrequency,
    nodeThroughputWriteQuery,
  ).then((resolve) => {
    if (resolve.error) {
      throw resolve.error;
    }
    return resolve;
  });
}
