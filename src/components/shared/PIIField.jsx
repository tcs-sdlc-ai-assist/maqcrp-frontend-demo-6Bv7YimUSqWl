import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { usePIIMask } from '../../hooks/usePIIMask';
import { useAuth } from '../../contexts/AuthContext';
import { getPIISensitivity, getPIICategory } from '../../utils/piiMask';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'PIIField';

const AUTO_REMASK_DELAY_MS = 10000;

const SENSITIVITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SENSITIVITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const SENSITIVITY_COLORS = {
  critical: 'text-risk-critical bg-risk-critical/10 border-risk-critical/20',
  high: 'text-risk-high bg-risk-high/10 border-risk-high/20',
  medium: 'text-risk-medium bg-risk-medium/10 border-risk-medium/20',
  low: 'text-risk-low bg-risk-low/10 border-risk-low/20',
};

const PIIField = ({ fieldType, value, entityId, label, className = '' }) => {
  const { maskValue, revealValue, isRevealed, remaskValue } = usePIIMask();
  const { currentPersona } = useAuth();

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const fieldRef = useRef(null);
  const tooltipTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const sensitivity = getPIISensitivity(fieldType);
  const category = getPIICategory(fieldType);
  const revealed = isRevealed(fieldType, entityId);

  const sensitivityLevel = SENSITIVITY_ORDER[sensitivity] || 0;
  const sensitivityLabel = SENSITIVITY_LABELS[sensitivity] || 'Unknown';
  const sensitivityColorClass = SENSITIVITY_COLORS[sensitivity] || SENSITIVITY_COLORS.low;

  const personaId = currentPersona?.id || '';
  const personaLabel = currentPersona?.label || 'Unknown';

  const canReveal = useCallback(() => {
    if (!personaId) {
      return false;
    }

    if (sensitivity === 'critical') {
      return personaId === 'admin' || personaId === 'fraud-investigator';
    }

    if (sensitivity === 'high') {
      return ['admin', 'fraud-investigator', 'risk-analyst'].includes(personaId);
    }

    return true;
  }, [personaId, sensitivity]);

  const displayValue = revealed ? String(value ?? '') : maskValue(fieldType, value);

  const handleReveal = useCallback(() => {
    if (!canReveal()) {
      debug(COMPONENT_NAME, 'User does not have permission to reveal this PII field', {
        fieldType,
        entityId,
        personaId,
        sensitivity,
      });
      return;
    }

    if (revealed) {
      remaskValue(fieldType, entityId);
      debug(COMPONENT_NAME, 'PII field manually re-masked', { fieldType, entityId });
      return;
    }

    revealValue(fieldType, entityId, value);
    debug(COMPONENT_NAME, 'PII field revealed', { fieldType, entityId });
  }, [canReveal, revealed, fieldType, entityId, value, revealValue, remaskValue, personaId, sensitivity]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleReveal();
      }
    },
    [handleReveal],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);

    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }

    tooltipTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setShowTooltip(true);
      }
    }, 500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);

    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

    setShowTooltip(false);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!revealed) {
      return;
    }

    const timerId = setTimeout(() => {
      if (isMountedRef.current) {
        remaskValue(fieldType, entityId);
        debug(COMPONENT_NAME, 'PII field auto re-masked after timeout', {
          fieldType,
          entityId,
          timeoutMs: AUTO_REMASK_DELAY_MS,
        });
      }
    }, AUTO_REMASK_DELAY_MS);

    return () => {
      clearTimeout(timerId);
    };
  }, [revealed, fieldType, entityId, remaskValue]);

  if (value === null || value === undefined || value === '') {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label && (
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
            {label}
          </span>
        )}
        <span className='text-sm text-gray-400 italic'>Not provided</span>
      </div>
    );
  }

  const isInteractive = canReveal();
  const activeState = isHovered || isFocused;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className='flex items-center gap-2'>
          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
            {label}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium border ${sensitivityColorClass}`}
            title={`Sensitivity: ${sensitivityLabel} | Category: ${category}`}
          >
            {sensitivityLabel}
          </span>
        </div>
      )}

      <div className='relative inline-flex items-center gap-2'>
        <div
          ref={fieldRef}
          className={`
            relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
            ${revealed
              ? 'bg-amber-50 border-amber-300 text-gray-900'
              : 'bg-gray-50 border-gray-200 text-gray-700'
            }
            ${isInteractive ? 'cursor-pointer hover:border-enterprise-400 hover:bg-enterprise-50/30' : 'cursor-default'}
            ${activeState && isInteractive ? 'border-enterprise-500 ring-2 ring-enterprise-500/20' : ''}
            ${isFocused ? 'border-enterprise-500 ring-2 ring-enterprise-500/20' : ''}
          `}
          role='button'
          tabIndex={isInteractive ? 0 : -1}
          aria-label={
            revealed
              ? `${label || fieldType}: ${String(value)}. Click to mask.`
              : `${label || fieldType}: masked. ${isInteractive ? 'Click to reveal.' : 'You do not have permission to reveal this field.'}`
          }
          aria-expanded={revealed}
          aria-live='polite'
          onClick={isInteractive ? handleReveal : undefined}
          onKeyDown={isInteractive ? handleKeyDown : undefined}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <span
            className={`text-sm font-mono select-all transition-colors duration-200 ${
              revealed ? 'text-gray-900' : 'text-gray-500'
            }`}
          >
            {displayValue}
          </span>

          {isInteractive && (
            <button
              type='button'
              className={`
                flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors duration-200
                ${revealed
                  ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-100'
                  : 'text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50'
                }
              `}
              onClick={(e) => {
                e.stopPropagation();
                handleReveal();
              }}
              aria-label={revealed ? 'Mask value' : 'Reveal value'}
              tabIndex={-1}
            >
              {revealed ? (
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
                  <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' />
                  <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' />
                  <line x1='1' y1='1' x2='23' y2='23' />
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
                  className='w-4 h-4'
                >
                  <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                  <circle cx='12' cy='12' r='3' />
                </svg>
              )}
            </button>
          )}

          {!isInteractive && (
            <span
              className='flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300'
              title={`You do not have permission to reveal ${sensitivityLabel} sensitivity PII fields. Required role: ${sensitivity === 'critical' ? 'Administrator or Fraud Investigator' : sensitivity === 'high' ? 'Administrator, Fraud Investigator, or Risk Analyst' : 'Any authenticated user'}`}
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
                <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                <path d='M7 11V7a5 5 0 0 1 10 0v4' />
              </svg>
            </span>
          )}
        </div>

        {revealed && (
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-amber-100 text-amber-700 border border-amber-200 animate-fade-in'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-3 h-3'
            >
              <circle cx='12' cy='12' r='10' />
              <polyline points='12 6 12 12 16 14' />
            </svg>
            Auto-masks in {AUTO_REMASK_DELAY_MS / 1000}s
          </span>
        )}

        {showTooltip && !revealed && isInteractive && (
          <div className='absolute left-0 -top-10 z-50 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs shadow-lg animate-fade-in whitespace-nowrap pointer-events-none'>
            Click to reveal {sensitivityLabel.toLowerCase()} sensitivity PII
            <div className='absolute left-4 -bottom-1 w-2 h-2 bg-gray-900 rotate-45' />
          </div>
        )}
      </div>
    </div>
  );
};

PIIField.propTypes = {
  fieldType: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  entityId: PropTypes.string.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
};

PIIField.defaultProps = {
  value: null,
  label: '',
  className: '',
};

export default PIIField;