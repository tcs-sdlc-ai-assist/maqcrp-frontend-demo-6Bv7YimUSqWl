import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'ActionPlanForm';

const VALID_STATUSES = [
  { value: 'notStarted', label: 'Not Started' },
  { value: 'inProgress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_COLORS = {
  notStarted: 'bg-gray-100 text-gray-600 border-gray-200',
  inProgress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
};

const ActionPlanForm = ({
  actionPlan,
  watchlistEntryId,
  counterpartyId,
  onSave,
  onCancel,
}) => {
  const { availablePersonas } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    dueDate: '',
    status: 'notStarted',
    priority: 'medium',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const isEditing = actionPlan && actionPlan.id;

  const safePersonas = Array.isArray(availablePersonas) ? availablePersonas : [];

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isEditing && actionPlan) {
      setFormData({
        title: actionPlan.title || '',
        description: actionPlan.description || '',
        assignee: actionPlan.assignedTo || '',
        dueDate: actionPlan.dueDate || '',
        status: actionPlan.status || 'notStarted',
        priority: actionPlan.priority || 'medium',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assignee: '',
        dueDate: '',
        status: 'notStarted',
        priority: 'medium',
      });
    }

    setErrors({});
    setIsSubmitting(false);

    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 100);
  }, [isEditing, actionPlan]);

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

    if (!formData.title || formData.title.trim() === '') {
      newErrors.title = 'Action plan title is required.';
    }

    if (!formData.description || formData.description.trim() === '') {
      newErrors.description = 'Description is required.';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters.';
    }

    if (!formData.assignee || formData.assignee.trim() === '') {
      newErrors.assignee = 'Please select an assignee.';
    }

    if (!formData.dueDate || formData.dueDate.trim() === '') {
      newErrors.dueDate = 'Due date is required.';
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
      const planData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        assignedTo: formData.assignee,
        dueDate: formData.dueDate,
        status: formData.status,
        priority: formData.priority,
        watchlistEntryId: watchlistEntryId || null,
        counterpartyId: counterpartyId || null,
      };

      if (isMountedRef.current) {
        onSave(planData);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Action plan form submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, watchlistEntryId, counterpartyId, onSave]);

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

  const statusColor = STATUS_COLORS[formData.status] || STATUS_COLORS.notStarted;

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='action-plan-form-title'
      aria-describedby='action-plan-form-description'
    >
      <div className='w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-8 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10'>
          <div>
            <h2 id='action-plan-form-title' className='text-lg font-semibold text-gray-900'>
              {isEditing ? 'Edit Action Plan' : 'Create Action Plan'}
            </h2>
            <p id='action-plan-form-description' className='text-sm text-gray-500 mt-0.5'>
              {isEditing
                ? 'Update the action plan details and status.'
                : 'Define a new action plan for counterparty remediation.'}
            </p>
          </div>

          <button
            type='button'
            onClick={onCancel}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close action plan form'
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
              htmlFor='action-plan-form-title'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Title
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <input
              ref={titleInputRef}
              id='action-plan-form-title'
              type='text'
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              disabled={isSubmitting}
              placeholder='e.g., Monthly QC Review Cadence'
              className={`input-enterprise ${errors.title ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Action plan title'
              aria-describedby={errors.title ? 'action-plan-form-title-error' : undefined}
              aria-invalid={errors.title ? 'true' : 'false'}
            />
            {errors.title && (
              <p
                id='action-plan-form-title-error'
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
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='action-plan-form-description'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Description
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='action-plan-form-description'
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder='Describe the action plan, its objectives, and expected outcomes...'
              className={`input-enterprise resize-none ${errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Action plan description'
              aria-describedby={errors.description ? 'action-plan-form-description-error' : undefined}
              aria-invalid={errors.description ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.description ? (
                <p
                  id='action-plan-form-description-error'
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
                  {errors.description}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{formData.description.length}/2000</span>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='action-plan-form-assignee'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Assignee
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <select
                id='action-plan-form-assignee'
                value={formData.assignee}
                onChange={(e) => handleFieldChange('assignee', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.assignee ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Action plan assignee'
                aria-describedby={errors.assignee ? 'action-plan-form-assignee-error' : undefined}
                aria-invalid={errors.assignee ? 'true' : 'false'}
              >
                <option value=''>Select assignee...</option>
                {safePersonas.map((persona) => (
                  <option key={persona.id} value={persona.label}>
                    {persona.label}
                  </option>
                ))}
              </select>
              {errors.assignee && (
                <p
                  id='action-plan-form-assignee-error'
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
                  {errors.assignee}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='action-plan-form-due-date'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Due Date
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                id='action-plan-form-due-date'
                type='date'
                value={formData.dueDate}
                onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                disabled={isSubmitting}
                className={`input-enterprise ${errors.dueDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Due date'
                aria-describedby={errors.dueDate ? 'action-plan-form-due-date-error' : undefined}
                aria-invalid={errors.dueDate ? 'true' : 'false'}
              />
              {errors.dueDate && (
                <p
                  id='action-plan-form-due-date-error'
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
                  {errors.dueDate}
                </p>
              )}
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='action-plan-form-status'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Status
              </label>
              <select
                id='action-plan-form-status'
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                disabled={isSubmitting}
                className='input-enterprise'
                aria-label='Action plan status'
              >
                {VALID_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor='action-plan-form-priority'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Priority
              </label>
              <select
                id='action-plan-form-priority'
                value={formData.priority}
                onChange={(e) => handleFieldChange('priority', e.target.value)}
                disabled={isSubmitting}
                className='input-enterprise'
                aria-label='Action plan priority'
              >
                <option value='low'>Low</option>
                <option value='medium'>Medium</option>
                <option value='high'>High</option>
                <option value='critical'>Critical</option>
              </select>
            </div>
          </div>

          {formData.title && formData.assignee && (
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
                  <p className='text-sm font-semibold text-blue-800'>Plan Summary</p>
                  <p className='text-xs text-blue-700 mt-1'>
                    Action plan{' '}
                    <span className='font-semibold'>{formData.title}</span>{' '}
                    assigned to{' '}
                    <span className='font-semibold'>{formData.assignee}</span>
                    {formData.dueDate && (
                      <>
                        {' '}with a due date of{' '}
                        <span className='font-semibold'>{formData.dueDate}</span>
                      </>
                    )}
                    . Status:{' '}
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${statusColor}`}
                    >
                      {VALID_STATUSES.find((s) => s.value === formData.status)?.label || formData.status}
                    </span>
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
                {isEditing ? 'Save Changes' : 'Create Action Plan'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

ActionPlanForm.propTypes = {
  actionPlan: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    counterpartyId: PropTypes.string,
    counterpartyName: PropTypes.string,
    watchlistEntryId: PropTypes.string,
    priority: PropTypes.string,
    status: PropTypes.string,
    assignedTo: PropTypes.string,
    dueDate: PropTypes.string,
    steps: PropTypes.array,
    createdBy: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    completedAt: PropTypes.string,
  }),
  watchlistEntryId: PropTypes.string,
  counterpartyId: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ActionPlanForm.defaultProps = {
  actionPlan: null,
  watchlistEntryId: null,
  counterpartyId: null,
};

export default ActionPlanForm;