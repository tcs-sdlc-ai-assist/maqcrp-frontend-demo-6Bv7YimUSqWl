import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useExport } from '../../hooks/useExport';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'ExportButton';

const VARIANTS = {
  primary: 'btn-enterprise-primary',
  secondary: 'btn-enterprise-secondary',
  ghost: 'inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
  icon: 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
};

const ExportButton = ({
  data,
  filename,
  variant = 'secondary',
  label = 'Export',
  className = '',
  disabled = false,
  onExportStart,
  onExportComplete,
  onExportError,
}) => {
  const { exportToCSV, exportToJSON, isExporting } = useExport();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const isMountedRef = useRef(true);

  const safeVariant = VARIANTS[variant] ? variant : 'secondary';
  const variantClass = VARIANTS[safeVariant];

  const handleClickOutside = useCallback((event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target)
    ) {
      setIsDropdownOpen(false);
    }
  }, []);

  const handleEscapeKey = useCallback((event) => {
    if (event.key === 'Escape') {
      setIsDropdownOpen(false);
      if (buttonRef.current) {
        buttonRef.current.focus();
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isDropdownOpen, handleClickOutside, handleEscapeKey]);

  const handleToggleDropdown = useCallback(() => {
    if (disabled || isExporting) {
      return;
    }

    setIsDropdownOpen((prev) => !prev);
  }, [disabled, isExporting]);

  const handleExportCSV = useCallback(async () => {
    if (!Array.isArray(data)) {
      warn(COMPONENT_NAME, 'Export CSV called with non-array data', {
        dataType: typeof data,
      });
      return;
    }

    if (data.length === 0) {
      warn(COMPONENT_NAME, 'Export CSV called with empty data array');
      return;
    }

    setIsDropdownOpen(false);

    if (typeof onExportStart === 'function') {
      onExportStart('csv');
    }

    setExportStatus('exporting');

    try {
      const result = await exportToCSV(data, filename);

      if (!isMountedRef.current) {
        return;
      }

      if (result.success) {
        setExportStatus('success');
        debug(COMPONENT_NAME, 'CSV export completed', { filename: result.filename });

        if (typeof onExportComplete === 'function') {
          onExportComplete('csv', result.filename);
        }
      } else {
        setExportStatus('error');
        warn(COMPONENT_NAME, 'CSV export failed', { error: result.error });

        if (typeof onExportError === 'function') {
          onExportError('csv', result.error);
        }
      }
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      setExportStatus('error');
      warn(COMPONENT_NAME, 'CSV export threw an unexpected error', err);

      if (typeof onExportError === 'function') {
        onExportError('csv', err.message || 'An unexpected error occurred during CSV export.');
      }
    } finally {
      if (isMountedRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) {
            setExportStatus(null);
          }
        }, 2000);
      }
    }
  }, [data, filename, exportToCSV, onExportStart, onExportComplete, onExportError]);

  const handleExportJSON = useCallback(async () => {
    if (data === undefined) {
      warn(COMPONENT_NAME, 'Export JSON called with undefined data');
      return;
    }

    setIsDropdownOpen(false);

    if (typeof onExportStart === 'function') {
      onExportStart('json');
    }

    setExportStatus('exporting');

    try {
      const result = await exportToJSON(data, filename);

      if (!isMountedRef.current) {
        return;
      }

      if (result.success) {
        setExportStatus('success');
        debug(COMPONENT_NAME, 'JSON export completed', { filename: result.filename });

        if (typeof onExportComplete === 'function') {
          onExportComplete('json', result.filename);
        }
      } else {
        setExportStatus('error');
        warn(COMPONENT_NAME, 'JSON export failed', { error: result.error });

        if (typeof onExportError === 'function') {
          onExportError('json', result.error);
        }
      }
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      setExportStatus('error');
      warn(COMPONENT_NAME, 'JSON export threw an unexpected error', err);

      if (typeof onExportError === 'function') {
        onExportError('json', err.message || 'An unexpected error occurred during JSON export.');
      }
    } finally {
      if (isMountedRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) {
            setExportStatus(null);
          }
        }, 2000);
      }
    }
  }, [data, filename, exportToJSON, onExportStart, onExportComplete, onExportError]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleDropdown();
      }
    },
    [handleToggleDropdown],
  );

  const isButtonDisabled = disabled || isExporting;
  const showLoading = isExporting || exportStatus === 'exporting';

  const statusIcon = () => {
    if (showLoading) {
      return (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-4 h-4 animate-spin'
        >
          <path d='M21 12a9 9 0 1 1-6.219-8.56' />
        </svg>
      );
    }

    if (exportStatus === 'success') {
      return (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-4 h-4 text-green-500'
        >
          <polyline points='20 6 9 17 4 12' />
        </svg>
      );
    }

    if (exportStatus === 'error') {
      return (
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
      );
    }

    return (
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
        <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
        <polyline points='7 10 12 15 17 10' />
        <line x1='12' y1='15' x2='12' y2='3' />
      </svg>
    );
  };

  const buttonContent = () => {
    if (variant === 'icon') {
      return statusIcon();
    }

    return (
      <>
        {statusIcon()}
        <span className='ml-2'>
          {showLoading
            ? 'Exporting...'
            : exportStatus === 'success'
              ? 'Exported'
              : exportStatus === 'error'
                ? 'Export Failed'
                : label}
        </span>
        {!showLoading && variant !== 'ghost' && (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-4 h-4 ml-1.5 transition-transform duration-200'
            style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points='6 9 12 15 18 9' />
          </svg>
        )}
      </>
    );
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type='button'
        onClick={handleToggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={isButtonDisabled}
        className={variantClass}
        aria-haspopup='true'
        aria-expanded={isDropdownOpen}
        aria-label={variant === 'icon' ? 'Export data' : `${label} - Export options`}
        title={variant === 'icon' ? 'Export data' : undefined}
      >
        {buttonContent()}
      </button>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className='absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-scale-in'
          role='menu'
          aria-label='Export format options'
        >
          <button
            type='button'
            onClick={handleExportCSV}
            disabled={isExporting}
            className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-enterprise-600 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            role='menuitem'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4 text-gray-400 flex-shrink-0'
            >
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
              <line x1='16' y1='13' x2='8' y2='13' />
              <line x1='16' y1='17' x2='8' y2='17' />
              <polyline points='10 9 9 9 8 9' />
            </svg>
            Export as CSV
          </button>

          <button
            type='button'
            onClick={handleExportJSON}
            disabled={isExporting}
            className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-enterprise-600 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            role='menuitem'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4 text-gray-400 flex-shrink-0'
            >
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
              <line x1='16' y1='13' x2='8' y2='13' />
              <line x1='16' y1='17' x2='8' y2='17' />
              <polyline points='10 9 9 9 8 9' />
            </svg>
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
};

ExportButton.propTypes = {
  data: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
  filename: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'icon']),
  label: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  onExportStart: PropTypes.func,
  onExportComplete: PropTypes.func,
  onExportError: PropTypes.func,
};

ExportButton.defaultProps = {
  filename: 'export',
  variant: 'secondary',
  label: 'Export',
  className: '',
  disabled: false,
  onExportStart: null,
  onExportComplete: null,
  onExportError: null,
};

export default ExportButton;