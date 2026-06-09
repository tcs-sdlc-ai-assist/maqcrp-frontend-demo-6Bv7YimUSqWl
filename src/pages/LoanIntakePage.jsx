import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useLoans } from '../contexts/LoanContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { validateLoanSchema, validateDependencyRules, validateSellerReference } from '../utils/validators';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../utils/formatters';
import { debug, info, warn, error } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'LoanIntakePage';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const LOAN_STATUSES = [
  'PENDING_VALIDATION',
  'VALIDATED',
  'PASS',
  'FAIL',
  'EXCEPTION',
  'OVERRIDDEN',
];

const PRODUCT_TYPES = ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];

const CHANNELS = ['retail', 'correspondent', 'broker', 'wholesale'];

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

const MockFileUploader = ({ onUploadComplete, isUploading }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('idle');
  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadProgress(0);
    setUploadStage('idle');
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStage('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUpload = useCallback(() => {
    if (!selectedFile) return;

    setUploadStage('uploading');
    setUploadProgress(0);

    const totalDuration = 2500;
    const intervalMs = 50;
    const totalSteps = totalDuration / intervalMs;
    let step = 0;

    progressIntervalRef.current = setInterval(() => {
      step++;
      const progress = Math.min(100, Math.round((step / totalSteps) * 100));

      if (isMountedRef.current) {
        setUploadProgress(progress);

        if (progress < 30) {
          setUploadStage('validating');
        } else if (progress < 70) {
          setUploadStage('processing');
        } else if (progress < 100) {
          setUploadStage('finalizing');
        }
      }

      if (progress >= 100) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;

        if (isMountedRef.current) {
          setUploadStage('complete');

          setTimeout(() => {
            if (isMountedRef.current && typeof onUploadComplete === 'function') {
              onUploadComplete(selectedFile);
            }
          }, 300);
        }
      }
    }, intervalMs);
  }, [selectedFile, onUploadComplete]);

  const stageLabel = () => {
    switch (uploadStage) {
      case 'validating':
        return 'Validating file format...';
      case 'processing':
        return 'Processing loan records...';
      case 'finalizing':
        return 'Finalizing import...';
      case 'complete':
        return 'Upload complete';
      default:
        return '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className='card-enterprise'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Loan File Upload</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Upload a CSV or JSON file containing loan records for intake processing.
          </p>
        </div>
      </div>

      <div className='border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-enterprise-300 transition-colors duration-200'>
        {!selectedFile ? (
          <div className='space-y-4'>
            <div className='mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-enterprise-50'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-8 h-8 text-enterprise-600'
              >
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='17 8 12 3 7 8' />
                <line x1='12' y1='3' x2='12' y2='15' />
              </svg>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-700'>
                Drag and drop your file here, or{' '}
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  className='text-enterprise-600 hover:text-enterprise-700 font-semibold focus:outline-none focus:underline'
                >
                  browse
                </button>
              </p>
              <p className='text-xs text-gray-400 mt-1'>CSV or JSON files up to 10 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='.csv,.json'
              onChange={handleFileSelect}
              className='hidden'
              aria-label='Select loan file to upload'
            />
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='flex items-center justify-center gap-3'>
              <div className='w-10 h-10 flex items-center justify-center rounded-lg bg-enterprise-50'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={1.5}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-5 h-5 text-enterprise-600'
                >
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                </svg>
              </div>
              <div className='text-left'>
                <p className='text-sm font-medium text-gray-900'>{selectedFile.name}</p>
                <p className='text-xs text-gray-500'>{formatFileSize(selectedFile.size)}</p>
              </div>
              {uploadStage === 'idle' && (
                <button
                  type='button'
                  onClick={handleClearFile}
                  className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                  aria-label='Remove selected file'
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
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                </button>
              )}
            </div>

            {uploadStage !== 'idle' && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-xs text-gray-500'>
                  <span>{stageLabel()}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      uploadStage === 'complete'
                        ? 'bg-green-500'
                        : 'bg-enterprise-600'
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadStage === 'idle' && (
              <button
                type='button'
                onClick={handleUpload}
                disabled={isUploading}
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
                  <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                  <polyline points='17 8 12 3 7 8' />
                  <line x1='12' y1='3' x2='12' y2='15' />
                </svg>
                {isUploading ? 'Uploading...' : 'Upload & Validate'}
              </button>
            )}

            {uploadStage === 'complete' && (
              <div className='flex items-center justify-center gap-2 text-green-600'>
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
                  <polyline points='20 6 9 17 4 12' />
                </svg>
                <span className='text-sm font-medium'>File processed successfully</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

MockFileUploader.propTypes = {
  onUploadComplete: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
};

MockFileUploader.defaultProps = {
  isUploading: false,
};

const ValidationSummary = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const summaryCards = [
    {
      label: 'Total Loans',
      value: stats.total,
      color: 'text-gray-900',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: (
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
      ),
    },
    {
      label: 'Passed',
      value: stats.passed,
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: (
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
      ),
    },
    {
      label: 'Failed',
      value: stats.failed,
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: (
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
      ),
    },
    {
      label: 'Exceptions',
      value: stats.exception,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      icon: (
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
      ),
    },
    {
      label: 'Pending',
      value: stats.pendingValidation,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: (
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
      ),
    },
  ];

  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4'>
      {summaryCards.map((card) => (
        <div
          key={card.label}
          className={`flex items-center gap-3 p-4 rounded-xl border ${card.borderColor} ${card.bgColor}`}
        >
          <div className={`flex-shrink-0 ${card.color}`}>{card.icon}</div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
              {card.label}
            </p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

ValidationSummary.propTypes = {
  stats: PropTypes.shape({
    total: PropTypes.number,
    passed: PropTypes.number,
    failed: PropTypes.number,
    exception: PropTypes.number,
    pendingValidation: PropTypes.number,
    validated: PropTypes.number,
    overridden: PropTypes.number,
  }),
};

ValidationSummary.defaultProps = {
  stats: null,
};

const LoanIntakePage = () => {
  const navigate = useNavigate();
  const { loans, getLoanStats, submitLoan } = useLoans();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();
  const { exportToCSV, isExporting } = useExport();

  const [filters, setFilters] = useState({
    status: '',
    productType: '',
    channel: '',
    search: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loanStats = useMemo(() => {
    return getLoanStats();
  }, [getLoanStats]);

  const filteredLoans = useMemo(() => {
    if (!Array.isArray(loans)) {
      return [];
    }

    let filtered = [...loans];

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
  }, [loans, filters]);

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

  const handleUploadComplete = useCallback(
    (file) => {
      if (!file) return;

      setIsUploading(true);
      setUploadResult(null);

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target.result;
          let parsedLoans = [];

          if (file.name.endsWith('.json')) {
            const parsed = JSON.parse(content);
            parsedLoans = Array.isArray(parsed) ? parsed : parsed.loans || [];
          } else if (file.name.endsWith('.csv')) {
            const lines = content.split('\n').filter((line) => line.trim() !== '');
            if (lines.length < 2) {
              throw new Error('CSV file must contain a header row and at least one data row.');
            }

            const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

            for (let i = 1; i < lines.length; i++) {
              const values = [];
              let current = '';
              let inQuotes = false;

              for (let j = 0; j < lines[i].length; j++) {
                const char = lines[i][j];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  values.push(current.trim().replace(/^"|"$/g, ''));
                  current = '';
                } else {
                  current += char;
                }
              }
              values.push(current.trim().replace(/^"|"$/g, ''));

              const obj = {};
              for (let k = 0; k < headers.length; k++) {
                const header = headers[k];
                const value = values[k] || '';

                if (header === 'loanAmount' || header === 'borrowerIncome' || header === 'creditScore' || header === 'ltv' || header === 'dti') {
                  obj[header] = value ? parseFloat(value) : undefined;
                } else {
                  obj[header] = value || undefined;
                }
              }
              parsedLoans.push(obj);
            }
          }

          if (!Array.isArray(parsedLoans) || parsedLoans.length === 0) {
            throw new Error('No valid loan records found in the uploaded file.');
          }

          let successCount = 0;
          let errorCount = 0;
          const errors = [];

          for (const loanData of parsedLoans) {
            const result = submitLoan(loanData);

            if (result.success) {
              successCount++;
            } else {
              errorCount++;
              errors.push({
                index: errorCount,
                errors: result.errors,
                data: loanData,
              });
            }
          }

          const result = {
            total: parsedLoans.length,
            success: successCount,
            errors: errorCount,
            errorDetails: errors.slice(0, 10),
          };

          if (isMountedRef.current) {
            setUploadResult(result);

            logEvent(
              'LOAN_SUBMIT',
              'loan',
              'batch-upload',
              {
                totalRecords: parsedLoans.length,
                successCount,
                errorCount,
                fileName: file.name,
              },
              currentPersona?.label || 'Unknown',
            );

            addNotification(
              'success',
              'Loan Upload Complete',
              `${successCount} of ${parsedLoans.length} loans imported successfully. ${errorCount > 0 ? `${errorCount} records had validation errors.` : ''}`,
              '/loans',
            );

            info(COMPONENT_NAME, 'Loan file upload processed', {
              fileName: file.name,
              totalRecords: parsedLoans.length,
              successCount,
              errorCount,
            });
          }
        } catch (err) {
          error(COMPONENT_NAME, 'Failed to process uploaded file', err);

          if (isMountedRef.current) {
            setUploadResult({
              total: 0,
              success: 0,
              errors: 1,
              errorDetails: [
                {
                  index: 1,
                  errors: [
                    {
                      field: 'file',
                      code: 'PARSE_ERROR',
                      message: err.message || 'Failed to parse the uploaded file.',
                    },
                  ],
                },
              ],
            });

            addNotification(
              'error',
              'Upload Failed',
              err.message || 'Failed to process the uploaded file. Please check the file format and try again.',
            );
          }
        } finally {
          if (isMountedRef.current) {
            setIsUploading(false);
          }
        }
      };

      reader.onerror = () => {
        error(COMPONENT_NAME, 'FileReader error while reading uploaded file');

        if (isMountedRef.current) {
          setIsUploading(false);
          setUploadResult({
            total: 0,
            success: 0,
            errors: 1,
            errorDetails: [
              {
                index: 1,
                errors: [
                  {
                    field: 'file',
                    code: 'READ_ERROR',
                    message: 'Failed to read the uploaded file. Please try again.',
                  },
                ],
              },
            ],
          });

          addNotification('error', 'Upload Failed', 'Failed to read the uploaded file. Please try again.');
        }
      };

      reader.readAsText(file);
    },
    [submitLoan, logEvent, addNotification, currentPersona],
  );

  const handleViewLoanDetail = useCallback(
    (loanId) => {
      if (!loanId) return;
      navigate(`/loans/${loanId}`);
    },
    [navigate],
  );

  const handleToggleDetail = useCallback((loanId) => {
    setSelectedLoanId((prev) => (prev === loanId ? null : loanId));
  }, []);

  const hasActiveFilters =
    filters.status || filters.productType || filters.channel || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Loan Intake', path: '/loans' },
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
      createdAt: loan.createdAt,
    }));
  }, [filteredLoans]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Loan Intake</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Upload, validate, and manage loan records through the intake pipeline.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='loan-intake'
              variant='secondary'
              label='Export'
            />
          </div>
        </div>

        <MockFileUploader onUploadComplete={handleUploadComplete} isUploading={isUploading} />

        {uploadResult && (
          <div
            className={`p-4 rounded-xl border ${
              uploadResult.errors > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
            } animate-fade-in`}
          >
            <div className='flex items-start gap-3'>
              <div className='flex-shrink-0 mt-0.5'>
                {uploadResult.errors > 0 ? (
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-5 h-5 text-amber-600'
                  >
                    <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                    <line x1='12' y1='9' x2='12' y2='13' />
                    <line x1='12' y1='17' x2='12.01' y2='17' />
                  </svg>
                ) : (
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-5 h-5 text-green-600'
                  >
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                )}
              </div>
              <div className='flex-1'>
                <p className='text-sm font-semibold text-gray-900'>
                  Upload Results
                </p>
                <p className='text-sm text-gray-600 mt-1'>
                  {uploadResult.success} of {uploadResult.total} records imported successfully.
                  {uploadResult.errors > 0 && (
                    <span className='text-amber-700 font-medium'>
                      {' '}
                      {uploadResult.errors} record(s) had validation errors.
                    </span>
                  )}
                </p>

                {uploadResult.errorDetails && uploadResult.errorDetails.length > 0 && (
                  <div className='mt-3 space-y-2'>
                    {uploadResult.errorDetails.map((detail, idx) => (
                      <div
                        key={idx}
                        className='p-3 bg-white rounded-lg border border-gray-200 text-sm'
                      >
                        <p className='font-medium text-gray-700 mb-1'>
                          Record #{detail.index}
                        </p>
                        <ul className='space-y-1'>
                          {detail.errors.map((err, errIdx) => (
                            <li key={errIdx} className='text-red-600 flex items-start gap-1.5'>
                              <span className='flex-shrink-0 mt-0.5'>•</span>
                              <span>
                                {err.field && (
                                  <span className='font-mono text-xs bg-red-50 px-1 py-0.5 rounded mr-1'>
                                    {err.field}
                                  </span>
                                )}
                                {err.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {uploadResult.errors > 10 && (
                      <p className='text-xs text-gray-400 italic'>
                        ...and {uploadResult.errors - 10} more error(s)
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                type='button'
                onClick={() => setUploadResult(null)}
                className='flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                aria-label='Dismiss upload results'
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
                  <line x1='18' y1='6' x2='6' y2='18' />
                  <line x1='6' y1='6' x2='18' y2='18' />
                </svg>
              </button>
            </div>
          </div>
        )}

        <ValidationSummary stats={loanStats} />

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
                  aria-label='Search loans'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='loan-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='loan-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by loan status'
                >
                  <option value=''>All Statuses</option>
                  {LOAN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='loan-filter-product'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Product
                </label>
                <select
                  id='loan-filter-product'
                  value={filters.productType}
                  onChange={(e) => handleFilterChange('productType', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by product type'
                >
                  <option value=''>All Products</option>
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PRODUCT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label
                  htmlFor='loan-filter-channel'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Channel
                </label>
                <select
                  id='loan-filter-channel'
                  value={filters.channel}
                  onChange={(e) => handleFilterChange('channel', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by channel'
                >
                  <option value=''>All Channels</option>
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {CHANNEL_LABELS[channel]}
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
                ? 'No loans found'
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
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                  <polyline points='10 9 9 9 8 9' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Loans Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No loans match your current filters. Try adjusting or clearing your filters.'
                  : 'No loans have been submitted yet. Upload a loan file to get started.'}
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
                    <th>Product</th>
                    <th>Channel</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((loan) => {
                    if (!loan) return null;

                    const isExpanded = selectedLoanId === loan.id;
                    const statusColor = STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel = STATUS_LABELS[loan.status] || loan.status || 'Unknown';

                    return (
                      <tr key={loan.id} className={isExpanded ? 'bg-gray-50/70' : ''}>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleDetail(loan.id)}
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
                          <span className='text-sm text-gray-700'>
                            {PRODUCT_TYPE_LABELS[loan.productType] || loan.productType}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>
                            {CHANNEL_LABELS[loan.channel] || loan.channel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-700'>
                            {formatCurrency(loan.loanAmount)}
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
                          <span className='text-sm text-gray-500'>
                            {formatDate(loan.createdAt, 'MMM d, yyyy')}
                          </span>
                        </td>
                        <td className='text-center'>
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {paginatedData.map((loan) => {
                if (!loan) return null;

                const isExpanded = selectedLoanId === loan.id;

                if (!isExpanded) return null;

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
                          SSN
                        </span>
                        <PIIField
                          fieldType='ssn'
                          value={loan.ssn}
                          entityId={loan.id}
                        />
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Property Address
                        </span>
                        <span className='text-sm text-gray-900'>{loan.propertyAddress || '—'}</span>
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
                          Product Type
                        </span>
                        <span className='text-sm text-gray-900'>
                          {PRODUCT_TYPE_LABELS[loan.productType] || loan.productType}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Channel
                        </span>
                        <span className='text-sm text-gray-900'>
                          {CHANNEL_LABELS[loan.channel] || loan.channel}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Seller ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{loan.sellerId || '—'}</span>
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
                      {loan.creditScore !== undefined && loan.creditScore !== null && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Credit Score
                          </span>
                          <span className='text-sm text-gray-900'>{loan.creditScore}</span>
                        </div>
                      )}
                      {loan.ltv !== undefined && loan.ltv !== null && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            LTV
                          </span>
                          <span className='text-sm text-gray-900'>{loan.ltv}%</span>
                        </div>
                      )}
                      {loan.dti !== undefined && loan.dti !== null && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            DTI
                          </span>
                          <span className='text-sm text-gray-900'>{loan.dti}%</span>
                        </div>
                      )}
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Submitted
                        </span>
                        <span className='text-sm text-gray-900'>
                          {formatDate(loan.createdAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>

                    <div className='flex items-center gap-3 mt-2'>
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
      </div>
    </RequireRole>
  );
};

LoanIntakePage.propTypes = {};

export default LoanIntakePage;