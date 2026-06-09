import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useDefects } from '../contexts/DefectContext';
import { useLoans } from '../contexts/LoanContext';
import { useAuth } from '../contexts/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatDate } from '../utils/dateUtils';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'DefectListPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const DEFECT_SEVERITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'observation', label: 'Observation' },
];

const DEFECT_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'closed', label: 'Closed' },
  { value: 'disputed', label: 'Disputed' },
];

const ROOT_CAUSES = [
  'Seller Error',
  'Process Gap',
  'System Issue',
  'Third-Party Error',
  'Borrower Misrepresentation',
  'Underwriter Error',
  'Documentation Deficiency',
  'Training Gap',
];

const SEVERITY_LABELS = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
};

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  major: 'bg-amber-100 text-amber-700 border-amber-200',
  minor: 'bg-blue-100 text-blue-700 border-blue-200',
  observation: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  closed: 'Closed',
  disputed: 'Disputed',
};

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-700 border-red-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  closed: 'bg-green-100 text-green-700 border-green-200',
  disputed: 'bg-purple-100 text-purple-700 border-purple-200',
};

const DefectListPage = () => {
  const navigate = useNavigate();
  const { filterDefects } = useDefects();
  const { getLoanById } = useLoans();
  const { currentPersona } = useAuth();

  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    rootCause: '',
    search: '',
    startDate: '',
    endDate: '',
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

  const filteredDefects = useMemo(() => {
    const defectFilters = {};

    if (filters.severity && typeof filters.severity === 'string') {
      defectFilters.severity = filters.severity;
    }

    if (filters.status && typeof filters.status === 'string') {
      defectFilters.status = filters.status;
    }

    if (filters.rootCause && typeof filters.rootCause === 'string') {
      defectFilters.rootCause = filters.rootCause;
    }

    if (filters.search && typeof filters.search === 'string') {
      defectFilters.search = filters.search;
    }

    if (filters.startDate && filters.startDate.trim() !== '') {
      defectFilters.startDate = filters.startDate;
    }

    if (filters.endDate && filters.endDate.trim() !== '') {
      defectFilters.endDate = filters.endDate;
    }

    defectFilters.sortBy = 'createdAt';
    defectFilters.sortDirection = 'desc';

    return filterDefects(defectFilters);
  }, [filters, filterDefects]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredDefects, { initialPageSize: 25 });

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
      severity: '',
      status: '',
      rootCause: '',
      search: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleViewDefect = useCallback(
    (defectId) => {
      if (!defectId) return;
      navigate(`/defects/${defectId}`);
    },
    [navigate],
  );

  const handleViewLoan = useCallback(
    (loanId) => {
      if (!loanId) return;
      navigate(`/loans/${loanId}`);
    },
    [navigate],
  );

  const handleViewQCCase = useCallback(
    (qcCaseId) => {
      if (!qcCaseId) return;
      navigate(`/qc/cases/${qcCaseId}`);
    },
    [navigate],
  );

  const handleToggleRow = useCallback((defectId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(defectId)) {
        next.delete(defectId);
      } else {
        next.add(defectId);
      }
      return next;
    });
  }, []);

  const hasActiveFilters =
    filters.severity ||
    filters.status ||
    filters.rootCause ||
    filters.search ||
    filters.startDate ||
    filters.endDate;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Defects', path: '/defects' },
  ];

  const exportData = useMemo(() => {
    return filteredDefects.map((defect) => {
      if (!defect) return null;

      const loan = getLoanById(defect.loanId);

      return {
        defectId: defect.id,
        taxonomyCode: defect.taxonomyCode,
        category: defect.category,
        subcategory: defect.subcategory,
        severity: defect.severity,
        rootCause: defect.rootCause,
        status: defect.status,
        counterparty: defect.sellerId,
        loanId: defect.loanId,
        borrowerName: loan ? loan.borrowerName : 'Unknown',
        qcCaseId: defect.qcCaseId,
        description: defect.description,
        sourceOfDefect: defect.sourceOfDefect,
        linkedRemedyCaseId: defect.linkedRemedyCaseId,
        linkedRepurchaseCaseId: defect.linkedRepurchaseCaseId,
        createdBy: defect.createdBy,
        createdAt: defect.createdAt,
        closedAt: defect.closedAt,
      };
    }).filter(Boolean);
  }, [filteredDefects, getLoanById]);

  const stats = useMemo(() => {
    const counts = {
      total: filteredDefects.length,
      critical: 0,
      major: 0,
      minor: 0,
      observation: 0,
      open: 0,
      inReview: 0,
      closed: 0,
      disputed: 0,
    };

    for (const defect of filteredDefects) {
      if (!defect) continue;

      if (defect.severity === 'critical') counts.critical++;
      else if (defect.severity === 'major') counts.major++;
      else if (defect.severity === 'minor') counts.minor++;
      else if (defect.severity === 'observation') counts.observation++;

      if (defect.status === 'open') counts.open++;
      else if (defect.status === 'in_review') counts.inReview++;
      else if (defect.status === 'closed') counts.closed++;
      else if (defect.status === 'disputed') counts.disputed++;
    }

    return counts;
  }, [filteredDefects]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Defects</h1>
            <p className='text-sm text-gray-500 mt-1'>
              View and manage defects identified during QC reviews.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='defects'
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
                <circle cx='12' cy='12' r='10' />
                <line x1='15' y1='9' x2='9' y2='15' />
                <line x1='9' y1='9' x2='15' y2='15' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Total Defects
              </p>
              <p className='text-2xl font-bold text-gray-900'>{stats.total}</p>
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
              <p className='text-2xl font-bold text-red-700'>{stats.critical}</p>
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
                Major
              </p>
              <p className='text-2xl font-bold text-amber-700'>{stats.major}</p>
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
                  placeholder='Search by defect ID, taxonomy code, description, or counterparty...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search defects'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='defect-filter-severity'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Severity
                </label>
                <select
                  id='defect-filter-severity'
                  value={filters.severity}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by severity'
                >
                  <option value=''>All Severities</option>
                  {DEFECT_SEVERITIES.map((severity) => (
                    <option key={severity.value} value={severity.value}>
                      {severity.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='defect-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='defect-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-32 py-1.5 text-sm'
                  aria-label='Filter by status'
                >
                  <option value=''>All Statuses</option>
                  {DEFECT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='defect-filter-root-cause'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Root Cause
                </label>
                <select
                  id='defect-filter-root-cause'
                  value={filters.rootCause}
                  onChange={(e) => handleFilterChange('rootCause', e.target.value)}
                  className='input-enterprise w-44 py-1.5 text-sm'
                  aria-label='Filter by root cause'
                >
                  <option value=''>All Root Causes</option>
                  {ROOT_CAUSES.map((rc) => (
                    <option key={rc} value={rc}>
                      {rc}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='defect-filter-start-date'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  From
                </label>
                <input
                  id='defect-filter-start-date'
                  type='date'
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by start date'
                />
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='defect-filter-end-date'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  To
                </label>
                <input
                  id='defect-filter-end-date'
                  type='date'
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by end date'
                />
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
              {filteredDefects.length === 0
                ? 'No defects found'
                : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} defects`}
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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Defects Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No defects match your current filters. Try adjusting or clearing your filters.'
                  : 'No defects have been logged yet. Defects are created during QC reviews.'}
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
                    <th>Defect ID</th>
                    <th>Taxonomy Code</th>
                    <th>Severity</th>
                    <th>Root Cause</th>
                    <th>Counterparty</th>
                    <th>Linked Loan</th>
                    <th>Linked QC Case</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((defect) => {
                    if (!defect) return null;

                    const isExpanded = expandedRows.has(defect.id);
                    const severityColor = SEVERITY_COLORS[defect.severity] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const severityLabel = SEVERITY_LABELS[defect.severity] || defect.severity || 'Unknown';
                    const statusColor = STATUS_COLORS[defect.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel = STATUS_LABELS[defect.status] || defect.status || 'Unknown';

                    const loan = getLoanById(defect.loanId);

                    return (
                      <tr key={defect.id} className={isExpanded ? 'bg-gray-50/70' : ''}>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(defect.id)}
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
                          <span className='text-sm font-mono text-gray-600'>{defect.id}</span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-700'>
                            {defect.taxonomyCode || '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor}`}
                          >
                            {severityLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>
                            {defect.rootCause || '—'}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-600'>
                            {defect.sellerId || '—'}
                          </span>
                        </td>
                        <td>
                          {loan ? (
                            <button
                              type='button'
                              onClick={() => handleViewLoan(defect.loanId)}
                              className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                            >
                              {defect.loanId}
                            </button>
                          ) : (
                            <span className='text-sm font-mono text-gray-400'>
                              {defect.loanId || '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          {defect.qcCaseId ? (
                            <button
                              type='button'
                              onClick={() => handleViewQCCase(defect.qcCaseId)}
                              className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                            >
                              {defect.qcCaseId}
                            </button>
                          ) : (
                            <span className='text-sm text-gray-400 italic'>—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-500'>
                            {formatDate(defect.createdAt, 'MMM d, yyyy')}
                          </span>
                        </td>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleViewDefect(defect.id)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={`View defect ${defect.id}`}
                            title='View defect details'
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

              {paginatedData.map((defect) => {
                if (!defect) return null;

                const isExpanded = expandedRows.has(defect.id);

                if (!isExpanded) return null;

                const loan = getLoanById(defect.loanId);

                return (
                  <div
                    key={`details-${defect.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Defect ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{defect.id}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Taxonomy Code
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {defect.taxonomyCode || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Category / Subcategory
                        </span>
                        <span className='text-sm text-gray-900'>
                          {defect.category || '—'} / {defect.subcategory || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Severity
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            SEVERITY_COLORS[defect.severity] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {SEVERITY_LABELS[defect.severity] || defect.severity || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[defect.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {STATUS_LABELS[defect.status] || defect.status || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Root Cause
                        </span>
                        <span className='text-sm text-gray-900'>
                          {defect.rootCause || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Source of Defect
                        </span>
                        <span className='text-sm text-gray-900 capitalize'>
                          {defect.sourceOfDefect
                            ? defect.sourceOfDefect.replace(/_/g, ' ')
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {defect.sellerId || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Linked Loan
                        </span>
                        {loan ? (
                          <button
                            type='button'
                            onClick={() => handleViewLoan(defect.loanId)}
                            className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                          >
                            {defect.loanId}
                          </button>
                        ) : (
                          <span className='text-sm font-mono text-gray-400'>
                            {defect.loanId || '—'}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Linked QC Case
                        </span>
                        {defect.qcCaseId ? (
                          <button
                            type='button'
                            onClick={() => handleViewQCCase(defect.qcCaseId)}
                            className='text-sm font-mono text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                          >
                            {defect.qcCaseId}
                          </button>
                        ) : (
                          <span className='text-sm text-gray-400 italic'>—</span>
                        )}
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Created By
                        </span>
                        <span className='text-sm text-gray-900'>
                          {defect.createdBy || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Created
                        </span>
                        <span className='text-sm text-gray-500'>
                          {formatDate(defect.createdAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      {defect.closedAt && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Closed
                          </span>
                          <span className='text-sm text-gray-500'>
                            {formatDate(defect.closedAt, 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      )}
                      {defect.linkedRemedyCaseId && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Linked Remedy Case
                          </span>
                          <span className='text-sm font-mono text-gray-600'>
                            {defect.linkedRemedyCaseId}
                          </span>
                        </div>
                      )}
                      {defect.linkedRepurchaseCaseId && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Linked Repurchase Case
                          </span>
                          <span className='text-sm font-mono text-gray-600'>
                            {defect.linkedRepurchaseCaseId}
                          </span>
                        </div>
                      )}
                    </div>

                    {defect.description && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Description
                        </span>
                        <p className='text-sm text-gray-700'>{defect.description}</p>
                      </div>
                    )}

                    {defect.resolution && (
                      <div className='mt-3 p-4 rounded-xl bg-green-50 border border-green-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Resolution
                        </span>
                        <p className='text-sm text-green-800'>{defect.resolution}</p>
                      </div>
                    )}

                    <div className='flex items-center gap-3 mt-4'>
                      <button
                        type='button'
                        onClick={() => handleViewDefect(defect.id)}
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
                        View Defect Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filteredDefects.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={filteredDefects.length}
          />
        )}
      </div>
    </RequireRole>
  );
};

DefectListPage.propTypes = {};

export default DefectListPage;