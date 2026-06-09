import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useLoans } from '../contexts/LoanContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatCurrency, formatDate, truncateText } from '../utils/formatters';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'ExceptionQueuePage';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const EXCEPTION_STATUSES = ['FAIL', 'EXCEPTION'];

const STATUS_LABELS = {
  FAIL: 'Failed',
  EXCEPTION: 'Exception',
  OVERRIDDEN: 'Overridden',
  PENDING_VALIDATION: 'Pending Validation',
  VALIDATED: 'Validated',
  PASS: 'Pass',
};

const STATUS_COLORS = {
  FAIL: 'bg-red-100 text-red-700 border-red-200',
  EXCEPTION: 'bg-amber-100 text-amber-700 border-amber-200',
  OVERRIDDEN: 'bg-purple-100 text-purple-700 border-purple-200',
  PENDING_VALIDATION: 'bg-blue-100 text-blue-700 border-blue-200',
  VALIDATED: 'bg-teal-100 text-teal-700 border-teal-200',
  PASS: 'bg-green-100 text-green-700 border-green-200',
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

const ROUTE_OPTIONS = [
  { value: 'qc_review', label: 'Route to QC Review' },
  { value: 'manual_review', label: 'Route to Manual Review' },
  { value: 'reject', label: 'Reject Permanently' },
  { value: 'override', label: 'Request Override' },
];

const RouteActionModal = ({ loan, isOpen, onClose, onRoute }) => {
  const [selectedRoute, setSelectedRoute] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const routeSelectRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedRoute('');
      setNotes('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (routeSelectRef.current) {
          routeSelectRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleRouteChange = useCallback((e) => {
    const value = e.target.value;
    setSelectedRoute(value);

    if (errors.route) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.route;
        return next;
      });
    }
  }, [errors.route]);

  const handleNotesChange = useCallback((e) => {
    const value = e.target.value;
    setNotes(value);

    if (errors.notes) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.notes;
        return next;
      });
    }
  }, [errors.notes]);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!selectedRoute || selectedRoute.trim() === '') {
      newErrors.route = 'Please select a routing action.';
    }

    if (!notes || notes.trim() === '') {
      newErrors.notes = 'Please provide notes for this routing action.';
    } else if (notes.trim().length < 5) {
      newErrors.notes = 'Notes must be at least 5 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedRoute, notes]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!loan || !loan.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isMountedRef.current) {
        onRoute(loan.id, selectedRoute, notes);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Route action submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, loan, selectedRoute, notes, onRoute, onClose]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
  );

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const routeLabel = ROUTE_OPTIONS.find((opt) => opt.value === selectedRoute)?.label || '';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='route-action-modal-title'
      aria-describedby='route-action-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='route-action-modal-title' className='text-lg font-semibold text-gray-900'>
              Route Exception
            </h2>
            <p id='route-action-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Select a routing action for loan {loan?.id || 'Unknown'}.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close route action modal'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-5 h-5'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div className='px-6 py-5 space-y-5'>
          <div>
            <label
              htmlFor='route-action-select'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Routing Action
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <select
              ref={routeSelectRef}
              id='route-action-select'
              value={selectedRoute}
              onChange={handleRouteChange}
              disabled={isSubmitting}
              className={`input-enterprise ${errors.route ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Routing action'
              aria-describedby={errors.route ? 'route-action-error' : undefined}
              aria-invalid={errors.route ? 'true' : 'false'}
            >
              <option value=''>Select a routing action...</option>
              {ROUTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.route && (
              <p id='route-action-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5 flex-shrink-0'
                >
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
                {errors.route}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='route-action-notes'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Notes
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='route-action-notes'
              value={notes}
              onChange={handleNotesChange}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide details about this routing decision...'
              className={`input-enterprise resize-none ${errors.notes ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Routing notes'
              aria-describedby={errors.notes ? 'route-action-notes-error' : undefined}
              aria-invalid={errors.notes ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.notes ? (
                <p id='route-action-notes-error' className='text-xs text-red-600 flex items-center gap-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-3.5 h-3.5 flex-shrink-0'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='15' y1='9' x2='9' y2='15' />
                    <line x1='9' y1='9' x2='15' y2='15' />
                  </svg>
                  {errors.notes}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>
                {notes.length}/2000
              </span>
            </div>
          </div>

          {selectedRoute && (
            <div className='p-4 rounded-xl bg-blue-50 border border-blue-200'>
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
                    className='w-5 h-5 text-blue-600'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='12' y1='16' x2='12' y2='12' />
                    <line x1='12' y1='8' x2='12.01' y2='8' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-blue-800'>
                    Routing Summary
                  </p>
                  <p className='text-xs text-blue-700 mt-1'>
                    You are routing loan{' '}
                    <span className='font-mono font-semibold'>{loan?.id || 'Unknown'}</span>{' '}
                    to{' '}
                    <span className='font-semibold'>{routeLabel}</span>.
                    This action will be logged in the audit trail.
                  </p>
                </div>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className='p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in'>
              <div className='flex items-start gap-2'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 text-red-500 flex-shrink-0 mt-0.5'
                >
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
                <p className='text-sm text-red-700'>{errors.submit}</p>
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl'>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='btn-enterprise-secondary'
          >
            Cancel
          </button>

          <button
            type='button'
            onClick={handleSubmit}
            disabled={isSubmitting}
            className='btn-enterprise-primary'
          >
            {isSubmitting ? (
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
                Routing...
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
                  <polyline points='20 6 9 17 4 12' />
                </svg>
                Confirm Routing
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

RouteActionModal.propTypes = {
  loan: PropTypes.shape({
    id: PropTypes.string,
    borrowerName: PropTypes.string,
    ssn: PropTypes.string,
    propertyAddress: PropTypes.string,
    loanAmount: PropTypes.number,
    productType: PropTypes.string,
    channel: PropTypes.string,
    sellerId: PropTypes.string,
    borrowerAddress: PropTypes.string,
    borrowerIncome: PropTypes.number,
    creditScore: PropTypes.number,
    accountNumber: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    loanPurpose: PropTypes.string,
    ltv: PropTypes.number,
    dti: PropTypes.number,
    status: PropTypes.string,
    decisionResult: PropTypes.object,
    documents: PropTypes.array,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRoute: PropTypes.func.isRequired,
};

RouteActionModal.defaultProps = {
  loan: null,
};

const ExceptionQueuePage = () => {
  const navigate = useNavigate();
  const { loans, updateLoanStatus, updateLoan } = useLoans();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [filters, setFilters] = useState({
    status: '',
    productType: '',
    channel: '',
    search: '',
  });

  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const exceptionLoans = useMemo(() => {
    if (!Array.isArray(loans)) {
      return [];
    }

    return loans.filter(
      (loan) => loan && EXCEPTION_STATUSES.includes(loan.status),
    );
  }, [loans]);

  const filteredLoans = useMemo(() => {
    let filtered = [...exceptionLoans];

    if (filters.status && typeof filters.status === 'string') {
      filtered = filtered.filter((loan) => loan && loan.status === filters.status);
    }

    if (filters.productType && typeof filters.productType === 'string') {
      filtered = filtered.filter((loan) => loan && loan.productType === filters.productType);
    }

    if (filters.channel && typeof filters.channel === 'string') {
      filtered = filtered.filter((loan) => loan && loan.channel === filters.channel);
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((loan) => {
        if (!loan) return false;
        return (
          (loan.borrowerName && loan.borrowerName.toLowerCase().includes(searchLower)) ||
          (loan.id && loan.id.toLowerCase().includes(searchLower)) ||
          (loan.propertyAddress && loan.propertyAddress.toLowerCase().includes(searchLower)) ||
          (loan.sellerId && loan.sellerId.toLowerCase().includes(searchLower))
        );
      });
    }

    filtered.sort((a, b) => {
      const aDate = a ? new Date(a.createdAt) : new Date(0);
      const bDate = b ? new Date(b.createdAt) : new Date(0);
      return bDate - aDate;
    });

    return filtered;
  }, [exceptionLoans, filters]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredLoans, { initialPageSize: 25 });

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
      productType: '',
      channel: '',
      search: '',
    });
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleViewLoanDetail = useCallback(
    (loanId) => {
      if (!loanId) return;
      navigate(`/loans/${loanId}`);
    },
    [navigate],
  );

  const handleOpenRouteModal = useCallback((loan) => {
    if (!loan) return;
    setSelectedLoan(loan);
    setIsRouteModalOpen(true);
  }, []);

  const handleCloseRouteModal = useCallback(() => {
    setIsRouteModalOpen(false);
    setSelectedLoan(null);
  }, []);

  const handleRouteAction = useCallback(
    (loanId, routeAction, notes) => {
      if (!loanId || !routeAction) return;

      let newStatus;
      let notificationMessage;

      switch (routeAction) {
        case 'qc_review':
          newStatus = 'VALIDATED';
          notificationMessage = `Loan ${loanId} has been routed to QC Review.`;
          break;
        case 'manual_review':
          newStatus = 'PENDING_VALIDATION';
          notificationMessage = `Loan ${loanId} has been routed to Manual Review.`;
          break;
        case 'reject':
          newStatus = 'FAIL';
          notificationMessage = `Loan ${loanId} has been permanently rejected.`;
          break;
        case 'override':
          newStatus = 'OVERRIDDEN';
          notificationMessage = `Override requested for loan ${loanId}.`;
          break;
        default:
          return;
      }

      const success = updateLoanStatus(loanId, newStatus, notes);

      if (success) {
        logEvent(
          'LOAN_STATUS_CHANGE',
          'loan',
          loanId,
          {
            previousStatus: selectedLoan?.status || 'Unknown',
            newStatus,
            routeAction,
            notes,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Loan Routed',
          notificationMessage,
          `/loans/${loanId}`,
        );

        info(COMPONENT_NAME, 'Loan routed from exception queue', {
          loanId,
          routeAction,
          newStatus,
        });
      } else {
        addNotification(
          'error',
          'Routing Failed',
          `Failed to route loan ${loanId}. Please try again.`,
        );
      }
    },
    [selectedLoan, updateLoanStatus, logEvent, addNotification, currentPersona],
  );

  const handleToggleRow = useCallback((loanId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) {
        next.delete(loanId);
      } else {
        next.add(loanId);
      }
      return next;
    });
  }, []);

  const getFailureReason = useCallback((loan) => {
    if (!loan) return 'Unknown';

    if (loan.decisionResult && Array.isArray(loan.decisionResult.ruleResults)) {
      const failedRules = loan.decisionResult.ruleResults.filter(
        (r) => r && !r.passed,
      );

      if (failedRules.length > 0) {
        const reasons = failedRules.map((r) => r.message || r.ruleName || 'Unknown rule failure');
        return reasons.join('; ');
      }
    }

    if (loan.status === 'FAIL') {
      return 'Failed eligibility rules.';
    }

    if (loan.status === 'EXCEPTION') {
      return 'Weighted score below threshold — requires manual review.';
    }

    return 'Pending review.';
  }, []);

  const hasActiveFilters =
    filters.status || filters.productType || filters.channel || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Exception Queue', path: '/exceptions' },
  ];

  const exportData = useMemo(() => {
    return filteredLoans.map((loan) => ({
      id: loan.id,
      borrowerName: loan.borrowerName,
      productType: loan.productType,
      channel: loan.channel,
      loanAmount: loan.loanAmount,
      status: loan.status,
      sellerId: loan.sellerId,
      failureReason: getFailureReason(loan),
      createdAt: loan.createdAt,
    }));
  }, [filteredLoans, getFailureReason]);

  const stats = useMemo(() => {
    return {
      total: exceptionLoans.length,
      failed: exceptionLoans.filter((l) => l && l.status === 'FAIL').length,
      exception: exceptionLoans.filter((l) => l && l.status === 'EXCEPTION').length,
    };
  }, [exceptionLoans]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Exception Queue</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Review and route loans that failed validation or require manual exception handling.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='exception-queue'
              variant='secondary'
              label='Export'
            />
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
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
                Total Exceptions
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
                <circle cx='12' cy='12' r='10' />
                <line x1='15' y1='9' x2='9' y2='15' />
                <line x1='9' y1='9' x2='15' y2='15' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Failed
              </p>
              <p className='text-2xl font-bold text-red-700'>{stats.failed}</p>
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
                <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                <line x1='12' y1='9' x2='12' y2='13' />
                <line x1='12' y1='17' x2='12.01' y2='17' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Exceptions
              </p>
              <p className='text-2xl font-bold text-amber-700'>{stats.exception}</p>
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
                  placeholder='Search by borrower name, loan ID, or property address...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search exception loans'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='exception-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='exception-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by status'
                >
                  <option value=''>All Statuses</option>
                  {EXCEPTION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='exception-filter-product'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Product
                </label>
                <select
                  id='exception-filter-product'
                  value={filters.productType}
                  onChange={(e) => handleFilterChange('productType', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by product type'
                >
                  <option value=''>All Products</option>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='exception-filter-channel'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Channel
                </label>
                <select
                  id='exception-filter-channel'
                  value={filters.channel}
                  onChange={(e) => handleFilterChange('channel', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by channel'
                >
                  <option value=''>All Channels</option>
                  {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
              {filteredLoans.length === 0
                ? 'No exception loans found'
                : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} loans`}
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
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Exceptions Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No exception loans match your current filters. Try adjusting or clearing your filters.'
                  : 'There are currently no loans in the exception queue. All loans have passed validation.'}
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
                    <th>Loan ID</th>
                    <th>Borrower</th>
                    <th>Counterparty</th>
                    <th>Failure Reason</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className='w-32'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((loan) => {
                    if (!loan) return null;

                    const isExpanded = expandedRows.has(loan.id);
                    const statusColor = STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel = STATUS_LABELS[loan.status] || loan.status || 'Unknown';
                    const failureReason = getFailureReason(loan);

                    return (
                      <tr key={loan.id} className={isExpanded ? 'bg-gray-50/70' : ''}>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(loan.id)}
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
                          <span className='text-sm font-mono text-gray-600'>{loan.id}</span>
                        </td>
                        <td>
                          <PIIField
                            fieldType='fullName'
                            value={loan.borrowerName}
                            entityId={loan.id}
                          />
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-600'>
                            {loan.sellerId || '—'}
                          </span>
                        </td>
                        <td>
                          <div className='max-w-xs'>
                            <p className='text-sm text-gray-700 truncate' title={failureReason}>
                              {truncateText(failureReason, 80)}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span className='text-sm text-gray-500'>
                            {formatDate(loan.createdAt, 'MMM d, yyyy')}
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
                          <div className='flex items-center gap-1'>
                            <button
                              type='button'
                              onClick={() => handleViewLoanDetail(loan.id)}
                              className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                              aria-label={`View details for loan ${loan.id}`}
                              title='View loan details'
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

                            <button
                              type='button'
                              onClick={() => handleOpenRouteModal(loan)}
                              className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                              aria-label={`Route loan ${loan.id}`}
                              title='Route exception'
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
                                <polyline points='9 18 15 12 9 6' />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {paginatedData.map((loan) => {
                if (!loan) return null;

                const isExpanded = expandedRows.has(loan.id);

                if (!isExpanded) return null;

                const failureReason = getFailureReason(loan);

                return (
                  <div
                    key={`details-${loan.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Loan ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{loan.id}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Borrower Name
                        </span>
                        <PIIField
                          fieldType='fullName'
                          value={loan.borrowerName}
                          entityId={loan.id}
                        />
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{loan.sellerId || '—'}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Product / Channel
                        </span>
                        <span className='text-sm text-gray-900'>
                          {PRODUCT_TYPE_LABELS[loan.productType] || loan.productType || '—'}
                          {' / '}
                          {CHANNEL_LABELS[loan.channel] || loan.channel || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Loan Amount
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {formatCurrency(loan.loanAmount)}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {STATUS_LABELS[loan.status] || loan.status || 'Unknown'}
                        </span>
                      </div>
                      <div className='md:col-span-2 lg:col-span-3'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Failure Reason
                        </span>
                        <div className='p-3 rounded-lg bg-red-50 border border-red-200'>
                          <div className='flex items-start gap-2'>
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth={2}
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-4 h-4 text-red-500 flex-shrink-0 mt-0.5'
                            >
                              <circle cx='12' cy='12' r='10' />
                              <line x1='15' y1='9' x2='9' y2='15' />
                              <line x1='9' y1='9' x2='15' y2='15' />
                            </svg>
                            <p className='text-sm text-red-700'>{failureReason}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Submitted
                        </span>
                        <span className='text-sm text-gray-900'>
                          {formatDate(loan.createdAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>

                    {loan.decisionResult && loan.decisionResult.ruleResults && (
                      <div className='mt-3'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Rule Evaluation Results
                        </span>
                        <div className='space-y-2'>
                          {loan.decisionResult.ruleResults
                            .filter((r) => r && !r.passed)
                            .map((rule, idx) => (
                              <div
                                key={rule.ruleId || idx}
                                className='flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200'
                              >
                                <div className='flex-shrink-0 mt-0.5'>
                                  <svg
                                    xmlns='http://www.w3.org/2000/svg'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth={2}
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    className='w-4 h-4 text-red-500'
                                  >
                                    <circle cx='12' cy='12' r='10' />
                                    <line x1='15' y1='9' x2='9' y2='15' />
                                    <line x1='9' y1='9' x2='15' y2='15' />
                                  </svg>
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <p className='text-sm font-semibold text-gray-900'>
                                    {rule.ruleName || 'Unnamed Rule'}
                                  </p>
                                  <p className='text-xs text-gray-600 mt-0.5'>
                                    {rule.message || 'No explanation provided.'}
                                  </p>
                                </div>
                                <span className='flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-red-100 text-red-700 border border-red-200'>
                                  FAIL
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className='flex items-center gap-3 mt-4'>
                      <button
                        type='button'
                        onClick={() => handleViewLoanDetail(loan.id)}
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
                          <circle cx='12' cy='12' r='3' />
                        </svg>
                        View Full Details
                      </button>

                      <button
                        type='button'
                        onClick={() => handleOpenRouteModal(loan)}
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
                          <polyline points='9 18 15 12 9 6' />
                        </svg>
                        Route Exception
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filteredLoans.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={filteredLoans.length}
          />
        )}

        <RouteActionModal
          loan={selectedLoan}
          isOpen={isRouteModalOpen}
          onClose={handleCloseRouteModal}
          onRoute={handleRouteAction}
        />
      </div>
    </RequireRole>
  );
};

ExceptionQueuePage.propTypes = {};

export default ExceptionQueuePage;