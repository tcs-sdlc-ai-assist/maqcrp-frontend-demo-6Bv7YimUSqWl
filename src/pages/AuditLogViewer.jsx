import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { useExport } from '../hooks/useExport';
import { formatDate } from '../utils/dateUtils';
import { debug, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import ExportButton from '../components/shared/ExportButton';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'AuditLogViewer';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const EVENT_TYPES = [
  'LOAN_SUBMIT',
  'LOAN_VALIDATE',
  'LOAN_STATUS_CHANGE',
  'RULE_CREATE',
  'RULE_UPDATE',
  'RULE_ARCHIVE',
  'RULE_EXECUTE',
  'OVERRIDE_REQUEST',
  'OVERRIDE_APPROVE',
  'QC_CASE_CREATE',
  'QC_CASE_ASSIGN',
  'QC_CHECKLIST_UPDATE',
  'QC_REVIEW_COMPLETE',
  'QC_SAMPLING_RUN',
  'DEFECT_CREATE',
  'DEFECT_UPDATE',
  'DEFECT_CLOSE',
  'TAXONOMY_UPDATE',
  'REMEDY_CREATE',
  'REMEDY_ASSIGN',
  'REMEDY_TRANSITION',
  'REMEDY_ESCALATE',
  'REMEDY_CLOSE',
  'REPURCHASE_INITIATE',
  'REPURCHASE_RESPONSE',
  'REPURCHASE_NEGOTIATE',
  'REPURCHASE_CLOSE',
  'PERSONA_SWITCH',
  'PII_REVEAL',
  'EXPORT_DATA',
  'CONFIG_UPDATE',
  'SELLER_STATUS_CHANGE',
  'CHECKLIST_TEMPLATE_CREATE',
  'CHECKLIST_TEMPLATE_UPDATE',
  'SAMPLING_CONFIG_SAVE',
];

const ENTITY_TYPES = [
  'loan',
  'rule',
  'qc_case',
  'defect',
  'remedy_case',
  'repurchase_case',
  'seller',
  'checklist_template',
  'sampling_config',
  'taxonomy',
  'override',
  'system',
  'export',
  'entity',
];

const PERSONAS = [
  'Risk Analyst',
  'Compliance Officer',
  'Fraud Investigator',
  'Administrator',
  'Executive',
];

const EVENT_TYPE_LABELS = EVENT_TYPES.reduce((map, type) => {
  map[type] = type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return map;
}, {});

const ENTITY_TYPE_LABELS = ENTITY_TYPES.reduce((map, type) => {
  map[type] = type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return map;
}, {});

const EVENT_TYPE_COLORS = {
  LOAN_SUBMIT: 'bg-blue-100 text-blue-700 border-blue-200',
  LOAN_VALIDATE: 'bg-blue-100 text-blue-700 border-blue-200',
  LOAN_STATUS_CHANGE: 'bg-blue-100 text-blue-700 border-blue-200',
  RULE_CREATE: 'bg-purple-100 text-purple-700 border-purple-200',
  RULE_UPDATE: 'bg-purple-100 text-purple-700 border-purple-200',
  RULE_ARCHIVE: 'bg-purple-100 text-purple-700 border-purple-200',
  RULE_EXECUTE: 'bg-purple-100 text-purple-700 border-purple-200',
  OVERRIDE_REQUEST: 'bg-amber-100 text-amber-700 border-amber-200',
  OVERRIDE_APPROVE: 'bg-amber-100 text-amber-700 border-amber-200',
  QC_CASE_CREATE: 'bg-teal-100 text-teal-700 border-teal-200',
  QC_CASE_ASSIGN: 'bg-teal-100 text-teal-700 border-teal-200',
  QC_CHECKLIST_UPDATE: 'bg-teal-100 text-teal-700 border-teal-200',
  QC_REVIEW_COMPLETE: 'bg-teal-100 text-teal-700 border-teal-200',
  QC_SAMPLING_RUN: 'bg-teal-100 text-teal-700 border-teal-200',
  DEFECT_CREATE: 'bg-orange-100 text-orange-700 border-orange-200',
  DEFECT_UPDATE: 'bg-orange-100 text-orange-700 border-orange-200',
  DEFECT_CLOSE: 'bg-orange-100 text-orange-700 border-orange-200',
  TAXONOMY_UPDATE: 'bg-orange-100 text-orange-700 border-orange-200',
  REMEDY_CREATE: 'bg-rose-100 text-rose-700 border-rose-200',
  REMEDY_ASSIGN: 'bg-rose-100 text-rose-700 border-rose-200',
  REMEDY_TRANSITION: 'bg-rose-100 text-rose-700 border-rose-200',
  REMEDY_ESCALATE: 'bg-rose-100 text-rose-700 border-rose-200',
  REMEDY_CLOSE: 'bg-rose-100 text-rose-700 border-rose-200',
  REPURCHASE_INITIATE: 'bg-red-100 text-red-700 border-red-200',
  REPURCHASE_RESPONSE: 'bg-red-100 text-red-700 border-red-200',
  REPURCHASE_NEGOTIATE: 'bg-red-100 text-red-700 border-red-200',
  REPURCHASE_CLOSE: 'bg-red-100 text-red-700 border-red-200',
  PERSONA_SWITCH: 'bg-gray-100 text-gray-700 border-gray-200',
  PII_REVEAL: 'bg-pink-100 text-pink-700 border-pink-200',
  EXPORT_DATA: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  CONFIG_UPDATE: 'bg-gray-100 text-gray-700 border-gray-200',
  SELLER_STATUS_CHANGE: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  CHECKLIST_TEMPLATE_CREATE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CHECKLIST_TEMPLATE_UPDATE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SAMPLING_CONFIG_SAVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const DEFAULT_EVENT_TYPE_COLOR = 'bg-gray-100 text-gray-700 border-gray-200';

const formatTimestamp = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return formatDate(date, 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return '';
  }
};

const formatTimestampShort = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date, 'MMM d, yyyy');
  } catch {
    return '';
  }
};

const AuditLogViewer = () => {
  const navigate = useNavigate();
  const { getAuditTrail, exportAuditLog } = useAudit();
  const { currentPersona } = useAuth();
  const { exportToJSON, isExporting } = useExport();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    persona: '',
    eventType: '',
    entityType: '',
    search: '',
  });

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isExportingAudit, setIsExportingAudit] = useState(false);

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const auditFilters = {};

    if (filters.startDate && filters.startDate.trim() !== '') {
      auditFilters.startDate = filters.startDate;
    }

    if (filters.endDate && filters.endDate.trim() !== '') {
      auditFilters.endDate = filters.endDate;
    }

    if (filters.persona && filters.persona.trim() !== '') {
      auditFilters.persona = filters.persona;
    }

    if (filters.eventType && filters.eventType.trim() !== '') {
      auditFilters.eventType = filters.eventType;
    }

    if (filters.entityType && filters.entityType.trim() !== '') {
      auditFilters.entityType = filters.entityType;
    }

    if (filters.search && filters.search.trim() !== '') {
      auditFilters.search = filters.search;
    }

    auditFilters.sortBy = 'timestamp';
    auditFilters.sortDirection = 'desc';

    return getAuditTrail(auditFilters);
  }, [filters, getAuditTrail]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredEntries, { initialPageSize: 25 });

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPage(1);
  }, [setPage]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      startDate: '',
      endDate: '',
      persona: '',
      eventType: '',
      entityType: '',
      search: '',
    });
    setPage(1);

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

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

  const handleExportJSON = useCallback(async () => {
    if (isExportingAudit) {
      return;
    }

    setIsExportingAudit(true);

    try {
      const exportFilters = {};

      if (filters.startDate && filters.startDate.trim() !== '') {
        exportFilters.startDate = filters.startDate;
      }

      if (filters.endDate && filters.endDate.trim() !== '') {
        exportFilters.endDate = filters.endDate;
      }

      if (filters.persona && filters.persona.trim() !== '') {
        exportFilters.persona = filters.persona;
      }

      if (filters.eventType && filters.eventType.trim() !== '') {
        exportFilters.eventType = filters.eventType;
      }

      if (filters.entityType && filters.entityType.trim() !== '') {
        exportFilters.entityType = filters.entityType;
      }

      if (filters.search && filters.search.trim() !== '') {
        exportFilters.search = filters.search;
      }

      const dataToExport = getAuditTrail(exportFilters);

      if (dataToExport.length === 0) {
        warn(COMPONENT_NAME, 'No audit entries to export');
        return;
      }

      const exportData = dataToExport.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        persona: entry.persona,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: entry.details,
        ipAddress: entry.ipAddress,
        sessionId: entry.sessionId,
      }));

      await exportToJSON(exportData, 'audit-log-export');
    } catch (err) {
      warn(COMPONENT_NAME, 'Failed to export audit log', err);
    } finally {
      if (isMountedRef.current) {
        setIsExportingAudit(false);
      }
    }
  }, [isExportingAudit, filters, getAuditTrail, exportToJSON]);

  const hasActiveFilters =
    filters.startDate ||
    filters.endDate ||
    filters.persona ||
    filters.eventType ||
    filters.entityType ||
    filters.search;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Audit Log', path: '/audit-log' },
  ];

  const formatDetailsJSON = (details) => {
    if (!details || typeof details !== 'object') {
      return 'No details available';
    }

    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Audit Log</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Immutable record of all system activity across personas and modules.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <ExportButton
              data={filteredEntries}
              filename='audit-log'
              variant='secondary'
              label='Export JSON'
              onExportStart={() => {}}
              onExportComplete={() => {
                debug(COMPONENT_NAME, 'Audit log export completed');
              }}
              onExportError={(format, err) => {
                warn(COMPONENT_NAME, 'Audit log export failed', { format, error: err });
              }}
            />
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
                  placeholder='Search audit entries...'
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className='input-enterprise pl-10 w-full lg:w-80'
                  aria-label='Search audit entries'
                />
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2'>
                <label htmlFor='audit-filter-start-date' className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  From
                </label>
                <input
                  id='audit-filter-start-date'
                  type='date'
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by start date'
                />
              </div>

              <div className='flex items-center gap-2'>
                <label htmlFor='audit-filter-end-date' className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  To
                </label>
                <input
                  id='audit-filter-end-date'
                  type='date'
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by end date'
                />
              </div>

              <div className='flex items-center gap-2'>
                <label htmlFor='audit-filter-persona' className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Persona
                </label>
                <select
                  id='audit-filter-persona'
                  value={filters.persona}
                  onChange={(e) => handleFilterChange('persona', e.target.value)}
                  className='input-enterprise w-40 py-1.5 text-sm'
                  aria-label='Filter by persona'
                >
                  <option value=''>All Personas</option>
                  {PERSONAS.map((persona) => (
                    <option key={persona} value={persona}>
                      {persona}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label htmlFor='audit-filter-event-type' className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Event
                </label>
                <select
                  id='audit-filter-event-type'
                  value={filters.eventType}
                  onChange={(e) => handleFilterChange('eventType', e.target.value)}
                  className='input-enterprise w-44 py-1.5 text-sm'
                  aria-label='Filter by event type'
                >
                  <option value=''>All Events</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <label htmlFor='audit-filter-entity-type' className='text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap'>
                  Entity
                </label>
                <select
                  id='audit-filter-entity-type'
                  value={filters.entityType}
                  onChange={(e) => handleFilterChange('entityType', e.target.value)}
                  className='input-enterprise w-36 py-1.5 text-sm'
                  aria-label='Filter by entity type'
                >
                  <option value=''>All Entities</option>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ENTITY_TYPE_LABELS[type]}
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
                ? 'No audit entries found'
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
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                  <polyline points='10 9 9 9 8 9' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Audit Entries Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                {hasActiveFilters
                  ? 'No audit entries match your current filters. Try adjusting or clearing your filters.'
                  : 'No audit entries have been recorded yet. Activity will appear here as users interact with the system.'}
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
                    <th>Timestamp</th>
                    <th>Persona</th>
                    <th>Event Type</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th className='w-12'></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((entry) => {
                    if (!entry) return null;

                    const isExpanded = expandedRows.has(entry.id);
                    const eventColor =
                      EVENT_TYPE_COLORS[entry.action] || DEFAULT_EVENT_TYPE_COLOR;
                    const eventLabel =
                      EVENT_TYPE_LABELS[entry.action] || entry.action || 'Unknown';
                    const entityLabel =
                      ENTITY_TYPE_LABELS[entry.entityType] || entry.entityType || 'Unknown';

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
                            <span className='text-sm font-mono text-gray-700'>
                              {formatTimestamp(entry.timestamp)}
                            </span>
                            <span className='text-xs text-gray-400'>
                              {formatTimestampShort(entry.timestamp)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>{entry.persona || 'Unknown'}</span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${eventColor}`}
                          >
                            {eventLabel}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-600'>{entityLabel}</span>
                        </td>
                        <td>
                          <span className='text-sm font-mono text-gray-500'>
                            {entry.entityId || '—'}
                          </span>
                        </td>
                        <td className='text-center'>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-enterprise-100 text-enterprise-700 text-2xs font-bold'>
                              {Object.keys(entry.details).length}
                            </span>
                          )}
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

                return (
                  <div
                    key={`details-${entry.id}`}
                    className='px-6 py-4 bg-gray-50/70 border-b border-gray-100 animate-fade-in'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Timestamp
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Persona
                        </span>
                        <span className='text-sm text-gray-900'>{entry.persona || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Event Type
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            EVENT_TYPE_COLORS[entry.action] || DEFAULT_EVENT_TYPE_COLOR
                          }`}
                        >
                          {EVENT_TYPE_LABELS[entry.action] || entry.action || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Entity Type
                        </span>
                        <span className='text-sm text-gray-900'>
                          {ENTITY_TYPE_LABELS[entry.entityType] || entry.entityType || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Entity ID
                        </span>
                        <span className='text-sm font-mono text-gray-900'>
                          {entry.entityId || '—'}
                        </span>
                      </div>
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1'>
                          Session ID
                        </span>
                        <span className='text-sm font-mono text-gray-500'>
                          {entry.sessionId || '—'}
                        </span>
                      </div>
                    </div>

                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Details
                        </span>
                        <pre className='p-3 bg-gray-900 text-green-400 text-xs font-mono rounded-lg overflow-x-auto max-h-64 overflow-y-auto'>
                          {formatDetailsJSON(entry.details)}
                        </pre>
                      </div>
                    )}

                    {(!entry.details || Object.keys(entry.details).length === 0) && (
                      <div>
                        <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2'>
                          Details
                        </span>
                        <p className='text-sm text-gray-400 italic'>No additional details available.</p>
                      </div>
                    )}
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
      </div>
    </RequireRole>
  );
};

AuditLogViewer.propTypes = {};

export default AuditLogViewer;