import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useRemedies } from '../contexts/RemedyContext';
import { useLoans } from '../contexts/LoanContext';
import { useDefects } from '../contexts/DefectContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { formatCurrency, formatDate, truncateText } from '../utils/formatters';
import { isDateBreached, getAgingBucket } from '../utils/dateUtils';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'RemedyCaseDetailPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const REMEDY_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'pending_counterparty',
  'escalated',
  'resolved',
  'closed',
];

const STATUS_TRANSITIONS = {
  open: ['assigned', 'escalated'],
  assigned: ['in_progress', 'escalated'],
  in_progress: ['pending_counterparty', 'escalated'],
  pending_counterparty: ['resolved', 'escalated'],
  escalated: ['in_progress', 'resolved'],
  resolved: ['closed'],
  closed: [],
};

const STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_counterparty: 'Pending Counterparty',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  assigned: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  pending_counterparty: 'bg-purple-100 text-purple-700 border-purple-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const REMEDY_TYPE_LABELS = {
  cure: 'Cure',
  repurchase: 'Repurchase',
  indemnification: 'Indemnification',
  price_adjustment: 'Price Adjustment',
  other: 'Other',
};

const REMEDY_TYPE_COLORS = {
  cure: 'bg-teal-100 text-teal-700 border-teal-200',
  repurchase: 'bg-red-100 text-red-700 border-red-200',
  indemnification: 'bg-purple-100 text-purple-700 border-purple-200',
  price_adjustment: 'bg-amber-100 text-amber-700 border-amber-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SOURCE_TYPE_LABELS = {
  eligibility_failure: 'Eligibility Failure',
  qc_defect: 'QC Defect',
  manual: 'Manual',
};

const SOURCE_TYPE_COLORS = {
  eligibility_failure: 'bg-orange-100 text-orange-700 border-orange-200',
  qc_defect: 'bg-rose-100 text-rose-700 border-rose-200',
  manual: 'bg-gray-100 text-gray-600 border-gray-200',
};

const FINANCIAL_EXPOSURE_ROLES = ['risk-analyst', 'admin'];

const StatusTransitionModal = ({ remedyCase, isOpen, onClose, onTransition }) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const statusSelectRef = useRef(null);
  const isMountedRef = useRef(true);

  const availableTransitions = useMemo(() => {
    if (!remedyCase || !remedyCase.status) {
      return [];
    }
    return STATUS_TRANSITIONS[remedyCase.status] || [];
  }, [remedyCase]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus('');
      setNotes('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (statusSelectRef.current) {
          statusSelectRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleStatusChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSelectedStatus(value);

      if (errors.status) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.status;
          return next;
        });
      }
    },
    [errors.status],
  );

  const handleNotesChange = useCallback(
    (e) => {
      const value = e.target.value;
      setNotes(value);

      if (errors.notes) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.notes;
          return next;
        });
      }
    },
    [errors.notes],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!selectedStatus || selectedStatus.trim() === '') {
      newErrors.status = 'Please select a new status.';
    }

    if (!notes || notes.trim() === '') {
      newErrors.notes = 'Please provide notes for this status transition.';
    } else if (notes.trim().length < 5) {
      newErrors.notes = 'Notes must be at least 5 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedStatus, notes]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!remedyCase || !remedyCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isMountedRef.current) {
        onTransition(remedyCase.id, selectedStatus, notes);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Status transition submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, remedyCase, selectedStatus, notes, onTransition, onClose]);

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

  const currentStatusLabel = STATUS_LABELS[remedyCase?.status] || remedyCase?.status || 'Unknown';
  const newStatusLabel = STATUS_LABELS[selectedStatus] || selectedStatus || '';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='status-transition-modal-title'
      aria-describedby='status-transition-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='status-transition-modal-title' className='text-lg font-semibold text-gray-900'>
              Update Status
            </h2>
            <p id='status-transition-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Transition case {remedyCase?.id || 'Unknown'} from{' '}
              <span className='font-semibold'>{currentStatusLabel}</span> to a new status.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close status transition modal'
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
              htmlFor='status-transition-select'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              New Status
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <select
              ref={statusSelectRef}
              id='status-transition-select'
              value={selectedStatus}
              onChange={handleStatusChange}
              disabled={isSubmitting}
              className={`input-enterprise ${errors.status ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='New status'
              aria-describedby={errors.status ? 'status-transition-error' : undefined}
              aria-invalid={errors.status ? 'true' : 'false'}
            >
              <option value=''>Select new status...</option>
              {availableTransitions.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>
            {errors.status && (
              <p
                id='status-transition-error'
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
                {errors.status}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='status-transition-notes'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Notes
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='status-transition-notes'
              value={notes}
              onChange={handleNotesChange}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide details about this status transition...'
              className={`input-enterprise resize-none ${errors.notes ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Transition notes'
              aria-describedby={errors.notes ? 'status-transition-notes-error' : undefined}
              aria-invalid={errors.notes ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.notes ? (
                <p
                  id='status-transition-notes-error'
                  className='text-xs text-red-600 flex items-center gap-1'
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
                  {errors.notes}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{notes.length}/2000</span>
            </div>
          </div>

          {selectedStatus && (
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
                  <p className='text-sm font-semibold text-blue-800'>Transition Summary</p>
                  <p className='text-xs text-blue-700 mt-1'>
                    You are transitioning case{' '}
                    <span className='font-mono font-semibold'>
                      {remedyCase?.id || 'Unknown'}
                    </span>{' '}
                    from{' '}
                    <span className='font-semibold'>{currentStatusLabel}</span> to{' '}
                    <span className='font-semibold'>{newStatusLabel}</span>.
                    This action will be logged in the audit trail.
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
                Transitioning...
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
                Confirm Transition
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

StatusTransitionModal.propTypes = {
  remedyCase: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
    sourceType: PropTypes.string,
    sourceId: PropTypes.string,
    linkedDefectIds: PropTypes.arrayOf(PropTypes.string),
    sellerId: PropTypes.string,
    remedyType: PropTypes.string,
    priority: PropTypes.string,
    ownerId: PropTypes.string,
    dueDate: PropTypes.string,
    slaBreached: PropTypes.bool,
    escalationLevel: PropTypes.number,
    description: PropTypes.string,
    financialImpact: PropTypes.shape({
      estimated: PropTypes.number,
      actual: PropTypes.number,
      currency: PropTypes.string,
    }),
    outcome: PropTypes.string,
    history: PropTypes.arrayOf(
      PropTypes.shape({
        timestamp: PropTypes.string,
        action: PropTypes.string,
        persona: PropTypes.string,
        notes: PropTypes.string,
      }),
    ),
    createdBy: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    resolvedAt: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onTransition: PropTypes.func.isRequired,
};

StatusTransitionModal.defaultProps = {
  remedyCase: null,
};

const EscalateModal = ({ remedyCase, isOpen, onClose, onEscalate }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const reasonInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (reasonInputRef.current) {
          reasonInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleReasonChange = useCallback(
    (e) => {
      const value = e.target.value;
      setReason(value);

      if (errors.reason) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.reason;
          return next;
        });
      }
    },
    [errors.reason],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!reason || reason.trim() === '') {
      newErrors.reason = 'Please provide a reason for escalation.';
    } else if (reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [reason]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!remedyCase || !remedyCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isMountedRef.current) {
        onEscalate(remedyCase.id, reason);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Escalation submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, remedyCase, reason, onEscalate, onClose]);

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

  const newEscalationLevel = (remedyCase?.escalationLevel ?? 0) + 1;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='escalate-modal-title'
      aria-describedby='escalate-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='escalate-modal-title' className='text-lg font-semibold text-gray-900'>
              Escalate Case
            </h2>
            <p id='escalate-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Escalate case {remedyCase?.id || 'Unknown'} to level {newEscalationLevel}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close escalate modal'
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
              htmlFor='escalate-reason'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Reason for Escalation
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              ref={reasonInputRef}
              id='escalate-reason'
              value={reason}
              onChange={handleReasonChange}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide a detailed reason for escalating this case...'
              className={`input-enterprise resize-none ${errors.reason ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Escalation reason'
              aria-describedby={errors.reason ? 'escalate-reason-error' : undefined}
              aria-invalid={errors.reason ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.reason ? (
                <p
                  id='escalate-reason-error'
                  className='text-xs text-red-600 flex items-center gap-1'
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
                  {errors.reason}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{reason.length}/2000</span>
            </div>
          </div>

          <div className='p-4 rounded-xl bg-red-50 border border-red-200'>
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
                  className='w-5 h-5 text-red-500'
                >
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
              </div>
              <div>
                <p className='text-sm font-semibold text-red-800'>Escalation Impact</p>
                <p className='text-xs text-red-700 mt-1'>
                  This case will be escalated to level {newEscalationLevel} and its priority
                  will be set to Critical. This action will be logged in the audit trail.
                </p>
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className='p-3 bg-red-100 border border-red-200 rounded-lg animate-fade-in'>
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
            className='btn-enterprise-primary bg-red-600 hover:bg-red-700 focus:ring-red-500'
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
                Escalating...
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
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
                Escalate to Level {newEscalationLevel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

EscalateModal.propTypes = {
  remedyCase: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
    escalationLevel: PropTypes.number,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEscalate: PropTypes.func.isRequired,
};

EscalateModal.defaultProps = {
  remedyCase: null,
};

const CloseCaseModal = ({ remedyCase, isOpen, onClose, onCloseCase }) => {
  const [outcome, setOutcome] = useState('');
  const [finalImpact, setFinalImpact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const outcomeInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setOutcome('');
      setFinalImpact('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (outcomeInputRef.current) {
          outcomeInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleOutcomeChange = useCallback(
    (e) => {
      const value = e.target.value;
      setOutcome(value);

      if (errors.outcome) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.outcome;
          return next;
        });
      }
    },
    [errors.outcome],
  );

  const handleFinalImpactChange = useCallback(
    (e) => {
      const value = e.target.value;
      setFinalImpact(value);

      if (errors.finalImpact) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.finalImpact;
          return next;
        });
      }
    },
    [errors.finalImpact],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!outcome || outcome.trim() === '') {
      newErrors.outcome = 'Please provide an outcome description.';
    } else if (outcome.trim().length < 10) {
      newErrors.outcome = 'Outcome must be at least 10 characters.';
    }

    if (finalImpact !== '' && finalImpact !== undefined && finalImpact !== null) {
      const impactNum = Number(finalImpact);
      if (isNaN(impactNum) || impactNum < 0) {
        newErrors.finalImpact = 'Final impact must be a non-negative number.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [outcome, finalImpact]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!remedyCase || !remedyCase.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const impactAmount = finalImpact !== '' && finalImpact !== undefined && finalImpact !== null
        ? Number(finalImpact)
        : 0;

      if (isMountedRef.current) {
        onCloseCase(remedyCase.id, outcome, impactAmount);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Close case submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, remedyCase, outcome, finalImpact, onCloseCase, onClose]);

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
              Close Case
            </h2>
            <p id='close-case-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Close case {remedyCase?.id || 'Unknown'} with final outcome and financial impact.
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
              htmlFor='close-case-outcome'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Outcome
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              ref={outcomeInputRef}
              id='close-case-outcome'
              value={outcome}
              onChange={handleOutcomeChange}
              disabled={isSubmitting}
              rows={4}
              placeholder='Describe the final outcome of this remedy case...'
              className={`input-enterprise resize-none ${errors.outcome ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Case outcome'
              aria-describedby={errors.outcome ? 'close-case-outcome-error' : undefined}
              aria-invalid={errors.outcome ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.outcome ? (
                <p
                  id='close-case-outcome-error'
                  className='text-xs text-red-600 flex items-center gap-1'
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
                  {errors.outcome}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{outcome.length}/2000</span>
            </div>
          </div>

          <div>
            <label
              htmlFor='close-case-final-impact'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Final Financial Impact ($)
            </label>
            <input
              id='close-case-final-impact'
              type='number'
              value={finalImpact}
              onChange={handleFinalImpactChange}
              disabled={isSubmitting}
              min={0}
              placeholder='0.00'
              className={`input-enterprise w-48 ${errors.finalImpact ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Final financial impact'
              aria-describedby={errors.finalImpact ? 'close-case-final-impact-error' : undefined}
              aria-invalid={errors.finalImpact ? 'true' : 'false'}
            />
            {errors.finalImpact && (
              <p
                id='close-case-final-impact-error'
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
                {errors.finalImpact}
              </p>
            )}
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
                    {remedyCase?.id || 'Unknown'}
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
  remedyCase: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCloseCase: PropTypes.func.isRequired,
};

CloseCaseModal.defaultProps = {
  remedyCase: null,
};

const RemedyCaseDetailPage = () => {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { getRemedyCaseById, transitionStatus, escalate, closeRemedyCase } = useRemedies();
  const { getLoanById } = useLoans();
  const { getDefectById } = useDefects();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const remedyCase = useMemo(() => {
    if (!caseId) return null;
    return getRemedyCaseById(caseId) || null;
  }, [caseId, getRemedyCaseById]);

  const loan = useMemo(() => {
    if (!remedyCase || !remedyCase.sellerId) return null;
    const linkedLoans = [];
    if (remedyCase.sourceType === 'eligibility_failure' && remedyCase.sourceId) {
      const foundLoan = getLoanById(remedyCase.sourceId);
      if (foundLoan) return foundLoan;
    }
    return null;
  }, [remedyCase, getLoanById]);

  const linkedDefects = useMemo(() => {
    if (!remedyCase || !Array.isArray(remedyCase.linkedDefectIds)) {
      return [];
    }
    return remedyCase.linkedDefectIds
      .map((defectId) => getDefectById(defectId))
      .filter(Boolean);
  }, [remedyCase, getDefectById]);

  const personaId = currentPersona?.id || '';
  const canViewFinancialExposure = FINANCIAL_EXPOSURE_ROLES.includes(personaId);

  const handleOpenTransitionModal = useCallback(() => {
    setIsTransitionModalOpen(true);
  }, []);

  const handleCloseTransitionModal = useCallback(() => {
    setIsTransitionModalOpen(false);
  }, []);

  const handleOpenEscalateModal = useCallback(() => {
    setIsEscalateModalOpen(true);
  }, []);

  const handleCloseEscalateModal = useCallback(() => {
    setIsEscalateModalOpen(false);
  }, []);

  const handleOpenCloseModal = useCallback(() => {
    setIsCloseModalOpen(true);
  }, []);

  const handleCloseCloseModal = useCallback(() => {
    setIsCloseModalOpen(false);
  }, []);

  const handleTransition = useCallback(
    (id, newStatus, notes) => {
      if (!id || !newStatus) return;

      const result = transitionStatus(id, newStatus, notes);

      if (result.success) {
        logEvent(
          'REMEDY_TRANSITION',
          'remedy_case',
          id,
          {
            previousStatus: remedyCase?.status || 'Unknown',
            newStatus,
            notes,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Status Updated',
          `Remedy case ${id} has been transitioned to ${STATUS_LABELS[newStatus] || newStatus}.`,
          `/remedy/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Remedy case status transitioned', {
          caseId: id,
          newStatus,
        });
      } else {
        addNotification(
          'error',
          'Transition Failed',
          result.error?.message || 'Failed to transition case status. Please try again.',
        );
      }
    },
    [remedyCase, transitionStatus, logEvent, addNotification, currentPersona],
  );

  const handleEscalate = useCallback(
    (id, reason) => {
      if (!id) return;

      const result = escalate(id, reason);

      if (result.success) {
        logEvent(
          'REMEDY_ESCALATE',
          'remedy_case',
          id,
          {
            previousStatus: remedyCase?.status || 'Unknown',
            reason,
            newEscalationLevel: (remedyCase?.escalationLevel ?? 0) + 1,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'warning',
          'Case Escalated',
          `Remedy case ${id} has been escalated.`,
          `/remedy/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Remedy case escalated', {
          caseId: id,
          reason,
        });
      } else {
        addNotification(
          'error',
          'Escalation Failed',
          result.error?.message || 'Failed to escalate case. Please try again.',
        );
      }
    },
    [remedyCase, escalate, logEvent, addNotification, currentPersona],
  );

  const handleCloseCase = useCallback(
    (id, outcome, finalImpact) => {
      if (!id) return;

      const result = closeRemedyCase(id, outcome, finalImpact);

      if (result.success) {
        logEvent(
          'REMEDY_CLOSE',
          'remedy_case',
          id,
          {
            outcome,
            finalImpact,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Case Closed',
          `Remedy case ${id} has been closed.`,
          `/remedy/cases/${id}`,
        );

        info(COMPONENT_NAME, 'Remedy case closed', {
          caseId: id,
          outcome,
          finalImpact,
        });
      } else {
        addNotification(
          'error',
          'Close Failed',
          result.error?.message || 'Failed to close case. Please try again.',
        );
      }
    },
    [closeRemedyCase, logEvent, addNotification, currentPersona],
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
                  { label: 'Remedy Case Detail', path: `/remedy/cases/${caseId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Remedy Case Detail</h1>
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
                No remedy case ID was provided. Please select a case from the remedy case list.
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

  if (!remedyCase) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Remedy Case Detail', path: `/remedy/cases/${caseId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Remedy Case Detail</h1>
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
                Remedy case with ID{' '}
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

  const statusColor = STATUS_COLORS[remedyCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const statusLabel = STATUS_LABELS[remedyCase.status] || remedyCase.status || 'Unknown';
  const priorityColor = PRIORITY_COLORS[remedyCase.priority] || 'bg-gray-100 text-gray-600 border-gray-200';
  const priorityLabel = PRIORITY_LABELS[remedyCase.priority] || remedyCase.priority || 'Unknown';
  const remedyTypeColor = REMEDY_TYPE_COLORS[remedyCase.remedyType] || 'bg-gray-100 text-gray-600 border-gray-200';
  const remedyTypeLabel = REMEDY_TYPE_LABELS[remedyCase.remedyType] || remedyCase.remedyType || 'Unknown';
  const sourceTypeColor = SOURCE_TYPE_COLORS[remedyCase.sourceType] || 'bg-gray-100 text-gray-600 border-gray-200';
  const sourceTypeLabel = SOURCE_TYPE_LABELS[remedyCase.sourceType] || remedyCase.sourceType || 'Unknown';

  const isBreached =
    remedyCase.slaBreached === true &&
    remedyCase.status !== 'closed' &&
    remedyCase.status !== 'resolved';
  const agingBucket = remedyCase.dueDate ? getAgingBucket(new Date(remedyCase.dueDate)) : 'Unknown';

  const financialExposure =
    remedyCase.financialImpact?.actual ||
    remedyCase.financialImpact?.estimated ||
    0;

  const availableTransitions = STATUS_TRANSITIONS[remedyCase.status] || [];
  const canTransition = availableTransitions.length > 0;
  const canEscalate =
    remedyCase.status !== 'escalated' &&
    remedyCase.status !== 'closed' &&
    remedyCase.status !== 'resolved';
  const canClose = remedyCase.status === 'resolved';

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Remedy Cases', path: '/remedy/cases' },
    { label: remedyCase.id, path: `/remedy/cases/${remedyCase.id}` },
  ];

  const historyEntries = Array.isArray(remedyCase.history) ? [...remedyCase.history].reverse() : [];

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-900'>Remedy Case Detail</h1>
              <span className='text-sm font-mono text-gray-400'>{remedyCase.id}</span>
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

            {canTransition && (
              <button
                type='button'
                onClick={handleOpenTransitionModal}
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
                  <polyline points='9 18 15 12 9 6' />
                </svg>
                Update Status
              </button>
            )}

            {canEscalate && (
              <button
                type='button'
                onClick={handleOpenEscalateModal}
                className='btn-enterprise-secondary text-red-600 hover:text-red-700 hover:bg-red-50'
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
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
                Escalate
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

        {isBreached && (
          <div className='p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in'>
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
                  className='w-5 h-5 text-red-500'
                >
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
              </div>
              <div>
                <p className='text-sm font-semibold text-red-800'>SLA Breached</p>
                <p className='text-xs text-red-600 mt-1'>
                  This case has exceeded its SLA deadline. Escalation level:{' '}
                  {remedyCase.escalationLevel ?? 0}. Immediate action is required.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className='card-enterprise'>
          <h2 className='text-lg font-semibold text-gray-900 mb-5'>Case Information</h2>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Case ID
              </p>
              <p className='text-sm font-mono text-gray-900'>{remedyCase.id}</p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Source Type
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sourceTypeColor}`}
              >
                {sourceTypeLabel}
              </span>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Source ID
              </p>
              <p className='text-sm font-mono text-gray-900'>
                {remedyCase.sourceId || '—'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Counterparty
              </p>
              <p className='text-sm font-mono text-gray-900'>
                {remedyCase.sellerId || '—'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Remedy Type
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${remedyTypeColor}`}
              >
                {remedyTypeLabel}
              </span>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Priority
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColor}`}
              >
                {priorityLabel}
              </span>
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

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Owner
              </p>
              <p className='text-sm text-gray-900'>
                {remedyCase.ownerId || 'Unassigned'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Due Date
              </p>
              <div className='flex items-center gap-2'>
                <p className='text-sm text-gray-900'>
                  {remedyCase.dueDate
                    ? formatDate(remedyCase.dueDate, 'MMM d, yyyy')
                    : '—'}
                </p>
                {isBreached && (
                  <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium bg-red-100 text-red-700 border border-red-200'>
                    Breached
                  </span>
                )}
              </div>
              {remedyCase.dueDate && (
                <p className='text-xs text-gray-400 mt-0.5'>{agingBucket}</p>
              )}
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Escalation Level
              </p>
              <p className='text-sm text-gray-900'>
                {remedyCase.escalationLevel ?? 0}
              </p>
            </div>

            {canViewFinancialExposure && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Financial Exposure
                </p>
                <p className='text-sm font-mono text-gray-900'>
                  {financialExposure > 0
                    ? formatCurrency(financialExposure)
                    : '—'}
                </p>
              </div>
            )}

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Created
              </p>
              <p className='text-sm text-gray-900'>
                {formatDate(remedyCase.createdAt, 'MMM d, yyyy HH:mm')}
              </p>
            </div>

            {remedyCase.resolvedAt && (
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Resolved
                </p>
                <p className='text-sm text-gray-900'>
                  {formatDate(remedyCase.resolvedAt, 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Last Updated
              </p>
              <p className='text-sm text-gray-900'>
                {formatDate(remedyCase.updatedAt, 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </div>

          {remedyCase.description && (
            <div className='mt-5 p-4 rounded-xl bg-white border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
                Description
              </p>
              <p className='text-sm text-gray-700'>{remedyCase.description}</p>
            </div>
          )}

          {remedyCase.outcome && (
            <div className='mt-5 p-4 rounded-xl bg-green-50 border border-green-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
                Outcome
              </p>
              <p className='text-sm text-green-800'>{remedyCase.outcome}</p>
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

        {historyEntries.length > 0 && (
          <div className='card-enterprise'>
            <h2 className='text-lg font-semibold text-gray-900 mb-5'>
              Case History ({historyEntries.length})
            </h2>

            <div className='relative'>
              <div
                className='absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200'
                aria-hidden='true'
              />

              <div className='space-y-4'>
                {historyEntries.map((entry, index) => {
                  if (!entry) return null;

                  const isLatest = index === 0;

                  return (
                    <div key={index} className='relative pl-10'>
                      <div
                        className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                          isLatest
                            ? 'bg-enterprise-600 border-enterprise-600 text-white'
                            : 'bg-white border-gray-300 text-gray-500'
                        }`}
                        aria-hidden='true'
                      >
                        {isLatest ? (
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2.5}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='w-4 h-4'
                          >
                            <polyline points='20 6 9 17 4 12' />
                          </svg>
                        ) : (
                          <span className='text-xs font-bold'>
                            {historyEntries.length - index}
                          </span>
                        )}
                      </div>

                      <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                        <div className='flex items-center justify-between mb-2'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm font-semibold text-gray-900'>
                              {entry.action || 'Unknown Action'}
                            </span>
                            <span className='text-xs text-gray-400'>
                              {formatDate(entry.timestamp, 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <span className='text-xs text-gray-500'>
                            {entry.persona || 'Unknown'}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className='text-sm text-gray-600'>{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <StatusTransitionModal
          remedyCase={remedyCase}
          isOpen={isTransitionModalOpen}
          onClose={handleCloseTransitionModal}
          onTransition={handleTransition}
        />

        <EscalateModal
          remedyCase={remedyCase}
          isOpen={isEscalateModalOpen}
          onClose={handleCloseEscalateModal}
          onEscalate={handleEscalate}
        />

        <CloseCaseModal
          remedyCase={remedyCase}
          isOpen={isCloseModalOpen}
          onClose={handleCloseCloseModal}
          onCloseCase={handleCloseCase}
        />
      </div>
    </RequireRole>
  );
};

RemedyCaseDetailPage.propTypes = {};

export default RemedyCaseDetailPage;