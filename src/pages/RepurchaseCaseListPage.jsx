import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useRepurchases } from '../contexts/RepurchaseContext';
import { useAuth } from '../contexts/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatCurrency, formatDate, truncateText } from '../utils/formatters';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'RepurchaseCaseListPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const REPURCHASE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'demand_issued', label: 'Demand Issued' },
  { value: 'counterparty_review', label: 'Counterparty Review' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'alternative_accepted', label: 'Alternative Accepted' },
  { value: 'closed', label: 'Closed' },
];

const AGING_BUCKETS = [
  { value: '0-30', label: '0–30 Days' },
  { value: '31-60', label: '31–60 Days' },
  { value: '61-90', label: '61–90 Days' },
  { value: '91-180', label: '91–180 Days' },
  { value: '180+', label: '180+ Days' },
];

const STATUS_LABELS = {
  draft: 'Draft',
  demand_issued: 'Demand Issued',
  counterparty_review: 'Counterparty Review',
  negotiation: 'Negotiation',
  accepted: 'Accepted',
  disputed: 'Disputed',
  alternative_accepted: 'Alternative Accepted',
  closed: 'Closed',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  demand_issued: 'bg-blue-100 text-blue-700 border-blue-200',
  counterparty_review: 'bg-amber-100 text-amber-700 border-amber-200',
  negotiation: 'bg-purple-100 text-purple-700 border-purple-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  disputed: 'bg-red-100 text-red-700 border-red-200',
  alternative_accepted: 'bg-teal-100 text-teal-700 border-teal-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const RESPONSE_STATUS_LABELS = {
  accept: 'Accepted',
  dispute: 'Disputed',
  counter: 'Countered',
  null: 'No Response',
};

const RESPONSE_STATUS_COLORS = {
  accept: 'bg-green-100 text-green-700 border-green-200',
  dispute: 'bg-red-100 text-red-700 border-red-200',
  counter: 'bg-amber-100 text-amber-700 border-amber-200',
  null: 'bg-gray-100 text-gray-500 border-gray-200',
};

const FINANCIAL_EXPOSURE_ROLES = ['risk-analyst', 'admin'];

const getAgingBucket = (createdAt, status) => {
  if (!createdAt) return 'Unknown';
  if (status === 'closed') return 'Closed';

  try {
    const createdDate = new Date(createdAt);
    if (isNaN(createdDate.getTime())) return 'Unknown';

    const now = new Date();
    const diffMs = now - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return '0-30';
    if (diffDays <= 30) return '0-30';
    if (diffDays <= 60) return '31-60';
    if (diffDays <= 90) return '61-90';
    if (diffDays <= 180) return '91-180';
    return '180+';
  } catch {
    return 'Unknown';
  }
};

const getAgingBucketLabel = (bucket) => {
  const found = AGING_BUCKETS.find((b) => b.value === bucket);
  return found ? found.label : bucket || 'Unknown';
};

const RepurchaseCaseListPage = () => {
  const navigate = useNavigate();
  const { repurchaseCases } = useRepurchases();
  const { currentPersona } = useAuth();

  const [filters, setFilters] = useState({
    status: '',
    counterparty: '',
    agingBucket: '',
    search: '',
  });

  const [expandedRows, setExpandedRows] = useState(new Set());

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeRepurchaseCases = useMemo(() => {
    if (!Array.isArray(repurchaseCases)) {
      return [];
    }
    return repurchaseCases;
  }, [repurchaseCases]);

  const personaId = currentPersona?.id || '';
  const canViewFinancialExposure = FINANCIAL_EXPOSURE_ROLES.includes(personaId);

  const filteredCases = useMemo(() => {
    let filtered = [...safeRepurchaseCases];

    if (filters.status && typeof filters.status === 'string') {
      filtered = filtered.filter(
        (repurchaseCase) => repurchaseCase && repurchaseCase.status === filters.status,
      );
    }

    if (filters.counterparty && typeof filters.counterparty === 'string') {
      filtered = filtered.filter(
        (repurchaseCase) => repurchaseCase && repurchaseCase.sellerId === filters.counterparty,
      );
    }

    if (filters.agingBucket && typeof filters.agingBucket === 'string') {
      filtered = filtered.filter((repurchaseCase) => {
        if (!repurchaseCase) return false;
        const bucket = getAgingBucket(repurchaseCase.createdAt, repurchaseCase.status);
        return bucket === filters.agingBucket;
      });
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((repurchaseCase) => {
        if (!repurchaseCase) return false;
        return (
          (repurchaseCase.id && repurchaseCase.id.toLowerCase().includes(searchLower)) ||
          (repurchaseCase.sellerId && repurchaseCase.sellerId.toLowerCase().includes(searchLower)) ||
          (repurchaseCase.loanId && repurchaseCase.loanId.toLowerCase().includes(searchLower)) ||
          (repurchaseCase.rationale && repurchaseCase.rationale.toLowerCase().includes(searchLower))
        );
      });
    }

    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return bDate - aDate;
    });

    return filtered;
  }, [safeRepurchaseCases, filters]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredCases, { initialPageSize: 25 });

  const handleFilterChange = useCallback(
    (field, value) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
      setPage(1);
    },
    [setPage],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      status: '',
      counterparty: '',
      agingBucket: '',
      search: '',
    });
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleViewCase = useCallback(
    (caseId) => {
      if (!caseId) return;
      navigate(`/repurchase/cases/${caseId}`);
    },
    [navigate],
  );

  const handleToggleRow = useCallback((caseId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);

  const hasActiveFilters =
    filters.status || filters.counterparty || filters.agingBucket || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Repurchase Cases', path: '/repurchase/cases' },
  ];

  const uniqueCounterparties = useMemo(() => {
    const ids = new Set();
    for (const c of safeRepurchaseCases) {
      if (c && c.sellerId) {
        ids.add(c.sellerId);
      }
    }
    return Array.from(ids).sort();
  }, [safeRepurchaseCases]);

  const exportData = useMemo(() => {
    return filteredCases.map((repurchaseCase) => {
      if (!repurchaseCase) return null;

      return {
        caseId: repurchaseCase.id,
        counterparty: repurchaseCase.sellerId || '',
        loanId: repurchaseCase.loanId || '',
        demandAmount: repurchaseCase.demandAmount ?? 0,
        exposure: repurchaseCase.exposure ?? 0,
        status: repurchaseCase.status || '',
        counterpartyResponse: repurchaseCase.counterpartyResponse?.responseType || 'No Response',
        aging: getAgingBucket(repurchaseCase.createdAt, repurchaseCase.status),
        initiatedDate: repurchaseCase.createdAt || '',
        rationale: repurchaseCase.rationale || '',
        linkedDefectCount: Array.isArray(repurchaseCase.linkedDefectIds)
          ? repurchaseCase.linkedDefectIds.length
          : 0,
      };
    }).filter(Boolean);
  }, [filteredCases]);

  const stats = useMemo(() => {
    return {
      total: safeRepurchaseCases.length,
      open: safeRepurchaseCases.filter(
        (c) => c && c.status !== 'closed' && c.status !== 'draft',
      ).length,
      draft: safeRepurchaseCases.filter((c) => c && c.status === 'draft').length,
      closed: safeRepurchaseCases.filter((c) => c && c.status === 'closed').length,
      totalExposure: safeRepurchaseCases.reduce((sum, c) => {
        if (!c) return sum;
        if (c.status === 'closed') return sum;
        return sum + (c.exposure ?? c.demandAmount ?? 0);
      }, 0),
    };
  }, [safeRepurchaseCases]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Repurchase Cases</h1>
            <p className='text-sm text-gray-500 mt-1'>
              View and manage repurchase demands across all counterparties.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='repurchase-cases'
              variant='secondary'
              label='Export'
            />
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
                <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                <polyline points='14 2 14 8 20 8' />
                <line x1='16' y1='13' x2='8' y2='13' />
                <line x1='16' y1='17' x2='8' y2='17' />
                <polyline points='10 9 9 9 8 9' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Total Cases
              </p>
              <p className='text-2xl font-bold text-gray-900'>{stats.total}</p>
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
                Open Cases
              </p>
              <p className='text-2xl font-bold text-blue-700'>{stats.open}</p>
            </div>
          </div>

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
                <path d='M12 20h9' />
                <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Draft
              </p>
              <p className='text-2xl font-bold text-gray-900'>{stats.draft}</p>
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
                Closed
              </p>
              <p className='text-2xl font-bold text-green-700'>{stats.closed}</p>
            </div>
          </div>

          {canViewFinancialExposure && (
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
                  <line x1='12' y1='1' x2='12' y2='23' />
                  <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
                </svg>
              </div>
              <div>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Open Exposure
                </p>
                <p className='text-2xl font-bold text-red-700'>
                  {formatCurrency(stats.totalExposure)}
                </p>
              </div>
            </div>
          )}
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
                  placeholder='Search by case ID, counterparty, loan ID, or rationale...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search repurchase cases'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='repurchase-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='repurchase-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-44 py-1.5 text-sm'
                  aria-label='Filter by status'
                >
                  <option value=''>All Statuses</option>
                  {REPURCHASE_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='repurchase-filter-counterparty'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Counterparty
                </label>
                <select
                  id='repurchase-filter-counterparty'
                  value={filters.counterparty}
                  onChange={(e) => handleFilterChange('counterparty', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by counterparty'
                >
                  <option value=''>All Counterparties</option>
                  {uniqueCounterparties.map((cp) => (
                    <option key={cp} value={cp}>
                      {cp}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='repurchase-filter-aging'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Aging
                </label>
                <select
                  id='repurchase-filter-aging'
                  value={filters.agingBucket}
                  onChange={(e) => handleFilterChange('agingBucket', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by aging bucket'
                >
                  <option value=''>All</option>
                  {AGING_BUCKETS.map((bucket) => (
                    <option key={bucket.value} value={bucket.value}>
                      {bucket.label}
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
              {filteredCases.length === 0
                ? 'No repurchase cases found'
                : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} cases`}
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
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                  <polyline points='10 9 9 9 8 9' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Repurchase Cases Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No repurchase cases match your current filters. Try adjusting or clearing your filters.'
                  : 'No repurchase cases have been initiated yet. Repurchase cases are created from critical defects.'}
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
                    <th>Case ID</th>
                    <th>Counterparty</th>
                    {canViewFinancialExposure && <th>Demand Amount</th>}
                    {canViewFinancialExposure && <th>Exposure</th>}
                    <th>Status</th>
                    <th>Initiated</th>
                    <th>Aging</th>
                    <th>CP Response</th>
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((repurchaseCase) => {
                    if (!repurchaseCase) return null;

                    const isExpanded = expandedRows.has(repurchaseCase.id);
                    const statusColor =
                      STATUS_COLORS[repurchaseCase.status] ||
                      'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel =
                      STATUS_LABELS[repurchaseCase.status] ||
                      repurchaseCase.status ||
                      'Unknown';

                    const responseType =
                      repurchaseCase.counterpartyResponse?.responseType || null;
                    const responseColor =
                      RESPONSE_STATUS_COLORS[responseType] ||
                      RESPONSE_STATUS_COLORS.null;
                    const responseLabel =
                      RESPONSE_STATUS_LABELS[responseType] ||
                      RESPONSE_STATUS_LABELS.null;

                    const agingBucket = getAgingBucket(
                      repurchaseCase.createdAt,
                      repurchaseCase.status,
                    );
                    const agingLabel = getAgingBucketLabel(agingBucket);

                    const exposure =
                      repurchaseCase.exposure ?? repurchaseCase.demandAmount ?? 0;

                    return (
                      <tr
                        key={repurchaseCase.id}
                        className={isExpanded ? 'bg-gray-50/70' : ''}
                      >
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(repurchaseCase.id)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={
                              isExpanded ? 'Collapse details' : 'Expand details'
                            }
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
                          <span className='text-sm font-mono text-gray-600'>
                            {repurchaseCase.id}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-600'>
                            {repurchaseCase.sellerId || '—'}
                          </span>
                        </td>
                        {canViewFinancialExposure && (
                          <td>
                            <span className='text-sm font-mono text-gray-700'>
                              {formatCurrency(repurchaseCase.demandAmount)}
                            </span>
                          </td>
                        )}
                        {canViewFinancialExposure && (
                          <td>
                            <span className='text-sm font-mono text-gray-700'>
                              {formatCurrency(exposure)}
                            </span>
                          </td>
                        )}
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-500'>
                            {formatDate(repurchaseCase.createdAt, 'MMM d, yyyy')}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-600'>{agingLabel}</span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${responseColor}`}
                          >
                            {responseLabel}
                          </span>
                        </td>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleViewCase(repurchaseCase.id)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={`View repurchase case ${repurchaseCase.id}`}
                            title='View case details'
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

              {paginatedData.map((repurchaseCase) => {
                if (!repurchaseCase) return null;

                const isExpanded = expandedRows.has(repurchaseCase.id);

                if (!isExpanded) return null;

                const responseType =
                  repurchaseCase.counterpartyResponse?.responseType || null;
                const responseLabel =
                  RESPONSE_STATUS_LABELS[responseType] ||
                  RESPONSE_STATUS_LABELS.null;

                const agingBucket = getAgingBucket(
                  repurchaseCase.createdAt,
                  repurchaseCase.status,
                );
                const agingLabel = getAgingBucketLabel(agingBucket);

                const exposure =
                  repurchaseCase.exposure ?? repurchaseCase.demandAmount ?? 0;

                const linkedDefectCount = Array.isArray(repurchaseCase.linkedDefectIds)
                  ? repurchaseCase.linkedDefectIds.length
                  : 0;

                return (
                  <div
                    key={`details-${repurchaseCase.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Case ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {repurchaseCase.id}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {repurchaseCase.sellerId || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Loan ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {repurchaseCase.loanId || '—'}
                        </span>
                      </div>
                      {canViewFinancialExposure && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Demand Amount
                          </span>
                          <span className='text-sm font-mono text-gray-900'>
                            {formatCurrency(repurchaseCase.demandAmount)}
                          </span>
                        </div>
                      )}
                      {canViewFinancialExposure && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Current Exposure
                          </span>
                          <span className='text-sm font-mono text-gray-900'>
                            {formatCurrency(exposure)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[repurchaseCase.status] ||
                            'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {STATUS_LABELS[repurchaseCase.status] ||
                            repurchaseCase.status ||
                            'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty Response
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            RESPONSE_STATUS_COLORS[responseType] ||
                            RESPONSE_STATUS_COLORS.null
                          }`}
                        >
                          {responseLabel}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Aging
                        </span>
                        <span className='text-sm text-gray-900'>{agingLabel}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Initiated
                        </span>
                        <span className='text-sm text-gray-500'>
                          {formatDate(repurchaseCase.createdAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Last Updated
                        </span>
                        <span className='text-sm text-gray-500'>
                          {formatDate(repurchaseCase.updatedAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Linked Defects
                        </span>
                        <span className='text-sm text-gray-900'>
                          {linkedDefectCount > 0
                            ? `${linkedDefectCount} defect${linkedDefectCount === 1 ? '' : 's'}`
                            : 'None'}
                        </span>
                      </div>
                      {repurchaseCase.counterpartyResponse?.receivedAt && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Response Received
                          </span>
                          <span className='text-sm text-gray-500'>
                            {formatDate(
                              repurchaseCase.counterpartyResponse.receivedAt,
                              'MMM d, yyyy HH:mm',
                            )}
                          </span>
                        </div>
                      )}
                      {repurchaseCase.counterpartyResponse?.proposedAmount !== null &&
                        repurchaseCase.counterpartyResponse?.proposedAmount !== undefined && (
                          <div>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                              Proposed Amount
                            </span>
                            <span className='text-sm font-mono text-gray-900'>
                              {formatCurrency(
                                repurchaseCase.counterpartyResponse.proposedAmount,
                              )}
                            </span>
                          </div>
                        )}
                      {repurchaseCase.alternativeProposal?.type && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Alternative Proposal
                          </span>
                          <span className='text-sm text-gray-900 capitalize'>
                            {repurchaseCase.alternativeProposal.type.replace(/_/g, ' ')}
                            {repurchaseCase.alternativeProposal.status && (
                              <span className='ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-600'>
                                {repurchaseCase.alternativeProposal.status}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {repurchaseCase.finalOutcome?.type && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Final Outcome
                          </span>
                          <span className='text-sm text-gray-900 capitalize'>
                            {repurchaseCase.finalOutcome.type.replace(/_/g, ' ')}
                            {repurchaseCase.finalOutcome.settledAmount !== null &&
                              repurchaseCase.finalOutcome.settledAmount !== undefined && (
                                <span className='ml-2 font-mono text-gray-600'>
                                  {formatCurrency(
                                    repurchaseCase.finalOutcome.settledAmount,
                                  )}
                                </span>
                              )}
                          </span>
                        </div>
                      )}
                    </div>

                    {repurchaseCase.rationale && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Rationale
                        </span>
                        <p className='text-sm text-gray-700'>
                          {repurchaseCase.rationale}
                        </p>
                      </div>
                    )}

                    {repurchaseCase.counterpartyResponse?.rationale && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Counterparty Rationale
                        </span>
                        <p className='text-sm text-gray-700'>
                          {repurchaseCase.counterpartyResponse.rationale}
                        </p>
                      </div>
                    )}

                    {repurchaseCase.alternativeProposal?.terms && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Alternative Terms
                        </span>
                        <p className='text-sm text-gray-700'>
                          {repurchaseCase.alternativeProposal.terms}
                        </p>
                      </div>
                    )}

                    {repurchaseCase.finalOutcome?.notes && (
                      <div className='mt-3 p-4 rounded-xl bg-green-50 border border-green-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Outcome Notes
                        </span>
                        <p className='text-sm text-green-800'>
                          {repurchaseCase.finalOutcome.notes}
                        </p>
                      </div>
                    )}

                    {linkedDefectCount > 0 && (
                      <div className='mt-3'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Linked Defects ({linkedDefectCount})
                        </span>
                        <div className='flex flex-wrap gap-1'>
                          {repurchaseCase.linkedDefectIds.map((defectId) => (
                            <span
                              key={defectId}
                              className='inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600'
                            >
                              {defectId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className='flex items-center gap-3 mt-4'>
                      <button
                        type='button'
                        onClick={() => handleViewCase(repurchaseCase.id)}
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
                        View Case Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filteredCases.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={filteredCases.length}
          />
        )}
      </div>
    </RequireRole>
  );
};

RepurchaseCaseListPage.propTypes = {};

export default RepurchaseCaseListPage;