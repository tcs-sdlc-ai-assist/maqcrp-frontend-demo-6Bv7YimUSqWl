import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useQC } from '../contexts/QCContext';
import { useLoans } from '../contexts/LoanContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { formatDate } from '../utils/dateUtils';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'SamplingConfigPage';

const ALLOWED_ROLES = ['admin'];

const METHODOLOGIES = [
  { value: 'random', label: 'Random Sampling', description: 'Selects loans randomly from the eligible pool based on the configured sample rate.' },
  { value: 'risk_based', label: 'Risk-Based Sampling', description: 'Scores loans by risk criteria and selects the highest-risk loans for review.' },
  { value: 'targeted', label: 'Targeted Sampling', description: 'Selects specific loans matching defined criteria for focused review.' },
  { value: 'threshold', label: 'Threshold-Based Sampling', description: 'Selects all loans that exceed defined threshold values.' },
];

const PRODUCT_TYPES = ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];
const CHANNELS = ['retail', 'correspondent', 'broker', 'wholesale'];

const PRODUCT_TYPE_LABELS = {
  conventional: 'Conventional',
  FHA: 'FHA',
  VA: 'VA',
  jumbo: 'Jumbo',
  USDA: 'USDA',
};

const CHANNEL_LABELS = {
  retail: 'Retail',
  correspondent: 'Correspondent',
  broker: 'Broker',
  wholesale: 'Wholesale',
};

const CONDITION_FIELDS = [
  { value: 'creditScore', label: 'Credit Score' },
  { value: 'ltv', label: 'LTV' },
  { value: 'dti', label: 'DTI' },
  { value: 'loanAmount', label: 'Loan Amount' },
  { value: 'borrowerIncome', label: 'Borrower Income' },
];

const CONDITION_OPERATORS = [
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
];

const SamplingConfigForm = ({ config, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    methodology: 'random',
    sampleRate: 10,
    filters: {
      productTypes: [],
      channels: [],
      sellerIds: [],
      minLoanAmount: '',
      maxLoanAmount: '',
    },
    riskCriteria: [],
    thresholdRules: [],
    isActive: true,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const isEditing = config && config.id;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && config) {
        setFormData({
          name: config.name || '',
          methodology: config.methodology || 'random',
          sampleRate: config.sampleRate ?? 10,
          filters: {
            productTypes: Array.isArray(config.filters?.productTypes) ? [...config.filters.productTypes] : [],
            channels: Array.isArray(config.filters?.channels) ? [...config.filters.channels] : [],
            sellerIds: Array.isArray(config.filters?.sellerIds) ? [...config.filters.sellerIds] : [],
            minLoanAmount: config.filters?.minLoanAmount !== undefined && config.filters?.minLoanAmount !== null ? String(config.filters.minLoanAmount) : '',
            maxLoanAmount: config.filters?.maxLoanAmount !== undefined && config.filters?.maxLoanAmount !== null ? String(config.filters.maxLoanAmount) : '',
          },
          riskCriteria: Array.isArray(config.riskCriteria) ? config.riskCriteria.map((c) => ({
            field: c.field || '',
            operator: c.operator || 'gte',
            value: c.value !== undefined && c.value !== null ? c.value : '',
            weight: c.weight ?? 0,
          })) : [],
          thresholdRules: Array.isArray(config.thresholdRules) ? config.thresholdRules.map((r) => ({
            field: r.field || '',
            operator: r.operator || 'gte',
            value: r.value !== undefined && r.value !== null ? r.value : '',
          })) : [],
          isActive: config.isActive !== undefined ? config.isActive : true,
        });
      } else {
        setFormData({
          name: '',
          methodology: 'random',
          sampleRate: 10,
          filters: {
            productTypes: [],
            channels: [],
            sellerIds: [],
            minLoanAmount: '',
            maxLoanAmount: '',
          },
          riskCriteria: [],
          thresholdRules: [],
          isActive: true,
        });
      }

      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, isEditing, config]);

  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [errors]);

  const handleFilterChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      filters: { ...prev.filters, [field]: value },
    }));
  }, []);

  const handleProductTypeToggle = useCallback((productType) => {
    setFormData((prev) => {
      const current = prev.filters.productTypes;
      if (current.includes(productType)) {
        return {
          ...prev,
          filters: { ...prev.filters, productTypes: current.filter((p) => p !== productType) },
        };
      }
      return {
        ...prev,
        filters: { ...prev.filters, productTypes: [...current, productType] },
      };
    });
  }, []);

  const handleChannelToggle = useCallback((channel) => {
    setFormData((prev) => {
      const current = prev.filters.channels;
      if (current.includes(channel)) {
        return {
          ...prev,
          filters: { ...prev.filters, channels: current.filter((c) => c !== channel) },
        };
      }
      return {
        ...prev,
        filters: { ...prev.filters, channels: [...current, channel] },
      };
    });
  }, []);

  const handleRiskCriterionChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const riskCriteria = [...prev.riskCriteria];
      riskCriteria[index] = { ...riskCriteria[index], [field]: value };
      return { ...prev, riskCriteria };
    });

    const errorKey = `riskCriteria[${index}].${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }, [errors]);

  const handleAddRiskCriterion = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      riskCriteria: [...prev.riskCriteria, { field: '', operator: 'gte', value: '', weight: 0 }],
    }));
  }, []);

  const handleRemoveRiskCriterion = useCallback((index) => {
    setFormData((prev) => {
      const riskCriteria = prev.riskCriteria.filter((_, i) => i !== index);
      return { ...prev, riskCriteria };
    });
  }, []);

  const handleThresholdRuleChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const thresholdRules = [...prev.thresholdRules];
      thresholdRules[index] = { ...thresholdRules[index], [field]: value };
      return { ...prev, thresholdRules };
    });

    const errorKey = `thresholdRules[${index}].${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }, [errors]);

  const handleAddThresholdRule = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      thresholdRules: [...prev.thresholdRules, { field: '', operator: 'gte', value: '' }],
    }));
  }, []);

  const handleRemoveThresholdRule = useCallback((index) => {
    setFormData((prev) => {
      const thresholdRules = prev.thresholdRules.filter((_, i) => i !== index);
      return { ...prev, thresholdRules };
    });
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Configuration name is required.';
    }

    if (!formData.methodology || !METHODOLOGIES.find((m) => m.value === formData.methodology)) {
      newErrors.methodology = 'Please select a valid sampling methodology.';
    }

    if (formData.sampleRate === undefined || formData.sampleRate === null || formData.sampleRate === '') {
      newErrors.sampleRate = 'Sample rate is required.';
    } else {
      const rate = Number(formData.sampleRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        newErrors.sampleRate = 'Sample rate must be between 0 and 100.';
      }
    }

    if (formData.methodology === 'risk_based') {
      if (formData.riskCriteria.length === 0) {
        newErrors.riskCriteria = 'At least one risk criterion is required for risk-based sampling.';
      } else {
        for (let i = 0; i < formData.riskCriteria.length; i++) {
          const criterion = formData.riskCriteria[i];
          if (!criterion.field || criterion.field.trim() === '') {
            newErrors[`riskCriteria[${i}].field`] = 'Field is required.';
          }
          if (criterion.value === '' || criterion.value === undefined || criterion.value === null) {
            newErrors[`riskCriteria[${i}].value`] = 'Value is required.';
          }
          if (criterion.weight === undefined || criterion.weight === null || criterion.weight === '') {
            newErrors[`riskCriteria[${i}].weight`] = 'Weight is required.';
          } else if (isNaN(Number(criterion.weight)) || Number(criterion.weight) <= 0) {
            newErrors[`riskCriteria[${i}].weight`] = 'Weight must be a positive number.';
          }
        }
      }
    }

    if (formData.methodology === 'threshold') {
      if (formData.thresholdRules.length === 0) {
        newErrors.thresholdRules = 'At least one threshold rule is required for threshold-based sampling.';
      } else {
        for (let i = 0; i < formData.thresholdRules.length; i++) {
          const rule = formData.thresholdRules[i];
          if (!rule.field || rule.field.trim() === '') {
            newErrors[`thresholdRules[${i}].field`] = 'Field is required.';
          }
          if (rule.value === '' || rule.value === undefined || rule.value === null) {
            newErrors[`thresholdRules[${i}].value`] = 'Value is required.';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const configData = {
        name: formData.name.trim(),
        methodology: formData.methodology,
        sampleRate: Number(formData.sampleRate),
        filters: {
          productTypes: formData.filters.productTypes.length > 0 ? formData.filters.productTypes : undefined,
          channels: formData.filters.channels.length > 0 ? formData.filters.channels : undefined,
          sellerIds: formData.filters.sellerIds.length > 0 ? formData.filters.sellerIds : undefined,
          minLoanAmount: formData.filters.minLoanAmount !== '' ? Number(formData.filters.minLoanAmount) : undefined,
          maxLoanAmount: formData.filters.maxLoanAmount !== '' ? Number(formData.filters.maxLoanAmount) : undefined,
        },
        riskCriteria: formData.methodology === 'risk_based'
          ? formData.riskCriteria.map((c) => ({
              field: c.field.trim(),
              operator: c.operator,
              value: isNaN(Number(c.value)) ? c.value : Number(c.value),
              weight: Number(c.weight),
            }))
          : null,
        thresholdRules: formData.methodology === 'threshold'
          ? formData.thresholdRules.map((r) => ({
              field: r.field.trim(),
              operator: r.operator,
              value: isNaN(Number(r.value)) ? r.value : Number(r.value),
            }))
          : null,
        isActive: formData.isActive,
      };

      if (isMountedRef.current) {
        onSave(configData);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Sampling config form submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, onSave]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
  );

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='sampling-config-form-title'
      aria-describedby='sampling-config-form-description'
    >
      <div className='w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-8 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10'>
          <div>
            <h2 id='sampling-config-form-title' className='text-lg font-semibold text-gray-900'>
              {isEditing ? 'Edit Sampling Configuration' : 'Create Sampling Configuration'}
            </h2>
            <p id='sampling-config-form-description' className='text-sm text-gray-500 mt-0.5'>
              {isEditing
                ? 'Update the sampling configuration settings.'
                : 'Define a new sampling configuration for QC loan selection.'}
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close sampling config form'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-5 h-5'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div className='px-6 py-5 space-y-5'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='sampling-config-name'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Configuration Name
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                ref={nameInputRef}
                id='sampling-config-name'
                type='text'
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={isSubmitting}
                placeholder='e.g., Standard Monthly Random Sample'
                className={`input-enterprise ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Configuration name'
                aria-describedby={errors.name ? 'sampling-config-name-error' : undefined}
                aria-invalid={errors.name ? 'true' : 'false'}
              />
              {errors.name && (
                <p id='sampling-config-name-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5 flex-shrink-0'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='15' y1='9' x2='9' y2='15' />
                    <line x1='9' y1='9' x2='15' y2='15' />
                  </svg>
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='sampling-config-methodology'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Methodology
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <select
                id='sampling-config-methodology'
                value={formData.methodology}
                onChange={(e) => handleFieldChange('methodology', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.methodology ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Sampling methodology'
              >
                {METHODOLOGIES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.methodology && (
                <p className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5 flex-shrink-0'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='15' y1='9' x2='9' y2='15' />
                    <line x1='9' y1='9' x2='15' y2='15' />
                  </svg>
                  {errors.methodology}
                </p>
              )}
            </div>
          </div>

          <div className='p-4 rounded-xl bg-blue-50 border border-blue-200'>
            <div className='flex items-start gap-3'>
              <div className='flex-shrink-0 mt-0.5'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-5 h-5 text-blue-600'
                >
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='16' x2='12' y2='12' />
                  <line x1='12' y1='8' x2='12.01' y2='8' />
                </svg>
              </div>
              <div>
                <p className='text-sm font-semibold text-blue-800'>
                  {METHODOLOGIES.find((m) => m.value === formData.methodology)?.label || 'Sampling Methodology'}
                </p>
                <p className='text-xs text-blue-700 mt-1'>
                  {METHODOLOGIES.find((m) => m.value === formData.methodology)?.description || ''}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor='sampling-config-rate'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Sample Rate (%)
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <input
              id='sampling-config-rate'
              type='number'
              value={formData.sampleRate}
              onChange={(e) => handleFieldChange('sampleRate', e.target.value)}
              disabled={isSubmitting}
              min={0}
              max={100}
              placeholder='0–100'
              className={`input-enterprise w-32 ${errors.sampleRate ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Sample rate percentage'
              aria-describedby={errors.sampleRate ? 'sampling-config-rate-error' : undefined}
              aria-invalid={errors.sampleRate ? 'true' : 'false'}
            />
            {errors.sampleRate && (
              <p id='sampling-config-rate-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5 flex-shrink-0'
                >
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
                {errors.sampleRate}
              </p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1.5'>
              Filters (Optional)
            </label>

            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>
                  Product Types
                </label>
                <div className='flex flex-wrap gap-2'>
                  {PRODUCT_TYPES.map((productType) => {
                    const isSelected = formData.filters.productTypes.includes(productType);
                    return (
                      <button
                        key={productType}
                        type='button'
                        onClick={() => handleProductTypeToggle(productType)}
                        disabled={isSubmitting}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-enterprise-50 text-enterprise-700 border-enterprise-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                        aria-label={`${isSelected ? 'Remove' : 'Add'} ${PRODUCT_TYPE_LABELS[productType]} product type`}
                        aria-pressed={isSelected}
                      >
                        {PRODUCT_TYPE_LABELS[productType]}
                        {isSelected && (
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='w-3.5 h-3.5 ml-1.5'
                          >
                            <polyline points='20 6 9 17 4 12' />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>
                  Channels
                </label>
                <div className='flex flex-wrap gap-2'>
                  {CHANNELS.map((channel) => {
                    const isSelected = formData.filters.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type='button'
                        onClick={() => handleChannelToggle(channel)}
                        disabled={isSubmitting}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-enterprise-50 text-enterprise-700 border-enterprise-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                        aria-label={`${isSelected ? 'Remove' : 'Add'} ${CHANNEL_LABELS[channel]} channel`}
                        aria-pressed={isSelected}
                      >
                        {CHANNEL_LABELS[channel]}
                        {isSelected && (
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='w-3.5 h-3.5 ml-1.5'
                          >
                            <polyline points='20 6 9 17 4 12' />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='sampling-config-min-amount'
                    className='block text-xs font-medium text-gray-600 mb-1'
                  >
                    Min Loan Amount
                  </label>
                  <input
                    id='sampling-config-min-amount'
                    type='number'
                    value={formData.filters.minLoanAmount}
                    onChange={(e) => handleFilterChange('minLoanAmount', e.target.value)}
                    disabled={isSubmitting}
                    placeholder='e.g., 50000'
                    className='input-enterprise py-1.5 text-sm'
                    aria-label='Minimum loan amount filter'
                  />
                </div>

                <div>
                  <label
                    htmlFor='sampling-config-max-amount'
                    className='block text-xs font-medium text-gray-600 mb-1'
                  >
                    Max Loan Amount
                  </label>
                  <input
                    id='sampling-config-max-amount'
                    type='number'
                    value={formData.filters.maxLoanAmount}
                    onChange={(e) => handleFilterChange('maxLoanAmount', e.target.value)}
                    disabled={isSubmitting}
                    placeholder='e.g., 1000000'
                    className='input-enterprise py-1.5 text-sm'
                    aria-label='Maximum loan amount filter'
                  />
                </div>
              </div>
            </div>
          </div>

          {formData.methodology === 'risk_based' && (
            <div>
              <div className='flex items-center justify-between mb-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  Risk Criteria
                  <span className='text-red-500 ml-0.5'>*</span>
                </label>
                <button
                  type='button'
                  onClick={handleAddRiskCriterion}
                  disabled={isSubmitting}
                  className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-enterprise-600 hover:text-enterprise-700 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5'
                  >
                    <line x1='12' y1='5' x2='12' y2='19' />
                    <line x1='5' y1='12' x2='19' y2='12' />
                  </svg>
                  Add Criterion
                </button>
              </div>

              {errors.riskCriteria && typeof errors.riskCriteria === 'string' && (
                <p className='text-xs text-red-600 mb-2 flex items-center gap-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5 flex-shrink-0'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='15' y1='9' x2='9' y2='15' />
                    <line x1='9' y1='9' x2='15' y2='15' />
                  </svg>
                  {errors.riskCriteria}
                </p>
              )}

              <div className='space-y-3'>
                {formData.riskCriteria.map((criterion, index) => (
                  <div key={index} className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <div className='flex items-center justify-between mb-3'>
                      <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                        Criterion {index + 1}
                      </span>
                      <button
                        type='button'
                        onClick={() => handleRemoveRiskCriterion(index)}
                        disabled={isSubmitting}
                        className='p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                        aria-label={`Remove criterion ${index + 1}`}
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={2}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='w-4 h-4'
                        >
                          <line x1='18' y1='6' x2='6' y2='18' />
                          <line x1='6' y1='6' x2='18' y2='18' />
                        </svg>
                      </button>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                      <div>
                        <label
                          htmlFor={`risk-criterion-field-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Field
                        </label>
                        <select
                          id={`risk-criterion-field-${index}`}
                          value={criterion.field}
                          onChange={(e) => handleRiskCriterionChange(index, 'field', e.target.value)}
                          disabled={isSubmitting}
                          className={`input-enterprise py-1.5 text-sm ${errors[`riskCriteria[${index}].field`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          aria-label={`Risk criterion ${index + 1} field`}
                        >
                          <option value=''>Select field...</option>
                          {CONDITION_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        {errors[`riskCriteria[${index}].field`] && (
                          <p className='text-xs text-red-600 mt-1'>
                            {errors[`riskCriteria[${index}].field`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`risk-criterion-operator-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Operator
                        </label>
                        <select
                          id={`risk-criterion-operator-${index}`}
                          value={criterion.operator}
                          onChange={(e) => handleRiskCriterionChange(index, 'operator', e.target.value)}
                          disabled={isSubmitting}
                          className='input-enterprise py-1.5 text-sm'
                          aria-label={`Risk criterion ${index + 1} operator`}
                        >
                          {CONDITION_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`risk-criterion-value-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Value
                        </label>
                        <input
                          id={`risk-criterion-value-${index}`}
                          type='text'
                          value={criterion.value}
                          onChange={(e) => handleRiskCriterionChange(index, 'value', e.target.value)}
                          disabled={isSubmitting}
                          placeholder='e.g., 620'
                          className={`input-enterprise py-1.5 text-sm ${errors[`riskCriteria[${index}].value`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          aria-label={`Risk criterion ${index + 1} value`}
                        />
                        {errors[`riskCriteria[${index}].value`] && (
                          <p className='text-xs text-red-600 mt-1'>
                            {errors[`riskCriteria[${index}].value`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`risk-criterion-weight-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Weight
                        </label>
                        <input
                          id={`risk-criterion-weight-${index}`}
                          type='number'
                          value={criterion.weight}
                          onChange={(e) => handleRiskCriterionChange(index, 'weight', e.target.value)}
                          disabled={isSubmitting}
                          min={1}
                          placeholder='e.g., 10'
                          className={`input-enterprise py-1.5 text-sm ${errors[`riskCriteria[${index}].weight`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          aria-label={`Risk criterion ${index + 1} weight`}
                        />
                        {errors[`riskCriteria[${index}].weight`] && (
                          <p className='text-xs text-red-600 mt-1'>
                            {errors[`riskCriteria[${index}].weight`]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.methodology === 'threshold' && (
            <div>
              <div className='flex items-center justify-between mb-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  Threshold Rules
                  <span className='text-red-500 ml-0.5'>*</span>
                </label>
                <button
                  type='button'
                  onClick={handleAddThresholdRule}
                  disabled={isSubmitting}
                  className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-enterprise-600 hover:text-enterprise-700 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5'
                  >
                    <line x1='12' y1='5' x2='12' y2='19' />
                    <line x1='5' y1='12' x2='19' y2='12' />
                  </svg>
                  Add Rule
                </button>
              </div>

              {errors.thresholdRules && typeof errors.thresholdRules === 'string' && (
                <p className='text-xs text-red-600 mb-2 flex items-center gap-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5 flex-shrink-0'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='15' y1='9' x2='9' y2='15' />
                    <line x1='9' y1='9' x2='15' y2='15' />
                  </svg>
                  {errors.thresholdRules}
                </p>
              )}

              <div className='space-y-3'>
                {formData.thresholdRules.map((rule, index) => (
                  <div key={index} className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <div className='flex items-center justify-between mb-3'>
                      <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                        Rule {index + 1}
                      </span>
                      <button
                        type='button'
                        onClick={() => handleRemoveThresholdRule(index)}
                        disabled={isSubmitting}
                        className='p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                        aria-label={`Remove threshold rule ${index + 1}`}
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={2}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='w-4 h-4'
                        >
                          <line x1='18' y1='6' x2='6' y2='18' />
                          <line x1='6' y1='6' x2='18' y2='18' />
                        </svg>
                      </button>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                      <div>
                        <label
                          htmlFor={`threshold-rule-field-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Field
                        </label>
                        <select
                          id={`threshold-rule-field-${index}`}
                          value={rule.field}
                          onChange={(e) => handleThresholdRuleChange(index, 'field', e.target.value)}
                          disabled={isSubmitting}
                          className={`input-enterprise py-1.5 text-sm ${errors[`thresholdRules[${index}].field`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          aria-label={`Threshold rule ${index + 1} field`}
                        >
                          <option value=''>Select field...</option>
                          {CONDITION_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        {errors[`thresholdRules[${index}].field`] && (
                          <p className='text-xs text-red-600 mt-1'>
                            {errors[`thresholdRules[${index}].field`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`threshold-rule-operator-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Operator
                        </label>
                        <select
                          id={`threshold-rule-operator-${index}`}
                          value={rule.operator}
                          onChange={(e) => handleThresholdRuleChange(index, 'operator', e.target.value)}
                          disabled={isSubmitting}
                          className='input-enterprise py-1.5 text-sm'
                          aria-label={`Threshold rule ${index + 1} operator`}
                        >
                          {CONDITION_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`threshold-rule-value-${index}`}
                          className='block text-xs font-medium text-gray-600 mb-1'
                        >
                          Value
                        </label>
                        <input
                          id={`threshold-rule-value-${index}`}
                          type='text'
                          value={rule.value}
                          onChange={(e) => handleThresholdRuleChange(index, 'value', e.target.value)}
                          disabled={isSubmitting}
                          placeholder='e.g., 620'
                          className={`input-enterprise py-1.5 text-sm ${errors[`thresholdRules[${index}].value`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          aria-label={`Threshold rule ${index + 1} value`}
                        />
                        {errors[`thresholdRules[${index}].value`] && (
                          <p className='text-xs text-red-600 mt-1'>
                            {errors[`thresholdRules[${index}].value`]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='flex items-center gap-3'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={formData.isActive}
                onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                disabled={isSubmitting}
                className='w-4 h-4 rounded border-gray-300 text-enterprise-600 focus:ring-enterprise-500'
              />
              <span className='text-sm text-gray-700'>Active</span>
            </label>
          </div>

          {errors.submit && (
            <div className='p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in'>
              <div className='flex items-start gap-2'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 text-red-500 flex-shrink-0 mt-0.5'
                >
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
                <p className='text-sm text-red-700'>{errors.submit}</p>
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl'>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='btn-enterprise-secondary'
          >
            Cancel
          </button>

          <button
            type='button'
            onClick={handleSubmit}
            disabled={isSubmitting}
            className='btn-enterprise-primary'
          >
            {isSubmitting ? (
              <>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 mr-2 animate-spin'
                >
                  <path d='M21 12a9 9 0 1 1-6.219-8.56' />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 mr-2'
                >
                  <polyline points='20 6 9 17 4 12' />
                </svg>
                {isEditing ? 'Save Changes' : 'Create Configuration'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

SamplingConfigForm.propTypes = {
  config: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

SamplingConfigForm.defaultProps = {
  config: null,
};

const SamplingRunResultModal = ({ result, isOpen, onClose }) => {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !result) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='sampling-run-result-title'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='sampling-run-result-title' className='text-lg font-semibold text-gray-900'>
              Sampling Run Results
            </h2>
            <p className='text-sm text-gray-500 mt-0.5'>
              {result.configName || 'Sampling configuration'} executed successfully.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
            aria-label='Close sampling run results'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-5 h-5'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div className='px-6 py-5'>
          <div className='grid grid-cols-2 gap-4 mb-6'>
            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200 text-center'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Eligible Loans
              </p>
              <p className='text-2xl font-bold text-gray-900'>{result.eligibleCount ?? 0}</p>
            </div>

            <div className='p-4 rounded-xl bg-enterprise-50 border border-enterprise-200 text-center'>
              <p className='text-xs font-medium text-enterprise-600 uppercase tracking-wider mb-1'>
                Selected
              </p>
              <p className='text-2xl font-bold text-enterprise-700'>{result.selectedCount ?? 0}</p>
            </div>
          </div>

          {result.selectedLoanIds && result.selectedLoanIds.length > 0 && (
            <div>
              <p className='text-sm font-semibold text-gray-700 mb-2'>
                Selected Loans ({result.selectedLoanIds.length})
              </p>
              <div className='max-h-48 overflow-y-auto space-y-1'>
                {result.selectedLoanIds.map((loanId, idx) => (
                  <div
                    key={loanId || idx}
                    className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 text-sm'
                  >
                    <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-enterprise-100 text-enterprise-700 text-2xs font-bold'>
                      {idx + 1}
                    </span>
                    <span className='font-mono text-gray-700'>{loanId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.selectedLoanIds && result.selectedLoanIds.length === 0 && (
            <div className='text-center py-6'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-10 h-10 text-gray-300 mx-auto mb-2'
              >
                <circle cx='12' cy='12' r='10' />
                <line x1='12' y1='16' x2='12' y2='12' />
                <line x1='12' y1='8' x2='12.01' y2='8' />
              </svg>
              <p className='text-sm text-gray-500'>No loans matched the sampling criteria.</p>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl'>
          <button
            type='button'
            onClick={onClose}
            className='btn-enterprise-primary'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

SamplingRunResultModal.propTypes = {
  result: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

SamplingRunResultModal.defaultProps = {
  result: null,
};

const SamplingConfigPage = () => {
  const navigate = useNavigate();
  const { samplingConfigs, saveSamplingConfig, deleteSamplingConfig, runSampling } = useQC();
  const { loans } = useLoans();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isRunResultOpen, setIsRunResultOpen] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedConfigId, setExpandedConfigId] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeConfigs = useMemo(() => {
    if (!Array.isArray(samplingConfigs)) {
      return [];
    }
    return samplingConfigs;
  }, [samplingConfigs]);

  const safeLoans = useMemo(() => {
    if (!Array.isArray(loans)) {
      return [];
    }
    return loans;
  }, [loans]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(safeConfigs, { initialPageSize: 25 });

  const handleCreateConfig = useCallback(() => {
    setEditingConfig(null);
    setIsFormOpen(true);
  }, []);

  const handleEditConfig = useCallback((config) => {
    if (!config) return;
    setEditingConfig(config);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingConfig(null);
  }, []);

  const handleSaveConfig = useCallback(
    (configData) => {
      if (!configData || typeof configData !== 'object') {
        return;
      }

      try {
        const dataToSave = editingConfig && editingConfig.id
          ? { ...configData, id: editingConfig.id }
          : configData;

        const result = saveSamplingConfig(dataToSave);

        if (result) {
          logEvent(
            'SAMPLING_CONFIG_SAVE',
            'sampling_config',
            result.id,
            {
              name: result.name,
              methodology: result.methodology,
              sampleRate: result.sampleRate,
            },
            currentPersona?.label || 'Unknown',
          );

          addNotification(
            'success',
            editingConfig ? 'Configuration Updated' : 'Configuration Created',
            `Sampling configuration "${result.name}" has been ${editingConfig ? 'updated' : 'created'} successfully.`,
          );

          handleCloseForm();
        } else {
          addNotification(
            'error',
            'Save Failed',
            'Failed to save sampling configuration. Please try again.',
          );
        }
      } catch (err) {
        warn(COMPONENT_NAME, 'Failed to save sampling config', err);
        addNotification(
          'error',
          'Error',
          'An unexpected error occurred while saving the configuration.',
        );
      }
    },
    [editingConfig, saveSamplingConfig, logEvent, addNotification, currentPersona, handleCloseForm],
  );

  const handleDeleteConfig = useCallback(
    (config) => {
      if (!config || !config.id) return;

      const success = deleteSamplingConfig(config.id);

      if (success) {
        addNotification(
          'success',
          'Configuration Deleted',
          `Sampling configuration "${config.name}" has been deleted.`,
        );
      } else {
        addNotification(
          'error',
          'Delete Failed',
          'Failed to delete sampling configuration. Please try again.',
        );
      }
    },
    [deleteSamplingConfig, addNotification],
  );

  const handleRunSampling = useCallback(
    (config) => {
      if (!config || !config.id) return;

      if (isRunning) return;

      setIsRunning(true);

      try {
        const selectedLoanIds = runSampling(config, safeLoans);

        const result = {
          configName: config.name,
          methodology: config.methodology,
          eligibleCount: safeLoans.length,
          selectedCount: selectedLoanIds.length,
          selectedLoanIds,
          executedAt: new Date().toISOString(),
        };

        logEvent(
          'QC_SAMPLING_RUN',
          'sampling_config',
          config.id,
          {
            configName: config.name,
            methodology: config.methodology,
            eligibleCount: safeLoans.length,
            selectedCount: selectedLoanIds.length,
          },
          currentPersona?.label || 'Unknown',
        );

        if (isMountedRef.current) {
          setRunResult(result);
          setIsRunResultOpen(true);
        }

        addNotification(
          'success',
          'Sampling Run Complete',
          `${selectedLoanIds.length} of ${safeLoans.length} loans selected using "${config.name}".`,
        );

        info(COMPONENT_NAME, 'Sampling run completed', {
          configId: config.id,
          configName: config.name,
          selectedCount: selectedLoanIds.length,
        });
      } catch (err) {
        warn(COMPONENT_NAME, 'Failed to run sampling', err);
        addNotification(
          'error',
          'Sampling Run Failed',
          'An error occurred while running the sampling algorithm.',
        );
      } finally {
        if (isMountedRef.current) {
          setIsRunning(false);
        }
      }
    },
    [isRunning, safeLoans, runSampling, logEvent, addNotification, currentPersona],
  );

  const handleCloseRunResult = useCallback(() => {
    setIsRunResultOpen(false);
    setRunResult(null);
  }, []);

  const handleToggleExpand = useCallback((configId) => {
    setExpandedConfigId((prev) => (prev === configId ? null : configId));
  }, []);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Sampling Configurations', path: '/sampling' },
  ];

  const methodologyLabel = (methodology) => {
    const found = METHODOLOGIES.find((m) => m.value === methodology);
    return found ? found.label : methodology || 'Unknown';
  };

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Sampling Configurations</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Configure and manage QC sampling methodologies for loan selection.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleCreateConfig}
              className='btn-enterprise-primary'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-4 h-4 mr-2'
              >
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
              Create Configuration
            </button>
          </div>
        </div>

        <div className='card-enterprise'>
          <div className='flex items-center justify-between mb-4'>
            <p className='text-sm text-gray-500'>
              {safeConfigs.length === 0
                ? 'No sampling configurations found'
                : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} configurations`}
            </p>
          </div>

          {paginatedData.length === 0 ? (
            <div className='text-center py-16'>
              <div className='mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={1.5}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-8 h-8 text-gray-400'
                >
                  <circle cx='11' cy='11' r='8' />
                  <line x1='21' y1='21' x2='16.65' y2='16.65' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Configurations Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No sampling configurations have been created yet. Click &ldquo;Create Configuration&rdquo; to get started.
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {paginatedData.map((config) => {
                if (!config) return null;

                const isExpanded = expandedConfigId === config.id;

                return (
                  <div
                    key={config.id}
                    className='rounded-xl border border-gray-200 overflow-hidden'
                  >
                    <div className='flex items-center justify-between px-5 py-4 bg-gray-50/50'>
                      <div className='flex items-center gap-4 flex-1 min-w-0'>
                        <button
                          type='button'
                          onClick={() => handleToggleExpand(config.id)}
                          className='flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                          aria-expanded={isExpanded}
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          >
                            <polyline points='9 18 15 12 9 6' />
                          </svg>
                        </button>

                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2'>
                            <h3 className='text-sm font-semibold text-gray-900 truncate'>
                              {config.name || 'Unnamed Configuration'}
                            </h3>
                            <span className='text-xs text-gray-400 font-mono flex-shrink-0'>
                              {config.id}
                            </span>
                          </div>
                          <div className='flex items-center gap-3 mt-1'>
                            <span className='text-xs text-gray-500'>
                              {methodologyLabel(config.methodology)}
                            </span>
                            <span className='text-xs text-gray-400'>•</span>
                            <span className='text-xs text-gray-500'>
                              {config.sampleRate ?? 0}% sample rate
                            </span>
                            {config.isActive ? (
                              <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium bg-green-100 text-green-700 border border-green-200'>
                                Active
                              </span>
                            ) : (
                              <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center gap-2 flex-shrink-0'>
                        <button
                          type='button'
                          onClick={() => handleRunSampling(config)}
                          disabled={isRunning}
                          className='btn-enterprise-primary text-xs py-1.5 px-3'
                        >
                          {isRunning ? (
                            <>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth={2}
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                className='w-3.5 h-3.5 mr-1.5 animate-spin'
                              >
                                <path d='M21 12a9 9 0 1 1-6.219-8.56' />
                              </svg>
                              Running...
                            </>
                          ) : (
                            <>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth={2}
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                className='w-3.5 h-3.5 mr-1.5'
                              >
                                <polygon points='5 3 19 12 5 21 5 3' />
                              </svg>
                              Run Sampling
                            </>
                          )}
                        </button>

                        <button
                          type='button'
                          onClick={() => handleEditConfig(config)}
                          className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={`Edit configuration ${config.name}`}
                          title='Edit configuration'
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='w-4 h-4'
                          >
                            <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                            <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
                          </svg>
                        </button>

                        <button
                          type='button'
                          onClick={() => handleDeleteConfig(config)}
                          className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={`Delete configuration ${config.name}`}
                          title='Delete configuration'
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='w-4 h-4'
                          >
                            <polyline points='3 6 5 6 21 6' />
                            <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className='px-5 py-4 border-t border-gray-100 bg-white animate-fade-in'>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                          <div>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                              Methodology
                            </span>
                            <span className='text-sm text-gray-900'>
                              {methodologyLabel(config.methodology)}
                            </span>
                          </div>

                          <div>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                              Sample Rate
                            </span>
                            <span className='text-sm text-gray-900'>
                              {config.sampleRate ?? 0}%
                            </span>
                          </div>

                          <div>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                              Status
                            </span>
                            {config.isActive ? (
                              <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200'>
                                Active
                              </span>
                            ) : (
                              <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                                Inactive
                              </span>
                            )}
                          </div>

                          {config.filters && (
                            <>
                              {Array.isArray(config.filters.productTypes) && config.filters.productTypes.length > 0 && (
                                <div>
                                  <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                                    Product Types
                                  </span>
                                  <div className='flex flex-wrap gap-1'>
                                    {config.filters.productTypes.map((pt) => (
                                      <span
                                        key={pt}
                                        className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'
                                      >
                                        {PRODUCT_TYPE_LABELS[pt] || pt}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {Array.isArray(config.filters.channels) && config.filters.channels.length > 0 && (
                                <div>
                                  <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                                    Channels
                                  </span>
                                  <div className='flex flex-wrap gap-1'>
                                    {config.filters.channels.map((ch) => (
                                      <span
                                        key={ch}
                                        className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'
                                      >
                                        {CHANNEL_LABELS[ch] || ch}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(config.filters.minLoanAmount !== undefined && config.filters.minLoanAmount !== null) && (
                                <div>
                                  <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                                    Min Loan Amount
                                  </span>
                                  <span className='text-sm text-gray-900'>
                                    ${Number(config.filters.minLoanAmount).toLocaleString()}
                                  </span>
                                </div>
                              )}

                              {(config.filters.maxLoanAmount !== undefined && config.filters.maxLoanAmount !== null) && (
                                <div>
                                  <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                                    Max Loan Amount
                                  </span>
                                  <span className='text-sm text-gray-900'>
                                    ${Number(config.filters.maxLoanAmount).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {config.createdAt && (
                            <div>
                              <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                                Created
                              </span>
                              <span className='text-sm text-gray-500'>
                                {formatDate(config.createdAt, 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                        </div>

                        {Array.isArray(config.riskCriteria) && config.riskCriteria.length > 0 && (
                          <div className='mt-4'>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                              Risk Criteria ({config.riskCriteria.length})
                            </span>
                            <div className='space-y-2'>
                              {config.riskCriteria.map((criterion, idx) => (
                                <div
                                  key={idx}
                                  className='flex items-center gap-3 p-2 rounded-lg bg-gray-50 text-sm'
                                >
                                  <span className='text-xs text-gray-400'>#{idx + 1}</span>
                                  <span className='font-medium text-gray-700'>{criterion.field}</span>
                                  <span className='text-gray-500'>{criterion.operator}</span>
                                  <span className='font-mono text-gray-600'>{String(criterion.value)}</span>
                                  <span className='ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold bg-enterprise-100 text-enterprise-700'>
                                    Weight: {criterion.weight}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Array.isArray(config.thresholdRules) && config.thresholdRules.length > 0 && (
                          <div className='mt-4'>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                              Threshold Rules ({config.thresholdRules.length})
                            </span>
                            <div className='space-y-2'>
                              {config.thresholdRules.map((rule, idx) => (
                                <div
                                  key={idx}
                                  className='flex items-center gap-3 p-2 rounded-lg bg-gray-50 text-sm'
                                >
                                  <span className='text-xs text-gray-400'>#{idx + 1}</span>
                                  <span className='font-medium text-gray-700'>{rule.field}</span>
                                  <span className='text-gray-500'>{rule.operator}</span>
                                  <span className='font-mono text-gray-600'>{String(rule.value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {safeConfigs.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={safeConfigs.length}
          />
        )}

        <SamplingConfigForm
          config={editingConfig}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveConfig}
        />

        <SamplingRunResultModal
          result={runResult}
          isOpen={isRunResultOpen}
          onClose={handleCloseRunResult}
        />
      </div>
    </RequireRole>
  );
};

SamplingConfigPage.propTypes = {};

export default SamplingConfigPage;