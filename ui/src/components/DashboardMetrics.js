import React, { useCallback } from 'react';
import styled from 'styled-components';
import { useQuery } from 'react-query';
import { LineChart, Loader as CoreUILoader } from '@scality/core-ui';
import { lighten, darken } from 'polished';

import { fromUnixTimestampToDate } from '../services/utils';
import { useTypedSelector, useNodes } from '../hooks';
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
  GraphWrapper as GraphWrapperCommon,
} from '../components/style/CommonLayoutStyle';
import { useDynamicChartSize } from '../services/utils';
import { zIndex } from '@scality/core-ui/dist/style/theme';

const GraphWrapper = styled(GraphWrapperCommon)`
  position: relative;
  min-height: 200px;

  .sc-loader {
    background: none;
  }
`;

const Loader = styled(CoreUILoader)`
  background: none !important;
  position: absolute;
  ${(props) => `top: ${props.topPosition || '0'}px;`}
  left: 30px;
  z-index: ${zIndex.overlay};
`;

// import styled from 'styled-components';

const DashboardMetrics = () => {
  const theme = useTypedSelector((state) => state.config.theme);
  // Get dynamic chart size for 1 column, 4 rows
  const [graphWidth, graphHeight] = useDynamicChartSize(
    'dashboard-metrics-container',
    1,
    4,
  );
  const nodes = useNodes();

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

  // we use this to display empty chart since passing [] makes vega-lite crash
  const noData = [
    {
      date: 0,
      type: '',
      y: 0,
    },
  ];

  return (
    <div id="dashboard-metrics-container">
      <GraphWrapper>
        <GraphTitle>
          <div>CPU Usage (%)</div>
        </GraphTitle>
        {cpuDataQuery.isLoading && !cpuDataQuery.isSuccess && (
          <Loader size="massive" topPosition={graphHeight - 10} />
        )}
        <LineChart
          id={'dashboard_cpu_id'}
          data={cpuDataQuery.isSuccess ? cpuDataQuery.data : noData}
          xAxis={xAxis}
          yAxis={yAxisUsage}
          color={cpuDataQuery.isSuccess ? perNodeColor : null}
          width={graphWidth}
          height={graphHeight}
          lineConfig={lineConfig}
          tooltip={true}
          tooltipConfig={perNodeTooltip}
          tooltipTheme={'dark'}
        />
      </GraphWrapper>

      <GraphWrapper>
        <GraphTitle>
          <div>Memory</div>
        </GraphTitle>
        {memoryDataQuery.isLoading && (
          <Loader size="massive" topPosition={graphHeight - 10} />
        )}
        <LineChart
          id={'dashboard_memory_id'}
          data={memoryDataQuery.isSuccess ? memoryDataQuery.data : noData}
          xAxis={xAxis}
          yAxis={yAxisUsage}
          color={memoryDataQuery.isSuccess ? perNodeColor : null}
          width={graphWidth}
          height={graphHeight}
          lineConfig={lineConfig}
          tooltip={true}
          tooltipConfig={perNodeTooltip}
          tooltipTheme={'dark'}
        />
      </GraphWrapper>
      <GraphWrapper>
        <GraphTitle>
          <div>System Load</div>
        </GraphTitle>
        {loadDataQuery.isLoading && (
          <Loader size="massive" topPosition={graphHeight - 10} />
        )}

        <LineChart
          id={'dashboard_load_id'}
          data={loadDataQuery.isSuccess ? loadDataQuery.data : noData}
          xAxis={xAxis}
          yAxis={yAxis}
          color={loadDataQuery.isSuccess ? perNodeColor : null}
          width={graphWidth}
          height={graphHeight}
          lineConfig={lineConfig}
          tooltip={true}
          tooltipConfig={perNodeTooltip}
          tooltipTheme={'dark'}
        />
      </GraphWrapper>
    </div>
  );
};

export default DashboardMetrics;
