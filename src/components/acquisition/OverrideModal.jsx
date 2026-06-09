import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useRules } from '../../contexts/RulesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAudit } from '../../contexts/AuditContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'OverrideModal';

const OVERRIDE_REASON_CODES = [
  { value: 'COMPENSATING_FACTORS', label: 'Compensating Factors' },
  { value: 'MANAGEMENT_DISCRETION', label: 'Management Discretion' },
  { value: 'SYSTEM_ERROR', label: 'System Error / False Positive' },
  { value: 'DOCUMENTATION_RECEIVED', label: 'Documentation Received Post-Review' },
  { value: 'POLICY_EXCEPTION', label: 'Policy Exception' },
  { value: 'SELLER_REMEDIATION', label: 'Seller Remediation Plan Accepted' },
  { value: 'REGULATORY_OVERRIDE', label: 'Regulatory Override' },
  { value: 'OTHER', label: 'Other' },
];

const OVERRIDE_PERMISSION_MAP = {
  'risk-analyst': true,
  'admin': true,
  'compliance-officer': true,
  'fraud-investigator': false,
  'executive': false,
};

const OverrideModal = ({ loan, isOpen, onClose }) => {
  const { requestOverride } = useRules();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [reasonCode, setReasonCode] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const reasonSelectRef = useRef(null);
  const justificationRef = useRef(null);
  const isMountedRef = useRef(true);

  const personaId = currentPersona?.id || '';
  const personaLabel = currentPersona?.label || 'Unknown';

  const hasOverridePermission = OVERRIDE_PERMISSION_MAP[personaId] === true;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setReasonCode('');
      setJustification('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (reasonSelectRef.current) {
          reasonSelectRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleReasonCodeChange = useCallback((e) => {
    const value = e.target.value;
    setReasonCode(value);

    if (errors.reasonCode) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.reasonCode;
        return next;
      });
    }
  }, [errors.reasonCode]);

  const handleJustificationChange = useCallback((e) => {
    const value = e.target.value;
    setJustification(value);

    if (errors.justification) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.justification;
        return next;
      });
    }
  }, [errors.justification]);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!reasonCode || reasonCode.trim() === '') {
      newErrors.reasonCode = 'Please select a reason code.';
    }

    if (!justification || justification.trim() === '') {
      newErrors.justification = 'Please provide a justification for the override.';
    } else if (justification.trim().length < 10) {
      newErrors.justification = 'Justification must be at least 10 characters.';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }, [reasonCode, justification]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!loan || !loan.id) {
      warn(COMPONENT_NAME, 'Override submission attempted without valid loan');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = requestOverride(
        loan.id,
        reasonCode,
        justification,
      );

      if (!result.success) {
        if (isMountedRef.current) {
          setErrors({
            submit: result.errors && result.errors.length > 0
              ? result.errors[0].message
              : 'Failed to submit override request. Please try again.',
          });
          setIsSubmitting(false);
        }

        warn(COMPONENT_NAME, 'Override request failed', {
          loanId: loan.id,
          errors: result.errors,
        });

        return;
      }

      logEvent(
        'OVERRIDE_REQUEST',
        'override',
        result.override?.id || loan.id,
        {
          loanId: loan.id,
          reasonCode,
          justification,
          requestedBy: personaLabel,
        },
        personaLabel,
      );

      addNotification(
        'success',
        'Override Request Submitted',
        `Override request for loan ${loan.id} has been submitted for review.`,
        `/loans/${loan.id}`,
      );

      debug(COMPONENT_NAME, 'Override request submitted successfully', {
        loanId: loan.id,
        overrideId: result.override?.id,
        reasonCode,
      });

      if (isMountedRef.current) {
        setIsSubmitting(false);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Override submission threw an unexpected error', err);

      if (isMountedRef.current) {
        setErrors({
          submit: 'An unexpected error occurred. Please try again.',
        });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, loan, reasonCode, justification, requestOverride, logEvent, addNotification, personaLabel, onClose]);

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

  const reasonCodeLabel = OVERRIDE_REASON_CODES.find((rc) => rc.value === reasonCode)?.label || '';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='override-modal-title'
      aria-describedby='override-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='override-modal-title' className='text-lg font-semibold text-gray-900'>
              Request Manual Override
            </h2>
            <p id='override-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Submit an override request for loan {loan?.id || 'Unknown'}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close override modal'
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

        {!hasOverridePermission ? (
          <div className='px-6 py-8 text-center'>
            <div className='mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-red-50 mb-4'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-8 h-8 text-red-500'
              >
                <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                <circle cx='12' cy='16' r='1' />
              </svg>
            </div>
            <h3 className='text-lg font-semibold text-gray-900 mb-2'>Permission Denied</h3>
            <p className='text-sm text-gray-600 max-w-sm mx-auto'>
              Your current persona ({personaLabel}) does not have permission to request overrides.
              Please switch to a persona with override privileges.
            </p>
            <button
              type='button'
              onClick={onClose}
              className='btn-enterprise-secondary mt-6'
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className='px-6 py-5 space-y-5'>
              <div>
                <label
                  htmlFor='override-reason-code'
                  className='block text-sm font-medium text-gray-700 mb-1.5'
                >
                  Reason Code
                  <span className='text-red-500 ml-0.5'>*</span>
                </label>
                <select
                  ref={reasonSelectRef}
                  id='override-reason-code'
                  value={reasonCode}
                  onChange={handleReasonCodeChange}
                  disabled={isSubmitting}
                  className={`input-enterprise ${errors.reasonCode ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  aria-label='Override reason code'
                  aria-describedby={errors.reasonCode ? 'override-reason-error' : undefined}
                  aria-invalid={errors.reasonCode ? 'true' : 'false'}
                >
                  <option value=''>Select a reason code...</option>
                  {OVERRIDE_REASON_CODES.map((rc) => (
                    <option key={rc.value} value={rc.value}>
                      {rc.label}
                    </option>
                  ))}
                </select>
                {errors.reasonCode && (
                  <p id='override-reason-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                    {errors.reasonCode}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor='override-justification'
                  className='block text-sm font-medium text-gray-700 mb-1.5'
                >
                  Justification
                  <span className='text-red-500 ml-0.5'>*</span>
                </label>
                <textarea
                  ref={justificationRef}
                  id='override-justification'
                  value={justification}
                  onChange={handleJustificationChange}
                  disabled={isSubmitting}
                  rows={4}
                  placeholder='Provide a detailed justification for this override request...'
                  className={`input-enterprise resize-none ${errors.justification ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  aria-label='Override justification'
                  aria-describedby={errors.justification ? 'override-justification-error' : undefined}
                  aria-invalid={errors.justification ? 'true' : 'false'}
                  maxLength={2000}
                />
                <div className='flex items-center justify-between mt-1.5'>
                  {errors.justification ? (
                    <p id='override-justification-error' className='text-xs text-red-600 flex items-center gap-1'>
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
                      {errors.justification}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className='text-xs text-gray-400'>
                    {justification.length}/2000
                  </span>
                </div>
              </div>

              {reasonCode && (
                <div className='p-4 rounded-xl bg-amber-50 border border-amber-200'>
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
                        className='w-5 h-5 text-amber-600'
                      >
                        <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                        <line x1='12' y1='9' x2='12' y2='13' />
                        <line x1='12' y1='17' x2='12.01' y2='17' />
                      </svg>
                    </div>
                    <div>
                      <p className='text-sm font-semibold text-amber-800'>
                        Override Request Summary
                      </p>
                      <p className='text-xs text-amber-700 mt-1'>
                        You are requesting an override for loan{' '}
                        <span className='font-mono font-semibold'>{loan?.id || 'Unknown'}</span>{' '}
                        with reason code{' '}
                        <span className='font-semibold'>{reasonCodeLabel}</span>.
                        This request will be logged in the audit trail and may require
                        additional approval before the loan status is updated.
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
                    Submitting...
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
                    Submit Override Request
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

OverrideModal.propTypes = {
  loan: PropTypes.shape({
    id: PropTypes.string,
    borrowerName: PropTypes.string,
    ssn: PropTypes.string,
    propertyAddress: PropTypes.string,
    loanAmount: PropTypes.number,
    productType: PropTypes.string,
    channel: PropTypes.string,
    sellerId: PropTypes.string,
    borrowerAddress: PropTypes.string,
    borrowerIncome: PropTypes.number,
    creditScore: PropTypes.number,
    accountNumber: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    loanPurpose: PropTypes.string,
    ltv: PropTypes.number,
    dti: PropTypes.number,
    status: PropTypes.string,
    decisionResult: PropTypes.object,
    documents: PropTypes.array,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

OverrideModal.defaultProps = {
  loan: null,
};

export default OverrideModal;