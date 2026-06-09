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

const COMPONENT_NAME = 'DefectTrendChart';

const CHART_COLORS = {
  totalDefects: '#4c6ef5',
  critical: '#ef4444',
  major: '#f97316',
  minor: '#3b82f6',
  observation: '#6b7280',
};

const CHART_LABELS = {
  totalDefects: 'Total Defects',
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
};

const DefectTrendChart = ({ trendData, className = '' }) => {
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
          totalDefects: 0,
          critical: 0,
          major: 0,
          minor: 0,
          observation: 0,
        };
      }

      return {
        month: point.month || '',
        totalDefects: point.totalDefects ?? point.defectCount ?? 0,
        critical: point.critical ?? 0,
        major: point.major ?? 0,
        minor: point.minor ?? 0,
        observation: point.observation ?? 0,
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

  const hasSeverityBreakdown = useMemo(() => {
    if (chartData.length === 0) return false;

    for (const point of chartData) {
      if (
        (point.critical || 0) > 0 ||
        (point.major || 0) > 0 ||
        (point.minor || 0) > 0 ||
        (point.observation || 0) > 0
      ) {
        return true;
      }
    }

    return false;
  }, [chartData]);

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
          <h2 className='text-lg font-semibold text-gray-900'>Defect Trends</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Monthly defect counts over the trailing 6 months.
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            iconType='circle'
            iconSize={8}
          />
          <Line
            type='monotone'
            dataKey='totalDefects'
            stroke={CHART_COLORS.totalDefects}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLORS.totalDefects, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            name={CHART_LABELS.totalDefects}
          />
          {hasSeverityBreakdown && (
            <>
              <Line
                type='monotone'
                dataKey='critical'
                stroke={CHART_COLORS.critical}
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={{ r: 3, fill: CHART_COLORS.critical, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                name={CHART_LABELS.critical}
              />
              <Line
                type='monotone'
                dataKey='major'
                stroke={CHART_COLORS.major}
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={{ r: 3, fill: CHART_COLORS.major, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                name={CHART_LABELS.major}
              />
              <Line
                type='monotone'
                dataKey='minor'
                stroke={CHART_COLORS.minor}
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={{ r: 3, fill: CHART_COLORS.minor, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                name={CHART_LABELS.minor}
              />
              <Line
                type='monotone'
                dataKey='observation'
                stroke={CHART_COLORS.observation}
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={{ r: 3, fill: CHART_COLORS.observation, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                name={CHART_LABELS.observation}
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

DefectTrendChart.propTypes = {
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
        totalDefects: PropTypes.number,
        critical: PropTypes.number,
        major: PropTypes.number,
        minor: PropTypes.number,
        observation: PropTypes.number,
        remedyCount: PropTypes.number,
        avgRemedyAge: PropTypes.number,
      }),
    ),
  }),
  className: PropTypes.string,
};

DefectTrendChart.defaultProps = {
  trendData: null,
  className: '',
};

export default DefectTrendChart;