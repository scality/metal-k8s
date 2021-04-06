import React, { useCallback } from 'react';
import { useQuery } from 'react-query';
import { LineChart, Loader } from '@scality/core-ui';
import { lighten, darken } from 'polished';

import { refreshNodesAction, stopRefreshNodesAction } from '../ducks/app/nodes';
import { useRefreshEffect, fromUnixTimestampToDate } from '../services/utils';
import { useTypedSelector } from '../hooks';
import {
  queryNodeCPUMetrics,
  queryNodeMemoryMetrics,
  queryNodeLoadMetrics,
} from '../services/prometheus/fetchMetrics';
import { LAST_TWENTY_FOUR_HOURS, LAST_ONE_HOUR } from '../constants';
import {
  yAxisUsage,
  yAxis,
  getTooltipConfig,
} from '../components/LinechartSpec';
import {
  GraphTitle,
  GraphWrapper,
} from '../components/style/CommonLayoutStyle';
import { useDynamicChartSize } from '../services/utils';

// import styled from 'styled-components';

const DashboardMetrics = () => {
  // Making sure nodes list is loaded
  useRefreshEffect(refreshNodesAction, stopRefreshNodesAction);
  const nodes = useTypedSelector((state) => state.app.nodes.list);
  const theme = useTypedSelector((state) => state.config.theme);
  // Get dynamic chart size for 1 column, 4 rows
  const [graphWidth, graphHeight] = useDynamicChartSize(
    'dashboard-metrics-container',
    1,
    4,
  );

  const metricsTimeSpan = LAST_TWENTY_FOUR_HOURS;

  // We use 4 main color from the palette and decline them (lighter/ darker) when we have more than 4 datasets
  const colorRange = [
    '#245A83',
    '#808080',
    '#A04EC9',
    '#C6B38A',
    lighten(0.3, '#245A83'),
    lighten(0.3, '#808080'),
    lighten(0.3, '#A04EC9'),
    lighten(0.3, '#C6B38A'),
    darken(0.2, '#245A83'),
    darken(0.2, '#808080'),
    darken(0.2, '#A04EC9'),
    darken(0.2, '#C6B38A'),
  ];

  const xAxis = {
    field: 'date',
    type: 'temporal',
    axis: {
      // Refer to all the available time format: https://github.com/d3/d3-time-format#locale_format
      format:
        metricsTimeSpan === (LAST_ONE_HOUR || LAST_TWENTY_FOUR_HOURS)
          ? '%H:%M'
          : '%m/%d',
      ticks: true,
      tickCount: 4,
      labelColor: theme.brand.textSecondary,
    },
    title: null,
  };

  const perNodeColor = {
    field: 'type',
    type: 'nominal',
    scale: {
      range: colorRange,
    },
    legend: {
      direction: 'horizontal',
      orient: 'bottom',
      title: null,
      labelFontSize: 12,
      symbolSize: 300,
      columns: 3,
    },
  };

  const perNodeTooltip = getTooltipConfig(
    nodes.map((node) => ({
      field: node.name,
      type: 'quantitative',
      title: node.name,
      format: '.2f',
    })),
  );

  const lineConfig = { strokeWidth: 1.5 };

  const formatNodesPromRangeForChart = useCallback(
    (result) => {
      const reduced = nodes.reduce((acc, node, index) => {
        let temp = [];
        if (
          result[index].status === 'success' &&
          result[index].data.result[0].values.length
        ) {
          temp = result[index].data.result[0].values.map((item) => ({
            date: fromUnixTimestampToDate(item[0]),
            type: node.name,
            y: item[1],
          }));
        }
        return acc.concat(temp);
      }, []);
      return reduced;
    },
    [nodes],
  );

  // Passing nodes table as a react-queries identifier so if a node is added/removed the data are refreshed
  // Also it makes the data to auto-refresh based on the node refresh timeout that is already implemented
  const cpuDataQuery = useQuery(
    ['dashboardMetricsCPU', nodes],
    useCallback(
      () =>
        Promise.all(
          nodes.map((node) =>
            queryNodeCPUMetrics(node.internalIP, metricsTimeSpan),
          ),
        ).then((result) => formatNodesPromRangeForChart(result)),
      [nodes, metricsTimeSpan, formatNodesPromRangeForChart],
    ),
  );

  const memoryDataQuery = useQuery(
    ['dashboardMetricsMemory', nodes],
    useCallback(
      () =>
        Promise.all(
          nodes.map((node) =>
            queryNodeMemoryMetrics(node.internalIP, metricsTimeSpan),
          ),
        ).then((result) => formatNodesPromRangeForChart(result)),
      [nodes, metricsTimeSpan, formatNodesPromRangeForChart],
    ),
  );

  const loadDataQuery = useQuery(
    ['dashboardMetricsLoad', nodes],
    useCallback(
      () =>
        Promise.all(
          nodes.map((node) =>
            queryNodeLoadMetrics(node.internalIP, metricsTimeSpan),
          ),
        ).then((result) => formatNodesPromRangeForChart(result)),
      [nodes, metricsTimeSpan, formatNodesPromRangeForChart],
    ),
  );

  return (
    <div id="dashboard-metrics-container">
      <GraphWrapper className="cpuusage">
        <GraphTitle>
          <div>CPU Usage (%)</div>
          {cpuDataQuery.isLoading && <Loader />}
        </GraphTitle>
        {!cpuDataQuery.isLoading && cpuDataQuery.isSuccess ? (
          <LineChart
            id={'dashboard_cpu_id'}
            data={cpuDataQuery.data}
            xAxis={xAxis}
            yAxis={yAxisUsage}
            color={perNodeColor}
            width={graphWidth}
            height={graphHeight}
            lineConfig={lineConfig}
            tooltip={true}
            tooltipConfig={perNodeTooltip}
            tooltipTheme={'dark'}
          />
        ) : null}
      </GraphWrapper>
      <GraphWrapper className="cpuusage">
        <GraphTitle>
          <div>Memory</div>
          {cpuDataQuery.isLoading && <Loader />}
        </GraphTitle>

        {!memoryDataQuery.isLoading && memoryDataQuery.isSuccess ? (
          <LineChart
            id={'dashboard_memory_id'}
            data={memoryDataQuery.data}
            xAxis={xAxis}
            yAxis={yAxisUsage}
            color={perNodeColor}
            width={graphWidth}
            height={graphHeight}
            lineConfig={lineConfig}
            tooltip={true}
            tooltipConfig={perNodeTooltip}
            tooltipTheme={'dark'}
          />
        ) : null}
      </GraphWrapper>
      <GraphWrapper className="cpuusage">
        <GraphTitle>
          <div>System Load</div>
          {cpuDataQuery.isLoading && <Loader />}
        </GraphTitle>

        {!loadDataQuery.isLoading && loadDataQuery.isSuccess ? (
          <LineChart
            id={'dashboard_load_id'}
            data={loadDataQuery.data}
            xAxis={xAxis}
            yAxis={yAxis}
            color={perNodeColor}
            width={graphWidth}
            height={graphHeight}
            lineConfig={lineConfig}
            tooltip={true}
            tooltipConfig={perNodeTooltip}
            tooltipTheme={'dark'}
          />
        ) : null}
      </GraphWrapper>
    </div>
  );
};

export default DashboardMetrics;
