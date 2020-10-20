import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { useHistory } from 'react-router';
import { FormattedDate, FormattedTime } from 'react-intl';
import styled from 'styled-components';
import {
  fontSize,
  padding,
  fontWeight,
} from '@scality/core-ui/dist/style/theme';
import CircleStatus from './CircleStatus';
import ActiveAlertsCounter from './ActiveAlertsCounter';
import { isVolumeDeletable } from '../services/NodeVolumesUtils';
import { deleteVolumeAction } from '../ducks/app/volumes';
import {
  VOLUME_CONDITION_LINK,
  STATUS_CRITICAL,
  STATUS_WARNING,
} from '../constants';
import { Button, Modal, ProgressBar, Loader } from '@scality/core-ui';
import { intl } from '../translations/IntlGlobalProvider';
import { VolumeTab } from './CommonLayoutStyle';

const VolumeDetailCardContainer = styled.div`
  display: flex;
  min-height: 270px;
  margin: ${padding.small};
`;

const VolumeInformation = styled.div`
  width: 50%;
  word-break: break-all;
`;

const VolumeNameTitle = styled.div`
  color: ${(props) => props.theme.brand.textPrimary};
  font-size: ${fontSize.larger};
  padding: ${padding.small} 0 ${padding.larger} ${padding.large};
  display: flex;
  justify-content: space-between;

  i.fa-circle {
    margin-right: ${padding.small};
  }
`;

const InformationSpan = styled.div`
  padding-bottom: 25px;
  padding-left: ${padding.large};
  display: flex;
`;

const InformationLabel = styled.span`
  display: inline-block;
  min-width: 150px;
  font-weight: ${fontWeight.bold};
  font-size: ${fontSize.base};
  color: ${(props) => props.theme.brand.textSecondary};
`;

const InformationValue = styled.span`
  color: ${(props) => props.theme.brand.textPrimary};
  font-size: ${fontSize.base};
`;

const ClickableInformationValue = styled.span`
  color: ${(props) => props.theme.brand.secondary};
  font-size: ${fontSize.base};
  font-weight: ${fontWeight.semibold};
  cursor: pointer;
`;

const DeleteButton = styled(Button)`
  padding: ${padding.base};
  margin: 0px ${padding.base};
  font-size: ${fontSize.small};
  background-color: ${(props) => props.theme.brand.critical};
  ${(props) => {
    if (props.disabled) return { opacity: 0.2 };
  }};
`;

const VolumeGraph = styled.div`
  display: flex;
  flex-direction: column;
  width: 48%;
  margin-left: 2%;
`;

const VolumeUsage = styled.div`
  min-height: 94px;
  background-color: ${(props) => props.theme.brand.primary};
  margin: ${padding.large} ${padding.small} ${padding.large} 0;
  padding: 0 ${padding.base} 0 0;
`;

const VolumeSectionTitle = styled.div`
  color: ${(props) => props.theme.brand.textPrimary};
  font-size: ${fontSize.base};
  font-weight: ${fontWeight.bold};
  padding: ${padding.small} 0 ${padding.base} ${padding.small};
`;

const ProgressBarContainer = styled.div`
  margin: ${padding.small};

  .sc-progressbarcontainer > div {
    background-color: ${(props) => props.theme.brand.secondaryDark1};
  }
`;

const NotificationButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const ModalBody = styled.div`
  padding-bottom: ${padding.base};
`;

const CancelButton = styled(Button)`
  margin-right: ${padding.small};
`;
const LoaderContainer = styled(Loader)`
  padding-left: ${padding.small};
`;

const LabelName = styled.span`
  font-size: ${fontSize.small};
  color: ${(props) => props.theme.brand.textPrimary};
  padding-right: ${padding.base};
`;
const LabelValue = styled.span`
  font-size: ${fontSize.small};
  color: ${(props) => props.theme.brand.textPrimary};
`;

const AlertsCounterContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const VolumeDetailCard = (props) => {
  const {
    name,
    nodeName,
    storage,
    status,
    storageClassName,
    creationTimestamp,
    volumeType,
    usedPodName,
    devicePath,
    volumeUsagePercentage,
    volumeUsageBytes,
    storageCapacity,
    condition,
    volumeListData,
    pVList,
    health,
    alertlist,
  } = props;

  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const theme = useSelector((state) => state.config.theme);

  const deleteVolume = (deleteVolumeName) =>
    dispatch(deleteVolumeAction(deleteVolumeName));
  const [
    isDeleteConfirmationModalOpen,
    setisDeleteConfirmationModalOpen,
  ] = useState(false);

  // Confirm the deletion
  const onClickDeleteButton = (deleteVolumeName, nodeName) => {
    const isAddNodefilter = query.has('node');

    deleteVolume(deleteVolumeName);
    setisDeleteConfirmationModalOpen(false);

    let hightvolumeName;
    if (volumeListData[0]?.name === deleteVolumeName) {
      // delete the first volume
      hightvolumeName = volumeListData[1]?.name;
    } else {
      // after the deletion, automatically select the first volume
      hightvolumeName = volumeListData[0]?.name;
    }
    if (isAddNodefilter && hightvolumeName) {
      history.push(`/volumes/${hightvolumeName}?node=${nodeName}`);
    } else if (!isAddNodefilter && hightvolumeName) {
      history.push(`/volumes/${hightvolumeName}`);
    } else if (isAddNodefilter && !hightvolumeName) {
      history.push(`/volumes/?node=${nodeName}`);
    } else {
      history.push('/volumes');
    }
  };

  const onClickNodeName = () => {
    history.push(`/nodes/${nodeName}`);
  };

  const onClickCancelButton = () => {
    setisDeleteConfirmationModalOpen(false);
  };

  const isEnableClick = isVolumeDeletable(status, name, pVList);

  const pV = pVList.find((pv) => pv.metadata.name === name);
  const labels = pV?.metadata?.labels //persistent Volume labels
    ? Object.keys(pV.metadata.labels).map((key) => {
        return {
          name: key,
          value: pV.metadata.labels[key],
        };
      })
    : [];

  return (
    <VolumeTab>
      <VolumeNameTitle data-cy="volume_detail_card_name">
        <div>
          <CircleStatus className="fas fa-circle" status={health} />
          {name}
        </div>
        <DeleteButton
          variant="danger"
          icon={<i className="fas fa-sm fa-trash" />}
          text={intl.translate('delete_volume')}
          onClick={(e) => {
            e.stopPropagation();
            setisDeleteConfirmationModalOpen(true);
          }}
          disabled={!isEnableClick}
          data-cy="delete_volume_button"
        />
      </VolumeNameTitle>
      <VolumeDetailCardContainer>
        <VolumeInformation>
          <InformationSpan>
            <InformationLabel>{intl.translate('node')}</InformationLabel>
            <ClickableInformationValue onClick={onClickNodeName}>
              {nodeName}
            </ClickableInformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>{intl.translate('size')}</InformationLabel>
            <InformationValue>{storage}</InformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>{intl.translate('status')}</InformationLabel>
            <InformationValue data-cy="volume_status_value">
              {status}
            </InformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>
              {intl.translate('storageClass')}
            </InformationLabel>
            <InformationValue>{storageClassName}</InformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>
              {intl.translate('creationTime')}
            </InformationLabel>
            {creationTimestamp ? (
              <InformationValue>
                <FormattedDate
                  value={creationTimestamp}
                  year="numeric"
                  month="short"
                  day="2-digit"
                />{' '}
                <FormattedTime
                  hour="2-digit"
                  minute="2-digit"
                  second="2-digit"
                  value={creationTimestamp}
                />
              </InformationValue>
            ) : (
              ''
            )}
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>{intl.translate('volume_type')}</InformationLabel>
            <InformationValue>{volumeType}</InformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>{intl.translate('used_by')}</InformationLabel>
            <InformationValue>{usedPodName}</InformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>
              {intl.translate('backend_disk')}
            </InformationLabel>
            <InformationValue>{devicePath}</InformationValue>
          </InformationSpan>
          <InformationSpan>
            <InformationLabel>{intl.translate('labels')}</InformationLabel>
            <InformationValue>
              {labels?.map((label) => {
                return (
                  <div key={label.name}>
                    <LabelName data-cy="volume_label_name">
                      {label.name}
                    </LabelName>
                    <LabelValue data-cy="volume_label_value">
                      {label.value}
                    </LabelValue>
                  </div>
                );
              })}
            </InformationValue>
          </InformationSpan>
        </VolumeInformation>

        <VolumeGraph>
          {alertlist && (
            <AlertsCounterContainer>
              <VolumeSectionTitle>
                {intl.translate('active_alerts')}
              </VolumeSectionTitle>
              <ActiveAlertsCounter
                criticalCounter={
                  alertlist?.filter(
                    (item) => item?.labels?.severity === STATUS_CRITICAL,
                  ).length
                }
                warningCounter={
                  alertlist?.filter(
                    (item) => item?.labels?.severity === STATUS_WARNING,
                  ).length
                }
              />
            </AlertsCounterContainer>
          )}
          {condition === VOLUME_CONDITION_LINK && (
            <VolumeUsage>
              <VolumeSectionTitle>{intl.translate('usage')}</VolumeSectionTitle>
              {volumeUsagePercentage !== intl.translate('unknown') ? (
                <ProgressBarContainer>
                  <ProgressBar
                    size="base"
                    percentage={volumeUsagePercentage}
                    topRightLabel={`${volumeUsagePercentage}%`}
                    bottomLeftLabel={`${volumeUsageBytes} USED`}
                    bottomRightLabel={`${storageCapacity} TOTAL`}
                    backgroundColor={theme.brand.base}
                  />
                </ProgressBarContainer>
              ) : (
                <LoaderContainer size="small" />
              )}
            </VolumeUsage>
          )}
        </VolumeGraph>
        <Modal
          close={() => setisDeleteConfirmationModalOpen(false)}
          isOpen={isDeleteConfirmationModalOpen}
          title={intl.translate('delete_volume')}
          footer={
            <NotificationButtonGroup>
              <CancelButton
                outlined
                text={intl.translate('cancel')}
                onClick={onClickCancelButton}
              />
              <Button
                variant="danger"
                text={intl.translate('delete')}
                onClick={() => {
                  onClickDeleteButton(name, nodeName);
                }}
                data-cy="confirm_deletion_button"
              ></Button>
            </NotificationButtonGroup>
          }
        >
          <ModalBody>
            <div>{intl.translate('delete_a_volume_warning')}</div>
            <div>
              {intl.translate('delete_a_volume_confirm')}
              <strong>{name}</strong>?
            </div>
          </ModalBody>
        </Modal>
      </VolumeDetailCardContainer>
    </VolumeTab>
  );
};

export default VolumeDetailCard;
