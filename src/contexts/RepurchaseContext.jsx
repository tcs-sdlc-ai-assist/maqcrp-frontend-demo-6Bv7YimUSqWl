import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';
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

const RepurchaseContext = createContext(null);

const REPURCHASE_CONTEXT_NAME = 'RepurchaseContext';

const STORAGE_KEY = 'maqcrop_repurchase_cases';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  ADD_REPURCHASE: 'ADD_REPURCHASE',
  UPDATE_REPURCHASE: 'UPDATE_REPURCHASE',
  REMOVE_REPURCHASE: 'REMOVE_REPURCHASE',
  SET_REPURCHASES: 'SET_REPURCHASES',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  repurchaseCases: [],
  isLoading: true,
  error: null,
};

const repurchaseReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const repurchaseCases = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        repurchaseCases,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.ADD_REPURCHASE: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(REPURCHASE_CONTEXT_NAME, 'ADD_REPURCHASE called with invalid payload');
        return state;
      }
      return {
        ...state,
        repurchaseCases: [...state.repurchaseCases, action.payload],
      };
    }

    case ACTIONS.UPDATE_REPURCHASE: {
      if (!action.payload || !action.payload.id) {
        warn(REPURCHASE_CONTEXT_NAME, 'UPDATE_REPURCHASE called with invalid payload');
        return state;
      }
      return {
        ...state,
        repurchaseCases: state.repurchaseCases.map((repurchaseCase) => {
          if (repurchaseCase && repurchaseCase.id === action.payload.id) {
            return {
              ...repurchaseCase,
              ...action.payload.updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return repurchaseCase;
        }),
      };
    }

    case ACTIONS.REMOVE_REPURCHASE: {
      if (!action.payload) {
        warn(REPURCHASE_CONTEXT_NAME, 'REMOVE_REPURCHASE called with invalid payload');
        return state;
      }
      return {
        ...state,
        repurchaseCases: state.repurchaseCases.filter(
          (repurchaseCase) => repurchaseCase && repurchaseCase.id !== action.payload,
        ),
      };
    }

    case ACTIONS.SET_REPURCHASES: {
      const repurchaseCases = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        repurchaseCases,
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
      warn(REPURCHASE_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = (prefix = 'REP') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

const VALID_STATUSES = [
  'draft',
  'demand_issued',
  'counterparty_review',
  'negotiation',
  'accepted',
  'disputed',
  'alternative_accepted',
  'closed',
];

const VALID_RESPONSE_TYPES = ['accept', 'dispute', 'counter'];

const VALID_ALTERNATIVE_TYPES = [
  'indemnification',
  'price_adjustment',
  'partial_repurchase',
  'other',
];

const VALID_OUTCOME_TYPES = [
  'full_repurchase',
  'partial_repurchase',
  'indemnification',
  'price_adjustment',
  'withdrawn',
];

const STATUS_TRANSITIONS = {
  draft: ['demand_issued'],
  demand_issued: ['counterparty_review'],
  counterparty_review: ['negotiation', 'accepted', 'disputed'],
  negotiation: ['accepted', 'alternative_accepted', 'disputed'],
  accepted: ['closed'],
  alternative_accepted: ['closed'],
  disputed: ['negotiation', 'closed'],
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

const calculateExposure = (repurchaseCase) => {
  if (!repurchaseCase) {
    return 0;
  }

  if (repurchaseCase.status === 'closed') {
    return repurchaseCase.finalOutcome?.settledAmount || 0;
  }

  if (repurchaseCase.status === 'draft') {
    return 0;
  }

  if (
    repurchaseCase.alternativeProposal?.status === 'accepted' &&
    repurchaseCase.alternativeProposal?.amount !== null &&
    repurchaseCase.alternativeProposal?.amount !== undefined
  ) {
    return repurchaseCase.alternativeProposal.amount;
  }

  return repurchaseCase.demandAmount || 0;
};

const validateRepurchaseData = (repurchaseData) => {
  const errors = [];

  if (!repurchaseData || typeof repurchaseData !== 'object') {
    errors.push({
      field: 'repurchase',
      code: 'INVALID_INPUT',
      message: 'Repurchase data must be an object.',
    });
    return { valid: false, errors };
  }

  if (!repurchaseData.sellerId || typeof repurchaseData.sellerId !== 'string') {
    errors.push({
      field: 'sellerId',
      code: 'REQUIRED',
      message: 'Seller ID is required.',
    });
  }

  if (!repurchaseData.loanId || typeof repurchaseData.loanId !== 'string') {
    errors.push({
      field: 'loanId',
      code: 'REQUIRED',
      message: 'Loan ID is required.',
    });
  }

  if (
    repurchaseData.demandAmount === undefined ||
    repurchaseData.demandAmount === null ||
    isNaN(repurchaseData.demandAmount) ||
    repurchaseData.demandAmount <= 0
  ) {
    errors.push({
      field: 'demandAmount',
      code: 'REQUIRED',
      message: 'Demand amount must be a positive number.',
    });
  }

  if (!repurchaseData.rationale || typeof repurchaseData.rationale !== 'string' || repurchaseData.rationale.trim() === '') {
    errors.push({
      field: 'rationale',
      code: 'REQUIRED',
      message: 'Rationale is required.',
    });
  }

  return { valid: errors.length === 0, errors };
};

export const RepurchaseProvider = ({ children }) => {
  const [state, dispatch] = useReducer(repurchaseReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const repurchaseCases = readCollection(STORAGE_KEY);

      dispatch({
        type: ACTIONS.HYDRATE,
        payload: repurchaseCases,
      });

      info(REPURCHASE_CONTEXT_NAME, 'Repurchase cases hydrated from localStorage', {
        count: repurchaseCases.length,
      });
    } catch (err) {
      error(REPURCHASE_CONTEXT_NAME, 'Failed to hydrate repurchase cases from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY, state.repurchaseCases);
    } catch (err) {
      error(REPURCHASE_CONTEXT_NAME, 'Failed to persist repurchase cases to localStorage', err);
    }
  }, [state.repurchaseCases]);

  const getRepurchaseCaseById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return (
        state.repurchaseCases.find((repurchaseCase) => repurchaseCase && repurchaseCase.id === id) ||
        null
      );
    },
    [state.repurchaseCases],
  );

  const getRepurchasesBySeller = useCallback(
    (sellerId) => {
      if (!sellerId || typeof sellerId !== 'string') {
        return [];
      }
      return state.repurchaseCases.filter(
        (repurchaseCase) => repurchaseCase && repurchaseCase.sellerId === sellerId,
      );
    },
    [state.repurchaseCases],
  );

  const getRepurchasesByStatus = useCallback(
    (status) => {
      if (!status || typeof status !== 'string') {
        return [];
      }
      return state.repurchaseCases.filter(
        (repurchaseCase) => repurchaseCase && repurchaseCase.status === status,
      );
    },
    [state.repurchaseCases],
  );

  const getOpenExposure = useCallback(() => {
    let total = 0;

    for (const repurchaseCase of state.repurchaseCases) {
      if (!repurchaseCase) continue;

      if (repurchaseCase.status === 'closed') {
        continue;
      }

      total += calculateExposure(repurchaseCase);
    }

    return total;
  }, [state.repurchaseCases]);

  const getAgingReport = useCallback(
    (buckets = [30, 60, 90, 180]) => {
      if (!Array.isArray(buckets) || buckets.length === 0) {
        return [];
      }

      const now = new Date();
      const sortedBuckets = [...buckets].sort((a, b) => a - b);

      const report = [];

      for (let i = 0; i < sortedBuckets.length; i++) {
        const bucketDays = sortedBuckets[i];
        const previousDays = i === 0 ? 0 : sortedBuckets[i - 1];

        const bucketLabel =
          i === sortedBuckets.length - 1
            ? `${previousDays}+ Days`
            : `${previousDays}-${bucketDays} Days`;

        const casesInBucket = state.repurchaseCases.filter((repurchaseCase) => {
          if (!repurchaseCase) return false;

          if (repurchaseCase.status === 'closed' || repurchaseCase.status === 'draft') {
            return false;
          }

          const createdAt = new Date(repurchaseCase.createdAt);
          if (isNaN(createdAt.getTime())) {
            return false;
          }

          const ageInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

          if (i === sortedBuckets.length - 1) {
            return ageInDays >= previousDays;
          }

          return ageInDays >= previousDays && ageInDays < bucketDays;
        });

        const exposure = casesInBucket.reduce((sum, c) => sum + calculateExposure(c), 0);

        report.push({
          label: bucketLabel,
          minDays: previousDays,
          maxDays: i === sortedBuckets.length - 1 ? Infinity : bucketDays,
          count: casesInBucket.length,
          exposure,
        });
      }

      return report;
    },
    [state.repurchaseCases],
  );

  const initiateRepurchase = useCallback(
    (repurchaseData) => {
      if (!repurchaseData || typeof repurchaseData !== 'object') {
        warn(REPURCHASE_CONTEXT_NAME, 'initiateRepurchase called with invalid repurchaseData');
        return {
          success: false,
          repurchaseCase: null,
          errors: [
            {
              field: 'repurchase',
              code: 'INVALID_INPUT',
              message: 'Repurchase data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateRepurchaseData(repurchaseData);

      if (!validationResult.valid) {
        debug(REPURCHASE_CONTEXT_NAME, 'Repurchase validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          repurchaseCase: null,
          errors: validationResult.errors,
        };
      }

      const now = new Date().toISOString();

      const newRepurchaseCase = {
        id: generateId('REP'),
        linkedDefectIds: Array.isArray(repurchaseData.linkedDefectIds)
          ? repurchaseData.linkedDefectIds
          : [],
        sellerId: repurchaseData.sellerId,
        loanId: repurchaseData.loanId,
        demandAmount: repurchaseData.demandAmount,
        rationale: repurchaseData.rationale,
        evidence: Array.isArray(repurchaseData.evidence) ? repurchaseData.evidence : [],
        status: 'draft',
        counterpartyResponse: {
          receivedAt: null,
          responseType: null,
          rationale: null,
          proposedAmount: null,
        },
        alternativeProposal: {
          type: null,
          terms: null,
          amount: null,
          status: null,
        },
        finalOutcome: {
          type: null,
          settledAmount: null,
          closedAt: null,
          notes: null,
        },
        exposure: 0,
        createdBy: repurchaseData.createdBy || 'Unknown',
        createdAt: now,
        updatedAt: now,
      };

      dispatch({
        type: ACTIONS.ADD_REPURCHASE,
        payload: newRepurchaseCase,
      });

      info(REPURCHASE_CONTEXT_NAME, 'Repurchase case initiated', {
        repurchaseId: newRepurchaseCase.id,
        sellerId: newRepurchaseCase.sellerId,
        demandAmount: newRepurchaseCase.demandAmount,
      });

      return {
        success: true,
        repurchaseCase: newRepurchaseCase,
        errors: [],
      };
    },
    [],
  );

  const issueDemand = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(REPURCHASE_CONTEXT_NAME, 'issueDemand called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Repurchase case ID is required.',
          },
        };
      }

      const existingCase = state.repurchaseCases.find(
        (repurchaseCase) => repurchaseCase && repurchaseCase.id === id,
      );

      if (!existingCase) {
        warn(REPURCHASE_CONTEXT_NAME, 'Repurchase case not found for demand issuance', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Repurchase case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status !== 'draft') {
        warn(REPURCHASE_CONTEXT_NAME, 'Cannot issue demand for non-draft repurchase case', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot issue demand for a repurchase case with status "${existingCase.status}". Case must be in draft status.`,
          },
        };
      }

      const now = new Date().toISOString();

      const updatedCase = {
        ...existingCase,
        status: 'demand_issued',
        exposure: existingCase.demandAmount,
        updatedAt: now,
      };

      dispatch({
        type: ACTIONS.UPDATE_REPURCHASE,
        payload: {
          id,
          updates: {
            status: 'demand_issued',
            exposure: existingCase.demandAmount,
          },
        },
      });

      info(REPURCHASE_CONTEXT_NAME, 'Repurchase demand issued', { repurchaseId: id });

      return {
        success: true,
        error: null,
      };
    },
    [state.repurchaseCases],
  );

  const recordCounterpartyResponse = useCallback(
    (id, response) => {
      if (!id || typeof id !== 'string') {
        warn(REPURCHASE_CONTEXT_NAME, 'recordCounterpartyResponse called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Repurchase case ID is required.',
          },
        };
      }

      if (!response || typeof response !== 'object') {
        warn(REPURCHASE_CONTEXT_NAME, 'recordCounterpartyResponse called with invalid response');
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Response must be an object.',
          },
        };
      }

      if (!response.responseType || !VALID_RESPONSE_TYPES.includes(response.responseType)) {
        warn(REPURCHASE_CONTEXT_NAME, 'recordCounterpartyResponse called with invalid responseType', {
          responseType: response.responseType,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_VALUE',
            message: `Response type must be one of: ${VALID_RESPONSE_TYPES.join(', ')}.`,
          },
        };
      }

      const existingCase = state.repurchaseCases.find(
        (repurchaseCase) => repurchaseCase && repurchaseCase.id === id,
      );

      if (!existingCase) {
        warn(REPURCHASE_CONTEXT_NAME, 'Repurchase case not found for counterparty response', {
          id,
        });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Repurchase case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status !== 'demand_issued' && existingCase.status !== 'counterparty_review') {
        warn(REPURCHASE_CONTEXT_NAME, 'Cannot record counterparty response for current status', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot record counterparty response for a repurchase case with status "${existingCase.status}".`,
          },
        };
      }

      const now = new Date().toISOString();

      let newStatus;
      switch (response.responseType) {
        case 'accept':
          newStatus = 'accepted';
          break;
        case 'dispute':
          newStatus = 'disputed';
          break;
        case 'counter':
          newStatus = 'negotiation';
          break;
        default:
          newStatus = 'counterparty_review';
      }

      const counterpartyResponse = {
        receivedAt: now,
        responseType: response.responseType,
        rationale: response.rationale || '',
        proposedAmount:
          response.proposedAmount !== undefined && response.proposedAmount !== null
            ? response.proposedAmount
            : null,
      };

      const updatedCase = {
        ...existingCase,
        status: newStatus,
        counterpartyResponse,
        updatedAt: now,
      };

      const updatedExposure = calculateExposure(updatedCase);

      dispatch({
        type: ACTIONS.UPDATE_REPURCHASE,
        payload: {
          id,
          updates: {
            status: newStatus,
            counterpartyResponse,
            exposure: updatedExposure,
          },
        },
      });

      info(REPURCHASE_CONTEXT_NAME, 'Counterparty response recorded', {
        repurchaseId: id,
        responseType: response.responseType,
        newStatus,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.repurchaseCases],
  );

  const negotiateAlternative = useCallback(
    (id, terms) => {
      if (!id || typeof id !== 'string') {
        warn(REPURCHASE_CONTEXT_NAME, 'negotiateAlternative called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Repurchase case ID is required.',
          },
        };
      }

      if (!terms || typeof terms !== 'object') {
        warn(REPURCHASE_CONTEXT_NAME, 'negotiateAlternative called with invalid terms');
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Terms must be an object.',
          },
        };
      }

      if (!terms.type || !VALID_ALTERNATIVE_TYPES.includes(terms.type)) {
        warn(REPURCHASE_CONTEXT_NAME, 'negotiateAlternative called with invalid type', {
          type: terms.type,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_VALUE',
            message: `Alternative type must be one of: ${VALID_ALTERNATIVE_TYPES.join(', ')}.`,
          },
        };
      }

      const existingCase = state.repurchaseCases.find(
        (repurchaseCase) => repurchaseCase && repurchaseCase.id === id,
      );

      if (!existingCase) {
        warn(REPURCHASE_CONTEXT_NAME, 'Repurchase case not found for alternative negotiation', {
          id,
        });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Repurchase case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status !== 'negotiation') {
        warn(REPURCHASE_CONTEXT_NAME, 'Cannot negotiate alternative for current status', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot negotiate alternative for a repurchase case with status "${existingCase.status}". Case must be in negotiation status.`,
          },
        };
      }

      const now = new Date().toISOString();

      const alternativeProposal = {
        type: terms.type,
        terms: terms.terms || '',
        amount:
          terms.amount !== undefined && terms.amount !== null && !isNaN(terms.amount)
            ? terms.amount
            : null,
        status: 'proposed',
      };

      const updatedCase = {
        ...existingCase,
        alternativeProposal,
        updatedAt: now,
      };

      const updatedExposure = calculateExposure(updatedCase);

      dispatch({
        type: ACTIONS.UPDATE_REPURCHASE,
        payload: {
          id,
          updates: {
            alternativeProposal,
            exposure: updatedExposure,
          },
        },
      });

      info(REPURCHASE_CONTEXT_NAME, 'Alternative proposal negotiated', {
        repurchaseId: id,
        type: terms.type,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.repurchaseCases],
  );

  const acceptAlternative = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(REPURCHASE_CONTEXT_NAME, 'acceptAlternative called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Repurchase case ID is required.',
          },
        };
      }

      const existingCase = state.repurchaseCases.find(
        (repurchaseCase) => repurchaseCase && repurchaseCase.id === id,
      );

      if (!existingCase) {
        warn(REPURCHASE_CONTEXT_NAME, 'Repurchase case not found for alternative acceptance', {
          id,
        });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Repurchase case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status !== 'negotiation') {
        warn(REPURCHASE_CONTEXT_NAME, 'Cannot accept alternative for current status', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot accept alternative for a repurchase case with status "${existingCase.status}". Case must be in negotiation status.`,
          },
        };
      }

      if (
        !existingCase.alternativeProposal ||
        existingCase.alternativeProposal.status !== 'proposed'
      ) {
        warn(REPURCHASE_CONTEXT_NAME, 'No proposed alternative to accept', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: 'No proposed alternative exists to accept.',
          },
        };
      }

      const now = new Date().toISOString();

      const alternativeProposal = {
        ...existingCase.alternativeProposal,
        status: 'accepted',
      };

      const updatedCase = {
        ...existingCase,
        status: 'alternative_accepted',
        alternativeProposal,
        updatedAt: now,
      };

      const updatedExposure = calculateExposure(updatedCase);

      dispatch({
        type: ACTIONS.UPDATE_REPURCHASE,
        payload: {
          id,
          updates: {
            status: 'alternative_accepted',
            alternativeProposal,
            exposure: updatedExposure,
          },
        },
      });

      info(REPURCHASE_CONTEXT_NAME, 'Alternative proposal accepted', { repurchaseId: id });

      return {
        success: true,
        error: null,
      };
    },
    [state.repurchaseCases],
  );

  const rejectAlternative = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(REPURCHASE_CONTEXT_NAME, 'rejectAlternative called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Repurchase case ID is required.',
          },
        };
      }

      const existingCase = state.repurchaseCases.find(
        (repurchaseCase) => repurchaseCase && repurchaseCase.id === id,
      );

      if (!existingCase) {
        warn(REPURCHASE_CONTEXT_NAME, 'Repurchase case not found for alternative rejection', {
          id,
        });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Repurchase case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status !== 'negotiation') {
        warn(REPURCHASE_CONTEXT_NAME, 'Cannot reject alternative for current status', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot reject alternative for a repurchase case with status "${existingCase.status}". Case must be in negotiation status.`,
          },
        };
      }

      const now = new Date().toISOString();

      const alternativeProposal = existingCase.alternativeProposal
        ? {
            ...existingCase.alternativeProposal,
            status: 'rejected',
          }
        : {
            type: null,
            terms: null,
            amount: null,
            status: 'rejected',
          };

      dispatch({
        type: ACTIONS.UPDATE_REPURCHASE,
        payload: {
          id,
          updates: {
            alternativeProposal,
          },
        },
      });

      info(REPURCHASE_CONTEXT_NAME, 'Alternative proposal rejected', { repurchaseId: id });

      return {
        success: true,
        error: null,
      };
    },
    [state.repurchaseCases],
  );

  const closeRepurchase = useCallback(
    (id, outcome) => {
      if (!id || typeof id !== 'string') {
        warn(REPURCHASE_CONTEXT_NAME, 'closeRepurchase called with invalid id', { id });
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Repurchase case ID is required.',
          },
        };
      }

      if (!outcome || typeof outcome !== 'object') {
        warn(REPURCHASE_CONTEXT_NAME, 'closeRepurchase called with invalid outcome');
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Outcome must be an object.',
          },
        };
      }

      if (!outcome.type || !VALID_OUTCOME_TYPES.includes(outcome.type)) {
        warn(REPURCHASE_CONTEXT_NAME, 'closeRepurchase called with invalid outcome type', {
          type: outcome.type,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_VALUE',
            message: `Outcome type must be one of: ${VALID_OUTCOME_TYPES.join(', ')}.`,
          },
        };
      }

      const existingCase = state.repurchaseCases.find(
        (repurchaseCase) => repurchaseCase && repurchaseCase.id === id,
      );

      if (!existingCase) {
        warn(REPURCHASE_CONTEXT_NAME, 'Repurchase case not found for close', { id });
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Repurchase case with ID "${id}" not found.`,
          },
        };
      }

      if (existingCase.status === 'closed') {
        debug(REPURCHASE_CONTEXT_NAME, 'Repurchase case already closed', { id });
        return {
          success: true,
          error: null,
        };
      }

      const closableStatuses = ['accepted', 'alternative_accepted', 'disputed'];
      if (!closableStatuses.includes(existingCase.status)) {
        warn(REPURCHASE_CONTEXT_NAME, 'Cannot close repurchase case with current status', {
          id,
          currentStatus: existingCase.status,
        });
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot close a repurchase case with status "${existingCase.status}". Case must be accepted, alternative_accepted, or disputed.`,
          },
        };
      }

      const now = new Date().toISOString();

      const settledAmount =
        outcome.settledAmount !== undefined &&
        outcome.settledAmount !== null &&
        !isNaN(outcome.settledAmount)
          ? outcome.settledAmount
          : existingCase.demandAmount;

      const finalOutcome = {
        type: outcome.type,
        settledAmount,
        closedAt: now,
        notes: outcome.notes || '',
      };

      dispatch({
        type: ACTIONS.UPDATE_REPURCHASE,
        payload: {
          id,
          updates: {
            status: 'closed',
            finalOutcome,
            exposure: settledAmount,
          },
        },
      });

      info(REPURCHASE_CONTEXT_NAME, 'Repurchase case closed', {
        repurchaseId: id,
        outcomeType: outcome.type,
        settledAmount,
      });

      return {
        success: true,
        error: null,
      };
    },
    [state.repurchaseCases],
  );

  const filterRepurchases = useCallback(
    (filters = {}) => {
      if (!Array.isArray(state.repurchaseCases)) {
        return [];
      }

      let filtered = [...state.repurchaseCases];

      if (filters.status && typeof filters.status === 'string') {
        filtered = filtered.filter(
          (repurchaseCase) => repurchaseCase && repurchaseCase.status === filters.status,
        );
      }

      if (filters.sellerId && typeof filters.sellerId === 'string') {
        filtered = filtered.filter(
          (repurchaseCase) => repurchaseCase && repurchaseCase.sellerId === filters.sellerId,
        );
      }

      if (filters.loanId && typeof filters.loanId === 'string') {
        filtered = filtered.filter(
          (repurchaseCase) => repurchaseCase && repurchaseCase.loanId === filters.loanId,
        );
      }

      if (filters.minExposure !== undefined && filters.minExposure !== null) {
        filtered = filtered.filter(
          (repurchaseCase) =>
            repurchaseCase && calculateExposure(repurchaseCase) >= filters.minExposure,
        );
      }

      if (filters.maxExposure !== undefined && filters.maxExposure !== null) {
        filtered = filtered.filter(
          (repurchaseCase) =>
            repurchaseCase && calculateExposure(repurchaseCase) <= filters.maxExposure,
        );
      }

      if (filters.search && typeof filters.search === 'string') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((repurchaseCase) => {
          if (!repurchaseCase) return false;
          return (
            (repurchaseCase.id && repurchaseCase.id.toLowerCase().includes(searchLower)) ||
            (repurchaseCase.sellerId &&
              repurchaseCase.sellerId.toLowerCase().includes(searchLower)) ||
            (repurchaseCase.loanId &&
              repurchaseCase.loanId.toLowerCase().includes(searchLower)) ||
            (repurchaseCase.rationale &&
              repurchaseCase.rationale.toLowerCase().includes(searchLower))
          );
        });
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (!isNaN(startDate.getTime())) {
          filtered = filtered.filter(
            (repurchaseCase) =>
              repurchaseCase && new Date(repurchaseCase.createdAt) >= startDate,
          );
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (!isNaN(endDate.getTime())) {
          filtered = filtered.filter(
            (repurchaseCase) =>
              repurchaseCase && new Date(repurchaseCase.createdAt) <= endDate,
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
    [state.repurchaseCases],
  );

  const paginateRepurchases = useCallback(
    (page = 1, pageSize = 25, filters = {}) => {
      if (page < 1) {
        page = 1;
      }

      if (![10, 25, 50, 100].includes(pageSize)) {
        pageSize = 25;
      }

      const filtered = filterRepurchases(filters);

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
    [filterRepurchases],
  );

  const getRepurchaseStats = useCallback(() => {
    const stats = {
      total: state.repurchaseCases.length,
      draft: 0,
      demandIssued: 0,
      counterpartyReview: 0,
      negotiation: 0,
      accepted: 0,
      disputed: 0,
      alternativeAccepted: 0,
      closed: 0,
      totalExposure: 0,
      bySeller: {},
    };

    for (const repurchaseCase of state.repurchaseCases) {
      if (!repurchaseCase) continue;

      switch (repurchaseCase.status) {
        case 'draft':
          stats.draft++;
          break;
        case 'demand_issued':
          stats.demandIssued++;
          break;
        case 'counterparty_review':
          stats.counterpartyReview++;
          break;
        case 'negotiation':
          stats.negotiation++;
          break;
        case 'accepted':
          stats.accepted++;
          break;
        case 'disputed':
          stats.disputed++;
          break;
        case 'alternative_accepted':
          stats.alternativeAccepted++;
          break;
        case 'closed':
          stats.closed++;
          break;
        default:
          break;
      }

      if (repurchaseCase.sellerId) {
        stats.bySeller[repurchaseCase.sellerId] =
          (stats.bySeller[repurchaseCase.sellerId] || 0) + 1;
      }

      stats.totalExposure += calculateExposure(repurchaseCase);
    }

    return stats;
  }, [state.repurchaseCases]);

  const refreshRepurchases = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const repurchaseCases = readCollection(STORAGE_KEY);

      dispatch({
        type: ACTIONS.SET_REPURCHASES,
        payload: repurchaseCases,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(REPURCHASE_CONTEXT_NAME, 'Repurchase cases refreshed from localStorage', {
        count: repurchaseCases.length,
      });

      return true;
    } catch (err) {
      error(REPURCHASE_CONTEXT_NAME, 'Failed to refresh repurchase cases', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const value = {
    repurchaseCases: state.repurchaseCases,
    isLoading: state.isLoading,
    error: state.error,
    getRepurchaseCaseById,
    getRepurchasesBySeller,
    getRepurchasesByStatus,
    getOpenExposure,
    getAgingReport,
    initiateRepurchase,
    issueDemand,
    recordCounterpartyResponse,
    negotiateAlternative,
    acceptAlternative,
    rejectAlternative,
    closeRepurchase,
    filterRepurchases,
    paginateRepurchases,
    getRepurchaseStats,
    refreshRepurchases,
  };

  return <RepurchaseContext.Provider value={value}>{children}</RepurchaseContext.Provider>;
};

RepurchaseProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useRepurchases = () => {
  const context = useContext(RepurchaseContext);

  if (!context) {
    throw new Error('useRepurchases must be used within a RepurchaseProvider');
  }

  return context;
};

export default RepurchaseContext;