import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'ChecklistRenderer';

const CHECKLIST_RESPONSES = [
  { value: 'pass', label: 'Pass', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'fail', label: 'Fail', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'na', label: 'N/A', color: 'bg-gray-100 text-gray-500 border-gray-200' },
];

const ChecklistRenderer = ({
  checklist,
  responses,
  onResponseChange,
  onAddDefect,
  onNotesChange,
  readOnly = false,
  className = '',
}) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [activeDefectItemId, setActiveDefectItemId] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeChecklist = useMemo(() => {
    if (!Array.isArray(checklist)) {
      return [];
    }
    return checklist;
  }, [checklist]);

  const safeResponses = useMemo(() => {
    if (!responses || typeof responses !== 'object') {
      return {};
    }
    return responses;
  }, [responses]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map();

    for (const item of safeChecklist) {
      if (!item || !item.id) {
        continue;
      }

      const category = item.category || 'Uncategorized';

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push(item);
    }

    const result = [];

    for (const [category, items] of groups.entries()) {
      const totalItems = items.length;
      const reviewedItems = items.filter((item) => {
        const response = safeResponses[item.id];
        return response && response.response !== null;
      }).length;

      result.push({
        category,
        items,
        totalItems,
        reviewedItems,
        progress: totalItems > 0 ? Math.round((reviewedItems / totalItems) * 100) : 0,
      });
    }

    return result;
  }, [safeChecklist, safeResponses]);

  const handleToggleCategory = useCallback((category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e, category) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleCategory(category);
      }
    },
    [handleToggleCategory],
  );

  const handleResponseChange = useCallback(
    (itemId, response) => {
      if (readOnly) {
        return;
      }

      if (typeof onResponseChange === 'function') {
        onResponseChange(itemId, response);
      }

      if (response === 'fail' && typeof onAddDefect === 'function') {
        setActiveDefectItemId(itemId);
      }

      if (response !== 'fail' && activeDefectItemId === itemId) {
        setActiveDefectItemId(null);
      }
    },
    [readOnly, onResponseChange, onAddDefect, activeDefectItemId],
  );

  const handleNotesChange = useCallback(
    (itemId, notes) => {
      if (readOnly) {
        return;
      }

      if (typeof onNotesChange === 'function') {
        onNotesChange(itemId, notes);
      }
    },
    [readOnly, onNotesChange],
  );

  const handleAddDefect = useCallback(
    (item) => {
      if (readOnly) {
        return;
      }

      if (typeof onAddDefect === 'function') {
        onAddDefect(item);
      }
    },
    [readOnly, onAddDefect],
  );

  const handleCancelDefect = useCallback(() => {
    setActiveDefectItemId(null);
  }, []);

  const overallProgress = useMemo(() => {
    if (safeChecklist.length === 0) {
      return 0;
    }

    const reviewedCount = safeChecklist.filter((item) => {
      const response = safeResponses[item.id];
      return response && response.response !== null;
    }).length;

    return Math.round((reviewedCount / safeChecklist.length) * 100);
  }, [safeChecklist, safeResponses]);

  const responseCounts = useMemo(() => {
    const counts = { pass: 0, fail: 0, na: 0, unreviewed: 0 };

    for (const item of safeChecklist) {
      const response = safeResponses[item.id];

      if (!response || response.response === null) {
        counts.unreviewed++;
      } else if (response.response === 'pass') {
        counts.pass++;
      } else if (response.response === 'fail') {
        counts.fail++;
      } else if (response.response === 'na') {
        counts.na++;
      }
    }

    return counts;
  }, [safeChecklist, safeResponses]);

  if (safeChecklist.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
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
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
              <line x1='16' y1='13' x2='8' y2='13' />
              <line x1='16' y1='17' x2='8' y2='17' />
              <polyline points='10 9 9 9 8 9' />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Checklist Items</h3>
          <p className='text-sm text-gray-500 max-w-md mx-auto'>
            This QC case does not have any checklist items configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className='card-enterprise'>
        <div className='flex items-center justify-between mb-5'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900'>QC Checklist</h2>
            <p className='text-sm text-gray-500 mt-0.5'>
              Review each item and mark as Pass, Fail, or N/A.
              {!readOnly && ' Failed items require a defect to be logged.'}
            </p>
          </div>

          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-3'>
              <div className='flex items-center gap-1.5'>
                <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-2xs font-bold'>
                  {responseCounts.pass}
                </span>
                <span className='text-xs text-gray-500'>Pass</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-2xs font-bold'>
                  {responseCounts.fail}
                </span>
                <span className='text-xs text-gray-500'>Fail</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-2xs font-bold'>
                  {responseCounts.na}
                </span>
                <span className='text-xs text-gray-500'>N/A</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-2xs font-bold'>
                  {responseCounts.unreviewed}
                </span>
                <span className='text-xs text-gray-500'>Pending</span>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-500'>
                {safeChecklist.length - responseCounts.unreviewed}/{safeChecklist.length} reviewed
              </span>
              <div className='w-24 bg-gray-200 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className='space-y-4'>
          {groupedByCategory.map((group) => {
            const isExpanded = expandedCategories.has(group.category);

            return (
              <div
                key={group.category}
                className='rounded-xl border border-gray-200 overflow-hidden'
              >
                <button
                  type='button'
                  onClick={() => handleToggleCategory(group.category)}
                  onKeyDown={(e) => handleKeyDown(e, group.category)}
                  className='w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-inset transition-colors duration-150'
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.category} category`}
                >
                  <div className='flex items-center gap-3'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    >
                      <polyline points='9 18 15 12 9 6' />
                    </svg>

                    <div className='text-left'>
                      <span className='text-sm font-semibold text-gray-700'>
                        {group.category}
                      </span>
                      <span className='ml-2 text-xs text-gray-400'>
                        {group.reviewedItems}/{group.totalItems} reviewed
                      </span>
                    </div>
                  </div>

                  <div className='flex items-center gap-3'>
                    <div className='w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden'>
                      <div
                        className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                        style={{ width: `${group.progress}%` }}
                      />
                    </div>
                    <span className='text-xs text-gray-400'>{group.progress}%</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className='divide-y divide-gray-100 animate-fade-in'>
                    {group.items.map((item, index) => {
                      if (!item) return null;

                      const itemResponse = safeResponses[item.id] || {
                        response: null,
                        notes: '',
                      };

                      const isDefectActive = activeDefectItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`px-5 py-4 transition-colors duration-200 ${
                            itemResponse.response === 'fail'
                              ? 'bg-red-50/30'
                              : itemResponse.response === 'pass'
                                ? 'bg-green-50/20'
                                : itemResponse.response === 'na'
                                  ? 'bg-gray-50/50'
                                  : 'bg-white'
                          }`}
                        >
                          <div className='flex items-start gap-4'>
                            <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-bold'>
                              {index + 1}
                            </div>

                            <div className='flex-1 min-w-0'>
                              <div className='flex items-start justify-between gap-4'>
                                <div className='flex-1 min-w-0'>
                                  <p className='text-sm font-medium text-gray-900'>
                                    {item.question || 'No question defined'}
                                  </p>
                                </div>

                                {!readOnly && (
                                  <div className='flex items-center gap-1 flex-shrink-0'>
                                    {CHECKLIST_RESPONSES.map((resp) => {
                                      const isSelected = itemResponse.response === resp.value;
                                      return (
                                        <button
                                          key={resp.value}
                                          type='button'
                                          onClick={() =>
                                            handleResponseChange(item.id, resp.value)
                                          }
                                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 ${
                                            isSelected
                                              ? resp.color
                                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                          }`}
                                          aria-label={`Mark as ${resp.label}`}
                                          aria-pressed={isSelected}
                                        >
                                          {resp.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {readOnly && itemResponse.response && (
                                  <span
                                    className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                      CHECKLIST_RESPONSES.find(
                                        (r) => r.value === itemResponse.response,
                                      )?.color || 'bg-gray-100 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {CHECKLIST_RESPONSES.find(
                                      (r) => r.value === itemResponse.response,
                                    )?.label || itemResponse.response}
                                  </span>
                                )}
                              </div>

                              {itemResponse.response && (
                                <div className='mt-3 space-y-3'>
                                  {!readOnly && (
                                    <div>
                                      <label
                                        htmlFor={`checklist-notes-${item.id}`}
                                        className='block text-xs font-medium text-gray-600 mb-1'
                                      >
                                        Notes
                                      </label>
                                      <textarea
                                        id={`checklist-notes-${item.id}`}
                                        value={itemResponse.notes || ''}
                                        onChange={(e) =>
                                          handleNotesChange(item.id, e.target.value)
                                        }
                                        rows={2}
                                        placeholder='Add review notes...'
                                        className='input-enterprise py-1.5 text-sm resize-none'
                                        aria-label={`Notes for checklist item ${index + 1}`}
                                      />
                                    </div>
                                  )}

                                  {readOnly && itemResponse.notes && (
                                    <div className='p-3 rounded-lg bg-gray-50 border border-gray-200'>
                                      <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                                        Notes
                                      </span>
                                      <p className='text-sm text-gray-700'>
                                        {itemResponse.notes}
                                      </p>
                                    </div>
                                  )}

                                  {!readOnly && itemResponse.response === 'fail' && (
                                    <div className='flex items-center gap-3'>
                                      {!isDefectActive && (
                                        <button
                                          type='button'
                                          onClick={() => handleAddDefect(item)}
                                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
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
                                            <line x1='12' y1='5' x2='12' y2='19' />
                                            <line x1='5' y1='12' x2='19' y2='12' />
                                          </svg>
                                          Log Defect
                                        </button>
                                      )}

                                      {isDefectActive && (
                                        <button
                                          type='button'
                                          onClick={handleCancelDefect}
                                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
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
                                          Cancel
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

ChecklistRenderer.propTypes = {
  checklist: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      templateItemId: PropTypes.string,
      category: PropTypes.string,
      question: PropTypes.string,
      response: PropTypes.string,
      notes: PropTypes.string,
      evidenceAttached: PropTypes.bool,
    }),
  ),
  responses: PropTypes.objectOf(
    PropTypes.shape({
      response: PropTypes.string,
      notes: PropTypes.string,
      evidenceAttached: PropTypes.bool,
    }),
  ),
  onResponseChange: PropTypes.func,
  onAddDefect: PropTypes.func,
  onNotesChange: PropTypes.func,
  readOnly: PropTypes.bool,
  className: PropTypes.string,
};

ChecklistRenderer.defaultProps = {
  checklist: [],
  responses: {},
  onResponseChange: null,
  onAddDefect: null,
  onNotesChange: null,
  readOnly: false,
  className: '',
};

export default ChecklistRenderer;