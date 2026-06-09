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

const MockDataContext = createContext(null);

const MOCK_DATA_CONTEXT_NAME = 'MockDataContext';

const COLLECTION_KEYS = {
  LOANS: 'maqcrop_loans',
  SELLERS: 'maqcrop_sellers',
  RULES: 'maqcrop_rules',
  RULE_VERSIONS: 'maqcrop_rule_versions',
  QC_CASES: 'maqcrop_qc_cases',
  DEFECTS: 'maqcrop_defects',
  DEFECT_TAXONOMY: 'maqcrop_defect_taxonomy',
  REMEDY_CASES: 'maqcrop_remedy_cases',
  REPURCHASE_CASES: 'maqcrop_repurchase_cases',
  CHECKLIST_TEMPLATES: 'maqcrop_checklist_templates',
  AUDIT_LOG: 'maqcrop_audit_log',
  SAMPLING_CONFIGS: 'maqcrop_sampling_configs',
  NOTIFICATIONS: 'maqcrop_notifications',
};

const ACTIONS = {
  SET_COLLECTION: 'SET_COLLECTION',
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_ITEM: 'UPDATE_ITEM',
  HYDRATE_ALL: 'HYDRATE_ALL',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  loans: [],
  sellers: [],
  rules: [],
  ruleVersions: [],
  qcCases: [],
  defects: [],
  defectTaxonomy: null,
  remedyCases: [],
  repurchaseCases: [],
  checklistTemplates: [],
  auditLog: [],
  samplingConfigs: [],
  notifications: [],
  isLoading: true,
  error: null,
};

const mockDataReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE_ALL: {
      return {
        ...state,
        loans: Array.isArray(action.payload.loans) ? action.payload.loans : [],
        sellers: Array.isArray(action.payload.sellers) ? action.payload.sellers : [],
        rules: Array.isArray(action.payload.rules) ? action.payload.rules : [],
        ruleVersions: Array.isArray(action.payload.ruleVersions) ? action.payload.ruleVersions : [],
        qcCases: Array.isArray(action.payload.qcCases) ? action.payload.qcCases : [],
        defects: Array.isArray(action.payload.defects) ? action.payload.defects : [],
        defectTaxonomy: action.payload.defectTaxonomy || null,
        remedyCases: Array.isArray(action.payload.remedyCases) ? action.payload.remedyCases : [],
        repurchaseCases: Array.isArray(action.payload.repurchaseCases)
          ? action.payload.repurchaseCases
          : [],
        checklistTemplates: Array.isArray(action.payload.checklistTemplates)
          ? action.payload.checklistTemplates
          : [],
        auditLog: Array.isArray(action.payload.auditLog) ? action.payload.auditLog : [],
        samplingConfigs: Array.isArray(action.payload.samplingConfigs)
          ? action.payload.samplingConfigs
          : [],
        notifications: Array.isArray(action.payload.notifications)
          ? action.payload.notifications
          : [],
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.SET_COLLECTION: {
      return {
        ...state,
        [action.payload.collectionName]: Array.isArray(action.payload.data)
          ? action.payload.data
          : action.payload.data,
      };
    }

    case ACTIONS.ADD_ITEM: {
      const collection = state[action.payload.collectionName];
      if (!Array.isArray(collection)) {
        return state;
      }
      return {
        ...state,
        [action.payload.collectionName]: [...collection, action.payload.item],
      };
    }

    case ACTIONS.REMOVE_ITEM: {
      const collection = state[action.payload.collectionName];
      if (!Array.isArray(collection)) {
        return state;
      }
      return {
        ...state,
        [action.payload.collectionName]: collection.filter(
          (item) => item && item.id !== action.payload.itemId,
        ),
      };
    }

    case ACTIONS.UPDATE_ITEM: {
      const collection = state[action.payload.collectionName];
      if (!Array.isArray(collection)) {
        return state;
      }
      return {
        ...state,
        [action.payload.collectionName]: collection.map((item) => {
          if (item && item.id === action.payload.itemId) {
            return { ...item, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return item;
        }),
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
      warn(MOCK_DATA_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const collectionKeyMap = {
  loans: COLLECTION_KEYS.LOANS,
  sellers: COLLECTION_KEYS.SELLERS,
  rules: COLLECTION_KEYS.RULES,
  ruleVersions: COLLECTION_KEYS.RULE_VERSIONS,
  qcCases: COLLECTION_KEYS.QC_CASES,
  defects: COLLECTION_KEYS.DEFECTS,
  defectTaxonomy: COLLECTION_KEYS.DEFECT_TAXONOMY,
  remedyCases: COLLECTION_KEYS.REMEDY_CASES,
  repurchaseCases: COLLECTION_KEYS.REPURCHASE_CASES,
  checklistTemplates: COLLECTION_KEYS.CHECKLIST_TEMPLATES,
  auditLog: COLLECTION_KEYS.AUDIT_LOG,
  samplingConfigs: COLLECTION_KEYS.SAMPLING_CONFIGS,
  notifications: COLLECTION_KEYS.NOTIFICATIONS,
};

export const MockDataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(mockDataReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const loans = readCollection(COLLECTION_KEYS.LOANS);
      const sellers = readCollection(COLLECTION_KEYS.SELLERS);
      const rules = readCollection(COLLECTION_KEYS.RULES);
      const ruleVersions = readCollection(COLLECTION_KEYS.RULE_VERSIONS);
      const qcCases = readCollection(COLLECTION_KEYS.QC_CASES);
      const defects = readCollection(COLLECTION_KEYS.DEFECTS);
      const remedyCases = readCollection(COLLECTION_KEYS.REMEDY_CASES);
      const repurchaseCases = readCollection(COLLECTION_KEYS.REPURCHASE_CASES);
      const checklistTemplates = readCollection(COLLECTION_KEYS.CHECKLIST_TEMPLATES);
      const auditLog = readCollection(COLLECTION_KEYS.AUDIT_LOG);
      const samplingConfigs = readCollection(COLLECTION_KEYS.SAMPLING_CONFIGS);
      const notifications = readCollection(COLLECTION_KEYS.NOTIFICATIONS);

      let defectTaxonomy = null;
      try {
        const raw = localStorage.getItem(COLLECTION_KEYS.DEFECT_TAXONOMY);
        if (raw) {
          defectTaxonomy = JSON.parse(raw);
        }
      } catch (parseErr) {
        warn(MOCK_DATA_CONTEXT_NAME, 'Failed to parse defect taxonomy', parseErr);
      }

      dispatch({
        type: ACTIONS.HYDRATE_ALL,
        payload: {
          loans,
          sellers,
          rules,
          ruleVersions,
          qcCases,
          defects,
          defectTaxonomy,
          remedyCases,
          repurchaseCases,
          checklistTemplates,
          auditLog,
          samplingConfigs,
          notifications,
        },
      });

      info(MOCK_DATA_CONTEXT_NAME, 'Mock data hydrated from localStorage', {
        loans: loans.length,
        sellers: sellers.length,
        rules: rules.length,
        qcCases: qcCases.length,
        defects: defects.length,
        remedyCases: remedyCases.length,
        repurchaseCases: repurchaseCases.length,
        checklistTemplates: checklistTemplates.length,
        auditLog: auditLog.length,
      });
    } catch (err) {
      error(MOCK_DATA_CONTEXT_NAME, 'Failed to hydrate mock data', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  const getCollection = useCallback(
    (collectionName) => {
      if (!collectionName || typeof collectionName !== 'string') {
        warn(MOCK_DATA_CONTEXT_NAME, 'getCollection called with invalid collectionName', {
          collectionName,
        });
        return [];
      }

      const data = state[collectionName];

      if (data === undefined || data === null) {
        debug(MOCK_DATA_CONTEXT_NAME, 'Collection not found in state', { collectionName });
        return [];
      }

      if (!Array.isArray(data)) {
        return data;
      }

      return data;
    },
    [state],
  );

  const getItemById = useCallback(
    (collectionName, itemId) => {
      if (!collectionName || !itemId) {
        return null;
      }

      const collection = state[collectionName];

      if (!Array.isArray(collection)) {
        return null;
      }

      return collection.find((item) => item && item.id === itemId) || null;
    },
    [state],
  );

  const queryItems = useCallback(
    (collectionName, predicate) => {
      if (!collectionName || typeof predicate !== 'function') {
        return [];
      }

      const collection = state[collectionName];

      if (!Array.isArray(collection)) {
        return [];
      }

      try {
        return collection.filter((item) => {
          try {
            return predicate(item);
          } catch (predicateErr) {
            warn(MOCK_DATA_CONTEXT_NAME, 'Predicate function threw an error', predicateErr);
            return false;
          }
        });
      } catch (err) {
        error(MOCK_DATA_CONTEXT_NAME, 'Failed to query collection', { collectionName }, err);
        return [];
      }
    },
    [state],
  );

  const addItem = useCallback(
    (collectionName, item) => {
      if (!collectionName || !item || typeof item !== 'object') {
        warn(MOCK_DATA_CONTEXT_NAME, 'addItem called with invalid arguments', {
          collectionName,
          itemType: typeof item,
        });
        return null;
      }

      const storageKey = collectionKeyMap[collectionName];

      if (!storageKey) {
        warn(MOCK_DATA_CONTEXT_NAME, 'No storage key mapping for collection', { collectionName });
        return null;
      }

      try {
        const newItem = appendToCollection(storageKey, item);

        if (!newItem) {
          return null;
        }

        dispatch({
          type: ACTIONS.ADD_ITEM,
          payload: { collectionName, item: newItem },
        });

        debug(MOCK_DATA_CONTEXT_NAME, 'Item added to collection', {
          collectionName,
          itemId: newItem.id,
        });

        return newItem;
      } catch (err) {
        error(MOCK_DATA_CONTEXT_NAME, 'Failed to add item to collection', { collectionName }, err);
        return null;
      }
    },
    [],
  );

  const removeItem = useCallback(
    (collectionName, itemId) => {
      if (!collectionName || !itemId) {
        warn(MOCK_DATA_CONTEXT_NAME, 'removeItem called with invalid arguments', {
          collectionName,
          itemId,
        });
        return false;
      }

      const storageKey = collectionKeyMap[collectionName];

      if (!storageKey) {
        warn(MOCK_DATA_CONTEXT_NAME, 'No storage key mapping for collection', { collectionName });
        return false;
      }

      try {
        const success = removeFromCollection(storageKey, itemId);

        if (!success) {
          return false;
        }

        dispatch({
          type: ACTIONS.REMOVE_ITEM,
          payload: { collectionName, itemId },
        });

        debug(MOCK_DATA_CONTEXT_NAME, 'Item removed from collection', {
          collectionName,
          itemId,
        });

        return true;
      } catch (err) {
        error(
          MOCK_DATA_CONTEXT_NAME,
          'Failed to remove item from collection',
          { collectionName, itemId },
          err,
        );
        return false;
      }
    },
    [],
  );

  const updateItem = useCallback(
    (collectionName, itemId, updates) => {
      if (!collectionName || !itemId || !updates || typeof updates !== 'object') {
        warn(MOCK_DATA_CONTEXT_NAME, 'updateItem called with invalid arguments', {
          collectionName,
          itemId,
          updatesType: typeof updates,
        });
        return null;
      }

      const storageKey = collectionKeyMap[collectionName];

      if (!storageKey) {
        warn(MOCK_DATA_CONTEXT_NAME, 'No storage key mapping for collection', { collectionName });
        return null;
      }

      try {
        const updatedItem = updateInCollection(storageKey, itemId, updates);

        if (!updatedItem) {
          return null;
        }

        dispatch({
          type: ACTIONS.UPDATE_ITEM,
          payload: { collectionName, itemId, updates },
        });

        debug(MOCK_DATA_CONTEXT_NAME, 'Item updated in collection', {
          collectionName,
          itemId,
        });

        return updatedItem;
      } catch (err) {
        error(
          MOCK_DATA_CONTEXT_NAME,
          'Failed to update item in collection',
          { collectionName, itemId },
          err,
        );
        return null;
      }
    },
    [],
  );

  const refreshCollection = useCallback(
    (collectionName) => {
      if (!collectionName) {
        warn(MOCK_DATA_CONTEXT_NAME, 'refreshCollection called with invalid collectionName', {
          collectionName,
        });
        return false;
      }

      const storageKey = collectionKeyMap[collectionName];

      if (!storageKey) {
        warn(MOCK_DATA_CONTEXT_NAME, 'No storage key mapping for collection', { collectionName });
        return false;
      }

      try {
        const data = readCollection(storageKey);

        dispatch({
          type: ACTIONS.SET_COLLECTION,
          payload: { collectionName, data },
        });

        debug(MOCK_DATA_CONTEXT_NAME, 'Collection refreshed from localStorage', {
          collectionName,
          itemCount: Array.isArray(data) ? data.length : 0,
        });

        return true;
      } catch (err) {
        error(
          MOCK_DATA_CONTEXT_NAME,
          'Failed to refresh collection',
          { collectionName },
          err,
        );
        return false;
      }
    },
    [],
  );

  const refreshAll = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const collections = Object.keys(collectionKeyMap);

      for (const collectionName of collections) {
        refreshCollection(collectionName);
      }

      let defectTaxonomy = null;
      try {
        const raw = localStorage.getItem(COLLECTION_KEYS.DEFECT_TAXONOMY);
        if (raw) {
          defectTaxonomy = JSON.parse(raw);
        }
      } catch (parseErr) {
        warn(MOCK_DATA_CONTEXT_NAME, 'Failed to parse defect taxonomy during refreshAll', parseErr);
      }

      dispatch({
        type: ACTIONS.SET_COLLECTION,
        payload: { collectionName: 'defectTaxonomy', data: defectTaxonomy },
      });

      invalidateIndexes();

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(MOCK_DATA_CONTEXT_NAME, 'All collections refreshed');

      return true;
    } catch (err) {
      error(MOCK_DATA_CONTEXT_NAME, 'Failed to refresh all collections', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, [refreshCollection]);

  const buildCollectionIndex = useCallback((collectionName, indexField) => {
    if (!collectionName || !indexField) {
      warn(MOCK_DATA_CONTEXT_NAME, 'buildCollectionIndex called with invalid arguments', {
        collectionName,
        indexField,
      });
      return false;
    }

    const storageKey = collectionKeyMap[collectionName];

    if (!storageKey) {
      warn(MOCK_DATA_CONTEXT_NAME, 'No storage key mapping for collection', { collectionName });
      return false;
    }

    try {
      const success = buildIndex(storageKey, indexField);

      if (success) {
        debug(MOCK_DATA_CONTEXT_NAME, 'Index built for collection', {
          collectionName,
          indexField,
        });
      }

      return success;
    } catch (err) {
      error(
        MOCK_DATA_CONTEXT_NAME,
        'Failed to build index for collection',
        { collectionName, indexField },
        err,
      );
      return false;
    }
  }, []);

  const getCollectionIndex = useCallback((collectionName, indexField) => {
    if (!collectionName || !indexField) {
      return null;
    }

    const storageKey = collectionKeyMap[collectionName];

    if (!storageKey) {
      return null;
    }

    try {
      return getIndex(storageKey, indexField);
    } catch (err) {
      error(
        MOCK_DATA_CONTEXT_NAME,
        'Failed to get index for collection',
        { collectionName, indexField },
        err,
      );
      return null;
    }
  }, []);

  const getCollectionStats = useCallback(() => {
    return {
      loans: state.loans.length,
      sellers: state.sellers.length,
      rules: state.rules.length,
      ruleVersions: state.ruleVersions.length,
      qcCases: state.qcCases.length,
      defects: state.defects.length,
      remedyCases: state.remedyCases.length,
      repurchaseCases: state.repurchaseCases.length,
      checklistTemplates: state.checklistTemplates.length,
      auditLog: state.auditLog.length,
      samplingConfigs: state.samplingConfigs.length,
      notifications: state.notifications.length,
      isLoading: state.isLoading,
    };
  }, [state]);

  const value = {
    loans: state.loans,
    sellers: state.sellers,
    rules: state.rules,
    ruleVersions: state.ruleVersions,
    qcCases: state.qcCases,
    defects: state.defects,
    defectTaxonomy: state.defectTaxonomy,
    remedyCases: state.remedyCases,
    repurchaseCases: state.repurchaseCases,
    checklistTemplates: state.checklistTemplates,
    auditLog: state.auditLog,
    samplingConfigs: state.samplingConfigs,
    notifications: state.notifications,
    isLoading: state.isLoading,
    error: state.error,
    getCollection,
    getItemById,
    queryItems,
    addItem,
    removeItem,
    updateItem,
    refreshCollection,
    refreshAll,
    buildCollectionIndex,
    getCollectionIndex,
    getCollectionStats,
  };

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
};

MockDataProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useMockData = () => {
  const context = useContext(MockDataContext);

  if (!context) {
    throw new Error('useMockData must be used within a MockDataProvider');
  }

  return context;
};

export default MockDataContext;