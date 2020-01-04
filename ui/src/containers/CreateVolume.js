import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouteMatch, useHistory } from 'react-router';
import { Formik, Form } from 'formik';
import * as yup from 'yup';
import { injectIntl } from 'react-intl';
import styled from 'styled-components';
import Loader from '../components/Loader';
import Banner from '../components/Banner';
import { Input, Button, Breadcrumb, Tooltip } from '@scality/core-ui';
import isEmpty from 'lodash.isempty';
import {
  fetchStorageClassAction,
  createVolumeAction,
} from '../ducks/app/volumes';
import {
  padding,
  fontSize,
  fontWeight,
} from '@scality/core-ui/dist/style/theme';
import {
  SPARSE_LOOP_DEVICE,
  RAW_BLOCK_DEVICE,
  STATUS_BANNER_WARNING,
} from '../constants';
import {
  BreadcrumbContainer,
  BreadcrumbLabel,
  StyledLink,
} from '../components/BreadcrumbStyle';
import { sizeUnits } from '../services/utils';

// We might want to do a factorization later for
// form styled components
const CreateVolumeContainer = styled.div`
  display: inline-block;
  height: 100%;
  padding: ${padding.base};
`;

const FormSection = styled.div`
  display: flex;
  padding: 0 ${padding.larger};
  flex-direction: column;
  .sc-input-wrapper {
    width: 200px;
  }
`;

const ActionContainer = styled.div`
  display: flex;
  margin: ${padding.large} 0;
  justify-content: flex-end;
  button {
    margin-right: ${padding.large};
  }
`;

const CreateVolumeLayout = styled.div`
  display: inline-block;
  margin-top: ${padding.base};
  form {
    .sc-input {
      display: inline-flex;
      margin: ${padding.smaller} 0;
      .sc-input-label {
        width: 150px;
      }
    }
  }
  .sc-select-option-label,
  .sc-select__placeholder {
    font-size: ${fontSize.base};
  }
`;

const SizeFieldContainer = styled.div`
  display: inline-flex;
  align-items: flex-start;
  .sc-input-wrapper,
  .sc-input-type {
    width: 100px;
    box-sizing: border-box;
    height: 38px;
  }
`;

const SizeUnitFieldSelectContainer = styled.div`
  .sc-select {
    width: 100px;
    padding-left: 5px;
  }
`;

const InputContainer = styled.div`
  /* display: inline-flex; */
  display: flex;
  align-items: center;
`;

const InputLabel = styled.label`
  padding: ${padding.small};
  font-size: ${fontSize.base};
  color: ${props => props.theme.brand.text};
`;

const LabelsContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const LabelsForm = styled.div`
  display: inline-block;
  .sc-input-wrapper {
    margin-right: ${padding.small};
  }
`;

const LabelsList = styled.div`
  margin: ${padding.small} 0;
  max-height: 200px;
  overflow: auto;
`;

const LabelsKeyValue = styled.div`
  display: flex;
`;

const LabelsValue = styled.div`
  width: 200px;
  padding: ${padding.small} 0;
  margin-right: ${padding.small};
  color: ${props => props.theme.brand.text};
`;

const LabelsName = styled(LabelsValue)`
  font-weight: ${fontWeight.bold};
  color: ${props => props.theme.brand.text};
`;

const TooltipContent = styled.div`
  width: 100px;
`;

const HelpIcon = styled.div`
  padding-left: ${padding.small};
`;

const CreateVolume = props => {
  const { intl } = props;
  const dispatch = useDispatch();
  const history = useHistory();
  const match = useRouteMatch();
  const createVolume = (body, nodeName) =>
    dispatch(createVolumeAction(body, nodeName));

  const storageClass = useSelector(state => state.app.volumes.storageClass);
  const theme = useSelector(state => state.config.theme);
  const api = useSelector(state => state.config.api);

  useEffect(() => {
    dispatch(fetchStorageClassAction());
  }, [dispatch]);

  const nodeName = match.params.id;
  const storageClassesName = storageClass.map(item => item.metadata.name);
  const isStorageClassLoading = useSelector(
    state => state.app.volumes.isSCLoading,
  );

  const [labelName, setLabelName] = useState('');
  const [labelValue, setLabelValue] = useState('');

  // Hardcoded
  const types = [
    {
      label: 'RawBlockDevice',
      value: RAW_BLOCK_DEVICE,
    },
    {
      label: 'SparseLoopDevice',
      value: SPARSE_LOOP_DEVICE,
    },
  ];

  const initialValues = {
    name: '',
    storageClass: storageClassesName[0],
    type: types[0].value,
    path: '',
    selectedUnit: sizeUnits[3].value,
    sizeInput: '',
    labels: {},
  };
  const volumeNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
  const positiveIntegerRegex = /^[1-9][0-9]*$/;

  const validationSchema = yup.object().shape({
    name: yup
      .string()
      .matches(volumeNameRegex, intl.messages.volume_name_error)
      .required(
        intl.formatMessage(
          { id: 'generic_missing_field' },
          { field: intl.messages.name.toLowerCase() },
        ),
      ),
    storageClass: yup.string().required(),
    type: yup.string().required(),
    path: yup
      .string()
      .matches(/^\//, intl.messages.volume_path_error)
      .when('type', {
        is: RAW_BLOCK_DEVICE,
        then: yup
          .string()
          .required(
            intl.formatMessage(
              { id: 'generic_missing_field' },
              { field: intl.messages.device_path.toLowerCase() },
            ),
          ),
      }),
    sizeInput: yup.string().when('type', {
      is: SPARSE_LOOP_DEVICE,
      then: yup
        .string()
        .matches(positiveIntegerRegex, intl.messages.volume_size_error)
        .required(
          intl.formatMessage(
            { id: 'generic_missing_field' },
            { field: intl.messages.volume_size.toLowerCase() },
          ),
        ),
    }),
    selectedUnit: yup.string().when('type', {
      is: SPARSE_LOOP_DEVICE,
      then: yup.string(),
    }),
    labels: yup.object(),
  });
  const isStorageClassExist = storageClassesName.length > 0;

  return isStorageClassLoading ? (
    <Loader />
  ) : (
    <CreateVolumeContainer>
      <BreadcrumbContainer>
        <Breadcrumb
          activeColor={theme.brand.secondary}
          paths={[
            <StyledLink to="/nodes">{intl.messages.nodes}</StyledLink>,
            <StyledLink
              to={`/nodes/${match.params.id}/volumes`}
              title={match.params.id}
            >
              {match.params.id}
            </StyledLink>,
            <BreadcrumbLabel>
              {intl.messages.create_new_volume}
            </BreadcrumbLabel>,
          ]}
        />
      </BreadcrumbContainer>

      {isStorageClassExist ? null : (
        <Banner
          type={STATUS_BANNER_WARNING}
          icon={<i className="fas fa-exclamation-triangle" />}
          title={intl.messages.no_storage_class_found}
          messages={[
            <>
              {intl.messages.storage_class_is_required}
              <a
                rel="noopener noreferrer"
                target="_blank"
                href={`${api.url_doc}/operation/volume_management/storageclass_creation.html`}
              >
                {intl.messages.learn_more}
              </a>
            </>,
          ]}
        />
      )}
      <CreateVolumeLayout>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={values => {
            const newVolume = { ...values };
            newVolume.size = `${values.sizeInput}${values.selectedUnit}`;
            createVolume(newVolume, nodeName);
          }}
        >
          {formikProps => {
            const {
              values,
              handleChange,
              errors,
              touched,
              setFieldTouched,
              dirty,
              setFieldValue,
            } = formikProps;

            //touched is not "always" correctly set
            const handleOnBlur = e => setFieldTouched(e.target.name, true);
            const handleSelectChange = field => selectedObj => {
              setFieldValue(field, selectedObj ? selectedObj.value : '');
            };
            //get the select item from the object array
            const getSelectedObjectItem = (items, selectedValue) => {
              return items.find(item => item.value === selectedValue);
            };

            const addLabel = () => {
              const labels = values.labels;
              labels[labelName] = labelValue;
              setFieldValue('labels', labels);
              setLabelName('');
              setLabelValue('');
            };

            const removeLabel = key => {
              const labels = values.labels;
              delete labels[key];
              setFieldValue('labels', labels);
            };

            const optionsStorageClasses = storageClassesName.map(SCName => {
              return {
                label: SCName,
                value: SCName,
                'data-cy': `storageClass-${SCName}`,
              };
            });
            const optionsTypes = types.map(({ label, value }) => {
              return {
                label,
                value,
                'data-cy': `type-${value}`,
              };
            });

            const optionsSizeUnits = sizeUnits
              /**
               * `sizeUnits` have a base 2 and base 10 units
               * (ie. KiB and KB).
               * We chose to only display base 2 units
               * to improve the UX.
               */
              .filter((size, idx) => idx < 6)
              .map(({ label, value }) => {
                return {
                  label,
                  value,
                  'data-cy': `size-${label}`,
                };
              });
            return (
              <Form>
                <FormSection>
                  <Input
                    name="name"
                    value={values.name}
                    onChange={handleChange('name')}
                    label={intl.messages.name}
                    error={touched.name && errors.name}
                    onBlur={handleOnBlur}
                  />
                  <InputContainer className="sc-input">
                    <InputLabel className="sc-input-label">
                      {intl.messages.labels}
                    </InputLabel>
                    <LabelsContainer>
                      <LabelsForm>
                        <Input
                          name="labelName"
                          placeholder={intl.messages.enter_label_name}
                          value={labelName}
                          onChange={e => {
                            setLabelName(e.target.value);
                          }}
                        />
                        <Input
                          name="labelValue"
                          placeholder={intl.messages.enter_label_value}
                          value={labelValue}
                          onChange={e => {
                            setLabelValue(e.target.value);
                          }}
                        />
                        <Button
                          text={intl.messages.add}
                          type="button"
                          onClick={addLabel}
                          data-cy="add-volume-labels-button"
                          outlined
                        />
                      </LabelsForm>
                      {!!Object.keys(values.labels).length && (
                        <LabelsList>
                          {Object.keys(values.labels).map((key, index) => (
                            <LabelsKeyValue key={`labelKeyValue_${index}`}>
                              <LabelsName>{key}</LabelsName>
                              <LabelsValue>{values.labels[key]}</LabelsValue>
                              <Button
                                icon={<i className="fas fa-lg fa-trash" />}
                                inverted={true}
                                type="button"
                                onClick={() => removeLabel(key)}
                              />
                            </LabelsKeyValue>
                          ))}
                        </LabelsList>
                      )}
                    </LabelsContainer>
                  </InputContainer>
                  <InputContainer>
                    <Input
                      id="storageClass_input"
                      label={intl.messages.storageClass}
                      clearable={false}
                      type="select"
                      options={optionsStorageClasses}
                      placeholder={intl.messages.select_a_storageClass}
                      noOptionsMessage={() => intl.messages.no_results}
                      name="storageClass"
                      onChange={handleSelectChange('storageClass')}
                      value={getSelectedObjectItem(
                        optionsStorageClasses,
                        values?.storageClass,
                      )}
                      error={touched.storageClass && errors.storageClass}
                      onBlur={handleOnBlur}
                    />
                    <HelpIcon>
                      <Tooltip
                        placement="right"
                        overlay={
                          <TooltipContent>
                            {intl.messages.how_to_create_storage_class}
                          </TooltipContent>
                        }
                      >
                        <Button
                          icon={<i className="fas fa-question-circle" />}
                          inverted={true}
                          type="button"
                          onClick={() =>
                            window.open(
                              `${api.url_doc}/operation/volume_management/storageclass_creation.html`,
                            )
                          }
                        />
                      </Tooltip>
                    </HelpIcon>
                  </InputContainer>
                  <Input
                    id="type_input"
                    label={intl.messages.type}
                    clearable={false}
                    type="select"
                    options={optionsTypes}
                    placeholder={intl.messages.select_a_type}
                    noOptionsMessage={() => intl.messages.no_results}
                    name="type"
                    onChange={handleSelectChange('type')}
                    value={getSelectedObjectItem(optionsTypes, values?.type)}
                    error={touched.type && errors.type}
                    onBlur={handleOnBlur}
                  />
                  {values.type === SPARSE_LOOP_DEVICE ? (
                    <SizeFieldContainer>
                      <Input
                        name="sizeInput"
                        type="number"
                        min="1"
                        value={values.sizeInput}
                        onChange={handleChange('sizeInput')}
                        label={intl.messages.volume_size}
                        error={touched.sizeInput && errors.sizeInput}
                        onBlur={handleOnBlur}
                      />
                      <SizeUnitFieldSelectContainer>
                        <Input
                          id="unit_input"
                          label=""
                          clearable={false}
                          type="select"
                          options={optionsSizeUnits}
                          noOptionsMessage={() => intl.messages.no_results}
                          name="selectedUnit"
                          onChange={handleSelectChange('selectedUnit')}
                          value={getSelectedObjectItem(
                            optionsSizeUnits,
                            values?.selectedUnit,
                          )}
                          error={touched.selectedUnit && errors.selectedUnit}
                          onBlur={handleOnBlur}
                        />
                      </SizeUnitFieldSelectContainer>
                    </SizeFieldContainer>
                  ) : (
                    <Input
                      name="path"
                      value={values.path}
                      onChange={handleChange('path')}
                      label={intl.messages.device_path}
                      error={touched.path && errors.path}
                      onBlur={handleOnBlur}
                    />
                  )}
                </FormSection>
                <ActionContainer>
                  <Button
                    text={intl.messages.cancel}
                    type="button"
                    outlined
                    onClick={() =>
                      history.push(`/nodes/${match.params.id}/volumes`)
                    }
                  />
                  <Button
                    text={intl.messages.create}
                    type="submit"
                    disabled={!dirty || !isEmpty(errors)}
                    data-cy="submit-create-volume"
                  />
                </ActionContainer>
              </Form>
            );
          }}
        </Formik>
      </CreateVolumeLayout>
    </CreateVolumeContainer>
  );
};

export default injectIntl(CreateVolume);
