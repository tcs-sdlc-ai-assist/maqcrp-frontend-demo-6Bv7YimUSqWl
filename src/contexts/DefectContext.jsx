import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';
import { emit, EVENTS } from '../services/eventBus';
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

const DefectContext = createContext(null);

const DEFECT_CONTEXT_NAME = 'DefectContext';

const STORAGE_KEY_DEFECTS = 'maqcrop_defects';
const STORAGE_KEY_TAXONOMY = 'maqcrop_defect_taxonomy';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  ADD_DEFECT: 'ADD_DEFECT',
  UPDATE_DEFECT: 'UPDATE_DEFECT',
  REMOVE_DEFECT: 'REMOVE_DEFECT',
  SET_DEFECTS: 'SET_DEFECTS',
  SET_TAXONOMY: 'SET_TAXONOMY',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  defects: [],
  taxonomy: null,
  isLoading: true,
  error: null,
};

const defectReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const defects = Array.isArray(action.payload.defects) ? action.payload.defects : [];
      const taxonomy = action.payload.taxonomy || null;
      return {
        ...state,
        defects,
        taxonomy,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.ADD_DEFECT: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(DEFECT_CONTEXT_NAME, 'ADD_DEFECT called with invalid payload');
        return state;
      }
      return {
        ...state,
        defects: [...state.defects, action.payload],
      };
    }

    case ACTIONS.UPDATE_DEFECT: {
      if (!action.payload || !action.payload.id) {
        warn(DEFECT_CONTEXT_NAME, 'UPDATE_DEFECT called with invalid payload');
        return state;
      }
      return {
        ...state,
        defects: state.defects.map((defect) => {
          if (defect && defect.id === action.payload.id) {
            return { ...defect, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return defect;
        }),
      };
    }

    case ACTIONS.REMOVE_DEFECT: {
      if (!action.payload) {
        warn(DEFECT_CONTEXT_NAME, 'REMOVE_DEFECT called with invalid payload');
        return state;
      }
      return {
        ...state,
        defects: state.defects.filter((defect) => defect && defect.id !== action.payload),
      };
    }

    case ACTIONS.SET_DEFECTS: {
      const defects = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        defects,
      };
    }

    case ACTIONS.SET_TAXONOMY: {
      return {
        ...state,
        taxonomy: action.payload,
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
      warn(DEFECT_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = (prefix = 'DEF') => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

const VALID_SEVERITIES = ['critical', 'major', 'minor', 'observation'];
const VALID_ROOT_CAUSES = [
  'Seller Error',
  'Process Gap',
  'System Issue',
  'Third-Party Error',
  'Borrower Misrepresentation',
  'Underwriter Error',
  'Documentation Deficiency',
  'Training Gap',
];
const VALID_SOURCES = ['pre_closing', 'post_closing', 'servicing'];
const VALID_DEFECT_STATUSES = ['open', 'in_review', 'closed', 'disputed'];

const SEVERITY_REMEDY_THRESHOLD = ['critical', 'major'];

const validateDefectData = (defectData) => {
  const errors = [];

  if (!defectData || typeof defectData !== 'object') {
    errors.push({
      field: 'defect',
      code: 'INVALID_INPUT',
      message: 'Defect data must be an object.',
    });
    return { valid: false, errors };
  }

  if (!defectData.qcCaseId || typeof defectData.qcCaseId !== 'string') {
    errors.push({
      field: 'qcCaseId',
      code: 'REQUIRED',
      message: 'QC case ID is required.',
    });
  }

  if (!defectData.loanId || typeof defectData.loanId !== 'string') {
    errors.push({
      field: 'loanId',
      code: 'REQUIRED',
      message: 'Loan ID is required.',
    });
  }

  if (!defectData.sellerId || typeof defectData.sellerId !== 'string') {
    errors.push({
      field: 'sellerId',
      code: 'REQUIRED',
      message: 'Seller ID is required.',
    });
  }

  if (!defectData.taxonomyCode || typeof defectData.taxonomyCode !== 'string') {
    errors.push({
      field: 'taxonomyCode',
      code: 'REQUIRED',
      message: 'Taxonomy code is required.',
    });
  }

  if (!defectData.category || typeof defectData.category !== 'string') {
    errors.push({
      field: 'category',
      code: 'REQUIRED',
      message: 'Category is required.',
    });
  }

  if (!defectData.subcategory || typeof defectData.subcategory !== 'string') {
    errors.push({
      field: 'subcategory',
      code: 'REQUIRED',
      message: 'Subcategory is required.',
    });
  }

  if (defectData.severity && !VALID_SEVERITIES.includes(defectData.severity)) {
    errors.push({
      field: 'severity',
      code: 'INVALID_VALUE',
      message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}.`,
    });
  }

  if (defectData.rootCause && !VALID_ROOT_CAUSES.includes(defectData.rootCause)) {
    errors.push({
      field: 'rootCause',
      code: 'INVALID_VALUE',
      message: `Root cause must be one of: ${VALID_ROOT_CAUSES.join(', ')}.`,
    });
  }

  if (defectData.sourceOfDefect && !VALID_SOURCES.includes(defectData.sourceOfDefect)) {
    errors.push({
      field: 'sourceOfDefect',
      code: 'INVALID_VALUE',
      message: `Source of defect must be one of: ${VALID_SOURCES.join(', ')}.`,
    });
  }

  if (!defectData.description || typeof defectData.description !== 'string' || defectData.description.trim() === '') {
    errors.push({
      field: 'description',
      code: 'REQUIRED',
      message: 'Description is required.',
    });
  }

  return { valid: errors.length === 0, errors };
};

const resolveTaxonomyDefaults = (taxonomyCode, taxonomy) => {
  if (!taxonomyCode || !taxonomy || !Array.isArray(taxonomy.categories)) {
    return { category: '', subcategory: '', defaultSeverity: 'major' };
  }

  const parts = taxonomyCode.split('.');
  if (parts.length !== 3) {
    return { category: '', subcategory: '', defaultSeverity: 'major' };
  }

  const [catCode, subcatCode, defectCode] = parts;

  for (const category of taxonomy.categories) {
    if (category.code === catCode) {
      for (const subcategory of category.subcategories) {
        if (subcategory.code === subcatCode) {
          for (const defectType of subcategory.defectTypes) {
            if (defectType.code === defectCode) {
              return {
                category: category.name,
                subcategory: subcategory.name,
                defaultSeverity: defectType.defaultSeverity || 'major',
              };
            }
          }
        }
      }
    }
  }

  return { category: '', subcategory: '', defaultSeverity: 'major' };
};

export const DefectProvider = ({ children }) => {
  const [state, dispatch] = useReducer(defectReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const defects = readCollection(STORAGE_KEY_DEFECTS);

      let taxonomy = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TAXONOMY);
        if (raw) {
          taxonomy = JSON.parse(raw);
        }
      } catch (parseErr) {
        warn(DEFECT_CONTEXT_NAME, 'Failed to parse defect taxonomy', parseErr);
      }

      dispatch({
        type: ACTIONS.HYDRATE,
        payload: { defects, taxonomy },
      });

      info(DEFECT_CONTEXT_NAME, 'Defects hydrated from localStorage', {
        defectCount: defects.length,
        hasTaxonomy: !!taxonomy,
      });
    } catch (err) {
      error(DEFECT_CONTEXT_NAME, 'Failed to hydrate defects from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      writeCollection(STORAGE_KEY_DEFECTS, state.defects);
    } catch (err) {
      error(DEFECT_CONTEXT_NAME, 'Failed to persist defects to localStorage', err);
    }
  }, [state.defects]);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      if (state.taxonomy) {
        const jsonString = JSON.stringify(state.taxonomy);
        localStorage.setItem(STORAGE_KEY_TAXONOMY, jsonString);
      }
    } catch (err) {
      error(DEFECT_CONTEXT_NAME, 'Failed to persist defect taxonomy to localStorage', err);
    }
  }, [state.taxonomy]);

  const getDefectById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }
      return state.defects.find((defect) => defect && defect.id === id) || null;
    },
    [state.defects],
  );

  const getDefectsByQCCase = useCallback(
    (qcCaseId) => {
      if (!qcCaseId || typeof qcCaseId !== 'string') {
        return [];
      }
      return state.defects.filter((defect) => defect && defect.qcCaseId === qcCaseId);
    },
    [state.defects],
  );

  const getDefectsBySeller = useCallback(
    (sellerId) => {
      if (!sellerId || typeof sellerId !== 'string') {
        return [];
      }
      return state.defects.filter((defect) => defect && defect.sellerId === sellerId);
    },
    [state.defects],
  );

  const getDefectsByLoan = useCallback(
    (loanId) => {
      if (!loanId || typeof loanId !== 'string') {
        return [];
      }
      return state.defects.filter((defect) => defect && defect.loanId === loanId);
    },
    [state.defects],
  );

  const getDefectsByStatus = useCallback(
    (status) => {
      if (!status || typeof status !== 'string') {
        return [];
      }
      return state.defects.filter((defect) => defect && defect.status === status);
    },
    [state.defects],
  );

  const getDefectsBySeverity = useCallback(
    (severity) => {
      if (!severity || typeof severity !== 'string') {
        return [];
      }
      return state.defects.filter((defect) => defect && defect.severity === severity);
    },
    [state.defects],
  );

  const createDefect = useCallback(
    (defectData) => {
      if (!defectData || typeof defectData !== 'object') {
        warn(DEFECT_CONTEXT_NAME, 'createDefect called with invalid defectData');
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'defect',
              code: 'INVALID_INPUT',
              message: 'Defect data must be an object.',
            },
          ],
        };
      }

      const validationResult = validateDefectData(defectData);

      if (!validationResult.valid) {
        debug(DEFECT_CONTEXT_NAME, 'Defect validation failed', {
          errorCount: validationResult.errors.length,
        });
        return {
          success: false,
          defect: null,
          errors: validationResult.errors,
        };
      }

      const taxonomyDefaults = resolveTaxonomyDefaults(
        defectData.taxonomyCode,
        state.taxonomy,
      );

      const now = new Date().toISOString();

      const newDefect = {
        id: generateId('DEF'),
        qcCaseId: defectData.qcCaseId,
        loanId: defectData.loanId,
        sellerId: defectData.sellerId,
        taxonomyCode: defectData.taxonomyCode,
        category: defectData.category || taxonomyDefaults.category,
        subcategory: defectData.subcategory || taxonomyDefaults.subcategory,
        severity: defectData.severity || taxonomyDefaults.defaultSeverity,
        rootCause: defectData.rootCause || '',
        sourceOfDefect: defectData.sourceOfDefect || 'pre_closing',
        description: defectData.description,
        evidence: Array.isArray(defectData.evidence) ? defectData.evidence : [],
        linkedRemedyCaseId: defectData.linkedRemedyCaseId || null,
        linkedRepurchaseCaseId: defectData.linkedRepurchaseCaseId || null,
        status: 'open',
        resolution: null,
        createdBy: defectData.createdBy || 'Unknown',
        createdAt: now,
        updatedAt: now,
        closedAt: null,
      };

      dispatch({
        type: ACTIONS.ADD_DEFECT,
        payload: newDefect,
      });

      info(DEFECT_CONTEXT_NAME, 'Defect created', {
        defectId: newDefect.id,
        taxonomyCode: newDefect.taxonomyCode,
        severity: newDefect.severity,
      });

      const requiresRemedy = SEVERITY_REMEDY_THRESHOLD.includes(newDefect.severity);

      if (requiresRemedy) {
        emit(EVENTS.DEFECT_REQUIRES_REMEDY, {
          defectId: newDefect.id,
          loanId: newDefect.loanId,
          sellerId: newDefect.sellerId,
          severity: newDefect.severity,
          taxonomyCode: newDefect.taxonomyCode,
          category: newDefect.category,
          subcategory: newDefect.subcategory,
          description: newDefect.description,
          qcCaseId: newDefect.qcCaseId,
        });

        debug(DEFECT_CONTEXT_NAME, 'DEFECT_REQUIRES_REMEDY event emitted', {
          defectId: newDefect.id,
          severity: newDefect.severity,
        });
      }

      return {
        success: true,
        defect: newDefect,
        errors: [],
      };
    },
    [state.taxonomy],
  );

  const updateDefect = useCallback(
    (id, updates) => {
      if (!id || typeof id !== 'string') {
        warn(DEFECT_CONTEXT_NAME, 'updateDefect called with invalid id', { id });
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'id',
              code: 'REQUIRED',
              message: 'Defect ID is required.',
            },
          ],
        };
      }

      if (!updates || typeof updates !== 'object') {
        warn(DEFECT_CONTEXT_NAME, 'updateDefect called with invalid updates', {
          id,
          updatesType: typeof updates,
        });
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'updates',
              code: 'INVALID_INPUT',
              message: 'Updates must be an object.',
            },
          ],
        };
      }

      const existingDefect = state.defects.find((defect) => defect && defect.id === id);

      if (!existingDefect) {
        warn(DEFECT_CONTEXT_NAME, 'Defect not found for update', { id });
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'id',
              code: 'NOT_FOUND',
              message: `Defect with ID "${id}" not found.`,
            },
          ],
        };
      }

      if (existingDefect.status === 'closed') {
        warn(DEFECT_CONTEXT_NAME, 'Cannot update closed defect', { id });
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'status',
              code: 'INVALID_TRANSITION',
              message: 'Cannot update a closed defect.',
            },
          ],
        };
      }

      if (updates.severity && !VALID_SEVERITIES.includes(updates.severity)) {
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'severity',
              code: 'INVALID_VALUE',
              message: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}.`,
            },
          ],
        };
      }

      if (updates.rootCause && !VALID_ROOT_CAUSES.includes(updates.rootCause)) {
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'rootCause',
              code: 'INVALID_VALUE',
              message: `Root cause must be one of: ${VALID_ROOT_CAUSES.join(', ')}.`,
            },
          ],
        };
      }

      if (updates.sourceOfDefect && !VALID_SOURCES.includes(updates.sourceOfDefect)) {
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'sourceOfDefect',
              code: 'INVALID_VALUE',
              message: `Source of defect must be one of: ${VALID_SOURCES.join(', ')}.`,
            },
          ],
        };
      }

      dispatch({
        type: ACTIONS.UPDATE_DEFECT,
        payload: { id, updates },
      });

      const updatedDefect = {
        ...existingDefect,
        ...updates,
        id: existingDefect.id,
        updatedAt: new Date().toISOString(),
      };

      debug(DEFECT_CONTEXT_NAME, 'Defect updated', { defectId: id });

      return {
        success: true,
        defect: updatedDefect,
        errors: [],
      };
    },
    [state.defects],
  );

  const closeDefect = useCallback(
    (id, resolution = '') => {
      if (!id || typeof id !== 'string') {
        warn(DEFECT_CONTEXT_NAME, 'closeDefect called with invalid id', { id });
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'id',
              code: 'REQUIRED',
              message: 'Defect ID is required.',
            },
          ],
        };
      }

      const existingDefect = state.defects.find((defect) => defect && defect.id === id);

      if (!existingDefect) {
        warn(DEFECT_CONTEXT_NAME, 'Defect not found for close', { id });
        return {
          success: false,
          defect: null,
          errors: [
            {
              field: 'id',
              code: 'NOT_FOUND',
              message: `Defect with ID "${id}" not found.`,
            },
          ],
        };
      }

      if (existingDefect.status === 'closed') {
        debug(DEFECT_CONTEXT_NAME, 'Defect already closed', { id });
        return {
          success: true,
          defect: existingDefect,
          errors: [],
        };
      }

      const now = new Date().toISOString();

      dispatch({
        type: ACTIONS.UPDATE_DEFECT,
        payload: {
          id,
          updates: {
            status: 'closed',
            resolution: resolution || 'Defect resolved.',
            closedAt: now,
          },
        },
      });

      const closedDefect = {
        ...existingDefect,
        status: 'closed',
        resolution: resolution || 'Defect resolved.',
        closedAt: now,
        updatedAt: now,
      };

      info(DEFECT_CONTEXT_NAME, 'Defect closed', { defectId: id });

      return {
        success: true,
        defect: closedDefect,
        errors: [],
      };
    },
    [state.defects],
  );

  const filterDefects = useCallback(
    (filters = {}) => {
      if (!Array.isArray(state.defects)) {
        return [];
      }

      let filtered = [...state.defects];

      if (filters.status && typeof filters.status === 'string') {
        filtered = filtered.filter((defect) => defect && defect.status === filters.status);
      }

      if (filters.severity && typeof filters.severity === 'string') {
        filtered = filtered.filter((defect) => defect && defect.severity === filters.severity);
      }

      if (filters.category && typeof filters.category === 'string') {
        filtered = filtered.filter((defect) => defect && defect.category === filters.category);
      }

      if (filters.subcategory && typeof filters.subcategory === 'string') {
        filtered = filtered.filter((defect) => defect && defect.subcategory === filters.subcategory);
      }

      if (filters.taxonomyCode && typeof filters.taxonomyCode === 'string') {
        filtered = filtered.filter(
          (defect) => defect && defect.taxonomyCode === filters.taxonomyCode,
        );
      }

      if (filters.rootCause && typeof filters.rootCause === 'string') {
        filtered = filtered.filter((defect) => defect && defect.rootCause === filters.rootCause);
      }

      if (filters.sourceOfDefect && typeof filters.sourceOfDefect === 'string') {
        filtered = filtered.filter(
          (defect) => defect && defect.sourceOfDefect === filters.sourceOfDefect,
        );
      }

      if (filters.sellerId && typeof filters.sellerId === 'string') {
        filtered = filtered.filter((defect) => defect && defect.sellerId === filters.sellerId);
      }

      if (filters.loanId && typeof filters.loanId === 'string') {
        filtered = filtered.filter((defect) => defect && defect.loanId === filters.loanId);
      }

      if (filters.qcCaseId && typeof filters.qcCaseId === 'string') {
        filtered = filtered.filter((defect) => defect && defect.qcCaseId === filters.qcCaseId);
      }

      if (filters.linkedRemedyCaseId && typeof filters.linkedRemedyCaseId === 'string') {
        filtered = filtered.filter(
          (defect) => defect && defect.linkedRemedyCaseId === filters.linkedRemedyCaseId,
        );
      }

      if (filters.linkedRepurchaseCaseId && typeof filters.linkedRepurchaseCaseId === 'string') {
        filtered = filtered.filter(
          (defect) =>
            defect && defect.linkedRepurchaseCaseId === filters.linkedRepurchaseCaseId,
        );
      }

      if (filters.search && typeof filters.search === 'string') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((defect) => {
          if (!defect) return false;
          return (
            (defect.id && defect.id.toLowerCase().includes(searchLower)) ||
            (defect.taxonomyCode && defect.taxonomyCode.toLowerCase().includes(searchLower)) ||
            (defect.category && defect.category.toLowerCase().includes(searchLower)) ||
            (defect.subcategory && defect.subcategory.toLowerCase().includes(searchLower)) ||
            (defect.description && defect.description.toLowerCase().includes(searchLower)) ||
            (defect.rootCause && defect.rootCause.toLowerCase().includes(searchLower)) ||
            (defect.sellerId && defect.sellerId.toLowerCase().includes(searchLower)) ||
            (defect.loanId && defect.loanId.toLowerCase().includes(searchLower))
          );
        });
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (!isNaN(startDate.getTime())) {
          filtered = filtered.filter(
            (defect) => defect && new Date(defect.createdAt) >= startDate,
          );
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (!isNaN(endDate.getTime())) {
          filtered = filtered.filter(
            (defect) => defect && new Date(defect.createdAt) <= endDate,
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
    [state.defects],
  );

  const paginateDefects = useCallback(
    (page = 1, pageSize = 25, filters = {}) => {
      if (page < 1) {
        page = 1;
      }

      if (![10, 25, 50, 100].includes(pageSize)) {
        pageSize = 25;
      }

      const filtered = filterDefects(filters);

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
    [filterDefects],
  );

  const getTaxonomy = useCallback(() => {
    return state.taxonomy;
  }, [state.taxonomy]);

  const updateTaxonomy = useCallback(
    (taxonomy) => {
      if (!taxonomy || typeof taxonomy !== 'object') {
        warn(DEFECT_CONTEXT_NAME, 'updateTaxonomy called with invalid taxonomy');
        return {
          success: false,
          taxonomy: null,
          errors: [
            {
              field: 'taxonomy',
              code: 'INVALID_INPUT',
              message: 'Taxonomy must be an object.',
            },
          ],
        };
      }

      if (!Array.isArray(taxonomy.categories)) {
        warn(DEFECT_CONTEXT_NAME, 'updateTaxonomy called with invalid categories');
        return {
          success: false,
          taxonomy: null,
          errors: [
            {
              field: 'taxonomy.categories',
              code: 'INVALID_INPUT',
              message: 'Taxonomy categories must be an array.',
            },
          ],
        };
      }

      const updatedTaxonomy = {
        ...taxonomy,
        version: (taxonomy.version || 0) + 1,
      };

      dispatch({
        type: ACTIONS.SET_TAXONOMY,
        payload: updatedTaxonomy,
      });

      info(DEFECT_CONTEXT_NAME, 'Defect taxonomy updated', {
        version: updatedTaxonomy.version,
        categoryCount: updatedTaxonomy.categories.length,
      });

      return {
        success: true,
        taxonomy: updatedTaxonomy,
        errors: [],
      };
    },
    [],
  );

  const getDefectStats = useCallback(() => {
    const stats = {
      total: state.defects.length,
      open: 0,
      inReview: 0,
      closed: 0,
      disputed: 0,
      bySeverity: {},
      byCategory: {},
      byRootCause: {},
      bySeller: {},
      bySourceOfDefect: {},
    };

    for (const defect of state.defects) {
      if (!defect) continue;

      switch (defect.status) {
        case 'open':
          stats.open++;
          break;
        case 'in_review':
          stats.inReview++;
          break;
        case 'closed':
          stats.closed++;
          break;
        case 'disputed':
          stats.disputed++;
          break;
        default:
          break;
      }

      if (defect.severity) {
        stats.bySeverity[defect.severity] =
          (stats.bySeverity[defect.severity] || 0) + 1;
      }

      if (defect.category) {
        stats.byCategory[defect.category] =
          (stats.byCategory[defect.category] || 0) + 1;
      }

      if (defect.rootCause) {
        stats.byRootCause[defect.rootCause] =
          (stats.byRootCause[defect.rootCause] || 0) + 1;
      }

      if (defect.sellerId) {
        stats.bySeller[defect.sellerId] =
          (stats.bySeller[defect.sellerId] || 0) + 1;
      }

      if (defect.sourceOfDefect) {
        stats.bySourceOfDefect[defect.sourceOfDefect] =
          (stats.bySourceOfDefect[defect.sourceOfDefect] || 0) + 1;
      }
    }

    return stats;
  }, [state.defects]);

  const refreshDefects = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const defects = readCollection(STORAGE_KEY_DEFECTS);

      let taxonomy = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TAXONOMY);
        if (raw) {
          taxonomy = JSON.parse(raw);
        }
      } catch (parseErr) {
        warn(DEFECT_CONTEXT_NAME, 'Failed to parse defect taxonomy during refresh', parseErr);
      }

      dispatch({
        type: ACTIONS.SET_DEFECTS,
        payload: defects,
      });

      dispatch({
        type: ACTIONS.SET_TAXONOMY,
        payload: taxonomy,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(DEFECT_CONTEXT_NAME, 'Defects refreshed from localStorage', {
        defectCount: defects.length,
        hasTaxonomy: !!taxonomy,
      });

      return true;
    } catch (err) {
      error(DEFECT_CONTEXT_NAME, 'Failed to refresh defects', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const value = {
    defects: state.defects,
    taxonomy: state.taxonomy,
    isLoading: state.isLoading,
    error: state.error,
    getDefectById,
    getDefectsByQCCase,
    getDefectsBySeller,
    getDefectsByLoan,
    getDefectsByStatus,
    getDefectsBySeverity,
    createDefect,
    updateDefect,
    closeDefect,
    filterDefects,
    paginateDefects,
    getTaxonomy,
    updateTaxonomy,
    getDefectStats,
    refreshDefects,
  };

  return <DefectContext.Provider value={value}>{children}</DefectContext.Provider>;
};

DefectProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useDefects = () => {
  const context = useContext(DefectContext);

  if (!context) {
    throw new Error('useDefects must be used within a DefectProvider');
  }

  return context;
};

export default DefectContext;