import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useRepurchases } from '../contexts/RepurchaseContext';
import { useLoans } from '../contexts/LoanContext';
import { useDefects } from '../contexts/DefectContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { formatCurrency, formatDate, truncateText } from '../utils/formatters';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'RepurchaseCaseDetailPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const REPURCHASE_STATUSES = [
  'draft',
  'demand_issued',
  'counterparty_review',
  'negotiation',
  'accepted',
  'disputed',
  'alternative_accepted',
  'closed',
];

const STATUS_TRANSITIONS = {
  draft: ['demand_issued'],
  demand_issued: ['counterparty_review'],
  counterparty_review: ['negotiation', 'accepted', 'disputed'],
  negotiation: ['accepted', 'alternative_accepted', 'disputed'],
  accepted: ['closed'],
  alternative_accepted: ['closed'],
  disputed: ['negotiation', 'closed'],
  closed: [],
};

const STATUS_LABELS = {
  draft: 'Draft',
  demand_issued: 'Demand Issued',
  counterparty_review: 'Counterparty Review',
  negotiation: 'Negotiation',
  accepted: 'Accepted',
  disputed: 'Disputed',
  alternative_accepted: 'Alternative Accepted',
  closed: 'Closed',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  demand_issued: 'bg-blue-100 text-blue-700 border-blue-200',
  counterparty_review: 'bg-amber-100 text-amber-700 border-amber-200',
  negotiation: 'bg-purple-100 text-purple-700 border-purple-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  disputed: 'bg-red-100 text-red-700 border-red-200',
  alternative_accepted: 'bg-teal-100 text-teal-700 border-teal-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const RESPONSE_TYPE_LABELS = {
  accept: 'Accepted',
  dispute: 'Disputed',
  counter: 'Countered',
};

const RESPONSE_TYPE_COLORS = {
  accept: 'bg-green-100 text-green-700 border-green-200',
  dispute: 'bg-red-100 text-red-700 border-red-200',
  counter: 'bg-amber-100 text-amber-700 border-amber-200',
};

const ALTERNATIVE_TYPE_LABELS = {
  indemnification: 'Indemnification',
  price_adjustment: 'Price Adjustment',
  partial_repurchase: 'Partial Repurchase',
  other: 'Other',
};

const ALTERNATIVE_STATUS_LABELS = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const ALTERNATIVE_STATUS_COLORS = {
  proposed: 'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

const OUTCOME_TYPE_LABELS = {
  full_repurchase: 'Full Repurchase',
  partial_repurchase: 'Partial Repurchase',
  indemnification: 'Indemnification',
  price_adjustment: 'Price Adjustment',
  withdrawn: 'Withdrawn',
};

const OUTCOME_TYPE_COLORS = {
  full_repurchase: 'bg-red-100 text-red-700 border-red-200',
  partial_repurchase: 'bg-amber-100 text-amber-700 border-amber-200',
  indemnification: 'bg-purple-100 text-purple-700 border-purple-200',
  price_adjustment: 'bg-blue-100 text-blue-700 border-blue-200',
  withdrawn: 'bg-gray-100 text-gray-600 border-gray-200',
};

const FINANCIAL_EXPOSURE_ROLES = ['risk-analyst', 'admin'];

const getAgingBucket = (createdAt, status) => {
  if (!createdAt) return 'Unknown';
  if (status === 'closed') return 'Closed';

  try {
    const createdDate = new Date(createdAt);
    if (isNaN(createdDate.getTime())) return 'Unknown';

    const now = new Date();
    const diffMs = now - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return '0-30';
    if (diffDays <= 30) return '0-30';
    if (diffDays <= 60) return '31-60';
    if (diffDays <= 90) return '61-90';
    if (diffDays <= 180) return '91-180';
    return '180+';
  } catch {
    return 'Unknown';
  }
};

const getAgingBucketLabel = (bucket) => {
  const labels = {
    '0-30': '0–30 Days',
    '31-60': '31–60 Days',
    '61-90': '61–90 Days',
    '91-180': '91–180 Days',
    '180+': '180+ Days',
    'Closed': 'Closed',
  };
  return labels[bucket] || bucket || 'Unknown';
};

const IssueDemandModal = ({ repurchaseCase, isOpen, onClose, onIssue }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!repurchaseCase || !repurchaseCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isMountedRef.current) {
        onIssue(repurchaseCase.id);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Issue demand submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, repurchaseCase, onIssue, onClose]);

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
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='issue-demand-modal-title'
      aria-describedby='issue-demand-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='issue-demand-modal-title' className='text-lg font-semibold text-gray-900'>
              Issue Repurchase Demand
            </h2>
            <p id='issue-demand-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Issue the repurchase demand for case {repurchaseCase?.id || 'Unknown'}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close issue demand modal'
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
                <p className='text-sm font-semibold text-blue-800'>Confirm Demand Issuance</p>
                <p className='text-xs text-blue-700 mt-1'>
                  This will issue the repurchase demand for{' '}
                  <span className='font-mono font-semibold'>
                    {formatCurrency(repurchaseCase?.demandAmount)}
                  </span>{' '}
                  to counterparty{' '}
                  <span className='font-mono font-semibold'>
                    {repurchaseCase?.sellerId || 'Unknown'}
                  </span>
                  . This action will be logged in the audit trail.
                </p>
              </div>
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
                Issuing...
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
                Issue Demand
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

IssueDemandModal.propTypes = {
  repurchaseCase: PropTypes.shape({
    id: PropTypes.string,
    demandAmount: PropTypes.number,
    sellerId: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onIssue: PropTypes.func.isRequired,
};

IssueDemandModal.defaultProps = {
  repurchaseCase: null,
};

const CounterpartyResponseModal = ({ repurchaseCase, isOpen, onClose, onRecordResponse }) => {
  const [formData, setFormData] = useState({
    responseType: '',
    rationale: '',
    proposedAmount: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const responseTypeRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        responseType: '',
        rationale: '',
        proposedAmount: '',
      });
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (responseTypeRef.current) {
          responseTypeRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

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

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.responseType || formData.responseType.trim() === '') {
      newErrors.responseType = 'Please select a response type.';
    }

    if (!formData.rationale || formData.rationale.trim() === '') {
      newErrors.rationale = 'Please provide a rationale for the counterparty response.';
    } else if (formData.rationale.trim().length < 10) {
      newErrors.rationale = 'Rationale must be at least 10 characters.';
    }

    if (formData.responseType === 'counter') {
      if (formData.proposedAmount === '' || formData.proposedAmount === undefined || formData.proposedAmount === null) {
        newErrors.proposedAmount = 'Proposed amount is required for counter offers.';
      } else {
        const amount = Number(formData.proposedAmount);
        if (isNaN(amount) || amount <= 0) {
          newErrors.proposedAmount = 'Proposed amount must be a positive number.';
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

    if (!repurchaseCase || !repurchaseCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = {
        responseType: formData.responseType,
        rationale: formData.rationale,
        proposedAmount:
          formData.responseType === 'counter' && formData.proposedAmount !== ''
            ? Number(formData.proposedAmount)
            : null,
      };

      if (isMountedRef.current) {
        onRecordResponse(repurchaseCase.id, response);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Counterparty response submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, repurchaseCase, formData, onRecordResponse, onClose]);

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
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='counterparty-response-modal-title'
      aria-describedby='counterparty-response-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='counterparty-response-modal-title' className='text-lg font-semibold text-gray-900'>
              Record Counterparty Response
            </h2>
            <p id='counterparty-response-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Record the counterparty&apos;s response to the repurchase demand for case{' '}
              {repurchaseCase?.id || 'Unknown'}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close counterparty response modal'
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
              htmlFor='cp-response-type'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Response Type
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <select
              ref={responseTypeRef}
              id='cp-response-type'
              value={formData.responseType}
              onChange={(e) => handleFieldChange('responseType', e.target.value)}
              disabled={isSubmitting}
              className={`input-enterprise ${errors.responseType ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Counterparty response type'
              aria-describedby={errors.responseType ? 'cp-response-type-error' : undefined}
              aria-invalid={errors.responseType ? 'true' : 'false'}
            >
              <option value=''>Select response type...</option>
              <option value='accept'>Accept</option>
              <option value='dispute'>Dispute</option>
              <option value='counter'>Counter</option>
            </select>
            {errors.responseType && (
              <p id='cp-response-type-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                {errors.responseType}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='cp-response-rationale'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Rationale
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='cp-response-rationale'
              value={formData.rationale}
              onChange={(e) => handleFieldChange('rationale', e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide the counterparty rationale for their response...'
              className={`input-enterprise resize-none ${errors.rationale ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Counterparty response rationale'
              aria-describedby={errors.rationale ? 'cp-response-rationale-error' : undefined}
              aria-invalid={errors.rationale ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.rationale ? (
                <p id='cp-response-rationale-error' className='text-xs text-red-600 flex items-center gap-1'>
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
                  {errors.rationale}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{formData.rationale.length}/2000</span>
            </div>
          </div>

          {formData.responseType === 'counter' && (
            <div>
              <label
                htmlFor='cp-response-proposed-amount'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Proposed Amount ($)
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                id='cp-response-proposed-amount'
                type='number'
                value={formData.proposedAmount}
                onChange={(e) => handleFieldChange('proposedAmount', e.target.value)}
                disabled={isSubmitting}
                min={0}
                placeholder='0.00'
                className={`input-enterprise w-48 ${errors.proposedAmount ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Proposed amount'
                aria-describedby={errors.proposedAmount ? 'cp-response-proposed-amount-error' : undefined}
                aria-invalid={errors.proposedAmount ? 'true' : 'false'}
              />
              {errors.proposedAmount && (
                <p id='cp-response-proposed-amount-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                  {errors.proposedAmount}
                </p>
              )}
            </div>
          )}

          {formData.responseType && (
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
                  <p className='text-sm font-semibold text-blue-800'>Response Summary</p>
                  <p className='text-xs text-blue-700 mt-1'>
                    Recording a{' '}
                    <span className='font-semibold'>
                      {RESPONSE_TYPE_LABELS[formData.responseType] || formData.responseType}
                    </span>{' '}
                    response for case{' '}
                    <span className='font-mono font-semibold'>
                      {repurchaseCase?.id || 'Unknown'}
                    </span>
                    {formData.responseType === 'counter' && formData.proposedAmount !== '' && (
                      <>
                        {' '}with a proposed amount of{' '}
                        <span className='font-semibold'>
                          {formatCurrency(Number(formData.proposedAmount))}
                        </span>
                      </>
                    )}
                    . This action will be logged in the audit trail.
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
                Recording...
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
                Record Response
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

CounterpartyResponseModal.propTypes = {
  repurchaseCase: PropTypes.shape({
    id: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRecordResponse: PropTypes.func.isRequired,
};

CounterpartyResponseModal.defaultProps = {
  repurchaseCase: null,
};

const NegotiateAlternativeModal = ({ repurchaseCase, isOpen, onClose, onNegotiate }) => {
  const [formData, setFormData] = useState({
    type: '',
    terms: '',
    amount: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        type: '',
        terms: '',
        amount: '',
      });
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (typeRef.current) {
          typeRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

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

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.type || formData.type.trim() === '') {
      newErrors.type = 'Please select an alternative type.';
    }

    if (!formData.terms || formData.terms.trim() === '') {
      newErrors.terms = 'Please provide the terms of the alternative proposal.';
    } else if (formData.terms.trim().length < 10) {
      newErrors.terms = 'Terms must be at least 10 characters.';
    }

    if (formData.amount !== '' && formData.amount !== undefined && formData.amount !== null) {
      const amount = Number(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'Amount must be a positive number.';
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

    if (!repurchaseCase || !repurchaseCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const terms = {
        type: formData.type,
        terms: formData.terms,
        amount: formData.amount !== '' ? Number(formData.amount) : null,
      };

      if (isMountedRef.current) {
        onNegotiate(repurchaseCase.id, terms);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Negotiate alternative submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, repurchaseCase, formData, onNegotiate, onClose]);

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
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='negotiate-alternative-modal-title'
      aria-describedby='negotiate-alternative-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='negotiate-alternative-modal-title' className='text-lg font-semibold text-gray-900'>
              Negotiate Alternative
            </h2>
            <p id='negotiate-alternative-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Propose an alternative resolution for case {repurchaseCase?.id || 'Unknown'}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close negotiate alternative modal'
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
              htmlFor='alternative-type'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Alternative Type
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <select
              ref={typeRef}
              id='alternative-type'
              value={formData.type}
              onChange={(e) => handleFieldChange('type', e.target.value)}
              disabled={isSubmitting}
              className={`input-enterprise ${errors.type ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Alternative type'
              aria-describedby={errors.type ? 'alternative-type-error' : undefined}
              aria-invalid={errors.type ? 'true' : 'false'}
            >
              <option value=''>Select alternative type...</option>
              <option value='indemnification'>Indemnification</option>
              <option value='price_adjustment'>Price Adjustment</option>
              <option value='partial_repurchase'>Partial Repurchase</option>
              <option value='other'>Other</option>
            </select>
            {errors.type && (
              <p id='alternative-type-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                {errors.type}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='alternative-terms'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Terms
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='alternative-terms'
              value={formData.terms}
              onChange={(e) => handleFieldChange('terms', e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder='Describe the terms of the alternative proposal...'
              className={`input-enterprise resize-none ${errors.terms ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Alternative terms'
              aria-describedby={errors.terms ? 'alternative-terms-error' : undefined}
              aria-invalid={errors.terms ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.terms ? (
                <p id='alternative-terms-error' className='text-xs text-red-600 flex items-center gap-1'>
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
                  {errors.terms}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{formData.terms.length}/2000</span>
            </div>
          </div>

          <div>
            <label
              htmlFor='alternative-amount'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Amount ($)
            </label>
            <input
              id='alternative-amount'
              type='number'
              value={formData.amount}
              onChange={(e) => handleFieldChange('amount', e.target.value)}
              disabled={isSubmitting}
              min={0}
              placeholder='0.00'
              className={`input-enterprise w-48 ${errors.amount ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Alternative amount'
              aria-describedby={errors.amount ? 'alternative-amount-error' : undefined}
              aria-invalid={errors.amount ? 'true' : 'false'}
            />
            {errors.amount && (
              <p id='alternative-amount-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                {errors.amount}
              </p>
            )}
          </div>

          {formData.type && (
            <div className='p-4 rounded-xl bg-purple-50 border border-purple-200'>
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
                    className='w-5 h-5 text-purple-600'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='12' y1='16' x2='12' y2='12' />
                    <line x1='12' y1='8' x2='12.01' y2='8' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-purple-800'>Proposal Summary</p>
                  <p className='text-xs text-purple-700 mt-1'>
                    Proposing a{' '}
                    <span className='font-semibold'>
                      {ALTERNATIVE_TYPE_LABELS[formData.type] || formData.type}
                    </span>{' '}
                    alternative for case{' '}
                    <span className='font-mono font-semibold'>
                      {repurchaseCase?.id || 'Unknown'}
                    </span>
                    {formData.amount !== '' && (
                      <>
                        {' '}with an amount of{' '}
                        <span className='font-semibold'>
                          {formatCurrency(Number(formData.amount))}
                        </span>
                      </>
                    )}
                    . This action will be logged in the audit trail.
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
                Proposing...
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
                Propose Alternative
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

NegotiateAlternativeModal.propTypes = {
  repurchaseCase: PropTypes.shape({
    id: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onNegotiate: PropTypes.func.isRequired,
};

NegotiateAlternativeModal.defaultProps = {
  repurchaseCase: null,
};

const CloseCaseModal = ({ repurchaseCase, isOpen, onClose, onCloseCase }) => {
  const [formData, setFormData] = useState({
    outcomeType: '',
    settledAmount: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const outcomeTypeRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        outcomeType: '',
        settledAmount: '',
        notes: '',
      });
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (outcomeTypeRef.current) {
          outcomeTypeRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

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

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.outcomeType || formData.outcomeType.trim() === '') {
      newErrors.outcomeType = 'Please select an outcome type.';
    }

    if (formData.settledAmount !== '' && formData.settledAmount !== undefined && formData.settledAmount !== null) {
      const amount = Number(formData.settledAmount);
      if (isNaN(amount) || amount < 0) {
        newErrors.settledAmount = 'Settled amount must be a non-negative number.';
      }
    }

    if (!formData.notes || formData.notes.trim() === '') {
      newErrors.notes = 'Please provide closing notes.';
    } else if (formData.notes.trim().length < 10) {
      newErrors.notes = 'Notes must be at least 10 characters.';
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

    if (!repurchaseCase || !repurchaseCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const outcome = {
        type: formData.outcomeType,
        settledAmount: formData.settledAmount !== '' ? Number(formData.settledAmount) : 0,
        notes: formData.notes,
      };

      if (isMountedRef.current) {
        onCloseCase(repurchaseCase.id, outcome);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Close case submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, repurchaseCase, formData, onCloseCase, onClose]);

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
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='close-case-modal-title'
      aria-describedby='close-case-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='close-case-modal-title' className='text-lg font-semibold text-gray-900'>
              Close Repurchase Case
            </h2>
            <p id='close-case-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Close case {repurchaseCase?.id || 'Unknown'} with final outcome and settlement details.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close close case modal'
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
              htmlFor='close-case-outcome-type'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Outcome Type
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <select
              ref={outcomeTypeRef}
              id='close-case-outcome-type'
              value={formData.outcomeType}
              onChange={(e) => handleFieldChange('outcomeType', e.target.value)}
              disabled={isSubmitting}
              className={`input-enterprise ${errors.outcomeType ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Outcome type'
              aria-describedby={errors.outcomeType ? 'close-case-outcome-type-error' : undefined}
              aria-invalid={errors.outcomeType ? 'true' : 'false'}
            >
              <option value=''>Select outcome type...</option>
              <option value='full_repurchase'>Full Repurchase</option>
              <option value='partial_repurchase'>Partial Repurchase</option>
              <option value='indemnification'>Indemnification</option>
              <option value='price_adjustment'>Price Adjustment</option>
              <option value='withdrawn'>Withdrawn</option>
            </select>
            {errors.outcomeType && (
              <p id='close-case-outcome-type-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                {errors.outcomeType}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='close-case-settled-amount'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Settled Amount ($)
            </label>
            <input
              id='close-case-settled-amount'
              type='number'
              value={formData.settledAmount}
              onChange={(e) => handleFieldChange('settledAmount', e.target.value)}
              disabled={isSubmitting}
              min={0}
              placeholder='0.00'
              className={`input-enterprise w-48 ${errors.settledAmount ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Settled amount'
              aria-describedby={errors.settledAmount ? 'close-case-settled-amount-error' : undefined}
              aria-invalid={errors.settledAmount ? 'true' : 'false'}
            />
            {errors.settledAmount && (
              <p id='close-case-settled-amount-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                {errors.settledAmount}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='close-case-notes'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Closing Notes
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='close-case-notes'
              value={formData.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide closing notes for this case...'
              className={`input-enterprise resize-none ${errors.notes ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Closing notes'
              aria-describedby={errors.notes ? 'close-case-notes-error' : undefined}
              aria-invalid={errors.notes ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.notes ? (
                <p id='close-case-notes-error' className='text-xs text-red-600 flex items-center gap-1'>
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
                  {errors.notes}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{formData.notes.length}/2000</span>
            </div>
          </div>

          <div className='p-4 rounded-xl bg-green-50 border border-green-200'>
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
                  className='w-5 h-5 text-green-600'
                >
                  <polyline points='20 6 9 17 4 12' />
                </svg>
              </div>
              <div>
                <p className='text-sm font-semibold text-green-800'>Case Closure</p>
                <p className='text-xs text-green-700 mt-1'>
                  This will permanently close case{' '}
                  <span className='font-mono font-semibold'>
                    {repurchaseCase?.id || 'Unknown'}
                  </span>
                  . This action cannot be undone and will be logged in the audit trail.
                </p>
              </div>
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
                Closing...
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
                Close Case
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

CloseCaseModal.propTypes = {
  repurchaseCase: PropTypes.shape({
    id: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCloseCase: PropTypes.func.isRequired,
};

CloseCaseModal.defaultProps = {
  repurchaseCase: null,
};

const RepurchaseCaseDetailPage = () => {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { getRepurchaseCaseById, issueDemand, recordCounterpartyResponse, negotiateAlternative, closeRepurchase } = useRepurchases();
  const { getLoanById } = useLoans();
  const { getDefectById } = useDefects();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [isIssueDemandModalOpen, setIsIssueDemandModalOpen] = useState(false);
  const [isCounterpartyResponseModalOpen, setIsCounterpartyResponseModalOpen] = useState(false);
  const [isNegotiateAlternativeModalOpen, setIsNegotiateAlternativeModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const repurchaseCase = useMemo(() => {
    if (!caseId) return null;
    return getRepurchaseCaseById(caseId) || null;
  }, [caseId, getRepurchaseCaseById]);

  const loan = useMemo(() => {
    if (!repurchaseCase || !repurchaseCase.loanId) return null;
    return getLoanById(repurchaseCase.loanId) || null;
  }, [repurchaseCase, getLoanById]);

  const linkedDefects = useMemo(() => {
    if (!repurchaseCase || !Array.isArray(repurchaseCase.linkedDefectIds)) {
      return [];
    }
    return repurchaseCase.linkedDefectIds
      .map((defectId) => getDefectById(defectId))
      .filter(Boolean);
  }, [repurchaseCase, getDefectById]);

  const personaId = currentPersona?.id || '';
  const canViewFinancialExposure = FINANCIAL_EXPOSURE_ROLES.includes(personaId);

  const handleOpenIssueDemandModal = useCallback(() => {
    setIsIssueDemandModalOpen(true);
  }, []);

  const handleCloseIssueDemandModal = useCallback(() => {
    setIsIssueDemandModalOpen(false);
  }, []);

  const handleOpenCounterpartyResponseModal = useCallback(() => {
    setIsCounterpartyResponseModalOpen(true);
  }, []);

  const handleCloseCounterpartyResponseModal = useCallback(() => {
    setIsCounterpartyResponseModalOpen(false);
  }, []);

  const handleOpenNegotiateAlternativeModal = useCallback(() => {
    setIsNegotiateAlternativeModalOpen(true);
  }, []);

  const handleCloseNegotiateAlternativeModal = useCallback(() => {
    setIsNegotiateAlternativeModalOpen(false);
  }, []);

  const handleOpenCloseModal = useCallback(() => {
    setIsCloseModalOpen(true);
  }, []);

  const handleCloseCloseModal = useCallback(() => {
    setIsCloseModalOpen(false);
  }, []);

  const handleIssueDemand = useCallback(
    (id) => {
      if (!id) return;

      const result = issueDemand(id);

      if (result.success) {
        logEvent(
          'REPURCHASE_INITIATE',
          'repurchase_case',
          id,
          {
            action: 'demand_issued',
            demandAmount: repurchaseCase?.demandAmount,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Demand Issued',
          `Repurchase demand for case ${id} has been issued.`,
          `/repurchase/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Repurchase demand issued', { caseId: id });
      } else {
        addNotification(
          'error',
          'Issue Failed',
          result.error?.message || 'Failed to issue demand. Please try again.',
        );
      }
    },
    [repurchaseCase, issueDemand, logEvent, addNotification, currentPersona],
  );

  const handleRecordResponse = useCallback(
    (id, response) => {
      if (!id || !response) return;

      const result = recordCounterpartyResponse(id, response);

      if (result.success) {
        logEvent(
          'REPURCHASE_RESPONSE',
          'repurchase_case',
          id,
          {
            responseType: response.responseType,
            proposedAmount: response.proposedAmount,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Response Recorded',
          `Counterparty response for case ${id} has been recorded.`,
          `/repurchase/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Counterparty response recorded', {
          caseId: id,
          responseType: response.responseType,
        });
      } else {
        addNotification(
          'error',
          'Response Failed',
          result.error?.message || 'Failed to record counterparty response. Please try again.',
        );
      }
    },
    [recordCounterpartyResponse, logEvent, addNotification, currentPersona],
  );

  const handleNegotiateAlternative = useCallback(
    (id, terms) => {
      if (!id || !terms) return;

      const result = negotiateAlternative(id, terms);

      if (result.success) {
        logEvent(
          'REPURCHASE_NEGOTIATE',
          'repurchase_case',
          id,
          {
            alternativeType: terms.type,
            amount: terms.amount,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Alternative Proposed',
          `Alternative proposal for case ${id} has been submitted.`,
          `/repurchase/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Alternative proposal negotiated', {
          caseId: id,
          type: terms.type,
        });
      } else {
        addNotification(
          'error',
          'Proposal Failed',
          result.error?.message || 'Failed to negotiate alternative. Please try again.',
        );
      }
    },
    [negotiateAlternative, logEvent, addNotification, currentPersona],
  );

  const handleCloseCase = useCallback(
    (id, outcome) => {
      if (!id || !outcome) return;

      const result = closeRepurchase(id, outcome);

      if (result.success) {
        logEvent(
          'REPURCHASE_CLOSE',
          'repurchase_case',
          id,
          {
            outcomeType: outcome.type,
            settledAmount: outcome.settledAmount,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Case Closed',
          `Repurchase case ${id} has been closed.`,
          `/repurchase/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Repurchase case closed', {
          caseId: id,
          outcomeType: outcome.type,
          settledAmount: outcome.settledAmount,
        });
      } else {
        addNotification(
          'error',
          'Close Failed',
          result.error?.message || 'Failed to close case. Please try again.',
        );
      }
    },
    [closeRepurchase, logEvent, addNotification, currentPersona],
  );

  const handleViewLoan = useCallback(
    (loanId) => {
      if (!loanId) return;
      navigate(`/loans/${loanId}`);
    },
    [navigate],
  );

  const handleViewDefect = useCallback(
    (defectId) => {
      if (!defectId) return;
      navigate(`/defects/${defectId}`);
    },
    [navigate],
  );

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!caseId) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Repurchase Case Detail', path: `/repurchase/cases/${caseId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Repurchase Case Detail</h1>
            </div>
          </div>

          <div className='card-enterprise'>
            <div className='text-center py-12'>
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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Invalid Case ID</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No repurchase case ID was provided. Please select a case from the repurchase case list.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  if (!repurchaseCase) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Repurchase Case Detail', path: `/repurchase/cases/${caseId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Repurchase Case Detail</h1>
            </div>
          </div>

          <div className='card-enterprise'>
            <div className='text-center py-12'>
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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Case Not Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                Repurchase case with ID{' '}
                <span className='font-mono text-gray-700'>{caseId}</span> was not found.
                It may have been removed or the ID may be incorrect.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  const statusColor = STATUS_COLORS[repurchaseCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const statusLabel = STATUS_LABELS[repurchaseCase.status] || repurchaseCase.status || 'Unknown';

  const responseType = repurchaseCase.counterpartyResponse?.responseType || null;
  const responseColor = RESPONSE_TYPE_COLORS[responseType] || 'bg-gray-100 text-gray-500 border-gray-200';
  const responseLabel = RESPONSE_TYPE_LABELS[responseType] || 'No Response';

  const alternativeType = repurchaseCase.alternativeProposal?.type || null;
  const alternativeStatus = repurchaseCase.alternativeProposal?.status || null;
  const alternativeStatusColor = ALTERNATIVE_STATUS_COLORS[alternativeStatus] || 'bg-gray-100 text-gray-500 border-gray-200';
  const alternativeStatusLabel = ALTERNATIVE_STATUS_LABELS[alternativeStatus] || 'N/A';

  const outcomeType = repurchaseCase.finalOutcome?.type || null;
  const outcomeColor = OUTCOME_TYPE_COLORS[outcomeType] || 'bg-gray-100 text-gray-600 border-gray-200';
  const outcomeLabel = OUTCOME_TYPE_LABELS[outcomeType] || 'N/A';

  const agingBucket = getAgingBucket(repurchaseCase.createdAt, repurchaseCase.status);
  const agingLabel = getAgingBucketLabel(agingBucket);

  const exposure = repurchaseCase.exposure ?? repurchaseCase.demandAmount ?? 0;

  const availableTransitions = STATUS_TRANSITIONS[repurchaseCase.status] || [];
  const canIssueDemand = repurchaseCase.status === 'draft';
  const canRecordResponse = repurchaseCase.status === 'demand_issued' || repurchaseCase.status === 'counterparty_review';
  const canNegotiate = repurchaseCase.status === 'negotiation';
  const canClose = ['accepted', 'alternative_accepted', 'disputed'].includes(repurchaseCase.status);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Repurchase Cases', path: '/repurchase/cases' },
    { label: repurchaseCase.id, path: `/repurchase/cases/${repurchaseCase.id}` },
  ];

  const linkedDefectCount = Array.isArray(repurchaseCase.linkedDefectIds)
    ? repurchaseCase.linkedDefectIds.length
    : 0;

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-900'>Repurchase Case Detail</h1>
              <span className='text-sm font-mono text-gray-400'>{repurchaseCase.id}</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleGoBack}
              className='btn-enterprise-secondary'
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
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Back
            </button>

            {canIssueDemand && (
              <button
                type='button'
                onClick={handleOpenIssueDemandModal}
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
                  <polyline points='20 6 9 17 4 12' />
                </svg>
                Issue Demand
              </button>
            )}

            {canRecordResponse && (
              <button
                type='button'
                onClick={handleOpenCounterpartyResponseModal}
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
                  <path d='M12 20h9' />
                  <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
                </svg>
                Record Response
              </button>
            )}

            {canNegotiate && (
              <button
                type='button'
                onClick={handleOpenNegotiateAlternativeModal}
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
                  <polyline points='23 4 23 10 17 10' />
                  <polyline points='1 20 1 14 7 14' />
                  <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
                </svg>
                Negotiate Alternative
              </button>
            )}

            {canClose && (
              <button
                type='button'
                onClick={handleOpenCloseModal}
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
                  <polyline points='20 6 9 17 4 12' />
                </svg>
                Close Case
              </button>
            )}
          </div>
        </div>

        <div className='card-enterprise'>
          <h2 className='text-lg font-semibold text-gray-900 mb-5'>Case Information</h2>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Case ID
              </p>
              <p className='text-sm font-mono text-gray-900'>{repurchaseCase.id}</p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Counterparty
              </p>
              <p className='text-sm font-mono text-gray-900'>
                {repurchaseCase.sellerId || '—'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Linked Loan
              </p>
              {loan ? (
                <button
                  type='button'
                  onClick={() => handleViewLoan(repurchaseCase.loanId)}
                  className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                >
                  {repurchaseCase.loanId}
                </button>
              ) : (
                <span className='text-sm font-mono text-gray-400'>
                  {repurchaseCase.loanId || '—'}
                </span>
              )}
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Status
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
              >
                {statusLabel}
              </span>
            </div>

            {canViewFinancialExposure && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Demand Amount
                </p>
                <p className='text-sm font-mono text-gray-900'>
                  {formatCurrency(repurchaseCase.demandAmount)}
                </p>
              </div>
            )}

            {canViewFinancialExposure && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Current Exposure
                </p>
                <p className='text-sm font-mono text-gray-900'>
                  {formatCurrency(exposure)}
                </p>
              </div>
            )}

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Counterparty Response
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${responseColor}`}
              >
                {responseLabel}
              </span>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Aging
              </p>
              <p className='text-sm text-gray-900'>{agingLabel}</p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Linked Defects
              </p>
              <p className='text-sm text-gray-900'>
                {linkedDefectCount > 0
                  ? `${linkedDefectCount} defect${linkedDefectCount === 1 ? '' : 's'}`
                  : 'None'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Initiated
              </p>
              <p className='text-sm text-gray-900'>
                {formatDate(repurchaseCase.createdAt, 'MMM d, yyyy HH:mm')}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Last Updated
              </p>
              <p className='text-sm text-gray-900'>
                {formatDate(repurchaseCase.updatedAt, 'MMM d, yyyy HH:mm')}
              </p>
            </div>

            {repurchaseCase.counterpartyResponse?.receivedAt && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Response Received
                </p>
                <p className='text-sm text-gray-900'>
                  {formatDate(repurchaseCase.counterpartyResponse.receivedAt, 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}

            {repurchaseCase.counterpartyResponse?.proposedAmount !== null &&
              repurchaseCase.counterpartyResponse?.proposedAmount !== undefined && (
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Proposed Amount
                  </p>
                  <p className='text-sm font-mono text-gray-900'>
                    {formatCurrency(repurchaseCase.counterpartyResponse.proposedAmount)}
                  </p>
                </div>
              )}

            {repurchaseCase.alternativeProposal?.type && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Alternative Proposal
                </p>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-gray-900 capitalize'>
                    {ALTERNATIVE_TYPE_LABELS[repurchaseCase.alternativeProposal.type] ||
                      repurchaseCase.alternativeProposal.type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${alternativeStatusColor}`}
                  >
                    {alternativeStatusLabel}
                  </span>
                </div>
              </div>
            )}

            {repurchaseCase.alternativeProposal?.amount !== null &&
              repurchaseCase.alternativeProposal?.amount !== undefined && (
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Alternative Amount
                  </p>
                  <p className='text-sm font-mono text-gray-900'>
                    {formatCurrency(repurchaseCase.alternativeProposal.amount)}
                  </p>
                </div>
              )}

            {repurchaseCase.finalOutcome?.type && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Final Outcome
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${outcomeColor}`}
                >
                  {outcomeLabel}
                </span>
              </div>
            )}

            {repurchaseCase.finalOutcome?.settledAmount !== null &&
              repurchaseCase.finalOutcome?.settledAmount !== undefined && (
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Settled Amount
                  </p>
                  <p className='text-sm font-mono text-gray-900'>
                    {formatCurrency(repurchaseCase.finalOutcome.settledAmount)}
                  </p>
                </div>
              )}

            {repurchaseCase.finalOutcome?.closedAt && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Closed At
                </p>
                <p className='text-sm text-gray-900'>
                  {formatDate(repurchaseCase.finalOutcome.closedAt, 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}
          </div>

          {repurchaseCase.rationale && (
            <div className='mt-5 p-4 rounded-xl bg-white border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
                Rationale
              </p>
              <p className='text-sm text-gray-700'>{repurchaseCase.rationale}</p>
            </div>
          )}

          {repurchaseCase.counterpartyResponse?.rationale && (
            <div className='mt-5 p-4 rounded-xl bg-white border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
                Counterparty Rationale
              </p>
              <p className='text-sm text-gray-700'>
                {repurchaseCase.counterpartyResponse.rationale}
              </p>
            </div>
          )}

          {repurchaseCase.alternativeProposal?.terms && (
            <div className='mt-5 p-4 rounded-xl bg-white border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
                Alternative Terms
              </p>
              <p className='text-sm text-gray-700'>
                {repurchaseCase.alternativeProposal.terms}
              </p>
            </div>
          )}

          {repurchaseCase.finalOutcome?.notes && (
            <div className='mt-5 p-4 rounded-xl bg-green-50 border border-green-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
                Outcome Notes
              </p>
              <p className='text-sm text-green-800'>
                {repurchaseCase.finalOutcome.notes}
              </p>
            </div>
          )}
        </div>

        {loan && (
          <div className='card-enterprise'>
            <h2 className='text-lg font-semibold text-gray-900 mb-5'>Linked Loan</h2>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Loan ID
                </p>
                <button
                  type='button'
                  onClick={() => handleViewLoan(loan.id)}
                  className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                >
                  {loan.id}
                </button>
              </div>

              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Borrower
                </p>
                <PIIField
                  fieldType='fullName'
                  value={loan.borrowerName}
                  entityId={loan.id}
                />
              </div>

              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Loan Amount
                </p>
                <p className='text-sm font-mono text-gray-900'>
                  {formatCurrency(loan.loanAmount)}
                </p>
              </div>

              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Status
                </p>
                <span className='text-sm text-gray-900'>{loan.status || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {linkedDefects.length > 0 && (
          <div className='card-enterprise'>
            <h2 className='text-lg font-semibold text-gray-900 mb-5'>
              Linked Defects ({linkedDefects.length})
            </h2>

            <div className='space-y-3'>
              {linkedDefects.map((defect) => {
                if (!defect) return null;

                const defectSeverityColor =
                  defect.severity === 'critical'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : defect.severity === 'major'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : defect.severity === 'minor'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200';

                const defectSeverityLabel =
                  defect.severity
                    ? defect.severity.charAt(0).toUpperCase() + defect.severity.slice(1)
                    : 'Unknown';

                const defectStatusColor =
                  defect.status === 'open'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : defect.status === 'in_review'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : defect.status === 'closed'
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-purple-100 text-purple-700 border-purple-200';

                const defectStatusLabel =
                  defect.status
                    ? defect.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    : 'Unknown';

                return (
                  <div
                    key={defect.id}
                    className='flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200'
                  >
                    <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600'>
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
                        <line x1='15' y1='9' x2='9' y2='15' />
                        <line x1='9' y1='9' x2='15' y2='15' />
                      </svg>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <button
                          type='button'
                          onClick={() => handleViewDefect(defect.id)}
                          className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                        >
                          {defect.id}
                        </button>
                        <span className='text-xs text-gray-400'>•</span>
                        <span className='text-xs font-medium text-gray-500'>
                          {defect.taxonomyCode}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${defectSeverityColor}`}
                        >
                          {defectSeverityLabel}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${defectStatusColor}`}
                        >
                          {defectStatusLabel}
                        </span>
                      </div>
                      <p className='text-sm text-gray-700'>
                        {defect.description || 'No description provided.'}
                      </p>
                      <div className='flex items-center gap-3 mt-1'>
                        <span className='text-xs text-gray-400'>
                          Category: {defect.category} / {defect.subcategory}
                        </span>
                        <span className='text-xs text-gray-400'>•</span>
                        <span className='text-xs text-gray-400'>
                          Root Cause: {defect.rootCause || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Array.isArray(repurchaseCase.evidence) && repurchaseCase.evidence.length > 0 && (
          <div className='card-enterprise'>
            <h2 className='text-lg font-semibold text-gray-900 mb-5'>
              Evidence ({repurchaseCase.evidence.length})
            </h2>

            <div className='space-y-2'>
              {repurchaseCase.evidence.map((attachment) => {
                if (!attachment) return null;

                return (
                  <div
                    key={attachment.id}
                    className='flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200'
                  >
                    <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-enterprise-50 text-enterprise-600'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={1.5}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-4 h-4'
                      >
                        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                        <polyline points='14 2 14 8 20 8' />
                      </svg>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-xs font-medium text-gray-700 truncate'>
                        {attachment.fileName}
                      </p>
                      <p className='text-2xs text-gray-400'>
                        {attachment.fileType || 'Unknown type'}
                        {attachment.uploadDate && (
                          <>
                            {' • '}
                            {formatDate(attachment.uploadDate, 'MMM d, yyyy HH:mm')}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <IssueDemandModal
          repurchaseCase={repurchaseCase}
          isOpen={isIssueDemandModalOpen}
          onClose={handleCloseIssueDemandModal}
          onIssue={handleIssueDemand}
        />

        <CounterpartyResponseModal
          repurchaseCase={repurchaseCase}
          isOpen={isCounterpartyResponseModalOpen}
          onClose={handleCloseCounterpartyResponseModal}
          onRecordResponse={handleRecordResponse}
        />

        <NegotiateAlternativeModal
          repurchaseCase={repurchaseCase}
          isOpen={isNegotiateAlternativeModalOpen}
          onClose={handleCloseNegotiateAlternativeModal}
          onNegotiate={handleNegotiateAlternative}
        />

        <CloseCaseModal
          repurchaseCase={repurchaseCase}
          isOpen={isCloseModalOpen}
          onClose={handleCloseCloseModal}
          onCloseCase={handleCloseCase}
        />
      </div>
    </RequireRole>
  );
};

RepurchaseCaseDetailPage.propTypes = {};

export default RepurchaseCaseDetailPage;