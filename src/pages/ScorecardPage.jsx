import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useScorecardData } from '../hooks/useScorecardData';
import { usePeerComparison } from '../hooks/usePeerComparison';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../utils/formatters';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import RiskBadge from '../components/oversight/RiskBadge';
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

const COMPONENT_NAME = 'ScorecardPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const CHART_COLORS = ['#4c6ef5', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const SEVERITY_COLORS = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#3b82f6',
  observation: '#6b7280',
};

const SEVERITY_LABELS = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
};

const ROOT_CAUSE_COLORS = {
  'Seller Error': '#ef4444',
  'Process Gap': '#f97316',
  'System Issue': '#3b82f6',
  'Third-Party Error': '#8b5cf6',
  'Borrower Misrepresentation': '#ec4899',
  'Underwriter Error': '#06b6d4',
  'Documentation Deficiency': '#eab308',
  'Training Gap': '#22c55e',
};

const COMPARISON_LABELS = {
  better: 'Better than peers',
  worse: 'Worse than peers',
  neutral: 'In line with peers',
};

const COMPARISON_COLORS = {
  better: 'text-green-600',
  worse: 'text-red-600',
  neutral: 'text-gray-500',
};

const COMPARISON_ICONS = {
  better: (
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
  ),
  worse: (
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

const MetricCard = ({ label, value, sublabel, icon, colorClass, bgClass, borderClass }) => {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${borderClass} ${bgClass}`}>
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
    </div>
  );
};

MetricCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sublabel: PropTypes.string,
  icon: PropTypes.node,
  colorClass: PropTypes.string,
  bgClass: PropTypes.string,
  borderClass: PropTypes.string,
};

MetricCard.defaultProps = {
  sublabel: null,
  icon: null,
  colorClass: 'bg-gray-100 text-gray-500',
  bgClass: 'bg-gray-50',
  borderClass: 'border-gray-200',
};

const TrendChart = ({ trendData }) => {
  if (!trendData || !Array.isArray(trendData.trendSeries) || trendData.trendSeries.length === 0) {
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

  const chartData = trendData.trendSeries.map((point) => ({
    month: point.month,
    defects: point.defectCount,
    remedies: point.remedyCount,
    avgAge: point.avgRemedyAge,
  }));

  const trendLabel = trendData.defectRateTrend || 'stable';
  const trendColor =
    trendLabel === 'improving'
      ? 'text-green-600'
      : trendLabel === 'worsening'
        ? 'text-red-600'
        : 'text-gray-500';

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
          6-Month Trend
        </span>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          {trendLabel === 'improving' && (
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
          )}
          {trendLabel === 'worsening' && (
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
          )}
          {trendLabel === 'stable' && (
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
          )}
          {trendLabel.charAt(0).toUpperCase() + trendLabel.slice(1)}
        </span>
      </div>

      <ResponsiveContainer width='100%' height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            dataKey='defects'
            stroke='#ef4444'
            strokeWidth={2}
            dot={{ r: 4, fill: '#ef4444' }}
            activeDot={{ r: 6 }}
            name='Defects'
          />
          <Line
            type='monotone'
            dataKey='remedies'
            stroke='#3b82f6'
            strokeWidth={2}
            dot={{ r: 4, fill: '#3b82f6' }}
            activeDot={{ r: 6 }}
            name='Remedy Cases'
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

TrendChart.propTypes = {
  trendData: PropTypes.shape({
    defectRateTrend: PropTypes.string,
    defectRateChange: PropTypes.number,
    responseTimeTrend: PropTypes.string,
    responseTimeChange: PropTypes.number,
    trendSeries: PropTypes.arrayOf(
      PropTypes.shape({
        month: PropTypes.string,
        defectCount: PropTypes.number,
        remedyCount: PropTypes.number,
        avgRemedyAge: PropTypes.number,
      }),
    ),
  }),
};

TrendChart.defaultProps = {
  trendData: null,
};

const PeerComparisonChart = ({ peerComparison, comparisonData }) => {
  if (!peerComparison || peerComparison.peerCount === 0) {
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
            <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
            <circle cx='9' cy='7' r='4' />
            <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
            <path d='M16 3.13a4 4 0 0 1 0 7.75' />
          </svg>
          <p className='text-sm'>Insufficient peer data for comparison.</p>
        </div>
      </div>
    );
  }

  const chartData = [
    {
      name: 'Defect Rate',
      peer: Math.round(peerComparison.peerAvgDefectRate * 10000) / 100,
      counterparty: comparisonData
        ? Math.round((peerComparison.peerAvgDefectRate + comparisonData.defectRateDelta) * 10000) / 100
        : 0,
    },
    {
      name: 'Critical Defect Rate',
      peer: Math.round(peerComparison.peerAvgCriticalDefectRate * 10000) / 100,
      counterparty: comparisonData
        ? Math.round((peerComparison.peerAvgCriticalDefectRate + comparisonData.criticalDefectRateDelta) * 10000) / 100
        : 0,
    },
    {
      name: 'Response Days',
      peer: peerComparison.peerAvgResponseDays,
      counterparty: comparisonData
        ? Math.round((peerComparison.peerAvgResponseDays + comparisonData.responseDaysDelta) * 10) / 10
        : 0,
    },
    {
      name: 'Pass Rate',
      peer: Math.round(peerComparison.peerAvgPassRate * 10000) / 100,
      counterparty: comparisonData
        ? Math.round((peerComparison.peerAvgPassRate + comparisonData.passRateDelta) * 10000) / 100
        : 0,
    },
  ];

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
          Peer Comparison ({peerComparison.peerCount} peers)
        </span>
        <span className='text-xs text-gray-400'>
          Percentile: {peerComparison.percentileRank}%
        </span>
      </div>

      <ResponsiveContainer width='100%' height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          <Bar dataKey='peer' fill='#94a3b8' name='Peer Average' radius={[4, 4, 0, 0]} />
          <Bar dataKey='counterparty' fill='#4c6ef5' name='This Counterparty' radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {comparisonData && (
        <div className='mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3'>
            Comparison Summary
          </span>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div className='flex items-center gap-2'>
              <span className={`flex-shrink-0 ${COMPARISON_COLORS[comparisonData.defectRateComparison]}`}>
                {COMPARISON_ICONS[comparisonData.defectRateComparison]}
              </span>
              <span className='text-xs text-gray-600'>
                Defect Rate: {COMPARISON_LABELS[comparisonData.defectRateComparison]}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <span className={`flex-shrink-0 ${COMPARISON_COLORS[comparisonData.criticalDefectRateComparison]}`}>
                {COMPARISON_ICONS[comparisonData.criticalDefectRateComparison]}
              </span>
              <span className='text-xs text-gray-600'>
                Critical Defect Rate: {COMPARISON_LABELS[comparisonData.criticalDefectRateComparison]}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <span className={`flex-shrink-0 ${COMPARISON_COLORS[comparisonData.responseDaysComparison]}`}>
                {COMPARISON_ICONS[comparisonData.responseDaysComparison]}
              </span>
              <span className='text-xs text-gray-600'>
                Response Time: {COMPARISON_LABELS[comparisonData.responseDaysComparison]}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <span className={`flex-shrink-0 ${COMPARISON_COLORS[comparisonData.passRateComparison]}`}>
                {COMPARISON_ICONS[comparisonData.passRateComparison]}
              </span>
              <span className='text-xs text-gray-600'>
                Pass Rate: {COMPARISON_LABELS[comparisonData.passRateComparison]}
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
  peerComparison: PropTypes.shape({
    peerAvgDefectRate: PropTypes.number,
    peerAvgCriticalDefectRate: PropTypes.number,
    peerAvgResponseDays: PropTypes.number,
    peerAvgExposure: PropTypes.number,
    peerAvgPassRate: PropTypes.number,
    percentileRank: PropTypes.number,
    peerCount: PropTypes.number,
  }),
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
};

PeerComparisonChart.defaultProps = {
  peerComparison: null,
  comparisonData: null,
};

const DefectAnalysisPanel = ({ defectBreakdown, defects }) => {
  const severityBreakdown = useMemo(() => {
    if (!Array.isArray(defects) || defects.length === 0) {
      return [];
    }

    const severityMap = new Map();

    for (const defect of defects) {
      if (!defect || !defect.severity) continue;
      const severity = defect.severity;
      severityMap.set(severity, (severityMap.get(severity) || 0) + 1);
    }

    const result = [];
    for (const [severity, count] of severityMap.entries()) {
      result.push({
        name: SEVERITY_LABELS[severity] || severity,
        value: count,
        color: SEVERITY_COLORS[severity] || '#6b7280',
      });
    }

    return result;
  }, [defects]);

  const rootCauseBreakdown = useMemo(() => {
    if (!Array.isArray(defects) || defects.length === 0) {
      return [];
    }

    const causeMap = new Map();

    for (const defect of defects) {
      if (!defect || !defect.rootCause) continue;
      const cause = defect.rootCause;
      causeMap.set(cause, (causeMap.get(cause) || 0) + 1);
    }

    const result = [];
    for (const [cause, count] of causeMap.entries()) {
      result.push({
        name: cause,
        value: count,
        color: ROOT_CAUSE_COLORS[cause] || '#6b7280',
      });
    }

    result.sort((a, b) => b.value - a.value);

    return result;
  }, [defects]);

  const categoryBreakdown = useMemo(() => {
    if (!Array.isArray(defectBreakdown) || defectBreakdown.length === 0) {
      return [];
    }

    return defectBreakdown.map((item, index) => ({
      name: item.category,
      value: item.count,
      percentage: item.percentage,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [defectBreakdown]);

  const totalDefects = Array.isArray(defects) ? defects.length : 0;

  if (totalDefects === 0) {
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
            <line x1='15' y1='9' x2='9' y2='15' />
            <line x1='9' y1='9' x2='15' y2='15' />
          </svg>
          <p className='text-sm'>No defects recorded for this counterparty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {severityBreakdown.length > 0 && (
          <div>
            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3'>
              By Severity
            </span>
            <ResponsiveContainer width='100%' height={220}>
              <PieChart>
                <Pie
                  data={severityBreakdown}
                  cx='50%'
                  cy='50%'
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey='value'
                >
                  {severityBreakdown.map((entry, index) => (
                    <Cell key={`severity-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  iconType='circle'
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {rootCauseBreakdown.length > 0 && (
          <div>
            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3'>
              By Root Cause
            </span>
            <ResponsiveContainer width='100%' height={220}>
              <PieChart>
                <Pie
                  data={rootCauseBreakdown}
                  cx='50%'
                  cy='50%'
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey='value'
                >
                  {rootCauseBreakdown.map((entry, index) => (
                    <Cell key={`rootcause-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  iconType='circle'
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {categoryBreakdown.length > 0 && (
        <div>
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3'>
            By Category
          </span>
          <div className='space-y-2'>
            {categoryBreakdown.map((item) => (
              <div key={item.name} className='flex items-center gap-3'>
                <div
                  className='w-3 h-3 rounded-full flex-shrink-0'
                  style={{ backgroundColor: item.color }}
                />
                <span className='text-sm text-gray-700 flex-1'>{item.name}</span>
                <span className='text-sm font-mono text-gray-500'>{item.value}</span>
                <span className='text-xs text-gray-400 w-12 text-right'>
                  {item.percentage}%
                </span>
                <div className='w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all duration-300'
                    style={{
                      width: `${Math.max(2, item.percentage)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

DefectAnalysisPanel.propTypes = {
  defectBreakdown: PropTypes.arrayOf(
    PropTypes.shape({
      category: PropTypes.string,
      count: PropTypes.number,
      percentage: PropTypes.number,
    }),
  ),
  defects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      severity: PropTypes.string,
      rootCause: PropTypes.string,
      category: PropTypes.string,
    }),
  ),
};

DefectAnalysisPanel.defaultProps = {
  defectBreakdown: [],
  defects: [],
};

const RecentActivityFeed = ({ counterpartyId }) => {
  const { getAuditTrail } = useAudit();

  const recentActivity = useMemo(() => {
    if (!counterpartyId) return [];

    const entries = getAuditTrail({
      entityId: counterpartyId,
      limit: 10,
      sortBy: 'timestamp',
      sortDirection: 'desc',
    });

    return entries;
  }, [counterpartyId, getAuditTrail]);

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDate(date, 'MMM d, yyyy');
    } catch {
      return '';
    }
  };

  const getActionIcon = (action) => {
    if (!action) {
      return (
        <div className='w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400'>
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
            <line x1='12' y1='16' x2='12' y2='12' />
            <line x1='12' y1='8' x2='12.01' y2='8' />
          </svg>
        </div>
      );
    }

    if (action.includes('ALERT') || action.includes('BREACH')) {
      return (
        <div className='w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600'>
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
            <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
            <line x1='12' y1='9' x2='12' y2='13' />
            <line x1='12' y1='17' x2='12.01' y2='17' />
          </svg>
        </div>
      );
    }

    if (action.includes('WATCHLIST')) {
      return (
        <div className='w-8 h-8 flex items-center justify-center rounded-full bg-purple-100 text-purple-600'>
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
            <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
            <circle cx='12' cy='12' r='3' />
          </svg>
        </div>
      );
    }

    if (action.includes('DEFECT') || action.includes('QC')) {
      return (
        <div className='w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-600'>
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
            <line x1='15' y1='9' x2='9' y2='15' />
            <line x1='9' y1='9' x2='15' y2='15' />
          </svg>
        </div>
      );
    }

    if (action.includes('REMEDY') || action.includes('REPURCHASE')) {
      return (
        <div className='w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600'>
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
            <path d='M12 20h9' />
            <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
          </svg>
        </div>
      );
    }

    return (
      <div className='w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400'>
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
          <polyline points='12 6 12 12 16 14' />
        </svg>
      </div>
    );
  };

  const formatActionLabel = (action) => {
    if (!action) return 'Unknown Action';
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (recentActivity.length === 0) {
    return (
      <div className='flex items-center justify-center h-32 text-gray-400'>
        <div className='text-center'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-8 h-8 mx-auto mb-2'
          >
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
          <p className='text-sm'>No recent activity recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {recentActivity.map((entry) => {
        if (!entry) return null;

        return (
          <div
            key={entry.id}
            className='flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-200'
          >
            {getActionIcon(entry.action)}
            <div className='flex-1 min-w-0'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-gray-900'>
                  {formatActionLabel(entry.action)}
                </span>
                <span className='text-xs text-gray-400 flex-shrink-0 ml-2'>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              <div className='flex items-center gap-2 mt-0.5'>
                <span className='text-xs text-gray-500'>{entry.persona || 'Unknown'}</span>
                {entry.entityType && (
                  <>
                    <span className='text-xs text-gray-300'>•</span>
                    <span className='text-xs text-gray-400 capitalize'>
                      {entry.entityType.replace(/_/g, ' ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

RecentActivityFeed.propTypes = {
  counterpartyId: PropTypes.string.isRequired,
};

const ScorecardPage = () => {
  const navigate = useNavigate();
  const { counterpartyId } = useParams();
  const { sellers, defects } = useMockData();
  const { watchlist } = useOversight();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const { scorecard, trendData, peerComparison, defectBreakdown, isLoading } =
    useScorecardData(counterpartyId);

  const { comparisonData } = usePeerComparison(counterpartyId);

  const [activeTab, setActiveTab] = useState('overview');

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const counterparty = useMemo(() => {
    if (!counterpartyId || !Array.isArray(sellers)) return null;
    return sellers.find((s) => s && s.id === counterpartyId) || null;
  }, [counterpartyId, sellers]);

  const counterpartyDefects = useMemo(() => {
    if (!counterpartyId || !Array.isArray(defects)) return [];
    return defects.filter((d) => d && d.sellerId === counterpartyId);
  }, [counterpartyId, defects]);

  const watchlistEntry = useMemo(() => {
    if (!counterpartyId || !Array.isArray(watchlist)) return null;
    return (
      watchlist.find(
        (entry) =>
          entry &&
          entry.counterpartyId === counterpartyId &&
          entry.status === 'active',
      ) || null
    );
  }, [counterpartyId, watchlist]);

  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
  }, []);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleViewCounterpartyRisk = useCallback(() => {
    if (!counterpartyId) return;
    navigate(`/counterparties/${counterpartyId}`);
  }, [navigate, counterpartyId]);

  const handleAddToWatchlist = useCallback(() => {
    if (!counterpartyId) return;
    navigate(`/counterparties/${counterpartyId}?action=addToWatchlist`);
  }, [navigate, counterpartyId]);

  if (!counterpartyId) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Scorecard', path: `/scorecard/${counterpartyId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Counterparty Scorecard</h1>
            </div>
          </div>

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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Invalid Counterparty ID</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No counterparty ID was provided. Please select a counterparty from the risk dashboard.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  if (!counterparty) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Scorecard', path: `/scorecard/${counterpartyId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Counterparty Scorecard</h1>
            </div>
          </div>

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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Counterparty Not Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                Counterparty with ID{' '}
                <span className='font-mono text-gray-700'>{counterpartyId}</span> was not found.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  const counterpartyName = counterparty.name || counterpartyId;
  const counterpartyStatus = counterparty.status || 'unknown';

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Counterparties', path: '/counterparties' },
    { label: counterpartyName, path: `/scorecard/${counterpartyId}` },
  ];

  const metrics = scorecard?.metrics || null;
  const riskTier = scorecard?.riskTier || null;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'trends', label: 'Performance Trends' },
    { key: 'peers', label: 'Peer Comparison' },
    { key: 'defects', label: 'Defect Analysis' },
    { key: 'activity', label: 'Recent Activity' },
  ];

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-900'>Counterparty Scorecard</h1>
              <span className='text-sm font-mono text-gray-400'>{counterpartyId}</span>
              {riskTier && (
                <RiskBadge tier={riskTier.current} />
              )}
              {watchlistEntry && (
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200'>
                  On Watchlist
                </span>
              )}
            </div>
            <p className='text-sm text-gray-500 mt-1'>
              {counterpartyName} &middot; Status:{' '}
              <span className='font-medium capitalize'>{counterpartyStatus}</span>
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleGoBack}
              className='btn-enterprise-secondary'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-4 h-4 mr-2'
              >
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Back
            </button>

            <button
              type='button'
              onClick={handleViewCounterpartyRisk}
              className='btn-enterprise-secondary'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-4 h-4 mr-2'
              >
                <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                <circle cx='12' cy='12' r='3' />
              </svg>
              Risk Details
            </button>

            {!watchlistEntry && (
              <button
                type='button'
                onClick={handleAddToWatchlist}
                className='btn-enterprise-primary'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 mr-2'
                >
                  <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                  <line x1='12' y1='8' x2='12' y2='16' />
                  <line x1='8' y1='12' x2='16' y2='12' />
                </svg>
                Add to Watchlist
              </button>
            )}
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
              <span className='ml-3 text-sm text-gray-500'>Loading scorecard data...</span>
            </div>
          </div>
        ) : (
          <>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              <MetricCard
                label='Defect Rate'
                value={metrics ? formatPercentage(metrics.defectRate, 1) : '—'}
                sublabel={
                  metrics
                    ? `${counterpartyDefects.length} defects / ${metrics.totalLoansSubmitted} loans`
                    : null
                }
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
              />

              <MetricCard
                label='Open Remedies'
                value={metrics ? metrics.openRemedyCases : '—'}
                sublabel={
                  metrics && metrics.slaBreachRate > 0
                    ? `${formatPercentage(metrics.slaBreachRate, 1)} SLA breach rate`
                    : null
                }
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
                    <path d='M12 20h9' />
                    <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
                  </svg>
                }
                colorClass='bg-amber-100 text-amber-600'
                bgClass='bg-amber-50'
                borderClass='border-amber-200'
              />

              <MetricCard
                label='Total Exposure'
                value={metrics ? formatCurrency(metrics.totalExposure) : '—'}
                sublabel={
                  metrics
                    ? `${metrics.openRepurchaseCases} open repurchase case${metrics.openRepurchaseCases === 1 ? '' : 's'}`
                    : null
                }
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
                colorClass='bg-blue-100 text-blue-600'
                bgClass='bg-blue-50'
                borderClass='border-blue-200'
              />

              <MetricCard
                label='Watchlist Status'
                value={watchlistEntry ? 'On Watchlist' : 'Not on Watchlist'}
                sublabel={
                  watchlistEntry
                    ? `Since ${formatDate(watchlistEntry.addedDate, 'MMM d, yyyy')}`
                    : peerComparison
                      ? `Percentile: ${peerComparison.percentileRank}%`
                      : null
                }
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
                colorClass={
                  watchlistEntry
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-green-100 text-green-600'
                }
                bgClass={watchlistEntry ? 'bg-purple-50' : 'bg-green-50'}
                borderClass={
                  watchlistEntry ? 'border-purple-200' : 'border-green-200'
                }
              />
            </div>

            {metrics && (
              <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4'>
                <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Total Loans
                  </p>
                  <p className='text-lg font-bold text-gray-900'>
                    {metrics.totalLoansSubmitted}
                  </p>
                </div>
                <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Pass Rate
                  </p>
                  <p className='text-lg font-bold text-gray-900'>
                    {formatPercentage(metrics.passRate, 1)}
                  </p>
                </div>
                <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Critical Defect Rate
                  </p>
                  <p className='text-lg font-bold text-gray-900'>
                    {formatPercentage(metrics.criticalDefectRate, 1)}
                  </p>
                </div>
                <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Avg Response
                  </p>
                  <p className='text-lg font-bold text-gray-900'>
                    {metrics.avgRemedyResponseDays} days
                  </p>
                </div>
                <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Open Repurchase
                  </p>
                  <p className='text-lg font-bold text-gray-900'>
                    {metrics.openRepurchaseCases}
                  </p>
                </div>
                <div className='p-3 rounded-xl bg-gray-50 border border-gray-200 text-center'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    SLA Breach Rate
                  </p>
                  <p className='text-lg font-bold text-gray-900'>
                    {formatPercentage(metrics.slaBreachRate, 1)}
                  </p>
                </div>
              </div>
            )}

            {riskTier && riskTier.factors && riskTier.factors.length > 0 && (
              <div className='card-enterprise'>
                <h2 className='text-lg font-semibold text-gray-900 mb-4'>Risk Tier Breakdown</h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                  {riskTier.factors.map((factor) => (
                    <div
                      key={factor.name}
                      className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                    >
                      <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                        {factor.name
                          ? factor.name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
                          : 'Unknown'}
                      </p>
                      <div className='flex items-baseline gap-2 mb-2'>
                        <span className='text-xl font-bold text-gray-900'>
                          {factor.normalizedScore ?? factor.score ?? 0}
                        </span>
                        <span className='text-xs text-gray-400'>/ 100</span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                          style={{
                            width: `${Math.max(2, factor.normalizedScore ?? factor.score ?? 0)}%`,
                          }}
                        />
                      </div>
                      <div className='flex items-center justify-between mt-2'>
                        <span className='text-xs text-gray-400'>
                          Weight: {Math.round((factor.weight ?? 0) * 100)}%
                        </span>
                        <span className='text-xs font-medium text-gray-600'>
                          Contribution: {factor.contribution ?? 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className='border-b border-gray-200'>
              <nav className='flex gap-6 -mb-px' aria-label='Scorecard tabs'>
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type='button'
                      onClick={() => handleTabChange(tab.key)}
                      className={`
                        pb-3 px-1 text-sm font-medium border-b-2 transition-colors duration-150
                        focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-2
                        ${
                          isActive
                            ? 'border-enterprise-600 text-enterprise-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {activeTab === 'overview' && (
              <div className='space-y-6 animate-fade-in'>
                <div className='card-enterprise'>
                  <TrendChart trendData={trendData} />
                </div>

                <div className='card-enterprise'>
                  <PeerComparisonChart
                    peerComparison={peerComparison}
                    comparisonData={comparisonData}
                  />
                </div>
              </div>
            )}

            {activeTab === 'trends' && (
              <div className='card-enterprise animate-fade-in'>
                <TrendChart trendData={trendData} />
              </div>
            )}

            {activeTab === 'peers' && (
              <div className='card-enterprise animate-fade-in'>
                <PeerComparisonChart
                  peerComparison={peerComparison}
                  comparisonData={comparisonData}
                />
              </div>
            )}

            {activeTab === 'defects' && (
              <div className='card-enterprise animate-fade-in'>
                <h2 className='text-lg font-semibold text-gray-900 mb-5'>
                  Defect Analysis ({counterpartyDefects.length} defects)
                </h2>
                <DefectAnalysisPanel
                  defectBreakdown={defectBreakdown}
                  defects={counterpartyDefects}
                />
              </div>
            )}

            {activeTab === 'activity' && (
              <div className='card-enterprise animate-fade-in'>
                <h2 className='text-lg font-semibold text-gray-900 mb-5'>Recent Activity</h2>
                <RecentActivityFeed counterpartyId={counterpartyId} />
              </div>
            )}
          </>
        )}
      </div>
    </RequireRole>
  );
};

ScorecardPage.propTypes = {};

export default ScorecardPage;