import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useOversight } from '../contexts/OversightContext';
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

const COMPONENT_NAME = 'AlertConfigurationPanel';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const VALID_METRICS = [
  { value: 'defectRate', label: 'Defect Rate' },
  { value: 'criticalDefectRate', label: 'Critical Defect Rate' },
  { value: 'avgRemedyResponseDays', label: 'Avg Remedy Response Days' },
  { value: 'totalExposure', label: 'Total Exposure' },
  { value: 'slaBreachRate', label: 'SLA Breach Rate' },
  { value: 'passRate', label: 'Pass Rate' },
  { value: 'openRemedyCases', label: 'Open Remedy Cases' },
  { value: 'openRepurchaseCases', label: 'Open Repurchase Cases' },
];

const VALID_OPERATORS = [
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
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

const METRIC_COLORS = {
  defectRate: 'bg-red-100 text-red-700 border-red-200',
  criticalDefectRate: 'bg-red-100 text-red-700 border-red-200',
  avgRemedyResponseDays: 'bg-amber-100 text-amber-700 border-amber-200',
  totalExposure: 'bg-blue-100 text-blue-700 border-blue-200',
  slaBreachRate: 'bg-purple-100 text-purple-700 border-purple-200',
  passRate: 'bg-green-100 text-green-700 border-green-200',
  openRemedyCases: 'bg-teal-100 text-teal-700 border-teal-200',
  openRepurchaseCases: 'bg-teal-100 text-teal-700 border-teal-200',
};

const AlertRuleFormModal = ({ rule, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metric: 'defectRate',
    operator: 'gt',
    value: '',
    severity: 'warning',
    enabled: true,
    counterpartyIds: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scopeMode, setScopeMode] = useState('all');

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
          metric: rule.metric || 'defectRate',
          operator: rule.operator || 'gt',
          value: rule.value !== undefined && rule.value !== null ? String(rule.value) : '',
          severity: rule.severity || 'warning',
          enabled: rule.enabled !== undefined ? rule.enabled : true,
          counterpartyIds: Array.isArray(rule.counterpartyIds)
            ? rule.counterpartyIds.join(', ')
            : '',
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
          metric: 'defectRate',
          operator: 'gt',
          value: '',
          severity: 'warning',
          enabled: true,
          counterpartyIds: '',
        });
        setScopeMode('all');
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
      setFormData((prev) => ({ ...prev, counterpartyIds: '' }));
    }
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Rule name is required.';
    }

    if (!formData.metric || !VALID_METRICS.find((m) => m.value === formData.metric)) {
      newErrors.metric = 'Please select a valid metric.';
    }

    if (!formData.operator || !VALID_OPERATORS.find((op) => op.value === formData.operator)) {
      newErrors.operator = 'Please select a valid operator.';
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

    if (scopeMode === 'specific') {
      if (!formData.counterpartyIds || formData.counterpartyIds.trim() === '') {
        newErrors.counterpartyIds = 'Please enter at least one counterparty ID.';
      }
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
      const counterpartyIds =
        scopeMode === 'specific' && formData.counterpartyIds.trim() !== ''
          ? formData.counterpartyIds
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
          : null;

      const ruleData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        metric: formData.metric,
        operator: formData.operator,
        value: Number(formData.value),
        severity: formData.severity,
        enabled: formData.enabled,
        counterpartyIds,
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

  const metricLabel = METRIC_LABELS[formData.metric] || formData.metric;
  const operatorLabel = OPERATOR_LABELS[formData.operator] || formData.operator;
  const severityLabel = SEVERITY_LABELS[formData.severity] || formData.severity;

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='alert-rule-form-modal-title'
      aria-describedby='alert-rule-form-modal-description'
    >
      <div className='w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-8 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10'>
          <div>
            <h2 id='alert-rule-form-modal-title' className='text-lg font-semibold text-gray-900'>
              {isEditing ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h2>
            <p id='alert-rule-form-modal-description' className='text-sm text-gray-500 mt-0.5'>
              {isEditing
                ? 'Update the alert rule configuration.'
                : 'Define a new alert rule for counterparty monitoring.'}
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
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
                <input
                  type='text'
                  value={formData.counterpartyIds}
                  onChange={(e) => handleFieldChange('counterpartyIds', e.target.value)}
                  disabled={isSubmitting}
                  placeholder='e.g., SELL-0001, SELL-0002'
                  className={`input-enterprise ${errors.counterpartyIds ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  aria-label='Specific counterparty IDs (comma-separated)'
                  aria-describedby={
                    errors.counterpartyIds ? 'alert-rule-form-counterparty-ids-error' : undefined
                  }
                  aria-invalid={errors.counterpartyIds ? 'true' : 'false'}
                />
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
                    <span className='font-semibold'>{operatorLabel.toLowerCase()}</span>{' '}
                    <span className='font-semibold'>{formData.value}</span> with{' '}
                    <span className='font-semibold'>{severityLabel}</span> severity.
                    {scopeMode === 'all'
                      ? ' Applies to all counterparties.'
                      : ' Applies to specified counterparties only.'}
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

AlertRuleFormModal.propTypes = {
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
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

AlertRuleFormModal.defaultProps = {
  rule: null,
};

const AlertConfigurationPanel = () => {
  const navigate = useNavigate();
  const {
    alertRules,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    toggleAlertRule,
  } = useOversight();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [filters, setFilters] = useState({
    severity: '',
    metric: '',
    enabled: '',
    search: '',
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeAlertRules = useMemo(() => {
    if (!Array.isArray(alertRules)) {
      return [];
    }
    return alertRules;
  }, [alertRules]);

  const filteredRules = useMemo(() => {
    let filtered = [...safeAlertRules];

    if (filters.severity && typeof filters.severity === 'string') {
      filtered = filtered.filter((rule) => rule && rule.severity === filters.severity);
    }

    if (filters.metric && typeof filters.metric === 'string') {
      filtered = filtered.filter((rule) => rule && rule.metric === filters.metric);
    }

    if (filters.enabled && typeof filters.enabled === 'string') {
      if (filters.enabled === 'enabled') {
        filtered = filtered.filter((rule) => rule && rule.enabled === true);
      } else if (filters.enabled === 'disabled') {
        filtered = filtered.filter((rule) => rule && rule.enabled === false);
      }
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
      const aDate = a ? new Date(a.updatedAt || a.createdAt) : new Date(0);
      const bDate = b ? new Date(b.updatedAt || b.createdAt) : new Date(0);
      return bDate - aDate;
    });

    return filtered;
  }, [safeAlertRules, filters]);

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
      severity: '',
      metric: '',
      enabled: '',
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
          const result = updateAlertRule(editingRule.id, ruleData);

          if (result.success) {
            logEvent(
              'CONFIG_UPDATE',
              'alert_rule',
              editingRule.id,
              {
                ruleName: ruleData.name,
                metric: ruleData.metric,
                severity: ruleData.severity,
                action: 'updated',
              },
              currentPersona?.label || 'Unknown',
            );

            addNotification(
              'success',
              'Alert Rule Updated',
              `Alert rule "${ruleData.name}" has been updated successfully.`,
            );

            handleCloseForm();
          } else {
            addNotification(
              'error',
              'Update Failed',
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : 'Failed to update alert rule. Please try again.',
            );
          }
        } else {
          const result = createAlertRule({
            ...ruleData,
            createdBy: currentPersona?.label || 'Unknown',
          });

          if (result.success) {
            logEvent(
              'CONFIG_UPDATE',
              'alert_rule',
              result.rule.id,
              {
                ruleName: ruleData.name,
                metric: ruleData.metric,
                severity: ruleData.severity,
                action: 'created',
              },
              currentPersona?.label || 'Unknown',
            );

            addNotification(
              'success',
              'Alert Rule Created',
              `Alert rule "${ruleData.name}" has been created successfully.`,
            );

            handleCloseForm();
          } else {
            addNotification(
              'error',
              'Creation Failed',
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : 'Failed to create alert rule. Please try again.',
            );
          }
        }
      } catch (err) {
        warn(COMPONENT_NAME, 'Failed to save alert rule', err);
        addNotification(
          'error',
          'Error',
          'An unexpected error occurred while saving the alert rule.',
        );
      }
    },
    [editingRule, createAlertRule, updateAlertRule, logEvent, addNotification, currentPersona, handleCloseForm],
  );

  const handleDeleteRule = useCallback(
    (rule) => {
      if (!rule || !rule.id) return;

      const success = deleteAlertRule(rule.id);

      if (success) {
        logEvent(
          'CONFIG_UPDATE',
          'alert_rule',
          rule.id,
          {
            ruleName: rule.name,
            action: 'deleted',
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Alert Rule Deleted',
          `Alert rule "${rule.name}" has been deleted.`,
        );
      } else {
        addNotification(
          'error',
          'Delete Failed',
          'Failed to delete alert rule. Please try again.',
        );
      }
    },
    [deleteAlertRule, logEvent, addNotification, currentPersona],
  );

  const handleToggleRule = useCallback(
    (rule) => {
      if (!rule || !rule.id) return;

      const success = toggleAlertRule(rule.id);

      if (success) {
        logEvent(
          'CONFIG_UPDATE',
          'alert_rule',
          rule.id,
          {
            ruleName: rule.name,
            action: rule.enabled ? 'disabled' : 'enabled',
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          rule.enabled ? 'Rule Disabled' : 'Rule Enabled',
          `Alert rule "${rule.name}" has been ${rule.enabled ? 'disabled' : 'enabled'}.`,
        );
      } else {
        addNotification(
          'error',
          'Toggle Failed',
          'Failed to toggle alert rule. Please try again.',
        );
      }
    },
    [toggleAlertRule, logEvent, addNotification, currentPersona],
  );

  const handleToggleRow = useCallback((ruleId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  const hasActiveFilters =
    filters.severity || filters.metric || filters.enabled || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Alert Configuration', path: '/alerts/config' },
  ];

  const exportData = useMemo(() => {
    return filteredRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      metric: METRIC_LABELS[rule.metric] || rule.metric,
      operator: OPERATOR_LABELS[rule.operator] || rule.operator,
      value: rule.value,
      severity: SEVERITY_LABELS[rule.severity] || rule.severity,
      enabled: rule.enabled ? 'Yes' : 'No',
      scope: Array.isArray(rule.counterpartyIds) && rule.counterpartyIds.length > 0
        ? rule.counterpartyIds.join(', ')
        : 'All',
      createdBy: rule.createdBy || '',
      createdAt: rule.createdAt || '',
      updatedAt: rule.updatedAt || '',
    }));
  }, [filteredRules]);

  const stats = useMemo(() => {
    return {
      total: safeAlertRules.length,
      enabled: safeAlertRules.filter((r) => r && r.enabled).length,
      disabled: safeAlertRules.filter((r) => r && !r.enabled).length,
    };
  }, [safeAlertRules]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Alert Configuration</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Configure and manage alert rules for counterparty risk monitoring.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='alert-rules'
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
              Create Alert Rule
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-5 h-5'
              >
                <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                <path d='M13.73 21a2 2 0 0 1-3.46 0' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Total Rules
              </p>
              <p className='text-2xl font-bold text-gray-900'>{stats.total}</p>
            </div>
          </div>

          <div className='flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-green-100 text-green-600'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-5 h-5'
              >
                <polyline points='20 6 9 17 4 12' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Enabled
              </p>
              <p className='text-2xl font-bold text-green-700'>{stats.enabled}</p>
            </div>
          </div>

          <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-5 h-5'
              >
                <circle cx='12' cy='12' r='10' />
                <line x1='15' y1='9' x2='9' y2='15' />
                <line x1='9' y1='9' x2='15' y2='15' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Disabled
              </p>
              <p className='text-2xl font-bold text-gray-900'>{stats.disabled}</p>
            </div>
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
                  className='input-enterprise pl-10 w-full lg:w-80'
                  aria-label='Search alert rules'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='alert-filter-severity'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Severity
                </label>
                <select
                  id='alert-filter-severity'
                  value={filters.severity}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  className='input-enterprise w-32 py-1.5 text-sm'
                  aria-label='Filter by severity'
                >
                  <option value=''>All</option>
                  {VALID_SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='alert-filter-metric'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Metric
                </label>
                <select
                  id='alert-filter-metric'
                  value={filters.metric}
                  onChange={(e) => handleFilterChange('metric', e.target.value)}
                  className='input-enterprise w-44 py-1.5 text-sm'
                  aria-label='Filter by metric'
                >
                  <option value=''>All Metrics</option>
                  {VALID_METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='alert-filter-enabled'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='alert-filter-enabled'
                  value={filters.enabled}
                  onChange={(e) => handleFilterChange('enabled', e.target.value)}
                  className='input-enterprise w-32 py-1.5 text-sm'
                  aria-label='Filter by enabled status'
                >
                  <option value=''>All</option>
                  <option value='enabled'>Enabled</option>
                  <option value='disabled'>Disabled</option>
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
                ? 'No alert rules found'
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
                  <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                  <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Alert Rules Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No alert rules match your current filters. Try adjusting or clearing your filters.'
                  : 'No alert rules have been configured yet. Click "Create Alert Rule" to get started.'}
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
                    <th className='w-12'></th>
                    <th>Rule Name</th>
                    <th>Metric</th>
                    <th>Condition</th>
                    <th>Threshold</th>
                    <th>Severity</th>
                    <th>Scope</th>
                    <th>Enabled</th>
                    <th className='w-32'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((rule) => {
                    if (!rule) return null;

                    const isExpanded = expandedRows.has(rule.id);
                    const severityColor =
                      SEVERITY_COLORS[rule.severity] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const severityLabel =
                      SEVERITY_LABELS[rule.severity] || rule.severity || 'Unknown';
                    const metricColor =
                      METRIC_COLORS[rule.metric] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const metricLabel =
                      METRIC_LABELS[rule.metric] || rule.metric || 'Unknown';
                    const operatorLabel =
                      OPERATOR_LABELS[rule.operator] || rule.operator || 'Unknown';
                    const scopeLabel =
                      Array.isArray(rule.counterpartyIds) && rule.counterpartyIds.length > 0
                        ? `${rule.counterpartyIds.length} counterparties`
                        : 'All';

                    return (
                      <tr key={rule.id} className={isExpanded ? 'bg-gray-50/70' : ''}>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(rule.id)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
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
                        </td>
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
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${metricColor}`}
                          >
                            {metricLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>{operatorLabel}</span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-700'>
                            {rule.value !== undefined && rule.value !== null
                              ? String(rule.value)
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor}`}
                          >
                            {severityLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-600'>{scopeLabel}</span>
                        </td>
                        <td>
                          <button
                            type='button'
                            onClick={() => handleToggleRule(rule)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 ${
                              rule.enabled ? 'bg-enterprise-600' : 'bg-gray-300'
                            }`}
                            aria-label={`${rule.enabled ? 'Disable' : 'Enable'} rule ${rule.name}`}
                            role='switch'
                            aria-checked={rule.enabled}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                rule.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                        <td>
                          <div className='flex items-center gap-1'>
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

                            <button
                              type='button'
                              onClick={() => handleDeleteRule(rule)}
                              className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                              aria-label={`Delete rule ${rule.name}`}
                              title='Delete rule'
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {paginatedData.map((rule) => {
                if (!rule) return null;

                const isExpanded = expandedRows.has(rule.id);

                if (!isExpanded) return null;

                return (
                  <div
                    key={`details-${rule.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Rule ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{rule.id}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Rule Name
                        </span>
                        <span className='text-sm text-gray-900'>{rule.name || 'Unnamed Rule'}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Metric
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            METRIC_COLORS[rule.metric] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {METRIC_LABELS[rule.metric] || rule.metric || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Condition
                        </span>
                        <span className='text-sm text-gray-900'>
                          {OPERATOR_LABELS[rule.operator] || rule.operator || 'Unknown'}{' '}
                          {rule.value !== undefined && rule.value !== null ? String(rule.value) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Severity
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            SEVERITY_COLORS[rule.severity] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {SEVERITY_LABELS[rule.severity] || rule.severity || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        {rule.enabled ? (
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200'>
                            Enabled
                          </span>
                        ) : (
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                            Disabled
                          </span>
                        )}
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Scope
                        </span>
                        <span className='text-sm text-gray-900'>
                          {Array.isArray(rule.counterpartyIds) && rule.counterpartyIds.length > 0
                            ? rule.counterpartyIds.join(', ')
                            : 'All Counterparties'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Created By
                        </span>
                        <span className='text-sm text-gray-900'>
                          {rule.createdBy || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Created
                        </span>
                        <span className='text-sm text-gray-500'>
                          {rule.createdAt
                            ? formatDate(rule.createdAt, 'MMM d, yyyy HH:mm')
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Last Updated
                        </span>
                        <span className='text-sm text-gray-500'>
                          {rule.updatedAt
                            ? formatDate(rule.updatedAt, 'MMM d, yyyy HH:mm')
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {rule.description && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Description
                        </span>
                        <p className='text-sm text-gray-700'>{rule.description}</p>
                      </div>
                    )}

                    <div className='flex items-center gap-3 mt-4'>
                      <button
                        type='button'
                        onClick={() => handleEditRule(rule)}
                        className='btn-enterprise-secondary text-xs'
                      >
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
                          <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                          <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
                        </svg>
                        Edit Rule
                      </button>

                      <button
                        type='button'
                        onClick={() => handleToggleRule(rule)}
                        className='btn-enterprise-secondary text-xs'
                      >
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
                          {rule.enabled ? (
                            <>
                              <circle cx='12' cy='12' r='10' />
                              <line x1='15' y1='9' x2='9' y2='15' />
                              <line x1='9' y1='9' x2='15' y2='15' />
                            </>
                          ) : (
                            <polyline points='20 6 9 17 4 12' />
                          )}
                        </svg>
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                );
              })}
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

        <AlertRuleFormModal
          rule={editingRule}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveRule}
        />
      </div>
    </RequireRole>
  );
};

AlertConfigurationPanel.propTypes = {};

export default AlertConfigurationPanel;