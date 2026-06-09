import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';
import { on, off, EVENTS } from '../services/eventBus';
import {
  readCollection,
  writeCollection,
  appendToCollection,
  removeFromCollection,
  updateInCollection,
  findInCollection,
  queryCollection,
  buildIndex,
  getIndex,
  invalidateIndexes,
} from '../services/storageService';

const RemedyContext = createContext(null);

const REMEDY_CONTEXT_NAME = 'RemedyContext';

const STORAGE_KEY = 'maqcrop_remedy_cases';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  ADD_REMEDY: 'ADD_REMEDY',
  UPDATE_REMEDY: 'UPDATE_REMEDY',
  REMOVE_REMEDY: 'REMOVE_REMEDY',
  SET_REMEDIES: 'SET_REMEDIES',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  remedyCases: [],
  isLoading: true,
  error: null,
};

const remedyReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const remedyCases = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        remedyCases,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.ADD_REMEDY: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(REMEDY_CONTEXT_NAME, 'ADD_REMEDY called with invalid payload');
        return state;
      }
      return {
        ...state,
        remedyCases: [...state.remedyCases, action.payload],
      };
    }

    case ACTIONS.UPDATE_REMEDY: {
      if (!action.payload || !action.payload.id) {
        warn(REMEDY_CONTEXT_NAME, 'UPDATE_REMEDY called with invalid payload');
        return state;
      }
      return {
        ...state,
        remedyCases: state.remedyCases.map((remedyCase) => {
          if (remedyCase && remedyCase.id === action.payload.id) {
            return {
              ...remedyCase,
              ...action.payload.updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return remedyCase;
        }),
      };
    }

    case ACTIONS.REMOVE_REMEDY: {
      if (!action.payload) {
        warn(REMEDY_CONTEXT_NAME, 'REMOVE_REMEDY called with invalid payload');
        return state;
      }
      return {
        ...state,
        remedyCases: state.remedyCases.filter(
          (remedyCase) => remedyCase && remedyCase.id !== action.payload,
        ),
      };
    }

    case ACTIONS.SET_REMEDIES: {
      const remedyCases = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        remedyCases,
      };
    }

    case ACTIONS.SET_LOADING: {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case ACTIONS.SET_ERROR: {
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    }

    default: {
      warn(REMEDY_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = (prefix = 'REM') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

const VALID_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'pending_counterparty',
  'escalated',
  'resolved',
  'closed',
];

const VALID_REMEDY_TYPES = [
  'cure',
  'repurchase',
  'indemnification',
  'price_adjustment',
  'other',
];

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

const VALID_SOURCE_TYPES = ['eligibility_failure', 'qc_defect', 'manual'];

const STATUS_TRANSITIONS = {
  open: ['assigned', 'escalated'],
  assigned: ['in_progress', 'escalated'],
  in_progress: ['pending_counterparty', 'escalated'],
  pending_counterparty: ['resolved', 'escalated'],
  escalated: ['in_progress', 'resolved'],
  resolved: ['closed'],
  closed: [],
};

const isValidTransition = (currentStatus, newStatus) => {
  if (!currentStatus || !newStatus) {
    return false;
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];

  if (!allowedTransitions) {
    return false;
  }

  return allowedTransitions.includes(newStatus);
};

const calculateDueDate = (priority) => {
  const now = new Date();
  let daysToAdd;

  switch (priority) {
    case 'critical':
      daysToAdd = 1;
      break;
    case 'high':
      daysToAdd = 3;
      break;
    case 'medium':
      daysToAdd = 7;
      break;
    case 'low':
      daysToAdd = 14;
      break;
    default:
      daysToAdd = 7;
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + daysToAdd);
  return dueDate.toISOString().split('T')[0];
};

const checkSLABreach = (remedyCase) => {
  if (!remedyCase || !remedyCase.dueDate) {
    return false;
  }

  if (remedyCase.status === 'resolved' || remedyCase.status === 'closed') {
    return false;
  }

  const now = new Date();
  const dueDate = new Date(remedyCase.dueDate);

  if (isNaN(dueDate.getTime())) {
    return false;
  }

  return now > dueDate;
};

const validateRemedyData = (remedyData) => {
  const errors = [];

  if (!remedyData || typeof remedyData !== 'object') {
    errors.push({
      field: 'remedy',
      code: 'INVALID_INPUT',
      message: 'Remedy data must be an object.',
    });
    return { valid: false, errors };
  }

  if (!remedyData.sourceType || !VALID_SOURCE_TYPES.includes(remedyData.sourceType)) {
    errors.push({
      field: 'sourceType',
      code: 'REQUIRED',
      message: `Source type must be one of: ${VALID_SOURCE_TYPES.join(', ')}.`,
    });
  }

  if (!remedyData.sellerId || typeof remedyData.sellerId !== 'string') {
    errors.push({
      field: 'sellerId',
      code: 'REQUIRED',
      message: 'Seller ID is required.',
    });
  }

  if (!remedyData.remedyType || !VALID_REMEDY_TYPES.includes(remedyData.remedyType)) {
    errors.push({
      field: 'remedyType',
      code: 'REQUIRED',
      message: `Remedy type must be one of: ${VALID_REMEDY_TYPES.join(', ')}.`,
    });
  }

  if (remedyData.priority && !VALID_PRIORITIES.includes(remedyData.priority)) {
    errors.push({
      field: 'priority',
      code: 'INVALID_VALUE',
      message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`,
    });
  }

  if (!remedyData.description || typeof remedyData.description !== 'string' || remedyData.description.trim() === '') {
    errors.push({
      field: 'description',
      code: 'REQUIRED',
      message: 'Description is required.',
    });
  }

  return { valid: errors.length === 0, errors };
};

export const RemedyProvider = ({ children }) => {
  const [state, dispatch] = useReducer(remedyReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const remedyCases = readCollection(STORAGE_KEY);

      dispatch({
        type: ACTIONS.HYDRATE,
        payload: remedyCases,
      });

      info(REMEDY_CONTEXT_NAME, 'Remedy cases hydrated from localStorage', {
        count: remedyCases.length,
      });
    } catch (err) {
      error(REMEDY_CONTEXT_NAME, 'Failed to hydrate remedy cases from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY, state.remedyCases);
    } catch (err) {
      error(REMEDY_CONTEXT_NAME, 'Failed to persist remedy cases to localStorage', err);
    }
  }, [state.remedyCases]);

  useEffect(() => {
    const handleDefectRequiresRemedy = (payload) => {
      if (!payload || typeof payload !== 'object') {
        warn(REMEDY_CONTEXT_NAME, 'DEFECT_REQUIRES_REMEDY event received with invalid payload');
        return;
      }

      debug(REMEDY_CONTEXT_NAME, 'DEFECT_REQUIRES_REMEDY event received', {
        defectId: payload.defectId,
        severity: payload.severity,
      });

      const priority = payload.severity === 'critical'
        ? 'critical'
        : payload.severity === 'major'
          ? 'high'
          : 'medium';

      const remedyData = {
        sourceType: 'qc_defect',
        sourceId: payload.qcCaseId || payload.defectId,
        linkedDefectIds: [payload.defectId],
        sellerId: payload.sellerId,
        remedyType: 'cure',
        priority,
        description: payload.description || `Remedy required for defect ${payload.defectId}: ${payload.category} - ${payload.subcategory}`,
        createdBy: 'System',
      };

      createRemedyCase(remedyData);
    };

    const unsubscribe = on(EVENTS.DEFECT_REQUIRES_REMEDY, handleDefectRequiresRemedy);

    return () => {
      unsubscribe();
    };
  }, []);

  const getRemedyCaseById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.remedyCases.find((remedyCase) => remedyCase && remedyCase.id === id) || null;
    },
    [state.remedyCases],
  );

  const getRemediesBySeller = useCallback(
    (sellerId) => {
      if (!sellerId || typeof sellerId !== 'string') {
        return [];
      }
      return state.remedyCases.filter(
        (remedyCase) => remedyCase && remedyCase.sellerId === sellerId,
      );
    },
    [state.remedyCases],
  );

  const getRemediesByStatus = useCallback(
    (status) => {
      if (!status || typeof status !== 'string') {
        return [];
      }
      return state.remedyCases.filter(
        (remedyCase) => remedyCase && remedyCase.status === status,
      );
    },
    [state.remedyCases],
  );

  const getBreachedRemedies = useCallback(() => {
    return state.remedyCases.filter((remedyCase) => {
      if (!remedyCase) return false;
      return remedyCase.slaBreached === true;
    });
  }, [state.remedyCases]);

  const createRemedyCase = useCallback(
    (remedyData) => {
      if (!remedyData || typeof remedyData !== 'object') {
        warn(REMEDY_CONTEXT_NAME, 'createRemedyCase called with invalid remedyData');
        return {
          success: false,
          remedyCase: null,
          errors: [
            {
              field: 'remedy',
              code: 'INVALID_INPUT',
              message: 'Remedy data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateRemedyData(remedyData);

      if (!validationResult.valid) {
        debug(REMEDY_CONTEXT_NAME, 'Remedy validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          remedyCase: null,
          errors: validationResult.errors,
        };
      }

      const now = new Date().toISOString();
      const priority = remedyData.priority || 'medium';
      const dueDate = remedyData.dueDate || calculateDueDate(priority);
      const slaBreached = checkSLABreach({ dueDate, status: 'open' });

      const newRemedyCase = {
        id: generateId('REM'),
        sourceType: remedyData.sourceType,
        sourceId: remedyData.sourceId || '',
        linkedDefectIds: Array.isArray(remedyData.linkedDefectIds)
          ? remedyData.linkedDefectIds
          : [],
        sellerId: remedyData.sellerId,
        remedyType: remedyData.remedyType,
        status: 'open',
        priority,
        ownerId: remedyData.ownerId || null,
        dueDate,
        slaBreached,
        escalationLevel: 0,
        description: remedyData.description,
        financialImpact: {
          estimated: remedyData.financialImpact?.estimated || 0,
          actual: null,
          currency: 'USD',
        },
        outcome: null,
        history: [
          {
            timestamp: now,
            action: 'CREATED',
            persona: remedyData.createdBy || 'Unknown',
            notes: remedyData.description || 'Remedy case created.',
          },
        ],
        createdBy: remedyData.createdBy || 'Unknown',
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      };

      dispatch({
        type: ACTIONS.ADD_REMEDY,
        payload: newRemedyCase,
      });

      info(REMEDY_CONTEXT_NAME, 'Remedy case created', {
        remedyId: newRemedyCase.id,
        sourceType: newRemedyCase.sourceType,
        priority: newRemedyCase.priority,
      });

      return {
        success: true,
        remedyCase: newRemedyCase,
        errors: [],
      };
    },
    [],
  );

  const transitionStatus = useCallback(
    (id, newStatus, notes = '') => {
      if (!id || typeof id !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'transitionStatus called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Remedy case ID is required.',
          },
        };
      }

      if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
        warn(REMEDY_CONTEXT_NAME, 'transitionStatus called with invalid status', {
          newStatus,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`,
          },
        };
      }

      const existingCase = state.remedyCases.find(
        (remedyCase) => remedyCase && remedyCase.id === id,
      );

      if (!existingCase) {
        warn(REMEDY_CONTEXT_NAME, 'Remedy case not found for status transition', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Remedy case with ID "${id}" not found.`,
          },
        };
      }

      if (!isValidTransition(existingCase.status, newStatus)) {
        warn(REMEDY_CONTEXT_NAME, 'Invalid status transition', {
          id,
          currentStatus: existingCase.status,
          newStatus,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from "${existingCase.status}" to "${newStatus}".`,
          },
        };
      }

      const now = new Date().toISOString();
      const slaBreached = checkSLABreach({
        ...existingCase,
        status: newStatus,
      });

      const updates = {
        status: newStatus,
        slaBreached,
        updatedAt: now,
      };

      if (newStatus === 'resolved' || newStatus === 'closed') {
        updates.resolvedAt = now;
      }

      const historyEntry = {
        timestamp: now,
        action: `STATUS_CHANGE`,
        persona: 'Unknown',
        notes: notes || `Status changed from "${existingCase.status}" to "${newStatus}".`,
      };

      dispatch({
        type: ACTIONS.UPDATE_REMEDY,
        payload: {
          id,
          updates: {
            ...updates,
            history: [...(existingCase.history || []), historyEntry],
          },
        },
      });

      info(REMEDY_CONTEXT_NAME, 'Remedy case status transitioned', {
        remedyId: id,
        previousStatus: existingCase.status,
        newStatus,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.remedyCases],
  );

  const assignOwner = useCallback(
    (id, persona) => {
      if (!id || typeof id !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'assignOwner called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Remedy case ID is required.',
          },
        };
      }

      if (!persona || typeof persona !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'assignOwner called with invalid persona', { persona });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Owner persona is required.',
          },
        };
      }

      const existingCase = state.remedyCases.find(
        (remedyCase) => remedyCase && remedyCase.id === id,
      );

      if (!existingCase) {
        warn(REMEDY_CONTEXT_NAME, 'Remedy case not found for owner assignment', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Remedy case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status === 'closed') {
        warn(REMEDY_CONTEXT_NAME, 'Cannot assign owner to closed remedy case', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: 'Cannot assign owner to a closed remedy case.',
          },
        };
      }

      const now = new Date().toISOString();
      const newStatus = existingCase.status === 'open' ? 'assigned' : existingCase.status;

      const historyEntry = {
        timestamp: now,
        action: 'ASSIGNED',
        persona,
        notes: `Case assigned to ${persona}.`,
      };

      dispatch({
        type: ACTIONS.UPDATE_REMEDY,
        payload: {
          id,
          updates: {
            ownerId: persona,
            status: newStatus,
            history: [...(existingCase.history || []), historyEntry],
          },
        },
      });

      debug(REMEDY_CONTEXT_NAME, 'Owner assigned to remedy case', { remedyId: id, persona });

      return {
        success: true,
        error: null,
      };
    },
    [state.remedyCases],
  );

  const escalate = useCallback(
    (id, reason = '') => {
      if (!id || typeof id !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'escalate called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Remedy case ID is required.',
          },
        };
      }

      const existingCase = state.remedyCases.find(
        (remedyCase) => remedyCase && remedyCase.id === id,
      );

      if (!existingCase) {
        warn(REMEDY_CONTEXT_NAME, 'Remedy case not found for escalation', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Remedy case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status === 'closed' || existingCase.status === 'resolved') {
        warn(REMEDY_CONTEXT_NAME, 'Cannot escalate closed or resolved remedy case', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot escalate a "${existingCase.status}" remedy case.`,
          },
        };
      }

      if (existingCase.status === 'escalated') {
        debug(REMEDY_CONTEXT_NAME, 'Remedy case already escalated', { id });
        return {
          success: true,
          error: null,
        };
      }

      const now = new Date().toISOString();
      const newEscalationLevel = (existingCase.escalationLevel || 0) + 1;

      const historyEntry = {
        timestamp: now,
        action: 'ESCALATED',
        persona: 'Unknown',
        notes: reason || `Case escalated to level ${newEscalationLevel}.`,
      };

      dispatch({
        type: ACTIONS.UPDATE_REMEDY,
        payload: {
          id,
          updates: {
            status: 'escalated',
            escalationLevel: newEscalationLevel,
            priority: 'critical',
            history: [...(existingCase.history || []), historyEntry],
          },
        },
      });

      info(REMEDY_CONTEXT_NAME, 'Remedy case escalated', {
        remedyId: id,
        escalationLevel: newEscalationLevel,
        reason,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.remedyCases],
  );

  const recordFinancialImpact = useCallback(
    (id, amount, type = 'actual') => {
      if (!id || typeof id !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'recordFinancialImpact called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Remedy case ID is required.',
          },
        };
      }

      if (amount == null || isNaN(amount) || amount < 0) {
        warn(REMEDY_CONTEXT_NAME, 'recordFinancialImpact called with invalid amount', {
          amount,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Financial impact amount must be a non-negative number.',
          },
        };
      }

      const existingCase = state.remedyCases.find(
        (remedyCase) => remedyCase && remedyCase.id === id,
      );

      if (!existingCase) {
        warn(REMEDY_CONTEXT_NAME, 'Remedy case not found for financial impact', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Remedy case with ID "${id}" not found.`,
          },
        };
      }

      const now = new Date().toISOString();

      const historyEntry = {
        timestamp: now,
        action: 'FINANCIAL_IMPACT',
        persona: 'Unknown',
        notes: `${type === 'actual' ? 'Actual' : 'Estimated'} financial impact recorded: $${amount.toLocaleString()}.`,
      };

      const financialImpact = {
        ...existingCase.financialImpact,
        [type]: amount,
      };

      dispatch({
        type: ACTIONS.UPDATE_REMEDY,
        payload: {
          id,
          updates: {
            financialImpact,
            history: [...(existingCase.history || []), historyEntry],
          },
        },
      });

      debug(REMEDY_CONTEXT_NAME, 'Financial impact recorded for remedy case', {
        remedyId: id,
        amount,
        type,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.remedyCases],
  );

  const closeRemedyCase = useCallback(
    (id, outcome, finalImpact = 0) => {
      if (!id || typeof id !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'closeRemedyCase called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Remedy case ID is required.',
          },
        };
      }

      if (!outcome || typeof outcome !== 'string') {
        warn(REMEDY_CONTEXT_NAME, 'closeRemedyCase called with invalid outcome', { outcome });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Outcome description is required.',
          },
        };
      }

      const existingCase = state.remedyCases.find(
        (remedyCase) => remedyCase && remedyCase.id === id,
      );

      if (!existingCase) {
        warn(REMEDY_CONTEXT_NAME, 'Remedy case not found for close', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Remedy case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status === 'closed') {
        debug(REMEDY_CONTEXT_NAME, 'Remedy case already closed', { id });
        return {
          success: true,
          error: null,
        };
      }

      if (existingCase.status !== 'resolved') {
        warn(REMEDY_CONTEXT_NAME, 'Cannot close unresolved remedy case', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot close a remedy case with status "${existingCase.status}". Case must be resolved first.`,
          },
        };
      }

      const now = new Date().toISOString();

      const historyEntry = {
        timestamp: now,
        action: 'CLOSED',
        persona: 'Unknown',
        notes: `Case closed. Outcome: ${outcome}. Final impact: $${finalImpact.toLocaleString()}.`,
      };

      const financialImpact = {
        ...existingCase.financialImpact,
        actual: finalImpact,
      };

      dispatch({
        type: ACTIONS.UPDATE_REMEDY,
        payload: {
          id,
          updates: {
            status: 'closed',
            outcome,
            financialImpact,
            resolvedAt: now,
            history: [...(existingCase.history || []), historyEntry],
          },
        },
      });

      info(REMEDY_CONTEXT_NAME, 'Remedy case closed', {
        remedyId: id,
        outcome,
        finalImpact,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.remedyCases],
  );

  const filterRemedies = useCallback(
    (filters = {}) => {
      if (!Array.isArray(state.remedyCases)) {
        return [];
      }

      let filtered = [...state.remedyCases];

      if (filters.status && typeof filters.status === 'string') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.status === filters.status,
        );
      }

      if (filters.priority && typeof filters.priority === 'string') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.priority === filters.priority,
        );
      }

      if (filters.remedyType && typeof filters.remedyType === 'string') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.remedyType === filters.remedyType,
        );
      }

      if (filters.sourceType && typeof filters.sourceType === 'string') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.sourceType === filters.sourceType,
        );
      }

      if (filters.sellerId && typeof filters.sellerId === 'string') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.sellerId === filters.sellerId,
        );
      }

      if (filters.ownerId && typeof filters.ownerId === 'string') {
        filtered = filtered.filter(
          (remedyCase) => remedyCase && remedyCase.ownerId === filters.ownerId,
        );
      }

      if (filters.slaBreached !== undefined && filters.slaBreached !== null) {
        filtered = filtered.filter(
          (remedyCase) =>
            remedyCase && remedyCase.slaBreached === filters.slaBreached,
        );
      }

      if (filters.search && typeof filters.search === 'string') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((remedyCase) => {
          if (!remedyCase) return false;
          return (
            (remedyCase.id && remedyCase.id.toLowerCase().includes(searchLower)) ||
            (remedyCase.description &&
              remedyCase.description.toLowerCase().includes(searchLower)) ||
            (remedyCase.sellerId &&
              remedyCase.sellerId.toLowerCase().includes(searchLower)) ||
            (remedyCase.outcome &&
              remedyCase.outcome.toLowerCase().includes(searchLower))
          );
        });
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (!isNaN(startDate.getTime())) {
          filtered = filtered.filter(
            (remedyCase) => remedyCase && new Date(remedyCase.createdAt) >= startDate,
          );
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (!isNaN(endDate.getTime())) {
          filtered = filtered.filter(
            (remedyCase) => remedyCase && new Date(remedyCase.createdAt) <= endDate,
          );
        }
      }

      if (filters.sortBy && typeof filters.sortBy === 'string') {
        const sortField = filters.sortBy;
        const sortDirection = filters.sortDirection === 'desc' ? -1 : 1;

        filtered.sort((a, b) => {
          const aVal = a ? a[sortField] : undefined;
          const bVal = b ? b[sortField] : undefined;

          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * sortDirection;
          }

          if (aVal < bVal) return -1 * sortDirection;
          if (aVal > bVal) return 1 * sortDirection;
          return 0;
        });
      } else {
        filtered.sort((a, b) => {
          const aDate = a ? new Date(a.createdAt) : new Date(0);
          const bDate = b ? new Date(b.createdAt) : new Date(0);
          return bDate - aDate;
        });
      }

      return filtered;
    },
    [state.remedyCases],
  );

  const paginateRemedies = useCallback(
    (page = 1, pageSize = 25, filters = {}) => {
      if (page < 1) {
        page = 1;
      }

      if (![10, 25, 50, 100].includes(pageSize)) {
        pageSize = 25;
      }

      const filtered = filterRemedies(filters);

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const startIndex = (safePage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const data = filtered.slice(startIndex, endIndex);

      return {
        data,
        total,
        page: safePage,
        pageSize,
        totalPages,
      };
    },
    [filterRemedies],
  );

  const getRemedyStats = useCallback(() => {
    const stats = {
      total: state.remedyCases.length,
      open: 0,
      assigned: 0,
      inProgress: 0,
      pendingCounterparty: 0,
      escalated: 0,
      resolved: 0,
      closed: 0,
      breached: 0,
      byPriority: {},
      byRemedyType: {},
      bySeller: {},
      totalExposure: 0,
    };

    for (const remedyCase of state.remedyCases) {
      if (!remedyCase) continue;

      switch (remedyCase.status) {
        case 'open':
          stats.open++;
          break;
        case 'assigned':
          stats.assigned++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'pending_counterparty':
          stats.pendingCounterparty++;
          break;
        case 'escalated':
          stats.escalated++;
          break;
        case 'resolved':
          stats.resolved++;
          break;
        case 'closed':
          stats.closed++;
          break;
        default:
          break;
      }

      if (remedyCase.slaBreached) {
        stats.breached++;
      }

      if (remedyCase.priority) {
        stats.byPriority[remedyCase.priority] =
          (stats.byPriority[remedyCase.priority] || 0) + 1;
      }

      if (remedyCase.remedyType) {
        stats.byRemedyType[remedyCase.remedyType] =
          (stats.byRemedyType[remedyCase.remedyType] || 0) + 1;
      }

      if (remedyCase.sellerId) {
        stats.bySeller[remedyCase.sellerId] =
          (stats.bySeller[remedyCase.sellerId] || 0) + 1;
      }

      if (remedyCase.financialImpact) {
        const exposure =
          remedyCase.financialImpact.actual ||
          remedyCase.financialImpact.estimated ||
          0;
        stats.totalExposure += exposure;
      }
    }

    return stats;
  }, [state.remedyCases]);

  const refreshRemedies = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const remedyCases = readCollection(STORAGE_KEY);

      dispatch({
        type: ACTIONS.SET_REMEDIES,
        payload: remedyCases,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(REMEDY_CONTEXT_NAME, 'Remedy cases refreshed from localStorage', {
        count: remedyCases.length,
      });

      return true;
    } catch (err) {
      error(REMEDY_CONTEXT_NAME, 'Failed to refresh remedy cases', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const value = {
    remedyCases: state.remedyCases,
    isLoading: state.isLoading,
    error: state.error,
    getRemedyCaseById,
    getRemediesBySeller,
    getRemediesByStatus,
    getBreachedRemedies,
    createRemedyCase,
    transitionStatus,
    assignOwner,
    escalate,
    recordFinancialImpact,
    closeRemedyCase,
    filterRemedies,
    paginateRemedies,
    getRemedyStats,
    refreshRemedies,
  };

  return <RemedyContext.Provider value={value}>{children}</RemedyContext.Provider>;
};

RemedyProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useRemedies = () => {
  const context = useContext(RemedyContext);

  if (!context) {
    throw new Error('useRemedies must be used within a RemedyProvider');
  }

  return context;
};

export default RemedyContext;