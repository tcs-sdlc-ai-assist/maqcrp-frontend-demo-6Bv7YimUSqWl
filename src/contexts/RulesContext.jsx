import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';
import { validateRuleConfig } from '../utils/validators';
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

const RulesContext = createContext(null);

const RULES_CONTEXT_NAME = 'RulesContext';

const STORAGE_KEY_RULES = 'maqcrop_rules';
const STORAGE_KEY_VERSIONS = 'maqcrop_rule_versions';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  ADD_RULE: 'ADD_RULE',
  UPDATE_RULE: 'UPDATE_RULE',
  ARCHIVE_RULE: 'ARCHIVE_RULE',
  SET_RULES: 'SET_RULES',
  SET_VERSIONS: 'SET_VERSIONS',
  ADD_VERSION: 'ADD_VERSION',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  rules: [],
  ruleVersions: [],
  isLoading: true,
  error: null,
};

const rulesReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const rules = Array.isArray(action.payload.rules) ? action.payload.rules : [];
      const ruleVersions = Array.isArray(action.payload.ruleVersions)
        ? action.payload.ruleVersions
        : [];
      return {
        ...state,
        rules,
        ruleVersions,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.ADD_RULE: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(RULES_CONTEXT_NAME, 'ADD_RULE called with invalid payload');
        return state;
      }

      return {
        ...state,
        rules: [...state.rules, action.payload],
      };
    }

    case ACTIONS.UPDATE_RULE: {
      if (!action.payload || !action.payload.id) {
        warn(RULES_CONTEXT_NAME, 'UPDATE_RULE called with invalid payload');
        return state;
      }

      return {
        ...state,
        rules: state.rules.map((rule) => {
          if (rule && rule.id === action.payload.id) {
            return { ...rule, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return rule;
        }),
      };
    }

    case ACTIONS.ARCHIVE_RULE: {
      if (!action.payload) {
        warn(RULES_CONTEXT_NAME, 'ARCHIVE_RULE called with invalid payload');
        return state;
      }

      return {
        ...state,
        rules: state.rules.map((rule) => {
          if (rule && rule.id === action.payload) {
            return {
              ...rule,
              status: 'archived',
              expirationDate: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
            };
          }
          return rule;
        }),
      };
    }

    case ACTIONS.SET_RULES: {
      const rules = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        rules,
      };
    }

    case ACTIONS.SET_VERSIONS: {
      const ruleVersions = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        ruleVersions,
      };
    }

    case ACTIONS.ADD_VERSION: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(RULES_CONTEXT_NAME, 'ADD_VERSION called with invalid payload');
        return state;
      }

      return {
        ...state,
        ruleVersions: [...state.ruleVersions, action.payload],
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
      warn(RULES_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = (prefix = 'RULE') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

const generateVersionId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `RVER-${timestamp}-${randomPart}`;
};

const VALID_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'not_in'];

const evaluateCondition = (loan, condition) => {
  if (!loan || !condition) {
    return false;
  }

  const fieldValue = loan[condition.field];

  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  switch (condition.operator) {
    case 'gt':
      return fieldValue > condition.value;
    case 'gte':
      return fieldValue >= condition.value;
    case 'lt':
      return fieldValue < condition.value;
    case 'lte':
      return fieldValue <= condition.value;
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    default:
      return false;
  }
};

const evaluateConditions = (loan, conditions) => {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true;
  }

  for (const condition of conditions) {
    if (!evaluateCondition(loan, condition)) {
      return false;
    }
  }

  return true;
};

const isRuleApplicable = (rule, loan, referenceDate) => {
  if (!rule || !loan) {
    return false;
  }

  if (rule.status !== 'active') {
    return false;
  }

  if (
    !Array.isArray(rule.productTypes) ||
    !rule.productTypes.includes(loan.productType)
  ) {
    return false;
  }

  if (!Array.isArray(rule.channels) || !rule.channels.includes(loan.channel)) {
    return false;
  }

  if (Array.isArray(rule.sellerIds) && rule.sellerIds.length > 0) {
    if (!rule.sellerIds.includes(loan.sellerId)) {
      return false;
    }
  }

  if (rule.effectiveDate) {
    const effectiveDate = new Date(rule.effectiveDate);
    if (!isNaN(effectiveDate.getTime()) && referenceDate < effectiveDate) {
      return false;
    }
  }

  if (rule.expirationDate) {
    const expirationDate = new Date(rule.expirationDate);
    if (!isNaN(expirationDate.getTime()) && referenceDate >= expirationDate) {
      return false;
    }
  }

  return true;
};

const executeRulesEngine = (loans, rules, referenceDate) => {
  if (!Array.isArray(loans) || !Array.isArray(rules)) {
    return [];
  }

  const results = [];

  for (const loan of loans) {
    if (!loan) {
      continue;
    }

    const applicableRules = rules.filter((rule) => isRuleApplicable(rule, loan, referenceDate));

    const hardStopRules = applicableRules.filter((r) => r.ruleType === 'hard_stop');
    const weightedRules = applicableRules.filter((r) => r.ruleType === 'weighted_score');

    applicableRules.sort((a, b) => {
      if (a.ruleType === 'hard_stop' && b.ruleType !== 'hard_stop') return -1;
      if (a.ruleType !== 'hard_stop' && b.ruleType === 'hard_stop') return 1;
      if (a.ruleType === 'weighted_score' && b.ruleType === 'weighted_score') {
        return (b.weight || 0) - (a.weight || 0);
      }
      return 0;
    });

    const ruleResults = [];
    let totalScore = 0;
    let maxPossibleScore = 0;
    let hardStopTriggered = false;
    let hardStopMessage = '';

    for (const rule of applicableRules) {
      const passed = evaluateConditions(loan, rule.conditions);

      if (rule.ruleType === 'hard_stop') {
        if (!passed) {
          hardStopTriggered = true;
          const message = rule.conditions
            .filter((c) => !evaluateCondition(loan, c))
            .map((c) => c.message.replace('{actual}', loan[c.field]))
            .join('; ');

          hardStopMessage = message || `Failed: ${rule.name}`;

          ruleResults.push({
            ruleId: rule.id,
            ruleName: rule.name,
            passed: false,
            message: hardStopMessage,
            weight: 0,
            isHardStop: true,
          });

          break;
        }

        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          passed: true,
          message: rule.conditions[0]?.message.replace('{actual}', loan[rule.conditions[0]?.field]) || `Passed: ${rule.name}`,
          weight: 0,
          isHardStop: true,
        });
      } else if (rule.ruleType === 'weighted_score') {
        maxPossibleScore += rule.weight || 0;

        if (passed) {
          totalScore += rule.weight || 0;
        }

        const message = rule.conditions[0]
          ? rule.conditions[0].message.replace('{actual}', loan[rule.conditions[0].field])
          : `Weighted rule: ${rule.name}`;

        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          passed,
          message,
          weight: rule.weight || 0,
          isHardStop: false,
        });
      }
    }

    let decision;
    let passed;

    if (hardStopTriggered) {
      decision = 'fail';
      passed = false;
    } else if (maxPossibleScore === 0) {
      decision = 'pass';
      passed = true;
    } else {
      const scoreRatio = totalScore / maxPossibleScore;
      if (scoreRatio >= 0.8) {
        decision = 'pass';
        passed = true;
      } else {
        decision = 'exception';
        passed = false;
      }
    }

    results.push({
      loanId: loan.id,
      passed,
      decision,
      totalScore,
      maxPossibleScore,
      ruleResults,
      executedAt: new Date().toISOString(),
    });
  }

  return results;
};

export const RulesProvider = ({ children }) => {
  const [state, dispatch] = useReducer(rulesReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const rules = readCollection(STORAGE_KEY_RULES);
      const ruleVersions = readCollection(STORAGE_KEY_VERSIONS);

      dispatch({
        type: ACTIONS.HYDRATE,
        payload: { rules, ruleVersions },
      });

      info(RULES_CONTEXT_NAME, 'Rules hydrated from localStorage', {
        ruleCount: rules.length,
        versionCount: ruleVersions.length,
      });
    } catch (err) {
      error(RULES_CONTEXT_NAME, 'Failed to hydrate rules from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY_RULES, state.rules);
    } catch (err) {
      error(RULES_CONTEXT_NAME, 'Failed to persist rules to localStorage', err);
    }
  }, [state.rules]);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY_VERSIONS, state.ruleVersions);
    } catch (err) {
      error(RULES_CONTEXT_NAME, 'Failed to persist rule versions to localStorage', err);
    }
  }, [state.ruleVersions]);

  const getRuleById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }

      return state.rules.find((rule) => rule && rule.id === id) || null;
    },
    [state.rules],
  );

  const getRulesByProduct = useCallback(
    (productType) => {
      if (!productType || typeof productType !== 'string') {
        return [];
      }

      return state.rules.filter(
        (rule) => rule && Array.isArray(rule.productTypes) && rule.productTypes.includes(productType),
      );
    },
    [state.rules],
  );

  const getRulesByChannel = useCallback(
    (channel) => {
      if (!channel || typeof channel !== 'string') {
        return [];
      }

      return state.rules.filter(
        (rule) => rule && Array.isArray(rule.channels) && rule.channels.includes(channel),
      );
    },
    [state.rules],
  );

  const getActiveRules = useCallback(() => {
    return state.rules.filter((rule) => rule && rule.status === 'active');
  }, [state.rules]);

  const addRule = useCallback(
    (ruleInput) => {
      if (!ruleInput || typeof ruleInput !== 'object') {
        warn(RULES_CONTEXT_NAME, 'addRule called with invalid ruleInput');
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'rule',
              code: 'INVALID_INPUT',
              message: 'Rule data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateRuleConfig(ruleInput);

      if (!validationResult.valid) {
        debug(RULES_CONTEXT_NAME, 'Rule validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          rule: null,
          errors: validationResult.errors,
        };
      }

      try {
        const now = new Date().toISOString();

        const newRule = {
          id: generateId('RULE'),
          name: ruleInput.name,
          description: ruleInput.description,
          productTypes: ruleInput.productTypes,
          channels: ruleInput.channels,
          sellerIds: ruleInput.sellerIds || null,
          ruleType: ruleInput.ruleType,
          conditions: ruleInput.conditions,
          weight: ruleInput.ruleType === 'weighted_score' ? ruleInput.weight : 0,
          effectiveDate: ruleInput.effectiveDate,
          expirationDate: ruleInput.expirationDate || null,
          status: 'active',
          version: 1,
          createdBy: ruleInput.createdBy || 'Unknown',
          createdAt: now,
          updatedAt: now,
        };

        dispatch({
          type: ACTIONS.ADD_RULE,
          payload: newRule,
        });

        const versionEntry = {
          id: generateVersionId(),
          ruleId: newRule.id,
          version: 1,
          snapshot: { ...newRule },
          changedBy: newRule.createdBy,
          changedAt: now,
          changeReason: 'Initial creation',
        };

        dispatch({
          type: ACTIONS.ADD_VERSION,
          payload: versionEntry,
        });

        info(RULES_CONTEXT_NAME, 'Rule added successfully', {
          ruleId: newRule.id,
          ruleName: newRule.name,
        });

        return {
          success: true,
          rule: newRule,
          errors: [],
        };
      } catch (err) {
        error(RULES_CONTEXT_NAME, 'Failed to add rule', err);

        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'rule',
              code: 'INTERNAL_ERROR',
              message: 'An unexpected error occurred while adding the rule.',
            },
          ],
        };
      }
    },
    [],
  );

  const updateRule = useCallback(
    (id, updates) => {
      if (!id || typeof id !== 'string') {
        warn(RULES_CONTEXT_NAME, 'updateRule called with invalid id', { id });
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'id',
              code: 'REQUIRED',
              message: 'Rule ID is required.',
            },
          ],
        };
      }

      if (!updates || typeof updates !== 'object') {
        warn(RULES_CONTEXT_NAME, 'updateRule called with invalid updates', {
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

      const existingRule = state.rules.find((rule) => rule && rule.id === id);

      if (!existingRule) {
        warn(RULES_CONTEXT_NAME, 'Rule not found for update', { id });
        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'id',
              code: 'NOT_FOUND',
              message: `Rule with ID "${id}" not found.`,
            },
          ],
        };
      }

      const mergedRule = {
        ...existingRule,
        ...updates,
        id: existingRule.id,
        version: existingRule.version + 1,
        updatedAt: new Date().toISOString(),
      };

      const validationResult = validateRuleConfig(mergedRule);

      if (!validationResult.valid) {
        debug(RULES_CONTEXT_NAME, 'Rule update validation failed', {
          ruleId: id,
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          rule: null,
          errors: validationResult.errors,
        };
      }

      try {
        dispatch({
          type: ACTIONS.UPDATE_RULE,
          payload: { id, updates: { ...updates, version: existingRule.version + 1 } },
        });

        const versionEntry = {
          id: generateVersionId(),
          ruleId: id,
          version: existingRule.version + 1,
          snapshot: { ...mergedRule },
          changedBy: updates.changedBy || existingRule.createdBy || 'Unknown',
          changedAt: new Date().toISOString(),
          changeReason: updates.changeReason || 'Rule updated',
        };

        dispatch({
          type: ACTIONS.ADD_VERSION,
          payload: versionEntry,
        });

        info(RULES_CONTEXT_NAME, 'Rule updated successfully', {
          ruleId: id,
          newVersion: existingRule.version + 1,
        });

        return {
          success: true,
          rule: mergedRule,
          errors: [],
        };
      } catch (err) {
        error(RULES_CONTEXT_NAME, 'Failed to update rule', { ruleId: id }, err);

        return {
          success: false,
          rule: null,
          errors: [
            {
              field: 'rule',
              code: 'INTERNAL_ERROR',
              message: 'An unexpected error occurred while updating the rule.',
            },
          ],
        };
      }
    },
    [state.rules],
  );

  const archiveRule = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(RULES_CONTEXT_NAME, 'archiveRule called with invalid id', { id });
        return false;
      }

      const existingRule = state.rules.find((rule) => rule && rule.id === id);

      if (!existingRule) {
        warn(RULES_CONTEXT_NAME, 'Rule not found for archive', { id });
        return false;
      }

      if (existingRule.status === 'archived') {
        debug(RULES_CONTEXT_NAME, 'Rule already archived', { id });
        return true;
      }

      dispatch({
        type: ACTIONS.ARCHIVE_RULE,
        payload: id,
      });

      const versionEntry = {
        id: generateVersionId(),
        ruleId: id,
        version: existingRule.version + 1,
        snapshot: {
          ...existingRule,
          status: 'archived',
          expirationDate: new Date().toISOString().split('T')[0],
          version: existingRule.version + 1,
          updatedAt: new Date().toISOString(),
        },
        changedBy: existingRule.createdBy || 'Unknown',
        changedAt: new Date().toISOString(),
        changeReason: 'Rule archived',
      };

      dispatch({
        type: ACTIONS.ADD_VERSION,
        payload: versionEntry,
      });

      info(RULES_CONTEXT_NAME, 'Rule archived', { ruleId: id });

      return true;
    },
    [state.rules],
  );

  const getRuleVersions = useCallback(
    (ruleId) => {
      if (!ruleId || typeof ruleId !== 'string') {
        return [];
      }

      return state.ruleVersions
        .filter((v) => v && v.ruleId === ruleId)
        .sort((a, b) => b.version - a.version);
    },
    [state.ruleVersions],
  );

  const executeRules = useCallback(
    (loans, referenceDate) => {
      if (!Array.isArray(loans)) {
        warn(RULES_CONTEXT_NAME, 'executeRules called with invalid loans', {
          loansType: typeof loans,
        });
        return [];
      }

      const activeRules = state.rules.filter((rule) => rule && rule.status === 'active');

      if (activeRules.length === 0) {
        debug(RULES_CONTEXT_NAME, 'No active rules to execute');
        return loans.map((loan) => ({
          loanId: loan ? loan.id : 'unknown',
          passed: true,
          decision: 'pass',
          totalScore: 0,
          maxPossibleScore: 0,
          ruleResults: [],
          executedAt: new Date().toISOString(),
        }));
      }

      const refDate = referenceDate && !isNaN(referenceDate.getTime())
        ? referenceDate
        : new Date();

      const results = executeRulesEngine(loans, activeRules, refDate);

      debug(RULES_CONTEXT_NAME, 'Rules executed', {
        loanCount: loans.length,
        ruleCount: activeRules.length,
        resultCount: results.length,
      });

      return results;
    },
    [state.rules],
  );

  const requestOverride = useCallback(
    (loanId, reason, justification) => {
      if (!loanId || typeof loanId !== 'string') {
        warn(RULES_CONTEXT_NAME, 'requestOverride called with invalid loanId', { loanId });
        return {
          success: false,
          override: null,
          errors: [
            {
              field: 'loanId',
              code: 'REQUIRED',
              message: 'Loan ID is required.',
            },
          ],
        };
      }

      if (!reason || typeof reason !== 'string') {
        warn(RULES_CONTEXT_NAME, 'requestOverride called with invalid reason', { reason });
        return {
          success: false,
          override: null,
          errors: [
            {
              field: 'reason',
              code: 'REQUIRED',
              message: 'Override reason is required.',
            },
          ],
        };
      }

      const overrideId = generateId('OVRD');
      const now = new Date().toISOString();

      const override = {
        id: overrideId,
        loanId,
        reason,
        justification: justification || '',
        status: 'pending',
        requestedBy: 'Unknown',
        requestedAt: now,
        approvedBy: null,
        approvedAt: null,
        approverNotes: null,
      };

      info(RULES_CONTEXT_NAME, 'Override requested', {
        overrideId,
        loanId,
        reason,
      });

      return {
        success: true,
        override,
        errors: [],
      };
    },
    [],
  );

  const approveOverride = useCallback(
    (override, approverNotes) => {
      if (!override || typeof override !== 'object') {
        warn(RULES_CONTEXT_NAME, 'approveOverride called with invalid override');
        return {
          success: false,
          override: null,
          errors: [
            {
              field: 'override',
              code: 'INVALID_INPUT',
              message: 'Override object is required.',
            },
          ],
        };
      }

      if (!override.id) {
        warn(RULES_CONTEXT_NAME, 'approveOverride called with override missing id');
        return {
          success: false,
          override: null,
          errors: [
            {
              field: 'override.id',
              code: 'REQUIRED',
              message: 'Override ID is required.',
            },
          ],
        };
      }

      const now = new Date().toISOString();

      const approvedOverride = {
        ...override,
        status: 'approved',
        approvedBy: 'Administrator',
        approvedAt: now,
        approverNotes: approverNotes || '',
      };

      info(RULES_CONTEXT_NAME, 'Override approved', {
        overrideId: override.id,
        loanId: override.loanId,
      });

      return {
        success: true,
        override: approvedOverride,
        errors: [],
      };
    },
    [],
  );

  const refreshRules = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const rules = readCollection(STORAGE_KEY_RULES);
      const ruleVersions = readCollection(STORAGE_KEY_VERSIONS);

      dispatch({
        type: ACTIONS.SET_RULES,
        payload: rules,
      });

      dispatch({
        type: ACTIONS.SET_VERSIONS,
        payload: ruleVersions,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(RULES_CONTEXT_NAME, 'Rules refreshed from localStorage', {
        ruleCount: rules.length,
        versionCount: ruleVersions.length,
      });

      return true;
    } catch (err) {
      error(RULES_CONTEXT_NAME, 'Failed to refresh rules', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const value = {
    rules: state.rules,
    ruleVersions: state.ruleVersions,
    isLoading: state.isLoading,
    error: state.error,
    getRuleById,
    getRulesByProduct,
    getRulesByChannel,
    getActiveRules,
    addRule,
    updateRule,
    archiveRule,
    getRuleVersions,
    executeRules,
    requestOverride,
    approveOverride,
    refreshRules,
  };

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
};

RulesProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useRules = () => {
  const context = useContext(RulesContext);

  if (!context) {
    throw new Error('useRules must be used within a RulesProvider');
  }

  return context;
};

export default RulesContext;