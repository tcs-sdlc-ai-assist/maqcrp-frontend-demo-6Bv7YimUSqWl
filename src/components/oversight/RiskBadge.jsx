import PropTypes from 'prop-types';

const RISK_TIER_CONFIG = {
  critical: {
    label: 'Critical',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: (
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
        <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
        <line x1='12' y1='9' x2='12' y2='13' />
        <line x1='12' y1='17' x2='12.01' y2='17' />
      </svg>
    ),
  },
  high: {
    label: 'High',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: (
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
        <circle cx='12' cy='12' r='10' />
        <line x1='12' y1='8' x2='12' y2='12' />
        <line x1='12' y1='16' x2='12.01' y2='16' />
      </svg>
    ),
  },
  moderate: {
    label: 'Moderate',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: (
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
        <circle cx='12' cy='12' r='10' />
        <polyline points='12 6 12 12 16 14' />
      </svg>
    ),
  },
  low: {
    label: 'Low',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: (
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
        <polyline points='20 6 9 17 4 12' />
      </svg>
    ),
  },
  unknown: {
    label: 'Unknown',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: (
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
        <circle cx='12' cy='12' r='10' />
        <line x1='12' y1='8' x2='12' y2='12' />
        <line x1='12' y1='16' x2='12.01' y2='16' />
      </svg>
    ),
  },
};

const RiskBadge = ({ tier, showIcon = true, className = '' }) => {
  const safeTier = tier && typeof tier === 'string' ? tier.toLowerCase() : 'unknown';
  const config = RISK_TIER_CONFIG[safeTier] || RISK_TIER_CONFIG.unknown;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} ${className}`}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
};

RiskBadge.propTypes = {
  tier: PropTypes.string,
  showIcon: PropTypes.bool,
  className: PropTypes.string,
};

RiskBadge.defaultProps = {
  tier: 'unknown',
  showIcon: true,
  className: '',
};

export default RiskBadge;