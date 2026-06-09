import { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  PieChart,
  Pie,
  Cell,
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

const COMPONENT_NAME = 'DefectAnalysisPanel';

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

const DefectAnalysisPanel = ({
  defectBreakdown,
  defects,
  className = '',
}) => {
  const safeDefectBreakdown = useMemo(() => {
    if (!Array.isArray(defectBreakdown)) {
      return [];
    }
    return defectBreakdown;
  }, [defectBreakdown]);

  const safeDefects = useMemo(() => {
    if (!Array.isArray(defects)) {
      return [];
    }
    return defects;
  }, [defects]);

  const severityBreakdown = useMemo(() => {
    if (safeDefects.length === 0) {
      return [];
    }

    const severityMap = new Map();

    for (const defect of safeDefects) {
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
  }, [safeDefects]);

  const rootCauseBreakdown = useMemo(() => {
    if (safeDefects.length === 0) {
      return [];
    }

    const causeMap = new Map();

    for (const defect of safeDefects) {
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
  }, [safeDefects]);

  const categoryBreakdown = useMemo(() => {
    if (safeDefectBreakdown.length === 0) {
      return [];
    }

    return safeDefectBreakdown.map((item, index) => ({
      name: item.category || 'Unknown',
      value: item.count || 0,
      percentage: item.percentage || 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [safeDefectBreakdown]);

  const totalDefects = safeDefects.length;

  if (totalDefects === 0) {
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
              <circle cx='12' cy='12' r='10' />
              <line x1='15' y1='9' x2='9' y2='15' />
              <line x1='9' y1='9' x2='15' y2='15' />
            </svg>
            <p className='text-sm'>No defects recorded for this counterparty.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {severityBreakdown.length > 0 && (
          <div className='card-enterprise'>
            <h3 className='text-sm font-semibold text-gray-700 mb-4'>
              Defects by Severity
            </h3>
            <ResponsiveContainer width='100%' height={240}>
              <PieChart>
                <Pie
                  data={severityBreakdown}
                  cx='50%'
                  cy='50%'
                  innerRadius={55}
                  outerRadius={90}
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
          </div>
        )}

        {rootCauseBreakdown.length > 0 && (
          <div className='card-enterprise'>
            <h3 className='text-sm font-semibold text-gray-700 mb-4'>
              Defects by Root Cause
            </h3>
            <ResponsiveContainer width='100%' height={240}>
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
          </div>
        )}
      </div>

      {categoryBreakdown.length > 0 && (
        <div className='card-enterprise'>
          <h3 className='text-sm font-semibold text-gray-700 mb-4'>
            Defects by Category
          </h3>
          <div className='space-y-3'>
            {categoryBreakdown.map((item) => (
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
                  {item.percentage}%
                </span>
                <div className='w-28 bg-gray-200 rounded-full h-2 overflow-hidden flex-shrink-0'>
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

      {severityBreakdown.length === 0 &&
        rootCauseBreakdown.length === 0 &&
        categoryBreakdown.length === 0 && (
          <div className='card-enterprise'>
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
                  <line x1='12' y1='16' x2='12' y2='12' />
                  <line x1='12' y1='8' x2='12.01' y2='8' />
                </svg>
                <p className='text-sm'>
                  Insufficient data for defect analysis breakdown.
                </p>
              </div>
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
  className: PropTypes.string,
};

DefectAnalysisPanel.defaultProps = {
  defectBreakdown: [],
  defects: [],
  className: '',
};

export default DefectAnalysisPanel;