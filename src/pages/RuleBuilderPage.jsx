import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useRules } from '../contexts/RulesContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatDate } from '../utils/dateUtils';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'RuleBuilderPage';

const ALLOWED_ROLES = ['admin'];

const RULE_TYPES = [
  { value: 'hard_stop', label: 'Hard Stop' },
  { value: 'weighted_score', label: 'Weighted Score' },
];

const RULE_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const RULE_TYPE_LABELS = {
  hard_stop: 'Hard Stop',
  weighted_score: 'Weighted Score',
};

const RULE_TYPE_COLORS = {
  hard_stop: 'bg-red-100 text-red-700 border-red-200',
  weighted_score: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
};

const RuleFormModal = ({ rule, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productTypes: [],
    channels: [],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [{ field: '', operator: 'gte', value: '', message: '' }],
    weight: 0,
    effectiveDate: '',
    expirationDate: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sellerMode, setSellerMode] = useState('all');

  const nameInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const isEditing = rule && rule.id;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && rule) {
        setFormData({
          name: rule.name || '',
          description: rule.description || '',
          productTypes: Array.isArray(rule.productTypes) ? [...rule.productTypes] : [],
          channels: Array.isArray(rule.channels) ? [...rule.channels] : [],
          sellerIds: Array.isArray(rule.sellerIds) ? [...rule.sellerIds] : null,
          ruleType: rule.ruleType || 'hard_stop',
          conditions: Array.isArray(rule.conditions) && rule.conditions.length > 0
            ? rule.conditions.map((c) => ({
                field: c.field || '',
                operator: c.operator || 'gte',
                value: c.value !== undefined && c.value !== null ? c.value : '',
                message: c.message || '',
              }))
            : [{ field: '', operator: 'gte', value: '', message: '' }],
          weight: rule.weight || 0,
          effectiveDate: rule.effectiveDate || '',
          expirationDate: rule.expirationDate || '',
        });
        setSellerMode(Array.isArray(rule.sellerIds) && rule.sellerIds.length > 0 ? 'specific' : 'all');
      } else {
        setFormData({
          name: '',
          description: '',
          productTypes: [],
          channels: [],
          sellerIds: null,
          ruleType: 'hard_stop',
          conditions: [{ field: '', operator: 'gte', value: '', message: '' }],
          weight: 0,
          effectiveDate: '',
          expirationDate: '',
        });
        setSellerMode('all');
      }

      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, isEditing, rule]);

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

  const handleProductTypeToggle = useCallback((productType) => {
    setFormData((prev) => {
      const current = prev.productTypes;
      if (current.includes(productType)) {
        return { ...prev, productTypes: current.filter((p) => p !== productType) };
      }
      return { ...prev, productTypes: [...current, productType] };
    });
  }, []);

  const handleChannelToggle = useCallback((channel) => {
    setFormData((prev) => {
      const current = prev.channels;
      if (current.includes(channel)) {
        return { ...prev, channels: current.filter((c) => c !== channel) };
      }
      return { ...prev, channels: [...current, channel] };
    });
  }, []);

  const handleSellerModeChange = useCallback((mode) => {
    setSellerMode(mode);
    if (mode === 'all') {
      setFormData((prev) => ({ ...prev, sellerIds: null }));
    } else {
      setFormData((prev) => ({ ...prev, sellerIds: [] }));
    }
  }, []);

  const handleConditionChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const conditions = [...prev.conditions];
      conditions[index] = { ...conditions[index], [field]: value };
      return { ...prev, conditions };
    });

    const errorKey = `conditions[${index}].${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }, [errors]);

  const handleAddCondition = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'gte', value: '', message: '' }],
    }));
  }, []);

  const handleRemoveCondition = useCallback((index) => {
    setFormData((prev) => {
      if (prev.conditions.length <= 1) {
        return prev;
      }
      const conditions = prev.conditions.filter((_, i) => i !== index);
      return { ...prev, conditions };
    });
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Rule name is required.';
    }

    if (!formData.description || formData.description.trim() === '') {
      newErrors.description = 'Description is required.';
    }

    if (formData.productTypes.length === 0) {
      newErrors.productTypes = 'At least one product type must be selected.';
    }

    if (formData.channels.length === 0) {
      newErrors.channels = 'At least one channel must be selected.';
    }

    if (!formData.effectiveDate || formData.effectiveDate.trim() === '') {
      newErrors.effectiveDate = 'Effective date is required.';
    }

    if (formData.ruleType === 'weighted_score') {
      if (formData.weight === undefined || formData.weight === null || formData.weight === '') {
        newErrors.weight = 'Weight is required for weighted score rules.';
      } else if (isNaN(formData.weight) || formData.weight < 1 || formData.weight > 100) {
        newErrors.weight = 'Weight must be between 1 and 100.';
      }
    }

    if (formData.conditions.length === 0) {
      newErrors.conditions = 'At least one condition is required.';
    } else {
      for (let i = 0; i < formData.conditions.length; i++) {
        const condition = formData.conditions[i];
        if (!condition.field || condition.field.trim() === '') {
          newErrors[`conditions[${i}].field`] = 'Field is required.';
        }
        if (condition.value === '' || condition.value === undefined || condition.value === null) {
          newErrors[`conditions[${i}].value`] = 'Value is required.';
        }
        if (!condition.message || condition.message.trim() === '') {
          newErrors[`conditions[${i}].message`] = 'Message is required.';
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
      const ruleData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        productTypes: formData.productTypes,
        channels: formData.channels,
        sellerIds: sellerMode === 'all' ? null : formData.sellerIds,
        ruleType: formData.ruleType,
        conditions: formData.conditions.map((c) => ({
          field: c.field.trim(),
          operator: c.operator,
          value: c.operator === 'in' || c.operator === 'not_in'
            ? String(c.value).split(',').map((v) => v.trim()).filter(Boolean)
            : isNaN(Number(c.value)) ? c.value : Number(c.value),
          message: c.message.trim(),
        })),
        weight: formData.ruleType === 'weighted_score' ? Number(formData.weight) : 0,
        effectiveDate: formData.effectiveDate,
        expirationDate: formData.expirationDate && formData.expirationDate.trim() !== ''
          ? formData.expirationDate
          : null,
      };

      if (isMountedRef.current) {
        onSave(ruleData);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Rule form submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, sellerMode, onSave]);

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

  const PRODUCT_TYPES = ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];
  const CHANNELS = ['retail', 'correspondent', 'broker', 'wholesale'];
  const CONDITION_FIELDS = [
    { value: 'creditScore', label: 'Credit Score' },
    { value: 'ltv', label: 'LTV' },
    { value: 'dti', label: 'DTI' },
    { value: 'loanAmount', label: 'Loan Amount' },
    { value: 'borrowerIncome', label: 'Borrower Income' },
    { value: 'productType', label: 'Product Type' },
    { value: 'channel', label: 'Channel' },
    { value: 'sellerId', label: 'Seller ID' },
    { value: 'loanPurpose', label: 'Loan Purpose' },
  ];
  const CONDITION_OPERATORS = [
    { value: 'gt', label: 'Greater Than' },
    { value: 'gte', label: 'Greater Than or Equal' },
    { value: 'lt', label: 'Less Than' },
    { value: 'lte', label: 'Less Than or Equal' },
    { value: 'eq', label: 'Equals' },
    { value: 'neq', label: 'Not Equals' },
    { value: 'in', label: 'In' },
    { value: 'not_in', label: 'Not In' },
  ];

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='rule-form-modal-title'
      aria-describedby='rule-form-modal-description'
    >
      <div className='w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-8 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10'>
          <div>
            <h2 id='rule-form-modal-title' className='text-lg font-semibold text-gray-900'>
              {isEditing ? 'Edit Rule' : 'Create Rule'}
            </h2>
            <p id='rule-form-modal-description' className='text-sm text-gray-500 mt-0.5'>
              {isEditing
                ? 'Update the eligibility rule configuration.'
                : 'Define a new eligibility rule for loan decisioning.'}
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close rule form'
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
                htmlFor='rule-form-name'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Rule Name
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                ref={nameInputRef}
                id='rule-form-name'
                type='text'
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={isSubmitting}
                placeholder='e.g., Minimum Credit Score — Conventional'
                className={`input-enterprise ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Rule name'
                aria-describedby={errors.name ? 'rule-form-name-error' : undefined}
                aria-invalid={errors.name ? 'true' : 'false'}
              />
              {errors.name && (
                <p id='rule-form-name-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                htmlFor='rule-form-type'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Rule Type
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <select
                id='rule-form-type'
                value={formData.ruleType}
                onChange={(e) => handleFieldChange('ruleType', e.target.value)}
                disabled={isSubmitting}
                className='input-enterprise'
                aria-label='Rule type'
              >
                {RULE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor='rule-form-description'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Description
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='rule-form-description'
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              disabled={isSubmitting}
              rows={2}
              placeholder='Describe what this rule checks and why...'
              className={`input-enterprise resize-none ${errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Rule description'
              aria-describedby={errors.description ? 'rule-form-description-error' : undefined}
              aria-invalid={errors.description ? 'true' : 'false'}
            />
            {errors.description && (
              <p id='rule-form-description-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                {errors.description}
              </p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1.5'>
              Product Types
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <div className='flex flex-wrap gap-2'>
              {PRODUCT_TYPES.map((productType) => {
                const isSelected = formData.productTypes.includes(productType);
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
                    aria-label={`${isSelected ? 'Remove' : 'Add'} ${productType} product type`}
                    aria-pressed={isSelected}
                  >
                    {productType.charAt(0).toUpperCase() + productType.slice(1)}
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
            {errors.productTypes && (
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
                {errors.productTypes}
              </p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1.5'>
              Channels
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <div className='flex flex-wrap gap-2'>
              {CHANNELS.map((channel) => {
                const isSelected = formData.channels.includes(channel);
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
                    aria-label={`${isSelected ? 'Remove' : 'Add'} ${channel} channel`}
                    aria-pressed={isSelected}
                  >
                    {channel.charAt(0).toUpperCase() + channel.slice(1)}
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
            {errors.channels && (
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
                {errors.channels}
              </p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1.5'>
              Seller Scope
            </label>
            <div className='flex items-center gap-4 mb-3'>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='seller-mode'
                  value='all'
                  checked={sellerMode === 'all'}
                  onChange={() => handleSellerModeChange('all')}
                  disabled={isSubmitting}
                  className='w-4 h-4 text-enterprise-600 focus:ring-enterprise-500'
                />
                <span className='text-sm text-gray-700'>All Sellers</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='seller-mode'
                  value='specific'
                  checked={sellerMode === 'specific'}
                  onChange={() => handleSellerModeChange('specific')}
                  disabled={isSubmitting}
                  className='w-4 h-4 text-enterprise-600 focus:ring-enterprise-500'
                />
                <span className='text-sm text-gray-700'>Specific Sellers</span>
              </label>
            </div>
            {sellerMode === 'specific' && (
              <input
                type='text'
                value={Array.isArray(formData.sellerIds) ? formData.sellerIds.join(', ') : ''}
                onChange={(e) => {
                  const ids = e.target.value
                    .split(',')
                    .map((id) => id.trim())
                    .filter(Boolean);
                  handleFieldChange('sellerIds', ids);
                }}
                disabled={isSubmitting}
                placeholder='e.g., SELL-0001, SELL-0002'
                className='input-enterprise'
                aria-label='Specific seller IDs (comma-separated)'
              />
            )}
          </div>

          {formData.ruleType === 'weighted_score' && (
            <div>
              <label
                htmlFor='rule-form-weight'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Weight
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                id='rule-form-weight'
                type='number'
                value={formData.weight}
                onChange={(e) => handleFieldChange('weight', e.target.value)}
                disabled={isSubmitting}
                min={1}
                max={100}
                placeholder='1–100'
                className={`input-enterprise w-32 ${errors.weight ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Rule weight'
                aria-describedby={errors.weight ? 'rule-form-weight-error' : undefined}
                aria-invalid={errors.weight ? 'true' : 'false'}
              />
              {errors.weight && (
                <p id='rule-form-weight-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                  {errors.weight}
                </p>
              )}
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='rule-form-effective-date'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Effective Date
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                id='rule-form-effective-date'
                type='date'
                value={formData.effectiveDate}
                onChange={(e) => handleFieldChange('effectiveDate', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.effectiveDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Effective date'
                aria-describedby={errors.effectiveDate ? 'rule-form-effective-date-error' : undefined}
                aria-invalid={errors.effectiveDate ? 'true' : 'false'}
              />
              {errors.effectiveDate && (
                <p id='rule-form-effective-date-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                  {errors.effectiveDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='rule-form-expiration-date'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Expiration Date
              </label>
              <input
                id='rule-form-expiration-date'
                type='date'
                value={formData.expirationDate}
                onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                disabled={isSubmitting}
                className='input-enterprise'
                aria-label='Expiration date (optional)'
              />
              <p className='text-xs text-gray-400 mt-1'>Leave blank for no expiration.</p>
            </div>
          </div>

          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='block text-sm font-medium text-gray-700'>
                Conditions
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <button
                type='button'
                onClick={handleAddCondition}
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
                Add Condition
              </button>
            </div>

            {errors.conditions && typeof errors.conditions === 'string' && (
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
                {errors.conditions}
              </p>
            )}

            <div className='space-y-3'>
              {formData.conditions.map((condition, index) => (
                <div
                  key={index}
                  className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                >
                  <div className='flex items-center justify-between mb-3'>
                    <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                      Condition {index + 1}
                    </span>
                    {formData.conditions.length > 1 && (
                      <button
                        type='button'
                        onClick={() => handleRemoveCondition(index)}
                        disabled={isSubmitting}
                        className='p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                        aria-label={`Remove condition ${index + 1}`}
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
                    )}
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div>
                      <label
                        htmlFor={`condition-field-${index}`}
                        className='block text-xs font-medium text-gray-600 mb-1'
                      >
                        Field
                      </label>
                      <select
                        id={`condition-field-${index}`}
                        value={condition.field}
                        onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                        disabled={isSubmitting}
                        className={`input-enterprise py-1.5 text-sm ${errors[`conditions[${index}].field`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        aria-label={`Condition ${index + 1} field`}
                      >
                        <option value=''>Select field...</option>
                        {CONDITION_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      {errors[`conditions[${index}].field`] && (
                        <p className='text-xs text-red-600 mt-1'>{errors[`conditions[${index}].field`]}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`condition-operator-${index}`}
                        className='block text-xs font-medium text-gray-600 mb-1'
                      >
                        Operator
                      </label>
                      <select
                        id={`condition-operator-${index}`}
                        value={condition.operator}
                        onChange={(e) => handleConditionChange(index, 'operator', e.target.value)}
                        disabled={isSubmitting}
                        className='input-enterprise py-1.5 text-sm'
                        aria-label={`Condition ${index + 1} operator`}
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
                        htmlFor={`condition-value-${index}`}
                        className='block text-xs font-medium text-gray-600 mb-1'
                      >
                        Value
                      </label>
                      <input
                        id={`condition-value-${index}`}
                        type='text'
                        value={condition.value}
                        onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                        disabled={isSubmitting}
                        placeholder={
                          condition.operator === 'in' || condition.operator === 'not_in'
                            ? 'value1, value2, ...'
                            : 'e.g., 620'
                        }
                        className={`input-enterprise py-1.5 text-sm ${errors[`conditions[${index}].value`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        aria-label={`Condition ${index + 1} value`}
                      />
                      {errors[`conditions[${index}].value`] && (
                        <p className='text-xs text-red-600 mt-1'>{errors[`conditions[${index}].value`]}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`condition-message-${index}`}
                        className='block text-xs font-medium text-gray-600 mb-1'
                      >
                        Message
                      </label>
                      <input
                        id={`condition-message-${index}`}
                        type='text'
                        value={condition.message}
                        onChange={(e) => handleConditionChange(index, 'message', e.target.value)}
                        disabled={isSubmitting}
                        placeholder='e.g., Credit score {actual} is below minimum'
                        className={`input-enterprise py-1.5 text-sm ${errors[`conditions[${index}].message`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        aria-label={`Condition ${index + 1} message`}
                      />
                      {errors[`conditions[${index}].message`] && (
                        <p className='text-xs text-red-600 mt-1'>{errors[`conditions[${index}].message`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                {isEditing ? 'Save Changes' : 'Create Rule'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

RuleFormModal.propTypes = {
  rule: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

RuleFormModal.defaultProps = {
  rule: null,
};

const VersionHistoryModal = ({ ruleId, isOpen, onClose }) => {
  const { getRuleVersions } = useRules();

  const versions = useMemo(() => {
    if (!ruleId || !isOpen) {
      return [];
    }
    return getRuleVersions(ruleId);
  }, [ruleId, isOpen, getRuleVersions]);

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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='version-history-modal-title'
    >
      <div className='w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='version-history-modal-title' className='text-lg font-semibold text-gray-900'>
              Version History
            </h2>
            <p className='text-sm text-gray-500 mt-0.5'>
              View all versions of rule {ruleId}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
            aria-label='Close version history'
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

        <div className='px-6 py-4 max-h-96 overflow-y-auto'>
          {versions.length === 0 ? (
            <div className='text-center py-8'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-10 h-10 text-gray-300 mx-auto mb-3'
              >
                <circle cx='12' cy='12' r='10' />
                <line x1='12' y1='16' x2='12' y2='12' />
                <line x1='12' y1='8' x2='12.01' y2='8' />
              </svg>
              <p className='text-sm text-gray-500'>No version history available.</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {versions.map((version, idx) => (
                <div
                  key={version.id || idx}
                  className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                >
                  <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      <span className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-enterprise-100 text-enterprise-700 text-xs font-bold'>
                        v{version.version}
                      </span>
                      <span className='text-sm font-semibold text-gray-900'>
                        Version {version.version}
                      </span>
                    </div>
                    <span className='text-xs text-gray-400'>
                      {formatDate(version.changedAt, 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <div className='grid grid-cols-2 gap-2 text-sm'>
                    <div>
                      <span className='text-xs text-gray-500'>Changed By</span>
                      <p className='text-gray-700'>{version.changedBy || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className='text-xs text-gray-500'>Reason</span>
                      <p className='text-gray-700'>{version.changeReason || '—'}</p>
                    </div>
                  </div>
                  {version.snapshot && (
                    <div className='mt-2'>
                      <span className='text-xs text-gray-500'>Snapshot</span>
                      <pre className='mt-1 p-2 bg-gray-900 text-green-400 text-xs font-mono rounded-lg overflow-x-auto max-h-32 overflow-y-auto'>
                        {JSON.stringify(
                          {
                            name: version.snapshot.name,
                            ruleType: version.snapshot.ruleType,
                            status: version.snapshot.status,
                            conditions: version.snapshot.conditions,
                            weight: version.snapshot.weight,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl'>
          <button
            type='button'
            onClick={onClose}
            className='btn-enterprise-secondary'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

VersionHistoryModal.propTypes = {
  ruleId: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

VersionHistoryModal.defaultProps = {
  ruleId: null,
};

const RuleBuilderPage = () => {
  const navigate = useNavigate();
  const { rules, addRule, updateRule, archiveRule } = useRules();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [filters, setFilters] = useState({
    status: '',
    ruleType: '',
    search: '',
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(null);

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeRules = useMemo(() => {
    if (!Array.isArray(rules)) {
      return [];
    }
    return rules;
  }, [rules]);

  const filteredRules = useMemo(() => {
    let filtered = [...safeRules];

    if (filters.status && typeof filters.status === 'string') {
      filtered = filtered.filter((rule) => rule && rule.status === filters.status);
    }

    if (filters.ruleType && typeof filters.ruleType === 'string') {
      filtered = filtered.filter((rule) => rule && rule.ruleType === filters.ruleType);
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((rule) => {
        if (!rule) return false;
        return (
          (rule.name && rule.name.toLowerCase().includes(searchLower)) ||
          (rule.id && rule.id.toLowerCase().includes(searchLower)) ||
          (rule.description && rule.description.toLowerCase().includes(searchLower))
        );
      });
    }

    filtered.sort((a, b) => {
      const aDate = a ? new Date(a.updatedAt) : new Date(0);
      const bDate = b ? new Date(b.updatedAt) : new Date(0);
      return bDate - aDate;
    });

    return filtered;
  }, [safeRules, filters]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredRules, { initialPageSize: 25 });

  const handleFilterChange = useCallback(
    (field, value) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
      setPage(1);
    },
    [setPage],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      status: '',
      ruleType: '',
      search: '',
    });
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleCreateRule = useCallback(() => {
    setEditingRule(null);
    setIsFormOpen(true);
  }, []);

  const handleEditRule = useCallback((rule) => {
    if (!rule) return;
    setEditingRule(rule);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingRule(null);
  }, []);

  const handleSaveRule = useCallback(
    (ruleData) => {
      if (!ruleData || typeof ruleData !== 'object') {
        return;
      }

      try {
        if (editingRule && editingRule.id) {
          const result = updateRule(editingRule.id, {
            ...ruleData,
            changedBy: currentPersona?.label || 'Unknown',
            changeReason: 'Rule updated via Rule Builder',
          });

          if (result.success) {
            logEvent(
              'RULE_UPDATE',
              'rule',
              editingRule.id,
              {
                ruleName: ruleData.name,
                ruleType: ruleData.ruleType,
              },
              currentPersona?.label || 'Unknown',
            );

            addNotification(
              'success',
              'Rule Updated',
              `Rule "${ruleData.name}" has been updated successfully.`,
            );

            handleCloseForm();
          } else {
            addNotification(
              'error',
              'Update Failed',
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : 'Failed to update rule. Please try again.',
            );
          }
        } else {
          const result = addRule({
            ...ruleData,
            createdBy: currentPersona?.label || 'Unknown',
          });

          if (result.success) {
            logEvent(
              'RULE_CREATE',
              'rule',
              result.rule.id,
              {
                ruleName: ruleData.name,
                ruleType: ruleData.ruleType,
              },
              currentPersona?.label || 'Unknown',
            );

            addNotification(
              'success',
              'Rule Created',
              `Rule "${ruleData.name}" has been created successfully.`,
            );

            handleCloseForm();
          } else {
            addNotification(
              'error',
              'Creation Failed',
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : 'Failed to create rule. Please try again.',
            );
          }
        }
      } catch (err) {
        warn(COMPONENT_NAME, 'Failed to save rule', err);
        addNotification(
          'error',
          'Error',
          'An unexpected error occurred while saving the rule.',
        );
      }
    },
    [editingRule, updateRule, addRule, logEvent, addNotification, currentPersona, handleCloseForm],
  );

  const handleArchiveRule = useCallback(
    (rule) => {
      if (!rule || !rule.id) return;

      if (rule.status === 'archived') {
        addNotification(
          'info',
          'Already Archived',
          `Rule "${rule.name}" is already archived.`,
        );
        return;
      }

      const success = archiveRule(rule.id);

      if (success) {
        logEvent(
          'RULE_ARCHIVE',
          'rule',
          rule.id,
          {
            ruleName: rule.name,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Rule Archived',
          `Rule "${rule.name}" has been archived.`,
        );
      } else {
        addNotification(
          'error',
          'Archive Failed',
          'Failed to archive rule. Please try again.',
        );
      }
    },
    [archiveRule, logEvent, addNotification, currentPersona],
  );

  const handleViewHistory = useCallback((rule) => {
    if (!rule || !rule.id) return;
    setSelectedRuleId(rule.id);
    setIsVersionHistoryOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setIsVersionHistoryOpen(false);
    setSelectedRuleId(null);
  }, []);

  const hasActiveFilters = filters.status || filters.ruleType || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Rules', path: '/rules' },
  ];

  const exportData = useMemo(() => {
    return filteredRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      status: rule.status,
      version: rule.version,
      effectiveDate: rule.effectiveDate,
      expirationDate: rule.expirationDate,
      productTypes: Array.isArray(rule.productTypes) ? rule.productTypes.join(', ') : '',
      channels: Array.isArray(rule.channels) ? rule.channels.join(', ') : '',
      weight: rule.weight,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));
  }, [filteredRules]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Eligibility Rules</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Configure and manage eligibility rules for loan decisioning.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='eligibility-rules'
              variant='secondary'
              label='Export'
            />

            <button
              type='button'
              onClick={handleCreateRule}
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
              Create Rule
            </button>
          </div>
        </div>

        <div className='card-enterprise'>
          <div className='flex flex-col lg:flex-row lg:items-center gap-4 mb-6'>
            <div className='flex-1'>
              <div className='relative'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400'
                >
                  <circle cx='11' cy='11' r='8' />
                  <line x1='21' y1='21' x2='16.65' y2='16.65' />
                </svg>
                <input
                  ref={searchInputRef}
                  type='text'
                  placeholder='Search by rule name, ID, or description...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search rules'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='rule-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='rule-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by rule status'
                >
                  <option value=''>All Statuses</option>
                  {RULE_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='rule-filter-type'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Type
                </label>
                <select
                  id='rule-filter-type'
                  value={filters.ruleType}
                  onChange={(e) => handleFilterChange('ruleType', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by rule type'
                >
                  <option value=''>All Types</option>
                  {RULE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type='button'
                  onClick={handleClearFilters}
                  className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                  aria-label='Clear all filters'
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
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className='flex items-center justify-between mb-4'>
            <p className='text-sm text-gray-500'>
              {filteredRules.length === 0
                ? 'No rules found'
                : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} rules`}
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
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                  <polyline points='10 9 9 9 8 9' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Rules Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No rules match your current filters. Try adjusting or clearing your filters.'
                  : 'No eligibility rules have been created yet. Click "Create Rule" to get started.'}
              </p>
              {hasActiveFilters && (
                <button
                  type='button'
                  onClick={handleClearFilters}
                  className='btn-enterprise-secondary mt-4'
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='table-enterprise'>
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Type</th>
                    <th>Product Types</th>
                    <th>Effective Date</th>
                    <th>Status</th>
                    <th>Version</th>
                    <th className='w-32'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((rule) => {
                    if (!rule) return null;

                    const typeColor = RULE_TYPE_COLORS[rule.ruleType] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const typeLabel = RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType || 'Unknown';
                    const statusColor = STATUS_COLORS[rule.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel = rule.status === 'active' ? 'Active' : 'Archived';
                    const isArchived = rule.status === 'archived';

                    return (
                      <tr key={rule.id}>
                        <td>
                          <div className='flex flex-col'>
                            <span className='text-sm font-medium text-gray-900'>
                              {rule.name || 'Unnamed Rule'}
                            </span>
                            <span className='text-xs text-gray-400 font-mono'>{rule.id}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${typeColor}`}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td>
                          <div className='flex flex-wrap gap-1'>
                            {Array.isArray(rule.productTypes) && rule.productTypes.length > 0
                              ? rule.productTypes.map((pt) => (
                                  <span
                                    key={pt}
                                    className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'
                                  >
                                    {pt}
                                  </span>
                                ))
                              : (
                                <span className='text-xs text-gray-400'>All</span>
                              )}
                          </div>
                        </td>
                        <td>
                          <span className='text-sm text-gray-600'>
                            {rule.effectiveDate
                              ? formatDate(rule.effectiveDate, 'MMM d, yyyy')
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <span className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-enterprise-100 text-enterprise-700 text-xs font-bold'>
                            v{rule.version || 1}
                          </span>
                        </td>
                        <td>
                          <div className='flex items-center gap-1'>
                            {!isArchived && (
                              <button
                                type='button'
                                onClick={() => handleEditRule(rule)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`Edit rule ${rule.name}`}
                                title='Edit rule'
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
                            )}

                            <button
                              type='button'
                              onClick={() => handleViewHistory(rule)}
                              className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                              aria-label={`View version history for ${rule.name}`}
                              title='View version history'
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
                                <circle cx='12' cy='12' r='10' />
                                <polyline points='12 6 12 12 16 14' />
                              </svg>
                            </button>

                            {!isArchived && (
                              <button
                                type='button'
                                onClick={() => handleArchiveRule(rule)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`Archive rule ${rule.name}`}
                                title='Archive rule'
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
                                  <polyline points='21 8 21 21 3 21 3 8' />
                                  <rect x='1' y='3' width='22' height='5' />
                                  <line x1='10' y1='12' x2='14' y2='12' />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredRules.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={filteredRules.length}
          />
        )}

        <RuleFormModal
          rule={editingRule}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveRule}
        />

        <VersionHistoryModal
          ruleId={selectedRuleId}
          isOpen={isVersionHistoryOpen}
          onClose={handleCloseHistory}
        />
      </div>
    </RequireRole>
  );
};

RuleBuilderPage.propTypes = {};

export default RuleBuilderPage;