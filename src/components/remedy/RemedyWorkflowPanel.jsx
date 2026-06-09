import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useRemedies } from '../../contexts/RemedyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAudit } from '../../contexts/AuditContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDate } from '../../utils/dateUtils';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'RemedyWorkflowPanel';

const STATUS_TRANSITIONS = {
  open: [
    { value: 'assigned', label: 'Assign & Start Work', icon: 'play', color: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' },
    { value: 'escalated', label: 'Escalate', icon: 'alert', color: 'bg-red-600 hover:bg-red-700 focus:ring-red-500' },
  ],
  assigned: [
    { value: 'in_progress', label: 'Start Work', icon: 'play', color: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' },
    { value: 'escalated', label: 'Escalate', icon: 'alert', color: 'bg-red-600 hover:bg-red-700 focus:ring-red-500' },
  ],
  in_progress: [
    { value: 'pending_counterparty', label: 'Await Counterparty', icon: 'clock', color: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' },
    { value: 'escalated', label: 'Escalate', icon: 'alert', color: 'bg-red-600 hover:bg-red-700 focus:ring-red-500' },
  ],
  pending_counterparty: [
    { value: 'resolved', label: 'Resolve', icon: 'check', color: 'bg-green-600 hover:bg-green-700 focus:ring-green-500' },
    { value: 'escalated', label: 'Escalate', icon: 'alert', color: 'bg-red-600 hover:bg-red-700 focus:ring-red-500' },
  ],
  escalated: [
    { value: 'in_progress', label: 'Reopen (De-escalate)', icon: 'refresh', color: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500' },
    { value: 'resolved', label: 'Resolve', icon: 'check', color: 'bg-green-600 hover:bg-green-700 focus:ring-green-500' },
  ],
  resolved: [
    { value: 'closed', label: 'Close Case', icon: 'lock', color: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500' },
  ],
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

const STATUS_ORDER = ['open', 'assigned', 'in_progress', 'pending_counterparty', 'resolved', 'closed'];

const TransitionConfirmationModal = ({ remedyCase, transition, isOpen, onClose, onConfirm }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const commentInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setComment('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (commentInputRef.current) {
          commentInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleCommentChange = useCallback(
    (e) => {
      const value = e.target.value;
      setComment(value);

      if (errors.comment) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.comment;
          return next;
        });
      }
    },
    [errors.comment],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!comment || comment.trim() === '') {
      newErrors.comment = 'Please provide a comment for this transition.';
    } else if (comment.trim().length < 5) {
      newErrors.comment = 'Comment must be at least 5 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [comment]);

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
        onConfirm(remedyCase.id, transition.value, comment);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Transition confirmation threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, remedyCase, transition, comment, onConfirm, onClose]);

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
  const newStatusLabel = STATUS_LABELS[transition.value] || transition.value || 'Unknown';

  const transitionIcon = () => {
    switch (transition.icon) {
      case 'play':
        return (
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
            <polygon points='5 3 19 12 5 21 5 3' />
          </svg>
        );
      case 'clock':
        return (
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
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
        );
      case 'check':
        return (
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
            <polyline points='20 6 9 17 4 12' />
          </svg>
        );
      case 'refresh':
        return (
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
            <polyline points='23 4 23 10 17 10' />
            <polyline points='1 20 1 14 7 14' />
            <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
          </svg>
        );
      case 'lock':
        return (
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
            <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
            <path d='M7 11V7a5 5 0 0 1 10 0v4' />
          </svg>
        );
      case 'alert':
        return (
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
            <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
            <line x1='12' y1='9' x2='12' y2='13' />
            <line x1='12' y1='17' x2='12.01' y2='17' />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='transition-confirm-modal-title'
      aria-describedby='transition-confirm-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='transition-confirm-modal-title' className='text-lg font-semibold text-gray-900'>
              {transition.label}
            </h2>
            <p id='transition-confirm-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Transition case {remedyCase?.id || 'Unknown'} from{' '}
              <span className='font-semibold'>{currentStatusLabel}</span> to{' '}
              <span className='font-semibold'>{newStatusLabel}</span>.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close confirmation modal'
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
          <div className='flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-enterprise-100 text-enterprise-600'>
              {transitionIcon()}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-gray-900'>{transition.label}</p>
              <p className='text-xs text-gray-500 mt-0.5'>
                From <span className='font-medium'>{currentStatusLabel}</span> to{' '}
                <span className='font-medium'>{newStatusLabel}</span>
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor='transition-comment'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Comment
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              ref={commentInputRef}
              id='transition-comment'
              value={comment}
              onChange={handleCommentChange}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide details about this status transition...'
              className={`input-enterprise resize-none ${errors.comment ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Transition comment'
              aria-describedby={errors.comment ? 'transition-comment-error' : undefined}
              aria-invalid={errors.comment ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.comment ? (
                <p id='transition-comment-error' className='text-xs text-red-600 flex items-center gap-1'>
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
                  {errors.comment}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{comment.length}/2000</span>
            </div>
          </div>

          {transition.value === 'escalated' && (
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
                    This case will be escalated to level{' '}
                    {(remedyCase?.escalationLevel ?? 0) + 1} and its priority will be set to
                    Critical. This action will be logged in the audit trail.
                  </p>
                </div>
              </div>
            </div>
          )}

          {transition.value === 'closed' && (
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
                    This will permanently close the case. This action cannot be undone and will be
                    logged in the audit trail.
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
            className={`btn-enterprise-primary ${transition.value === 'escalated' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : ''}`}
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
                Processing...
              </>
            ) : (
              <>
                {transitionIcon()}
                <span className='ml-2'>{transition.label}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

TransitionConfirmationModal.propTypes = {
  remedyCase: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
    escalationLevel: PropTypes.number,
  }),
  transition: PropTypes.shape({
    value: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.string,
    color: PropTypes.string,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

TransitionConfirmationModal.defaultProps = {
  remedyCase: null,
};

const RemedyWorkflowPanel = ({ remedyCase, onTransition }) => {
  const { transitionStatus, escalate } = useRemedies();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [selectedTransition, setSelectedTransition] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const availableTransitions = useMemo(() => {
    if (!remedyCase || !remedyCase.status) {
      return [];
    }
    return STATUS_TRANSITIONS[remedyCase.status] || [];
  }, [remedyCase]);

  const currentStatusIndex = useMemo(() => {
    if (!remedyCase || !remedyCase.status) {
      return -1;
    }
    return STATUS_ORDER.indexOf(remedyCase.status);
  }, [remedyCase]);

  const handleTransitionClick = useCallback((transition) => {
    if (!transition) return;
    setSelectedTransition(transition);
    setIsConfirmModalOpen(true);
  }, []);

  const handleCloseConfirmModal = useCallback(() => {
    setIsConfirmModalOpen(false);
    setSelectedTransition(null);
  }, []);

  const handleConfirmTransition = useCallback(
    (caseId, newStatus, comment) => {
      if (!caseId || !newStatus) return;

      if (newStatus === 'escalated') {
        const result = escalate(caseId, comment);

        if (result.success) {
          logEvent(
            'REMEDY_ESCALATE',
            'remedy_case',
            caseId,
            {
              previousStatus: remedyCase?.status || 'Unknown',
              newStatus,
              comment,
              newEscalationLevel: (remedyCase?.escalationLevel ?? 0) + 1,
            },
            currentPersona?.label || 'Unknown',
          );

          addNotification(
            'warning',
            'Case Escalated',
            `Remedy case ${caseId} has been escalated.`,
            `/remedy/cases/${caseId}`,
          );

          debug(COMPONENT_NAME, 'Remedy case escalated via workflow panel', {
            caseId,
            comment,
          });

          if (typeof onTransition === 'function') {
            onTransition(caseId, newStatus, comment);
          }
        } else {
          addNotification(
            'error',
            'Escalation Failed',
            result.error?.message || 'Failed to escalate case. Please try again.',
          );
        }
      } else {
        const result = transitionStatus(caseId, newStatus, comment);

        if (result.success) {
          logEvent(
            'REMEDY_TRANSITION',
            'remedy_case',
            caseId,
            {
              previousStatus: remedyCase?.status || 'Unknown',
              newStatus,
              comment,
            },
            currentPersona?.label || 'Unknown',
          );

          addNotification(
            'success',
            'Status Updated',
            `Remedy case ${caseId} has been transitioned to ${STATUS_LABELS[newStatus] || newStatus}.`,
            `/remedy/cases/${caseId}`,
          );

          debug(COMPONENT_NAME, 'Remedy case transitioned via workflow panel', {
            caseId,
            newStatus,
            comment,
          });

          if (typeof onTransition === 'function') {
            onTransition(caseId, newStatus, comment);
          }
        } else {
          addNotification(
            'error',
            'Transition Failed',
            result.error?.message || 'Failed to transition case status. Please try again.',
          );
        }
      }
    },
    [remedyCase, transitionStatus, escalate, logEvent, addNotification, currentPersona, onTransition],
  );

  if (!remedyCase) {
    return (
      <div className='card-enterprise'>
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
            <line x1='12' y1='8' x2='12' y2='12' />
            <line x1='12' y1='16' x2='12.01' y2='16' />
          </svg>
          <p className='text-sm text-gray-500'>No remedy case data available.</p>
        </div>
      </div>
    );
  }

  const currentStatus = remedyCase.status || 'open';
  const currentStatusLabel = STATUS_LABELS[currentStatus] || currentStatus || 'Unknown';
  const currentStatusColor = STATUS_COLORS[currentStatus] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <div className='card-enterprise'>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Workflow Status</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Current status and available transitions for case {remedyCase.id}.
          </p>
        </div>

        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${currentStatusColor}`}
        >
          {currentStatusLabel}
        </span>
      </div>

      <div className='mb-6'>
        <div className='flex items-center justify-between mb-3'>
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
            State Machine
          </span>
          <span className='text-xs text-gray-400'>
            {currentStatusIndex >= 0 ? `Step ${currentStatusIndex + 1} of ${STATUS_ORDER.length}` : 'Unknown'}
          </span>
        </div>

        <div className='relative'>
          <div className='absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2' aria-hidden='true' />

          <div className='relative flex items-center justify-between'>
            {STATUS_ORDER.map((status, index) => {
              const isCompleted = currentStatusIndex > index;
              const isCurrent = currentStatusIndex === index;
              const isFuture = currentStatusIndex < index;
              const statusLabel = STATUS_LABELS[status] || status;

              return (
                <div key={status} className='flex flex-col items-center'>
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-200 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                          ? 'bg-enterprise-600 border-enterprise-600 text-white ring-4 ring-enterprise-100'
                          : 'bg-white border-gray-300 text-gray-400'
                    }`}
                    title={statusLabel}
                  >
                    {isCompleted ? (
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={3}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-4 h-4'
                      >
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                    ) : (
                      <span className='text-xs font-bold'>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center max-w-[80px] leading-tight ${
                      isCurrent ? 'text-enterprise-700 font-semibold' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {remedyCase.status === 'escalated' && (
        <div className='mb-6 p-4 rounded-xl bg-red-50 border border-red-200'>
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
              <p className='text-sm font-semibold text-red-800'>
                Case Escalated — Level {remedyCase.escalationLevel ?? 0}
              </p>
              <p className='text-xs text-red-600 mt-1'>
                This case has been escalated and requires immediate attention. De-escalate or
                resolve to continue the workflow.
              </p>
            </div>
          </div>
        </div>
      )}

      {remedyCase.status === 'closed' && (
        <div className='mb-6 p-4 rounded-xl bg-green-50 border border-green-200'>
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
              <p className='text-sm font-semibold text-green-800'>Case Closed</p>
              <p className='text-xs text-green-600 mt-1'>
                This case has been closed. No further transitions are available.
              </p>
            </div>
          </div>
        </div>
      )}

      {availableTransitions.length > 0 && (
        <div>
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3'>
            Available Transitions
          </span>

          <div className='flex flex-wrap gap-3'>
            {availableTransitions.map((transition) => (
              <button
                key={transition.value}
                type='button'
                onClick={() => handleTransitionClick(transition)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150 ${transition.color}`}
                aria-label={transition.label}
              >
                {transition.icon === 'play' && (
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
                    <polygon points='5 3 19 12 5 21 5 3' />
                  </svg>
                )}
                {transition.icon === 'clock' && (
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
                )}
                {transition.icon === 'check' && (
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
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                )}
                {transition.icon === 'refresh' && (
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
                    <polyline points='23 4 23 10 17 10' />
                    <polyline points='1 20 1 14 7 14' />
                    <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
                  </svg>
                )}
                {transition.icon === 'lock' && (
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
                    <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                    <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                  </svg>
                )}
                {transition.icon === 'alert' && (
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
                    <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                    <line x1='12' y1='9' x2='12' y2='13' />
                    <line x1='12' y1='17' x2='12.01' y2='17' />
                  </svg>
                )}
                {transition.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableTransitions.length === 0 && remedyCase.status !== 'closed' && (
        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200 text-center'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-8 h-8 text-gray-300 mx-auto mb-2'
          >
            <circle cx='12' cy='12' r='10' />
            <line x1='12' y1='8' x2='12' y2='12' />
            <line x1='12' y1='16' x2='12.01' y2='16' />
          </svg>
          <p className='text-sm text-gray-500'>
            No transitions are available from the current status.
          </p>
        </div>
      )}

      <TransitionConfirmationModal
        remedyCase={remedyCase}
        transition={selectedTransition}
        isOpen={isConfirmModalOpen}
        onClose={handleCloseConfirmModal}
        onConfirm={handleConfirmTransition}
      />
    </div>
  );
};

RemedyWorkflowPanel.propTypes = {
  remedyCase: PropTypes.shape({
    id: PropTypes.string,
    sourceType: PropTypes.string,
    sourceId: PropTypes.string,
    linkedDefectIds: PropTypes.arrayOf(PropTypes.string),
    sellerId: PropTypes.string,
    remedyType: PropTypes.string,
    status: PropTypes.string,
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
  onTransition: PropTypes.func,
};

RemedyWorkflowPanel.defaultProps = {
  remedyCase: null,
  onTransition: null,
};

export default RemedyWorkflowPanel;