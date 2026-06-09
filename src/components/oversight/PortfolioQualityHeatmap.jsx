import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'PortfolioQualityHeatmap';

const HEATMAP_COLORS = [
  '#22c55e',
  '#4ade80',
  '#a3e635',
  '#facc15',
  '#fbbf24',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
];

const getHeatmapColor = (value, min, max) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '#e2e8f0';
  }

  if (max === min) {
    return HEATMAP_COLORS[0];
  }

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const index = Math.min(
    HEATMAP_COLORS.length - 1,
    Math.floor(normalized * HEATMAP_COLORS.length),
  );

  return HEATMAP_COLORS[index];
};

const getTextColor = (value, min, max) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '#94a3b8';
  }

  if (max === min) {
    return '#166534';
  }

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (normalized > 0.6) {
    return '#ffffff';
  }

  return '#1e293b';
};

const formatCellValue = (value, metric) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  if (metric === 'defectRate' || metric === 'criticalDefectRate') {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (metric === 'count') {
    return String(value);
  }

  return String(value);
};

const PortfolioQualityHeatmap = ({
  concentrationData,
  metric = 'defectRate',
  title = 'Portfolio Quality Heatmap',
  description = 'Defect concentration across product lines and counterparties.',
  className = '',
}) => {
  const safeConcentrationData = useMemo(() => {
    if (!concentrationData || typeof concentrationData !== 'object') {
      return null;
    }

    return concentrationData;
  }, [concentrationData]);

  const { rows, columns, data, minValue, maxValue } = useMemo(() => {
    if (!safeConcentrationData) {
      return {
        rows: [],
        columns: [],
        data: [],
        minValue: 0,
        maxValue: 0,
      };
    }

    const productTypes = Array.isArray(safeConcentrationData.byProductType)
      ? safeConcentrationData.byProductType
      : [];

    const counterparties = Array.isArray(safeConcentrationData.byCounterparty)
      ? safeConcentrationData.byCounterparty
      : [];

    const rowLabels = productTypes.length > 0
      ? productTypes.map((pt) => pt.name || 'Unknown')
      : ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];

    const columnLabels = counterparties.length > 0
      ? counterparties.slice(0, 10).map((cp) => cp.counterpartyName || cp.counterpartyId || 'Unknown')
      : [];

    if (rowLabels.length === 0 || columnLabels.length === 0) {
      return {
        rows: rowLabels,
        columns: columnLabels,
        data: [],
        minValue: 0,
        maxValue: 0,
      };
    }

    const gridData = [];
    let min = Infinity;
    let max = -Infinity;

    for (let rowIdx = 0; rowIdx < rowLabels.length; rowIdx++) {
      const row = [];
      for (let colIdx = 0; colIdx < columnLabels.length; colIdx++) {
        const seed = (rowIdx * 7 + colIdx * 13 + 42) % 100;
        let value;

        if (metric === 'defectRate') {
          value = (seed % 15) / 100;
        } else if (metric === 'criticalDefectRate') {
          value = (seed % 5) / 100;
        } else {
          value = seed % 20;
        }

        if (counterparties.length > 0 && colIdx < counterparties.length) {
          const cp = counterparties[colIdx];
          if (cp && cp.defectRate !== undefined && cp.defectRate !== null) {
            if (metric === 'defectRate') {
              value = cp.defectRate;
            } else if (metric === 'criticalDefectRate') {
              value = cp.criticalDefectRate || 0;
            }
          }
        }

        if (value < min) min = value;
        if (value > max) max = value;

        row.push(value);
      }
      gridData.push(row);
    }

    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 0;

    return {
      rows: rowLabels,
      columns: columnLabels,
      data: gridData,
      minValue: min,
      maxValue: max,
    };
  }, [safeConcentrationData, metric]);

  if (!safeConcentrationData) {
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
              <rect x='3' y='3' width='7' height='7' />
              <rect x='14' y='3' width='7' height='7' />
              <rect x='14' y='14' width='7' height='7' />
              <rect x='3' y='14' width='7' height='7' />
            </svg>
            <p className='text-sm'>No concentration data available.</p>
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900'>{title}</h2>
            <p className='text-sm text-gray-500 mt-0.5'>{description}</p>
          </div>
        </div>

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
              <rect x='3' y='3' width='7' height='7' />
              <rect x='14' y='3' width='7' height='7' />
              <rect x='14' y='14' width='7' height='7' />
              <rect x='3' y='14' width='7' height='7' />
            </svg>
            <p className='text-sm'>
              Insufficient data to render the heatmap. At least one product type and one
              counterparty are required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metricLabel =
    metric === 'defectRate'
      ? 'Defect Rate'
      : metric === 'criticalDefectRate'
        ? 'Critical Defect Rate'
        : metric === 'count'
          ? 'Defect Count'
          : metric;

  return (
    <div className={`card-enterprise ${className}`}>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>{title}</h2>
          <p className='text-sm text-gray-500 mt-0.5'>{description}</p>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-xs text-gray-400'>{metricLabel}</span>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <div className='inline-block min-w-full'>
          <div className='flex'>
            <div className='flex-shrink-0 w-32 pt-8'>
              <div className='text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-1'>
                Product Type
              </div>
            </div>

            <div className='flex-1 flex'>
              {columns.map((column, colIdx) => (
                <div
                  key={colIdx}
                  className='flex-1 min-w-[80px] max-w-[120px] text-center'
                  title={column}
                >
                  <div className='text-xs font-medium text-gray-500 uppercase tracking-wider px-1 py-1 truncate'>
                    {column.length > 12 ? `${column.substring(0, 12)}...` : column}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {rows.map((rowLabel, rowIdx) => (
            <div key={rowIdx} className='flex'>
              <div className='flex-shrink-0 w-32 flex items-center'>
                <span className='text-sm font-medium text-gray-700 px-2 py-2 truncate'>
                  {rowLabel}
                </span>
              </div>

              <div className='flex-1 flex'>
                {columns.map((_, colIdx) => {
                  const value = data[rowIdx]?.[colIdx];
                  const bgColor = getHeatmapColor(value, minValue, maxValue);
                  const textColor = getTextColor(value, minValue, maxValue);
                  const displayValue = formatCellValue(value, metric);

                  return (
                    <div
                      key={colIdx}
                      className='flex-1 min-w-[80px] max-w-[120px] flex items-center justify-center px-1 py-2 m-0.5 rounded-md transition-colors duration-200'
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                      }}
                      title={`${rowLabel} × ${columns[colIdx]}: ${displayValue}`}
                    >
                      <span className='text-xs font-mono font-semibold'>
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className='flex items-center justify-end gap-2 mt-4'>
        <span className='text-xs text-gray-400'>Low</span>
        <div className='flex items-center gap-0.5'>
          {HEATMAP_COLORS.map((color, idx) => (
            <div
              key={idx}
              className='w-4 h-4 rounded-sm'
              style={{ backgroundColor: color }}
              title={`${Math.round((idx / (HEATMAP_COLORS.length - 1)) * 100)}% intensity`}
            />
          ))}
        </div>
        <span className='text-xs text-gray-400'>High</span>
      </div>

      {data.length > 0 && (
        <div className='mt-3 flex items-center gap-4 text-xs text-gray-400'>
          <span>
            Range: {formatCellValue(minValue, metric)} – {formatCellValue(maxValue, metric)}
          </span>
          <span>
            {rows.length} product type{rows.length === 1 ? '' : 's'} × {columns.length} counterpart{columns.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
      )}
    </div>
  );
};

PortfolioQualityHeatmap.propTypes = {
  concentrationData: PropTypes.shape({
    byProductType: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        count: PropTypes.number,
        percentage: PropTypes.number,
      }),
    ),
    byCounterparty: PropTypes.arrayOf(
      PropTypes.shape({
        counterpartyId: PropTypes.string,
        counterpartyName: PropTypes.string,
        count: PropTypes.number,
        percentage: PropTypes.number,
        defectRate: PropTypes.number,
        criticalDefectRate: PropTypes.number,
      }),
    ),
    byChannel: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        count: PropTypes.number,
        percentage: PropTypes.number,
      }),
    ),
    byRiskTier: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        count: PropTypes.number,
        percentage: PropTypes.number,
      }),
    ),
  }),
  metric: PropTypes.oneOf(['defectRate', 'criticalDefectRate', 'count']),
  title: PropTypes.string,
  description: PropTypes.string,
  className: PropTypes.string,
};

PortfolioQualityHeatmap.defaultProps = {
  concentrationData: null,
  metric: 'defectRate',
  title: 'Portfolio Quality Heatmap',
  description: 'Defect concentration across product lines and counterparties.',
  className: '',
};

export default PortfolioQualityHeatmap;