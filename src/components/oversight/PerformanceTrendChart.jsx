import { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'PerformanceTrendChart';

const CHART_COLORS = {
  defectRate: '#ef4444',
  remedyClosureRate: '#22c55e',
};

const CHART_LABELS = {
  defectRate: 'Defect Rate',
  remedyClosureRate: 'Remedy Closure Rate',
};

const formatPercentageTick = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return `${Math.round(value * 100)}%`;
};

const formatTooltipValue = (value, name) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  if (name === 'defectRate' || name === 'remedyClosureRate') {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value;
};

const PerformanceTrendChart = ({ trendData, className = '' }) => {
  const chartData = useMemo(() => {
    if (
      !trendData ||
      !Array.isArray(trendData.trendSeries) ||
      trendData.trendSeries.length === 0
    ) {
      return [];
    }

    return trendData.trendSeries.map((point) => {
      if (!point) {
        return {
          month: '',
          defectRate: 0,
          remedyClosureRate: 0,
        };
      }

      const defectRate =
        point.defectCount !== undefined && point.defectCount !== null
          ? point.defectCount
          : 0;

      const remedyClosureRate =
        point.remedyCount !== undefined && point.remedyCount !== null
          ? point.remedyCount
          : 0;

      return {
        month: point.month || '',
        defectRate,
        remedyClosureRate,
      };
    });
  }, [trendData]);

  const trendLabel = useMemo(() => {
    if (!trendData || !trendData.defectRateTrend) {
      return 'stable';
    }
    return trendData.defectRateTrend;
  }, [trendData]);

  const trendColor = useMemo(() => {
    switch (trendLabel) {
      case 'improving':
        return 'text-green-600';
      case 'worsening':
        return 'text-red-600';
      case 'stable':
      default:
        return 'text-gray-500';
    }
  }, [trendLabel]);

  const trendIcon = useMemo(() => {
    switch (trendLabel) {
      case 'improving':
        return (
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
            <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
            <polyline points='17 6 23 6 23 12' />
          </svg>
        );
      case 'worsening':
        return (
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
            <polyline points='23 18 13.5 8.5 8.5 13.5 1 6' />
            <polyline points='17 18 23 18 23 12' />
          </svg>
        );
      case 'stable':
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
            className='w-3.5 h-3.5'
          >
            <line x1='5' y1='12' x2='19' y2='12' />
          </svg>
        );
    }
  }, [trendLabel]);

  if (chartData.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
        <div className='flex items-center justify-center h-64 text-gray-400'>
          <div className='text-center'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-10 h-10 mx-auto mb-2'
            >
              <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
              <polyline points='17 6 23 6 23 12' />
            </svg>
            <p className='text-sm'>No trend data available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-enterprise ${className}`}>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Performance Trends</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Monthly defect rate and remedy closure rate over the trailing 6 months.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}
        >
          {trendIcon}
          {trendLabel.charAt(0).toUpperCase() + trendLabel.slice(1)}
        </span>
      </div>

      <ResponsiveContainer width='100%' height={320}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
          <XAxis
            dataKey='month'
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={formatPercentageTick}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            formatter={formatTooltipValue}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            iconType='circle'
            iconSize={8}
          />
          <Line
            type='monotone'
            dataKey='defectRate'
            stroke={CHART_COLORS.defectRate}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLORS.defectRate, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            name={CHART_LABELS.defectRate}
          />
          <Line
            type='monotone'
            dataKey='remedyClosureRate'
            stroke={CHART_COLORS.remedyClosureRate}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLORS.remedyClosureRate, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            name={CHART_LABELS.remedyClosureRate}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

PerformanceTrendChart.propTypes = {
  trendData: PropTypes.shape({
    defectRateTrend: PropTypes.string,
    defectRateChange: PropTypes.number,
    responseTimeTrend: PropTypes.string,
    responseTimeChange: PropTypes.number,
    exposureTrend: PropTypes.string,
    exposureChange: PropTypes.number,
    trendSeries: PropTypes.arrayOf(
      PropTypes.shape({
        month: PropTypes.string,
        defectCount: PropTypes.number,
        remedyCount: PropTypes.number,
        avgRemedyAge: PropTypes.number,
      }),
    ),
  }),
  className: PropTypes.string,
};

PerformanceTrendChart.defaultProps = {
  trendData: null,
  className: '',
};

export default PerformanceTrendChart;