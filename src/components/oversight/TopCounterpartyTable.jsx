import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { formatCurrency, formatPercentage, truncateText } from '../../utils/formatters';
import { debug } from '../../utils/logger';
import RiskBadge from './RiskBadge';

const COMPONENT_NAME = 'TopCounterpartyTable';

const RISK_TIER_LABELS = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  unknown: 'Unknown',
};

const RISK_TIER_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  moderate: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-green-100 text-green-700 border-green-200',
  unknown: 'bg-gray-100 text-gray-500 border-gray-200',
};

const TopCounterpartyTable = ({ counterparties, onRowClick, className = '' }) => {
  const navigate = useNavigate();

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeCounterparties = useMemo(() => {
    if (!Array.isArray(counterparties)) {
      return [];
    }
    return counterparties;
  }, [counterparties]);

  const rankedCounterparties = useMemo(() => {
    if (safeCounterparties.length === 0) {
      return [];
    }

    const sorted = [...safeCounterparties]
      .filter((cp) => cp && cp.totalExposure !== undefined && cp.totalExposure !== null)
      .sort((a, b) => (b.totalExposure || 0) - (a.totalExposure || 0));

    return sorted.slice(0, 10);
  }, [safeCounterparties]);

  const totalExposure = useMemo(() => {
    if (rankedCounterparties.length === 0) {
      return 0;
    }

    return rankedCounterparties.reduce((sum, cp) => sum + (cp.totalExposure || 0), 0);
  }, [rankedCounterparties]);

  const handleRowClick = useCallback(
    (entry) => {
      if (!entry || !entry.counterpartyId) return;

      if (typeof onRowClick === 'function') {
        onRowClick(entry);
      } else {
        navigate(`/counterparties/${entry.counterpartyId}`);
      }
    },
    [onRowClick, navigate],
  );

  const handleKeyDown = useCallback(
    (e, entry) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRowClick(entry);
      }
    },
    [handleRowClick],
  );

  if (safeCounterparties.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
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
              <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
              <circle cx='9' cy='7' r='4' />
              <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
              <path d='M16 3.13a4 4 0 0 1 0 7.75' />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Counterparty Data</h3>
          <p className='text-sm text-gray-500 max-w-md mx-auto'>
            No counterparty exposure data is available for ranking.
          </p>
        </div>
      </div>
    );
  }

  if (rankedCounterparties.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
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
              <line x1='12' y1='1' x2='12' y2='23' />
              <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Exposure Data</h3>
          <p className='text-sm text-gray-500 max-w-md mx-auto'>
            No counterparties have recorded exposure amounts for ranking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-enterprise ${className}`}>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Top Counterparties by Exposure</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Top {rankedCounterparties.length} counterparties ranked by total financial exposure.
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-xs text-gray-400'>
            Total Exposure:{' '}
            <span className='font-mono font-semibold text-gray-700'>
              {formatCurrency(totalExposure)}
            </span>
          </span>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='table-enterprise'>
          <thead>
            <tr>
              <th className='w-12'>Rank</th>
              <th>Counterparty</th>
              <th>Exposure</th>
              <th>% of Total</th>
              <th>Risk Tier</th>
              <th className='w-12'></th>
            </tr>
          </thead>
          <tbody>
            {rankedCounterparties.map((entry, index) => {
              if (!entry) return null;

              const rank = index + 1;
              const exposure = entry.totalExposure || 0;
              const percentage =
                totalExposure > 0
                  ? Math.round((exposure / totalExposure) * 10000) / 100
                  : 0;
              const riskTier = entry.riskTier || 'unknown';
              const tierColor =
                RISK_TIER_COLORS[riskTier] || RISK_TIER_COLORS.unknown;
              const tierLabel =
                RISK_TIER_LABELS[riskTier] || riskTier || 'Unknown';

              const rankColor =
                rank === 1
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : rank === 2
                    ? 'bg-gray-200 text-gray-600 border-gray-300'
                    : rank === 3
                      ? 'bg-orange-100 text-orange-700 border-orange-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200';

              return (
                <tr
                  key={entry.counterpartyId || index}
                  className='cursor-pointer transition-colors duration-150 hover:bg-gray-50/70'
                  onClick={() => handleRowClick(entry)}
                  onKeyDown={(e) => handleKeyDown(e, entry)}
                  tabIndex={0}
                  role='row'
                  aria-label={`View details for ${entry.counterpartyName || entry.counterpartyId}`}
                >
                  <td>
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${rankColor}`}
                    >
                      {rank}
                    </span>
                  </td>
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
                    <span className='text-sm font-mono text-gray-700'>
                      {formatCurrency(exposure)}
                    </span>
                  </td>
                  <td>
                    <div className='flex items-center gap-2'>
                      <div className='flex-1 max-w-[80px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                          style={{ width: `${Math.max(2, percentage)}%` }}
                        />
                      </div>
                      <span className='text-sm text-gray-600'>
                        {percentage}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <RiskBadge tier={riskTier} />
                  </td>
                  <td className='text-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='w-4 h-4 text-gray-400'
                    >
                      <polyline points='9 18 15 12 9 6' />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rankedCounterparties.length > 0 && (
        <div className='mt-4 flex items-center gap-4 text-xs text-gray-400'>
          <span>
            {rankedCounterparties.length} counterpart{rankedCounterparties.length === 1 ? 'y' : 'ies'} displayed
          </span>
          <span>•</span>
          <span>
            Total exposure: {formatCurrency(totalExposure)}
          </span>
        </div>
      )}
    </div>
  );
};

TopCounterpartyTable.propTypes = {
  counterparties: PropTypes.arrayOf(
    PropTypes.shape({
      counterpartyId: PropTypes.string,
      counterpartyName: PropTypes.string,
      totalExposure: PropTypes.number,
      riskTier: PropTypes.string,
      riskScore: PropTypes.number,
      defectRate: PropTypes.number,
      criticalDefectRate: PropTypes.number,
      passRate: PropTypes.number,
      onWatchlist: PropTypes.bool,
    }),
  ),
  onRowClick: PropTypes.func,
  className: PropTypes.string,
};

TopCounterpartyTable.defaultProps = {
  counterparties: [],
  onRowClick: null,
  className: '',
};

export default TopCounterpartyTable;