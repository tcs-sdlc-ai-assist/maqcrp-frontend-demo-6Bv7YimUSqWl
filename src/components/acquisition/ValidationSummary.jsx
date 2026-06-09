import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'ValidationSummary';

const STATUS_CATEGORIES = [
  {
    key: 'total',
    label: 'Total Processed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    icon: (
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
        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
        <polyline points='14 2 14 8 20 8' />
        <line x1='16' y1='13' x2='8' y2='13' />
        <line x1='16' y1='17' x2='8' y2='17' />
        <polyline points='10 9 9 9 8 9' />
      </svg>
    ),
  },
  {
    key: 'passed',
    label: 'Passed Validation',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    icon: (
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
    ),
  },
  {
    key: 'failed',
    label: 'Failed Validation',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    icon: (
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
    ),
  },
  {
    key: 'exception',
    label: 'Routed to Exception',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    icon: (
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
        <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
        <line x1='12' y1='9' x2='12' y2='13' />
        <line x1='12' y1='17' x2='12.01' y2='17' />
      </svg>
    ),
  },
];

const ValidationSummary = ({ stats, errorDetails, onDismiss }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const safeStats = useMemo(() => {
    if (!stats || typeof stats !== 'object') {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        exception: 0,
      };
    }

    return {
      total: typeof stats.total === 'number' ? stats.total : 0,
      passed: typeof stats.passed === 'number' ? stats.passed : 0,
      failed: typeof stats.failed === 'number' ? stats.failed : 0,
      exception: typeof stats.exception === 'number' ? stats.exception : 0,
    };
  }, [stats]);

  const safeErrorDetails = useMemo(() => {
    if (!Array.isArray(errorDetails)) {
      return [];
    }
    return errorDetails;
  }, [errorDetails]);

  const hasErrors = safeStats.failed > 0 || safeStats.exception > 0;
  const hasData = safeStats.total > 0;

  const handleToggleCategory = useCallback(
    (categoryKey) => {
      setExpandedCategory((prev) => (prev === categoryKey ? null : categoryKey));
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e, categoryKey) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleCategory(categoryKey);
      }
    },
    [handleToggleCategory],
  );

  const getCategoryDetails = useCallback(
    (categoryKey) => {
      if (categoryKey === 'failed') {
        return safeErrorDetails.filter(
          (detail) =>
            detail &&
            Array.isArray(detail.errors) &&
            detail.errors.length > 0,
        );
      }

      if (categoryKey === 'exception') {
        return safeErrorDetails.filter(
          (detail) =>
            detail &&
            Array.isArray(detail.errors) &&
            detail.errors.some(
              (err) => err && (err.code === 'DEPENDENCY_VIOLATION' || err.code === 'REFERENCE_NOT_FOUND'),
            ),
        );
      }

      return [];
    },
    [safeErrorDetails],
  );

  if (!hasData) {
    return null;
  }

  return (
    <div className='card-enterprise animate-fade-in'>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Validation Results</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Summary of the loan file validation process.
          </p>
        </div>

        {typeof onDismiss === 'function' && (
          <button
            type='button'
            onClick={onDismiss}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
            aria-label='Dismiss validation results'
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
            Dismiss
          </button>
        )}
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6'>
        {STATUS_CATEGORIES.map((category) => {
          const count = safeStats[category.key] || 0;
          const isExpanded = expandedCategory === category.key;
          const categoryDetails = getCategoryDetails(category.key);
          const hasDetails = categoryDetails.length > 0;
          const isInteractive = hasDetails;

          return (
            <div key={category.key}>
              <button
                type='button'
                onClick={() => {
                  if (isInteractive) {
                    handleToggleCategory(category.key);
                  }
                }}
                onKeyDown={(e) => {
                  if (isInteractive) {
                    handleKeyDown(e, category.key);
                  }
                }}
                disabled={!isInteractive}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left
                  ${category.borderColor} ${category.bgColor}
                  ${isInteractive ? 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1' : 'cursor-default'}
                  ${isExpanded ? 'ring-2 ring-enterprise-500 shadow-md' : ''}
                `}
                aria-label={`${category.label}: ${count} records${isInteractive ? '. Click to expand details.' : ''}`}
                aria-expanded={isInteractive ? isExpanded : undefined}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${category.iconBg} ${category.iconColor}`}
                >
                  {category.icon}
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider truncate'>
                    {category.label}
                  </p>
                  <p className={`text-2xl font-bold ${category.color}`}>{count}</p>
                </div>
                {isInteractive && (
                  <div className='flex-shrink-0'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      <polyline points='6 9 12 15 18 9' />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {hasErrors && (
        <div className='p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4'>
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
                {safeStats.failed > 0 && safeStats.exception > 0
                  ? `${safeStats.failed} record(s) failed validation and ${safeStats.exception} record(s) were routed to the exception queue.`
                  : safeStats.failed > 0
                    ? `${safeStats.failed} record(s) failed validation.`
                    : `${safeStats.exception} record(s) were routed to the exception queue.`}
              </p>
              <p className='text-xs text-amber-600 mt-1'>
                Expand the categories above to review detailed error information for each record.
              </p>
            </div>
          </div>
        </div>
      )}

      {expandedCategory && (
        <div className='border border-gray-200 rounded-xl overflow-hidden animate-fade-in'>
          <div className='px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-gray-700'>
              {STATUS_CATEGORIES.find((c) => c.key === expandedCategory)?.label || 'Details'}
            </h3>
            <button
              type='button'
              onClick={() => setExpandedCategory(null)}
              className='p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
              aria-label='Close details panel'
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
          </div>

          <div className='divide-y divide-gray-100 max-h-96 overflow-y-auto'>
            {getCategoryDetails(expandedCategory).length === 0 ? (
              <div className='px-4 py-8 text-center'>
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
                  <line x1='12' y1='16' x2='12' y2='12' />
                  <line x1='12' y1='8' x2='12.01' y2='8' />
                </svg>
                <p className='text-sm text-gray-500'>No detailed records available for this category.</p>
              </div>
            ) : (
              getCategoryDetails(expandedCategory).map((detail, idx) => {
                if (!detail || !Array.isArray(detail.errors) || detail.errors.length === 0) {
                  return null;
                }

                return (
                  <div key={idx} className='px-4 py-3 hover:bg-gray-50/50 transition-colors duration-150'>
                    <div className='flex items-center gap-2 mb-2'>
                      <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-bold'>
                        {idx + 1}
                      </span>
                      <span className='text-sm font-medium text-gray-700'>
                        Record #{detail.index || idx + 1}
                      </span>
                      {detail.data && detail.data.borrowerName && (
                        <span className='text-xs text-gray-400 truncate max-w-[200px]'>
                          {detail.data.borrowerName}
                        </span>
                      )}
                    </div>

                    <ul className='space-y-1.5 ml-8'>
                      {detail.errors.map((err, errIdx) => {
                        if (!err) return null;

                        const isDependency =
                          err.code === 'DEPENDENCY_VIOLATION' || err.code === 'REFERENCE_NOT_FOUND';
                        const isCritical = err.code === 'REQUIRED';

                        return (
                          <li
                            key={errIdx}
                            className={`flex items-start gap-2 text-sm ${
                              isCritical
                                ? 'text-red-600'
                                : isDependency
                                  ? 'text-amber-600'
                                  : 'text-red-500'
                            }`}
                          >
                            <span className='flex-shrink-0 mt-1.5'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth={2}
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                className='w-3 h-3'
                              >
                                <circle cx='12' cy='12' r='10' />
                                <line x1='15' y1='9' x2='9' y2='15' />
                                <line x1='9' y1='9' x2='15' y2='15' />
                              </svg>
                            </span>
                            <div className='flex-1 min-w-0'>
                              {err.field && (
                                <span className='inline-block font-mono text-xs bg-red-50 border border-red-100 px-1.5 py-0.5 rounded mr-1.5 mb-0.5'>
                                  {err.field}
                                </span>
                              )}
                              <span className='text-gray-700'>{err.message}</span>
                              {err.code && (
                                <span className='ml-1.5 text-xs text-gray-400 font-mono'>
                                  [{err.code}]
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {detail.data && (
                      <div className='ml-8 mt-2'>
                        <button
                          type='button'
                          className='text-xs text-enterprise-600 hover:text-enterprise-700 font-medium focus:outline-none focus:underline'
                          onClick={() => {
                            debug(COMPONENT_NAME, 'Record data preview requested', {
                              recordIndex: detail.index,
                            });
                          }}
                        >
                          View record data
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {!hasErrors && safeStats.total > 0 && (
        <div className='p-4 bg-green-50 border border-green-200 rounded-xl'>
          <div className='flex items-center gap-3'>
            <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600'>
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
            </div>
            <div>
              <p className='text-sm font-semibold text-green-800'>
                All {safeStats.total} record(s) passed validation successfully.
              </p>
              <p className='text-xs text-green-600 mt-0.5'>
                No errors or exceptions were detected during the validation process.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ValidationSummary.propTypes = {
  stats: PropTypes.shape({
    total: PropTypes.number,
    passed: PropTypes.number,
    failed: PropTypes.number,
    exception: PropTypes.number,
  }),
  errorDetails: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.number,
      errors: PropTypes.arrayOf(
        PropTypes.shape({
          field: PropTypes.string,
          code: PropTypes.string,
          message: PropTypes.string,
        }),
      ),
      data: PropTypes.object,
    }),
  ),
  onDismiss: PropTypes.func,
};

ValidationSummary.defaultProps = {
  stats: null,
  errorDetails: [],
  onDismiss: null,
};

export default ValidationSummary;