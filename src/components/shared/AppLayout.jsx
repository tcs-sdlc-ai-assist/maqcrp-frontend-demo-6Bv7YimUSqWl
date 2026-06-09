import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { PERSONAS } from '../../config';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'AppLayout';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <rect x='3' y='3' width='7' height='7' />
        <rect x='14' y='3' width='7' height='7' />
        <rect x='14' y='14' width='7' height='7' />
        <rect x='3' y='14' width='7' height='7' />
      </svg>
    ),
    roles: ['risk-analyst', 'compliance-officer', 'fraud-investigator', 'admin', 'executive'],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    path: '/alerts',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
        <path d='M13.73 21a2 2 0 0 1-3.46 0' />
      </svg>
    ),
    roles: ['risk-analyst', 'compliance-officer', 'fraud-investigator', 'admin'],
  },
  {
    id: 'investigations',
    label: 'Investigations',
    path: '/investigations',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <circle cx='11' cy='11' r='8' />
        <line x1='21' y1='21' x2='16.65' y2='16.65' />
      </svg>
    ),
    roles: ['fraud-investigator', 'admin'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    path: '/compliance',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
        <polyline points='14 2 14 8 20 8' />
        <line x1='16' y1='13' x2='8' y2='13' />
        <line x1='16' y1='17' x2='8' y2='17' />
        <polyline points='10 9 9 9 8 9' />
      </svg>
    ),
    roles: ['compliance-officer', 'admin'],
  },
  {
    id: 'counterparties',
    label: 'Counterparties',
    path: '/counterparties',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </svg>
    ),
    roles: ['risk-analyst', 'compliance-officer', 'fraud-investigator', 'admin', 'executive'],
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <line x1='18' y1='20' x2='18' y2='10' />
        <line x1='12' y1='20' x2='12' y2='4' />
        <line x1='6' y1='20' x2='6' y2='14' />
      </svg>
    ),
    roles: ['risk-analyst', 'compliance-officer', 'fraud-investigator', 'admin', 'executive'],
  },
  {
    id: 'executive',
    label: 'Executive',
    path: '/executive',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
        <polyline points='17 6 23 6 23 12' />
      </svg>
    ),
    roles: ['executive', 'admin'],
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <circle cx='12' cy='12' r='3' />
        <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' />
      </svg>
    ),
    roles: ['admin'],
  },
];

const PERSONA_ICONS = {
  'risk-analyst': (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
    </svg>
  ),
  'compliance-officer': (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <path d='M12 20h9' />
      <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
    </svg>
  ),
  'fraud-investigator': (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <circle cx='11' cy='11' r='8' />
      <line x1='21' y1='21' x2='16.65' y2='16.65' />
    </svg>
  ),
  admin: (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <circle cx='12' cy='12' r='3' />
      <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' />
    </svg>
  ),
  executive: (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
      <polyline points='17 6 23 6 23 12' />
    </svg>
  ),
};

const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPersona, switchPersona, availablePersonas } = useAuth();
  const { notifications, unreadCount, markAsRead, dismissNotification } = useNotifications();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('maqcrop_sidebar_collapsed');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

  const personaDropdownRef = useRef(null);
  const personaButtonRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const notificationButtonRef = useRef(null);

  const personaId = currentPersona?.id || '';
  const personaLabel = currentPersona?.label || 'Not logged in';

  const filteredNavItems = useMemo(() => {
    if (!personaId) {
      return [];
    }

    return NAV_ITEMS.filter((item) => item.roles.includes(personaId));
  }, [personaId]);

  const isActiveRoute = useCallback(
    (path) => {
      if (path === '/dashboard') {
        return location.pathname === '/dashboard' || location.pathname === '/';
      }
      return location.pathname.startsWith(path);
    },
    [location.pathname],
  );

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('maqcrop_sidebar_collapsed', String(next));
      } catch {
        warn(COMPONENT_NAME, 'Failed to persist sidebar state');
      }
      return next;
    });
  }, []);

  const handlePersonaSwitch = useCallback(
    (personaId) => {
      if (!personaId || typeof personaId !== 'string') {
        return;
      }

      const success = switchPersona(personaId);

      if (success) {
        setIsPersonaDropdownOpen(false);

        const persona = availablePersonas.find((p) => p.id === personaId);
        if (persona && persona.defaultDashboard) {
          navigate(persona.defaultDashboard);
        }

        debug(COMPONENT_NAME, 'Persona switched', { personaId });
      }
    },
    [switchPersona, availablePersonas, navigate],
  );

  const handleNotificationClick = useCallback(
    (notification) => {
      if (!notification) return;

      if (!notification.isRead) {
        markAsRead(notification.id);
      }

      if (notification.link) {
        navigate(notification.link);
      }

      setIsNotificationDropdownOpen(false);
    },
    [markAsRead, navigate],
  );

  const handleNotificationDismiss = useCallback(
    (e, notificationId) => {
      e.stopPropagation();
      dismissNotification(notificationId);
    },
    [dismissNotification],
  );

  const handleClickOutside = useCallback((event) => {
    if (
      personaDropdownRef.current &&
      !personaDropdownRef.current.contains(event.target) &&
      personaButtonRef.current &&
      !personaButtonRef.current.contains(event.target)
    ) {
      setIsPersonaDropdownOpen(false);
    }

    if (
      notificationDropdownRef.current &&
      !notificationDropdownRef.current.contains(event.target) &&
      notificationButtonRef.current &&
      !notificationButtonRef.current.contains(event.target)
    ) {
      setIsNotificationDropdownOpen(false);
    }
  }, []);

  const handleEscapeKey = useCallback((event) => {
    if (event.key === 'Escape') {
      setIsPersonaDropdownOpen(false);
      setIsNotificationDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleClickOutside, handleEscapeKey]);

  const recentNotifications = useMemo(() => {
    if (!Array.isArray(notifications)) {
      return [];
    }
    return notifications.slice(0, 10);
  }, [notifications]);

  const notificationTypeIcon = (type) => {
    switch (type) {
      case 'error':
        return (
          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <circle cx='12' cy='12' r='10' />
              <line x1='15' y1='9' x2='9' y2='15' />
              <line x1='9' y1='9' x2='15' y2='15' />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-600'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
              <line x1='12' y1='9' x2='12' y2='13' />
              <line x1='12' y1='17' x2='12.01' y2='17' />
            </svg>
          </div>
        );
      case 'success':
        return (
          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <polyline points='20 6 9 17 4 12' />
            </svg>
          </div>
        );
      default:
        return (
          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <circle cx='12' cy='12' r='10' />
              <line x1='12' y1='16' x2='12' y2='12' />
              <line x1='12' y1='8' x2='12.01' y2='8' />
            </svg>
          </div>
        );
    }
  };

  const formatNotificationTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className='flex h-screen overflow-hidden bg-gray-50'>
      <aside
        className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className='flex items-center justify-between h-16 px-4 border-b border-gray-100'>
          {!isSidebarCollapsed && (
            <Link
              to='/dashboard'
              className='flex items-center gap-2 text-enterprise-700 font-bold text-lg'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-6 h-6'
              >
                <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
              </svg>
              <span className='whitespace-nowrap'>MAQCrop</span>
            </Link>
          )}
          {isSidebarCollapsed && (
            <Link to='/dashboard' className='mx-auto' title='MAQCrop Dashboard'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-6 h-6 text-enterprise-700'
              >
                <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
              </svg>
            </Link>
          )}
          <button
            type='button'
            onClick={handleToggleSidebar}
            className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className={`w-5 h-5 transition-transform duration-300 ${
                isSidebarCollapsed ? 'rotate-180' : ''
              }`}
            >
              <polyline points='15 18 9 12 15 6' />
            </svg>
          </button>
        </div>

        <nav className='flex-1 overflow-y-auto py-4 px-2 space-y-1'>
          {filteredNavItems.map((item) => {
            const active = isActiveRoute(item.path);

            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group ${
                  active
                    ? 'bg-enterprise-50 text-enterprise-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span
                  className={`flex-shrink-0 ${
                    active ? 'text-enterprise-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`}
                >
                  {item.icon}
                </span>
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className='border-t border-gray-100 p-3'>
          {!isSidebarCollapsed && (
            <div className='text-xs text-gray-400 px-3 mb-2 uppercase tracking-wider'>
              Persona
            </div>
          )}
          <div className='relative'>
            <button
              ref={personaButtonRef}
              type='button'
              onClick={() => setIsPersonaDropdownOpen((prev) => !prev)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 ${
                isSidebarCollapsed ? 'justify-center' : ''
              }`}
              aria-haspopup='true'
              aria-expanded={isPersonaDropdownOpen}
            >
              <span className='flex-shrink-0 text-enterprise-600'>
                {PERSONA_ICONS[personaId] || PERSONA_ICONS['risk-analyst']}
              </span>
              {!isSidebarCollapsed && (
                <>
                  <span className='flex-1 text-left truncate'>{personaLabel}</span>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                      isPersonaDropdownOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <polyline points='6 9 12 15 18 9' />
                  </svg>
                </>
              )}
            </button>

            {isPersonaDropdownOpen && (
              <div
                ref={personaDropdownRef}
                className={`absolute bottom-full left-0 mb-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-scale-in ${
                  isSidebarCollapsed ? 'left-full ml-1 bottom-auto top-0' : ''
                }`}
                role='menu'
                aria-label='Switch persona'
              >
                {availablePersonas.map((persona) => (
                  <button
                    key={persona.id}
                    type='button'
                    onClick={() => handlePersonaSwitch(persona.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
                      persona.id === personaId
                        ? 'bg-enterprise-50 text-enterprise-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    role='menuitem'
                  >
                    <span className='flex-shrink-0'>
                      {PERSONA_ICONS[persona.id] || PERSONA_ICONS['risk-analyst']}
                    </span>
                    <div className='flex-1 text-left'>
                      <div className='font-medium'>{persona.label}</div>
                      <div className='text-xs text-gray-400 font-normal'>{persona.description}</div>
                    </div>
                    {persona.id === personaId && (
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={2}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-4 h-4 text-enterprise-600 flex-shrink-0'
                      >
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className='flex-1 flex flex-col overflow-hidden'>
        <header className='flex-shrink-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6'>
          <div className='flex items-center gap-3'>
            <h1 className='text-lg font-semibold text-gray-900'>
              {personaLabel}
            </h1>
            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-enterprise-50 text-enterprise-700'>
              {personaId || 'No persona'}
            </span>
          </div>

          <div className='flex items-center gap-3'>
            <div className='relative'>
              <button
                ref={notificationButtonRef}
                type='button'
                onClick={() => setIsNotificationDropdownOpen((prev) => !prev)}
                className='relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-5 h-5'
                >
                  <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                  <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                </svg>
                {unreadCount > 0 && (
                  <span className='absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white bg-red-500 ring-2 ring-white'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationDropdownOpen && (
                <div
                  ref={notificationDropdownRef}
                  className='absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-scale-in'
                  role='menu'
                  aria-label='Notifications'
                >
                  <div className='flex items-center justify-between px-4 py-3 border-b border-gray-100'>
                    <h3 className='text-sm font-semibold text-gray-900'>Notifications</h3>
                    {unreadCount > 0 && (
                      <span className='text-xs text-enterprise-600 font-medium'>
                        {unreadCount} unread
                      </span>
                    )}
                  </div>

                  <div className='max-h-80 overflow-y-auto'>
                    {recentNotifications.length === 0 ? (
                      <div className='px-4 py-8 text-center'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={1.5}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='w-8 h-8 text-gray-300 mx-auto mb-2'
                        >
                          <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                          <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                        </svg>
                        <p className='text-sm text-gray-500'>No notifications yet</p>
                      </div>
                    ) : (
                      recentNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          type='button'
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 border-b border-gray-50 last:border-b-0 ${
                            !notification.isRead ? 'bg-blue-50/50' : ''
                          }`}
                          role='menuitem'
                        >
                          {notificationTypeIcon(notification.type)}
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-gray-900 truncate'>
                              {notification.title}
                            </p>
                            <p className='text-xs text-gray-500 mt-0.5 line-clamp-2'>
                              {notification.message}
                            </p>
                            <p className='text-xs text-gray-400 mt-1'>
                              {formatNotificationTime(notification.createdAt)}
                            </p>
                          </div>
                          <button
                            type='button'
                            onClick={(e) => handleNotificationDismiss(e, notification.id)}
                            className='flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150'
                            aria-label='Dismiss notification'
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth={2}
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-3.5 h-3.5'
                            >
                              <line x1='18' y1='6' x2='6' y2='18' />
                              <line x1='6' y1='6' x2='18' y2='18' />
                            </svg>
                          </button>
                        </button>
                      ))
                    )}
                  </div>

                  {notifications.length > 10 && (
                    <div className='px-4 py-2 border-t border-gray-100'>
                      <Link
                        to='/notifications'
                        onClick={() => setIsNotificationDropdownOpen(false)}
                        className='block text-center text-xs text-enterprise-600 hover:text-enterprise-700 font-medium py-1'
                      >
                        View all notifications
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='flex items-center gap-2 pl-3 border-l border-gray-200'>
              <div className='w-8 h-8 rounded-full bg-enterprise-100 flex items-center justify-center text-enterprise-700 font-semibold text-sm'>
                {personaLabel.charAt(0).toUpperCase()}
              </div>
              <span className='text-sm font-medium text-gray-700 hidden sm:block'>
                {personaLabel}
              </span>
            </div>
          </div>
        </header>

        <main className='flex-1 overflow-y-auto'>
          <div className='p-6'>{children}</div>
        </main>
      </div>
    </div>
  );
};

AppLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppLayout;