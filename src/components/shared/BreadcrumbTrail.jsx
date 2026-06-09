import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'BreadcrumbTrail';

const BreadcrumbTrail = ({ items, className = '' }) => {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (path, index, isLast) => {
      if (isLast) {
        return;
      }

      if (!path || typeof path !== 'string') {
        debug(COMPONENT_NAME, 'Breadcrumb click ignored: invalid path', { path, index });
        return;
      }

      debug(COMPONENT_NAME, 'Breadcrumb clicked', { path, index });
      navigate(path);
    },
    [navigate],
  );

  const handleKeyDown = useCallback(
    (e, path, index, isLast) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(path, index, isLast);
      }
    },
    [handleClick],
  );

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label='Breadcrumb' className={`flex items-center ${className}`}>
      <ol className='flex items-center flex-wrap gap-1 text-sm'>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = !isLast && item.path && typeof item.path === 'string';

          return (
            <li key={item.path || item.label || index} className='flex items-center gap-1'>
              {isClickable ? (
                <button
                  type='button'
                  onClick={() => handleClick(item.path, index, false)}
                  onKeyDown={(e) => handleKeyDown(e, item.path, index, false)}
                  className='text-gray-500 hover:text-enterprise-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 rounded px-1 py-0.5'
                  aria-label={`Navigate to ${item.label}`}
                  tabIndex={0}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={`font-semibold ${
                    isLast ? 'text-gray-900' : 'text-gray-400'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}

              {!isLast && (
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 text-gray-300 flex-shrink-0'
                  aria-hidden='true'
                >
                  <polyline points='9 18 15 12 9 6' />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

BreadcrumbTrail.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      path: PropTypes.string,
    }),
  ).isRequired,
  className: PropTypes.string,
};

BreadcrumbTrail.defaultProps = {
  className: '',
};

export default BreadcrumbTrail;