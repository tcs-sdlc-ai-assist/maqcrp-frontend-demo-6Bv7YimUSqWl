import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatDate } from '../utils/dateUtils';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'WatchlistPage';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const WATCHLIST_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'cleared', label: 'Cleared' },
];

const WATCHLIST_STATUS_COLORS = {
  active: 'bg-red-100 text-red-700 border-red-200',
  monitoring: 'bg-amber-100 text-amber-700 border-amber-200',
  cleared: 'bg-green-100 text-green-700 border-green-200',
};

const WATCHLIST_STATUS_LABELS = {
  active: 'Active',
  monitoring: 'Monitoring',
  cleared: 'Cleared',
};

const ACTION_PLAN_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ACTION_PLAN_STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const ACTION_PLAN_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const ACTION_PLAN_PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const AddToWatchlistModal = ({ isOpen, onClose, onAdd }) => {
  const { sellers } = useMockData();

  const [formData, setFormData] = useState({
    counterpartyId: '',
    reason: '',
    recommendation: 'manual',
    reviewDate: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [isCounterpartyDropdownOpen, setIsCounterpartyDropdownOpen] = useState(false);

  const counterpartySelectRef = useRef(null);
  const counterpartyDropdownRef = useRef(null);
  const counterpartyInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        counterpartyId: '',
        reason: '',
        recommendation: 'manual',
        reviewDate: '',
      });
      setErrors({});
      setIsSubmitting(false);
      setCounterpartySearch('');
      setIsCounterpartyDropdownOpen(false);

      setTimeout(() => {
        if (counterpartySelectRef.current) {
          counterpartySelectRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const safeSellers = useMemo(() => {
    if (!Array.isArray(sellers)) {
      return [];
    }
    return sellers;
  }, [sellers]);

  const filteredCounterparties = useMemo(() => {
    if (!counterpartySearch || counterpartySearch.trim() === '') {
      return safeSellers;
    }
    const searchLower = counterpartySearch.toLowerCase();
    return safeSellers.filter(
      (seller) =>
        seller &&
        ((seller.id && seller.id.toLowerCase().includes(searchLower)) ||
          (seller.name && seller.name.toLowerCase().includes(searchLower))),
    );
  }, [safeSellers, counterpartySearch]);

  const selectedCounterparty = useMemo(() => {
    if (!formData.counterpartyId) return null;
    return safeSellers.find((s) => s && s.id === formData.counterpartyId) || null;
  }, [formData.counterpartyId, safeSellers]);

  const handleCounterpartySelect = useCallback(
    (sellerId) => {
      setFormData((prev) => ({ ...prev, counterpartyId: sellerId }));
      setCounterpartySearch('');
      setIsCounterpartyDropdownOpen(false);

      if (errors.counterpartyId) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.counterpartyId;
          return next;
        });
      }
    },
    [errors.counterpartyId],
  );

  const handleCounterpartySearchChange = useCallback((e) => {
    setCounterpartySearch(e.target.value);
    setIsCounterpartyDropdownOpen(true);
  }, []);

  const handleCounterpartyInputFocus = useCallback(() => {
    setIsCounterpartyDropdownOpen(true);
  }, []);

  const handleFieldChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const handleClickOutside = useCallback((event) => {
    if (
      counterpartyDropdownRef.current &&
      !counterpartyDropdownRef.current.contains(event.target) &&
      counterpartyInputRef.current &&
      !counterpartyInputRef.current.contains(event.target)
    ) {
      setIsCounterpartyDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.counterpartyId || formData.counterpartyId.trim() === '') {
      newErrors.counterpartyId = 'Please select a counterparty.';
    }

    if (!formData.reason || formData.reason.trim() === '') {
      newErrors.reason = 'Please provide a reason for adding to the watchlist.';
    } else if (formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const entryData = {
        counterpartyId: formData.counterpartyId,
        counterpartyName: selectedCounterparty ? selectedCounterparty.name : formData.counterpartyId,
        reason: formData.reason,
        recommendation: formData.recommendation,
        reviewDate: formData.reviewDate || null,
      };

      if (isMountedRef.current) {
        onAdd(entryData);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Add to watchlist submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, selectedCounterparty, onAdd, onClose]);

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

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='add-to-watchlist-modal-title'
      aria-describedby='add-to-watchlist-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='add-to-watchlist-modal-title' className='text-lg font-semibold text-gray-900'>
              Add to Watchlist
            </h2>
            <p id='add-to-watchlist-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Add a counterparty to the watchlist for enhanced monitoring.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close add to watchlist modal'
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
              htmlFor='watchlist-counterparty'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Counterparty
              <span className='text-red-500 ml-0.5'>*</span>
            </label>

            {formData.counterpartyId && selectedCounterparty ? (
              <div className='flex items-center gap-3 p-3 rounded-lg bg-enterprise-50 border border-enterprise-200'>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-enterprise-900'>
                    {selectedCounterparty.name || selectedCounterparty.id}
                  </p>
                  <p className='text-xs text-enterprise-600 font-mono'>
                    {selectedCounterparty.id}
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, counterpartyId: '' }));
                    setCounterpartySearch('');
                  }}
                  disabled={isSubmitting}
                  className='p-1 rounded text-enterprise-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                  aria-label='Clear selected counterparty'
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
            ) : (
              <div className='relative'>
                <input
                  ref={counterpartyInputRef}
                  type='text'
                  value={counterpartySearch}
                  onChange={handleCounterpartySearchChange}
                  onFocus={handleCounterpartyInputFocus}
                  disabled={isSubmitting}
                  placeholder='Search counterparties by name or ID...'
                  className={`input-enterprise ${errors.counterpartyId ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  aria-label='Search counterparties'
                  aria-describedby={
                    errors.counterpartyId ? 'watchlist-counterparty-error' : undefined
                  }
                  aria-invalid={errors.counterpartyId ? 'true' : 'false'}
                />

                {isCounterpartyDropdownOpen && filteredCounterparties.length > 0 && (
                  <div
                    ref={counterpartyDropdownRef}
                    className='absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-48 overflow-y-auto animate-scale-in'
                  >
                    {filteredCounterparties.map((seller) => {
                      if (!seller) return null;

                      return (
                        <button
                          key={seller.id}
                          type='button'
                          onClick={() => handleCounterpartySelect(seller.id)}
                          disabled={isSubmitting}
                          className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-150 text-gray-700 hover:bg-enterprise-50 hover:text-enterprise-700'
                        >
                          <div className='flex-1 min-w-0'>
                            <span className='font-medium block truncate'>
                              {seller.name || seller.id}
                            </span>
                            <span className='text-xs text-gray-400 font-mono'>
                              {seller.id}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {isCounterpartyDropdownOpen &&
                  counterpartySearch &&
                  filteredCounterparties.length === 0 && (
                    <div className='absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-4 text-center animate-scale-in'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={1.5}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-6 h-6 text-gray-300 mx-auto mb-1'
                      >
                        <circle cx='11' cy='11' r='8' />
                        <line x1='21' y1='21' x2='16.65' y2='16.65' />
                      </svg>
                      <p className='text-xs text-gray-500'>
                        No counterparties found matching &ldquo;{counterpartySearch}&rdquo;
                      </p>
                    </div>
                  )}
              </div>
            )}

            {errors.counterpartyId && (
              <p
                id='watchlist-counterparty-error'
                className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
              >
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
                {errors.counterpartyId}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='watchlist-reason'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Reason
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              id='watchlist-reason'
              value={formData.reason}
              onChange={(e) => handleFieldChange('reason', e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide a detailed reason for adding this counterparty to the watchlist...'
              className={`input-enterprise resize-none ${errors.reason ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Watchlist reason'
              aria-describedby={errors.reason ? 'watchlist-reason-error' : undefined}
              aria-invalid={errors.reason ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.reason ? (
                <p
                  id='watchlist-reason-error'
                  className='text-xs text-red-600 flex items-center gap-1'
                >
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
                  {errors.reason}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{formData.reason.length}/2000</span>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='watchlist-recommendation'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Recommendation
              </label>
              <select
                id='watchlist-recommendation'
                value={formData.recommendation}
                onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                disabled={isSubmitting}
                className='input-enterprise'
                aria-label='Watchlist recommendation'
              >
                <option value='manual'>Manual Review</option>
                <option value='enhanced_sampling'>Enhanced Sampling</option>
                <option value='remediation_plan'>Remediation Plan</option>
                <option value='suspension'>Suspension</option>
              </select>
            </div>

            <div>
              <label
                htmlFor='watchlist-review-date'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Review Date
              </label>
              <input
                id='watchlist-review-date'
                type='date'
                value={formData.reviewDate}
                onChange={(e) => handleFieldChange('reviewDate', e.target.value)}
                disabled={isSubmitting}
                className='input-enterprise'
                aria-label='Review date'
              />
              <p className='text-xs text-gray-400 mt-1'>Optional. Leave blank if not yet scheduled.</p>
            </div>
          </div>

          {formData.counterpartyId && formData.reason && (
            <div className='p-4 rounded-xl bg-purple-50 border border-purple-200'>
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
                    className='w-5 h-5 text-purple-600'
                  >
                    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                    <circle cx='12' cy='12' r='3' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-purple-800'>Watchlist Summary</p>
                  <p className='text-xs text-purple-700 mt-1'>
                    Adding{' '}
                    <span className='font-semibold'>
                      {selectedCounterparty ? selectedCounterparty.name : formData.counterpartyId}
                    </span>{' '}
                    to the watchlist with recommendation{' '}
                    <span className='font-semibold'>
                      {formData.recommendation.replace(/_/g, ' ')}
                    </span>
                    . This action will be logged in the audit trail.
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
                Adding...
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
                Add to Watchlist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

AddToWatchlistModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
};

const MonitoringNoteModal = ({ watchlistEntry, isOpen, onClose, onAddNote }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const contentInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setContent('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (contentInputRef.current) {
          contentInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleContentChange = useCallback(
    (e) => {
      const value = e.target.value;
      setContent(value);

      if (errors.content) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.content;
          return next;
        });
      }
    },
    [errors.content],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!content || content.trim() === '') {
      newErrors.content = 'Please provide monitoring note content.';
    } else if (content.trim().length < 5) {
      newErrors.content = 'Note must be at least 5 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [content]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!watchlistEntry || !watchlistEntry.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isMountedRef.current) {
        onAddNote(watchlistEntry.id, content);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Monitoring note submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, watchlistEntry, content, onAddNote, onClose]);

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

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='monitoring-note-modal-title'
      aria-describedby='monitoring-note-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='monitoring-note-modal-title' className='text-lg font-semibold text-gray-900'>
              Add Monitoring Note
            </h2>
            <p id='monitoring-note-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Add a monitoring note for{' '}
              <span className='font-semibold'>
                {watchlistEntry?.counterpartyName || watchlistEntry?.counterpartyId || 'Unknown'}
              </span>
              .
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close monitoring note modal'
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
              htmlFor='monitoring-note-content'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Note
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              ref={contentInputRef}
              id='monitoring-note-content'
              value={content}
              onChange={handleContentChange}
              disabled={isSubmitting}
              rows={5}
              placeholder='Enter your monitoring note...'
              className={`input-enterprise resize-none ${errors.content ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Monitoring note content'
              aria-describedby={errors.content ? 'monitoring-note-content-error' : undefined}
              aria-invalid={errors.content ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.content ? (
                <p
                  id='monitoring-note-content-error'
                  className='text-xs text-red-600 flex items-center gap-1'
                >
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
                  {errors.content}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{content.length}/2000</span>
            </div>
          </div>

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
                Adding...
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
                Add Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

MonitoringNoteModal.propTypes = {
  watchlistEntry: PropTypes.shape({
    id: PropTypes.string,
    counterpartyId: PropTypes.string,
    counterpartyName: PropTypes.string,
    reason: PropTypes.string,
    status: PropTypes.string,
    watchlistScore: PropTypes.number,
    recommendation: PropTypes.string,
    actionPlanId: PropTypes.string,
    monitoringNotes: PropTypes.array,
    addedBy: PropTypes.string,
    addedDate: PropTypes.string,
    reviewDate: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAddNote: PropTypes.func.isRequired,
};

MonitoringNoteModal.defaultProps = {
  watchlistEntry: null,
};

const RemoveWatchlistModal = ({ watchlistEntry, isOpen, onClose, onRemove }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const reasonInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (reasonInputRef.current) {
          reasonInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleReasonChange = useCallback(
    (e) => {
      const value = e.target.value;
      setReason(value);

      if (errors.reason) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.reason;
          return next;
        });
      }
    },
    [errors.reason],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!reason || reason.trim() === '') {
      newErrors.reason = 'Please provide a reason for removal.';
    } else if (reason.trim().length < 5) {
      newErrors.reason = 'Reason must be at least 5 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [reason]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (!watchlistEntry || !watchlistEntry.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isMountedRef.current) {
        onRemove(watchlistEntry.id, reason);
        onClose();
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Remove from watchlist submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, watchlistEntry, reason, onRemove, onClose]);

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

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='remove-watchlist-modal-title'
      aria-describedby='remove-watchlist-modal-description'
    >
      <div className='w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <div>
            <h2 id='remove-watchlist-modal-title' className='text-lg font-semibold text-gray-900'>
              Remove from Watchlist
            </h2>
            <p id='remove-watchlist-modal-description' className='text-sm text-gray-500 mt-0.5'>
              Remove{' '}
              <span className='font-semibold'>
                {watchlistEntry?.counterpartyName || watchlistEntry?.counterpartyId || 'Unknown'}
              </span>{' '}
              from the watchlist.
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close remove watchlist modal'
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
              htmlFor='remove-watchlist-reason'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Reason for Removal
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <textarea
              ref={reasonInputRef}
              id='remove-watchlist-reason'
              value={reason}
              onChange={handleReasonChange}
              disabled={isSubmitting}
              rows={4}
              placeholder='Provide the reason for removing this counterparty from the watchlist...'
              className={`input-enterprise resize-none ${errors.reason ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              aria-label='Removal reason'
              aria-describedby={errors.reason ? 'remove-watchlist-reason-error' : undefined}
              aria-invalid={errors.reason ? 'true' : 'false'}
              maxLength={2000}
            />
            <div className='flex items-center justify-between mt-1.5'>
              {errors.reason ? (
                <p
                  id='remove-watchlist-reason-error'
                  className='text-xs text-red-600 flex items-center gap-1'
                >
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
                  {errors.reason}
                </p>
              ) : (
                <span />
              )}
              <span className='text-xs text-gray-400'>{reason.length}/2000</span>
            </div>
          </div>

          <div className='p-4 rounded-xl bg-amber-50 border border-amber-200'>
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
                  className='w-5 h-5 text-amber-600'
                >
                  <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                  <line x1='12' y1='9' x2='12' y2='13' />
                  <line x1='12' y1='17' x2='12.01' y2='17' />
                </svg>
              </div>
              <div>
                <p className='text-sm font-semibold text-amber-800'>Removal Confirmation</p>
                <p className='text-xs text-amber-700 mt-1'>
                  This will remove{' '}
                  <span className='font-semibold'>
                    {watchlistEntry?.counterpartyName || watchlistEntry?.counterpartyId || 'Unknown'}
                  </span>{' '}
                  from the watchlist. This action will be logged in the audit trail.
                </p>
              </div>
            </div>
          </div>

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
            className='btn-enterprise-primary bg-red-600 hover:bg-red-700 focus:ring-red-500'
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
                Removing...
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
                Remove from Watchlist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

RemoveWatchlistModal.propTypes = {
  watchlistEntry: PropTypes.shape({
    id: PropTypes.string,
    counterpartyId: PropTypes.string,
    counterpartyName: PropTypes.string,
    reason: PropTypes.string,
    status: PropTypes.string,
    watchlistScore: PropTypes.number,
    recommendation: PropTypes.string,
    actionPlanId: PropTypes.string,
    monitoringNotes: PropTypes.array,
    addedBy: PropTypes.string,
    addedDate: PropTypes.string,
    reviewDate: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

RemoveWatchlistModal.defaultProps = {
  watchlistEntry: null,
};

const WatchlistPage = () => {
  const navigate = useNavigate();
  const {
    watchlist,
    actionPlans,
    addToWatchlist,
    removeFromWatchlist,
    addMonitoringNote,
  } = useOversight();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [filters, setFilters] = useState({
    status: '',
    search: '',
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeWatchlist = useMemo(() => {
    if (!Array.isArray(watchlist)) {
      return [];
    }
    return watchlist;
  }, [watchlist]);

  const safeActionPlans = useMemo(() => {
    if (!Array.isArray(actionPlans)) {
      return [];
    }
    return actionPlans;
  }, [actionPlans]);

  const actionPlanMap = useMemo(() => {
    const map = new Map();

    for (const plan of safeActionPlans) {
      if (plan && plan.watchlistEntryId) {
        if (!map.has(plan.watchlistEntryId)) {
          map.set(plan.watchlistEntryId, []);
        }
        map.get(plan.watchlistEntryId).push(plan);
      }
    }

    return map;
  }, [safeActionPlans]);

  const filteredEntries = useMemo(() => {
    let filtered = [...safeWatchlist];

    if (filters.status && typeof filters.status === 'string') {
      filtered = filtered.filter((entry) => entry && entry.status === filters.status);
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((entry) => {
        if (!entry) return false;
        return (
          (entry.counterpartyId && entry.counterpartyId.toLowerCase().includes(searchLower)) ||
          (entry.counterpartyName && entry.counterpartyName.toLowerCase().includes(searchLower)) ||
          (entry.reason && entry.reason.toLowerCase().includes(searchLower))
        );
      });
    }

    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      const statusOrder = { active: 0, monitoring: 1, cleared: 2 };
      const aOrder = statusOrder[a.status] ?? 99;
      const bOrder = statusOrder[b.status] ?? 99;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aDate = a.addedDate ? new Date(a.addedDate) : new Date(0);
      const bDate = b.addedDate ? new Date(b.addedDate) : new Date(0);
      return bDate - aDate;
    });

    return filtered;
  }, [safeWatchlist, filters]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredEntries, { initialPageSize: 25 });

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
      search: '',
    });
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const handleOpenAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const handleAddToWatchlist = useCallback(
    (entryData) => {
      if (!entryData || typeof entryData !== 'object') {
        return;
      }

      const result = addToWatchlist({
        ...entryData,
        addedBy: currentPersona?.label || 'Unknown',
      });

      if (result.success) {
        logEvent(
          'WATCHLIST_ADDED',
          'watchlist',
          result.entry.id,
          {
            counterpartyId: entryData.counterpartyId,
            counterpartyName: entryData.counterpartyName,
            reason: entryData.reason,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Added to Watchlist',
          `${entryData.counterpartyName || entryData.counterpartyId} has been added to the watchlist.`,
        );

        info(COMPONENT_NAME, 'Counterparty added to watchlist', {
          counterpartyId: entryData.counterpartyId,
        });
      } else {
        addNotification(
          'error',
          'Add Failed',
          result.errors && result.errors.length > 0
            ? result.errors[0].message
            : 'Failed to add counterparty to watchlist. Please try again.',
        );
      }
    },
    [addToWatchlist, logEvent, addNotification, currentPersona],
  );

  const handleOpenNoteModal = useCallback((entry) => {
    if (!entry) return;
    setSelectedEntry(entry);
    setIsNoteModalOpen(true);
  }, []);

  const handleCloseNoteModal = useCallback(() => {
    setIsNoteModalOpen(false);
    setSelectedEntry(null);
  }, []);

  const handleAddNote = useCallback(
    (entryId, content) => {
      if (!entryId || !content) return;

      const success = addMonitoringNote(
        entryId,
        content,
        currentPersona?.label || 'Unknown',
      );

      if (success) {
        logEvent(
          'MONITORING_NOTE_ADDED',
          'watchlist',
          entryId,
          {
            noteContent: content,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Note Added',
          'Monitoring note has been added to the watchlist entry.',
        );

        info(COMPONENT_NAME, 'Monitoring note added to watchlist entry', {
          entryId,
        });
      } else {
        addNotification(
          'error',
          'Note Failed',
          'Failed to add monitoring note. Please try again.',
        );
      }
    },
    [addMonitoringNote, logEvent, addNotification, currentPersona],
  );

  const handleOpenRemoveModal = useCallback((entry) => {
    if (!entry) return;
    setSelectedEntry(entry);
    setIsRemoveModalOpen(true);
  }, []);

  const handleCloseRemoveModal = useCallback(() => {
    setIsRemoveModalOpen(false);
    setSelectedEntry(null);
  }, []);

  const handleRemoveFromWatchlist = useCallback(
    (entryId, reason) => {
      if (!entryId) return;

      const success = removeFromWatchlist(
        entryId,
        reason,
        currentPersona?.label || 'Unknown',
      );

      if (success) {
        logEvent(
          'WATCHLIST_REMOVED',
          'watchlist',
          entryId,
          {
            reason,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Removed from Watchlist',
          'Counterparty has been removed from the watchlist.',
        );

        info(COMPONENT_NAME, 'Counterparty removed from watchlist', {
          entryId,
          reason,
        });
      } else {
        addNotification(
          'error',
          'Remove Failed',
          'Failed to remove counterparty from watchlist. Please try again.',
        );
      }
    },
    [removeFromWatchlist, logEvent, addNotification, currentPersona],
  );

  const handleViewActionPlan = useCallback(
    (actionPlanId) => {
      if (!actionPlanId) return;
      navigate(`/action-plans/${actionPlanId}`);
    },
    [navigate],
  );

  const handleViewCounterparty = useCallback(
    (counterpartyId) => {
      if (!counterpartyId) return;
      navigate(`/counterparties/${counterpartyId}`);
    },
    [navigate],
  );

  const handleToggleRow = useCallback((entryId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const hasActiveFilters = filters.status || filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Watchlist', path: '/watchlist' },
  ];

  const exportData = useMemo(() => {
    return filteredEntries.map((entry) => {
      if (!entry) return null;

      const plans = actionPlanMap.get(entry.id) || [];
      const latestPlan = plans.length > 0 ? plans[plans.length - 1] : null;

      return {
        entryId: entry.id,
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterpartyName,
        reason: entry.reason,
        status: entry.status,
        recommendation: entry.recommendation,
        addedBy: entry.addedBy,
        addedDate: entry.addedDate,
        reviewDate: entry.reviewDate,
        actionPlanStatus: latestPlan ? latestPlan.status : 'No action plan',
        monitoringNoteCount: Array.isArray(entry.monitoringNotes) ? entry.monitoringNotes.length : 0,
      };
    }).filter(Boolean);
  }, [filteredEntries, actionPlanMap]);

  const stats = useMemo(() => {
    return {
      total: safeWatchlist.length,
      active: safeWatchlist.filter((e) => e && e.status === 'active').length,
      monitoring: safeWatchlist.filter((e) => e && e.status === 'monitoring').length,
      cleared: safeWatchlist.filter((e) => e && e.status === 'cleared').length,
    };
  }, [safeWatchlist]);

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Watchlist</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Manage counterparties under enhanced monitoring and oversight.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={exportData}
              filename='watchlist'
              variant='secondary'
              label='Export'
            />

            <button
              type='button'
              onClick={handleOpenAddModal}
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
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
              Add to Watchlist
            </button>
          </div>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
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
                <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                <circle cx='12' cy='12' r='3' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Total Entries
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
                Active
              </p>
              <p className='text-2xl font-bold text-red-700'>{stats.active}</p>
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
                <polyline points='12 6 12 12 16 14' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Monitoring
              </p>
              <p className='text-2xl font-bold text-amber-700'>{stats.monitoring}</p>
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
                Cleared
              </p>
              <p className='text-2xl font-bold text-green-700'>{stats.cleared}</p>
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
                  placeholder='Search by counterparty name, ID, or reason...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-96'
                  aria-label='Search watchlist entries'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label
                  htmlFor='watchlist-filter-status'
                  className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'
                >
                  Status
                </label>
                <select
                  id='watchlist-filter-status'
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by status'
                >
                  <option value=''>All Statuses</option>
                  {WATCHLIST_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
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
              {filteredEntries.length === 0
                ? 'No watchlist entries found'
                : `Showing ${pageControls.startIndex}–${pageControls.endIndex} of ${pageControls.totalItems.toLocaleString()} entries`}
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
                  <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                  <circle cx='12' cy='12' r='3' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Watchlist Entries</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No watchlist entries match your current filters. Try adjusting or clearing your filters.'
                  : 'No counterparties are currently on the watchlist. Click "Add to Watchlist" to add a counterparty.'}
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
                    <th>Counterparty</th>
                    <th>Reason</th>
                    <th>Added Date</th>
                    <th>Added By</th>
                    <th>Status</th>
                    <th>Action Plan</th>
                    <th className='w-32'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((entry) => {
                    if (!entry) return null;

                    const isExpanded = expandedRows.has(entry.id);
                    const statusColor =
                      WATCHLIST_STATUS_COLORS[entry.status] ||
                      'bg-gray-100 text-gray-700 border-gray-200';
                    const statusLabel =
                      WATCHLIST_STATUS_LABELS[entry.status] || entry.status || 'Unknown';

                    const plans = actionPlanMap.get(entry.id) || [];
                    const latestPlan = plans.length > 0 ? plans[plans.length - 1] : null;
                    const planStatusColor = latestPlan
                      ? ACTION_PLAN_STATUS_COLORS[latestPlan.status] || 'bg-gray-100 text-gray-500 border-gray-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200';
                    const planStatusLabel = latestPlan
                      ? ACTION_PLAN_STATUS_LABELS[latestPlan.status] || latestPlan.status || 'Unknown'
                      : 'No Plan';

                    return (
                      <tr key={entry.id} className={isExpanded ? 'bg-gray-50/70' : ''}>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleToggleRow(entry.id)}
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
                          <div className='flex flex-col'>
                            <button
                              type='button'
                              onClick={() => handleViewCounterparty(entry.counterpartyId)}
                              className='text-sm font-medium text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded text-left'
                            >
                              {entry.counterpartyName || entry.counterpartyId}
                            </button>
                            <span className='text-xs text-gray-400 font-mono'>
                              {entry.counterpartyId}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className='max-w-xs'>
                            <p className='text-sm text-gray-700 truncate' title={entry.reason}>
                              {entry.reason || '—'}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span className='text-sm text-gray-500'>
                            {entry.addedDate
                              ? formatDate(entry.addedDate, 'MMM d, yyyy')
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>
                            {entry.addedBy || 'Unknown'}
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
                          {latestPlan ? (
                            <button
                              type='button'
                              onClick={() => handleViewActionPlan(latestPlan.id)}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${planStatusColor} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-opacity duration-150`}
                            >
                              {planStatusLabel}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${planStatusColor}`}
                            >
                              {planStatusLabel}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className='flex items-center gap-1'>
                            {latestPlan && (
                              <button
                                type='button'
                                onClick={() => handleViewActionPlan(latestPlan.id)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`View action plan for ${entry.counterpartyName || entry.counterpartyId}`}
                                title='View action plan'
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
                                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                                  <polyline points='14 2 14 8 20 8' />
                                  <line x1='16' y1='13' x2='8' y2='13' />
                                  <line x1='16' y1='17' x2='8' y2='17' />
                                  <polyline points='10 9 9 9 8 9' />
                                </svg>
                              </button>
                            )}

                            <button
                              type='button'
                              onClick={() => handleOpenNoteModal(entry)}
                              className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                              aria-label={`Add monitoring note for ${entry.counterpartyName || entry.counterpartyId}`}
                              title='Add monitoring note'
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
                                <path d='M12 20h9' />
                                <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
                              </svg>
                            </button>

                            {entry.status !== 'cleared' && (
                              <button
                                type='button'
                                onClick={() => handleOpenRemoveModal(entry)}
                                className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                aria-label={`Remove ${entry.counterpartyName || entry.counterpartyId} from watchlist`}
                                title='Remove from watchlist'
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
                                  <polyline points='3 6 5 6 21 6' />
                                  <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {paginatedData.map((entry) => {
                if (!entry) return null;

                const isExpanded = expandedRows.has(entry.id);

                if (!isExpanded) return null;

                const plans = actionPlanMap.get(entry.id) || [];
                const monitoringNotes = Array.isArray(entry.monitoringNotes)
                  ? entry.monitoringNotes
                  : [];

                return (
                  <div
                    key={`details-${entry.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Entry ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>{entry.id}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Counterparty
                        </span>
                        <button
                          type='button'
                          onClick={() => handleViewCounterparty(entry.counterpartyId)}
                          className='text-sm font-medium text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                        >
                          {entry.counterpartyName || entry.counterpartyId}
                        </button>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            WATCHLIST_STATUS_COLORS[entry.status] ||
                            'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {WATCHLIST_STATUS_LABELS[entry.status] || entry.status || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Recommendation
                        </span>
                        <span className='text-sm text-gray-900 capitalize'>
                          {entry.recommendation
                            ? entry.recommendation.replace(/_/g, ' ')
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Added By
                        </span>
                        <span className='text-sm text-gray-900'>
                          {entry.addedBy || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Added Date
                        </span>
                        <span className='text-sm text-gray-500'>
                          {entry.addedDate
                            ? formatDate(entry.addedDate, 'MMM d, yyyy HH:mm')
                            : '—'}
                        </span>
                      </div>
                      {entry.reviewDate && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Review Date
                          </span>
                          <span className='text-sm text-gray-500'>
                            {formatDate(entry.reviewDate, 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      {entry.watchlistScore !== null && entry.watchlistScore !== undefined && (
                        <div>
                          <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                            Watchlist Score
                          </span>
                          <span className='text-sm font-mono text-gray-900'>
                            {entry.watchlistScore}
                          </span>
                        </div>
                      )}
                    </div>

                    {entry.reason && (
                      <div className='mt-3 p-4 rounded-xl bg-white border border-gray-200'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Reason
                        </span>
                        <p className='text-sm text-gray-700'>{entry.reason}</p>
                      </div>
                    )}

                    {plans.length > 0 && (
                      <div className='mt-3'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Action Plans ({plans.length})
                        </span>
                        <div className='space-y-2'>
                          {plans.map((plan) => {
                            if (!plan) return null;

                            const planPriorityColor =
                              ACTION_PLAN_PRIORITY_COLORS[plan.priority] ||
                              'bg-gray-100 text-gray-600 border-gray-200';
                            const planPriorityLabel =
                              ACTION_PLAN_PRIORITY_LABELS[plan.priority] ||
                              plan.priority ||
                              'Unknown';
                            const planStatusColor =
                              ACTION_PLAN_STATUS_COLORS[plan.status] ||
                              'bg-gray-100 text-gray-500 border-gray-200';
                            const planStatusLabel =
                              ACTION_PLAN_STATUS_LABELS[plan.status] ||
                              plan.status ||
                              'Unknown';

                            return (
                              <div
                                key={plan.id}
                                className='flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200'
                              >
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-2 mb-1'>
                                    <button
                                      type='button'
                                      onClick={() => handleViewActionPlan(plan.id)}
                                      className='text-sm font-medium text-enterprise-600 hover:text-enterprise-700 hover:underline focus:outline-none focus:ring-2 focus:ring-enterprise-500 rounded'
                                    >
                                      {plan.title || 'Unnamed Plan'}
                                    </button>
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${planPriorityColor}`}
                                    >
                                      {planPriorityLabel}
                                    </span>
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${planStatusColor}`}
                                    >
                                      {planStatusLabel}
                                    </span>
                                  </div>
                                  {plan.description && (
                                    <p className='text-xs text-gray-500 truncate'>
                                      {plan.description}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type='button'
                                  onClick={() => handleViewActionPlan(plan.id)}
                                  className='flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                  aria-label={`View action plan ${plan.title || plan.id}`}
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
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {monitoringNotes.length > 0 && (
                      <div className='mt-3'>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Monitoring Notes ({monitoringNotes.length})
                        </span>
                        <div className='space-y-2 max-h-48 overflow-y-auto'>
                          {monitoringNotes.slice(-5).reverse().map((note, idx) => {
                            if (!note) return null;

                            return (
                              <div
                                key={note.id || idx}
                                className='flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-200'
                              >
                                <div className='flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-2xs font-bold'>
                                  {monitoringNotes.length - idx}
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-2 mb-0.5'>
                                    <span className='text-xs font-semibold text-gray-700'>
                                      {note.author || 'Unknown'}
                                    </span>
                                    <span className='text-xs text-gray-400'>
                                      {note.createdAt
                                        ? formatDate(note.createdAt, 'MMM d, yyyy HH:mm')
                                        : ''}
                                    </span>
                                  </div>
                                  <p className='text-xs text-gray-600'>{note.content}</p>
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
                        onClick={() => handleOpenNoteModal(entry)}
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
                          <path d='M12 20h9' />
                          <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
                        </svg>
                        Add Monitoring Note
                      </button>

                      {entry.status !== 'cleared' && (
                        <button
                          type='button'
                          onClick={() => handleOpenRemoveModal(entry)}
                          className='btn-enterprise-secondary text-xs text-red-600 hover:text-red-700 hover:bg-red-50'
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
                            <polyline points='3 6 5 6 21 6' />
                            <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
                          </svg>
                          Remove from Watchlist
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filteredEntries.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={filteredEntries.length}
          />
        )}

        <AddToWatchlistModal
          isOpen={isAddModalOpen}
          onClose={handleCloseAddModal}
          onAdd={handleAddToWatchlist}
        />

        <MonitoringNoteModal
          watchlistEntry={selectedEntry}
          isOpen={isNoteModalOpen}
          onClose={handleCloseNoteModal}
          onAddNote={handleAddNote}
        />

        <RemoveWatchlistModal
          watchlistEntry={selectedEntry}
          isOpen={isRemoveModalOpen}
          onClose={handleCloseRemoveModal}
          onRemove={handleRemoveFromWatchlist}
        />
      </div>
    </RequireRole>
  );
};

WatchlistPage.propTypes = {};

export default WatchlistPage;