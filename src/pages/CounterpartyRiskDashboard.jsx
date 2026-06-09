import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { useRiskEngine } from '../hooks/useRiskEngine';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../utils/formatters';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'CounterpartyRiskDashboard';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

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

const SORT_OPTIONS = [
  { value: 'riskScore-desc', label: 'Risk Score (High to Low)' },
  { value: 'riskScore-asc', label: 'Risk Score (Low to High)' },
  { value: 'defectRate-desc', label: 'Defect Rate (High to Low)' },
  { value: 'defectRate-asc', label: 'Defect Rate (Low to High)' },
  { value: 'exposure-desc', label: 'Exposure (High to Low)' },
  { value: 'exposure-asc', label: 'Exposure (Low to High)' },
  { value: 'name-asc', label: 'Name (A to Z)' },
  { value: 'name-desc', label: 'Name (Z to A)' },
];

const CounterpartyRiskDashboard = () => {
  const navigate = useNavigate();
  const { sellers } = useMockData();
  const { watchlist } = useOversight();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();
  const { rankedCounterparties, riskTiers, isCalculating, recalculate, lastCalculatedAt } =
    useRiskEngine();

  const [sortOption, setSortOption] = useState('riskScore-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [watchlistFilter, setWatchlistFilter] = useState('');

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeRankedCounterparties = useMemo(() => {
    if (!Array.isArray(rankedCounterparties)) {
      return [];
    }
    return rankedCounterparties;
  }, [rankedCounterparties]);

  const safeWatchlist = useMemo(() => {
    if (!Array.isArray(watchlist)) {
      return [];
    }
    return watchlist;
  }, [watchlist]);

  const watchlistCounterpartyIds = useMemo(() => {
    const ids = new Set();
    for (const entry of safeWatchlist) {
      if (entry && entry.counterpartyId && entry.status === 'active') {
        ids.add(entry.counterpartyId);
      }
    }
    return ids;
  }, [safeWatchlist]);

  const filteredCounterparties = useMemo(() => {
    let filtered = [...safeRankedCounterparties];

    if (tierFilter && typeof tierFilter === 'string') {
      filtered = filtered.filter(
        (entry) => entry && entry.riskTier === tierFilter,
      );
    }

    if (watchlistFilter === 'on_watchlist') {
      filtered = filtered.filter(
        (entry) => entry && watchlistCounterpartyIds.has(entry.counterpartyId),
      );
    } else if (watchlistFilter === 'not_on_watchlist') {
      filtered = filtered.filter(
        (entry) => entry && !watchlistCounterpartyIds.has(entry.counterpartyId),
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
        case 'riskScore-desc':
          return (b.riskScore || 0) - (a.riskScore || 0);
        case 'riskScore-asc':
          return (a.riskScore || 0) - (b.riskScore || 0);
        case 'defectRate-desc':
          return (b.defectRate || 0) - (a.defectRate || 0);
        case 'defectRate-asc':
          return (a.defectRate || 0) - (b.defectRate || 0);
        case 'exposure-desc':
          return (b.totalExposure || 0) - (a.totalExposure || 0);
        case 'exposure-asc':
          return (a.totalExposure || 0) - (b.totalExposure || 0);
        case 'name-asc':
          return (a.counterpartyName || '').localeCompare(b.counterpartyName || '');
        case 'name-desc':
          return (b.counterpartyName || '').localeCompare(a.counterpartyName || '');
        default:
          return (b.riskScore || 0) - (a.riskScore || 0);
      }
    });

    return filtered;
  }, [safeRankedCounterparties, tierFilter, watchlistFilter, searchQuery, sortOption, watchlistCounterpartyIds]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredCounterparties, { initialPageSize: 25 });

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
    setSortOption('riskScore-desc');
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleRefresh = useCallback(() => {
    if (isCalculating) {
      return;
    }

    recalculate();

    logEvent(
      'RISK_TIER_RECALCULATE',
      'risk_tier',
      'portfolio',
      {
        counterpartyCount: safeRankedCounterparties.length,
      },
      currentPersona?.label || 'Unknown',
    );

    addNotification(
      'info',
      'Risk Tiers Recalculated',
      `Risk tiers have been recalculated for ${safeRankedCounterparties.length} counterparties.`,
    );

    info(COMPONENT_NAME, 'Risk tiers recalculated', {
      counterpartyCount: safeRankedCounterparties.length,
    });
  }, [isCalculating, recalculate, logEvent, addNotification, currentPersona, safeRankedCounterparties]);

  const handleViewCounterparty = useCallback(
    (counterpartyId) => {
      if (!counterpartyId) return;
      navigate(`/counterparties/${counterpartyId}`);
    },
    [navigate],
  );

  const hasActiveFilters = tierFilter || watchlistFilter || searchQuery;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Counterparty Risk', path: '/counterparties' },
  ];

  const exportData = useMemo(() => {
    return filteredCounterparties.map((entry) => {
      if (!entry) return null;

      return {
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterpartyName,
        riskScore: entry.riskScore,
        riskTier: entry.riskTier,
        defectRate: entry.defectRate,
        criticalDefectRate: entry.criticalDefectRate,
        totalExposure: entry.totalExposure,
        breachCount: entry.breachCount,
        avgRemedyResponseDays: entry.avgRemedyResponseDays,
        onWatchlist: watchlistCounterpartyIds.has(entry.counterpartyId),
      };
    }).filter(Boolean);
  }, [filteredCounterparties, watchlistCounterpartyIds]);

  const tierCounts = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      unknown: 0,
    };

    for (const entry of safeRankedCounterparties) {
      if (!entry) continue;
      const tier = entry.riskTier || 'unknown';
      if (counts[tier] !== undefined) {
        counts[tier]++;
      }
    }

    return counts;
  }, [safeRankedCounterparties]);

  const watchlistCount = watchlistCounterpartyIds.size;

  const personaId = currentPersona?.id || '';
  const isReadOnly = personaId === 'executive';

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Counterparty Risk Dashboard</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Monitor and manage counterparty risk tiers, scores, and key performance metrics.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='counterparty-risk'
              variant='secondary'
              label='Export'
            />

            {!isReadOnly && (
              <button
                type='button'
                onClick={handleRefresh}
                disabled={isCalculating}
                className='btn-enterprise-primary'
              >
                {isCalculating ? (
                  <>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='w-4 h-4 mr-2 animate-spin'
                    >
                      <path d='M21 12a9 9 0 1 1-6.219-8.56' />
                    </svg>
                    Recalculating...
                  </>
                ) : (
                  <>
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
                      <polyline points='23 4 23 10 17 10' />
                      <polyline points='1 20 1 14 7 14' />
                      <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
                    </svg>
                    Recalculate Risk Tiers
                  </>
                )}
              </button>
            )}
          </div>
        </div>

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
                Total Counterparties
              </p>
              <p className='text-2xl font-bold text-gray-900'>
                {safeRankedCounterparties.length}
              </p>
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

          <div className='flex items-center gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-purple-100 text-purple-600'>
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
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                On Watchlist
              </p>
              <p className='text-2xl font-bold text-purple-700'>{watchlistCount}</p>
            </div>
          </div>
        </div>

        {lastCalculatedAt && (
          <div className='flex items-center gap-2 text-xs text-gray-400'>
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
              <circle cx='12' cy='12' r='10' />
              <polyline points='12 6 12 12 16 14' />
            </svg>
            Last recalculated: {formatDate(lastCalculatedAt, 'MMM d, yyyy HH:mm:ss')}
          </div>
        )}

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
                  htmlFor='risk-tier-filter'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Tier
                </label>
                <select
                  id='risk-tier-filter'
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
                  htmlFor='watchlist-filter'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Watchlist
                </label>
                <select
                  id='watchlist-filter'
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
                  htmlFor='risk-sort-option'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Sort
                </label>
                <select
                  id='risk-sort-option'
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
              {filteredCounterparties.length === 0
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
                  : 'No counterparty risk data is available. Click "Recalculate Risk Tiers" to generate risk scores.'}
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
                    <th>Counterparty</th>
                    <th>Risk Tier</th>
                    <th>Risk Score</th>
                    <th>Defect Rate</th>
                    <th>Critical Defect Rate</th>
                    <th>Exposure</th>
                    <th>Breaches</th>
                    <th>Avg Response</th>
                    <th>Watchlist</th>
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((entry) => {
                    if (!entry) return null;

                    const tierColor =
                      RISK_TIER_COLORS[entry.riskTier] || RISK_TIER_COLORS.unknown;
                    const tierLabel =
                      RISK_TIER_LABELS[entry.riskTier] || entry.riskTier || 'Unknown';
                    const isOnWatchlist = watchlistCounterpartyIds.has(entry.counterpartyId);

                    return (
                      <tr key={entry.counterpartyId}>
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
                                  entry.riskScore >= 76
                                    ? 'bg-red-500'
                                    : entry.riskScore >= 51
                                      ? 'bg-amber-500'
                                      : entry.riskScore >= 26
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
                          <span className='text-sm font-mono text-gray-700'>
                            {formatCurrency(entry.totalExposure || 0)}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>
                            {entry.breachCount ?? 0}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>
                            {entry.avgRemedyResponseDays != null
                              ? `${entry.avgRemedyResponseDays} days`
                              : '—'}
                          </span>
                        </td>
                        <td>
                          {isOnWatchlist ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200'>
                              Yes
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                              No
                            </span>
                          )}
                        </td>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleViewCounterparty(entry.counterpartyId)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={`View details for ${entry.counterpartyName || entry.counterpartyId}`}
                            title='View counterparty details'
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredCounterparties.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={filteredCounterparties.length}
          />
        )}
      </div>
    </RequireRole>
  );
};

CounterpartyRiskDashboard.propTypes = {};

export default CounterpartyRiskDashboard;