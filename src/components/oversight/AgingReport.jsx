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
import { formatCurrency } from '../../utils/formatters';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'AgingReport';

const AGING_BUCKETS = [
  { key: '0-30', label: '0–30 Days', minDays: 0, maxDays: 30 },
  { key: '31-60', label: '31–60 Days', minDays: 31, maxDays: 60 },
  { key: '61-90', label: '61–90 Days', minDays: 61, maxDays: 90 },
  { key: '90+', label: '90+ Days', minDays: 91, maxDays: Infinity },
];

const AGING_BUCKET_COLORS = {
  '0-30': '#3b82f6',
  '31-60': '#eab308',
  '61-90': '#f97316',
  '90+': '#ef4444',
};

const AGING_BUCKET_BG_COLORS = {
  '0-30': 'bg-blue-100 text-blue-700 border-blue-200',
  '31-60': 'bg-amber-100 text-amber-700 border-amber-200',
  '61-90': 'bg-orange-100 text-orange-700 border-orange-200',
  '90+': 'bg-red-100 text-red-700 border-red-200',
};

const getAgingBucket = (createdAt, status) => {
  if (!createdAt) return null;
  if (status === 'closed' || status === 'draft') return null;

  try {
    const createdDate = new Date(createdAt);
    if (isNaN(createdDate.getTime())) return null;

    const now = new Date();
    const diffMs = now - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    for (const bucket of AGING_BUCKETS) {
      if (diffDays >= bucket.minDays && diffDays <= bucket.maxDays) {
        return bucket.key;
      }
    }

    return '90+';
  } catch {
    return null;
  }
};

const calculateExposure = (repurchaseCase) => {
  if (!repurchaseCase) return 0;

  if (repurchaseCase.status === 'closed') {
    return repurchaseCase.finalOutcome?.settledAmount || 0;
  }

  if (repurchaseCase.status === 'draft') {
    return 0;
  }

  if (
    repurchaseCase.alternativeProposal?.status === 'accepted' &&
    repurchaseCase.alternativeProposal?.amount !== null &&
    repurchaseCase.alternativeProposal?.amount !== undefined
  ) {
    return repurchaseCase.alternativeProposal.amount;
  }

  return repurchaseCase.demandAmount || 0;
};

const AgingReport = ({
  agingData,
  repurchaseCases,
  title = 'Aging Report',
  description = 'SLA breaches and repurchase cases bucketed by age.',
  className = '',
}) => {
  const safeAgingData = useMemo(() => {
    if (!Array.isArray(agingData)) {
      return [];
    }
    return agingData;
  }, [agingData]);

  const safeRepurchaseCases = useMemo(() => {
    if (!Array.isArray(repurchaseCases)) {
      return [];
    }
    return repurchaseCases;
  }, [repurchaseCases]);

  const chartData = useMemo(() => {
    if (safeRepurchaseCases.length > 0) {
      const bucketMap = new Map();

      for (const key of AGING_BUCKETS.map((b) => b.key)) {
        bucketMap.set(key, {
          name: AGING_BUCKETS.find((b) => b.key === key)?.label || key,
          bucket: key,
          count: 0,
          exposure: 0,
          color: AGING_BUCKET_COLORS[key] || '#6b7280',
        });
      }

      for (const repurchaseCase of safeRepurchaseCases) {
        if (!repurchaseCase) continue;

        const bucket = getAgingBucket(repurchaseCase.createdAt, repurchaseCase.status);

        if (!bucket) continue;

        const exposure = calculateExposure(repurchaseCase);
        const entry = bucketMap.get(bucket);

        if (entry) {
          entry.count++;
          entry.exposure += exposure;
        }
      }

      const result = [];
      for (const bucket of AGING_BUCKETS) {
        const entry = bucketMap.get(bucket.key);
        if (entry && entry.count > 0) {
          result.push({
            ...entry,
            exposure: Math.round(entry.exposure * 100) / 100,
          });
        }
      }

      return result;
    }

    if (safeAgingData.length > 0) {
      return safeAgingData.map((item) => {
        if (!item) return null;

        const bucketKey = item.bucket || item.key || '';
        const bucketConfig = AGING_BUCKETS.find((b) => b.key === bucketKey);

        return {
          name: item.label || bucketConfig?.label || bucketKey || 'Unknown',
          bucket: bucketKey,
          count: item.count || 0,
          exposure: item.exposure || 0,
          color: AGING_BUCKET_COLORS[bucketKey] || '#6b7280',
        };
      }).filter(Boolean);
    }

    return [];
  }, [safeAgingData, safeRepurchaseCases]);

  const totalCount = useMemo(() => {
    return chartData.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [chartData]);

  const totalExposure = useMemo(() => {
    return chartData.reduce((sum, item) => sum + (item.exposure || 0), 0);
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
        <div className='flex items-center justify-between mb-5'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900'>{title}</h2>
            <p className='text-sm text-gray-500 mt-0.5'>{description}</p>
          </div>
        </div>

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
              <circle cx='12' cy='12' r='10' />
              <polyline points='12 6 12 12 16 14' />
            </svg>
            <p className='text-sm'>No aging data available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-enterprise ${className}`}>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>{title}</h2>
          <p className='text-sm text-gray-500 mt-0.5'>{description}</p>
        </div>

        <div className='flex items-center gap-4 text-xs text-gray-400'>
          <span>
            {totalCount} case{totalCount === 1 ? '' : 's'}
          </span>
          <span>•</span>
          <span>
            {formatCurrency(totalExposure)} exposure
          </span>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div>
          <ResponsiveContainer width='100%' height={280}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
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
                formatter={(value, name) => {
                  if (name === 'exposure') return formatCurrency(value);
                  return value;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType='circle'
                iconSize={8}
              />
              <Bar
                dataKey='count'
                fill='#4c6ef5'
                name='Case Count'
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey='exposure'
                fill='#ef4444'
                name='Exposure ($)'
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div className='space-y-3'>
            {chartData.map((item) => {
              const bucketColor =
                AGING_BUCKET_BG_COLORS[item.bucket] ||
                'bg-gray-100 text-gray-700 border-gray-200';

              const countPercentage =
                totalCount > 0
                  ? Math.round((item.count / totalCount) * 10000) / 100
                  : 0;

              const exposurePercentage =
                totalExposure > 0
                  ? Math.round((item.exposure / totalExposure) * 10000) / 100
                  : 0;

              return (
                <div
                  key={item.bucket || item.name}
                  className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                >
                  <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${bucketColor}`}
                      >
                        {item.name}
                      </span>
                    </div>
                    <span className='text-sm font-semibold text-gray-900'>
                      {item.count} case{item.count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className='space-y-2'>
                    <div>
                      <div className='flex items-center justify-between text-xs text-gray-500 mb-1'>
                        <span>Case Count</span>
                        <span>{countPercentage}%</span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                          style={{ width: `${Math.max(2, countPercentage)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className='flex items-center justify-between text-xs text-gray-500 mb-1'>
                        <span>Exposure</span>
                        <span>{exposurePercentage}%</span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-red-500 transition-all duration-300'
                          style={{ width: `${Math.max(2, exposurePercentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center justify-between mt-3 pt-3 border-t border-gray-200'>
                    <span className='text-xs text-gray-500'>Exposure</span>
                    <span className='text-sm font-mono font-semibold text-gray-900'>
                      {formatCurrency(item.exposure)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className='mt-6 overflow-x-auto'>
          <table className='table-enterprise'>
            <thead>
              <tr>
                <th>Aging Bucket</th>
                <th>Case Count</th>
                <th>% of Total</th>
                <th>Exposure</th>
                <th>% of Exposure</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item) => {
                const countPercentage =
                  totalCount > 0
                    ? Math.round((item.count / totalCount) * 10000) / 100
                    : 0;

                const exposurePercentage =
                  totalExposure > 0
                    ? Math.round((item.exposure / totalExposure) * 10000) / 100
                    : 0;

                const bucketColor =
                  AGING_BUCKET_BG_COLORS[item.bucket] ||
                  'bg-gray-100 text-gray-700 border-gray-200';

                return (
                  <tr key={item.bucket || item.name}>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${bucketColor}`}
                      >
                        {item.name}
                      </span>
                    </td>
                    <td>
                      <span className='text-sm font-semibold text-gray-900'>
                        {item.count}
                      </span>
                    </td>
                    <td>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 max-w-[80px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                          <div
                            className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                            style={{ width: `${Math.max(2, countPercentage)}%` }}
                          />
                        </div>
                        <span className='text-sm text-gray-600'>
                          {countPercentage}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className='text-sm font-mono text-gray-700'>
                        {formatCurrency(item.exposure)}
                      </span>
                    </td>
                    <td>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 max-w-[80px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                          <div
                            className='h-full rounded-full bg-red-500 transition-all duration-300'
                            style={{ width: `${Math.max(2, exposurePercentage)}%` }}
                          />
                        </div>
                        <span className='text-sm text-gray-600'>
                          {exposurePercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className='bg-gray-50 font-semibold'>
                <td>
                  <span className='text-sm text-gray-700'>Total</span>
                </td>
                <td>
                  <span className='text-sm text-gray-900'>{totalCount}</span>
                </td>
                <td>
                  <span className='text-sm text-gray-900'>100%</span>
                </td>
                <td>
                  <span className='text-sm font-mono text-gray-900'>
                    {formatCurrency(totalExposure)}
                  </span>
                </td>
                <td>
                  <span className='text-sm text-gray-900'>100%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

AgingReport.propTypes = {
  agingData: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      bucket: PropTypes.string,
      key: PropTypes.string,
      count: PropTypes.number,
      exposure: PropTypes.number,
      minDays: PropTypes.number,
      maxDays: PropTypes.number,
    }),
  ),
  repurchaseCases: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      linkedDefectIds: PropTypes.arrayOf(PropTypes.string),
      sellerId: PropTypes.string,
      loanId: PropTypes.string,
      demandAmount: PropTypes.number,
      rationale: PropTypes.string,
      evidence: PropTypes.array,
      status: PropTypes.string,
      counterpartyResponse: PropTypes.shape({
        receivedAt: PropTypes.string,
        responseType: PropTypes.string,
        rationale: PropTypes.string,
        proposedAmount: PropTypes.number,
      }),
      alternativeProposal: PropTypes.shape({
        type: PropTypes.string,
        terms: PropTypes.string,
        amount: PropTypes.number,
        status: PropTypes.string,
      }),
      finalOutcome: PropTypes.shape({
        type: PropTypes.string,
        settledAmount: PropTypes.number,
        closedAt: PropTypes.string,
        notes: PropTypes.string,
      }),
      exposure: PropTypes.number,
      createdAt: PropTypes.string,
      updatedAt: PropTypes.string,
    }),
  ),
  title: PropTypes.string,
  description: PropTypes.string,
  className: PropTypes.string,
};

AgingReport.defaultProps = {
  agingData: [],
  repurchaseCases: [],
  title: 'Aging Report',
  description: 'SLA breaches and repurchase cases bucketed by age.',
  className: '',
};

export default AgingReport;