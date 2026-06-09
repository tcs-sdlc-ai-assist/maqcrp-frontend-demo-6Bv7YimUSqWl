import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolioMetrics } from '../hooks/usePortfolioMetrics';
import { useDrillDown } from '../hooks/useDrillDown';
import { useExport } from '../hooks/useExport';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../utils/formatters';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COMPONENT_NAME = 'ExecutiveDashboard';

const ALLOWED_ROLES = ['executive', 'admin'];

const CHART_COLORS = ['#4c6ef5', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e'];

const RISK_TIER_COLORS = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#22c55e',
};

const RISK_TIER_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const AGING_BUCKET_COLORS = {
  '0-30': '#3b82f6',
  '31-60': '#eab308',
  '61-90': '#f97316',
  '91-180': '#ef4444',
  '180+': '#dc2626',
};

const AGING_BUCKET_LABELS = {
  '0-30': '0–30 Days',
  '31-60': '31–60 Days',
  '61-90': '61–90 Days',
  '91-180': '91–180 Days',
  '180+': '180+ Days',
};

const KPICard = ({ label, value, sublabel, icon, colorClass, bgClass, borderClass, onClick, isClickable }) => {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isClickable && typeof onClick === 'function') {
          onClick();
        }
      }
    },
    [isClickable, onClick],
  );

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${borderClass} ${bgClass} ${isClickable ? 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1' : ''}`}
      onClick={isClickable && typeof onClick === 'function' ? onClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `${label}: ${value}. Click to drill down.` : `${label}: ${value}`}
    >
      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-xs font-medium text-gray-500 uppercase tracking-wider truncate'>
          {label}
        </p>
        <p className='text-xl font-bold text-gray-900'>{value}</p>
        {sublabel && (
          <p className='text-xs text-gray-500 mt-0.5'>{sublabel}</p>
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

KPICard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sublabel: PropTypes.string,
  icon: PropTypes.node,
  colorClass: PropTypes.string,
  bgClass: PropTypes.string,
  borderClass: PropTypes.string,
  onClick: PropTypes.func,
  isClickable: PropTypes.bool,
};

KPICard.defaultProps = {
  sublabel: null,
  icon: null,
  colorClass: 'bg-gray-100 text-gray-500',
  bgClass: 'bg-gray-50',
  borderClass: 'border-gray-200',
  onClick: null,
  isClickable: false,
};

const PortfolioQualityHeatmap = ({ concentrationData }) => {
  if (!concentrationData || !Array.isArray(concentrationData.byRiskTier) || concentrationData.byRiskTier.length === 0) {
    return (
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
            <rect x='3' y='3' width='7' height='7' />
            <rect x='14' y='3' width='7' height='7' />
            <rect x='14' y='14' width='7' height='7' />
            <rect x='3' y='14' width='7' height='7' />
          </svg>
          <p className='text-sm'>No risk tier data available.</p>
        </div>
      </div>
    );
  }

  const pieData = concentrationData.byRiskTier.map((item) => ({
    name: RISK_TIER_LABELS[item.name] || item.name,
    value: item.count,
    color: RISK_TIER_COLORS[item.name] || '#6b7280',
  }));

  return (
    <div>
      <ResponsiveContainer width='100%' height={240}>
        <PieChart>
          <Pie
            data={pieData}
            cx='50%'
            cy='50%'
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey='value'
          >
            {pieData.map((entry, index) => (
              <Cell key={`risk-tier-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            formatter={(value, name) => [value, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            iconType='circle'
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

PortfolioQualityHeatmap.propTypes = {
  concentrationData: PropTypes.shape({
    byRiskTier: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        count: PropTypes.number,
        percentage: PropTypes.number,
      }),
    ),
  }),
};

PortfolioQualityHeatmap.defaultProps = {
  concentrationData: null,
};

const TopCounterpartyTable = ({ topCounterparties, onRowClick }) => {
  const handleKeyDown = useCallback(
    (e, counterparty) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (typeof onRowClick === 'function' && counterparty) {
          onRowClick(counterparty);
        }
      }
    },
    [onRowClick],
  );

  if (!Array.isArray(topCounterparties) || topCounterparties.length === 0) {
    return (
      <div className='flex items-center justify-center h-48 text-gray-400'>
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
          <p className='text-sm'>No counterparty data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <table className='table-enterprise'>
        <thead>
          <tr>
            <th>Counterparty</th>
            <th>Risk Tier</th>
            <th>Defect Rate</th>
            <th>Critical Defect Rate</th>
            <th>Pass Rate</th>
            <th>Exposure</th>
            <th>Watchlist</th>
          </tr>
        </thead>
        <tbody>
          {topCounterparties.map((entry) => {
            if (!entry) return null;

            const tierColor =
              entry.riskTier === 'high'
                ? 'bg-red-100 text-red-700 border-red-200'
                : entry.riskTier === 'medium'
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-green-100 text-green-700 border-green-200';

            const tierLabel = RISK_TIER_LABELS[entry.riskTier] || entry.riskTier || 'Unknown';

            return (
              <tr
                key={entry.counterpartyId}
                className='cursor-pointer transition-colors duration-150 hover:bg-gray-50/70'
                onClick={() => {
                  if (typeof onRowClick === 'function') {
                    onRowClick(entry);
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, entry)}
                tabIndex={0}
                role='row'
                aria-label={`View details for ${entry.counterpartyName || entry.counterpartyId}`}
              >
                <td>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium text-gray-900'>
                      {entry.counterpartyName || entry.counterpartyId}
                    </span>
                    <span className='text-xs text-gray-400 font-mono'>
                      {entry.counterpartyId}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tierColor}`}
                  >
                    {tierLabel}
                  </span>
                </td>
                <td>
                  <span className='text-sm text-gray-700'>
                    {formatPercentage(entry.defectRate || 0, 1)}
                  </span>
                </td>
                <td>
                  <span className='text-sm text-gray-700'>
                    {formatPercentage(entry.criticalDefectRate || 0, 1)}
                  </span>
                </td>
                <td>
                  <span className='text-sm text-gray-700'>
                    {formatPercentage(entry.passRate || 0, 1)}
                  </span>
                </td>
                <td>
                  <span className='text-sm font-mono text-gray-700'>
                    {formatCurrency(entry.totalExposure || 0)}
                  </span>
                </td>
                <td>
                  {entry.onWatchlist ? (
                    <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200'>
                      Yes
                    </span>
                  ) : (
                    <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                      No
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

TopCounterpartyTable.propTypes = {
  topCounterparties: PropTypes.arrayOf(
    PropTypes.shape({
      counterpartyId: PropTypes.string,
      counterpartyName: PropTypes.string,
      riskTier: PropTypes.string,
      defectRate: PropTypes.number,
      criticalDefectRate: PropTypes.number,
      passRate: PropTypes.number,
      totalExposure: PropTypes.number,
      onWatchlist: PropTypes.bool,
    }),
  ),
  onRowClick: PropTypes.func,
};

TopCounterpartyTable.defaultProps = {
  topCounterparties: [],
  onRowClick: null,
};

const AgingReport = ({ repurchaseCases }) => {
  const agingData = useMemo(() => {
    if (!Array.isArray(repurchaseCases) || repurchaseCases.length === 0) {
      return [];
    }

    const bucketMap = new Map();
    const buckets = ['0-30', '31-60', '61-90', '91-180', '180+'];

    for (const bucket of buckets) {
      bucketMap.set(bucket, { name: bucket, count: 0, exposure: 0 });
    }

    const now = new Date();

    for (const repurchaseCase of repurchaseCases) {
      if (!repurchaseCase) continue;
      if (repurchaseCase.status === 'closed' || repurchaseCase.status === 'draft') continue;

      const createdAt = repurchaseCase.createdAt ? new Date(repurchaseCase.createdAt) : null;
      if (!createdAt || isNaN(createdAt.getTime())) continue;

      const ageInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

      let bucket;
      if (ageInDays <= 30) bucket = '0-30';
      else if (ageInDays <= 60) bucket = '31-60';
      else if (ageInDays <= 90) bucket = '61-90';
      else if (ageInDays <= 180) bucket = '91-180';
      else bucket = '180+';

      const entry = bucketMap.get(bucket);
      if (entry) {
        entry.count++;
        entry.exposure += repurchaseCase.exposure ?? repurchaseCase.demandAmount ?? 0;
      }
    }

    const result = [];
    for (const bucket of buckets) {
      const entry = bucketMap.get(bucket);
      if (entry && entry.count > 0) {
        result.push({
          name: AGING_BUCKET_LABELS[bucket] || bucket,
          count: entry.count,
          exposure: Math.round(entry.exposure * 100) / 100,
          color: AGING_BUCKET_COLORS[bucket] || '#6b7280',
        });
      }
    }

    return result;
  }, [repurchaseCases]);

  if (agingData.length === 0) {
    return (
      <div className='flex items-center justify-center h-48 text-gray-400'>
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
    );
  }

  return (
    <div>
      <ResponsiveContainer width='100%' height={240}>
        <BarChart data={agingData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value, name) => {
              if (name === 'exposure') return formatCurrency(value);
              return value;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          <Bar dataKey='count' fill='#4c6ef5' name='Case Count' radius={[4, 4, 0, 0]} />
          <Bar dataKey='exposure' fill='#ef4444' name='Exposure ($)' radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

AgingReport.propTypes = {
  repurchaseCases: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      status: PropTypes.string,
      createdAt: PropTypes.string,
      exposure: PropTypes.number,
      demandAmount: PropTypes.number,
    }),
  ),
};

AgingReport.defaultProps = {
  repurchaseCases: [],
};

const DefectTrendChart = ({ defects, loans }) => {
  const trendData = useMemo(() => {
    if (!Array.isArray(defects) || defects.length === 0) {
      return [];
    }

    const now = new Date();
    const monthBuckets = [];

    for (let i = 5; i >= 0; i--) {
      const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        label: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: bucketDate,
        endDate: new Date(bucketDate.getFullYear(), bucketDate.getMonth() + 1, 0, 23, 59, 59, 999),
        defectCount: 0,
        criticalCount: 0,
      });
    }

    for (const defect of defects) {
      if (!defect || !defect.createdAt) continue;

      const defectDate = new Date(defect.createdAt);
      if (isNaN(defectDate.getTime())) continue;

      for (const bucket of monthBuckets) {
        if (defectDate >= bucket.startDate && defectDate <= bucket.endDate) {
          bucket.defectCount++;
          if (defect.severity === 'critical') {
            bucket.criticalCount++;
          }
          break;
        }
      }
    }

    const totalLoans = Array.isArray(loans) ? loans.length : 0;

    return monthBuckets.map((bucket) => ({
      month: bucket.label,
      totalDefects: bucket.defectCount,
      criticalDefects: bucket.criticalCount,
      defectRate: totalLoans > 0 ? Math.round((bucket.defectCount / totalLoans) * 10000) / 100 : 0,
    }));
  }, [defects, loans]);

  if (trendData.length === 0) {
    return (
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
    );
  }

  return (
    <div>
      <ResponsiveContainer width='100%' height={280}>
        <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          <Line
            type='monotone'
            dataKey='totalDefects'
            stroke='#4c6ef5'
            strokeWidth={2}
            dot={{ r: 4, fill: '#4c6ef5' }}
            activeDot={{ r: 6 }}
            name='Total Defects'
          />
          <Line
            type='monotone'
            dataKey='criticalDefects'
            stroke='#ef4444'
            strokeWidth={2}
            dot={{ r: 4, fill: '#ef4444' }}
            activeDot={{ r: 6 }}
            name='Critical Defects'
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

DefectTrendChart.propTypes = {
  defects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      severity: PropTypes.string,
      createdAt: PropTypes.string,
    }),
  ),
  loans: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
    }),
  ),
};

DefectTrendChart.defaultProps = {
  defects: [],
  loans: [],
};

const ExecutiveDashboard = () => {
  const navigate = useNavigate();
  const { loans, defects, repurchaseCases } = useMockData();
  const { watchlist } = useOversight();
  const { currentPersona } = useAuth();
  const { portfolioSummary, topCounterparties, concentrationData, isLoading } =
    usePortfolioMetrics();
  const { navigateToDetail, breadcrumbs, currentStep, canGoBack, navigateBack } = useDrillDown({
    id: 'portfolio',
    type: 'portfolio',
    label: 'Portfolio Overview',
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeLoans = useMemo(() => {
    return Array.isArray(loans) ? loans : [];
  }, [loans]);

  const safeDefects = useMemo(() => {
    return Array.isArray(defects) ? defects : [];
  }, [defects]);

  const safeRepurchaseCases = useMemo(() => {
    return Array.isArray(repurchaseCases) ? repurchaseCases : [];
  }, [repurchaseCases]);

  const handleDrillToCounterparty = useCallback(
    (counterparty) => {
      if (!counterparty || !counterparty.counterpartyId) return;

      navigateToDetail({
        id: counterparty.counterpartyId,
        type: 'counterparty',
        label: counterparty.counterpartyName || counterparty.counterpartyId,
        metadata: counterparty,
      });

      navigate(`/counterparties/${counterparty.counterpartyId}`);
    },
    [navigateToDetail, navigate],
  );

  const handleDrillToLoans = useCallback(() => {
    navigateToDetail({
      id: 'loans',
      type: 'loan',
      label: 'Loan Portfolio',
    });

    navigate('/loans');
  }, [navigateToDetail, navigate]);

  const handleDrillToDefects = useCallback(() => {
    navigateToDetail({
      id: 'defects',
      type: 'defect',
      label: 'Defect Analysis',
    });

    navigate('/defects');
  }, [navigateToDetail, navigate]);

  const handleDrillToWatchlist = useCallback(() => {
    navigateToDetail({
      id: 'watchlist',
      type: 'watchlist',
      label: 'Watchlist',
    });

    navigate('/watchlist');
  }, [navigateToDetail, navigate]);

  const handleDrillToRepurchases = useCallback(() => {
    navigateToDetail({
      id: 'repurchases',
      type: 'repurchase',
      label: 'Repurchase Cases',
    });

    navigate('/repurchase/cases');
  }, [navigateToDetail, navigate]);

  const handleDrillToCounterparties = useCallback(() => {
    navigateToDetail({
      id: 'counterparties',
      type: 'counterparty',
      label: 'Counterparties',
    });

    navigate('/counterparties');
  }, [navigateToDetail, navigate]);

  const handleGoBack = useCallback(() => {
    navigateBack();
    navigate(-1);
  }, [navigateBack, navigate]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Executive Dashboard', path: '/executive' },
  ];

  const exportData = useMemo(() => {
    if (!portfolioSummary) return [];

    return [
      {
        metric: 'Total Loans',
        value: portfolioSummary.totalLoans,
      },
      {
        metric: 'Total Counterparties',
        value: portfolioSummary.totalCounterparties,
      },
      {
        metric: 'Overall Defect Rate',
        value: portfolioSummary.overallDefectRate,
      },
      {
        metric: 'Overall Critical Defect Rate',
        value: portfolioSummary.overallCriticalDefectRate,
      },
      {
        metric: 'Pass/Fail Ratio',
        value: portfolioSummary.passFailRatio,
      },
      {
        metric: 'Active Watchlist Count',
        value: portfolioSummary.activeWatchlistCount,
      },
      {
        metric: 'Total Exposure',
        value: portfolioSummary.totalExposure,
      },
      {
        metric: 'Open Remedy Cases',
        value: portfolioSummary.openRemedyCases,
      },
      {
        metric: 'Open Repurchase Cases',
        value: portfolioSummary.openRepurchaseCases,
      },
      {
        metric: 'SLA Breach Rate',
        value: portfolioSummary.slaBreachRate,
      },
      {
        metric: 'Avg Remedy Response Days',
        value: portfolioSummary.avgRemedyResponseDays,
      },
    ];
  }, [portfolioSummary]);

  const personaId = currentPersona?.id || '';
  const isReadOnly = personaId === 'executive';

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Executive Dashboard</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Portfolio-level health summary and key risk indicators.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='executive-dashboard'
              variant='secondary'
              label='Export'
            />
          </div>
        </div>

        {isLoading ? (
          <div className='card-enterprise'>
            <div className='flex items-center justify-center py-16'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-8 h-8 text-enterprise-600 animate-spin'
              >
                <path d='M21 12a9 9 0 1 1-6.219-8.56' />
              </svg>
              <span className='ml-3 text-sm text-gray-500'>Loading portfolio data...</span>
            </div>
          </div>
        ) : !portfolioSummary ? (
          <div className='card-enterprise'>
            <div className='text-center py-12'>
              <div className='mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={1.5}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-8 h-8 text-gray-400'
                >
                  <rect x='3' y='3' width='7' height='7' />
                  <rect x='14' y='3' width='7' height='7' />
                  <rect x='14' y='14' width='7' height='7' />
                  <rect x='3' y='14' width='7' height='7' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Portfolio Data</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No portfolio data is available. Ensure that loan and counterparty data has been
                seeded.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'>
              <KPICard
                label='Total Loans'
                value={portfolioSummary.totalLoans.toLocaleString()}
                sublabel={`${portfolioSummary.totalCounterparties} counterparties`}
                icon={
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
                }
                colorClass='bg-blue-100 text-blue-600'
                bgClass='bg-blue-50'
                borderClass='border-blue-200'
                onClick={handleDrillToLoans}
                isClickable
              />

              <KPICard
                label='Overall Defect Rate'
                value={formatPercentage(portfolioSummary.overallDefectRate, 1)}
                sublabel={`Critical: ${formatPercentage(portfolioSummary.overallCriticalDefectRate, 1)}`}
                icon={
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
                }
                colorClass='bg-red-100 text-red-600'
                bgClass='bg-red-50'
                borderClass='border-red-200'
                onClick={handleDrillToDefects}
                isClickable
              />

              <KPICard
                label='Pass/Fail Ratio'
                value={
                  portfolioSummary.passFailRatio === Infinity
                    ? 'All Pass'
                    : portfolioSummary.passFailRatio.toFixed(2)
                }
                sublabel='Passed / Failed loans'
                icon={
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
                }
                colorClass='bg-green-100 text-green-600'
                bgClass='bg-green-50'
                borderClass='border-green-200'
                onClick={handleDrillToLoans}
                isClickable
              />

              <KPICard
                label='Active Watchlist'
                value={portfolioSummary.activeWatchlistCount}
                sublabel='Counterparties under monitoring'
                icon={
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
                }
                colorClass='bg-purple-100 text-purple-600'
                bgClass='bg-purple-50'
                borderClass='border-purple-200'
                onClick={handleDrillToWatchlist}
                isClickable
              />

              <KPICard
                label='Total Exposure'
                value={formatCurrency(portfolioSummary.totalExposure)}
                sublabel={`${portfolioSummary.openRepurchaseCases} open repurchase cases`}
                icon={
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
                }
                colorClass='bg-amber-100 text-amber-600'
                bgClass='bg-amber-50'
                borderClass='border-amber-200'
                onClick={handleDrillToRepurchases}
                isClickable
              />
            </div>

            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4'>
              <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Open Remedies
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {portfolioSummary.openRemedyCases}
                </p>
              </div>
              <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  SLA Breach Rate
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {formatPercentage(portfolioSummary.slaBreachRate, 1)}
                </p>
              </div>
              <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Avg Response
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {portfolioSummary.avgRemedyResponseDays} days
                </p>
              </div>
              <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Counterparties
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {portfolioSummary.totalCounterparties}
                </p>
              </div>
              <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Open Repurchase
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {portfolioSummary.openRepurchaseCases}
                </p>
              </div>
              <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Critical Defect Rate
                </p>
                <p className='text-lg font-bold text-gray-900'>
                  {formatPercentage(portfolioSummary.overallCriticalDefectRate, 1)}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <div className='card-enterprise'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-semibold text-gray-900'>Portfolio Quality</h2>
                  <button
                    type='button'
                    onClick={handleDrillToCounterparties}
                    className='text-xs text-enterprise-600 hover:text-enterprise-700 font-medium focus:outline-none focus:underline'
                  >
                    View All Counterparties
                  </button>
                </div>
                <PortfolioQualityHeatmap concentrationData={concentrationData} />
              </div>

              <div className='card-enterprise'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-semibold text-gray-900'>Top Counterparties</h2>
                  <button
                    type='button'
                    onClick={handleDrillToCounterparties}
                    className='text-xs text-enterprise-600 hover:text-enterprise-700 font-medium focus:outline-none focus:underline'
                  >
                    View All
                  </button>
                </div>
                <TopCounterpartyTable
                  topCounterparties={topCounterparties}
                  onRowClick={handleDrillToCounterparty}
                />
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <div className='card-enterprise'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-semibold text-gray-900'>Repurchase Aging</h2>
                  <button
                    type='button'
                    onClick={handleDrillToRepurchases}
                    className='text-xs text-enterprise-600 hover:text-enterprise-700 font-medium focus:outline-none focus:underline'
                  >
                    View All Cases
                  </button>
                </div>
                <AgingReport repurchaseCases={safeRepurchaseCases} />
              </div>

              <div className='card-enterprise'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-semibold text-gray-900'>Defect Trends</h2>
                  <button
                    type='button'
                    onClick={handleDrillToDefects}
                    className='text-xs text-enterprise-600 hover:text-enterprise-700 font-medium focus:outline-none focus:underline'
                  >
                    View All Defects
                  </button>
                </div>
                <DefectTrendChart defects={safeDefects} loans={safeLoans} />
              </div>
            </div>
          </>
        )}
      </div>
    </RequireRole>
  );
};

ExecutiveDashboard.propTypes = {};

export default ExecutiveDashboard;