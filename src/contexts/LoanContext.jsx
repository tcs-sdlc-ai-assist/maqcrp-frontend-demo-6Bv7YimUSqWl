import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';
import { validateLoanSchema, validateDependencyRules, validateSellerReference } from '../utils/validators';
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

const LoanContext = createContext(null);

const LOAN_CONTEXT_NAME = 'LoanContext';

const STORAGE_KEY = 'maqcrop_loans';

const ACTIONS = {
  HYDRATE: 'HYDRATE',
  ADD_LOAN: 'ADD_LOAN',
  UPDATE_LOAN: 'UPDATE_LOAN',
  REMOVE_LOAN: 'REMOVE_LOAN',
  SET_LOANS: 'SET_LOANS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
};

const initialState = {
  loans: [],
  isLoading: true,
  error: null,
};

const loanReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const loans = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        loans,
        isLoading: false,
        error: null,
      };
    }

    case ACTIONS.ADD_LOAN: {
      if (!action.payload || typeof action.payload !== 'object') {
        warn(LOAN_CONTEXT_NAME, 'ADD_LOAN called with invalid payload');
        return state;
      }

      return {
        ...state,
        loans: [...state.loans, action.payload],
      };
    }

    case ACTIONS.UPDATE_LOAN: {
      if (!action.payload || !action.payload.id) {
        warn(LOAN_CONTEXT_NAME, 'UPDATE_LOAN called with invalid payload');
        return state;
      }

      return {
        ...state,
        loans: state.loans.map((loan) => {
          if (loan && loan.id === action.payload.id) {
            return { ...loan, ...action.payload.updates, updatedAt: new Date().toISOString() };
          }
          return loan;
        }),
      };
    }

    case ACTIONS.REMOVE_LOAN: {
      if (!action.payload) {
        warn(LOAN_CONTEXT_NAME, 'REMOVE_LOAN called with invalid payload');
        return state;
      }

      return {
        ...state,
        loans: state.loans.filter((loan) => loan && loan.id !== action.payload),
      };
    }

    case ACTIONS.SET_LOANS: {
      const loans = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        loans,
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
      warn(LOAN_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `LOAN-${timestamp}-${randomPart}`;
};

export const LoanProvider = ({ children }) => {
  const [state, dispatch] = useReducer(loanReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const loans = readCollection(STORAGE_KEY);

      dispatch({
        type: ACTIONS.HYDRATE,
        payload: loans,
      });

      info(LOAN_CONTEXT_NAME, 'Loans hydrated from localStorage', {
        count: loans.length,
      });
    } catch (err) {
      error(LOAN_CONTEXT_NAME, 'Failed to hydrate loans from localStorage', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      const success = writeCollection(STORAGE_KEY, state.loans);

      if (!success) {
        warn(LOAN_CONTEXT_NAME, 'Failed to persist loans to localStorage');
      }
    } catch (err) {
      error(LOAN_CONTEXT_NAME, 'Failed to persist loans to localStorage', err);
    }
  }, [state.loans]);

  const getLoanById = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        return null;
      }

      return state.loans.find((loan) => loan && loan.id === id) || null;
    },
    [state.loans],
  );

  const getLoansByStatus = useCallback(
    (status) => {
      if (!status || typeof status !== 'string') {
        return [];
      }

      return state.loans.filter((loan) => loan && loan.status === status);
    },
    [state.loans],
  );

  const getLoansBySeller = useCallback(
    (sellerId) => {
      if (!sellerId || typeof sellerId !== 'string') {
        return [];
      }

      return state.loans.filter((loan) => loan && loan.sellerId === sellerId);
    },
    [state.loans],
  );

  const validateLoan = useCallback((loanData) => {
    if (!loanData || typeof loanData !== 'object') {
      return [
        {
          field: 'loan',
          code: 'INVALID_INPUT',
          message: 'Loan data must be an object.',
        },
      ];
    }

    const schemaErrors = validateLoanSchema(loanData);

    if (!schemaErrors.valid) {
      return schemaErrors.errors;
    }

    const dependencyErrors = validateDependencyRules(loanData);

    if (!dependencyErrors.valid) {
      return dependencyErrors.errors;
    }

    return [];
  }, []);

  const submitLoan = useCallback(
    (loanData, existingSellers = []) => {
      if (!loanData || typeof loanData !== 'object') {
        warn(LOAN_CONTEXT_NAME, 'submitLoan called with invalid loanData');
        return {
          success: false,
          loan: null,
          errors: [
            {
              field: 'loan',
              code: 'INVALID_INPUT',
              message: 'Loan data must be an object.',
            },
          ],
        };
      }

      const validationErrors = validateLoan(loanData);

      if (validationErrors.length > 0) {
        debug(LOAN_CONTEXT_NAME, 'Loan validation failed', {
          errorCount: validationErrors.length,
        });
        return {
          success: false,
          loan: null,
          errors: validationErrors,
        };
      }

      if (loanData.sellerId && Array.isArray(existingSellers) && existingSellers.length > 0) {
        const sellerResult = validateSellerReference(loanData.sellerId, existingSellers);

        if (!sellerResult.valid) {
          return {
            success: false,
            loan: null,
            errors: sellerResult.errors,
          };
        }
      }

      try {
        const now = new Date().toISOString();

        const newLoan = {
          id: generateId(),
          borrowerName: loanData.borrowerName || '',
          ssn: loanData.ssn || '',
          propertyAddress: loanData.propertyAddress || '',
          loanAmount: loanData.loanAmount || 0,
          productType: loanData.productType || 'conventional',
          channel: loanData.channel || 'retail',
          sellerId: loanData.sellerId || '',
          borrowerAddress: loanData.borrowerAddress || undefined,
          borrowerIncome: loanData.borrowerIncome ?? undefined,
          creditScore: loanData.creditScore ?? undefined,
          accountNumber: loanData.accountNumber || undefined,
          email: loanData.email || undefined,
          phone: loanData.phone || undefined,
          loanPurpose: loanData.loanPurpose || undefined,
          ltv: loanData.ltv ?? undefined,
          dti: loanData.dti ?? undefined,
          status: 'PENDING_VALIDATION',
          decisionResult: null,
          documents: Array.isArray(loanData.documents) ? loanData.documents : [],
          createdAt: now,
          updatedAt: now,
        };

        dispatch({
          type: ACTIONS.ADD_LOAN,
          payload: newLoan,
        });

        info(LOAN_CONTEXT_NAME, 'Loan submitted successfully', {
          loanId: newLoan.id,
          productType: newLoan.productType,
          channel: newLoan.channel,
        });

        return {
          success: true,
          loan: newLoan,
          errors: [],
        };
      } catch (err) {
        error(LOAN_CONTEXT_NAME, 'Failed to submit loan', err);

        return {
          success: false,
          loan: null,
          errors: [
            {
              field: 'loan',
              code: 'INTERNAL_ERROR',
              message: 'An unexpected error occurred while submitting the loan.',
            },
          ],
        };
      }
    },
    [validateLoan],
  );

  const updateLoanStatus = useCallback(
    (id, status, reason = '') => {
      if (!id || typeof id !== 'string') {
        warn(LOAN_CONTEXT_NAME, 'updateLoanStatus called with invalid id', { id });
        return false;
      }

      if (!status || typeof status !== 'string') {
        warn(LOAN_CONTEXT_NAME, 'updateLoanStatus called with invalid status', { status });
        return false;
      }

      const existingLoan = state.loans.find((loan) => loan && loan.id === id);

      if (!existingLoan) {
        warn(LOAN_CONTEXT_NAME, 'Loan not found for status update', { id });
        return false;
      }

      const validStatuses = [
        'PENDING_VALIDATION',
        'VALIDATED',
        'PASS',
        'FAIL',
        'EXCEPTION',
        'OVERRIDDEN',
      ];

      if (!validStatuses.includes(status)) {
        warn(LOAN_CONTEXT_NAME, 'Invalid status for loan', { id, status });
        return false;
      }

      dispatch({
        type: ACTIONS.UPDATE_LOAN,
        payload: {
          id,
          updates: {
            status,
            previousStatus: existingLoan.status,
            statusChangeReason: reason || undefined,
          },
        },
      });

      debug(LOAN_CONTEXT_NAME, 'Loan status updated', {
        loanId: id,
        previousStatus: existingLoan.status,
        newStatus: status,
      });

      return true;
    },
    [state.loans],
  );

  const updateLoan = useCallback(
    (id, updates) => {
      if (!id || typeof id !== 'string') {
        warn(LOAN_CONTEXT_NAME, 'updateLoan called with invalid id', { id });
        return null;
      }

      if (!updates || typeof updates !== 'object') {
        warn(LOAN_CONTEXT_NAME, 'updateLoan called with invalid updates', {
          id,
          updatesType: typeof updates,
        });
        return null;
      }

      const existingLoan = state.loans.find((loan) => loan && loan.id === id);

      if (!existingLoan) {
        warn(LOAN_CONTEXT_NAME, 'Loan not found for update', { id });
        return null;
      }

      const updatedLoan = {
        ...existingLoan,
        ...updates,
        id: existingLoan.id,
        updatedAt: new Date().toISOString(),
      };

      dispatch({
        type: ACTIONS.UPDATE_LOAN,
        payload: {
          id,
          updates,
        },
      });

      debug(LOAN_CONTEXT_NAME, 'Loan updated', { loanId: id });

      return updatedLoan;
    },
    [state.loans],
  );

  const removeLoan = useCallback(
    (id) => {
      if (!id || typeof id !== 'string') {
        warn(LOAN_CONTEXT_NAME, 'removeLoan called with invalid id', { id });
        return false;
      }

      const existingLoan = state.loans.find((loan) => loan && loan.id === id);

      if (!existingLoan) {
        warn(LOAN_CONTEXT_NAME, 'Loan not found for removal', { id });
        return false;
      }

      dispatch({
        type: ACTIONS.REMOVE_LOAN,
        payload: id,
      });

      debug(LOAN_CONTEXT_NAME, 'Loan removed', { loanId: id });

      return true;
    },
    [state.loans],
  );

  const paginateLoans = useCallback(
    (page = 1, pageSize = 25, filters = {}) => {
      if (page < 1) {
        page = 1;
      }

      if (![10, 25, 50, 100].includes(pageSize)) {
        pageSize = 25;
      }

      let filtered = [...state.loans];

      if (filters.status && typeof filters.status === 'string') {
        filtered = filtered.filter((loan) => loan && loan.status === filters.status);
      }

      if (filters.productType && typeof filters.productType === 'string') {
        filtered = filtered.filter((loan) => loan && loan.productType === filters.productType);
      }

      if (filters.channel && typeof filters.channel === 'string') {
        filtered = filtered.filter((loan) => loan && loan.channel === filters.channel);
      }

      if (filters.sellerId && typeof filters.sellerId === 'string') {
        filtered = filtered.filter((loan) => loan && loan.sellerId === filters.sellerId);
      }

      if (filters.search && typeof filters.search === 'string') {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter((loan) => {
          if (!loan) return false;
          return (
            (loan.borrowerName && loan.borrowerName.toLowerCase().includes(searchLower)) ||
            (loan.id && loan.id.toLowerCase().includes(searchLower)) ||
            (loan.propertyAddress && loan.propertyAddress.toLowerCase().includes(searchLower)) ||
            (loan.sellerId && loan.sellerId.toLowerCase().includes(searchLower))
          );
        });
      }

      if (filters.minLoanAmount !== undefined && filters.minLoanAmount !== null) {
        filtered = filtered.filter(
          (loan) => loan && loan.loanAmount >= filters.minLoanAmount,
        );
      }

      if (filters.maxLoanAmount !== undefined && filters.maxLoanAmount !== null) {
        filtered = filtered.filter(
          (loan) => loan && loan.loanAmount <= filters.maxLoanAmount,
        );
      }

      if (filters.loanPurpose && typeof filters.loanPurpose === 'string') {
        filtered = filtered.filter((loan) => loan && loan.loanPurpose === filters.loanPurpose);
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
    [state.loans],
  );

  const getLoanStats = useCallback(() => {
    const stats = {
      total: state.loans.length,
      pendingValidation: 0,
      validated: 0,
      passed: 0,
      failed: 0,
      exception: 0,
      overridden: 0,
      byProductType: {},
      byChannel: {},
      bySeller: {},
    };

    for (const loan of state.loans) {
      if (!loan) continue;

      switch (loan.status) {
        case 'PENDING_VALIDATION':
          stats.pendingValidation++;
          break;
        case 'VALIDATED':
          stats.validated++;
          break;
        case 'PASS':
          stats.passed++;
          break;
        case 'FAIL':
          stats.failed++;
          break;
        case 'EXCEPTION':
          stats.exception++;
          break;
        case 'OVERRIDDEN':
          stats.overridden++;
          break;
        default:
          break;
      }

      if (loan.productType) {
        stats.byProductType[loan.productType] =
          (stats.byProductType[loan.productType] || 0) + 1;
      }

      if (loan.channel) {
        stats.byChannel[loan.channel] = (stats.byChannel[loan.channel] || 0) + 1;
      }

      if (loan.sellerId) {
        stats.bySeller[loan.sellerId] = (stats.bySeller[loan.sellerId] || 0) + 1;
      }
    }

    return stats;
  }, [state.loans]);

  const refreshLoans = useCallback(() => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const loans = readCollection(STORAGE_KEY);

      dispatch({
        type: ACTIONS.SET_LOANS,
        payload: loans,
      });

      dispatch({ type: ACTIONS.SET_LOADING, payload: false });

      info(LOAN_CONTEXT_NAME, 'Loans refreshed from localStorage', {
        count: loans.length,
      });

      return true;
    } catch (err) {
      error(LOAN_CONTEXT_NAME, 'Failed to refresh loans', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: err });
      return false;
    }
  }, []);

  const value = {
    loans: state.loans,
    isLoading: state.isLoading,
    error: state.error,
    getLoanById,
    getLoansByStatus,
    getLoansBySeller,
    validateLoan,
    submitLoan,
    updateLoanStatus,
    updateLoan,
    removeLoan,
    paginateLoans,
    getLoanStats,
    refreshLoans,
  };

  return <LoanContext.Provider value={value}>{children}</LoanContext.Provider>;
};

LoanProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useLoans = () => {
  const context = useContext(LoanContext);

  if (!context) {
    throw new Error('useLoans must be used within a LoanProvider');
  }

  return context;
};

export default LoanContext;