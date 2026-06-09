import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { PERSONAS, STORAGE_KEYS } from '../config';
import { debug, info, warn, error } from '../utils/logger';

const AuthContext = createContext(null);

const AUTH_CONTEXT_NAME = 'AuthContext';

const STORAGE_KEY = STORAGE_KEYS.ACTIVE_PERSONA;
const AUTH_STORAGE_KEY = 'maqcrop_auth';

const ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SWITCH_PERSONA: 'SWITCH_PERSONA',
  HYDRATE: 'HYDRATE',
};

const initialState = {
  currentPersona: null,
  isAuthenticated: false,
  lastLogin: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      if (!action.payload || !action.payload.currentPersona) {
        return { ...initialState };
      }

      const persona = PERSONAS.find((p) => p.id === action.payload.currentPersona);

      if (!persona) {
        warn(AUTH_CONTEXT_NAME, 'Hydrated persona not found in PERSONAS list', {
          personaId: action.payload.currentPersona,
        });
        return { ...initialState };
      }

      return {
        currentPersona: persona,
        isAuthenticated: true,
        lastLogin: action.payload.lastLogin || new Date().toISOString(),
      };
    }

    case ACTIONS.LOGIN: {
      const persona = PERSONAS.find((p) => p.id === action.payload.personaId);

      if (!persona) {
        warn(AUTH_CONTEXT_NAME, 'Login attempted with invalid persona', {
          personaId: action.payload.personaId,
        });
        return state;
      }

      return {
        currentPersona: persona,
        isAuthenticated: true,
        lastLogin: new Date().toISOString(),
      };
    }

    case ACTIONS.LOGOUT: {
      return { ...initialState };
    }

    case ACTIONS.SWITCH_PERSONA: {
      const persona = PERSONAS.find((p) => p.id === action.payload.personaId);

      if (!persona) {
        warn(AUTH_CONTEXT_NAME, 'Switch persona attempted with invalid persona', {
          personaId: action.payload.personaId,
        });
        return state;
      }

      return {
        ...state,
        currentPersona: persona,
        lastLogin: state.lastLogin || new Date().toISOString(),
      };
    }

    default: {
      warn(AUTH_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (isHydratedRef.current) {
      return;
    }

    isHydratedRef.current = true;

    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === 'object' && parsed.currentPersona) {
          dispatch({
            type: ACTIONS.HYDRATE,
            payload: {
              currentPersona: parsed.currentPersona,
              lastLogin: parsed.lastLogin || null,
            },
          });
          info(AUTH_CONTEXT_NAME, 'Auth state hydrated from localStorage', {
            personaId: parsed.currentPersona,
          });
        } else {
          debug(AUTH_CONTEXT_NAME, 'Stored auth data is invalid, initializing empty');
          dispatch({ type: ACTIONS.HYDRATE, payload: null });
        }
      } else {
        const personaRaw = localStorage.getItem(STORAGE_KEY);

        if (personaRaw) {
          try {
            const personaId = JSON.parse(personaRaw);
            if (personaId && typeof personaId === 'string') {
              dispatch({
                type: ACTIONS.HYDRATE,
                payload: {
                  currentPersona: personaId,
                  lastLogin: null,
                },
              });
              info(AUTH_CONTEXT_NAME, 'Auth state hydrated from legacy persona key', {
                personaId,
              });
              return;
            }
          } catch {
            debug(AUTH_CONTEXT_NAME, 'Legacy persona key parse failed, initializing empty');
          }
        }

        debug(AUTH_CONTEXT_NAME, 'No stored auth data found, initializing empty');
        dispatch({ type: ACTIONS.HYDRATE, payload: null });
      }
    } catch (err) {
      error(AUTH_CONTEXT_NAME, 'Failed to hydrate auth state from localStorage', err);
      dispatch({ type: ACTIONS.HYDRATE, payload: null });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      const authData = {
        currentPersona: state.currentPersona ? state.currentPersona.id : null,
        lastLogin: state.lastLogin,
      };

      const jsonString = JSON.stringify(authData);
      localStorage.setItem(AUTH_STORAGE_KEY, jsonString);

      if (state.currentPersona) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.currentPersona.id));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      error(AUTH_CONTEXT_NAME, 'Failed to persist auth state to localStorage', err);
    }
  }, [state.currentPersona, state.lastLogin]);

  const login = useCallback((personaId) => {
    if (!personaId || typeof personaId !== 'string') {
      warn(AUTH_CONTEXT_NAME, 'login called with invalid personaId', { personaId });
      return false;
    }

    const persona = PERSONAS.find((p) => p.id === personaId);

    if (!persona) {
      warn(AUTH_CONTEXT_NAME, 'login called with unknown persona', { personaId });
      return false;
    }

    dispatch({ type: ACTIONS.LOGIN, payload: { personaId } });
    info(AUTH_CONTEXT_NAME, 'User logged in', { personaId });

    return true;
  }, []);

  const logout = useCallback(() => {
    const previousPersona = state.currentPersona?.id;
    dispatch({ type: ACTIONS.LOGOUT });
    info(AUTH_CONTEXT_NAME, 'User logged out', { previousPersona });
  }, [state.currentPersona]);

  const switchPersona = useCallback((personaId) => {
    if (!personaId || typeof personaId !== 'string') {
      warn(AUTH_CONTEXT_NAME, 'switchPersona called with invalid personaId', { personaId });
      return false;
    }

    const persona = PERSONAS.find((p) => p.id === personaId);

    if (!persona) {
      warn(AUTH_CONTEXT_NAME, 'switchPersona called with unknown persona', { personaId });
      return false;
    }

    const previousPersona = state.currentPersona?.id;

    if (previousPersona === personaId) {
      debug(AUTH_CONTEXT_NAME, 'switchPersona called with same persona, no-op', { personaId });
      return true;
    }

    dispatch({ type: ACTIONS.SWITCH_PERSONA, payload: { personaId } });
    info(AUTH_CONTEXT_NAME, 'Persona switched', {
      from: previousPersona,
      to: personaId,
    });

    return true;
  }, [state.currentPersona]);

  const getAvailablePersonas = useCallback(() => {
    return PERSONAS;
  }, []);

  const isCurrentPersona = useCallback(
    (personaId) => {
      if (!state.currentPersona) return false;
      return state.currentPersona.id === personaId;
    },
    [state.currentPersona],
  );

  const value = {
    currentPersona: state.currentPersona,
    isAuthenticated: state.isAuthenticated,
    lastLogin: state.lastLogin,
    login,
    logout,
    switchPersona,
    getAvailablePersonas,
    isCurrentPersona,
    availablePersonas: PERSONAS,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export { PERSONAS };

export default AuthContext;