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

const OversightContext = createContext(null);

const OVERSIGHT_CONTEXT_NAME = 'OversightContext';

const STORAGE_KEY = 'maqcrp_oversight';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  CREATE_ALERT_RULE: 'CREATE_ALERT_RULE',
  UPDATE_ALERT_RULE: 'UPDATE_ALERT_RULE',
  DELETE_ALERT_RULE: 'DELETE_ALERT_RULE',
  TOGGLE_ALERT_RULE: 'TOGGLE_ALERT_RULE',
  ADD_TO_WATCHLIST: 'ADD_TO_WATCHLIST',
  REMOVE_FROM_WATCHLIST: 'REMOVE_FROM_WATCHLIST',
  CREATE_ACTION_PLAN: 'CREATE_ACTION_PLAN',
  UPDATE_ACTION_PLAN: 'UPDATE_ACTION_PLAN',
  COMPLETE_ACTION_PLAN: 'COMPLETE_ACTION_PLAN',
  RECALCULATE_RISK_TIERS: 'RECALCULATE_RISK_TIERS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  alertRules: [],
  watchlist: [],
  actionPlans: [],
  riskTierCache: {},
  isLoading: true,
  error: null,
};

const oversightReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const alertRules = Array.isArray(action.payload.alertRules) ? action.payload.alertRules : [];
      const watchlist = Array.isArray(action.payload.watchlist) ? action.payload.watchlist : [];
      const actionPlans = Array.isArray(action.payload.actionPlans) ? action.payload.actionPlans : [];
      const riskTierCache = action.payload.riskTierCache && typeof action.payload.riskTierCache === 'object'
        ? action.payload.riskTierCache
        : {};
      return {
        ...state,
        alertRules,
        watchlist,
        actionPlans,
        riskTierCache,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.CREATE_ALERT_RULE: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'CREATE_ALERT_RULE called with invalid payload');
        return state;
      }
      return {
        ...state,
        alertRules: [...state.alertRules, action.payload],
      };
    }

    case ACTIONS.UPDATE_ALERT_RULE: {
      if (!action.payload || !action.payload.id) {
        warn(OVERSIGHT_CONTEXT_NAME, 'UPDATE_ALERT_RULE called with invalid payload');
        return state;
      }
      return {
        ...state,
        alertRules: state.alertRules.map((rule) => {
          if (rule && rule.id === action.payload.id) {
            return { ...rule, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return rule;
        }),
      };
    }

    case ACTIONS.DELETE_ALERT_RULE: {
      if (!action.payload) {
        warn(OVERSIGHT_CONTEXT_NAME, 'DELETE_ALERT_RULE called with invalid payload');
        return state;
      }
      return {
        ...state,
        alertRules: state.alertRules.filter((rule) => rule && rule.id !== action.payload),
      };
    }

    case ACTIONS.TOGGLE_ALERT_RULE: {
      if (!action.payload) {
        warn(OVERSIGHT_CONTEXT_NAME, 'TOGGLE_ALERT_RULE called with invalid payload');
        return state;
      }
      return {
        ...state,
        alertRules: state.alertRules.map((rule) => {
          if (rule && rule.id === action.payload) {
            return { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() };
          }
          return rule;
        }),
      };
    }

    case ACTIONS.ADD_TO_WATCHLIST: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'ADD_TO_WATCHLIST called with invalid payload');
        return state;
      }
      return {
        ...state,
        watchlist: [...state.watchlist, action.payload],
      };
    }

    case ACTIONS.REMOVE_FROM_WATCHLIST: {
      if (!action.payload) {
        warn(OVERSIGHT_CONTEXT_NAME, 'REMOVE_FROM_WATCHLIST called with invalid payload');
        return state;
      }
      return {
        ...state,
        watchlist: state.watchlist.filter((entry) => entry && entry.id !== action.payload),
      };
    }

    case ACTIONS.CREATE_ACTION_PLAN: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'CREATE_ACTION_PLAN called with invalid payload');
        return state;
      }
      return {
        ...state,
        actionPlans: [...state.actionPlans, action.payload],
      };
    }

    case ACTIONS.UPDATE_ACTION_PLAN: {
      if (!action.payload || !action.payload.id) {
        warn(OVERSIGHT_CONTEXT_NAME, 'UPDATE_ACTION_PLAN called with invalid payload');
        return state;
      }
      return {
        ...state,
        actionPlans: state.actionPlans.map((plan) => {
          if (plan && plan.id === action.payload.id) {
            return { ...plan, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return plan;
        }),
      };
    }

    case ACTIONS.COMPLETE_ACTION_PLAN: {
      if (!action.payload) {
        warn(OVERSIGHT_CONTEXT_NAME, 'COMPLETE_ACTION_PLAN called with invalid payload');
        return state;
      }
      return {
        ...state,
        actionPlans: state.actionPlans.map((plan) => {
          if (plan && plan.id === action.payload) {
            return {
              ...plan,
              status: 'completed',
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          return plan;
        }),
      };
    }

    case ACTIONS.RECALCULATE_RISK_TIERS: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'RECALCULATE_RISK_TIERS called with invalid payload');
        return state;
      }
      return {
        ...state,
        riskTierCache: {
          ...state.riskTierCache,
          ...action.payload,
        },
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
      warn(OVERSIGHT_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = (prefix = 'OVS') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

const VALID_METRICS = [
  'defectRate',
  'criticalDefectRate',
  'avgRemedyResponseDays',
  'totalExposure',
  'slaBreachRate',
  'passRate',
  'openRemedyCases',
  'openRepurchaseCases',
];

const VALID_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];

const VALID_SEVERITIES = ['info', 'warning', 'high', 'critical'];

const VALID_WATCHLIST_STATUSES = ['active', 'monitoring', 'cleared'];

const VALID_ACTION_PLAN_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

const VALID_ACTION_PLAN_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const validateAlertRule = (ruleData) => {
  const errors = [];

  if (!ruleData || typeof ruleData !== 'object') {
    errors.push({
      field: 'rule',
      code: 'INVALID_INPUT',
      message: 'Alert rule data must be an object.',
    });
    return { valid: false, errors };
  }

  if (!ruleData.name || typeof ruleData.name !== 'string' || ruleData.name.trim() === '') {
    errors.push({
      field: 'name',
      code: 'REQUIRED',
      message: 'Alert rule name is required.',
    });
  }

  if (!ruleData.metric || !VALID_METRICS.includes(ruleData.metric)) {
    errors.push({
      field: 'metric',
      code: 'REQUIRED',
      message: `Metric must be one of: ${VALID_METRICS.join(', ')}.`,
    });
  }

  if (!ruleData.operator || !VALID_OPERATORS.includes(ruleData.operator)) {
    errors.push({
      field: 'operator',
      code: 'REQUIRED',
      message: `Operator must be one of: ${VALID_OPERATORS.join(', ')}.`,
    });
  }

  if (ruleData.value === undefined || ruleData.value === null) {
    errors.push({
      field: 'value',
      code: 'REQUIRED',
      message: 'Threshold value is required.',
    });
  } else if (typeof ruleData.value !== 'number' || isNaN(ruleData.value)) {
    errors.push({
      field: 'value',
      code: 'INVALID_TYPE',
      message: 'Threshold value must be a number.',
    });
  }

  if (ruleData.severity && !VALID_SEVERITIES.includes(ruleData.severity)) {
    errors.push({
      field: 'severity',
      code: 'INVALID_VALUE',
      message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}.`,
    });
  }

  return { valid: errors.length === 0, errors };
};

const validateWatchlistEntry = (entryData) => {
  const errors = [];

  if (!entryData || typeof entryData !== 'object') {
    errors.push({
      field: 'entry',
      code: 'INVALID_INPUT',
      message: 'Watchlist entry data must be an object.',
    });
    return { valid: false, errors };
  }

  if (!entryData.counterpartyId || typeof entryData.counterpartyId !== 'string') {
    errors.push({
      field: 'counterpartyId',
      code: 'REQUIRED',
      message: 'Counterparty ID is required.',
    });
  }

  if (!entryData.counterpartyName || typeof entryData.counterpartyName !== 'string') {
    errors.push({
      field: 'counterpartyName',
      code: 'REQUIRED',
      message: 'Counterparty name is required.',
    });
  }

  if (!entryData.reason || typeof entryData.reason !== 'string' || entryData.reason.trim() === '') {
    errors.push({
      field: 'reason',
      code: 'REQUIRED',
      message: 'Reason for watchlist addition is required.',
    });
  }

  return { valid: errors.length === 0, errors };
};

const validateActionPlan = (planData) => {
  const errors = [];

  if (!planData || typeof planData !== 'object') {
    errors.push({
      field: 'plan',
      code: 'INVALID_INPUT',
      message: 'Action plan data must be an object.',
    });
    return { valid: false, errors };
  }

  if (!planData.title || typeof planData.title !== 'string' || planData.title.trim() === '') {
    errors.push({
      field: 'title',
      code: 'REQUIRED',
      message: 'Action plan title is required.',
    });
  }

  if (!planData.counterpartyId || typeof planData.counterpartyId !== 'string') {
    errors.push({
      field: 'counterpartyId',
      code: 'REQUIRED',
      message: 'Counterparty ID is required.',
    });
  }

  if (planData.priority && !VALID_ACTION_PLAN_PRIORITIES.includes(planData.priority)) {
    errors.push({
      field: 'priority',
      code: 'INVALID_VALUE',
      message: `Priority must be one of: ${VALID_ACTION_PLAN_PRIORITIES.join(', ')}.`,
    });
  }

  if (!planData.description || typeof planData.description !== 'string' || planData.description.trim() === '') {
    errors.push({
      field: 'description',
      code: 'REQUIRED',
      message: 'Description is required.',
    });
  }

  return { valid: errors.length === 0, errors };
};

const evaluateThreshold = (actualValue, operator, thresholdValue) => {
  if (actualValue === null || actualValue === undefined || isNaN(actualValue)) {
    return false;
  }

  switch (operator) {
    case 'gt':
      return actualValue > thresholdValue;
    case 'gte':
      return actualValue >= thresholdValue;
    case 'lt':
      return actualValue < thresholdValue;
    case 'lte':
      return actualValue <= thresholdValue;
    case 'eq':
      return actualValue === thresholdValue;
    case 'neq':
      return actualValue !== thresholdValue;
    default:
      return false;
  }
};

const normalizeDefectRate = (rate) => {
  if (rate === null || rate === undefined || isNaN(rate)) return 0;
  if (rate < 0) return 0;
  if (rate > 1) return 100;
  return Math.min(100, Math.round((rate / 0.1) * 100));
};

const normalizeCriticalDefectRate = (rate) => {
  if (rate === null || rate === undefined || isNaN(rate)) return 0;
  if (rate < 0) return 0;
  if (rate > 0.05) return 100;
  return Math.min(100, Math.round((rate / 0.05) * 100));
};

const normalizeResponseTime = (days) => {
  if (days === null || days === undefined || isNaN(days)) return 0;
  if (days < 0) return 0;
  if (days > 30) return 100;
  return Math.min(100, Math.round((days / 30) * 100));
};

const normalizeExposure = (exposure) => {
  if (exposure === null || exposure === undefined || isNaN(exposure)) return 0;
  if (exposure < 0) return 0;
  if (exposure > 10000000) return 100;
  return Math.min(100, Math.round((exposure / 10000000) * 100));
};

const normalizeTrend = (trends) => {
  if (!trends || !trends.defectRateTrend) return 50;
  switch (trends.defectRateTrend) {
    case 'improving':
      return Math.max(0, 50 - Math.abs(trends.defectRateChange || 0) * 1000);
    case 'worsening':
      return Math.min(100, 50 + Math.abs(trends.defectRateChange || 0) * 1000);
    case 'stable':
      return 50;
    default:
      return 50;
  }
};

const DEFAULT_RISK_TIER_CONFIG = {
  tiers: [
    { name: 'low', minScore: 0, maxScore: 33, color: '#22c55e' },
    { name: 'medium', minScore: 34, maxScore: 66, color: '#eab308' },
    { name: 'high', minScore: 67, maxScore: 100, color: '#ef4444' },
  ],
  scoringWeights: {
    defectRate: 0.35,
    responseTime: 0.25,
    exposure: 0.25,
    trendDirection: 0.15,
  },
};

const calculateRiskTier = (metrics, trends, config = DEFAULT_RISK_TIER_CONFIG) => {
  if (!metrics || typeof metrics !== 'object') {
    return { current: 'unknown', previous: 'unknown', score: 0, factors: [] };
  }

  const defectScore = normalizeDefectRate(metrics.defectRate);
  const criticalDefectScore = normalizeCriticalDefectRate(metrics.criticalDefectRate);
  const responseScore = normalizeResponseTime(metrics.avgRemedyResponseDays);
  const exposureScore = normalizeExposure(metrics.totalExposure);
  const trendScore = normalizeTrend(trends);

  const scoreMap = {
    defectRate: defectScore,
    criticalDefectRate: criticalDefectScore,
    responseTime: responseScore,
    exposure: exposureScore,
    trendDirection: trendScore,
  };

  let weightedScore = 0;
  const factors = [];

  for (const [metricName, weight] of Object.entries(config.scoringWeights)) {
    const rawScore = scoreMap[metricName] || 0;
    const contribution = rawScore * weight;
    weightedScore += contribution;
    factors.push({
      name: metricName,
      weight,
      score: rawScore,
      contribution: Math.round(contribution * 100) / 100,
    });
  }

  const roundedScore = Math.round(weightedScore);

  let currentTier = 'low';
  for (const tier of config.tiers) {
    if (roundedScore >= tier.minScore && roundedScore <= tier.maxScore) {
      currentTier = tier.name;
      break;
    }
  }

  return {
    current: currentTier,
    previous: 'unknown',
    score: roundedScore,
    factors,
  };
};

export const OversightProvider = ({ children }) => {
  const [state, dispatch] = useReducer(oversightReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const raw = localStorage.getItem(STORAGE_KEY);
      let parsed = null;

      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (parseErr) {
          warn(OVERSIGHT_CONTEXT_NAME, 'Failed to parse oversight data from localStorage', parseErr);
        }
      }

      const payload = {
        alertRules: (parsed && Array.isArray(parsed.alertRules)) ? parsed.alertRules : [],
        watchlist: (parsed && Array.isArray(parsed.watchlist)) ? parsed.watchlist : [],
        actionPlans: (parsed && Array.isArray(parsed.actionPlans)) ? parsed.actionPlans : [],
        riskTierCache: (parsed && parsed.riskTierCache && typeof parsed.riskTierCache === 'object')
          ? parsed.riskTierCache
          : {},
      };

      dispatch({
        type: ACTIONS.HYDRATE,
        payload,
      });

      info(OVERSIGHT_CONTEXT_NAME, 'Oversight data hydrated from localStorage', {
        alertRuleCount: payload.alertRules.length,
        watchlistCount: payload.watchlist.length,
        actionPlanCount: payload.actionPlans.length,
        cachedTierCount: Object.keys(payload.riskTierCache).length,
      });
    } catch (err) {
      error(OVERSIGHT_CONTEXT_NAME, 'Failed to hydrate oversight data from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      const dataToPersist = {
        alertRules: state.alertRules,
        watchlist: state.watchlist,
        actionPlans: state.actionPlans,
        riskTierCache: state.riskTierCache,
      };

      const jsonString = JSON.stringify(dataToPersist);
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (err) {
      error(OVERSIGHT_CONTEXT_NAME, 'Failed to persist oversight data to localStorage', err);
    }
  }, [state.alertRules, state.watchlist, state.actionPlans, state.riskTierCache]);

  const getAlertRules = useCallback(() => {
    return state.alertRules;
  }, [state.alertRules]);

  const getAlertRuleById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.alertRules.find((rule) => rule && rule.id === id) || null;
    },
    [state.alertRules],
  );

  const getEnabledAlertRules = useCallback(() => {
    return state.alertRules.filter((rule) => rule && rule.enabled);
  }, [state.alertRules]);

  const createAlertRule = useCallback(
    (ruleData) => {
      if (!ruleData || typeof ruleData !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'createAlertRule called with invalid ruleData');
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'rule',
              code: 'INVALID_INPUT',
              message: 'Alert rule data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateAlertRule(ruleData);

      if (!validationResult.valid) {
        debug(OVERSIGHT_CONTEXT_NAME, 'Alert rule validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          rule: null,
          errors: validationResult.errors,
        };
      }

      const now = new Date().toISOString();

      const newRule = {
        id: generateId('ALR'),
        name: ruleData.name,
        description: ruleData.description || '',
        metric: ruleData.metric,
        operator: ruleData.operator,
        value: ruleData.value,
        severity: ruleData.severity || 'warning',
        enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
        counterpartyIds: Array.isArray(ruleData.counterpartyIds) ? ruleData.counterpartyIds : null,
        createdBy: ruleData.createdBy || 'Unknown',
        createdAt: now,
        updatedAt: now,
      };

      dispatch({
        type: ACTIONS.CREATE_ALERT_RULE,
        payload: newRule,
      });

      info(OVERSIGHT_CONTEXT_NAME, 'Alert rule created', {
        ruleId: newRule.id,
        metric: newRule.metric,
        severity: newRule.severity,
      });

      return {
        success: true,
        rule: newRule,
        errors: [],
      };
    },
    [],
  );

  const updateAlertRule = useCallback(
    (id, updates) => {
      if (!id || typeof id !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'updateAlertRule called with invalid id', { id });
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'id',
              code: 'REQUIRED',
              message: 'Alert rule ID is required.',
            },
          ],
        };
      }

      if (!updates || typeof updates !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'updateAlertRule called with invalid updates', {
          id,
          updatesType: typeof updates,
        });
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'updates',
              code: 'INVALID_INPUT',
              message: 'Updates must be an object.',
            },
          ],
        };
      }

      const existingRule = state.alertRules.find((rule) => rule && rule.id === id);

      if (!existingRule) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Alert rule not found for update', { id });
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'id',
              code: 'NOT_FOUND',
              message: `Alert rule with ID "${id}" not found.`,
            },
          ],
        };
      }

      if (updates.metric && !VALID_METRICS.includes(updates.metric)) {
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'metric',
              code: 'INVALID_VALUE',
              message: `Metric must be one of: ${VALID_METRICS.join(', ')}.`,
            },
          ],
        };
      }

      if (updates.operator && !VALID_OPERATORS.includes(updates.operator)) {
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'operator',
              code: 'INVALID_VALUE',
              message: `Operator must be one of: ${VALID_OPERATORS.join(', ')}.`,
            },
          ],
        };
      }

      if (updates.severity && !VALID_SEVERITIES.includes(updates.severity)) {
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'severity',
              code: 'INVALID_VALUE',
              message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}.`,
            },
          ],
        };
      }

      dispatch({
        type: ACTIONS.UPDATE_ALERT_RULE,
        payload: { id, updates },
      });

      const updatedRule = {
        ...existingRule,
        ...updates,
        id: existingRule.id,
        updatedAt: new Date().toISOString(),
      };

      debug(OVERSIGHT_CONTEXT_NAME, 'Alert rule updated', { ruleId: id });

      return {
        success: true,
        rule: updatedRule,
        errors: [],
      };
    },
    [state.alertRules],
  );

  const deleteAlertRule = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'deleteAlertRule called with invalid id', { id });
        return false;
      }

      const existingRule = state.alertRules.find((rule) => rule && rule.id === id);

      if (!existingRule) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Alert rule not found for deletion', { id });
        return false;
      }

      dispatch({
        type: ACTIONS.DELETE_ALERT_RULE,
        payload: id,
      });

      info(OVERSIGHT_CONTEXT_NAME, 'Alert rule deleted', { ruleId: id });

      return true;
    },
    [state.alertRules],
  );

  const toggleAlertRule = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'toggleAlertRule called with invalid id', { id });
        return false;
      }

      const existingRule = state.alertRules.find((rule) => rule && rule.id === id);

      if (!existingRule) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Alert rule not found for toggle', { id });
        return false;
      }

      dispatch({
        type: ACTIONS.TOGGLE_ALERT_RULE,
        payload: id,
      });

      debug(OVERSIGHT_CONTEXT_NAME, 'Alert rule toggled', {
        ruleId: id,
        newEnabledState: !existingRule.enabled,
      });

      return true;
    },
    [state.alertRules],
  );

  const evaluateAlertRules = useCallback(
    (counterpartyMetricsMap) => {
      if (!counterpartyMetricsMap || typeof counterpartyMetricsMap !== 'object') {
        return [];
      }

      const enabledRules = state.alertRules.filter((rule) => rule && rule.enabled);

      if (enabledRules.length === 0) {
        return [];
      }

      const triggeredAlerts = [];

      for (const rule of enabledRules) {
        const targetCounterparties = rule.counterpartyIds && Array.isArray(rule.counterpartyIds)
          ? rule.counterpartyIds
          : Object.keys(counterpartyMetricsMap);

        for (const counterpartyId of targetCounterparties) {
          const metrics = counterpartyMetricsMap[counterpartyId];

          if (!metrics) {
            continue;
          }

          const actualValue = metrics[rule.metric];

          if (actualValue === undefined || actualValue === null) {
            continue;
          }

          const isBreached = evaluateThreshold(actualValue, rule.operator, rule.value);

          if (isBreached) {
            triggeredAlerts.push({
              alertId: generateId('ALT'),
              ruleId: rule.id,
              ruleName: rule.name,
              counterpartyId,
              counterpartyName: metrics.counterpartyName || counterpartyId,
              metric: rule.metric,
              operator: rule.operator,
              configuredValue: rule.value,
              actualValue,
              severity: rule.severity,
              triggeredAt: new Date().toISOString(),
              acknowledged: false,
              acknowledgedBy: null,
              acknowledgedAt: null,
              resolvedAt: null,
            });
          }
        }
      }

      return triggeredAlerts;
    },
    [state.alertRules],
  );

  const getWatchlist = useCallback(() => {
    return state.watchlist;
  }, [state.watchlist]);

  const getWatchlistEntryById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.watchlist.find((entry) => entry && entry.id === id) || null;
    },
    [state.watchlist],
  );

  const getWatchlistByCounterparty = useCallback(
    (counterpartyId) => {
      if (!counterpartyId || typeof counterpartyId !== 'string') {
        return [];
      }
      return state.watchlist.filter((entry) => entry && entry.counterpartyId === counterpartyId);
    },
    [state.watchlist],
  );

  const getActiveWatchlistEntries = useCallback(() => {
    return state.watchlist.filter((entry) => entry && entry.status === 'active');
  }, [state.watchlist]);

  const addToWatchlist = useCallback(
    (entryData) => {
      if (!entryData || typeof entryData !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'addToWatchlist called with invalid entryData');
        return {
          success: false,
          entry: null,
          errors: [
            {
              field: 'entry',
              code: 'INVALID_INPUT',
              message: 'Watchlist entry data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateWatchlistEntry(entryData);

      if (!validationResult.valid) {
        debug(OVERSIGHT_CONTEXT_NAME, 'Watchlist entry validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          entry: null,
          errors: validationResult.errors,
        };
      }

      const existingEntry = state.watchlist.find(
        (entry) =>
          entry &&
          entry.counterpartyId === entryData.counterpartyId &&
          entry.status === 'active',
      );

      if (existingEntry) {
        debug(OVERSIGHT_CONTEXT_NAME, 'Counterparty already on active watchlist', {
          counterpartyId: entryData.counterpartyId,
          existingEntryId: existingEntry.id,
        });
        return {
          success: false,
          entry: null,
          errors: [
            {
              field: 'counterpartyId',
              code: 'DUPLICATE',
              message: `Counterparty "${entryData.counterpartyName}" is already on the active watchlist.`,
            },
          ],
        };
      }

      const now = new Date().toISOString();

      const newEntry = {
        id: generateId('WLE'),
        counterpartyId: entryData.counterpartyId,
        counterpartyName: entryData.counterpartyName,
        reason: entryData.reason,
        status: 'active',
        watchlistScore: entryData.watchlistScore ?? null,
        recommendation: entryData.recommendation || 'manual',
        actionPlanId: entryData.actionPlanId || null,
        monitoringNotes: [],
        addedBy: entryData.addedBy || 'Unknown',
        addedDate: now,
        reviewDate: entryData.reviewDate || null,
        updatedAt: now,
      };

      dispatch({
        type: ACTIONS.ADD_TO_WATCHLIST,
        payload: newEntry,
      });

      info(OVERSIGHT_CONTEXT_NAME, 'Counterparty added to watchlist', {
        entryId: newEntry.id,
        counterpartyId: newEntry.counterpartyId,
        counterpartyName: newEntry.counterpartyName,
      });

      return {
        success: true,
        entry: newEntry,
        errors: [],
      };
    },
    [state.watchlist],
  );

  const removeFromWatchlist = useCallback(
    (id, reason = '', removedBy = 'Unknown') => {
      if (!id || typeof id !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'removeFromWatchlist called with invalid id', { id });
        return false;
      }

      const existingEntry = state.watchlist.find((entry) => entry && entry.id === id);

      if (!existingEntry) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Watchlist entry not found for removal', { id });
        return false;
      }

      dispatch({
        type: ACTIONS.REMOVE_FROM_WATCHLIST,
        payload: id,
      });

      info(OVERSIGHT_CONTEXT_NAME, 'Counterparty removed from watchlist', {
        entryId: id,
        counterpartyId: existingEntry.counterpartyId,
        reason,
        removedBy,
      });

      return true;
    },
    [state.watchlist],
  );

  const addMonitoringNote = useCallback(
    (entryId, content, author) => {
      if (!entryId || typeof entryId !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'addMonitoringNote called with invalid entryId', { entryId });
        return false;
      }

      if (!content || typeof content !== 'string' || content.trim() === '') {
        warn(OVERSIGHT_CONTEXT_NAME, 'addMonitoringNote called with invalid content');
        return false;
      }

      const existingEntry = state.watchlist.find((entry) => entry && entry.id === entryId);

      if (!existingEntry) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Watchlist entry not found for monitoring note', { entryId });
        return false;
      }

      const note = {
        id: generateId('NOTE'),
        content,
        author: author || 'Unknown',
        createdAt: new Date().toISOString(),
      };

      const updatedNotes = [...(existingEntry.monitoringNotes || []), note];

      dispatch({
        type: ACTIONS.UPDATE_ALERT_RULE,
        payload: {
          id: entryId,
          updates: { monitoringNotes: updatedNotes },
        },
      });

      debug(OVERSIGHT_CONTEXT_NAME, 'Monitoring note added to watchlist entry', {
        entryId,
        noteId: note.id,
      });

      return true;
    },
    [state.watchlist],
  );

  const getActionPlans = useCallback(() => {
    return state.actionPlans;
  }, [state.actionPlans]);

  const getActionPlanById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.actionPlans.find((plan) => plan && plan.id === id) || null;
    },
    [state.actionPlans],
  );

  const getActionPlansByCounterparty = useCallback(
    (counterpartyId) => {
      if (!counterpartyId || typeof counterpartyId !== 'string') {
        return [];
      }
      return state.actionPlans.filter((plan) => plan && plan.counterpartyId === counterpartyId);
    },
    [state.actionPlans],
  );

  const getActionPlansByStatus = useCallback(
    (status) => {
      if (!status || typeof status !== 'string') {
        return [];
      }
      return state.actionPlans.filter((plan) => plan && plan.status === status);
    },
    [state.actionPlans],
  );

  const createActionPlan = useCallback(
    (planData) => {
      if (!planData || typeof planData !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'createActionPlan called with invalid planData');
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'plan',
              code: 'INVALID_INPUT',
              message: 'Action plan data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateActionPlan(planData);

      if (!validationResult.valid) {
        debug(OVERSIGHT_CONTEXT_NAME, 'Action plan validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          plan: null,
          errors: validationResult.errors,
        };
      }

      const now = new Date().toISOString();

      const newPlan = {
        id: generateId('APL'),
        title: planData.title,
        description: planData.description,
        counterpartyId: planData.counterpartyId,
        counterpartyName: planData.counterpartyName || '',
        watchlistEntryId: planData.watchlistEntryId || null,
        priority: planData.priority || 'medium',
        status: 'pending',
        assignedTo: planData.assignedTo || null,
        dueDate: planData.dueDate || null,
        steps: Array.isArray(planData.steps) ? planData.steps : [],
        createdBy: planData.createdBy || 'Unknown',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      dispatch({
        type: ACTIONS.CREATE_ACTION_PLAN,
        payload: newPlan,
      });

      info(OVERSIGHT_CONTEXT_NAME, 'Action plan created', {
        planId: newPlan.id,
        counterpartyId: newPlan.counterpartyId,
        priority: newPlan.priority,
      });

      return {
        success: true,
        plan: newPlan,
        errors: [],
      };
    },
    [],
  );

  const updateActionPlan = useCallback(
    (id, updates) => {
      if (!id || typeof id !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'updateActionPlan called with invalid id', { id });
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'id',
              code: 'REQUIRED',
              message: 'Action plan ID is required.',
            },
          ],
        };
      }

      if (!updates || typeof updates !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'updateActionPlan called with invalid updates', {
          id,
          updatesType: typeof updates,
        });
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'updates',
              code: 'INVALID_INPUT',
              message: 'Updates must be an object.',
            },
          ],
        };
      }

      const existingPlan = state.actionPlans.find((plan) => plan && plan.id === id);

      if (!existingPlan) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Action plan not found for update', { id });
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'id',
              code: 'NOT_FOUND',
              message: `Action plan with ID "${id}" not found.`,
            },
          ],
        };
      }

      if (existingPlan.status === 'completed') {
        warn(OVERSIGHT_CONTEXT_NAME, 'Cannot update completed action plan', { id });
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'status',
              code: 'INVALID_TRANSITION',
              message: 'Cannot update a completed action plan.',
            },
          ],
        };
      }

      if (updates.priority && !VALID_ACTION_PLAN_PRIORITIES.includes(updates.priority)) {
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'priority',
              code: 'INVALID_VALUE',
              message: `Priority must be one of: ${VALID_ACTION_PLAN_PRIORITIES.join(', ')}.`,
            },
          ],
        };
      }

      dispatch({
        type: ACTIONS.UPDATE_ACTION_PLAN,
        payload: { id, updates },
      });

      const updatedPlan = {
        ...existingPlan,
        ...updates,
        id: existingPlan.id,
        updatedAt: new Date().toISOString(),
      };

      debug(OVERSIGHT_CONTEXT_NAME, 'Action plan updated', { planId: id });

      return {
        success: true,
        plan: updatedPlan,
        errors: [],
      };
    },
    [state.actionPlans],
  );

  const completeActionPlan = useCallback(
    (id, completionNotes = '') => {
      if (!id || typeof id !== 'string') {
        warn(OVERSIGHT_CONTEXT_NAME, 'completeActionPlan called with invalid id', { id });
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'id',
              code: 'REQUIRED',
              message: 'Action plan ID is required.',
            },
          ],
        };
      }

      const existingPlan = state.actionPlans.find((plan) => plan && plan.id === id);

      if (!existingPlan) {
        warn(OVERSIGHT_CONTEXT_NAME, 'Action plan not found for completion', { id });
        return {
          success: false,
          plan: null,
          errors: [
            {
              field: 'id',
              code: 'NOT_FOUND',
              message: `Action plan with ID "${id}" not found.`,
            },
          ],
        };
      }

      if (existingPlan.status === 'completed') {
        debug(OVERSIGHT_CONTEXT_NAME, 'Action plan already completed', { id });
        return {
          success: true,
          plan: existingPlan,
          errors: [],
        };
      }

      dispatch({
        type: ACTIONS.COMPLETE_ACTION_PLAN,
        payload: id,
      });

      const completedPlan = {
        ...existingPlan,
        status: 'completed',
        completionNotes: completionNotes || undefined,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      info(OVERSIGHT_CONTEXT_NAME, 'Action plan completed', { planId: id });

      return {
        success: true,
        plan: completedPlan,
        errors: [],
      };
    },
    [state.actionPlans],
  );

  const getRiskTierCache = useCallback(() => {
    return state.riskTierCache;
  }, [state.riskTierCache]);

  const getCachedRiskTier = useCallback(
    (counterpartyId) => {
      if (!counterpartyId || typeof counterpartyId !== 'string') {
        return null;
      }
      return state.riskTierCache[counterpartyId] || null;
    },
    [state.riskTierCache],
  );

  const recalculateRiskTiers = useCallback(
    (counterpartyMetricsMap, trendsMap = {}, config = DEFAULT_RISK_TIER_CONFIG) => {
      if (!counterpartyMetricsMap || typeof counterpartyMetricsMap !== 'object') {
        warn(OVERSIGHT_CONTEXT_NAME, 'recalculateRiskTiers called with invalid metrics map');
        return {};
      }

      const newCache = {};

      for (const [counterpartyId, metrics] of Object.entries(counterpartyMetricsMap)) {
        if (!metrics || typeof metrics !== 'object') {
          continue;
        }

        const trends = trendsMap[counterpartyId] || null;
        const previousTier = state.riskTierCache[counterpartyId]
          ? state.riskTierCache[counterpartyId].current
          : 'unknown';

        const tierResult = calculateRiskTier(metrics, trends, config);
        tierResult.previous = previousTier;

        newCache[counterpartyId] = tierResult;
      }

      dispatch({
        type: ACTIONS.RECALCULATE_RISK_TIERS,
        payload: newCache,
      });

      debug(OVERSIGHT_CONTEXT_NAME, 'Risk tiers recalculated', {
        counterpartyCount: Object.keys(newCache).length,
      });

      return newCache;
    },
    [state.riskTierCache],
  );

  const clearRiskTierCache = useCallback(() => {
    dispatch({
      type: ACTIONS.RECALCULATE_RISK_TIERS,
      payload: {},
    });

    debug(OVERSIGHT_CONTEXT_NAME, 'Risk tier cache cleared');
  }, []);

  const refreshOversightData = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const raw = localStorage.getItem(STORAGE_KEY);
      let parsed = null;

      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (parseErr) {
          warn(OVERSIGHT_CONTEXT_NAME, 'Failed to parse oversight data during refresh', parseErr);
        }
      }

      const payload = {
        alertRules: (parsed && Array.isArray(parsed.alertRules)) ? parsed.alertRules : [],
        watchlist: (parsed && Array.isArray(parsed.watchlist)) ? parsed.watchlist : [],
        actionPlans: (parsed && Array.isArray(parsed.actionPlans)) ? parsed.actionPlans : [],
        riskTierCache: (parsed && parsed.riskTierCache && typeof parsed.riskTierCache === 'object')
          ? parsed.riskTierCache
          : {},
      };

      dispatch({
        type: ACTIONS.HYDRATE,
        payload,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(OVERSIGHT_CONTEXT_NAME, 'Oversight data refreshed from localStorage', {
        alertRuleCount: payload.alertRules.length,
        watchlistCount: payload.watchlist.length,
        actionPlanCount: payload.actionPlans.length,
      });

      return true;
    } catch (err) {
      error(OVERSIGHT_CONTEXT_NAME, 'Failed to refresh oversight data', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const getOversightStats = useCallback(() => {
    const stats = {
      totalAlertRules: state.alertRules.length,
      enabledAlertRules: state.alertRules.filter((r) => r && r.enabled).length,
      disabledAlertRules: state.alertRules.filter((r) => r && !r.enabled).length,
      totalWatchlistEntries: state.watchlist.length,
      activeWatchlistEntries: state.watchlist.filter((e) => e && e.status === 'active').length,
      monitoringWatchlistEntries: state.watchlist.filter((e) => e && e.status === 'monitoring').length,
      clearedWatchlistEntries: state.watchlist.filter((e) => e && e.status === 'cleared').length,
      totalActionPlans: state.actionPlans.length,
      pendingActionPlans: state.actionPlans.filter((p) => p && p.status === 'pending').length,
      inProgressActionPlans: state.actionPlans.filter((p) => p && p.status === 'in_progress').length,
      completedActionPlans: state.actionPlans.filter((p) => p && p.status === 'completed').length,
      cancelledActionPlans: state.actionPlans.filter((p) => p && p.status === 'cancelled').length,
      cachedTierCount: Object.keys(state.riskTierCache).length,
      bySeverity: {},
      byMetric: {},
    };

    for (const rule of state.alertRules) {
      if (!rule) continue;

      if (rule.severity) {
        stats.bySeverity[rule.severity] = (stats.bySeverity[rule.severity] || 0) + 1;
      }

      if (rule.metric) {
        stats.byMetric[rule.metric] = (stats.byMetric[rule.metric] || 0) + 1;
      }
    }

    return stats;
  }, [state]);

  const value = {
    alertRules: state.alertRules,
    watchlist: state.watchlist,
    actionPlans: state.actionPlans,
    riskTierCache: state.riskTierCache,
    isLoading: state.isLoading,
    error: state.error,
    getAlertRules,
    getAlertRuleById,
    getEnabledAlertRules,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    toggleAlertRule,
    evaluateAlertRules,
    getWatchlist,
    getWatchlistEntryById,
    getWatchlistByCounterparty,
    getActiveWatchlistEntries,
    addToWatchlist,
    removeFromWatchlist,
    addMonitoringNote,
    getActionPlans,
    getActionPlanById,
    getActionPlansByCounterparty,
    getActionPlansByStatus,
    createActionPlan,
    updateActionPlan,
    completeActionPlan,
    getRiskTierCache,
    getCachedRiskTier,
    recalculateRiskTiers,
    clearRiskTierCache,
    refreshOversightData,
    getOversightStats,
  };

  return <OversightContext.Provider value={value}>{children}</OversightContext.Provider>;
};

OversightProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useOversight = () => {
  const context = useContext(OversightContext);

  if (!context) {
    throw new Error('useOversight must be used within an OversightProvider');
  }

  return context;
};

export default OversightContext;