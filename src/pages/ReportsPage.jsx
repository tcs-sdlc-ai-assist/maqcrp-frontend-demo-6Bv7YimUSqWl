import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { useAuth } from '../contexts/AuthContext';
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

const COMPONENT_NAME = 'ReportsPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const CHART_COLORS = [
  '#4c6ef5',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
];

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

const PRODUCT_TYPE_LABELS = {
  conventional: 'Conventional',
  FHA: 'FHA',
  VA: 'VA',
  jumbo: 'Jumbo',
  USDA: 'USDA',
};

const CHANNEL_LABELS = {
  retail: 'Retail',
  correspondent: 'Correspondent',
  broker: 'Broker',
  wholesale: 'Wholesale',
};

const REPORT_TABS = [
  { key: 'defect-trends', label: 'Defect Trends' },
  { key: 'concentration', label: 'Concentration' },
  { key: 'aging-sla', label: 'Aging & SLA' },
];

const getAgingBucket = (createdAt, status) => {
  if (!createdAt) return null;
  if (status === 'closed' || status === 'draft') return null;

  try {
    const createdDate = new Date(createdAt);
    if (isNaN(createdDate.getTime())) return null;

    const now = new Date();
    const diffMs = now - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) return '0-30';
    if (diffDays <= 60) return '31-60';
    if (diffDays <= 90) return '61-90';
    if (diffDays <= 180) return '91-180';
    return '180+';
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

const DefectTrendReport = ({ defects, loans, dateRange, counterpartyFilter }) => {
  const trendData = useMemo(() => {
    if (!Array.isArray(defects) || defects.length === 0) {
      return [];
    }

    const now = new Date();
    const monthsToShow = 6;
    const monthBuckets = [];

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        label: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: bucketDate,
        endDate: new Date(bucketDate.getFullYear(), bucketDate.getMonth() + 1, 0, 23, 59, 59, 999),
        totalDefects: 0,
        critical: 0,
        major: 0,
        minor: 0,
        observation: 0,
      });
    }

    let filteredDefects = [...defects];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredDefects = filteredDefects.filter(
          (d) => d && d.createdAt && new Date(d.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredDefects = filteredDefects.filter(
          (d) => d && d.createdAt && new Date(d.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredDefects = filteredDefects.filter(
        (d) => d && d.sellerId === counterpartyFilter,
      );
    }

    for (const defect of filteredDefects) {
      if (!defect || !defect.createdAt) continue;

      const defectDate = new Date(defect.createdAt);
      if (isNaN(defectDate.getTime())) continue;

      for (const bucket of monthBuckets) {
        if (defectDate >= bucket.startDate && defectDate <= bucket.endDate) {
          bucket.totalDefects++;
          if (defect.severity === 'critical') bucket.critical++;
          else if (defect.severity === 'major') bucket.major++;
          else if (defect.severity === 'minor') bucket.minor++;
          else if (defect.severity === 'observation') bucket.observation++;
          break;
        }
      }
    }

    return monthBuckets;
  }, [defects, dateRange, counterpartyFilter]);

  const severityBreakdown = useMemo(() => {
    if (!Array.isArray(defects) || defects.length === 0) {
      return [];
    }

    let filteredDefects = [...defects];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredDefects = filteredDefects.filter(
          (d) => d && d.createdAt && new Date(d.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredDefects = filteredDefects.filter(
          (d) => d && d.createdAt && new Date(d.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredDefects = filteredDefects.filter(
        (d) => d && d.sellerId === counterpartyFilter,
      );
    }

    const severityMap = new Map();

    for (const defect of filteredDefects) {
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
  }, [defects, dateRange, counterpartyFilter]);

  const rootCauseBreakdown = useMemo(() => {
    if (!Array.isArray(defects) || defects.length === 0) {
      return [];
    }

    let filteredDefects = [...defects];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredDefects = filteredDefects.filter(
          (d) => d && d.createdAt && new Date(d.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredDefects = filteredDefects.filter(
          (d) => d && d.createdAt && new Date(d.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredDefects = filteredDefects.filter(
        (d) => d && d.sellerId === counterpartyFilter,
      );
    }

    const causeMap = new Map();

    for (const defect of filteredDefects) {
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
  }, [defects, dateRange, counterpartyFilter]);

  const totalDefects = trendData.reduce((sum, b) => sum + b.totalDefects, 0);

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
          <p className='text-sm'>No defect trend data available for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Monthly Defect Counts ({totalDefects} total)
          </h3>
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
              <XAxis
                dataKey='label'
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
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType='circle'
                iconSize={8}
              />
              <Line
                type='monotone'
                dataKey='totalDefects'
                stroke='#4c6ef5'
                strokeWidth={2}
                dot={{ r: 4, fill: '#4c6ef5', strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name='Total Defects'
              />
              <Line
                type='monotone'
                dataKey='critical'
                stroke='#ef4444'
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                name='Critical'
              />
              <Line
                type='monotone'
                dataKey='major'
                stroke='#f97316'
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                name='Major'
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Defects by Severity
          </h3>
          {severityBreakdown.length > 0 ? (
            <ResponsiveContainer width='100%' height={300}>
              <PieChart>
                <Pie
                  data={severityBreakdown}
                  cx='50%'
                  cy='50%'
                  innerRadius={60}
                  outerRadius={100}
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
          ) : (
            <div className='flex items-center justify-center h-[300px] text-gray-400'>
              <p className='text-sm'>No severity data available.</p>
            </div>
          )}
        </div>
      </div>

      {rootCauseBreakdown.length > 0 && (
        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Defects by Root Cause
          </h3>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={rootCauseBreakdown}
                  cx='50%'
                  cy='50%'
                  innerRadius={55}
                  outerRadius={90}
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

            <div className='space-y-2'>
              {rootCauseBreakdown.map((item) => {
                const total = rootCauseBreakdown.reduce((sum, i) => sum + i.value, 0);
                const percentage = total > 0 ? Math.round((item.value / total) * 10000) / 100 : 0;

                return (
                  <div key={item.name} className='flex items-center gap-3'>
                    <div
                      className='w-3 h-3 rounded-full flex-shrink-0'
                      style={{ backgroundColor: item.color }}
                    />
                    <span className='text-sm text-gray-700 flex-1 min-w-0 truncate'>
                      {item.name}
                    </span>
                    <span className='text-sm font-mono text-gray-500 flex-shrink-0'>
                      {item.value}
                    </span>
                    <span className='text-xs text-gray-400 w-12 text-right flex-shrink-0'>
                      {percentage}%
                    </span>
                    <div className='w-24 bg-gray-200 rounded-full h-2 overflow-hidden flex-shrink-0'>
                      <div
                        className='h-full rounded-full transition-all duration-300'
                        style={{
                          width: `${Math.max(2, percentage)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

DefectTrendReport.propTypes = {
  defects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      severity: PropTypes.string,
      rootCause: PropTypes.string,
      createdAt: PropTypes.string,
      sellerId: PropTypes.string,
    }),
  ),
  loans: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
    }),
  ),
  dateRange: PropTypes.shape({
    startDate: PropTypes.string,
    endDate: PropTypes.string,
  }),
  counterpartyFilter: PropTypes.string,
};

DefectTrendReport.defaultProps = {
  defects: [],
  loans: [],
  dateRange: null,
  counterpartyFilter: '',
};

const ConcentrationReport = ({ loans, defects, counterparties, dateRange, counterpartyFilter }) => {
  const byProductType = useMemo(() => {
    if (!Array.isArray(loans) || loans.length === 0) {
      return [];
    }

    let filteredLoans = [...loans];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredLoans = filteredLoans.filter(
          (l) => l && l.createdAt && new Date(l.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredLoans = filteredLoans.filter(
          (l) => l && l.createdAt && new Date(l.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredLoans = filteredLoans.filter(
        (l) => l && l.sellerId === counterpartyFilter,
      );
    }

    const productMap = new Map();

    for (const loan of filteredLoans) {
      if (!loan || !loan.productType) continue;
      const productType = loan.productType;
      productMap.set(productType, (productMap.get(productType) || 0) + 1);
    }

    const total = filteredLoans.length;
    const result = [];

    for (const [productType, count] of productMap.entries()) {
      result.push({
        name: PRODUCT_TYPE_LABELS[productType] || productType,
        value: count,
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
        color: CHART_COLORS[result.length % CHART_COLORS.length],
      });
    }

    result.sort((a, b) => b.value - a.value);

    return result;
  }, [loans, dateRange, counterpartyFilter]);

  const byChannel = useMemo(() => {
    if (!Array.isArray(loans) || loans.length === 0) {
      return [];
    }

    let filteredLoans = [...loans];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredLoans = filteredLoans.filter(
          (l) => l && l.createdAt && new Date(l.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredLoans = filteredLoans.filter(
          (l) => l && l.createdAt && new Date(l.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredLoans = filteredLoans.filter(
        (l) => l && l.sellerId === counterpartyFilter,
      );
    }

    const channelMap = new Map();

    for (const loan of filteredLoans) {
      if (!loan || !loan.channel) continue;
      const channel = loan.channel;
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    }

    const total = filteredLoans.length;
    const result = [];

    for (const [channel, count] of channelMap.entries()) {
      result.push({
        name: CHANNEL_LABELS[channel] || channel,
        value: count,
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
        color: CHART_COLORS[result.length % CHART_COLORS.length],
      });
    }

    result.sort((a, b) => b.value - a.value);

    return result;
  }, [loans, dateRange, counterpartyFilter]);

  const byCounterparty = useMemo(() => {
    if (!Array.isArray(loans) || loans.length === 0) {
      return [];
    }

    let filteredLoans = [...loans];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredLoans = filteredLoans.filter(
          (l) => l && l.createdAt && new Date(l.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredLoans = filteredLoans.filter(
          (l) => l && l.createdAt && new Date(l.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredLoans = filteredLoans.filter(
        (l) => l && l.sellerId === counterpartyFilter,
      );
    }

    const counterpartyMap = new Map();

    for (const loan of filteredLoans) {
      if (!loan || !loan.sellerId) continue;
      const sellerId = loan.sellerId;
      counterpartyMap.set(sellerId, (counterpartyMap.get(sellerId) || 0) + 1);
    }

    const total = filteredLoans.length;
    const result = [];

    for (const [sellerId, count] of counterpartyMap.entries()) {
      const counterparty = Array.isArray(counterparties)
        ? counterparties.find((cp) => cp && cp.id === sellerId)
        : null;
      const name = counterparty ? counterparty.name : sellerId;

      result.push({
        name,
        counterpartyId: sellerId,
        value: count,
        percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
        color: CHART_COLORS[result.length % CHART_COLORS.length],
      });
    }

    result.sort((a, b) => b.value - a.value);

    return result.slice(0, 10);
  }, [loans, counterparties, dateRange, counterpartyFilter]);

  const totalLoans = Array.isArray(loans) ? loans.length : 0;

  if (totalLoans === 0) {
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
          <p className='text-sm'>No concentration data available for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {byProductType.length > 0 && (
          <div>
            <h3 className='text-sm font-semibold text-gray-700 mb-4'>
              Loans by Product Type
            </h3>
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={byProductType}
                  cx='50%'
                  cy='50%'
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey='value'
                >
                  {byProductType.map((entry, index) => (
                    <Cell key={`product-${index}`} fill={entry.color} />
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
        )}

        {byChannel.length > 0 && (
          <div>
            <h3 className='text-sm font-semibold text-gray-700 mb-4'>
              Loans by Channel
            </h3>
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={byChannel}
                  cx='50%'
                  cy='50%'
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey='value'
                >
                  {byChannel.map((entry, index) => (
                    <Cell key={`channel-${index}`} fill={entry.color} />
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
        )}
      </div>

      {byCounterparty.length > 0 && (
        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Top Counterparties by Loan Volume
          </h3>
          <div className='overflow-x-auto'>
            <table className='table-enterprise'>
              <thead>
                <tr>
                  <th>Counterparty</th>
                  <th>Loan Count</th>
                  <th>% of Total</th>
                  <th>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {byCounterparty.map((entry) => (
                  <tr key={entry.counterpartyId}>
                    <td>
                      <div className='flex flex-col'>
                        <span className='text-sm font-medium text-gray-900'>
                          {entry.name}
                        </span>
                        <span className='text-xs text-gray-400 font-mono'>
                          {entry.counterpartyId}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className='text-sm font-semibold text-gray-900'>
                        {entry.value}
                      </span>
                    </td>
                    <td>
                      <span className='text-sm text-gray-600'>
                        {entry.percentage}%
                      </span>
                    </td>
                    <td>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 max-w-[120px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                          <div
                            className='h-full rounded-full transition-all duration-300'
                            style={{
                              width: `${Math.max(2, entry.percentage)}%`,
                              backgroundColor: entry.color,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

ConcentrationReport.propTypes = {
  loans: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      productType: PropTypes.string,
      channel: PropTypes.string,
      sellerId: PropTypes.string,
      createdAt: PropTypes.string,
    }),
  ),
  defects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      sellerId: PropTypes.string,
    }),
  ),
  counterparties: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
    }),
  ),
  dateRange: PropTypes.shape({
    startDate: PropTypes.string,
    endDate: PropTypes.string,
  }),
  counterpartyFilter: PropTypes.string,
};

ConcentrationReport.defaultProps = {
  loans: [],
  defects: [],
  counterparties: [],
  dateRange: null,
  counterpartyFilter: '',
};

const AgingSLAReport = ({ repurchaseCases, remedyCases, dateRange, counterpartyFilter }) => {
  const agingData = useMemo(() => {
    if (!Array.isArray(repurchaseCases) || repurchaseCases.length === 0) {
      return [];
    }

    let filteredCases = [...repurchaseCases];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredCases = filteredCases.filter(
          (c) => c && c.createdAt && new Date(c.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredCases = filteredCases.filter(
          (c) => c && c.createdAt && new Date(c.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredCases = filteredCases.filter(
        (c) => c && c.sellerId === counterpartyFilter,
      );
    }

    const bucketMap = new Map();
    const buckets = ['0-30', '31-60', '61-90', '91-180', '180+'];

    for (const bucket of buckets) {
      bucketMap.set(bucket, {
        name: AGING_BUCKET_LABELS[bucket] || bucket,
        bucket,
        count: 0,
        exposure: 0,
        color: AGING_BUCKET_COLORS[bucket] || '#6b7280',
      });
    }

    for (const repurchaseCase of filteredCases) {
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
    for (const bucket of buckets) {
      const entry = bucketMap.get(bucket);
      if (entry && entry.count > 0) {
        result.push({
          ...entry,
          exposure: Math.round(entry.exposure * 100) / 100,
        });
      }
    }

    return result;
  }, [repurchaseCases, dateRange, counterpartyFilter]);

  const slaData = useMemo(() => {
    if (!Array.isArray(remedyCases) || remedyCases.length === 0) {
      return { breached: 0, onTrack: 0, total: 0 };
    }

    let filteredCases = [...remedyCases];

    if (dateRange && dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      if (!isNaN(startDate.getTime())) {
        filteredCases = filteredCases.filter(
          (c) => c && c.createdAt && new Date(c.createdAt) >= startDate,
        );
      }
    }

    if (dateRange && dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      if (!isNaN(endDate.getTime())) {
        filteredCases = filteredCases.filter(
          (c) => c && c.createdAt && new Date(c.createdAt) <= endDate,
        );
      }
    }

    if (counterpartyFilter && counterpartyFilter.trim() !== '') {
      filteredCases = filteredCases.filter(
        (c) => c && c.sellerId === counterpartyFilter,
      );
    }

    const breached = filteredCases.filter(
      (c) =>
        c &&
        c.slaBreached === true &&
        c.status !== 'closed' &&
        c.status !== 'resolved',
    ).length;

    const onTrack = filteredCases.filter(
      (c) =>
        c &&
        c.slaBreached !== true &&
        c.status !== 'closed' &&
        c.status !== 'resolved',
    ).length;

    return {
      breached,
      onTrack,
      total: filteredCases.length,
    };
  }, [remedyCases, dateRange, counterpartyFilter]);

  const totalCount = agingData.reduce((sum, item) => sum + item.count, 0);
  const totalExposure = agingData.reduce((sum, item) => sum + item.exposure, 0);

  if (agingData.length === 0 && slaData.total === 0) {
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
            <circle cx='12' cy='12' r='10' />
            <polyline points='12 6 12 12 16 14' />
          </svg>
          <p className='text-sm'>No aging or SLA data available for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {agingData.length > 0 && (
        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Repurchase Case Aging
          </h3>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <ResponsiveContainer width='100%' height={300}>
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

            <div className='space-y-3'>
              {agingData.map((item) => {
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
                    key={item.bucket}
                    className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <div className='flex items-center gap-2'>
                        <span
                          className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border'
                          style={{
                            backgroundColor: item.color + '20',
                            color: item.color,
                            borderColor: item.color + '40',
                          }}
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

          {agingData.length > 0 && (
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
                  {agingData.map((item) => {
                    const countPercentage =
                      totalCount > 0
                        ? Math.round((item.count / totalCount) * 10000) / 100
                        : 0;

                    const exposurePercentage =
                      totalExposure > 0
                        ? Math.round((item.exposure / totalExposure) * 10000) / 100
                        : 0;

                    return (
                      <tr key={item.bucket}>
                        <td>
                          <span
                            className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border'
                            style={{
                              backgroundColor: item.color + '20',
                              color: item.color,
                              borderColor: item.color + '40',
                            }}
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
      )}

      {slaData.total > 0 && (
        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Remedy Case SLA Status
          </h3>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200 text-center'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Total Cases
              </p>
              <p className='text-2xl font-bold text-gray-900'>{slaData.total}</p>
            </div>

            <div className='p-4 rounded-xl bg-red-50 border border-red-200 text-center'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                SLA Breached
              </p>
              <p className='text-2xl font-bold text-red-700'>{slaData.breached}</p>
              {slaData.total > 0 && (
                <p className='text-xs text-red-600 mt-1'>
                  {Math.round((slaData.breached / slaData.total) * 100)}% of cases
                </p>
              )}
            </div>

            <div className='p-4 rounded-xl bg-green-50 border border-green-200 text-center'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                On Track
              </p>
              <p className='text-2xl font-bold text-green-700'>{slaData.onTrack}</p>
              {slaData.total > 0 && (
                <p className='text-xs text-green-600 mt-1'>
                  {Math.round((slaData.onTrack / slaData.total) * 100)}% of cases
                </p>
              )}
            </div>
          </div>

          {slaData.total > 0 && (
            <div className='mt-4'>
              <div className='w-full bg-gray-200 rounded-full h-4 overflow-hidden'>
                <div
                  className='h-full rounded-full bg-red-500 transition-all duration-300'
                  style={{
                    width: `${Math.max(2, Math.round((slaData.breached / slaData.total) * 100))}%`,
                  }}
                />
              </div>
              <div className='flex items-center justify-between mt-2 text-xs text-gray-400'>
                <span>Breached: {slaData.breached}</span>
                <span>On Track: {slaData.onTrack}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AgingSLAReport.propTypes = {
  repurchaseCases: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      sellerId: PropTypes.string,
      status: PropTypes.string,
      createdAt: PropTypes.string,
      demandAmount: PropTypes.number,
      exposure: PropTypes.number,
      alternativeProposal: PropTypes.shape({
        status: PropTypes.string,
        amount: PropTypes.number,
      }),
      finalOutcome: PropTypes.shape({
        settledAmount: PropTypes.number,
      }),
    }),
  ),
  remedyCases: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      sellerId: PropTypes.string,
      status: PropTypes.string,
      slaBreached: PropTypes.bool,
      createdAt: PropTypes.string,
    }),
  ),
  dateRange: PropTypes.shape({
    startDate: PropTypes.string,
    endDate: PropTypes.string,
  }),
  counterpartyFilter: PropTypes.string,
};

AgingSLAReport.defaultProps = {
  repurchaseCases: [],
  remedyCases: [],
  dateRange: null,
  counterpartyFilter: '',
};

const ReportsPage = () => {
  const navigate = useNavigate();
  const { loans, defects, sellers, repurchaseCases, remedyCases } = useMockData();
  const { currentPersona } = useAuth();

  const [activeTab, setActiveTab] = useState('defect-trends');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [counterpartyFilter, setCounterpartyFilter] = useState('');

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

  const safeSellers = useMemo(() => {
    return Array.isArray(sellers) ? sellers : [];
  }, [sellers]);

  const safeRepurchaseCases = useMemo(() => {
    return Array.isArray(repurchaseCases) ? repurchaseCases : [];
  }, [repurchaseCases]);

  const safeRemedyCases = useMemo(() => {
    return Array.isArray(remedyCases) ? remedyCases : [];
  }, [remedyCases]);

  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
  }, []);

  const handleDateRangeChange = useCallback((field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleCounterpartyFilterChange = useCallback((e) => {
    setCounterpartyFilter(e.target.value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setDateRange({
      startDate: '',
      endDate: '',
    });
    setCounterpartyFilter('');
  }, []);

  const hasActiveFilters = dateRange.startDate || dateRange.endDate || counterpartyFilter;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Reports', path: '/reports' },
  ];

  const exportData = useMemo(() => {
    if (activeTab === 'defect-trends') {
      return safeDefects.map((defect) => ({
        defectId: defect.id,
        severity: defect.severity,
        category: defect.category,
        subcategory: defect.subcategory,
        rootCause: defect.rootCause,
        counterparty: defect.sellerId,
        loanId: defect.loanId,
        status: defect.status,
        createdAt: defect.createdAt,
        closedAt: defect.closedAt,
      }));
    }

    if (activeTab === 'concentration') {
      return safeLoans.map((loan) => ({
        loanId: loan.id,
        productType: loan.productType,
        channel: loan.channel,
        counterparty: loan.sellerId,
        loanAmount: loan.loanAmount,
        status: loan.status,
        createdAt: loan.createdAt,
      }));
    }

    if (activeTab === 'aging-sla') {
      return safeRepurchaseCases.map((c) => ({
        caseId: c.id,
        counterparty: c.sellerId,
        loanId: c.loanId,
        demandAmount: c.demandAmount,
        exposure: c.exposure,
        status: c.status,
        agingBucket: getAgingBucket(c.createdAt, c.status) || 'Unknown',
        createdAt: c.createdAt,
      }));
    }

    return [];
  }, [activeTab, safeDefects, safeLoans, safeRepurchaseCases]);

  const exportFilename = useMemo(() => {
    switch (activeTab) {
      case 'defect-trends':
        return 'defect-trend-report';
      case 'concentration':
        return 'concentration-report';
      case 'aging-sla':
        return 'aging-sla-report';
      default:
        return 'report';
    }
  }, [activeTab]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Reports & Analytics</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Generate and export reports on defect trends, concentration, and aging/SLA metrics.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename={exportFilename}
              variant='secondary'
              label='Export'
            />
          </div>
        </div>

        <div className='card-enterprise'>
          <div className='flex flex-col lg:flex-row lg:items-center gap-4 mb-6'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='report-filter-start-date'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  From
                </label>
                <input
                  id='report-filter-start-date'
                  type='date'
                  value={dateRange.startDate}
                  onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by start date'
                />
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='report-filter-end-date'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  To
                </label>
                <input
                  id='report-filter-end-date'
                  type='date'
                  value={dateRange.endDate}
                  onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by end date'
                />
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <label
                htmlFor='report-filter-counterparty'
                className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
              >
                Counterparty
              </label>
              <select
                id='report-filter-counterparty'
                value={counterpartyFilter}
                onChange={handleCounterpartyFilterChange}
                className='input-enterprise w-56 py-1.5 text-sm'
                aria-label='Filter by counterparty'
              >
                <option value=''>All Counterparties</option>
                {safeSellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name || seller.id}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type='button'
                onClick={handleClearFilters}
                className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                aria-label='Clear all filters'
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
                Clear
              </button>
            )}
          </div>

          <div className='border-b border-gray-200 mb-6'>
            <nav className='flex gap-6 -mb-px' aria-label='Report tabs'>
              {REPORT_TABS.map((tab) => {
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

          {activeTab === 'defect-trends' && (
            <div className='animate-fade-in'>
              <DefectTrendReport
                defects={safeDefects}
                loans={safeLoans}
                dateRange={dateRange}
                counterpartyFilter={counterpartyFilter}
              />
            </div>
          )}

          {activeTab === 'concentration' && (
            <div className='animate-fade-in'>
              <ConcentrationReport
                loans={safeLoans}
                defects={safeDefects}
                counterparties={safeSellers}
                dateRange={dateRange}
                counterpartyFilter={counterpartyFilter}
              />
            </div>
          )}

          {activeTab === 'aging-sla' && (
            <div className='animate-fade-in'>
              <AgingSLAReport
                repurchaseCases={safeRepurchaseCases}
                remedyCases={safeRemedyCases}
                dateRange={dateRange}
                counterpartyFilter={counterpartyFilter}
              />
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  );
};

ReportsPage.propTypes = {};

export default ReportsPage;