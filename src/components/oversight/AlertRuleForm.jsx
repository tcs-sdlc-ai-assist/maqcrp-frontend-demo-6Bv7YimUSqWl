import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useMockData } from '../../contexts/MockDataContext';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'AlertRuleForm';

const VALID_METRICS = [
  { value: 'overallDefectRate', label: 'Overall Defect Rate' },
  { value: 'remedyResponseTime', label: 'Remedy Response Time' },
  { value: 'repurchaseExposure', label: 'Repurchase Exposure' },
  { value: 'slaBreachCount', label: 'SLA Breach Count' },
  { value: 'highSeverityDefectRate', label: 'High Severity Defect Rate' },
];

const VALID_OPERATORS = [
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lte', label: 'Less Than or Equal' },
];

const VALID_SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const METRIC_LABELS = VALID_METRICS.reduce((map, m) => {
  map[m.value] = m.label;
  return map;
}, {});

const OPERATOR_LABELS = VALID_OPERATORS.reduce((map, op) => {
  map[op.value] = op.label;
  return map;
}, {});

const SEVERITY_LABELS = VALID_SEVERITIES.reduce((map, s) => {
  map[s.value] = s.label;
  return map;
}, {});

const SEVERITY_COLORS = {
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const AlertRuleForm = ({ rule, onSave, onCancel }) => {
  const { sellers } = useMockData();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metric: 'overallDefectRate',
    operator: 'gt',
    value: '',
    severity: 'warning',
    enabled: true,
    counterpartyIds: [],
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scopeMode, setScopeMode] = useState('all');
  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [isCounterpartyDropdownOpen, setIsCounterpartyDropdownOpen] = useState(false);

  const nameInputRef = useRef(null);
  const counterpartyDropdownRef = useRef(null);
  const counterpartyInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const isEditing = rule && rule.id;

  const safeSellers = Array.isArray(sellers) ? sellers : [];

  const filteredCounterparties = safeSellers.filter((seller) => {
    if (!seller) return false;
    if (!counterpartySearch || counterpartySearch.trim() === '') return true;
    const searchLower = counterpartySearch.toLowerCase();
    return (
      (seller.id && seller.id.toLowerCase().includes(searchLower)) ||
      (seller.name && seller.name.toLowerCase().includes(searchLower))
    );
  });

  const selectedCounterparties = safeSellers.filter(
    (seller) => seller && formData.counterpartyIds.includes(seller.id),
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (rule && rule.id) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        metric: rule.metric || 'overallDefectRate',
        operator: rule.operator || 'gt',
        value: rule.value !== undefined && rule.value !== null ? String(rule.value) : '',
        severity: rule.severity || 'warning',
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        counterpartyIds: Array.isArray(rule.counterpartyIds) ? [...rule.counterpartyIds] : [],
      });
      setScopeMode(
        Array.isArray(rule.counterpartyIds) && rule.counterpartyIds.length > 0
          ? 'specific'
          : 'all',
      );
    } else {
      setFormData({
        name: '',
        description: '',
        metric: 'overallDefectRate',
        operator: 'gt',
        value: '',
        severity: 'warning',
        enabled: true,
        counterpartyIds: [],
      });
      setScopeMode('all');
    }

    setErrors({});
    setIsSubmitting(false);
    setCounterpartySearch('');
    setIsCounterpartyDropdownOpen(false);

    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 100);
  }, [rule]);

  const handleFieldChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const handleScopeModeChange = useCallback((mode) => {
    setScopeMode(mode);
    if (mode === 'all') {
      setFormData((prev) => ({ ...prev, counterpartyIds: [] }));
      setCounterpartySearch('');
      setIsCounterpartyDropdownOpen(false);
    }
  }, []);

  const handleAddCounterparty = useCallback(
    (sellerId) => {
      if (!sellerId) return;

      setFormData((prev) => {
        if (prev.counterpartyIds.includes(sellerId)) {
          return prev;
        }
        return {
          ...prev,
          counterpartyIds: [...prev.counterpartyIds, sellerId],
        };
      });

      setCounterpartySearch('');
      setIsCounterpartyDropdownOpen(false);

      if (errors.counterpartyIds) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.counterpartyIds;
          return next;
        });
      }
    },
    [errors.counterpartyIds],
  );

  const handleRemoveCounterparty = useCallback((sellerId) => {
    setFormData((prev) => ({
      ...prev,
      counterpartyIds: prev.counterpartyIds.filter((id) => id !== sellerId),
    }));
  }, []);

  const handleCounterpartySearchChange = useCallback((e) => {
    setCounterpartySearch(e.target.value);
    setIsCounterpartyDropdownOpen(true);
  }, []);

  const handleCounterpartyInputFocus = useCallback(() => {
    setIsCounterpartyDropdownOpen(true);
  }, []);

  const handleClickOutside = useCallback((event) => {
    if (
      counterpartyDropdownRef.current &&
      !counterpartyDropdownRef.current.contains(event.target) &&
      counterpartyInputRef.current &&
      !counterpartyInputRef.current.contains(event.target)
    ) {
      setIsCounterpartyDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Rule name is required.';
    }

    if (!formData.metric || !VALID_METRICS.find((m) => m.value === formData.metric)) {
      newErrors.metric = 'Please select a valid metric.';
    }

    if (!formData.operator || !VALID_OPERATORS.find((op) => op.value === formData.operator)) {
      newErrors.operator = 'Please select a valid condition.';
    }

    if (formData.value === '' || formData.value === undefined || formData.value === null) {
      newErrors.value = 'Threshold value is required.';
    } else {
      const numValue = Number(formData.value);
      if (isNaN(numValue)) {
        newErrors.value = 'Threshold value must be a number.';
      }
    }

    if (!formData.severity || !VALID_SEVERITIES.find((s) => s.value === formData.severity)) {
      newErrors.severity = 'Please select a valid severity.';
    }

    if (scopeMode === 'specific' && formData.counterpartyIds.length === 0) {
      newErrors.counterpartyIds = 'Please select at least one counterparty.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, scopeMode]);

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
        metric: formData.metric,
        operator: formData.operator,
        value: Number(formData.value),
        severity: formData.severity,
        enabled: formData.enabled,
        counterpartyIds: scopeMode === 'specific' ? formData.counterpartyIds : null,
      };

      if (isMountedRef.current) {
        onSave(ruleData);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Alert rule form submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, scopeMode, onSave]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    },
    [isSubmitting, onCancel],
  );

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onCancel();
      }
    },
    [isSubmitting, onCancel],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const metricLabel = METRIC_LABELS[formData.metric] || formData.metric;
  const operatorLabel = OPERATOR_LABELS[formData.operator] || formData.operator;
  const severityLabel = SEVERITY_LABELS[formData.severity] || formData.severity;

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='alert-rule-form-title'
      aria-describedby='alert-rule-form-description'
    >
      <div className='w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-8 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10'>
          <div>
            <h2 id='alert-rule-form-title' className='text-lg font-semibold text-gray-900'>
              {isEditing ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h2>
            <p id='alert-rule-form-description' className='text-sm text-gray-500 mt-0.5'>
              {isEditing
                ? 'Update the alert rule configuration.'
                : 'Define a new alert rule for counterparty monitoring.'}
            </p>
          </div>

          <button
            type='button'
            onClick={onCancel}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close alert rule form'
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
          <div>
            <label
              htmlFor='alert-rule-form-name'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Rule Name
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <input
              ref={nameInputRef}
              id='alert-rule-form-name'
              type='text'
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              disabled={isSubmitting}
              placeholder='e.g., High Defect Rate Alert'
              className={`input-enterprise ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Alert rule name'
              aria-describedby={errors.name ? 'alert-rule-form-name-error' : undefined}
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            {errors.name && (
              <p
                id='alert-rule-form-name-error'
                className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
              >
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
              htmlFor='alert-rule-form-description'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Description
            </label>
            <textarea
              id='alert-rule-form-description'
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              disabled={isSubmitting}
              rows={2}
              placeholder='Describe what this alert rule monitors...'
              className='input-enterprise resize-none'
              aria-label='Alert rule description'
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div>
              <label
                htmlFor='alert-rule-form-metric'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Metric
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <select
                id='alert-rule-form-metric'
                value={formData.metric}
                onChange={(e) => handleFieldChange('metric', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.metric ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Alert metric'
                aria-describedby={errors.metric ? 'alert-rule-form-metric-error' : undefined}
                aria-invalid={errors.metric ? 'true' : 'false'}
              >
                {VALID_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.metric && (
                <p
                  id='alert-rule-form-metric-error'
                  className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
                >
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
                  {errors.metric}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='alert-rule-form-operator'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Condition
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <select
                id='alert-rule-form-operator'
                value={formData.operator}
                onChange={(e) => handleFieldChange('operator', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.operator ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Alert condition operator'
                aria-describedby={errors.operator ? 'alert-rule-form-operator-error' : undefined}
                aria-invalid={errors.operator ? 'true' : 'false'}
              >
                {VALID_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              {errors.operator && (
                <p
                  id='alert-rule-form-operator-error'
                  className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
                >
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
                  {errors.operator}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='alert-rule-form-value'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Threshold
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                id='alert-rule-form-value'
                type='text'
                value={formData.value}
                onChange={(e) => handleFieldChange('value', e.target.value)}
                disabled={isSubmitting}
                placeholder='e.g., 0.05'
                className={`input-enterprise ${errors.value ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Threshold value'
                aria-describedby={errors.value ? 'alert-rule-form-value-error' : undefined}
                aria-invalid={errors.value ? 'true' : 'false'}
              />
              {errors.value && (
                <p
                  id='alert-rule-form-value-error'
                  className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
                >
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
                  {errors.value}
                </p>
              )}
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='alert-rule-form-severity'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Severity
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <select
                id='alert-rule-form-severity'
                value={formData.severity}
                onChange={(e) => handleFieldChange('severity', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.severity ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Alert severity'
                aria-describedby={errors.severity ? 'alert-rule-form-severity-error' : undefined}
                aria-invalid={errors.severity ? 'true' : 'false'}
              >
                {VALID_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.severity && (
                <p
                  id='alert-rule-form-severity-error'
                  className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
                >
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
                  {errors.severity}
                </p>
              )}
            </div>

            <div className='flex items-center'>
              <label className='flex items-center gap-2 cursor-pointer mt-6'>
                <input
                  type='checkbox'
                  checked={formData.enabled}
                  onChange={(e) => handleFieldChange('enabled', e.target.checked)}
                  disabled={isSubmitting}
                  className='w-4 h-4 rounded border-gray-300 text-enterprise-600 focus:ring-enterprise-500'
                />
                <span className='text-sm text-gray-700'>Enabled</span>
              </label>
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1.5'>
              Counterparty Scope
            </label>
            <div className='flex items-center gap-4 mb-3'>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='scope-mode'
                  value='all'
                  checked={scopeMode === 'all'}
                  onChange={() => handleScopeModeChange('all')}
                  disabled={isSubmitting}
                  className='w-4 h-4 text-enterprise-600 focus:ring-enterprise-500'
                />
                <span className='text-sm text-gray-700'>All Counterparties</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='scope-mode'
                  value='specific'
                  checked={scopeMode === 'specific'}
                  onChange={() => handleScopeModeChange('specific')}
                  disabled={isSubmitting}
                  className='w-4 h-4 text-enterprise-600 focus:ring-enterprise-500'
                />
                <span className='text-sm text-gray-700'>Specific Counterparties</span>
              </label>
            </div>

            {scopeMode === 'specific' && (
              <div>
                <div className='relative'>
                  <input
                    ref={counterpartyInputRef}
                    type='text'
                    value={counterpartySearch}
                    onChange={handleCounterpartySearchChange}
                    onFocus={handleCounterpartyInputFocus}
                    disabled={isSubmitting}
                    placeholder='Search counterparties by name or ID...'
                    className={`input-enterprise ${errors.counterpartyIds ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    aria-label='Search counterparties'
                    aria-describedby={
                      errors.counterpartyIds
                        ? 'alert-rule-form-counterparty-ids-error'
                        : undefined
                    }
                    aria-invalid={errors.counterpartyIds ? 'true' : 'false'}
                  />

                  {isCounterpartyDropdownOpen && filteredCounterparties.length > 0 && (
                    <div
                      ref={counterpartyDropdownRef}
                      className='absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-48 overflow-y-auto animate-scale-in'
                    >
                      {filteredCounterparties.map((seller) => {
                        if (!seller) return null;

                        const isAlreadySelected = formData.counterpartyIds.includes(
                          seller.id,
                        );

                        return (
                          <button
                            key={seller.id}
                            type='button'
                            onClick={() => handleAddCounterparty(seller.id)}
                            disabled={isAlreadySelected || isSubmitting}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-150 ${
                              isAlreadySelected
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-enterprise-50 hover:text-enterprise-700'
                            }`}
                          >
                            <div className='flex-1 min-w-0'>
                              <span className='font-medium block truncate'>
                                {seller.name || seller.id}
                              </span>
                              <span className='text-xs text-gray-400 font-mono'>
                                {seller.id}
                              </span>
                            </div>
                            {isAlreadySelected && (
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth={2}
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                className='w-4 h-4 text-green-500 flex-shrink-0'
                              >
                                <polyline points='20 6 9 17 4 12' />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isCounterpartyDropdownOpen &&
                    counterpartySearch &&
                    filteredCounterparties.length === 0 && (
                      <div className='absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-4 text-center animate-scale-in'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={1.5}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='w-6 h-6 text-gray-300 mx-auto mb-1'
                        >
                          <circle cx='11' cy='11' r='8' />
                          <line x1='21' y1='21' x2='16.65' y2='16.65' />
                        </svg>
                        <p className='text-xs text-gray-500'>
                          No counterparties found matching &ldquo;{counterpartySearch}&rdquo;
                        </p>
                      </div>
                    )}
                </div>

                {errors.counterpartyIds && (
                  <p
                    id='alert-rule-form-counterparty-ids-error'
                    className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
                  >
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
                    {errors.counterpartyIds}
                  </p>
                )}

                {selectedCounterparties.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {selectedCounterparties.map((seller) => {
                      if (!seller) return null;

                      return (
                        <span
                          key={seller.id}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-enterprise-50 text-enterprise-700 border border-enterprise-200 text-sm font-medium'
                        >
                          <span className='max-w-[200px] truncate'>
                            {seller.name || seller.id}
                          </span>
                          <button
                            type='button'
                            onClick={() => handleRemoveCounterparty(seller.id)}
                            disabled={isSubmitting}
                            className='flex-shrink-0 p-0.5 rounded text-enterprise-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                            aria-label={`Remove ${seller.name || seller.id}`}
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
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {formData.metric && formData.operator && formData.value !== '' && (
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
                  <p className='text-sm font-semibold text-blue-800'>Rule Summary</p>
                  <p className='text-xs text-blue-700 mt-1'>
                    Alert when{' '}
                    <span className='font-semibold'>{metricLabel}</span>{' '}
                    <span className='font-semibold'>
                      {operatorLabel.toLowerCase()}
                    </span>{' '}
                    <span className='font-semibold'>{formData.value}</span> with{' '}
                    <span className='font-semibold'>{severityLabel}</span> severity.
                    {scopeMode === 'all'
                      ? ' Applies to all counterparties.'
                      : ` Applies to ${formData.counterpartyIds.length} counterparty(s).`}
                  </p>
                </div>
              </div>
            </div>
          )}

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
            onClick={onCancel}
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

AlertRuleForm.propTypes = {
  rule: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    metric: PropTypes.string,
    operator: PropTypes.string,
    value: PropTypes.number,
    severity: PropTypes.string,
    enabled: PropTypes.bool,
    counterpartyIds: PropTypes.arrayOf(PropTypes.string),
    createdBy: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

AlertRuleForm.defaultProps = {
  rule: null,
};

export default AlertRuleForm;