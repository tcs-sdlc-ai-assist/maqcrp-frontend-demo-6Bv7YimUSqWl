import { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'PeerComparisonChart';

const CHART_COLORS = {
  counterparty: '#4c6ef5',
  peer: '#94a3b8',
};

const METRIC_LABELS = {
  defectRate: 'Defect Rate',
  criticalDefectRate: 'Critical Defect Rate',
  responseDays: 'Response Days',
  passRate: 'Pass Rate',
};

const formatMetricValue = (value, metric) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  if (metric === 'defectRate' || metric === 'criticalDefectRate' || metric === 'passRate') {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (metric === 'responseDays') {
    return `${value.toFixed(1)} days`;
  }

  return value;
};

const formatTooltipValue = (value, name) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  if (name === 'counterparty') {
    return value;
  }

  if (name === 'peer') {
    return value;
  }

  return value;
};

const PeerComparisonChart = ({ comparisonData, peerComparison, className = '' }) => {
  const chartData = useMemo(() => {
    if (!peerComparison || peerComparison.peerCount === 0) {
      return [];
    }

    const data = [];

    const counterpartyDefectRate = comparisonData
      ? Math.round((peerComparison.peerAvgDefectRate + (comparisonData.defectRateDelta || 0)) * 10000) / 100
      : 0;

    const counterpartyCriticalDefectRate = comparisonData
      ? Math.round((peerComparison.peerAvgCriticalDefectRate + (comparisonData.criticalDefectRateDelta || 0)) * 10000) / 100
      : 0;

    const counterpartyResponseDays = comparisonData
      ? Math.round((peerComparison.peerAvgResponseDays + (comparisonData.responseDaysDelta || 0)) * 10) / 10
      : 0;

    const counterpartyPassRate = comparisonData
      ? Math.round((peerComparison.peerAvgPassRate + (comparisonData.passRateDelta || 0)) * 10000) / 100
      : 0;

    data.push({
      name: 'Defect Rate',
      metric: 'defectRate',
      counterparty: counterpartyDefectRate,
      peer: Math.round(peerComparison.peerAvgDefectRate * 10000) / 100,
    });

    data.push({
      name: 'Critical Defect Rate',
      metric: 'criticalDefectRate',
      counterparty: counterpartyCriticalDefectRate,
      peer: Math.round(peerComparison.peerAvgCriticalDefectRate * 10000) / 100,
    });

    data.push({
      name: 'Response Days',
      metric: 'responseDays',
      counterparty: counterpartyResponseDays,
      peer: peerComparison.peerAvgResponseDays,
    });

    data.push({
      name: 'Pass Rate',
      metric: 'passRate',
      counterparty: counterpartyPassRate,
      peer: Math.round(peerComparison.peerAvgPassRate * 10000) / 100,
    });

    return data;
  }, [comparisonData, peerComparison]);

  if (!peerComparison || peerComparison.peerCount === 0) {
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
              <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
              <circle cx='9' cy='7' r='4' />
              <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
              <path d='M16 3.13a4 4 0 0 1 0 7.75' />
            </svg>
            <p className='text-sm'>Insufficient peer data for comparison.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-enterprise ${className}`}>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Peer Comparison</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Counterparty metrics compared against peer group averages ({peerComparison.peerCount} peers).
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-xs text-gray-400'>
            Percentile: {peerComparison.percentileRank}%
          </span>
        </div>
      </div>

      <ResponsiveContainer width='100%' height={320}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          barCategoryGap='20%'
        >
          <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
          <XAxis
            dataKey='name'
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value) => {
              if (value === null || value === undefined || isNaN(value)) {
                return '';
              }
              if (value < 1 && value >= 0) {
                return `${Math.round(value * 100)}%`;
              }
              return value;
            }}
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
            labelFormatter={(label) => label}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            iconType='circle'
            iconSize={8}
          />
          <Bar
            dataKey='peer'
            fill={CHART_COLORS.peer}
            name='Peer Average'
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey='counterparty'
            fill={CHART_COLORS.counterparty}
            name='This Counterparty'
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>

      {comparisonData && (
        <div className='mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3'>
            Comparison Summary
          </span>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div className='flex items-center gap-2'>
              <span
                className={`flex-shrink-0 ${
                  comparisonData.defectRateComparison === 'better'
                    ? 'text-green-600'
                    : comparisonData.defectRateComparison === 'worse'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {comparisonData.defectRateComparison === 'better' ? (
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
                ) : comparisonData.defectRateComparison === 'worse' ? (
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
                ) : (
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
                )}
              </span>
              <span className='text-xs text-gray-600'>
                Defect Rate:{' '}
                {comparisonData.defectRateComparison === 'better'
                  ? 'Better than peers'
                  : comparisonData.defectRateComparison === 'worse'
                    ? 'Worse than peers'
                    : 'In line with peers'}
              </span>
            </div>

            <div className='flex items-center gap-2'>
              <span
                className={`flex-shrink-0 ${
                  comparisonData.criticalDefectRateComparison === 'better'
                    ? 'text-green-600'
                    : comparisonData.criticalDefectRateComparison === 'worse'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {comparisonData.criticalDefectRateComparison === 'better' ? (
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
                ) : comparisonData.criticalDefectRateComparison === 'worse' ? (
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
                ) : (
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
                )}
              </span>
              <span className='text-xs text-gray-600'>
                Critical Defect Rate:{' '}
                {comparisonData.criticalDefectRateComparison === 'better'
                  ? 'Better than peers'
                  : comparisonData.criticalDefectRateComparison === 'worse'
                    ? 'Worse than peers'
                    : 'In line with peers'}
              </span>
            </div>

            <div className='flex items-center gap-2'>
              <span
                className={`flex-shrink-0 ${
                  comparisonData.responseDaysComparison === 'better'
                    ? 'text-green-600'
                    : comparisonData.responseDaysComparison === 'worse'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {comparisonData.responseDaysComparison === 'better' ? (
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
                ) : comparisonData.responseDaysComparison === 'worse' ? (
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
                ) : (
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
                )}
              </span>
              <span className='text-xs text-gray-600'>
                Response Time:{' '}
                {comparisonData.responseDaysComparison === 'better'
                  ? 'Better than peers'
                  : comparisonData.responseDaysComparison === 'worse'
                    ? 'Worse than peers'
                    : 'In line with peers'}
              </span>
            </div>

            <div className='flex items-center gap-2'>
              <span
                className={`flex-shrink-0 ${
                  comparisonData.passRateComparison === 'better'
                    ? 'text-green-600'
                    : comparisonData.passRateComparison === 'worse'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {comparisonData.passRateComparison === 'better' ? (
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
                ) : comparisonData.passRateComparison === 'worse' ? (
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
                ) : (
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
                )}
              </span>
              <span className='text-xs text-gray-600'>
                Pass Rate:{' '}
                {comparisonData.passRateComparison === 'better'
                  ? 'Better than peers'
                  : comparisonData.passRateComparison === 'worse'
                    ? 'Worse than peers'
                    : 'In line with peers'}
              </span>
            </div>
          </div>

          {comparisonData.overallAssessment && (
            <p className='text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200'>
              {comparisonData.overallAssessment}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

PeerComparisonChart.propTypes = {
  comparisonData: PropTypes.shape({
    defectRateDelta: PropTypes.number,
    criticalDefectRateDelta: PropTypes.number,
    responseDaysDelta: PropTypes.number,
    exposureDelta: PropTypes.number,
    passRateDelta: PropTypes.number,
    defectRateComparison: PropTypes.string,
    criticalDefectRateComparison: PropTypes.string,
    responseDaysComparison: PropTypes.string,
    exposureComparison: PropTypes.string,
    passRateComparison: PropTypes.string,
    overallAssessment: PropTypes.string,
  }),
  peerComparison: PropTypes.shape({
    peerAvgDefectRate: PropTypes.number,
    peerAvgCriticalDefectRate: PropTypes.number,
    peerAvgResponseDays: PropTypes.number,
    peerAvgExposure: PropTypes.number,
    peerAvgPassRate: PropTypes.number,
    percentileRank: PropTypes.number,
    peerCount: PropTypes.number,
  }),
  className: PropTypes.string,
};

PeerComparisonChart.defaultProps = {
  comparisonData: null,
  peerComparison: null,
  className: '',
};

export default PeerComparisonChart;