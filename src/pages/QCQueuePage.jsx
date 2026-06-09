import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useQC } from '../contexts/QCContext';
import { useLoans } from '../contexts/LoanContext';
import { useAuth } from '../contexts/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatDate, isDateBreached, getAgingBucket } from '../utils/dateUtils';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'QCQueuePage';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const QC_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'escalated', label: 'Escalated' },
];

const QC_PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const METHODOLOGIES = [
  { value: 'random', label: 'Random' },
  { value: 'risk_based', label: 'Risk-Based' },
  { value: 'targeted', label: 'Targeted' },
  { value: 'threshold', label: 'Threshold' },
];

const STATUS_LABELS = {
  pending: 'Pending',
  in_review: 'In Review',
  completed: 'Completed',
  escalated: 'Escalated',
};

const STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const METHODOLOGY_LABELS = {
  random: 'Random',
  risk_based: 'Risk-Based',
  targeted: 'Targeted',
  threshold: 'Threshold',
};

const METHODOLOGY_COLORS = {
  random: 'bg-blue-100 text-blue-700 border-blue-200',
  risk_based: 'bg-purple-100 text-purple-700 border-purple-200',
  targeted: 'bg-teal-100 text-teal-700 border-teal-200',
  threshold: 'bg-orange-100 text-orange-700 border-orange-200',
};

const QCQueuePage = () => {
  const navigate = useNavigate();
  const { qcCases } = useQC();
  const { getLoanById } = useLoans();
  const { currentPersona } = useAuth();

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    methodology: '',
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

  const safeQCCases = useMemo(() => {
    if (!Array.isArray(qcCases)) {
      return [];
    }
    return qcCases;
  }, [qcCases]);

  const filteredCases = useMemo(() => {
    let filtered = [...safeQCCases];

    if (filters.status && typeof filters.status === 'string') {
      filtered = filtered.filter((qcCase) => qcCase && qcCase.status === filters.status);
    }

    if (filters.priority && typeof filters.priority === 'string') {
      filtered = filtered.filter((qcCase) => qcCase && qcCase.priority === filters.priority);
    }

    if (filters.methodology && typeof filters.methodology === 'string') {
      filtered = filtered.filter(
        (qcCase) => qcCase && qcCase.methodology === filters.methodology,
      );
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((qcCase) => {
        if (!qcCase) return false;

        const loan = getLoanById(qcCase.loanId);

        return (
          (qcCase.id && qcCase.id.toLowerCase().includes(searchLower)) ||
          (qcCase.loanId && qcCase.loanId.toLowerCase().includes(searchLower)) ||
          (loan && loan.borrowerName && loan.borrowerName.toLowerCase().includes(searchLower)) ||
          (loan && loan.sellerId && loan.sellerId.toLowerCase().includes(searchLower))
        );
      });
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };

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
  }, [safeQCCases, filters, getLoanById]);

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
      methodology: '',
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
      navigate(`/qc/cases/${caseId}`);
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
    filters.status || filters.priority || filters.methodology || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'QC Queue', path: '/qc/queue' },
  ];

  const exportData = useMemo(() => {
    return filteredCases.map((qcCase) => {
      if (!qcCase) return null;

      const loan = getLoanById(qcCase.loanId);

      return {
        caseId: qcCase.id,
        loanId: qcCase.loanId,
        borrowerName: loan ? loan.borrowerName : 'Unknown',
        counterparty: loan ? loan.sellerId : 'Unknown',
        methodology: qcCase.methodology || '',
        priority: qcCase.priority || '',
        status: qcCase.status || '',
        reviewer: qcCase.reviewerId || 'Unassigned',
        dueDate: qcCase.dueDate || '',
        slaBreached: qcCase.dueDate ? isDateBreached(new Date(qcCase.dueDate)) : false,
        createdAt: qcCase.createdAt || '',
      };
    }).filter(Boolean);
  }, [filteredCases, getLoanById]);

  const stats = useMemo(() => {
    return {
      total: safeQCCases.length,
      pending: safeQCCases.filter((c) => c && c.status === 'pending').length,
      inReview: safeQCCases.filter((c) => c && c.status === 'in_review').length,
      completed: safeQCCases.filter((c) => c && c.status === 'completed').length,
      escalated: safeQCCases.filter((c) => c && c.status === 'escalated').length,
      breached: safeQCCases.filter(
        (c) => c && c.dueDate && isDateBreached(new Date(c.dueDate)) && c.status !== 'completed',
      ).length,
    };
  }, [safeQCCases]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>QC Work Queue</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Review and manage QC cases sorted by priority and due date.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='qc-queue'
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
                Pending
              </p>
              <p className='text-2xl font-bold text-blue-700'>{stats.pending}</p>
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
                In Review
              </p>
              <p className='text-2xl font-bold text-amber-700'>{stats.inReview}</p>
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
                Completed
              </p>
              <p className='text-2xl font-bold text-green-700'>{stats.completed}</p>
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
                SLA Breached
              </p>
              <p className='text-2xl font-bold text-red-700'>{stats.breached}</p>
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
                  placeholder='Search by case ID, loan ID, or borrower name...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search QC cases'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='qc-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='qc-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by status'
                >
                  <option value=''>All Statuses</option>
                  {QC_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='qc-filter-priority'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Priority
                </label>
                <select
                  id='qc-filter-priority'
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  className='input-enterprise w-32 py-1.5 text-sm'
                  aria-label='Filter by priority'
                >
                  <option value=''>All Priorities</option>
                  {QC_PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='qc-filter-methodology'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Method
                </label>
                <select
                  id='qc-filter-methodology'
                  value={filters.methodology}
                  onChange={(e) => handleFilterChange('methodology', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by methodology'
                >
                  <option value=''>All Methods</option>
                  {METHODOLOGIES.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
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
                ? 'No QC cases found'
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
                  <circle cx='11' cy='11' r='8' />
                  <line x1='21' y1='21' x2='16.65' y2='16.65' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No QC Cases Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No QC cases match your current filters. Try adjusting or clearing your filters.'
                  : 'No QC cases have been created yet. Run a sampling configuration to generate QC cases.'}
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
                    <th>Loan ID</th>
                    <th>Counterparty</th>
                    <th>Methodology</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>SLA</th>
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((qcCase) => {
                    if (!qcCase) return null;

                    const isExpanded = expandedRows.has(qcCase.id);
                    const statusColor = STATUS_COLORS[qcCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel = STATUS_LABELS[qcCase.status] || qcCase.status || 'Unknown';
                    const priorityColor = PRIORITY_COLORS[qcCase.priority] || 'bg-gray-100 text-gray-600 border-gray-200';
                    const priorityLabel = PRIORITY_LABELS[qcCase.priority] || qcCase.priority || 'Unknown';
                    const methodologyColor = METHODOLOGY_COLORS[qcCase.methodology] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const methodologyLabel = METHODOLOGY_LABELS[qcCase.methodology] || qcCase.methodology || 'Unknown';

                    const loan = getLoanById(qcCase.loanId);
                    const isBreached = qcCase.dueDate && isDateBreached(new Date(qcCase.dueDate)) && qcCase.status !== 'completed';
                    const agingBucket = qcCase.dueDate ? getAgingBucket(new Date(qcCase.dueDate)) : 'Unknown';

                    return (
                      <tr key={qcCase.id} className={isExpanded ? 'bg-gray-50/70' : ''}>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(qcCase.id)}
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
                          <span className='text-sm font-mono text-gray-600'>{qcCase.id}</span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-600'>{qcCase.loanId}</span>
                        </td>
                        <td>
                          {loan ? (
                            <PIIField
                              fieldType='fullName'
                              value={loan.borrowerName}
                              entityId={loan.id}
                            />
                          ) : (
                            <span className='text-sm text-gray-400 italic'>Unknown</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${methodologyColor}`}
                          >
                            {methodologyLabel}
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
                              {qcCase.dueDate ? formatDate(qcCase.dueDate, 'MMM d, yyyy') : '—'}
                            </span>
                            {qcCase.dueDate && (
                              <span className='text-xs text-gray-400'>{agingBucket}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {isBreached ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200'>
                              Breached
                            </span>
                          ) : qcCase.status === 'completed' ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200'>
                              Complete
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200'>
                              On Track
                            </span>
                          )}
                        </td>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleViewCase(qcCase.id)}
                            className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={`View QC case ${qcCase.id}`}
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

              {paginatedData.map((qcCase) => {
                if (!qcCase) return null;

                const isExpanded = expandedRows.has(qcCase.id);

                if (!isExpanded) return null;

                const loan = getLoanById(qcCase.loanId);
                const isBreached = qcCase.dueDate && isDateBreached(new Date(qcCase.dueDate)) && qcCase.status !== 'completed';
                const checklistCompleted = Array.isArray(qcCase.checklist)
                  ? qcCase.checklist.filter((item) => item && item.response !== null).length
                  : 0;
                const checklistTotal = Array.isArray(qcCase.checklist) ? qcCase.checklist.length : 0;

                return (
                  <div
                    key={`details-${qcCase.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Case ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{qcCase.id}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Loan ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{qcCase.loanId}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Borrower
                        </span>
                        {loan ? (
                          <PIIField
                            fieldType='fullName'
                            value={loan.borrowerName}
                            entityId={loan.id}
                          />
                        ) : (
                          <span className='text-sm text-gray-400 italic'>Unknown</span>
                        )}
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {loan ? loan.sellerId : 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Methodology
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            METHODOLOGY_COLORS[qcCase.methodology] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {METHODOLOGY_LABELS[qcCase.methodology] || qcCase.methodology || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Priority
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            PRIORITY_COLORS[qcCase.priority] || 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {PRIORITY_LABELS[qcCase.priority] || qcCase.priority || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[qcCase.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {STATUS_LABELS[qcCase.status] || qcCase.status || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Reviewer
                        </span>
                        <span className='text-sm text-gray-900'>
                          {qcCase.reviewerId || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Due Date
                        </span>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm text-gray-900'>
                            {qcCase.dueDate ? formatDate(qcCase.dueDate, 'MMM d, yyyy') : '—'}
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
                          Checklist Progress
                        </span>
                        <div className='flex items-center gap-2'>
                          <div className='flex-1 max-w-[120px] bg-gray-200 rounded-full h-2 overflow-hidden'>
                            <div
                              className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                              style={{
                                width: checklistTotal > 0
                                  ? `${Math.round((checklistCompleted / checklistTotal) * 100)}%`
                                  : '0%',
                              }}
                            />
                          </div>
                          <span className='text-xs text-gray-500'>
                            {checklistCompleted}/{checklistTotal}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Created
                        </span>
                        <span className='text-sm text-gray-500'>
                          {formatDate(qcCase.createdAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      {qcCase.completedAt && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Completed
                          </span>
                          <span className='text-sm text-gray-500'>
                            {formatDate(qcCase.completedAt, 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      )}
                    </div>

                    {qcCase.findings && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Findings
                        </span>
                        <div className='flex items-center gap-3 mb-2'>
                          <span className='text-sm font-semibold text-gray-700'>Overall Result:</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              qcCase.findings.overallResult === 'pass'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : qcCase.findings.overallResult === 'conditional_pass'
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-red-100 text-red-700 border-red-200'
                            }`}
                          >
                            {qcCase.findings.overallResult
                              ? qcCase.findings.overallResult.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                              : 'Unknown'}
                          </span>
                        </div>
                        {qcCase.findings.notes && (
                          <p className='text-sm text-gray-600'>{qcCase.findings.notes}</p>
                        )}
                      </div>
                    )}

                    <div className='flex items-center gap-3 mt-4'>
                      <button
                        type='button'
                        onClick={() => handleViewCase(qcCase.id)}
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

QCQueuePage.propTypes = {};

export default QCQueuePage;