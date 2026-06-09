import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';
import { exportToCSV, exportToJSON, generateExportFilename } from '../utils/exportUtils';

const AuditContext = createContext(null);

const AUDIT_CONTEXT_NAME = 'AuditContext';

const STORAGE_KEY = 'maqcrop_audit_log';

const MAX_AUDIT_ENTRIES = 10000;

const ACTIONS = {
  LOG_EVENT: 'LOG_EVENT',
  HYDRATE: 'HYDRATE',
  CLEAR: 'CLEAR',
};

const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `AUD-${timestamp}-${randomPart}`;
};

const generateSessionId = () => {
  return `session-mock-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
};

const auditReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const entries = Array.isArray(action.payload) ? action.payload : [];
      return entries;
    }

    case ACTIONS.LOG_EVENT: {
      const newEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        persona: action.payload.persona || 'Unknown',
        action: action.payload.eventType,
        entityType: action.payload.entityType,
        entityId: action.payload.entityId,
        details: action.payload.details || {},
        ipAddress: '127.0.0.1 (mock)',
        sessionId: generateSessionId(),
      };

      const updated = [newEntry, ...state];

      if (updated.length > MAX_AUDIT_ENTRIES) {
        return updated.slice(0, MAX_AUDIT_ENTRIES);
      }

      return updated;
    }

    case ACTIONS.CLEAR: {
      return [];
    }

    default: {
      warn(AUDIT_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

export const AuditProvider = ({ children }) => {
  const [auditEntries, dispatch] = useReducer(auditReducer, []);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          dispatch({ type: ACTIONS.HYDRATE, payload: parsed });
          info(AUDIT_CONTEXT_NAME, 'Audit log hydrated from localStorage', {
            entryCount: parsed.length,
          });
        } else {
          warn(AUDIT_CONTEXT_NAME, 'Stored audit log is not an array, initializing empty');
          dispatch({ type: ACTIONS.HYDRATE, payload: [] });
        }
      } else {
        debug(AUDIT_CONTEXT_NAME, 'No stored audit log found, initializing empty');
        dispatch({ type: ACTIONS.HYDRATE, payload: [] });
      }
    } catch (err) {
      error(AUDIT_CONTEXT_NAME, 'Failed to hydrate audit log from localStorage', err);
      dispatch({ type: ACTIONS.HYDRATE, payload: [] });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      const jsonString = JSON.stringify(auditEntries);
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (err) {
      error(AUDIT_CONTEXT_NAME, 'Failed to persist audit log to localStorage', err);
    }
  }, [auditEntries]);

  const logEvent = useCallback(
    (eventType, entityType, entityId, details = {}, persona = 'Unknown') => {
      if (!eventType || typeof eventType !== 'string') {
        warn(AUDIT_CONTEXT_NAME, 'logEvent called with invalid eventType', { eventType });
        return null;
      }

      if (!entityType || typeof entityType !== 'string') {
        warn(AUDIT_CONTEXT_NAME, 'logEvent called with invalid entityType', { entityType });
        return null;
      }

      if (!entityId || typeof entityId !== 'string') {
        warn(AUDIT_CONTEXT_NAME, 'logEvent called with invalid entityId', { entityId });
        return null;
      }

      const safeDetails = details && typeof details === 'object' ? details : {};

      dispatch({
        type: ACTIONS.LOG_EVENT,
        payload: {
          eventType,
          entityType,
          entityId,
          details: safeDetails,
          persona,
        },
      });

      debug(AUDIT_CONTEXT_NAME, 'Audit event logged', {
        eventType,
        entityType,
        entityId,
        persona,
      });

      return true;
    },
    [],
  );

  const getAuditTrail = useCallback(
    (filters = {}) => {
      if (!Array.isArray(auditEntries)) {
        return [];
      }

      let filtered = [...auditEntries];

      if (filters.eventType) {
        filtered = filtered.filter((entry) => entry.action === filters.eventType);
      }

      if (filters.entityType) {
        filtered = filtered.filter((entry) => entry.entityType === filters.entityType);
      }

      if (filters.entityId) {
        filtered = filtered.filter((entry) => entry.entityId === filters.entityId);
      }

      if (filters.persona) {
        filtered = filtered.filter((entry) => entry.persona === filters.persona);
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (!isNaN(startDate.getTime())) {
          filtered = filtered.filter((entry) => new Date(entry.timestamp) >= startDate);
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (!isNaN(endDate.getTime())) {
          filtered = filtered.filter((entry) => new Date(entry.timestamp) <= endDate);
        }
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((entry) => {
          return (
            entry.action.toLowerCase().includes(searchLower) ||
            entry.entityType.toLowerCase().includes(searchLower) ||
            entry.entityId.toLowerCase().includes(searchLower) ||
            entry.persona.toLowerCase().includes(searchLower) ||
            JSON.stringify(entry.details).toLowerCase().includes(searchLower)
          );
        });
      }

      if (filters.sortBy) {
        const sortField = filters.sortBy;
        const sortDirection = filters.sortDirection === 'desc' ? -1 : 1;

        filtered.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];

          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          if (aVal < bVal) return -1 * sortDirection;
          if (aVal > bVal) return 1 * sortDirection;
          return 0;
        });
      } else {
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }

      if (filters.limit && typeof filters.limit === 'number' && filters.limit > 0) {
        filtered = filtered.slice(0, filters.limit);
      }

      return filtered;
    },
    [auditEntries],
  );

  const getEntityHistory = useCallback(
    (entityType, entityId) => {
      if (!entityType || !entityId) {
        return [];
      }

      return getAuditTrail({ entityType, entityId });
    },
    [getAuditTrail],
  );

  const exportAuditLog = useCallback(
    (format = 'csv', filters = {}) => {
      const data = getAuditTrail(filters);

      if (data.length === 0) {
        warn(AUDIT_CONTEXT_NAME, 'No audit entries to export');
        return false;
      }

      const filename = generateExportFilename('audit-log');

      if (format === 'json') {
        return exportToJSON(data, filename);
      }

      const csvData = data.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        persona: entry.persona,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: JSON.stringify(entry.details),
        ipAddress: entry.ipAddress,
        sessionId: entry.sessionId,
      }));

      return exportToCSV(csvData, filename);
    },
    [getAuditTrail],
  );

  const clearAuditLog = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR });
    info(AUDIT_CONTEXT_NAME, 'Audit log cleared');
  }, []);

  const value = {
    auditEntries,
    logEvent,
    getAuditTrail,
    getEntityHistory,
    exportAuditLog,
    clearAuditLog,
  };

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
};

AuditProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAudit = () => {
  const context = useContext(AuditContext);

  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }

  return context;
};

export default AuditContext;