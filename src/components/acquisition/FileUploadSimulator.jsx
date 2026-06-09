import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'FileUploadSimulator';

const SIMULATED_UPLOAD_DURATION_MS = 3000;
const PROGRESS_UPDATE_INTERVAL_MS = 50;

const MOCK_BATCH_NAMES = [
  'batch_q2_2026_loans.csv',
  'june_intake_batch.json',
  'seller_submission_2026-06.csv',
  'correspondent_loans_q2.json',
  'retail_pipeline_2026.csv',
];

const MOCK_BATCH_SIZES = [12, 25, 8, 15, 20];

const FileUploadSimulator = ({ onUploadComplete, isUploading, disabled }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('idle');
  const [error, setError] = useState(null);

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

  const handleFileSelect = useCallback(
    (e) => {
      const file = e.target.files?.[0];

      if (!file) {
        return;
      }

      setSelectedFile(file);
      setUploadProgress(0);
      setUploadStage('idle');
      setError(null);

      debug(COMPONENT_NAME, 'File selected', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
    },
    [],
  );

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStage('idle');
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    debug(COMPONENT_NAME, 'File selection cleared');
  }, []);

  const handleUpload = useCallback(() => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    if (isUploading) {
      return;
    }

    setError(null);
    setUploadStage('uploading');
    setUploadProgress(0);

    const totalSteps = SIMULATED_UPLOAD_DURATION_MS / PROGRESS_UPDATE_INTERVAL_MS;
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
              const batchIndex = Math.floor(Math.random() * MOCK_BATCH_NAMES.length);
              const mockFile = new File(
                [JSON.stringify({ batch: MOCK_BATCH_NAMES[batchIndex] })],
                MOCK_BATCH_NAMES[batchIndex],
                {
                  type: MOCK_BATCH_NAMES[batchIndex].endsWith('.json')
                    ? 'application/json'
                    : 'text/csv',
                },
              );

              debug(COMPONENT_NAME, 'Upload simulation complete', {
                fileName: mockFile.name,
                batchSize: MOCK_BATCH_SIZES[batchIndex],
              });

              onUploadComplete(mockFile);
            }
          }, 300);
        }
      }
    }, PROGRESS_UPDATE_INTERVAL_MS);

    debug(COMPONENT_NAME, 'Upload simulation started', {
      fileName: selectedFile.name,
      durationMs: SIMULATED_UPLOAD_DURATION_MS,
    });
  }, [selectedFile, isUploading, onUploadComplete]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleUpload();
      }
    },
    [handleUpload],
  );

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
    if (bytes == null || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isDisabled = disabled || isUploading;
  const isUploadInProgress = uploadStage !== 'idle' && uploadStage !== 'complete';

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
                  disabled={isDisabled}
                  className='text-enterprise-600 hover:text-enterprise-700 font-semibold focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed'
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
              disabled={isDisabled}
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
                  disabled={isDisabled}
                  className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
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

            {isUploadInProgress && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-xs text-gray-500'>
                  <span>{stageLabel()}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                  <div
                    className='h-full rounded-full bg-enterprise-600 transition-all duration-100'
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadStage === 'idle' && (
              <button
                type='button'
                onClick={handleUpload}
                onKeyDown={handleKeyDown}
                disabled={isDisabled}
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

      {error && (
        <div className='mt-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in'>
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
            <p className='text-sm text-red-700'>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

FileUploadSimulator.propTypes = {
  onUploadComplete: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  disabled: PropTypes.bool,
};

FileUploadSimulator.defaultProps = {
  isUploading: false,
  disabled: false,
};

export default FileUploadSimulator;