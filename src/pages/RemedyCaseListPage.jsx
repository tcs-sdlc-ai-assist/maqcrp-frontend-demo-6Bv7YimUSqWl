import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useRemedies } from '../contexts/RemedyContext';
import { useAuth } from '../contexts/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatCurrency, formatDate, truncateText } from '../utils/formatters';
import { isDateBreached, getAgingBucket } from '../utils/dateUtils';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'RemedyCaseListPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const REMEDY_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_counterparty', label: 'Pending Counterparty' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const REMEDY_PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const REMEDY_TYPES = [
  { value: 'cure', label: 'Cure' },
  { value: 'repurchase', label: 'Repurchase' },
  { value: 'indemnification', label: 'Indemnification' },
  { value: 'price_adjustment', label: 'Price Adjustment' },
  { value: 'other', label: 'Other' },
];

const SOURCE_TYPES = [
  { value: 'eligibility_failure', label: 'Eligibility Failure' },
  { value: 'qc_defect', label: 'QC Defect' },
  { value: 'manual', label: 'Manual' },
];

const SLA_STATUSES = [
  { value: 'breached', label: 'Breached' },
  { value: 'on_track', label: 'On Track' },
];

const STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_counterparty: 'Pending Counterparty',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  assigned: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  pending_counterparty: 'bg-purple-100 text-purple-700 border-purple-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const REMEDY_TYPE_LABELS = {
  cure: 'Cure',
  repurchase: 'Repurchase',
  indemnification: 'Indemnification',
  price_adjustment: 'Price Adjustment',
  other: 'Other',
};

const REMEDY_TYPE_COLORS = {
  cure: 'bg-teal-100 text-teal-700 border-teal-200',
  repurchase: 'bg-red-100 text-red-700 border-red-200',
  indemnification: 'bg-purple-100 text-purple-700 border-purple-200',
  price_adjustment: 'bg-amber-100 text-amber-700 border-amber-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SOURCE_TYPE_LABELS = {
  eligibility_failure: 'Eligibility Failure',
  qc_defect: 'QC Defect',
  manual: 'Manual',
};

const SOURCE_TYPE_COLORS = {
  eligibility_failure: 'bg-orange-100 text-orange-700 border-orange-200',
  qc_defect: 'bg-rose-100 text-rose-700 border-rose-200',
  manual: 'bg-gray-100 text-gray-600 border-gray-200',
};

const FINANCIAL_EXPOSURE_ROLES = ['risk-analyst', 'admin'];

const RemedyCaseListPage = () => {
  const navigate = useNavigate();
  const { remedyCases } = useRemedies();
  const { currentPersona } = useAuth();

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    remedyType: '',
    sourceType: '',
    slaStatus: '',
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

  const safeRemedyCases = useMemo(() => {
    if (!Array.isArray(remedyCases)) {
      return [];
    }
    return remedyCases;
  }, [remedyCases]);

  const personaId = currentPersona?.id || '';
  const canViewFinancialExposure = FINANCIAL_EXPOSURE_ROLES.includes(personaId);

  const filteredCases = useMemo(() => {
    let filtered = [...safeRemedyCases];

    if (filters.status && typeof filters.status === 'string') {
      filtered = filtered.filter(
        (remedyCase) => remedyCase && remedyCase.status === filters.status,
      );
    }

    if (filters.priority && typeof filters.priority === 'string') {
      filtered = filtered.filter(
        (remedyCase) => remedyCase && remedyCase.priority === filters.priority,
      );
    }

    if (filters.remedyType && typeof filters.remedyType === 'string') {
      filtered = filtered.filter(
        (remedyCase) => remedyCase && remedyCase.remedyType === filters.remedyType,
      );
    }

    if (filters.sourceType && typeof filters.sourceType === 'string') {
      filtered = filtered.filter(
        (remedyCase) => remedyCase && remedyCase.sourceType === filters.sourceType,
      );
    }

    if (filters.slaStatus && typeof filters.slaStatus === 'string') {
      if (filters.slaStatus === 'breached') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.slaBreached === true,
        );
      } else if (filters.slaStatus === 'on_track') {
        filtered = filtered.filter(
          (remedyCase) =>
            remedyCase &&
            remedyCase.slaBreached !== true &&
            remedyCase.status !== 'closed' &&
            remedyCase.status !== 'resolved',
        );
      }
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((remedyCase) => {
        if (!remedyCase) return false;
        return (
          (remedyCase.id && remedyCase.id.toLowerCase().includes(searchLower)) ||
          (remedyCase.sellerId && remedyCase.sellerId.toLowerCase().includes(searchLower)) ||
          (remedyCase.description &&
            remedyCase.description.toLowerCase().includes(searchLower)) ||
          (remedyCase.ownerId && remedyCase.ownerId.toLowerCase().includes(searchLower))
        );
      });
    }

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      const priorityDiff =
        (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
      if (priorityDiff !== 0) return priorityDiff;

      const aDueDate = a.dueDate ? new Date(a.dueDate) : new Date(9999, 0, 1);
      const bDueDate = b.dueDate ? new Date(b.dueDate) : new Date(9999, 0, 1);
      return aDueDate - bDueDate;
    });

    return filtered;
  }, [safeRemedyCases, filters]);

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
      priority: '',
      remedyType: '',
      sourceType: '',
      slaStatus: '',
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
      navigate(`/remedy/cases/${caseId}`);
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
    filters.status ||
    filters.priority ||
    filters.remedyType ||
    filters.sourceType ||
    filters.slaStatus ||
    filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Remedy Cases', path: '/remedy/cases' },
  ];

  const exportData = useMemo(() => {
    return filteredCases.map((remedyCase) => {
      if (!remedyCase) return null;

      return {
        caseId: remedyCase.id,
        sourceType: remedyCase.sourceType || '',
        counterparty: remedyCase.sellerId || '',
        remedyType: remedyCase.remedyType || '',
        priority: remedyCase.priority || '',
        status: remedyCase.status || '',
        owner: remedyCase.ownerId || 'Unassigned',
        dueDate: remedyCase.dueDate || '',
        slaBreached: remedyCase.slaBreached ? 'Yes' : 'No',
        escalationLevel: remedyCase.escalationLevel ?? 0,
        financialExposure:
          remedyCase.financialImpact?.actual ||
          remedyCase.financialImpact?.estimated ||
          0,
        description: remedyCase.description || '',
        createdAt: remedyCase.createdAt || '',
      };
    }).filter(Boolean);
  }, [filteredCases]);

  const stats = useMemo(() => {
    return {
      total: safeRemedyCases.length,
      open: safeRemedyCases.filter((c) => c && c.status === 'open').length,
      inProgress: safeRemedyCases.filter(
        (c) => c && (c.status === 'assigned' || c.status === 'in_progress'),
      ).length,
      pendingCounterparty: safeRemedyCases.filter(
        (c) => c && c.status === 'pending_counterparty',
      ).length,
      escalated: safeRemedyCases.filter((c) => c && c.status === 'escalated').length,
      resolved: safeRemedyCases.filter(
        (c) => c && (c.status === 'resolved' || c.status === 'closed'),
      ).length,
      breached: safeRemedyCases.filter(
        (c) =>
          c &&
          c.slaBreached === true &&
          c.status !== 'closed' &&
          c.status !== 'resolved',
      ).length,
    };
  }, [safeRemedyCases]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Remedy Cases</h1>
            <p className='text-sm text-gray-500 mt-1'>
              View and manage remedy cases across all counterparties.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='remedy-cases'
              variant='secondary'
              label='Export'
            />
          </div>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4'>
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
                Open
              </p>
              <p className='text-2xl font-bold text-blue-700'>{stats.open}</p>
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
                <path d='M12 20h9' />
                <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                In Progress
              </p>
              <p className='text-2xl font-bold text-amber-700'>{stats.inProgress}</p>
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
                <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
                <circle cx='9' cy='7' r='4' />
                <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
                <path d='M16 3.13a4 4 0 0 1 0 7.75' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Pending CP
              </p>
              <p className='text-2xl font-bold text-purple-700'>
                {stats.pendingCounterparty}
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
                Escalated
              </p>
              <p className='text-2xl font-bold text-red-700'>{stats.escalated}</p>
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
                Resolved
              </p>
              <p className='text-2xl font-bold text-green-700'>{stats.resolved}</p>
            </div>
          </div>
        </div>

        {stats.breached > 0 && (
          <div className='p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in'>
            <div className='flex items-start gap-3'>
              <div className='flex-shrink-0 mt-0.5'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-5 h-5 text-red-500'
                >
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
              </div>
              <div>
                <p className='text-sm font-semibold text-red-800'>
                  SLA Breach Alert
                </p>
                <p className='text-xs text-red-600 mt-1'>
                  {stats.breached === 1
                    ? '1 remedy case has breached its SLA deadline and requires immediate attention.'
                    : `${stats.breached} remedy cases have breached their SLA deadlines and require immediate attention.`}
                </p>
              </div>
            </div>
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
                  placeholder='Search by case ID, counterparty, description, or owner...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search remedy cases'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='remedy-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='remedy-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by status'
                >
                  <option value=''>All Statuses</option>
                  {REMEDY_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='remedy-filter-priority'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Priority
                </label>
                <select
                  id='remedy-filter-priority'
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  className='input-enterprise w-32 py-1.5 text-sm'
                  aria-label='Filter by priority'
                >
                  <option value=''>All Priorities</option>
                  {REMEDY_PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='remedy-filter-type'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Type
                </label>
                <select
                  id='remedy-filter-type'
                  value={filters.remedyType}
                  onChange={(e) => handleFilterChange('remedyType', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by remedy type'
                >
                  <option value=''>All Types</option>
                  {REMEDY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='remedy-filter-source'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Source
                </label>
                <select
                  id='remedy-filter-source'
                  value={filters.sourceType}
                  onChange={(e) => handleFilterChange('sourceType', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by source type'
                >
                  <option value=''>All Sources</option>
                  {SOURCE_TYPES.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='remedy-filter-sla'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  SLA
                </label>
                <select
                  id='remedy-filter-sla'
                  value={filters.slaStatus}
                  onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
                  className='input-enterprise w-32 py-1.5 text-sm'
                  aria-label='Filter by SLA status'
                >
                  <option value=''>All</option>
                  {SLA_STATUSES.map((sla) => (
                    <option key={sla.value} value={sla.value}>
                      {sla.label}
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
                ? 'No remedy cases found'
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
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Remedy Cases Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No remedy cases match your current filters. Try adjusting or clearing your filters.'
                  : 'No remedy cases have been created yet. Remedy cases are auto-generated from eligibility failures and QC defects.'}
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
                    <th>Source</th>
                    <th>Counterparty</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>SLA</th>
                    <th>Owner</th>
                    {canViewFinancialExposure && <th>Exposure</th>}
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((remedyCase) => {
                    if (!remedyCase) return null;

                    const isExpanded = expandedRows.has(remedyCase.id);
                    const statusColor =
                      STATUS_COLORS[remedyCase.status] ||
                      'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel =
                      STATUS_LABELS[remedyCase.status] || remedyCase.status || 'Unknown';
                    const priorityColor =
                      PRIORITY_COLORS[remedyCase.priority] ||
                      'bg-gray-100 text-gray-600 border-gray-200';
                    const priorityLabel =
                      PRIORITY_LABELS[remedyCase.priority] ||
                      remedyCase.priority ||
                      'Unknown';
                    const remedyTypeColor =
                      REMEDY_TYPE_COLORS[remedyCase.remedyType] ||
                      'bg-gray-100 text-gray-600 border-gray-200';
                    const remedyTypeLabel =
                      REMEDY_TYPE_LABELS[remedyCase.remedyType] ||
                      remedyCase.remedyType ||
                      'Unknown';
                    const sourceTypeColor =
                      SOURCE_TYPE_COLORS[remedyCase.sourceType] ||
                      'bg-gray-100 text-gray-600 border-gray-200';
                    const sourceTypeLabel =
                      SOURCE_TYPE_LABELS[remedyCase.sourceType] ||
                      remedyCase.sourceType ||
                      'Unknown';

                    const isBreached =
                      remedyCase.slaBreached === true &&
                      remedyCase.status !== 'closed' &&
                      remedyCase.status !== 'resolved';
                    const agingBucket = remedyCase.dueDate
                      ? getAgingBucket(new Date(remedyCase.dueDate))
                      : 'Unknown';

                    const financialExposure =
                      remedyCase.financialImpact?.actual ||
                      remedyCase.financialImpact?.estimated ||
                      0;

                    return (
                      <tr
                        key={remedyCase.id}
                        className={isExpanded ? 'bg-gray-50/70' : ''}
                      >
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(remedyCase.id)}
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
                            {remedyCase.id}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sourceTypeColor}`}
                          >
                            {sourceTypeLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-600'>
                            {remedyCase.sellerId || '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${remedyTypeColor}`}
                          >
                            {remedyTypeLabel}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColor}`}
                          >
                            {priorityLabel}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <div className='flex flex-col'>
                            <span className='text-sm text-gray-700'>
                              {remedyCase.dueDate
                                ? formatDate(remedyCase.dueDate, 'MMM d, yyyy')
                                : '—'}
                            </span>
                            {remedyCase.dueDate && (
                              <span className='text-xs text-gray-400'>
                                {agingBucket}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {isBreached ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200'>
                              Breached
                            </span>
                          ) : remedyCase.status === 'closed' ||
                            remedyCase.status === 'resolved' ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200'>
                              Complete
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                              On Track
                            </span>
                          )}
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>
                            {remedyCase.ownerId || 'Unassigned'}
                          </span>
                        </td>
                        {canViewFinancialExposure && (
                          <td>
                            <span className='text-sm font-mono text-gray-700'>
                              {financialExposure > 0
                                ? formatCurrency(financialExposure)
                                : '—'}
                            </span>
                          </td>
                        )}
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleViewCase(remedyCase.id)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={`View remedy case ${remedyCase.id}`}
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

              {paginatedData.map((remedyCase) => {
                if (!remedyCase) return null;

                const isExpanded = expandedRows.has(remedyCase.id);

                if (!isExpanded) return null;

                const isBreached =
                  remedyCase.slaBreached === true &&
                  remedyCase.status !== 'closed' &&
                  remedyCase.status !== 'resolved';

                const financialExposure =
                  remedyCase.financialImpact?.actual ||
                  remedyCase.financialImpact?.estimated ||
                  0;

                return (
                  <div
                    key={`details-${remedyCase.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Case ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {remedyCase.id}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Source Type
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            SOURCE_TYPE_COLORS[remedyCase.sourceType] ||
                            'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {SOURCE_TYPE_LABELS[remedyCase.sourceType] ||
                            remedyCase.sourceType ||
                            'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Source ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {remedyCase.sourceId || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {remedyCase.sellerId || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Remedy Type
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            REMEDY_TYPE_COLORS[remedyCase.remedyType] ||
                            'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {REMEDY_TYPE_LABELS[remedyCase.remedyType] ||
                            remedyCase.remedyType ||
                            'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Priority
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            PRIORITY_COLORS[remedyCase.priority] ||
                            'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {PRIORITY_LABELS[remedyCase.priority] ||
                            remedyCase.priority ||
                            'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[remedyCase.status] ||
                            'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {STATUS_LABELS[remedyCase.status] ||
                            remedyCase.status ||
                            'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Owner
                        </span>
                        <span className='text-sm text-gray-900'>
                          {remedyCase.ownerId || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Due Date
                        </span>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm text-gray-900'>
                            {remedyCase.dueDate
                              ? formatDate(remedyCase.dueDate, 'MMM d, yyyy')
                              : '—'}
                          </span>
                          {isBreached && (
                            <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium bg-red-100 text-red-700 border border-red-200'>
                              Breached
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Escalation Level
                        </span>
                        <span className='text-sm text-gray-900'>
                          {remedyCase.escalationLevel ?? 0}
                        </span>
                      </div>
                      {canViewFinancialExposure && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Financial Exposure
                          </span>
                          <span className='text-sm font-mono text-gray-900'>
                            {financialExposure > 0
                              ? formatCurrency(financialExposure)
                              : '—'}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Created
                        </span>
                        <span className='text-sm text-gray-500'>
                          {formatDate(remedyCase.createdAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      {remedyCase.resolvedAt && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Resolved
                          </span>
                          <span className='text-sm text-gray-500'>
                            {formatDate(remedyCase.resolvedAt, 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      )}
                    </div>

                    {remedyCase.description && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Description
                        </span>
                        <p className='text-sm text-gray-700'>
                          {remedyCase.description}
                        </p>
                      </div>
                    )}

                    {remedyCase.outcome && (
                      <div className='mt-3 p-4 rounded-xl bg-green-50 border border-green-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Outcome
                        </span>
                        <p className='text-sm text-green-800'>
                          {remedyCase.outcome}
                        </p>
                      </div>
                    )}

                    {Array.isArray(remedyCase.linkedDefectIds) &&
                      remedyCase.linkedDefectIds.length > 0 && (
                        <div className='mt-3'>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                            Linked Defects ({remedyCase.linkedDefectIds.length})
                          </span>
                          <div className='flex flex-wrap gap-1'>
                            {remedyCase.linkedDefectIds.map((defectId) => (
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

                    {Array.isArray(remedyCase.history) &&
                      remedyCase.history.length > 0 && (
                        <div className='mt-3'>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                            Recent History
                          </span>
                          <div className='space-y-2 max-h-48 overflow-y-auto'>
                            {remedyCase.history
                              .slice(-5)
                              .reverse()
                              .map((entry, idx) => {
                                if (!entry) return null;

                                return (
                                  <div
                                    key={idx}
                                    className='flex items-start gap-3 p-2 rounded-lg bg-white border border-gray-200 text-sm'
                                  >
                                    <div className='flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-2xs font-bold'>
                                      {remedyCase.history.length - idx}
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                      <div className='flex items-center gap-2'>
                                        <span className='text-xs font-semibold text-gray-700'>
                                          {entry.action || 'Unknown'}
                                        </span>
                                        <span className='text-xs text-gray-400'>
                                          {formatDate(
                                            entry.timestamp,
                                            'MMM d, yyyy HH:mm',
                                          )}
                                        </span>
                                      </div>
                                      {entry.notes && (
                                        <p className='text-xs text-gray-600 mt-0.5'>
                                          {entry.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                    <div className='flex items-center gap-3 mt-4'>
                      <button
                        type='button'
                        onClick={() => handleViewCase(remedyCase.id)}
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

RemedyCaseListPage.propTypes = {};

export default RemedyCaseListPage;