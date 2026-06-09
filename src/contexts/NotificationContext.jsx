import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { debug, info, warn, error } from '../utils/logger';

const NotificationContext = createContext(null);

const NOTIFICATION_CONTEXT_NAME = 'NotificationContext';

const STORAGE_KEY = 'maqcrop_notifications';

const MAX_NOTIFICATIONS = 200;

const ACTIONS = {
  ADD: 'ADD',
  MARK_READ: 'MARK_READ',
  DISMISS: 'DISMISS',
  HYDRATE: 'HYDRATE',
  CLEAR_ALL: 'CLEAR_ALL',
};

const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `NOTIF-${timestamp}-${randomPart}`;
};

const notificationReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.HYDRATE: {
      const entries = Array.isArray(action.payload) ? action.payload : [];
      return entries;
    }

    case ACTIONS.ADD: {
      const newNotification = {
        id: generateId(),
        type: action.payload.type || 'info',
        title: action.payload.title || '',
        message: action.payload.message || '',
        link: action.payload.link || null,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const updated = [newNotification, ...state];

      if (updated.length > MAX_NOTIFICATIONS) {
        return updated.slice(0, MAX_NOTIFICATIONS);
      }

      return updated;
    }

    case ACTIONS.MARK_READ: {
      return state.map((notification) => {
        if (notification.id === action.payload.id) {
          return { ...notification, isRead: true };
        }
        return notification;
      });
    }

    case ACTIONS.DISMISS: {
      return state.filter((notification) => notification.id !== action.payload.id);
    }

    case ACTIONS.CLEAR_ALL: {
      return [];
    }

    default: {
      warn(NOTIFICATION_CONTEXT_NAME, 'Unknown action type', { actionType: action.type });
      return state;
    }
  }
};

export const NotificationProvider = ({ children }) => {
  const [notifications, dispatch] = useReducer(notificationReducer, []);

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
          info(NOTIFICATION_CONTEXT_NAME, 'Notifications hydrated from localStorage', {
            count: parsed.length,
          });
        } else {
          warn(NOTIFICATION_CONTEXT_NAME, 'Stored notifications is not an array, initializing empty');
          dispatch({ type: ACTIONS.HYDRATE, payload: [] });
        }
      } else {
        debug(NOTIFICATION_CONTEXT_NAME, 'No stored notifications found, initializing empty');
        dispatch({ type: ACTIONS.HYDRATE, payload: [] });
      }
    } catch (err) {
      error(NOTIFICATION_CONTEXT_NAME, 'Failed to hydrate notifications from localStorage', err);
      dispatch({ type: ACTIONS.HYDRATE, payload: [] });
    }
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) {
      return;
    }

    try {
      const jsonString = JSON.stringify(notifications);
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (err) {
      error(NOTIFICATION_CONTEXT_NAME, 'Failed to persist notifications to localStorage', err);
    }
  }, [notifications]);

  const addNotification = useCallback((type, title, message, link = null) => {
    if (!type || typeof type !== 'string') {
      warn(NOTIFICATION_CONTEXT_NAME, 'addNotification called with invalid type', { type });
      return null;
    }

    const validTypes = ['info', 'success', 'warning', 'error'];
    const safeType = validTypes.includes(type) ? type : 'info';

    if (!title || typeof title !== 'string') {
      warn(NOTIFICATION_CONTEXT_NAME, 'addNotification called with invalid title', { title });
      return null;
    }

    if (!message || typeof message !== 'string') {
      warn(NOTIFICATION_CONTEXT_NAME, 'addNotification called with invalid message', { message });
      return null;
    }

    const safeLink = link && typeof link === 'string' ? link : null;

    dispatch({
      type: ACTIONS.ADD,
      payload: {
        type: safeType,
        title,
        message,
        link: safeLink,
      },
    });

    debug(NOTIFICATION_CONTEXT_NAME, 'Notification added', {
      type: safeType,
      title,
    });

    return true;
  }, []);

  const markAsRead = useCallback((id) => {
    if (!id || typeof id !== 'string') {
      warn(NOTIFICATION_CONTEXT_NAME, 'markAsRead called with invalid id', { id });
      return false;
    }

    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      debug(NOTIFICATION_CONTEXT_NAME, 'Notification not found for markAsRead', { id });
      return false;
    }

    if (notification.isRead) {
      debug(NOTIFICATION_CONTEXT_NAME, 'Notification already marked as read', { id });
      return true;
    }

    dispatch({ type: ACTIONS.MARK_READ, payload: { id } });
    debug(NOTIFICATION_CONTEXT_NAME, 'Notification marked as read', { id });

    return true;
  }, [notifications]);

  const dismissNotification = useCallback((id) => {
    if (!id || typeof id !== 'string') {
      warn(NOTIFICATION_CONTEXT_NAME, 'dismissNotification called with invalid id', { id });
      return false;
    }

    const notification = notifications.find((n) => n.id === id);

    if (!notification) {
      debug(NOTIFICATION_CONTEXT_NAME, 'Notification not found for dismiss', { id });
      return false;
    }

    dispatch({ type: ACTIONS.DISMISS, payload: { id } });
    debug(NOTIFICATION_CONTEXT_NAME, 'Notification dismissed', { id });

    return true;
  }, [notifications]);

  const clearAll = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ALL });
    info(NOTIFICATION_CONTEXT_NAME, 'All notifications cleared');
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getUnreadNotifications = useCallback(() => {
    return notifications.filter((n) => !n.isRead);
  }, [notifications]);

  const getNotificationsByType = useCallback(
    (type) => {
      if (!type || typeof type !== 'string') {
        return [];
      }
      return notifications.filter((n) => n.type === type);
    },
    [notifications],
  );

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    dismissNotification,
    clearAll,
    getUnreadNotifications,
    getNotificationsByType,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
};

export default NotificationContext;