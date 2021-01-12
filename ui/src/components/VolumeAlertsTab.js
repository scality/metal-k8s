import React from 'react';
import { useSelector } from 'react-redux';
import { FormattedDate, FormattedTime } from 'react-intl';
import { useLocation } from 'react-router';
import styled from 'styled-components';
import {
  fontSize,
  padding,
  fontWeight,
} from '@scality/core-ui/dist/style/theme';
import ActiveAlertsFilters from './ActiveAlertsFilters';
import { Chips } from '@scality/core-ui';
import { useTable } from 'react-table';
import { intl } from '../translations/IntlGlobalProvider';
import { VolumeTab } from './CommonLayoutStyle';

// Overriding overflow for the Tab since the table components has inner scroll
const VolumeAlertTab = styled(VolumeTab)`
  overflow: hidden;
`;

const ActiveAlertsCardContainer = styled.div`
  margin: ${padding.small};
  padding: ${padding.small};
`;

const ActiveAlertsTitle = styled.div`
  color: ${(props) => props.theme.brand.textPrimary};
  font-size: ${fontSize.base};
  font-weight: ${fontWeight.bold};
  padding: ${padding.small} 0 0 ${padding.large};
  display: flex;
  justify-content: space-between;
`;

const ActiveAlertsTableContainer = styled.div`
  color: ${(props) => props.theme.brand.textPrimary};
  padding: 1rem;
  font-family: 'Lato';
  font-size: ${fontSize.base};
  border-color: ${(props) => props.theme.brand.borderLight};
  table {
    border-spacing: 0;

    tr {
      :last-child {
        td {
          border-bottom: 0;
          font-weight: normal;
        }
      }
    }

    th {
      font-weight: bold;
      height: 56px;
      text-align: left;
      padding: 0.5rem;
    }

    td {
      height: 80px;
      margin: 0;
      padding: 0.5rem;
      border-bottom: 1px solid black;
      height: 30px;
      :last-child {
        border-right: 0;
      }
    }
  }
`;

const HeadRow = styled.tr`
  width: 100%;
  /* To display scroll bar on the table */
  display: table;
  table-layout: fixed;
`;

// * table body
const Body = styled.tbody`
  /* To display scroll bar on the table */
  display: block;
  height: calc(100vh - 250px);
  overflow: auto;
  overflow-y: auto;
`;

const ActiveAlertsCard = (props) => {
  const { alertlist, PVCName } = props;
  const location = useLocation();
  const theme = useSelector((state) => state.config.theme);

  const query = new URLSearchParams(location.search);
  const selectedFilter = query.get('severity');

  let activeAlertListData =
    alertlist?.map((alert) => {
      return {
        name: alert.labels.alertname,
        severity: alert.labels.severity,
        alert_description: alert.annotations.description || alert.annotations.summary || alert.annotations.message,
        active_since: alert.startsAt,
      };
    }) ?? [];

  if (activeAlertListData && selectedFilter)
    activeAlertListData = activeAlertListData.filter(
      (item) => item.severity === selectedFilter,
    );

  // React Table for the volume list
  function Table({ columns, data }) {
    // Use the state and functions returned from useTable to build your UI
    const {
      getTableProps,
      getTableBodyProps,
      headerGroups,
      rows,
      prepareRow,
    } = useTable({
      columns,
      data,
    });

    // Render the UI for your table
    return (
      <table {...getTableProps()}>
        <thead>
          {headerGroups.map((headerGroup) => (
            <HeadRow {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column) => {
                const headerStyleProps = column.getHeaderProps({
                  style: column.cellStyle,
                });
                return <th {...headerStyleProps}>{column.render('Header')}</th>;
              })}
            </HeadRow>
          ))}
        </thead>

        <Body {...getTableBodyProps()}>
          {!PVCName && (
            <HeadRow
              style={{
                width: '100%',
                paddingTop: padding.base,
                height: '60px',
              }}
            >
              <td
                style={{
                  textAlign: 'center',
                  background: theme.brand.primary,
                }}
              >
                {intl.translate('volume_is_not_bound')}
              </td>
            </HeadRow>
          )}
          {PVCName && data?.length === 0 && (
            <HeadRow
              style={{
                width: '100%',
                paddingTop: padding.base,
                height: '60px',
              }}
            >
              <td
                style={{
                  textAlign: 'center',
                  background: theme.brand.primary,
                }}
              >
                {intl.translate('no_active_alerts')}
              </td>
            </HeadRow>
          )}
          {rows?.map((row, i) => {
            prepareRow(row);
            return (
              <HeadRow {...row.getRowProps()}>
                {row.cells.map((cell) => {
                  let cellProps = cell.getCellProps({
                    style: {
                      ...cell.column.cellStyle,
                    },
                  });
                  if (cell.column.Header === 'Active since') {
                    return (
                      <td {...cellProps}>
                        <span>
                          <FormattedDate value={cell.value} />{' '}
                          <FormattedTime
                            hour="2-digit"
                            minute="2-digit"
                            second="2-digit"
                            value={cell.value}
                          />
                        </span>
                      </td>
                    );
                  } else if (cell.column.Header === 'Severity') {
                    if (cell.value === 'warning') {
                      return (
                        <td {...cellProps}>
                          <Chips text={cell.render('Cell')} variant="warning" />
                        </td>
                      );
                    } else if (cell.value === 'critical') {
                      return (
                        <td {...cellProps}>
                          <Chips
                            text={cell.render('Cell')}
                            variant="critical"
                          />
                        </td>
                      );
                    }
                  } else {
                    return <td {...cellProps}>{cell.render('Cell')}</td>;
                  }
                  return null;
                })}
              </HeadRow>
            );
          })}
        </Body>
      </table>
    );
  }
  // columns for alert table
  const columns = React.useMemo(
    () => [
      {
        Header: 'Name',
        accessor: 'name',
        cellStyle: { width: '200px' },
      },
      {
        Header: 'Severity',
        accessor: 'severity',
        cellStyle: { textAlign: 'center', width: '100px' },
      },
      { Header: 'Description', accessor: 'alert_description' },
      {
        Header: 'Active since',
        accessor: 'active_since',
        cellStyle: { textAlign: 'center', width: '150px' },
      },
    ],
    [],
  );

  return (
    <VolumeAlertTab>
      <ActiveAlertsCardContainer>
        <ActiveAlertsTitle>
          <div>{intl.translate('active_alert')}</div>
          {PVCName && activeAlertListData?.length !== 0 && (
            <ActiveAlertsFilters />
          )}
        </ActiveAlertsTitle>

        <ActiveAlertsTableContainer>
          <Table columns={columns} data={activeAlertListData} />
        </ActiveAlertsTableContainer>
      </ActiveAlertsCardContainer>
    </VolumeAlertTab>
  );
};

export default ActiveAlertsCard;
