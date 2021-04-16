import React, { useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useQuery } from 'react-query';
import { LineChart, Loader as CoreUILoader, Button } from '@scality/core-ui';
import { lighten, darken } from 'polished';
import { intl } from '../translations/IntlGlobalProvider';

import { fromUnixTimestampToDate } from '../services/utils';
import { fetchConfig } from '../services/api';
import { useTypedSelector, useNodes } from '../hooks';
import {
  queryNodeCPUMetrics,
  queryNodeMemoryMetrics,
  queryNodeLoadMetrics,
  queryThroughputRead,
  queryThroughputWrite,
} from '../services/prometheus/fetchMetrics';
import {
  LAST_TWENTY_FOUR_HOURS,
  LAST_ONE_HOUR,
  queryTimeSpansCodes,
} from '../constants';
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
import { expressionFunction } from 'vega';

// Custom formatter to display negative value as absolut value in throughput chart
expressionFunction('throughputFormatter', function (datum, params) {
  return Math.abs(datum).toFixed(2);
});

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
  const nodes = useNodes();

  const [metricsTimeSpan, setMetricsTimeSpan] = useState(
    LAST_TWENTY_FOUR_HOURS,
  );
  // Get dynamic chart size for 1 column, 4 rows
  const [graphWidth, graphHeight] = useDynamicChartSize(
    'dashboard-metrics-container',
    1,
    4,
  );

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

  const throughputColor = {
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
      columns: 2,
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

  const throughputTooltip = getTooltipConfig(
    ((nodes) => {
      let res = [];
      nodes.forEach((element) => {
        res.push({
          field: `${element.name}-read`,
          type: 'quantitative',
          title: `${element.name}-read`,
          formatType: 'throughputFormatter',
        });
        res.push({
          field: `${element.name}-write`,
          type: 'quantitative',
          title: `${element.name}-write`,
          format: '.2f',
        });
      });
      return res;
    })(nodes),
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

  const formatNodesThroughputPromRangeForChart = useCallback(
    (result) => {
      const readRes = result[0];
      const writeRes = result[1];

      if (readRes.status === 'success' && writeRes.status === 'success') {
        const reduced = nodes.reduce((acc, node, index) => {
          let tempRead = [];
          let tempWrite = [];

          const nodeReadData = readRes.data?.result?.find(
            (item) => item.metric?.instance.split(':')[0] === node.internalIP,
          );
          const nodeWriteData = writeRes.data?.result?.find(
            (item) => item.metric?.instance.split(':')[0] === node.internalIP,
          );

          if (nodeReadData)
            tempRead = nodeReadData.values.map((item) => ({
              date: fromUnixTimestampToDate(item[0]),
              type: `${node.name}-read`,
              y: 0 - item[1],
            }));
          if (nodeWriteData)
            tempWrite = nodeWriteData.values.map((item) => ({
              date: fromUnixTimestampToDate(item[0]),
              type: `${node.name}-write`,
              y: item[1],
            }));

          return acc.concat(tempRead).concat(tempWrite);
        }, []);
        return reduced;
      }

      return null;
    },
    [nodes],
  );

  // App config, used to generated Advanced metrics button link
  const configQuery = useQuery('appConfig', fetchConfig);

  // Passing nodes table as a react-queries identifier so if a node is added/removed the data are refreshed
  // Also it makes the data to auto-refresh based on the node refresh timeout that is already implemented
  const cpuDataQuery = useQuery(
    ['dashboardMetricsCPU', nodes, metricsTimeSpan],
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
    ['dashboardMetricsMemory', nodes, metricsTimeSpan],
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
    ['dashboardMetricsLoad', nodes, metricsTimeSpan],
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

  const throughputQuery = useQuery(
    ['throughputQuery', nodes, metricsTimeSpan],
    useCallback(
      () =>
        Promise.all([
          queryThroughputRead(metricsTimeSpan),
          queryThroughputWrite(metricsTimeSpan),
        ]).then((result) => formatNodesThroughputPromRangeForChart(result)),
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

  useEffect(() => {
    // Declaring query locally in useEffect to avoid double setting metricsTimeSpan on each query change
    const query = new URLSearchParams(window.location.search);

    if (query.get('from')) {
      let formatted = queryTimeSpansCodes.find(
        (item) => item.label === query.get('from'),
      );
      setMetricsTimeSpan(formatted.value);
    }
  }, []);

  return (
    <div id="dashboard-metrics-container">
      {configQuery.isSuccess && configQuery.data.url_grafana && (
        <Button
          text={intl.translate('advanced_metrics')}
          variant={'base'}
          icon={<i className="fas fa-external-link-alt" />}
          size={'small'}
          href={`${configQuery.data.url_grafana}/dashboard/db/nodes-detailed`}
          target="_blank"
          rel="noopener noreferrer"
          data-cy="advanced_metrics_node_detailed"
        />
      )}

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
      <GraphWrapper>
        <GraphTitle>
          <div>Throughput</div>
        </GraphTitle>
        {throughputQuery.isLoading && (
          <Loader size="massive" topPosition={graphHeight - 10} />
        )}

        <LineChart
          id={'dashboard_throughput_id'}
          data={throughputQuery.isSuccess ? throughputQuery.data : noData}
          xAxis={xAxis}
          yAxis={yAxis}
          color={throughputQuery.isSuccess ? throughputColor : null}
          width={graphWidth}
          height={graphHeight}
          lineConfig={lineConfig}
          tooltip={true}
          tooltipConfig={throughputTooltip}
          tooltipTheme={'dark'}
        />
      </GraphWrapper>
    </div>
  );
};

export default DashboardMetrics;
