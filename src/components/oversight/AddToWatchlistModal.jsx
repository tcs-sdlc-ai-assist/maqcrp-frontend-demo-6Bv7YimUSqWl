import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useOversight } from '../../contexts/OversightContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAudit } from '../../contexts/AuditContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { debug, warn } from '../../utils/logger';
import RiskBadge from './RiskBadge';

const COMPONENT_NAME = 'AddToWatchlistModal';

const AddToWatchlistModal = ({ counterparty, isOpen, onClose }) => {
  const { addToWatchlist, riskTierCache } = useOversight();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [formData, setFormData] = useState({
    reason: '',
    actionPlanAssignee: '',
    actionPlanDueDate: '',
    actionPlanDescription: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasonInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const counterpartyId = counterparty?.id || counterparty?.counterpartyId || '';
  const counterpartyName = counterparty?.name || counterparty?.counterpartyName || counterpartyId || 'Unknown';

  const riskTier = riskTierCache[counterpartyId] || null;
  const riskTierLabel = riskTier?.current || 'unknown';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        reason: '',
        actionPlanAssignee: '',
        actionPlanDueDate: '',
        actionPlanDescription: '',
      });
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (reasonInputRef.current) {
          reasonInputRef.current.focus();
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

    if (!formData.reason || formData.reason.trim() === '') {
      newErrors.reason = 'Please provide a reason for adding to the watchlist.';
    } else if (formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters.';
    }

    if (formData.actionPlanDescription && formData.actionPlanDescription.trim().length < 10) {
      newErrors.actionPlanDescription = 'Action plan description must be at least 10 characters.';
    }

    if (formData.actionPlanDueDate && formData.actionPlanDueDate.trim() !== '') {
      const dueDate = new Date(formData.actionPlanDueDate);
      if (isNaN(dueDate.getTime())) {
        newErrors.actionPlanDueDate = 'Please enter a valid date.';
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

    if (!counterpartyId) {
      warn(COMPONENT_NAME, 'Add to watchlist attempted without valid counterparty');
      return;
    }

    setIsSubmitting(true);

    try {
      const entryData = {
        counterpartyId,
        counterpartyName,
        reason: formData.reason.trim(),
        addedBy: currentPersona?.label || 'Unknown',
      };

      const result = addToWatchlist(entryData);

      if (!result.success) {
        if (isMountedRef.current) {
          setErrors({
            submit:
              result.errors && result.errors.length > 0
                ? result.errors[0].message
                : 'Failed to add counterparty to watchlist. Please try again.',
          });
          setIsSubmitting(false);
        }

        warn(COMPONENT_NAME, 'Add to watchlist failed', {
          counterpartyId,
          errors: result.errors,
        });

        return;
      }

      logEvent(
        'WATCHLIST_ADDED',
        'watchlist',
        result.entry.id,
        {
          counterpartyId,
          counterpartyName,
          reason: formData.reason.trim(),
        },
        currentPersona?.label || 'Unknown',
      );

      addNotification(
        'success',
        'Added to Watchlist',
        `${counterpartyName} has been added to the watchlist.`,
        `/counterparties/${counterpartyId}`,
      );

      debug(COMPONENT_NAME, 'Counterparty added to watchlist', {
        counterpartyId,
        entryId: result.entry.id,
      });

      if (isMountedRef.current) {
        setIsSubmitting(false);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Add to watchlist submission threw an unexpected error', err);

      if (isMountedRef.current) {
        setErrors({
          submit: 'An unexpected error occurred. Please try again.',
        });
        setIsSubmitting(false);
      }
    }
  }, [
    isSubmitting,
    validate,
    counterpartyId,
    counterpartyName,
    formData,
    addToWatchlist,
    logEvent,
    addNotification,
    currentPersona,
    onClose,
  ]);

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

  const hasActionPlan =
    formData.actionPlanAssignee ||
    formData.actionPlanDueDate ||
    formData.actionPlanDescription;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='add-to-watchlist-modal-title'
      aria-describedby='add-to-watchlist-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='add-to-watchlist-modal-title' className='text-lg font-semibold text-gray-900'>
              Add to Watchlist
            </h2>
            <p id='add-to-watchlist-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Add{' '}
              <span className='font-semibold'>{counterpartyName}</span> to the watchlist for
              enhanced monitoring.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close add to watchlist modal'
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
          <div className='flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200'>
            <div className='flex-shrink-0'>
              <div className='w-10 h-10 rounded-lg bg-enterprise-100 flex items-center justify-center text-enterprise-700 font-semibold text-sm'>
                {counterpartyName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-gray-900 truncate'>
                {counterpartyName}
              </p>
              <p className='text-xs text-gray-400 font-mono'>{counterpartyId}</p>
            </div>
            <div className='flex-shrink-0'>
              <RiskBadge tier={riskTierLabel} />
            </div>
          </div>

          <div>
            <label
              htmlFor='watchlist-reason'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Reason
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              ref={reasonInputRef}
              id='watchlist-reason'
              value={formData.reason}
              onChange={(e) => handleFieldChange('reason', e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide a detailed reason for adding this counterparty to the watchlist...'
              className={`input-enterprise resize-none ${errors.reason ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Watchlist reason'
              aria-describedby={errors.reason ? 'watchlist-reason-error' : undefined}
              aria-invalid={errors.reason ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.reason ? (
                <p
                  id='watchlist-reason-error'
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
              <span className='text-xs text-gray-400'>{formData.reason.length}/2000</span>
            </div>
          </div>

          <div className='border-t border-gray-200 pt-5'>
            <div className='flex items-center justify-between mb-3'>
              <label className='block text-sm font-medium text-gray-700'>
                Initial Action Plan
              </label>
              <span className='text-xs text-gray-400'>Optional</span>
            </div>

            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='action-plan-assignee'
                  className='block text-xs font-medium text-gray-600 mb-1'
                >
                  Assignee
                </label>
                <input
                  id='action-plan-assignee'
                  type='text'
                  value={formData.actionPlanAssignee}
                  onChange={(e) => handleFieldChange('actionPlanAssignee', e.target.value)}
                  disabled={isSubmitting}
                  placeholder='e.g., Risk Analyst'
                  className='input-enterprise py-1.5 text-sm'
                  aria-label='Action plan assignee'
                />
              </div>

              <div>
                <label
                  htmlFor='action-plan-due-date'
                  className='block text-xs font-medium text-gray-600 mb-1'
                >
                  Due Date
                </label>
                <input
                  id='action-plan-due-date'
                  type='date'
                  value={formData.actionPlanDueDate}
                  onChange={(e) => handleFieldChange('actionPlanDueDate', e.target.value)}
                  disabled={isSubmitting}
                  className={`input-enterprise py-1.5 text-sm ${errors.actionPlanDueDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  aria-label='Action plan due date'
                  aria-describedby={
                    errors.actionPlanDueDate ? 'action-plan-due-date-error' : undefined
                  }
                  aria-invalid={errors.actionPlanDueDate ? 'true' : 'false'}
                />
                {errors.actionPlanDueDate && (
                  <p
                    id='action-plan-due-date-error'
                    className='text-xs text-red-600 mt-1 flex items-center gap-1'
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
                    {errors.actionPlanDueDate}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor='action-plan-description'
                  className='block text-xs font-medium text-gray-600 mb-1'
                >
                  Description
                </label>
                <textarea
                  id='action-plan-description'
                  value={formData.actionPlanDescription}
                  onChange={(e) => handleFieldChange('actionPlanDescription', e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder='Describe the initial action plan for monitoring this counterparty...'
                  className={`input-enterprise py-1.5 text-sm resize-none ${errors.actionPlanDescription ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  aria-label='Action plan description'
                  aria-describedby={
                    errors.actionPlanDescription ? 'action-plan-description-error' : undefined
                  }
                  aria-invalid={errors.actionPlanDescription ? 'true' : 'false'}
                  maxLength={2000}
                />
                {errors.actionPlanDescription && (
                  <p
                    id='action-plan-description-error'
                    className='text-xs text-red-600 mt-1 flex items-center gap-1'
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
                    {errors.actionPlanDescription}
                  </p>
                )}
              </div>
            </div>
          </div>

          {formData.reason && (
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
                    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                    <circle cx='12' cy='12' r='3' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-purple-800'>Watchlist Summary</p>
                  <p className='text-xs text-purple-700 mt-1'>
                    Adding{' '}
                    <span className='font-semibold'>{counterpartyName}</span> to the watchlist
                    {hasActionPlan && ' with an initial action plan'}.
                    Current risk tier:{' '}
                    <span className='font-semibold capitalize'>{riskTierLabel}</span>.
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
                Adding...
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
                Add to Watchlist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

AddToWatchlistModal.propTypes = {
  counterparty: PropTypes.shape({
    id: PropTypes.string,
    counterpartyId: PropTypes.string,
    name: PropTypes.string,
    counterpartyName: PropTypes.string,
    status: PropTypes.string,
    performanceMetrics: PropTypes.object,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

AddToWatchlistModal.defaultProps = {
  counterparty: null,
};

export default AddToWatchlistModal;