import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'KpiCardGrid';

const TREND_ICONS = {
  up: (
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
      <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
      <polyline points='17 6 23 6 23 12' />
    </svg>
  ),
  down: (
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
      <polyline points='23 18 13.5 8.5 8.5 13.5 1 6' />
      <polyline points='17 18 23 18 23 12' />
    </svg>
  ),
  neutral: (
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
      <line x1='5' y1='12' x2='19' y2='12' />
    </svg>
  ),
};

const TREND_COLORS = {
  up: 'text-green-600 bg-green-50 border-green-200',
  down: 'text-red-600 bg-red-50 border-red-200',
  neutral: 'text-gray-500 bg-gray-50 border-gray-200',
};

const TREND_LABELS = {
  up: 'Up',
  down: 'Down',
  neutral: 'Flat',
};

const DEFAULT_ICONS = {
  totalLoans: (
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
  defectRate: (
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
  passRate: (
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
  exposure: (
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
      <line x1='12' y1='1' x2='12' y2='23' />
      <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
    </svg>
  ),
  watchlist: (
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
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  ),
  counterparties: (
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
      <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
  ),
  alerts: (
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
      <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
      <path d='M13.73 21a2 2 0 0 1-3.46 0' />
    </svg>
  ),
  remedies: (
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
      <path d='M12 20h9' />
      <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
    </svg>
  ),
  slaBreach: (
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
  default: (
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
      <rect x='3' y='3' width='7' height='7' />
      <rect x='14' y='3' width='7' height='7' />
      <rect x='14' y='14' width='7' height='7' />
      <rect x='3' y='14' width='7' height='7' />
    </svg>
  ),
};

const ICON_BG_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-amber-100 text-amber-600',
  'bg-red-100 text-red-600',
  'bg-purple-100 text-purple-600',
  'bg-teal-100 text-teal-600',
];

const CARD_BG_COLORS = [
  'bg-blue-50 border-blue-200',
  'bg-green-50 border-green-200',
  'bg-amber-50 border-amber-200',
  'bg-red-50 border-red-200',
  'bg-purple-50 border-purple-200',
  'bg-teal-50 border-teal-200',
];

const KpiCard = ({ metric, index, onCardClick }) => {
  const navigate = useNavigate();

  const safeMetric = metric && typeof metric === 'object' ? metric : null;

  const trendDirection = useMemo(() => {
    if (!safeMetric || safeMetric.trend === undefined || safeMetric.trend === null) {
      return 'neutral';
    }

    if (typeof safeMetric.trend === 'number') {
      if (safeMetric.trend > 0) return 'up';
      if (safeMetric.trend < 0) return 'down';
      return 'neutral';
    }

    if (typeof safeMetric.trend === 'string') {
      const lower = safeMetric.trend.toLowerCase();
      if (lower === 'up' || lower === 'improving' || lower === 'positive') return 'up';
      if (lower === 'down' || lower === 'worsening' || lower === 'negative') return 'down';
      return 'neutral';
    }

    return 'neutral';
  }, [safeMetric]);

  const trendColor = TREND_COLORS[trendDirection] || TREND_COLORS.neutral;
  const trendIcon = TREND_ICONS[trendDirection] || TREND_ICONS.neutral;
  const trendLabel = TREND_LABELS[trendDirection] || TREND_LABELS.neutral;

  const trendDisplayValue = useMemo(() => {
    if (!safeMetric || safeMetric.trend === undefined || safeMetric.trend === null) {
      return null;
    }

    if (typeof safeMetric.trend === 'number') {
      const absValue = Math.abs(safeMetric.trend);
      const formatted = Number.isInteger(safeMetric.trend)
        ? absValue.toString()
        : absValue.toFixed(1);
      return `${formatted}%`;
    }

    if (typeof safeMetric.trend === 'string') {
      const numericMatch = safeMetric.trend.match(/-?\d+(\.\d+)?/);
      if (numericMatch) {
        const num = parseFloat(numericMatch[0]);
        const absValue = Math.abs(num);
        const formatted = Number.isInteger(num) ? absValue.toString() : absValue.toFixed(1);
        return `${formatted}%`;
      }
    }

    return null;
  }, [safeMetric]);

  const iconKey = safeMetric?.iconKey || 'default';
  const icon = DEFAULT_ICONS[iconKey] || DEFAULT_ICONS.default;

  const safeIndex = typeof index === 'number' && index >= 0 ? index : 0;
  const iconBgColor = ICON_BG_COLORS[safeIndex % ICON_BG_COLORS.length];
  const cardBgColor = CARD_BG_COLORS[safeIndex % CARD_BG_COLORS.length];

  const isClickable =
    safeMetric &&
    safeMetric.drillDownPath &&
    typeof safeMetric.drillDownPath === 'string';

  const handleClick = useCallback(() => {
    if (!isClickable || !safeMetric || !safeMetric.drillDownPath) {
      return;
    }

    debug(COMPONENT_NAME, 'KPI card clicked', {
      title: safeMetric.title,
      drillDownPath: safeMetric.drillDownPath,
    });

    if (typeof onCardClick === 'function') {
      onCardClick(safeMetric);
    } else {
      navigate(safeMetric.drillDownPath);
    }
  }, [isClickable, safeMetric, onCardClick, navigate]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  if (!safeMetric) {
    return (
      <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
        <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400'>
          {DEFAULT_ICONS.default}
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider truncate'>
            No Data
          </p>
          <p className='text-xl font-bold text-gray-400'>—</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${cardBgColor} ${
        isClickable
          ? 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1'
          : ''
      }`}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={
        isClickable
          ? `${safeMetric.title || 'Metric'}: ${safeMetric.value ?? '—'}. Click to drill down.`
          : `${safeMetric.title || 'Metric'}: ${safeMetric.value ?? '—'}`
      }
    >
      <div
        className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${iconBgColor}`}
      >
        {icon}
      </div>

      <div className='flex-1 min-w-0'>
        <p className='text-xs font-medium text-gray-500 uppercase tracking-wider truncate'>
          {safeMetric.title || 'Metric'}
        </p>

        <div className='flex items-baseline gap-2 mt-0.5'>
          <p className='text-xl font-bold text-gray-900'>
            {safeMetric.value !== undefined && safeMetric.value !== null
              ? safeMetric.value
              : '—'}
          </p>

          {trendDisplayValue && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-medium border ${trendColor}`}
            >
              {trendIcon}
              {trendDisplayValue}
            </span>
          )}
        </div>

        {safeMetric.sublabel && (
          <p className='text-xs text-gray-500 mt-0.5 truncate'>
            {safeMetric.sublabel}
          </p>
        )}
      </div>

      {isClickable && (
        <div className='flex-shrink-0 text-gray-400'>
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
            <polyline points='9 18 15 12 9 6' />
          </svg>
        </div>
      )}
    </div>
  );
};

KpiCard.propTypes = {
  metric: PropTypes.shape({
    title: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    trend: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    drillDownPath: PropTypes.string,
    sublabel: PropTypes.string,
    iconKey: PropTypes.string,
  }),
  index: PropTypes.number,
  onCardClick: PropTypes.func,
};

KpiCard.defaultProps = {
  metric: null,
  index: 0,
  onCardClick: null,
};

const KpiCardGrid = ({ metrics, onCardClick, className = '' }) => {
  const safeMetrics = useMemo(() => {
    if (!Array.isArray(metrics)) {
      return [];
    }
    return metrics;
  }, [metrics]);

  if (safeMetrics.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
        <div className='text-center py-8'>
          <div className='mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 mb-3'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-6 h-6 text-gray-400'
            >
              <rect x='3' y='3' width='7' height='7' />
              <rect x='14' y='3' width='7' height='7' />
              <rect x='14' y='14' width='7' height='7' />
              <rect x='3' y='14' width='7' height='7' />
            </svg>
          </div>
          <p className='text-sm text-gray-500'>No KPI metrics available.</p>
        </div>
      </div>
    );
  }

  const gridCols =
    safeMetrics.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : safeMetrics.length <= 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : safeMetrics.length <= 4
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <div className={`grid ${gridCols} gap-4 ${className}`}>
      {safeMetrics.map((metric, index) => (
        <KpiCard
          key={metric?.title || metric?.iconKey || index}
          metric={metric}
          index={index}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
};

KpiCardGrid.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      trend: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      drillDownPath: PropTypes.string,
      sublabel: PropTypes.string,
      iconKey: PropTypes.string,
    }),
  ),
  onCardClick: PropTypes.func,
  className: PropTypes.string,
};

KpiCardGrid.defaultProps = {
  metrics: [],
  onCardClick: null,
  className: '',
};

export default KpiCardGrid;