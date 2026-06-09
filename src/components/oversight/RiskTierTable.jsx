import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../../hooks/usePagination';
import { useExport } from '../../hooks/useExport';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../../utils/formatters';
import { debug, warn } from '../../utils/logger';
import Pagination from '../shared/Pagination';
import ExportButton from '../shared/ExportButton';

const COMPONENT_NAME = 'RiskTierTable';

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

const RISK_TIER_ORDER = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  unknown: 4,
};

const ALERT_STATUS_LABELS = {
  active: 'Active Alerts',
  none: 'No Alerts',
  acknowledged: 'Acknowledged',
};

const ALERT_STATUS_COLORS = {
  active: 'bg-red-100 text-red-700 border-red-200',
  none: 'bg-green-100 text-green-700 border-green-200',
  acknowledged: 'bg-amber-100 text-amber-700 border-amber-200',
};

const WATCHLIST_STATUS_LABELS = {
  active: 'On Watchlist',
  monitoring: 'Monitoring',
  cleared: 'Cleared',
  none: 'Not on Watchlist',
};

const WATCHLIST_STATUS_COLORS = {
  active: 'bg-purple-100 text-purple-700 border-purple-200',
  monitoring: 'bg-amber-100 text-amber-700 border-amber-200',
  cleared: 'bg-green-100 text-green-700 border-green-200',
  none: 'bg-gray-100 text-gray-500 border-gray-200',
};

const SORT_OPTIONS = [
  { value: 'riskTier-asc', label: 'Risk Tier (Low to High)' },
  { value: 'riskTier-desc', label: 'Risk Tier (High to Low)' },
  { value: 'defectRate-desc', label: 'Defect Rate (High to Low)' },
  { value: 'defectRate-asc', label: 'Defect Rate (Low to High)' },
  { value: 'openRemedies-desc', label: 'Open Remedies (High to Low)' },
  { value: 'openRemedies-asc', label: 'Open Remedies (Low to High)' },
  { value: 'exposure-desc', label: 'Exposure (High to Low)' },
  { value: 'exposure-asc', label: 'Exposure (Low to High)' },
  { value: 'name-asc', label: 'Name (A to Z)' },
  { value: 'name-desc', label: 'Name (Z to A)' },
];

const getAlertStatus = (counterpartyId, alertRules) => {
  if (!Array.isArray(alertRules) || alertRules.length === 0) {
    return 'none';
  }

  const counterpartyAlerts = alertRules.filter(
    (alert) => alert && alert.counterpartyId === counterpartyId,
  );

  if (counterpartyAlerts.length === 0) {
    return 'none';
  }

  const activeAlerts = counterpartyAlerts.filter(
    (alert) => alert && !alert.acknowledged && !alert.resolvedAt,
  );

  if (activeAlerts.length > 0) {
    return 'active';
  }

  const acknowledgedAlerts = counterpartyAlerts.filter(
    (alert) => alert && alert.acknowledged && !alert.resolvedAt,
  );

  if (acknowledgedAlerts.length > 0) {
    return 'acknowledged';
  }

  return 'none';
};

const getAlertCount = (counterpartyId, alertRules) => {
  if (!Array.isArray(alertRules) || alertRules.length === 0) {
    return 0;
  }

  return alertRules.filter(
    (alert) =>
      alert &&
      alert.counterpartyId === counterpartyId &&
      !alert.acknowledged &&
      !alert.resolvedAt,
  ).length;
};

const RiskTierTable = ({
  data,
  onRowClick,
  alertRules,
  watchlistEntries,
  className = '',
}) => {
  const navigate = useNavigate();

  const [sortOption, setSortOption] = useState('riskTier-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [watchlistFilter, setWatchlistFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }
    return data;
  }, [data]);

  const safeAlertRules = useMemo(() => {
    if (!Array.isArray(alertRules)) {
      return [];
    }
    return alertRules;
  }, [alertRules]);

  const safeWatchlistEntries = useMemo(() => {
    if (!Array.isArray(watchlistEntries)) {
      return [];
    }
    return watchlistEntries;
  }, [watchlistEntries]);

  const watchlistMap = useMemo(() => {
    const map = new Map();

    for (const entry of safeWatchlistEntries) {
      if (entry && entry.counterpartyId) {
        map.set(entry.counterpartyId, entry);
      }
    }

    return map;
  }, [safeWatchlistEntries]);

  const filteredData = useMemo(() => {
    let filtered = [...safeData];

    if (tierFilter && typeof tierFilter === 'string') {
      filtered = filtered.filter(
        (entry) => entry && entry.riskTier === tierFilter,
      );
    }

    if (watchlistFilter === 'on_watchlist') {
      filtered = filtered.filter(
        (entry) => entry && watchlistMap.has(entry.counterpartyId),
      );
    } else if (watchlistFilter === 'not_on_watchlist') {
      filtered = filtered.filter(
        (entry) => entry && !watchlistMap.has(entry.counterpartyId),
      );
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((entry) => {
        if (!entry) return false;
        return (
          (entry.counterpartyId && entry.counterpartyId.toLowerCase().includes(searchLower)) ||
          (entry.counterpartyName && entry.counterpartyName.toLowerCase().includes(searchLower))
        );
      });
    }

    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      switch (sortOption) {
        case 'riskTier-desc': {
          const aOrder = RISK_TIER_ORDER[a.riskTier] ?? 99;
          const bOrder = RISK_TIER_ORDER[b.riskTier] ?? 99;
          return aOrder - bOrder;
        }
        case 'riskTier-asc': {
          const aOrder = RISK_TIER_ORDER[a.riskTier] ?? 99;
          const bOrder = RISK_TIER_ORDER[b.riskTier] ?? 99;
          return bOrder - aOrder;
        }
        case 'defectRate-desc':
          return (b.defectRate || 0) - (a.defectRate || 0);
        case 'defectRate-asc':
          return (a.defectRate || 0) - (b.defectRate || 0);
        case 'openRemedies-desc':
          return (b.openRemedyCases || 0) - (a.openRemedyCases || 0);
        case 'openRemedies-asc':
          return (a.openRemedyCases || 0) - (b.openRemedyCases || 0);
        case 'exposure-desc':
          return (b.totalExposure || 0) - (a.totalExposure || 0);
        case 'exposure-asc':
          return (a.totalExposure || 0) - (b.totalExposure || 0);
        case 'name-asc':
          return (a.counterpartyName || '').localeCompare(b.counterpartyName || '');
        case 'name-desc':
          return (b.counterpartyName || '').localeCompare(a.counterpartyName || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [safeData, tierFilter, watchlistFilter, searchQuery, sortOption, watchlistMap]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredData, { initialPageSize: 25 });

  const handleSortChange = useCallback(
    (e) => {
      setSortOption(e.target.value);
      setPage(1);
    },
    [setPage],
  );

  const handleSearchChange = useCallback(
    (e) => {
      setSearchQuery(e.target.value);
      setPage(1);
    },
    [setPage],
  );

  const handleTierFilterChange = useCallback(
    (e) => {
      setTierFilter(e.target.value);
      setPage(1);
    },
    [setPage],
  );

  const handleWatchlistFilterChange = useCallback(
    (e) => {
      setWatchlistFilter(e.target.value);
      setPage(1);
    },
    [setPage],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setTierFilter('');
    setWatchlistFilter('');
    setSortOption('riskTier-desc');
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleRowClick = useCallback(
    (entry) => {
      if (!entry || !entry.counterpartyId) return;

      if (typeof onRowClick === 'function') {
        onRowClick(entry);
      }
    },
    [onRowClick],
  );

  const handleViewScorecard = useCallback(
    (e, counterpartyId) => {
      e.stopPropagation();

      if (!counterpartyId) return;

      navigate(`/counterparties/${counterpartyId}`);
    },
    [navigate],
  );

  const handleAddToWatchlist = useCallback(
    (e, counterpartyId) => {
      e.stopPropagation();

      if (!counterpartyId) return;

      navigate(`/counterparties/${counterpartyId}?action=addToWatchlist`);
    },
    [navigate],
  );

  const handleToggleRow = useCallback((counterpartyId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(counterpartyId)) {
        next.delete(counterpartyId);
      } else {
        next.add(counterpartyId);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e, entry) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRowClick(entry);
      }
    },
    [handleRowClick],
  );

  const hasActiveFilters = tierFilter || watchlistFilter || searchQuery;

  const exportData = useMemo(() => {
    return filteredData.map((entry) => {
      if (!entry) return null;

      const alertStatus = getAlertStatus(entry.counterpartyId, safeAlertRules);
      const alertCount = getAlertCount(entry.counterpartyId, safeAlertRules);
      const watchlistEntry = watchlistMap.get(entry.counterpartyId);
      const watchlistStatus = watchlistEntry ? watchlistEntry.status || 'active' : 'none';

      return {
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterpartyName,
        riskTier: entry.riskTier,
        riskScore: entry.riskScore,
        defectRate: entry.defectRate,
        criticalDefectRate: entry.criticalDefectRate,
        openRemedyCases: entry.openRemedyCases,
        totalExposure: entry.totalExposure,
        breachCount: entry.breachCount,
        avgRemedyResponseDays: entry.avgRemedyResponseDays,
        alertStatus,
        alertCount,
        watchlistStatus,
      };
    }).filter(Boolean);
  }, [filteredData, safeAlertRules, watchlistMap]);

  const tierCounts = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      unknown: 0,
    };

    for (const entry of safeData) {
      if (!entry) continue;
      const tier = entry.riskTier || 'unknown';
      if (counts[tier] !== undefined) {
        counts[tier]++;
      }
    }

    return counts;
  }, [safeData]);

  if (safeData.length === 0) {
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
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Risk Tier Data</h3>
          <p className='text-sm text-gray-500 max-w-md mx-auto'>
            No counterparty risk tier data is available. Click &ldquo;Recalculate Risk Tiers&rdquo; to generate risk scores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4'>
        <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
          <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
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
              <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
              <circle cx='9' cy='7' r='4' />
              <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
              <path d='M16 3.13a4 4 0 0 1 0 7.75' />
            </svg>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Total
            </p>
            <p className='text-2xl font-bold text-gray-900'>{safeData.length}</p>
          </div>
        </div>

        <div className='flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50'>
          <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-red-100 text-red-600'>
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
              <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
              <line x1='12' y1='9' x2='12' y2='13' />
              <line x1='12' y1='17' x2='12.01' y2='17' />
            </svg>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Critical
            </p>
            <p className='text-2xl font-bold text-red-700'>{tierCounts.critical}</p>
          </div>
        </div>

        <div className='flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50'>
          <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-amber-100 text-amber-600'>
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
              <line x1='12' y1='8' x2='12' y2='12' />
              <line x1='12' y1='16' x2='12.01' y2='16' />
            </svg>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
              High
            </p>
            <p className='text-2xl font-bold text-amber-700'>{tierCounts.high}</p>
          </div>
        </div>

        <div className='flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50'>
          <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600'>
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
              <polyline points='12 6 12 12 16 14' />
            </svg>
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Moderate
            </p>
            <p className='text-2xl font-bold text-blue-700'>{tierCounts.moderate}</p>
          </div>
        </div>

        <div className='flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50'>
          <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-green-100 text-green-600'>
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
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Low
            </p>
            <p className='text-2xl font-bold text-green-700'>{tierCounts.low}</p>
          </div>
        </div>
      </div>

      <div className='card-enterprise'>
        <div className='flex flex-col lg:flex-row lg:items-center gap-4 mb-6'>
          <div className='flex-1'>
            <div className='relative'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400'
              >
                <circle cx='11' cy='11' r='8' />
                <line x1='21' y1='21' x2='16.65' y2='16.65' />
              </svg>
              <input
                ref={searchInputRef}
                type='text'
                placeholder='Search by counterparty name or ID...'
                value={searchQuery}
                onChange={handleSearchChange}
                className='input-enterprise pl-10 w-full lg:w-80'
                aria-label='Search counterparties'
              />
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex items-center gap-2'>
              <label
                htmlFor='risk-tier-table-filter'
                className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
              >
                Tier
              </label>
              <select
                id='risk-tier-table-filter'
                value={tierFilter}
                onChange={handleTierFilterChange}
                className='input-enterprise w-36 py-1.5 text-sm'
                aria-label='Filter by risk tier'
              >
                <option value=''>All Tiers</option>
                <option value='critical'>Critical</option>
                <option value='high'>High</option>
                <option value='moderate'>Moderate</option>
                <option value='low'>Low</option>
              </select>
            </div>

            <div className='flex items-center gap-2'>
              <label
                htmlFor='risk-tier-watchlist-filter'
                className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
              >
                Watchlist
              </label>
              <select
                id='risk-tier-watchlist-filter'
                value={watchlistFilter}
                onChange={handleWatchlistFilterChange}
                className='input-enterprise w-40 py-1.5 text-sm'
                aria-label='Filter by watchlist status'
              >
                <option value=''>All</option>
                <option value='on_watchlist'>On Watchlist</option>
                <option value='not_on_watchlist'>Not on Watchlist</option>
              </select>
            </div>

            <div className='flex items-center gap-2'>
              <label
                htmlFor='risk-tier-sort-option'
                className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
              >
                Sort
              </label>
              <select
                id='risk-tier-sort-option'
                value={sortOption}
                onChange={handleSortChange}
                className='input-enterprise w-48 py-1.5 text-sm'
                aria-label='Sort counterparties'
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <ExportButton
              data={exportData}
              filename='risk-tier-table'
              variant='ghost'
              label='Export'
            />

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
        </div>

        <div className='flex items-center justify-between mb-4'>
          <p className='text-sm text-gray-500'>
            {filteredData.length === 0
              ? 'No counterparties found'
              : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} counterparties`}
          </p>
        </div>

        {paginatedData.length === 0 ? (
          <div className='text-center py-16'>
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
            <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Counterparties Found</h3>
            <p className='text-sm text-gray-500 max-w-md mx-auto'>
              {hasActiveFilters
                ? 'No counterparties match your current filters. Try adjusting or clearing your filters.'
                : 'No counterparty risk tier data is available.'}
            </p>
            {hasActiveFilters && (
              <button
                type='button'
                onClick={handleClearFilters}
                className='btn-enterprise-secondary mt-4'
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='table-enterprise'>
              <thead>
                <tr>
                  <th className='w-12'></th>
                  <th className='w-12'>Rank</th>
                  <th>Counterparty</th>
                  <th>Risk Tier</th>
                  <th>Defect Rate</th>
                  <th>Open Remedies</th>
                  <th>Exposure</th>
                  <th>Alert Status</th>
                  <th>Watchlist</th>
                  <th className='w-32'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((entry, index) => {
                  if (!entry) return null;

                  const isExpanded = expandedRows.has(entry.counterpartyId);
                  const tierColor = RISK_TIER_COLORS[entry.riskTier] || RISK_TIER_COLORS.unknown;
                  const tierLabel = RISK_TIER_LABELS[entry.riskTier] || entry.riskTier || 'Unknown';
                  const alertStatus = getAlertStatus(entry.counterpartyId, safeAlertRules);
                  const alertCount = getAlertCount(entry.counterpartyId, safeAlertRules);
                  const alertStatusColor = ALERT_STATUS_COLORS[alertStatus] || ALERT_STATUS_COLORS.none;
                  const alertStatusLabel = ALERT_STATUS_LABELS[alertStatus] || 'No Alerts';
                  const watchlistEntry = watchlistMap.get(entry.counterpartyId);
                  const watchlistStatus = watchlistEntry ? watchlistEntry.status || 'active' : 'none';
                  const watchlistStatusColor = WATCHLIST_STATUS_COLORS[watchlistStatus] || WATCHLIST_STATUS_COLORS.none;
                  const watchlistStatusLabel = WATCHLIST_STATUS_LABELS[watchlistStatus] || 'Not on Watchlist';
                  const rank = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={entry.counterpartyId}
                      className={`cursor-pointer transition-colors duration-150 hover:bg-gray-50/70 ${
                        isExpanded ? 'bg-gray-50/70' : ''
                      }`}
                      onClick={() => handleRowClick(entry)}
                      onKeyDown={(e) => handleKeyDown(e, entry)}
                      tabIndex={0}
                      role='row'
                      aria-label={`View details for ${entry.counterpartyName || entry.counterpartyId}`}
                    >
                      <td className='text-center'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleRow(entry.counterpartyId);
                          }}
                          className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                          aria-expanded={isExpanded}
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          >
                            <polyline points='9 18 15 12 9 6' />
                          </svg>
                        </button>
                      </td>
                      <td>
                        <span className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-bold'>
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tierColor}`}
                        >
                          {tierLabel}
                        </span>
                      </td>
                      <td>
                        <div className='flex items-center gap-2'>
                          <div className='flex-1 max-w-[80px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                (entry.defectRate || 0) > 0.05
                                  ? 'bg-red-500'
                                  : (entry.defectRate || 0) > 0.03
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.max(2, Math.min(100, (entry.defectRate || 0) * 1000))}%` }}
                            />
                          </div>
                          <span className='text-sm font-mono text-gray-700'>
                            {formatPercentage(entry.defectRate || 0, 1)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className='text-sm text-gray-700'>
                          {entry.openRemedyCases ?? 0}
                        </span>
                      </td>
                      <td>
                        <span className='text-sm font-mono text-gray-700'>
                          {formatCurrency(entry.totalExposure || 0)}
                        </span>
                      </td>
                      <td>
                        <div className='flex items-center gap-1.5'>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${alertStatusColor}`}
                          >
                            {alertStatusLabel}
                          </span>
                          {alertCount > 0 && (
                            <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-2xs font-bold'>
                              {alertCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${watchlistStatusColor}`}
                        >
                          {watchlistStatusLabel}
                        </span>
                      </td>
                      <td>
                        <div className='flex items-center gap-1'>
                          <button
                            type='button'
                            onClick={(e) => handleViewScorecard(e, entry.counterpartyId)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={`View scorecard for ${entry.counterpartyName || entry.counterpartyId}`}
                            title='View Scorecard'
                          >
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
                              <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                              <circle cx='12' cy='12' r='3' />
                            </svg>
                          </button>

                          {watchlistStatus === 'none' && (
                            <button
                              type='button'
                              onClick={(e) => handleAddToWatchlist(e, entry.counterpartyId)}
                              className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                              aria-label={`Add ${entry.counterpartyName || entry.counterpartyId} to watchlist`}
                              title='Add to Watchlist'
                            >
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
                                <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                                <line x1='12' y1='8' x2='12' y2='16' />
                                <line x1='8' y1='12' x2='16' y2='12' />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {paginatedData.map((entry) => {
              if (!entry) return null;

              const isExpanded = expandedRows.has(entry.counterpartyId);

              if (!isExpanded) return null;

              const alertStatus = getAlertStatus(entry.counterpartyId, safeAlertRules);
              const alertCount = getAlertCount(entry.counterpartyId, safeAlertRules);
              const watchlistEntry = watchlistMap.get(entry.counterpartyId);
              const watchlistStatus = watchlistEntry ? watchlistEntry.status || 'active' : 'none';

              return (
                <div
                  key={`details-${entry.counterpartyId}`}
                  className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Counterparty
                      </span>
                      <span className='text-sm font-medium text-gray-900'>
                        {entry.counterpartyName || entry.counterpartyId}
                      </span>
                      <span className='text-xs text-gray-400 font-mono block'>
                        {entry.counterpartyId}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Risk Tier
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          RISK_TIER_COLORS[entry.riskTier] || RISK_TIER_COLORS.unknown
                        }`}
                      >
                        {RISK_TIER_LABELS[entry.riskTier] || entry.riskTier || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Risk Score
                      </span>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 max-w-[120px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              (entry.riskScore || 0) >= 76
                                ? 'bg-red-500'
                                : (entry.riskScore || 0) >= 51
                                  ? 'bg-amber-500'
                                  : (entry.riskScore || 0) >= 26
                                    ? 'bg-blue-500'
                                    : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.max(2, entry.riskScore || 0)}%` }}
                          />
                        </div>
                        <span className='text-sm font-mono font-semibold text-gray-900'>
                          {entry.riskScore ?? 0}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Defect Rate
                      </span>
                      <span className='text-sm text-gray-900'>
                        {formatPercentage(entry.defectRate || 0, 1)}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Critical Defect Rate
                      </span>
                      <span className='text-sm text-gray-900'>
                        {formatPercentage(entry.criticalDefectRate || 0, 1)}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Open Remedies
                      </span>
                      <span className='text-sm text-gray-900'>
                        {entry.openRemedyCases ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Exposure
                      </span>
                      <span className='text-sm font-mono text-gray-900'>
                        {formatCurrency(entry.totalExposure || 0)}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Breaches
                      </span>
                      <span className='text-sm text-gray-900'>
                        {entry.breachCount ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Avg Response
                      </span>
                      <span className='text-sm text-gray-900'>
                        {entry.avgRemedyResponseDays != null
                          ? `${entry.avgRemedyResponseDays} days`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Alert Status
                      </span>
                      <div className='flex items-center gap-2'>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            ALERT_STATUS_COLORS[alertStatus] || ALERT_STATUS_COLORS.none
                          }`}
                        >
                          {ALERT_STATUS_LABELS[alertStatus] || 'No Alerts'}
                        </span>
                        {alertCount > 0 && (
                          <span className='text-xs text-red-600 font-medium'>
                            ({alertCount} active)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                        Watchlist
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          WATCHLIST_STATUS_COLORS[watchlistStatus] || WATCHLIST_STATUS_COLORS.none
                        }`}
                      >
                        {WATCHLIST_STATUS_LABELS[watchlistStatus] || 'Not on Watchlist'}
                      </span>
                    </div>
                  </div>

                  {entry.factors && Array.isArray(entry.factors) && entry.factors.length > 0 && (
                    <div className='mt-3'>
                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                        Risk Factors
                      </span>
                      <div className='space-y-2'>
                        {entry.factors.map((factor, idx) => {
                          if (!factor) return null;

                          return (
                            <div
                              key={factor.name || idx}
                              className='flex items-center gap-3 p-2 rounded-lg bg-white border border-gray-200 text-sm'
                            >
                              <span className='text-xs text-gray-400'>#{idx + 1}</span>
                              <span className='font-medium text-gray-700 flex-1'>
                                {factor.name || 'Unknown Factor'}
                              </span>
                              <span className='text-xs text-gray-500'>
                                Weight: {factor.weight ?? 0}
                              </span>
                              <span className='text-xs text-gray-500'>
                                Score: {factor.score ?? 0}
                              </span>
                              <span className='text-xs font-semibold text-gray-700'>
                                Contribution: {factor.contribution ?? 0}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className='flex items-center gap-3 mt-4'>
                    <button
                      type='button'
                      onClick={(e) => handleViewScorecard(e, entry.counterpartyId)}
                      className='btn-enterprise-primary text-xs'
                    >
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={2}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-3.5 h-3.5 mr-1.5'
                      >
                        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                        <circle cx='12' cy='12' r='3' />
                      </svg>
                      View Scorecard
                    </button>

                    {watchlistStatus === 'none' && (
                      <button
                        type='button'
                        onClick={(e) => handleAddToWatchlist(e, entry.counterpartyId)}
                        className='btn-enterprise-secondary text-xs'
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={2}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='w-3.5 h-3.5 mr-1.5'
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
              );
            })}
          </div>
        )}
      </div>

      {filteredData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          totalRecords={filteredData.length}
        />
      )}
    </div>
  );
};

RiskTierTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      counterpartyId: PropTypes.string,
      counterpartyName: PropTypes.string,
      riskTier: PropTypes.string,
      riskScore: PropTypes.number,
      defectRate: PropTypes.number,
      criticalDefectRate: PropTypes.number,
      openRemedyCases: PropTypes.number,
      totalExposure: PropTypes.number,
      breachCount: PropTypes.number,
      avgRemedyResponseDays: PropTypes.number,
      factors: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          weight: PropTypes.number,
          score: PropTypes.number,
          contribution: PropTypes.number,
        }),
      ),
    }),
  ),
  onRowClick: PropTypes.func,
  alertRules: PropTypes.arrayOf(
    PropTypes.shape({
      breachId: PropTypes.string,
      ruleId: PropTypes.string,
      ruleName: PropTypes.string,
      counterpartyId: PropTypes.string,
      counterpartyName: PropTypes.string,
      metric: PropTypes.string,
      operator: PropTypes.string,
      configuredValue: PropTypes.number,
      actualValue: PropTypes.number,
      severity: PropTypes.string,
      triggeredAt: PropTypes.string,
      acknowledged: PropTypes.bool,
      acknowledgedBy: PropTypes.string,
      acknowledgedAt: PropTypes.string,
      resolvedAt: PropTypes.string,
    }),
  ),
  watchlistEntries: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      counterpartyId: PropTypes.string,
      counterpartyName: PropTypes.string,
      reason: PropTypes.string,
      status: PropTypes.string,
      watchlistScore: PropTypes.number,
      recommendation: PropTypes.string,
      actionPlanId: PropTypes.string,
      monitoringNotes: PropTypes.array,
      addedBy: PropTypes.string,
      addedDate: PropTypes.string,
      reviewDate: PropTypes.string,
      updatedAt: PropTypes.string,
    }),
  ),
  className: PropTypes.string,
};

RiskTierTable.defaultProps = {
  data: [],
  onRowClick: null,
  alertRules: [],
  watchlistEntries: [],
  className: '',
};

export default RiskTierTable;