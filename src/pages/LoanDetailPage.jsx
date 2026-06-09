import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useLoans } from '../contexts/LoanContext';
import { useRules } from '../contexts/RulesContext';
import { useQC } from '../contexts/QCContext';
import { useDefects } from '../contexts/DefectContext';
import { useRemedies } from '../contexts/RemedyContext';
import { useRepurchases } from '../contexts/RepurchaseContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../utils/formatters';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import PIIField from '../components/shared/PIIField';
import DecisionCard from '../components/acquisition/DecisionCard';
import OverrideModal from '../components/acquisition/OverrideModal';

const COMPONENT_NAME = 'LoanDetailPage';

const ALLOWED_ROLES = ['risk-analyst', 'compliance-officer', 'fraud-investigator', 'admin', 'executive'];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'decision', label: 'Decision History' },
  { key: 'related', label: 'Related Cases' },
];

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

const STATUS_LABELS = {
  PENDING_VALIDATION: 'Pending Validation',
  VALIDATED: 'Validated',
  PASS: 'Pass',
  FAIL: 'Fail',
  EXCEPTION: 'Exception',
  OVERRIDDEN: 'Overridden',
};

const STATUS_COLORS = {
  PENDING_VALIDATION: 'bg-blue-100 text-blue-700 border-blue-200',
  VALIDATED: 'bg-teal-100 text-teal-700 border-teal-200',
  PASS: 'bg-green-100 text-green-700 border-green-200',
  FAIL: 'bg-red-100 text-red-700 border-red-200',
  EXCEPTION: 'bg-amber-100 text-amber-700 border-amber-200',
  OVERRIDDEN: 'bg-purple-100 text-purple-700 border-purple-200',
};

const QC_STATUS_LABELS = {
  pending: 'Pending',
  in_review: 'In Review',
  completed: 'Completed',
  escalated: 'Escalated',
};

const QC_STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
};

const DEFECT_SEVERITY_LABELS = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
};

const DEFECT_SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  major: 'bg-amber-100 text-amber-700 border-amber-200',
  minor: 'bg-blue-100 text-blue-700 border-blue-200',
  observation: 'bg-gray-100 text-gray-600 border-gray-200',
};

const DEFECT_STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  closed: 'Closed',
  disputed: 'Disputed',
};

const DEFECT_STATUS_COLORS = {
  open: 'bg-red-100 text-red-700 border-red-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  closed: 'bg-green-100 text-green-700 border-green-200',
  disputed: 'bg-purple-100 text-purple-700 border-purple-200',
};

const REMEDY_STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_counterparty: 'Pending Counterparty',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const REMEDY_STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  assigned: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  pending_counterparty: 'bg-purple-100 text-purple-700 border-purple-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const REPURCHASE_STATUS_LABELS = {
  draft: 'Draft',
  demand_issued: 'Demand Issued',
  counterparty_review: 'Counterparty Review',
  negotiation: 'Negotiation',
  accepted: 'Accepted',
  disputed: 'Disputed',
  alternative_accepted: 'Alternative Accepted',
  closed: 'Closed',
};

const REPURCHASE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  demand_issued: 'bg-blue-100 text-blue-700 border-blue-200',
  counterparty_review: 'bg-amber-100 text-amber-700 border-amber-200',
  negotiation: 'bg-purple-100 text-purple-700 border-purple-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  disputed: 'bg-red-100 text-red-700 border-red-200',
  alternative_accepted: 'bg-teal-100 text-teal-700 border-teal-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const LoanDetailPage = () => {
  const navigate = useNavigate();
  const { loanId } = useParams();
  const { getLoanById, updateLoanStatus } = useLoans();
  const { executeRules } = useRules();
  const { getQCCasesByLoan } = useQC();
  const { getDefectsByLoan } = useDefects();
  const { getRemediesBySeller } = useRemedies();
  const { getRepurchasesBySeller } = useRepurchases();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('overview');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isExecutingRules, setIsExecutingRules] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loan = useMemo(() => {
    if (!loanId) return null;
    return getLoanById(loanId) || null;
  }, [loanId, getLoanById]);

  const qcCases = useMemo(() => {
    if (!loanId) return [];
    return getQCCasesByLoan(loanId);
  }, [loanId, getQCCasesByLoan]);

  const defects = useMemo(() => {
    if (!loanId) return [];
    return getDefectsByLoan(loanId);
  }, [loanId, getDefectsByLoan]);

  const remedyCases = useMemo(() => {
    if (!loan || !loan.sellerId) return [];
    return getRemediesBySeller(loan.sellerId).filter(
      (r) => r && r.linkedDefectIds && Array.isArray(r.linkedDefectIds) &&
        defects.some((d) => d && r.linkedDefectIds.includes(d.id)),
    );
  }, [loan, getRemediesBySeller, defects]);

  const repurchaseCases = useMemo(() => {
    if (!loan || !loan.sellerId) return [];
    return getRepurchasesBySeller(loan.sellerId).filter(
      (r) => r && r.loanId === loanId,
    );
  }, [loan, loanId, getRepurchasesBySeller]);

  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
  }, []);

  const handleRunRules = useCallback(() => {
    if (!loan || !loan.id) return;

    if (isExecutingRules) return;

    setIsExecutingRules(true);

    try {
      const results = executeRules([loan]);

      if (results.length > 0) {
        const result = results[0];

        let newStatus;
        if (result.decision === 'pass') {
          newStatus = 'PASS';
        } else if (result.decision === 'fail') {
          newStatus = 'FAIL';
        } else {
          newStatus = 'EXCEPTION';
        }

        updateLoanStatus(loan.id, newStatus, 'Rules engine executed');

        logEvent(
          'RULE_EXECUTE',
          'loan',
          loan.id,
          {
            decision: result.decision,
            totalScore: result.totalScore,
            maxPossibleScore: result.maxPossibleScore,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Rules Executed',
          `Rules engine executed for loan ${loan.id}. Decision: ${result.decision.toUpperCase()}.`,
          `/loans/${loan.id}`,
        );

        debug(COMPONENT_NAME, 'Rules executed for loan', {
          loanId: loan.id,
          decision: result.decision,
        });
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Failed to execute rules', err);
      addNotification(
        'error',
        'Rules Execution Failed',
        'An error occurred while executing the rules engine.',
      );
    } finally {
      if (isMountedRef.current) {
        setIsExecutingRules(false);
      }
    }
  }, [loan, isExecutingRules, executeRules, updateLoanStatus, logEvent, addNotification, currentPersona]);

  const handleOpenOverrideModal = useCallback(() => {
    setIsOverrideModalOpen(true);
  }, []);

  const handleCloseOverrideModal = useCallback(() => {
    setIsOverrideModalOpen(false);
  }, []);

  const handleViewQCCase = useCallback(
    (qcCaseId) => {
      if (!qcCaseId) return;
      navigate(`/qc/cases/${qcCaseId}`);
    },
    [navigate],
  );

  const handleViewDefect = useCallback(
    (defectId) => {
      if (!defectId) return;
      navigate(`/defects/${defectId}`);
    },
    [navigate],
  );

  const handleViewRemedy = useCallback(
    (remedyId) => {
      if (!remedyId) return;
      navigate(`/remedy/cases/${remedyId}`);
    },
    [navigate],
  );

  const handleViewRepurchase = useCallback(
    (repurchaseId) => {
      if (!repurchaseId) return;
      navigate(`/repurchase/cases/${repurchaseId}`);
    },
    [navigate],
  );

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!loanId) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Loan Detail', path: `/loans/${loanId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Loan Detail</h1>
            </div>
          </div>

          <div className='card-enterprise'>
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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Invalid Loan ID</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No loan ID was provided. Please select a loan from the loan list.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  if (!loan) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Loan Detail', path: `/loans/${loanId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>Loan Detail</h1>
            </div>
          </div>

          <div className='card-enterprise'>
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
                  <circle cx='12' cy='12' r='10' />
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Loan Not Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                Loan with ID <span className='font-mono text-gray-700'>{loanId}</span> was not found.
                It may have been removed or the ID may be incorrect.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  const statusColor = STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const statusLabel = STATUS_LABELS[loan.status] || loan.status || 'Unknown';

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Loans', path: '/loans' },
    { label: loan.id, path: `/loans/${loan.id}` },
  ];

  const canRunRules = loan.status === 'PENDING_VALIDATION' || loan.status === 'VALIDATED';
  const canOverride = loan.status === 'FAIL' || loan.status === 'EXCEPTION';

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-900'>Loan Detail</h1>
              <span className='text-sm font-mono text-gray-400'>{loan.id}</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleGoBack}
              className='btn-enterprise-secondary'
            >
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
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Back
            </button>

            {canRunRules && (
              <button
                type='button'
                onClick={handleRunRules}
                disabled={isExecutingRules}
                className='btn-enterprise-primary'
              >
                {isExecutingRules ? (
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
                    Running...
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
                      <polygon points='5 3 19 12 5 21 5 3' />
                    </svg>
                    Run Rules Engine
                  </>
                )}
              </button>
            )}

            {canOverride && (
              <button
                type='button'
                onClick={handleOpenOverrideModal}
                className='btn-enterprise-primary'
              >
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
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
                Request Override
              </button>
            )}
          </div>
        </div>

        <div className='border-b border-gray-200'>
          <nav className='flex gap-6 -mb-px' aria-label='Loan detail tabs'>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type='button'
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    pb-3 px-1 text-sm font-medium border-b-2 transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-2
                    ${
                      isActive
                        ? 'border-enterprise-600 text-enterprise-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                  {tab.key === 'related' && (
                    <span className='ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-2xs font-bold'>
                      {qcCases.length + defects.length + remedyCases.length + repurchaseCases.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className='space-y-6 animate-fade-in'>
            <div className='card-enterprise'>
              <h2 className='text-lg font-semibold text-gray-900 mb-5'>Loan Information</h2>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Loan ID
                  </p>
                  <p className='text-sm font-mono text-gray-900'>{loan.id}</p>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Borrower Name
                  </p>
                  <PIIField
                    fieldType='fullName'
                    value={loan.borrowerName}
                    entityId={loan.id}
                  />
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    SSN
                  </p>
                  <PIIField
                    fieldType='ssn'
                    value={loan.ssn}
                    entityId={loan.id}
                  />
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Property Address
                  </p>
                  <span className='text-sm text-gray-900'>
                    {loan.propertyAddress || '—'}
                  </span>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Loan Amount
                  </p>
                  <p className='text-sm font-mono text-gray-900'>
                    {formatCurrency(loan.loanAmount)}
                  </p>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Product Type
                  </p>
                  <p className='text-sm text-gray-900'>
                    {PRODUCT_TYPE_LABELS[loan.productType] || loan.productType || '—'}
                  </p>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Channel
                  </p>
                  <p className='text-sm text-gray-900'>
                    {CHANNEL_LABELS[loan.channel] || loan.channel || '—'}
                  </p>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Seller ID
                  </p>
                  <p className='text-sm font-mono text-gray-900'>{loan.sellerId || '—'}</p>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                {loan.borrowerAddress && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Borrower Address
                    </p>
                    <span className='text-sm text-gray-900'>{loan.borrowerAddress}</span>
                  </div>
                )}

                {loan.borrowerIncome !== undefined && loan.borrowerIncome !== null && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Borrower Income
                    </p>
                    <p className='text-sm font-mono text-gray-900'>
                      {formatCurrency(loan.borrowerIncome)}
                    </p>
                  </div>
                )}

                {loan.creditScore !== undefined && loan.creditScore !== null && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Credit Score
                    </p>
                    <p className='text-sm text-gray-900'>{loan.creditScore}</p>
                  </div>
                )}

                {loan.ltv !== undefined && loan.ltv !== null && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      LTV
                    </p>
                    <p className='text-sm text-gray-900'>{loan.ltv}%</p>
                  </div>
                )}

                {loan.dti !== undefined && loan.dti !== null && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      DTI
                    </p>
                    <p className='text-sm text-gray-900'>{loan.dti}%</p>
                  </div>
                )}

                {loan.loanPurpose && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Loan Purpose
                    </p>
                    <p className='text-sm text-gray-900 capitalize'>
                      {loan.loanPurpose.replace('-', ' ')}
                    </p>
                  </div>
                )}

                {loan.email && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Email
                    </p>
                    <PIIField
                      fieldType='email'
                      value={loan.email}
                      entityId={loan.id}
                    />
                  </div>
                )}

                {loan.phone && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Phone
                    </p>
                    <PIIField
                      fieldType='phone'
                      value={loan.phone}
                      entityId={loan.id}
                    />
                  </div>
                )}

                {loan.accountNumber && (
                  <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                    <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                      Account Number
                    </p>
                    <PIIField
                      fieldType='accountNumber'
                      value={loan.accountNumber}
                      entityId={loan.id}
                    />
                  </div>
                )}

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Submitted
                  </p>
                  <p className='text-sm text-gray-900'>
                    {formatDate(loan.createdAt, 'MMM d, yyyy HH:mm')}
                  </p>
                </div>

                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Last Updated
                  </p>
                  <p className='text-sm text-gray-900'>
                    {formatDate(loan.updatedAt, 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {loan.documents && Array.isArray(loan.documents) && loan.documents.length > 0 && (
                <div className='mt-6'>
                  <h3 className='text-sm font-semibold text-gray-700 mb-3'>Documents</h3>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {loan.documents.map((doc) => {
                      if (!doc) return null;

                      return (
                        <div
                          key={doc.id}
                          className='flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200'
                        >
                          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-enterprise-50 text-enterprise-600'>
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth={1.5}
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-4 h-4'
                            >
                              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                              <polyline points='14 2 14 8 20 8' />
                            </svg>
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-gray-700 truncate'>
                              {doc.name || 'Unnamed Document'}
                            </p>
                            <p className='text-xs text-gray-400'>
                              {doc.type ? doc.type.replace(/_/g, ' ') : 'Unknown type'}
                              {doc.status && (
                                <span className='ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'>
                                  {doc.status}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'decision' && (
          <div className='space-y-6 animate-fade-in'>
            <DecisionCard loan={loan} decisionResult={loan.decisionResult} />
          </div>
        )}

        {activeTab === 'related' && (
          <div className='space-y-6 animate-fade-in'>
            {qcCases.length > 0 && (
              <div className='card-enterprise'>
                <h2 className='text-lg font-semibold text-gray-900 mb-5'>
                  QC Cases ({qcCases.length})
                </h2>

                <div className='overflow-x-auto'>
                  <table className='table-enterprise'>
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Methodology</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Reviewer</th>
                        <th>Due Date</th>
                        <th className='w-12'></th>
                      </tr>
                    </thead>
                    <tbody>
                      {qcCases.map((qcCase) => {
                        if (!qcCase) return null;

                        const qcStatusColor = QC_STATUS_COLORS[qcCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                        const qcStatusLabel = QC_STATUS_LABELS[qcCase.status] || qcCase.status || 'Unknown';

                        return (
                          <tr key={qcCase.id}>
                            <td>
                              <span className='text-sm font-mono text-gray-600'>{qcCase.id}</span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-700 capitalize'>
                                {qcCase.methodology ? qcCase.methodology.replace(/_/g, ' ') : '—'}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-700 capitalize'>
                                {qcCase.priority || '—'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${qcStatusColor}`}
                              >
                                {qcStatusLabel}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-700'>
                                {qcCase.reviewerId || 'Unassigned'}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-500'>
                                {qcCase.dueDate ? formatDate(qcCase.dueDate, 'MMM d, yyyy') : '—'}
                              </span>
                            </td>
                            <td>
                              <button
                                type='button'
                                onClick={() => handleViewQCCase(qcCase.id)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`View QC case ${qcCase.id}`}
                                title='View QC case'
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
              </div>
            )}

            {defects.length > 0 && (
              <div className='card-enterprise'>
                <h2 className='text-lg font-semibold text-gray-900 mb-5'>
                  Defects ({defects.length})
                </h2>

                <div className='overflow-x-auto'>
                  <table className='table-enterprise'>
                    <thead>
                      <tr>
                        <th>Defect ID</th>
                        <th>Category</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>Root Cause</th>
                        <th>Created</th>
                        <th className='w-12'></th>
                      </tr>
                    </thead>
                    <tbody>
                      {defects.map((defect) => {
                        if (!defect) return null;

                        const severityColor = DEFECT_SEVERITY_COLORS[defect.severity] || 'bg-gray-100 text-gray-700 border-gray-200';
                        const severityLabel = DEFECT_SEVERITY_LABELS[defect.severity] || defect.severity || 'Unknown';
                        const defectStatusColor = DEFECT_STATUS_COLORS[defect.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                        const defectStatusLabel = DEFECT_STATUS_LABELS[defect.status] || defect.status || 'Unknown';

                        return (
                          <tr key={defect.id}>
                            <td>
                              <span className='text-sm font-mono text-gray-600'>{defect.id}</span>
                            </td>
                            <td>
                              <div className='flex flex-col'>
                                <span className='text-sm text-gray-700'>{defect.category || '—'}</span>
                                <span className='text-xs text-gray-400'>{defect.subcategory || ''}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor}`}
                              >
                                {severityLabel}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${defectStatusColor}`}
                              >
                                {defectStatusLabel}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-700'>
                                {defect.rootCause || '—'}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-500'>
                                {formatDate(defect.createdAt, 'MMM d, yyyy')}
                              </span>
                            </td>
                            <td>
                              <button
                                type='button'
                                onClick={() => handleViewDefect(defect.id)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`View defect ${defect.id}`}
                                title='View defect'
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
              </div>
            )}

            {remedyCases.length > 0 && (
              <div className='card-enterprise'>
                <h2 className='text-lg font-semibold text-gray-900 mb-5'>
                  Remedy Cases ({remedyCases.length})
                </h2>

                <div className='overflow-x-auto'>
                  <table className='table-enterprise'>
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Type</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>SLA</th>
                        <th className='w-12'></th>
                      </tr>
                    </thead>
                    <tbody>
                      {remedyCases.map((remedyCase) => {
                        if (!remedyCase) return null;

                        const remedyStatusColor = REMEDY_STATUS_COLORS[remedyCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                        const remedyStatusLabel = REMEDY_STATUS_LABELS[remedyCase.status] || remedyCase.status || 'Unknown';

                        return (
                          <tr key={remedyCase.id}>
                            <td>
                              <span className='text-sm font-mono text-gray-600'>{remedyCase.id}</span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-700 capitalize'>
                                {remedyCase.remedyType ? remedyCase.remedyType.replace(/_/g, ' ') : '—'}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-700 capitalize'>
                                {remedyCase.priority || '—'}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${remedyStatusColor}`}
                              >
                                {remedyStatusLabel}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-500'>
                                {remedyCase.dueDate ? formatDate(remedyCase.dueDate, 'MMM d, yyyy') : '—'}
                              </span>
                            </td>
                            <td>
                              {remedyCase.slaBreached ? (
                                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200'>
                                  Breached
                                </span>
                              ) : (
                                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200'>
                                  On Track
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type='button'
                                onClick={() => handleViewRemedy(remedyCase.id)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`View remedy case ${remedyCase.id}`}
                                title='View remedy case'
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
              </div>
            )}

            {repurchaseCases.length > 0 && (
              <div className='card-enterprise'>
                <h2 className='text-lg font-semibold text-gray-900 mb-5'>
                  Repurchase Cases ({repurchaseCases.length})
                </h2>

                <div className='overflow-x-auto'>
                  <table className='table-enterprise'>
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Demand Amount</th>
                        <th>Status</th>
                        <th>Exposure</th>
                        <th>Created</th>
                        <th className='w-12'></th>
                      </tr>
                    </thead>
                    <tbody>
                      {repurchaseCases.map((repurchaseCase) => {
                        if (!repurchaseCase) return null;

                        const repurchaseStatusColor = REPURCHASE_STATUS_COLORS[repurchaseCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                        const repurchaseStatusLabel = REPURCHASE_STATUS_LABELS[repurchaseCase.status] || repurchaseCase.status || 'Unknown';

                        return (
                          <tr key={repurchaseCase.id}>
                            <td>
                              <span className='text-sm font-mono text-gray-600'>{repurchaseCase.id}</span>
                            </td>
                            <td>
                              <span className='text-sm font-mono text-gray-700'>
                                {formatCurrency(repurchaseCase.demandAmount)}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${repurchaseStatusColor}`}
                              >
                                {repurchaseStatusLabel}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm font-mono text-gray-700'>
                                {formatCurrency(repurchaseCase.exposure)}
                              </span>
                            </td>
                            <td>
                              <span className='text-sm text-gray-500'>
                                {formatDate(repurchaseCase.createdAt, 'MMM d, yyyy')}
                              </span>
                            </td>
                            <td>
                              <button
                                type='button'
                                onClick={() => handleViewRepurchase(repurchaseCase.id)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`View repurchase case ${repurchaseCase.id}`}
                                title='View repurchase case'
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
              </div>
            )}

            {qcCases.length === 0 && defects.length === 0 && remedyCases.length === 0 && repurchaseCases.length === 0 && (
              <div className='card-enterprise'>
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
                      <circle cx='12' cy='12' r='10' />
                      <line x1='12' y1='8' x2='12' y2='12' />
                      <line x1='12' y1='16' x2='12.01' y2='16' />
                    </svg>
                  </div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Related Cases</h3>
                  <p className='text-sm text-gray-500 max-w-md mx-auto'>
                    This loan has no associated QC cases, defects, remedy cases, or repurchase cases.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <OverrideModal
          loan={loan}
          isOpen={isOverrideModalOpen}
          onClose={handleCloseOverrideModal}
        />
      </div>
    </RequireRole>
  );
};

LoanDetailPage.propTypes = {};

export default LoanDetailPage;