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

const QCContext = createContext(null);

const QC_CONTEXT_NAME = 'QCContext';

const STORAGE_KEY_QC_CASES = 'maqcrop_qc_cases';
const STORAGE_KEY_CHECKLIST_TEMPLATES = 'maqcrop_checklist_templates';
const STORAGE_KEY_SAMPLING_CONFIGS = 'maqcrop_sampling_configs';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  ADD_QC_CASE: 'ADD_QC_CASE',
  UPDATE_QC_CASE: 'UPDATE_QC_CASE',
  REMOVE_QC_CASE: 'REMOVE_QC_CASE',
  SET_QC_CASES: 'SET_QC_CASES',
  SET_CHECKLIST_TEMPLATES: 'SET_CHECKLIST_TEMPLATES',
  ADD_CHECKLIST_TEMPLATE: 'ADD_CHECKLIST_TEMPLATE',
  UPDATE_CHECKLIST_TEMPLATE: 'UPDATE_CHECKLIST_TEMPLATE',
  SET_SAMPLING_CONFIGS: 'SET_SAMPLING_CONFIGS',
  ADD_SAMPLING_CONFIG: 'ADD_SAMPLING_CONFIG',
  UPDATE_SAMPLING_CONFIG: 'UPDATE_SAMPLING_CONFIG',
  REMOVE_SAMPLING_CONFIG: 'REMOVE_SAMPLING_CONFIG',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  qcCases: [],
  checklistTemplates: [],
  samplingConfigs: [],
  isLoading: true,
  error: null,
};

const qcReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const qcCases = Array.isArray(action.payload.qcCases) ? action.payload.qcCases : [];
      const checklistTemplates = Array.isArray(action.payload.checklistTemplates)
        ? action.payload.checklistTemplates
        : [];
      const samplingConfigs = Array.isArray(action.payload.samplingConfigs)
        ? action.payload.samplingConfigs
        : [];
      return {
        ...state,
        qcCases,
        checklistTemplates,
        samplingConfigs,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.ADD_QC_CASE: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(QC_CONTEXT_NAME, 'ADD_QC_CASE called with invalid payload');
        return state;
      }
      return {
        ...state,
        qcCases: [...state.qcCases, action.payload],
      };
    }

    case ACTIONS.UPDATE_QC_CASE: {
      if (!action.payload || !action.payload.id) {
        warn(QC_CONTEXT_NAME, 'UPDATE_QC_CASE called with invalid payload');
        return state;
      }
      return {
        ...state,
        qcCases: state.qcCases.map((qcCase) => {
          if (qcCase && qcCase.id === action.payload.id) {
            return { ...qcCase, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return qcCase;
        }),
      };
    }

    case ACTIONS.REMOVE_QC_CASE: {
      if (!action.payload) {
        warn(QC_CONTEXT_NAME, 'REMOVE_QC_CASE called with invalid payload');
        return state;
      }
      return {
        ...state,
        qcCases: state.qcCases.filter((qcCase) => qcCase && qcCase.id !== action.payload),
      };
    }

    case ACTIONS.SET_QC_CASES: {
      const qcCases = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        qcCases,
      };
    }

    case ACTIONS.SET_CHECKLIST_TEMPLATES: {
      const checklistTemplates = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        checklistTemplates,
      };
    }

    case ACTIONS.ADD_CHECKLIST_TEMPLATE: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(QC_CONTEXT_NAME, 'ADD_CHECKLIST_TEMPLATE called with invalid payload');
        return state;
      }
      return {
        ...state,
        checklistTemplates: [...state.checklistTemplates, action.payload],
      };
    }

    case ACTIONS.UPDATE_CHECKLIST_TEMPLATE: {
      if (!action.payload || !action.payload.id) {
        warn(QC_CONTEXT_NAME, 'UPDATE_CHECKLIST_TEMPLATE called with invalid payload');
        return state;
      }
      return {
        ...state,
        checklistTemplates: state.checklistTemplates.map((template) => {
          if (template && template.id === action.payload.id) {
            return {
              ...template,
              ...action.payload.updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return template;
        }),
      };
    }

    case ACTIONS.SET_SAMPLING_CONFIGS: {
      const samplingConfigs = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        samplingConfigs,
      };
    }

    case ACTIONS.ADD_SAMPLING_CONFIG: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(QC_CONTEXT_NAME, 'ADD_SAMPLING_CONFIG called with invalid payload');
        return state;
      }
      return {
        ...state,
        samplingConfigs: [...state.samplingConfigs, action.payload],
      };
    }

    case ACTIONS.UPDATE_SAMPLING_CONFIG: {
      if (!action.payload || !action.payload.id) {
        warn(QC_CONTEXT_NAME, 'UPDATE_SAMPLING_CONFIG called with invalid payload');
        return state;
      }
      return {
        ...state,
        samplingConfigs: state.samplingConfigs.map((config) => {
          if (config && config.id === action.payload.id) {
            return {
              ...config,
              ...action.payload.updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return config;
        }),
      };
    }

    case ACTIONS.REMOVE_SAMPLING_CONFIG: {
      if (!action.payload) {
        warn(QC_CONTEXT_NAME, 'REMOVE_SAMPLING_CONFIG called with invalid payload');
        return state;
      }
      return {
        ...state,
        samplingConfigs: state.samplingConfigs.filter(
          (config) => config && config.id !== action.payload,
        ),
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
      warn(QC_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = (prefix = 'QC') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

const generateChecklistItemId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `CLI-${timestamp}-${randomPart}`;
};

const VALID_METHODOLOGIES = ['random', 'risk_based', 'targeted', 'threshold'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_QC_STATUSES = ['pending', 'in_review', 'completed', 'escalated'];
const VALID_CHECKLIST_RESPONSES = ['pass', 'fail', 'na'];

const randomSample = (loans, config) => {
  if (!Array.isArray(loans) || loans.length === 0) {
    return [];
  }

  let eligibleLoans = [...loans];

  if (config.filters) {
    if (Array.isArray(config.filters.productTypes) && config.filters.productTypes.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.productTypes.includes(loan.productType),
      );
    }
    if (Array.isArray(config.filters.channels) && config.filters.channels.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.channels.includes(loan.channel),
      );
    }
    if (Array.isArray(config.filters.sellerIds) && config.filters.sellerIds.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.sellerIds.includes(loan.sellerId),
      );
    }
    if (config.filters.minLoanAmount !== undefined && config.filters.minLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount >= config.filters.minLoanAmount,
      );
    }
    if (config.filters.maxLoanAmount !== undefined && config.filters.maxLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount <= config.filters.maxLoanAmount,
      );
    }
  }

  if (eligibleLoans.length === 0) {
    return [];
  }

  const sampleRate = config.sampleRate || 10;
  const sampleSize = Math.max(1, Math.ceil((eligibleLoans.length * sampleRate) / 100));

  const shuffled = [...eligibleLoans].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, sampleSize).map((loan) => loan.id);
};

const riskBasedSample = (loans, config) => {
  if (!Array.isArray(loans) || loans.length === 0) {
    return [];
  }

  let eligibleLoans = [...loans];

  if (config.filters) {
    if (Array.isArray(config.filters.productTypes) && config.filters.productTypes.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.productTypes.includes(loan.productType),
      );
    }
    if (Array.isArray(config.filters.channels) && config.filters.channels.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.channels.includes(loan.channel),
      );
    }
    if (Array.isArray(config.filters.sellerIds) && config.filters.sellerIds.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.sellerIds.includes(loan.sellerId),
      );
    }
    if (config.filters.minLoanAmount !== undefined && config.filters.minLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount >= config.filters.minLoanAmount,
      );
    }
    if (config.filters.maxLoanAmount !== undefined && config.filters.maxLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount <= config.filters.maxLoanAmount,
      );
    }
  }

  if (eligibleLoans.length === 0) {
    return [];
  }

  const riskCriteria = Array.isArray(config.riskCriteria) ? config.riskCriteria : [];

  const scoredLoans = eligibleLoans.map((loan) => {
    let riskScore = 0;

    for (const criterion of riskCriteria) {
      if (!criterion || !criterion.field) continue;

      const fieldValue = loan[criterion.field];

      if (fieldValue === undefined || fieldValue === null) continue;

      const weight = criterion.weight || 0;

      switch (criterion.operator) {
        case 'lt':
          if (fieldValue < criterion.value) riskScore += weight;
          break;
        case 'gt':
          if (fieldValue > criterion.value) riskScore += weight;
          break;
        case 'lte':
          if (fieldValue <= criterion.value) riskScore += weight;
          break;
        case 'gte':
          if (fieldValue >= criterion.value) riskScore += weight;
          break;
        case 'eq':
          if (fieldValue === criterion.value) riskScore += weight;
          break;
        case 'neq':
          if (fieldValue !== criterion.value) riskScore += weight;
          break;
        default:
          break;
      }
    }

    return { loan, riskScore };
  });

  scoredLoans.sort((a, b) => b.riskScore - a.riskScore);

  const sampleRate = config.sampleRate || 10;
  const sampleSize = Math.max(1, Math.ceil((scoredLoans.length * sampleRate) / 100));

  return scoredLoans.slice(0, sampleSize).map((item) => item.loan.id);
};

const targetedSample = (loans, config) => {
  if (!Array.isArray(loans) || loans.length === 0) {
    return [];
  }

  let eligibleLoans = [...loans];

  if (config.filters) {
    if (Array.isArray(config.filters.productTypes) && config.filters.productTypes.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.productTypes.includes(loan.productType),
      );
    }
    if (Array.isArray(config.filters.channels) && config.filters.channels.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.channels.includes(loan.channel),
      );
    }
    if (Array.isArray(config.filters.sellerIds) && config.filters.sellerIds.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.sellerIds.includes(loan.sellerId),
      );
    }
    if (config.filters.minLoanAmount !== undefined && config.filters.minLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount >= config.filters.minLoanAmount,
      );
    }
    if (config.filters.maxLoanAmount !== undefined && config.filters.maxLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount <= config.filters.maxLoanAmount,
      );
    }
  }

  if (eligibleLoans.length === 0) {
    return [];
  }

  const sampleRate = config.sampleRate || 10;
  const sampleSize = Math.max(1, Math.ceil((eligibleLoans.length * sampleRate) / 100));

  return eligibleLoans.slice(0, sampleSize).map((loan) => loan.id);
};

const thresholdSample = (loans, config) => {
  if (!Array.isArray(loans) || loans.length === 0) {
    return [];
  }

  let eligibleLoans = [...loans];

  if (config.filters) {
    if (Array.isArray(config.filters.productTypes) && config.filters.productTypes.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.productTypes.includes(loan.productType),
      );
    }
    if (Array.isArray(config.filters.channels) && config.filters.channels.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.channels.includes(loan.channel),
      );
    }
    if (Array.isArray(config.filters.sellerIds) && config.filters.sellerIds.length > 0) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && config.filters.sellerIds.includes(loan.sellerId),
      );
    }
    if (config.filters.minLoanAmount !== undefined && config.filters.minLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount >= config.filters.minLoanAmount,
      );
    }
    if (config.filters.maxLoanAmount !== undefined && config.filters.maxLoanAmount !== null) {
      eligibleLoans = eligibleLoans.filter(
        (loan) => loan && loan.loanAmount <= config.filters.maxLoanAmount,
      );
    }
  }

  if (eligibleLoans.length === 0) {
    return [];
  }

  const thresholdRules = Array.isArray(config.thresholdRules) ? config.thresholdRules : [];

  if (thresholdRules.length === 0) {
    return [];
  }

  const matchedLoans = eligibleLoans.filter((loan) => {
    for (const rule of thresholdRules) {
      if (!rule || !rule.field) continue;

      const fieldValue = loan[rule.field];

      if (fieldValue === undefined || fieldValue === null) continue;

      switch (rule.operator) {
        case 'lt':
          if (fieldValue < rule.value) return true;
          break;
        case 'gt':
          if (fieldValue > rule.value) return true;
          break;
        case 'lte':
          if (fieldValue <= rule.value) return true;
          break;
        case 'gte':
          if (fieldValue >= rule.value) return true;
          break;
        case 'eq':
          if (fieldValue === rule.value) return true;
          break;
        case 'neq':
          if (fieldValue !== rule.value) return true;
          break;
        default:
          break;
      }
    }
    return false;
  });

  return matchedLoans.map((loan) => loan.id);
};

const SAMPLING_STRATEGIES = {
  random: randomSample,
  risk_based: riskBasedSample,
  targeted: targetedSample,
  threshold: thresholdSample,
};

const buildChecklistFromTemplate = (template, caseId) => {
  if (!template || !Array.isArray(template.items)) {
    return [];
  }

  return template.items.map((item) => ({
    id: generateChecklistItemId(),
    templateItemId: item.id || null,
    category: item.category || '',
    question: item.question || '',
    response: null,
    notes: null,
    evidenceAttached: false,
  }));
};

const determinePriority = (methodology, loan) => {
  if (methodology === 'risk_based' || methodology === 'threshold') {
    return 'high';
  }

  if (methodology === 'targeted') {
    return 'medium';
  }

  const roll = Math.random();
  if (roll < 0.25) return 'high';
  if (roll < 0.65) return 'medium';
  return 'low';
};

const calculateDueDate = (priority) => {
  const now = new Date();
  let daysToAdd;

  switch (priority) {
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

export const QCProvider = ({ children }) => {
  const [state, dispatch] = useReducer(qcReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const qcCases = readCollection(STORAGE_KEY_QC_CASES);
      const checklistTemplates = readCollection(STORAGE_KEY_CHECKLIST_TEMPLATES);
      const samplingConfigs = readCollection(STORAGE_KEY_SAMPLING_CONFIGS);

      dispatch({
        type: ACTIONS.HYDRATE,
        payload: { qcCases, checklistTemplates, samplingConfigs },
      });

      info(QC_CONTEXT_NAME, 'QC data hydrated from localStorage', {
        qcCaseCount: qcCases.length,
        templateCount: checklistTemplates.length,
        configCount: samplingConfigs.length,
      });
    } catch (err) {
      error(QC_CONTEXT_NAME, 'Failed to hydrate QC data from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY_QC_CASES, state.qcCases);
    } catch (err) {
      error(QC_CONTEXT_NAME, 'Failed to persist QC cases to localStorage', err);
    }
  }, [state.qcCases]);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY_CHECKLIST_TEMPLATES, state.checklistTemplates);
    } catch (err) {
      error(QC_CONTEXT_NAME, 'Failed to persist checklist templates to localStorage', err);
    }
  }, [state.checklistTemplates]);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY_SAMPLING_CONFIGS, state.samplingConfigs);
    } catch (err) {
      error(QC_CONTEXT_NAME, 'Failed to persist sampling configs to localStorage', err);
    }
  }, [state.samplingConfigs]);

  const getQCCaseById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.qcCases.find((qcCase) => qcCase && qcCase.id === id) || null;
    },
    [state.qcCases],
  );

  const getQCCasesByLoan = useCallback(
    (loanId) => {
      if (!loanId || typeof loanId !== 'string') {
        return [];
      }
      return state.qcCases.filter((qcCase) => qcCase && qcCase.loanId === loanId);
    },
    [state.qcCases],
  );

  const getQCCasesByStatus = useCallback(
    (status) => {
      if (!status || typeof status !== 'string') {
        return [];
      }
      return state.qcCases.filter((qcCase) => qcCase && qcCase.status === status);
    },
    [state.qcCases],
  );

  const getQueueForReviewer = useCallback(
    (reviewerId) => {
      if (!reviewerId || typeof reviewerId !== 'string') {
        return [];
      }

      const queue = state.qcCases.filter(
        (qcCase) =>
          qcCase &&
          (qcCase.reviewerId === reviewerId || qcCase.reviewerId === null) &&
          qcCase.status !== 'completed',
      );

      const priorityOrder = { high: 0, medium: 1, low: 2 };

      queue.sort((a, b) => {
        const priorityDiff =
          (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
        if (priorityDiff !== 0) return priorityDiff;

        const aDueDate = a.dueDate ? new Date(a.dueDate) : new Date(9999, 0, 1);
        const bDueDate = b.dueDate ? new Date(b.dueDate) : new Date(9999, 0, 1);
        return aDueDate - bDueDate;
      });

      return queue;
    },
    [state.qcCases],
  );

  const runSampling = useCallback(
    (config, loans) => {
      if (!config || typeof config !== 'object') {
        warn(QC_CONTEXT_NAME, 'runSampling called with invalid config');
        return [];
      }

      if (!config.methodology || !VALID_METHODOLOGIES.includes(config.methodology)) {
        warn(QC_CONTEXT_NAME, 'runSampling called with invalid methodology', {
          methodology: config.methodology,
        });
        return [];
      }

      if (!Array.isArray(loans) || loans.length === 0) {
        debug(QC_CONTEXT_NAME, 'runSampling called with empty loans array');
        return [];
      }

      const strategy = SAMPLING_STRATEGIES[config.methodology];

      if (!strategy) {
        warn(QC_CONTEXT_NAME, 'No sampling strategy found for methodology', {
          methodology: config.methodology,
        });
        return [];
      }

      const selectedLoanIds = strategy(loans, config);

      debug(QC_CONTEXT_NAME, 'Sampling run completed', {
        methodology: config.methodology,
        totalLoans: loans.length,
        selectedCount: selectedLoanIds.length,
      });

      return selectedLoanIds;
    },
    [],
  );

  const createQCCase = useCallback(
    (loanId, methodology, reviewerId = null, checklistTemplate = null) => {
      if (!loanId || typeof loanId !== 'string') {
        warn(QC_CONTEXT_NAME, 'createQCCase called with invalid loanId', { loanId });
        return null;
      }

      if (!methodology || !VALID_METHODOLOGIES.includes(methodology)) {
        warn(QC_CONTEXT_NAME, 'createQCCase called with invalid methodology', { methodology });
        return null;
      }

      const existingCase = state.qcCases.find(
        (qcCase) =>
          qcCase &&
          qcCase.loanId === loanId &&
          qcCase.status !== 'completed',
      );

      if (existingCase) {
        debug(QC_CONTEXT_NAME, 'QC case already exists for loan', { loanId, existingCaseId: existingCase.id });
        return existingCase;
      }

      const priority = determinePriority(methodology, null);
      const dueDate = calculateDueDate(priority);
      const now = new Date().toISOString();

      let checklist = [];

      if (checklistTemplate && Array.isArray(checklistTemplate.items)) {
        checklist = buildChecklistFromTemplate(checklistTemplate, null);
      }

      const newQCCase = {
        id: generateId('QC'),
        loanId,
        reviewerId,
        methodology,
        priority,
        status: 'pending',
        checklist,
        findings: null,
        dueDate,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      dispatch({
        type: ACTIONS.ADD_QC_CASE,
        payload: newQCCase,
      });

      info(QC_CONTEXT_NAME, 'QC case created', {
        qcCaseId: newQCCase.id,
        loanId,
        methodology,
        priority,
      });

      return newQCCase;
    },
    [state.qcCases],
  );

  const updateChecklistItem = useCallback(
    (caseId, itemId, response, notes = null) => {
      if (!caseId || typeof caseId !== 'string') {
        warn(QC_CONTEXT_NAME, 'updateChecklistItem called with invalid caseId', { caseId });
        return false;
      }

      if (!itemId || typeof itemId !== 'string') {
        warn(QC_CONTEXT_NAME, 'updateChecklistItem called with invalid itemId', { itemId });
        return false;
      }

      if (!response || !VALID_CHECKLIST_RESPONSES.includes(response)) {
        warn(QC_CONTEXT_NAME, 'updateChecklistItem called with invalid response', { response });
        return false;
      }

      const qcCase = state.qcCases.find((c) => c && c.id === caseId);

      if (!qcCase) {
        warn(QC_CONTEXT_NAME, 'QC case not found for checklist update', { caseId });
        return false;
      }

      if (qcCase.status === 'completed') {
        warn(QC_CONTEXT_NAME, 'Cannot update checklist on completed QC case', { caseId });
        return false;
      }

      const updatedChecklist = qcCase.checklist.map((item) => {
        if (item && item.id === itemId) {
          return {
            ...item,
            response,
            notes: notes !== null ? notes : item.notes,
          };
        }
        return item;
      });

      const newStatus = qcCase.status === 'pending' ? 'in_review' : qcCase.status;

      dispatch({
        type: ACTIONS.UPDATE_QC_CASE,
        payload: {
          id: caseId,
          updates: {
            checklist: updatedChecklist,
            status: newStatus,
          },
        },
      });

      debug(QC_CONTEXT_NAME, 'Checklist item updated', {
        caseId,
        itemId,
        response,
      });

      return true;
    },
    [state.qcCases],
  );

  const completeReview = useCallback(
    (caseId, findings) => {
      if (!caseId || typeof caseId !== 'string') {
        warn(QC_CONTEXT_NAME, 'completeReview called with invalid caseId', { caseId });
        return null;
      }

      if (!findings || typeof findings !== 'object') {
        warn(QC_CONTEXT_NAME, 'completeReview called with invalid findings');
        return null;
      }

      const qcCase = state.qcCases.find((c) => c && c.id === caseId);

      if (!qcCase) {
        warn(QC_CONTEXT_NAME, 'QC case not found for review completion', { caseId });
        return null;
      }

      if (qcCase.status === 'completed') {
        debug(QC_CONTEXT_NAME, 'QC case already completed', { caseId });
        return qcCase;
      }

      const now = new Date().toISOString();

      const updatedFindings = {
        overallResult: findings.overallResult || 'pass',
        notes: findings.notes || '',
        completedAt: now,
      };

      dispatch({
        type: ACTIONS.UPDATE_QC_CASE,
        payload: {
          id: caseId,
          updates: {
            status: 'completed',
            findings: updatedFindings,
            completedAt: now,
          },
        },
      });

      info(QC_CONTEXT_NAME, 'QC review completed', {
        caseId,
        overallResult: updatedFindings.overallResult,
      });

      const updatedCase = state.qcCases.find((c) => c && c.id === caseId);

      return updatedCase
        ? {
            ...updatedCase,
            status: 'completed',
            findings: updatedFindings,
            completedAt: now,
          }
        : null;
    },
    [state.qcCases],
  );

  const escalateQCCase = useCallback(
    (caseId, reason = '') => {
      if (!caseId || typeof caseId !== 'string') {
        warn(QC_CONTEXT_NAME, 'escalateQCCase called with invalid caseId', { caseId });
        return false;
      }

      const qcCase = state.qcCases.find((c) => c && c.id === caseId);

      if (!qcCase) {
        warn(QC_CONTEXT_NAME, 'QC case not found for escalation', { caseId });
        return false;
      }

      if (qcCase.status === 'escalated') {
        debug(QC_CONTEXT_NAME, 'QC case already escalated', { caseId });
        return true;
      }

      dispatch({
        type: ACTIONS.UPDATE_QC_CASE,
        payload: {
          id: caseId,
          updates: {
            status: 'escalated',
            priority: 'high',
          },
        },
      });

      info(QC_CONTEXT_NAME, 'QC case escalated', { caseId, reason });

      return true;
    },
    [state.qcCases],
  );

  const assignReviewer = useCallback(
    (caseId, reviewerId) => {
      if (!caseId || typeof caseId !== 'string') {
        warn(QC_CONTEXT_NAME, 'assignReviewer called with invalid caseId', { caseId });
        return false;
      }

      if (!reviewerId || typeof reviewerId !== 'string') {
        warn(QC_CONTEXT_NAME, 'assignReviewer called with invalid reviewerId', { reviewerId });
        return false;
      }

      const qcCase = state.qcCases.find((c) => c && c.id === caseId);

      if (!qcCase) {
        warn(QC_CONTEXT_NAME, 'QC case not found for reviewer assignment', { caseId });
        return false;
      }

      dispatch({
        type: ACTIONS.UPDATE_QC_CASE,
        payload: {
          id: caseId,
          updates: {
            reviewerId,
            status: qcCase.status === 'pending' ? 'in_review' : qcCase.status,
          },
        },
      });

      debug(QC_CONTEXT_NAME, 'Reviewer assigned to QC case', { caseId, reviewerId });

      return true;
    },
    [state.qcCases],
  );

  const getChecklistTemplates = useCallback(() => {
    return state.checklistTemplates;
  }, [state.checklistTemplates]);

  const getChecklistTemplateById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.checklistTemplates.find((t) => t && t.id === id) || null;
    },
    [state.checklistTemplates],
  );

  const getActiveChecklistTemplates = useCallback(() => {
    return state.checklistTemplates.filter((t) => t && t.isActive);
  }, [state.checklistTemplates]);

  const saveChecklistTemplate = useCallback(
    (template) => {
      if (!template || typeof template !== 'object') {
        warn(QC_CONTEXT_NAME, 'saveChecklistTemplate called with invalid template');
        return null;
      }

      if (!template.name || typeof template.name !== 'string') {
        warn(QC_CONTEXT_NAME, 'saveChecklistTemplate called with invalid template name');
        return null;
      }

      const existingTemplate = template.id
        ? state.checklistTemplates.find((t) => t && t.id === template.id)
        : null;

      if (existingTemplate) {
        dispatch({
          type: ACTIONS.UPDATE_CHECKLIST_TEMPLATE,
          payload: {
            id: template.id,
            updates: {
              ...template,
              version: (existingTemplate.version || 1) + 1,
            },
          },
        });

        debug(QC_CONTEXT_NAME, 'Checklist template updated', { templateId: template.id });

        return {
          ...existingTemplate,
          ...template,
          version: (existingTemplate.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        };
      }

      const now = new Date().toISOString();
      const newTemplate = {
        id: generateId('TMPL'),
        name: template.name,
        productTypes: Array.isArray(template.productTypes) ? template.productTypes : [],
        workflowPhase: template.workflowPhase || 'pre_closing',
        items: Array.isArray(template.items) ? template.items : [],
        isActive: template.isActive !== undefined ? template.isActive : true,
        version: 1,
        createdBy: template.createdBy || 'Unknown',
        createdAt: now,
        updatedAt: now,
      };

      dispatch({
        type: ACTIONS.ADD_CHECKLIST_TEMPLATE,
        payload: newTemplate,
      });

      info(QC_CONTEXT_NAME, 'Checklist template created', { templateId: newTemplate.id });

      return newTemplate;
    },
    [state.checklistTemplates],
  );

  const getSamplingConfigs = useCallback(() => {
    return state.samplingConfigs;
  }, [state.samplingConfigs]);

  const getSamplingConfigById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.samplingConfigs.find((c) => c && c.id === id) || null;
    },
    [state.samplingConfigs],
  );

  const saveSamplingConfig = useCallback(
    (config) => {
      if (!config || typeof config !== 'object') {
        warn(QC_CONTEXT_NAME, 'saveSamplingConfig called with invalid config');
        return null;
      }

      if (!config.name || typeof config.name !== 'string') {
        warn(QC_CONTEXT_NAME, 'saveSamplingConfig called with invalid config name');
        return null;
      }

      if (!config.methodology || !VALID_METHODOLOGIES.includes(config.methodology)) {
        warn(QC_CONTEXT_NAME, 'saveSamplingConfig called with invalid methodology', {
          methodology: config.methodology,
        });
        return null;
      }

      const existingConfig = config.id
        ? state.samplingConfigs.find((c) => c && c.id === config.id)
        : null;

      if (existingConfig) {
        dispatch({
          type: ACTIONS.UPDATE_SAMPLING_CONFIG,
          payload: {
            id: config.id,
            updates: config,
          },
        });

        debug(QC_CONTEXT_NAME, 'Sampling config updated', { configId: config.id });

        return {
          ...existingConfig,
          ...config,
          updatedAt: new Date().toISOString(),
        };
      }

      const now = new Date().toISOString();
      const newConfig = {
        id: generateId('SMPL'),
        name: config.name,
        methodology: config.methodology,
        sampleRate: config.sampleRate || 10,
        filters: config.filters || {},
        riskCriteria: Array.isArray(config.riskCriteria) ? config.riskCriteria : null,
        thresholdRules: Array.isArray(config.thresholdRules) ? config.thresholdRules : null,
        isActive: config.isActive !== undefined ? config.isActive : true,
        createdAt: now,
        updatedAt: now,
      };

      dispatch({
        type: ACTIONS.ADD_SAMPLING_CONFIG,
        payload: newConfig,
      });

      info(QC_CONTEXT_NAME, 'Sampling config created', { configId: newConfig.id });

      return newConfig;
    },
    [state.samplingConfigs],
  );

  const deleteSamplingConfig = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(QC_CONTEXT_NAME, 'deleteSamplingConfig called with invalid id', { id });
        return false;
      }

      const existingConfig = state.samplingConfigs.find((c) => c && c.id === id);

      if (!existingConfig) {
        warn(QC_CONTEXT_NAME, 'Sampling config not found for deletion', { id });
        return false;
      }

      dispatch({
        type: ACTIONS.REMOVE_SAMPLING_CONFIG,
        payload: id,
      });

      debug(QC_CONTEXT_NAME, 'Sampling config deleted', { configId: id });

      return true;
    },
    [state.samplingConfigs],
  );

  const paginateQCCases = useCallback(
    (page = 1, pageSize = 25, filters = {}) => {
      if (page < 1) {
        page = 1;
      }

      if (![10, 25, 50, 100].includes(pageSize)) {
        pageSize = 25;
      }

      let filtered = [...state.qcCases];

      if (filters.status && typeof filters.status === 'string') {
        filtered = filtered.filter((qcCase) => qcCase && qcCase.status === filters.status);
      }

      if (filters.methodology && typeof filters.methodology === 'string') {
        filtered = filtered.filter(
          (qcCase) => qcCase && qcCase.methodology === filters.methodology,
        );
      }

      if (filters.priority && typeof filters.priority === 'string') {
        filtered = filtered.filter((qcCase) => qcCase && qcCase.priority === filters.priority);
      }

      if (filters.reviewerId && typeof filters.reviewerId === 'string') {
        filtered = filtered.filter(
          (qcCase) => qcCase && qcCase.reviewerId === filters.reviewerId,
        );
      }

      if (filters.loanId && typeof filters.loanId === 'string') {
        filtered = filtered.filter((qcCase) => qcCase && qcCase.loanId === filters.loanId);
      }

      if (filters.search && typeof filters.search === 'string') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((qcCase) => {
          if (!qcCase) return false;
          return (
            (qcCase.id && qcCase.id.toLowerCase().includes(searchLower)) ||
            (qcCase.loanId && qcCase.loanId.toLowerCase().includes(searchLower)) ||
            (qcCase.reviewerId && qcCase.reviewerId.toLowerCase().includes(searchLower))
          );
        });
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
    [state.qcCases],
  );

  const getQCStats = useCallback(() => {
    const stats = {
      total: state.qcCases.length,
      pending: 0,
      inReview: 0,
      completed: 0,
      escalated: 0,
      byMethodology: {},
      byPriority: {},
      passRate: 0,
      failRate: 0,
    };

    let completedWithFindings = 0;

    for (const qcCase of state.qcCases) {
      if (!qcCase) continue;

      switch (qcCase.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'in_review':
          stats.inReview++;
          break;
        case 'completed':
          stats.completed++;
          if (qcCase.findings) {
            completedWithFindings++;
            if (qcCase.findings.overallResult === 'pass') {
              stats.passRate++;
            } else if (
              qcCase.findings.overallResult === 'fail' ||
              qcCase.findings.overallResult === 'conditional_pass'
            ) {
              stats.failRate++;
            }
          }
          break;
        case 'escalated':
          stats.escalated++;
          break;
        default:
          break;
      }

      if (qcCase.methodology) {
        stats.byMethodology[qcCase.methodology] =
          (stats.byMethodology[qcCase.methodology] || 0) + 1;
      }

      if (qcCase.priority) {
        stats.byPriority[qcCase.priority] =
          (stats.byPriority[qcCase.priority] || 0) + 1;
      }
    }

    if (completedWithFindings > 0) {
      stats.passRate = Math.round((stats.passRate / completedWithFindings) * 100);
      stats.failRate = Math.round((stats.failRate / completedWithFindings) * 100);
    }

    return stats;
  }, [state.qcCases]);

  const refreshQCData = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const qcCases = readCollection(STORAGE_KEY_QC_CASES);
      const checklistTemplates = readCollection(STORAGE_KEY_CHECKLIST_TEMPLATES);
      const samplingConfigs = readCollection(STORAGE_KEY_SAMPLING_CONFIGS);

      dispatch({
        type: ACTIONS.SET_QC_CASES,
        payload: qcCases,
      });

      dispatch({
        type: ACTIONS.SET_CHECKLIST_TEMPLATES,
        payload: checklistTemplates,
      });

      dispatch({
        type: ACTIONS.SET_SAMPLING_CONFIGS,
        payload: samplingConfigs,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(QC_CONTEXT_NAME, 'QC data refreshed from localStorage', {
        qcCaseCount: qcCases.length,
        templateCount: checklistTemplates.length,
        configCount: samplingConfigs.length,
      });

      return true;
    } catch (err) {
      error(QC_CONTEXT_NAME, 'Failed to refresh QC data', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const value = {
    qcCases: state.qcCases,
    checklistTemplates: state.checklistTemplates,
    samplingConfigs: state.samplingConfigs,
    isLoading: state.isLoading,
    error: state.error,
    getQCCaseById,
    getQCCasesByLoan,
    getQCCasesByStatus,
    getQueueForReviewer,
    runSampling,
    createQCCase,
    updateChecklistItem,
    completeReview,
    escalateQCCase,
    assignReviewer,
    getChecklistTemplates,
    getChecklistTemplateById,
    getActiveChecklistTemplates,
    saveChecklistTemplate,
    getSamplingConfigs,
    getSamplingConfigById,
    saveSamplingConfig,
    deleteSamplingConfig,
    paginateQCCases,
    getQCStats,
    refreshQCData,
  };

  return <QCContext.Provider value={value}>{children}</QCContext.Provider>;
};

QCProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useQC = () => {
  const context = useContext(QCContext);

  if (!context) {
    throw new Error('useQC must be used within a QCProvider');
  }

  return context;
};

export default QCContext;