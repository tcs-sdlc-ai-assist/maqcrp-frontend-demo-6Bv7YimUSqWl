import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { formatDate, isDateBreached, getAgingBucket } from '../../utils/dateUtils';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'SLAIndicator';

const DAYS_UNTIL_DUE_SOON = 3;

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SLAIndicator = ({ dueDate, severity, escalationLevel, className = '' }) => {
  const safeDueDate = dueDate && typeof dueDate === 'string' ? dueDate : null;
  const safeSeverity = severity && typeof severity === 'string' ? severity : 'medium';
  const safeEscalationLevel =
    escalationLevel !== undefined && escalationLevel !== null && typeof escalationLevel === 'number'
      ? escalationLevel
      : 0;

  const severityLabel = SEVERITY_LABELS[safeSeverity] || safeSeverity || 'Medium';
  const severityColor = SEVERITY_COLORS[safeSeverity] || SEVERITY_COLORS.medium;

  const slaStatus = useMemo(() => {
    if (!safeDueDate) {
      return { status: 'unknown', label: 'No Due Date', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    }

    const dueDateObj = new Date(safeDueDate);

    if (isNaN(dueDateObj.getTime())) {
      return { status: 'unknown', label: 'Invalid Date', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    }

    const breached = isDateBreached(dueDateObj);

    if (breached) {
      return {
        status: 'breached',
        label: 'Breached',
        color: 'bg-red-100 text-red-700 border-red-200',
      };
    }

    const now = new Date();
    const diffMs = dueDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= DAYS_UNTIL_DUE_SOON) {
      return {
        status: 'due_soon',
        label: 'Due Soon',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
      };
    }

    return {
      status: 'on_track',
      label: 'On Track',
      color: 'bg-green-100 text-green-700 border-green-200',
    };
  }, [safeDueDate]);

  const daysRemaining = useMemo(() => {
    if (!safeDueDate) {
      return null;
    }

    const dueDateObj = new Date(safeDueDate);

    if (isNaN(dueDateObj.getTime())) {
      return null;
    }

    const now = new Date();
    const diffMs = dueDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }, [safeDueDate]);

  const agingBucket = useMemo(() => {
    if (!safeDueDate) {
      return null;
    }

    const dueDateObj = new Date(safeDueDate);

    if (isNaN(dueDateObj.getTime())) {
      return null;
    }

    return getAgingBucket(dueDateObj);
  }, [safeDueDate]);

  const formattedDueDate = useMemo(() => {
    if (!safeDueDate) {
      return '—';
    }

    const dueDateObj = new Date(safeDueDate);

    if (isNaN(dueDateObj.getTime())) {
      return '—';
    }

    return formatDate(dueDateObj, 'MMM d, yyyy');
  }, [safeDueDate]);

  const daysLabel = useMemo(() => {
    if (daysRemaining === null) {
      return '';
    }

    if (daysRemaining > 0) {
      return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
    }

    if (daysRemaining === 0) {
      return 'Due today';
    }

    const overdueDays = Math.abs(daysRemaining);
    return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
  }, [daysRemaining]);

  const progressPercentage = useMemo(() => {
    if (!safeDueDate) {
      return 0;
    }

    const dueDateObj = new Date(safeDueDate);

    if (isNaN(dueDateObj.getTime())) {
      return 0;
    }

    const now = new Date();
    const totalMs = dueDateObj.getTime() - now.getTime();

    if (totalMs <= 0) {
      return 100;
    }

    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));

    if (totalDays <= 0) {
      return 100;
    }

    const elapsedDays = Math.max(0, totalDays - daysRemaining);
    const percentage = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    return percentage;
  }, [safeDueDate, daysRemaining]);

  const progressBarColor = useMemo(() => {
    switch (slaStatus.status) {
      case 'breached':
        return 'bg-red-500';
      case 'due_soon':
        return 'bg-amber-500';
      case 'on_track':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  }, [slaStatus.status]);

  const statusIcon = useMemo(() => {
    switch (slaStatus.status) {
      case 'breached':
        return (
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
        );
      case 'due_soon':
        return (
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
        );
      case 'on_track':
        return (
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
        );
      default:
        return (
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
            <line x1='12' y1='8' x2='12' y2='12' />
            <line x1='12' y1='16' x2='12.01' y2='16' />
          </svg>
        );
    }
  }, [slaStatus.status]);

  if (!safeDueDate) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200'>
          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400'>
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
              <circle cx='12' cy='12' r='10' />
              <line x1='12' y1='8' x2='12' y2='12' />
              <line x1='12' y1='16' x2='12.01' y2='16' />
            </svg>
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium text-gray-500'>No Due Date</p>
            <p className='text-xs text-gray-400'>SLA deadline has not been set.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-200 ${slaStatus.color}`}
      >
        <div className='flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/60'>
          {statusIcon}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-0.5'>
            <span className='text-sm font-semibold'>{slaStatus.label}</span>
            <span className='text-xs opacity-75'>•</span>
            <span className='text-xs font-medium'>{formattedDueDate}</span>
          </div>

          <div className='flex items-center gap-2'>
            <span className='text-xs opacity-80'>{daysLabel}</span>
            {agingBucket && slaStatus.status === 'breached' && (
              <span className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-red-200/50 text-red-800'>
                {agingBucket}
              </span>
            )}
          </div>

          <div className='mt-2 w-full bg-white/40 rounded-full h-1.5 overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className='flex-shrink-0 flex flex-col items-center gap-1'>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium border ${severityColor}`}
          >
            {severityLabel}
          </span>

          {safeEscalationLevel > 0 && (
            <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-2xs font-bold'>
              {safeEscalationLevel}
            </span>
          )}
        </div>
      </div>

      {slaStatus.status === 'breached' && (
        <div className='flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 animate-fade-in'>
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
            <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
            <line x1='12' y1='9' x2='12' y2='13' />
            <line x1='12' y1='17' x2='12.01' y2='17' />
          </svg>
          <div className='flex-1 min-w-0'>
            <p className='text-xs font-semibold text-red-800'>SLA Breached</p>
            <p className='text-xs text-red-600 mt-0.5'>
              {safeEscalationLevel > 0
                ? `This case has been escalated to level ${safeEscalationLevel}. Immediate action is required.`
                : 'This case has exceeded its SLA deadline. Immediate action is required.'}
            </p>
          </div>
        </div>
      )}

      {slaStatus.status === 'due_soon' && (
        <div className='flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 animate-fade-in'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5'
          >
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
          <div className='flex-1 min-w-0'>
            <p className='text-xs font-semibold text-amber-800'>Due Soon</p>
            <p className='text-xs text-amber-600 mt-0.5'>
              {daysRemaining !== null && daysRemaining > 0
                ? `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining until the SLA deadline.`
                : 'The SLA deadline is approaching. Please take action promptly.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

SLAIndicator.propTypes = {
  dueDate: PropTypes.string,
  severity: PropTypes.string,
  escalationLevel: PropTypes.number,
  className: PropTypes.string,
};

SLAIndicator.defaultProps = {
  dueDate: null,
  severity: 'medium',
  escalationLevel: 0,
  className: '',
};

export default SLAIndicator;