import { format, subDays, addDays } from 'date-fns';

/**
 * Reference date for all mock data calculations.
 * Falls back to current date if env var is not set or invalid.
 * @type {Date}
 */
const parseReferenceDate = () => {
  const envDate = import.meta.env.VITE_REFERENCE_DATE;
  if (!envDate) {
    return new Date();
  }
  const parsed = new Date(envDate);
  if (isNaN(parsed.getTime())) {
    console.warn(
      `Invalid VITE_REFERENCE_DATE "${envDate}", falling back to current date.`,
    );
    return new Date();
  }
  return parsed;
};

export const REFERENCE_DATE = parseReferenceDate();

/**
 * Persona definitions for role-based access control and demo switching.
 * Each persona has a unique id, display label, and associated permissions.
 */
export const PERSONAS = [
  {
    id: 'risk-analyst',
    label: 'Risk Analyst',
    description: 'Monitors risk metrics, investigates alerts, and manages risk cases.',
    icon: 'ShieldAlert',
    defaultDashboard: '/dashboard',
  },
  {
    id: 'compliance-officer',
    label: 'Compliance Officer',
    description: 'Ensures regulatory compliance, reviews audit trails, and manages policy exceptions.',
    icon: 'Scale',
    defaultDashboard: '/compliance',
  },
  {
    id: 'fraud-investigator',
    label: 'Fraud Investigator',
    description: 'Investigates suspicious transactions, analyzes fraud patterns, and escalates cases.',
    icon: 'Search',
    defaultDashboard: '/investigations',
  },
  {
    id: 'admin',
    label: 'Administrator',
    description: 'Full system access with user management and configuration capabilities.',
    icon: 'Settings',
    defaultDashboard: '/admin',
  },
  {
    id: 'executive',
    label: 'Executive',
    description: 'High-level overview of risk posture, KPIs, and strategic insights.',
    icon: 'TrendingUp',
    defaultDashboard: '/executive',
  },
];

/**
 * localStorage key constants to prevent key collisions and enable centralized key management.
 * @enum {string}
 */
export const STORAGE_KEYS = {
  ACTIVE_PERSONA: 'maqcrop_active_persona',
  THEME_PREFERENCE: 'maqcrop_theme',
  SIDEBAR_COLLAPSED: 'maqcrop_sidebar_collapsed',
  DASHBOARD_FILTERS: 'maqcrop_dashboard_filters',
  ALERT_FILTERS: 'maqcrop_alert_filters',
  CASE_FILTERS: 'maqcrop_case_filters',
  TABLE_PAGE_SIZE: 'maqcrop_table_page_size',
  LAST_VISITED_ROUTE: 'maqcrop_last_route',
  NOTIFICATION_PREFERENCES: 'maqcrop_notification_prefs',
  RECENT_SEARCHES: 'maqcrop_recent_searches',
  COLUMN_VISIBILITY: 'maqcrop_column_visibility',
  SORT_PREFERENCES: 'maqcrop_sort_prefs',
  DATE_RANGE_PRESETS: 'maqcrop_date_range_presets',
  ONBOARDING_COMPLETED: 'maqcrop_onboarding_completed',
  FEATURE_FLAGS_CACHE: 'maqcrop_feature_flags',
};

/**
 * Risk tier thresholds for categorizing risk scores.
 * Scores are normalized to a 0-100 scale.
 */
export const RISK_TIER_THRESHOLDS = {
  LOW: { min: 0, max: 25, label: 'Low', color: 'risk-low', badgeClass: 'badge-risk-low' },
  MEDIUM: { min: 26, max: 50, label: 'Medium', color: 'risk-medium', badgeClass: 'badge-risk-medium' },
  HIGH: { min: 51, max: 75, label: 'High', color: 'risk-high', badgeClass: 'badge-risk-high' },
  CRITICAL: { min: 76, max: 100, label: 'Critical', color: 'risk-critical', badgeClass: 'badge-risk-critical' },
};

/**
 * Determines the risk tier for a given score.
 * @param {number} score - Risk score between 0 and 100.
 * @returns {{ min: number, max: number, label: string, color: string, badgeClass: string }}
 */
export const getRiskTier = (score) => {
  if (score <= RISK_TIER_THRESHOLDS.LOW.max) return RISK_TIER_THRESHOLDS.LOW;
  if (score <= RISK_TIER_THRESHOLDS.MEDIUM.max) return RISK_TIER_THRESHOLDS.MEDIUM;
  if (score <= RISK_TIER_THRESHOLDS.HIGH.max) return RISK_TIER_THRESHOLDS.HIGH;
  return RISK_TIER_THRESHOLDS.CRITICAL;
};

/**
 * Default page size for paginated tables and lists.
 * @type {number}
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Available page size options for table pagination controls.
 * @type {number[]}
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Polling interval in milliseconds for real-time alert updates.
 * @type {number}
 */
export const ALERT_POLLING_INTERVAL_MS = 30000;

/**
 * Debounce delay in milliseconds for search inputs and filter changes.
 * @type {number}
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Maximum number of recent searches to store in localStorage.
 * @type {number}
 */
export const MAX_RECENT_SEARCHES = 10;

/**
 * Inventory of PII (Personally Identifiable Information) fields
 * used across the application for data masking and access control.
 * @type {Array<{field: string, category: string, sensitivity: string}>}
 */
export const PII_FIELDS = [
  { field: 'fullName', category: 'identity', sensitivity: 'high' },
  { field: 'firstName', category: 'identity', sensitivity: 'high' },
  { field: 'lastName', category: 'identity', sensitivity: 'high' },
  { field: 'email', category: 'contact', sensitivity: 'high' },
  { field: 'phone', category: 'contact', sensitivity: 'high' },
  { field: 'address', category: 'contact', sensitivity: 'high' },
  { field: 'city', category: 'contact', sensitivity: 'medium' },
  { field: 'state', category: 'contact', sensitivity: 'medium' },
  { field: 'zipCode', category: 'contact', sensitivity: 'medium' },
  { field: 'country', category: 'contact', sensitivity: 'low' },
  { field: 'ssn', category: 'government', sensitivity: 'critical' },
  { field: 'taxId', category: 'government', sensitivity: 'critical' },
  { field: 'passportNumber', category: 'government', sensitivity: 'critical' },
  { field: 'driversLicense', category: 'government', sensitivity: 'critical' },
  { field: 'dateOfBirth', category: 'identity', sensitivity: 'high' },
  { field: 'ipAddress', category: 'digital', sensitivity: 'medium' },
  { field: 'deviceId', category: 'digital', sensitivity: 'medium' },
  { field: 'accountNumber', category: 'financial', sensitivity: 'high' },
  { field: 'routingNumber', category: 'financial', sensitivity: 'high' },
  { field: 'creditCardNumber', category: 'financial', sensitivity: 'critical' },
  { field: 'bankName', category: 'financial', sensitivity: 'medium' },
  { field: 'transactionId', category: 'financial', sensitivity: 'low' },
];

/**
 * Permission matrix mapping personas to their allowed actions.
 * Each persona has a set of permissions defining what they can access and modify.
 * @type {Record<string, string[]>}
 */
export const ROLE_PERMISSIONS = {
  'risk-analyst': [
    'dashboard:view',
    'alerts:view',
    'alerts:acknowledge',
    'alerts:assign',
    'cases:view',
    'cases:create',
    'cases:update',
    'cases:comment',
    'reports:view',
    'reports:export',
    'investigations:view',
    'investigations:create',
    'search:use',
    'api:read',
  ],
  'compliance-officer': [
    'dashboard:view',
    'alerts:view',
    'cases:view',
    'cases:comment',
    'reports:view',
    'reports:export',
    'audit:view',
    'audit:export',
    'policies:view',
    'policies:manage',
    'regulatory:view',
    'regulatory:submit',
    'search:use',
    'api:read',
  ],
  'fraud-investigator': [
    'dashboard:view',
    'alerts:view',
    'alerts:acknowledge',
    'alerts:assign',
    'cases:view',
    'cases:create',
    'cases:update',
    'cases:comment',
    'cases:escalate',
    'investigations:view',
    'investigations:create',
    'investigations:manage',
    'reports:view',
    'reports:export',
    'search:use',
    'pii:view',
    'api:read',
  ],
  admin: [
    'dashboard:view',
    'alerts:view',
    'alerts:acknowledge',
    'alerts:assign',
    'alerts:manage',
    'cases:view',
    'cases:create',
    'cases:update',
    'cases:comment',
    'cases:escalate',
    'cases:delete',
    'investigations:view',
    'investigations:create',
    'investigations:manage',
    'reports:view',
    'reports:export',
    'reports:manage',
    'audit:view',
    'audit:export',
    'policies:view',
    'policies:manage',
    'regulatory:view',
    'regulatory:submit',
    'users:view',
    'users:manage',
    'system:configure',
    'search:use',
    'pii:view',
    'pii:export',
    'api:read',
    'api:write',
  ],
  executive: [
    'dashboard:view',
    'reports:view',
    'reports:export',
    'audit:view',
    'audit:export',
    'regulatory:view',
    'search:use',
    'api:read',
  ],
};

/**
 * Checks if a persona has a specific permission.
 * @param {string} personaId - The persona identifier.
 * @param {string} permission - The permission string to check.
 * @returns {boolean}
 */
export const hasPermission = (personaId, permission) => {
  const permissions = ROLE_PERMISSIONS[personaId];
  if (!permissions) return false;
  return permissions.includes(permission);
};

/**
 * Case status definitions with display labels and colors.
 */
export const CASE_STATUSES = {
  OPEN: { label: 'Open', color: 'status-active', badgeClass: 'badge-status-active' },
  IN_PROGRESS: { label: 'In Progress', color: 'status-active', badgeClass: 'badge-status-active' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'status-pending', badgeClass: 'badge-status-pending' },
  ESCALATED: { label: 'Escalated', color: 'status-escalated', badgeClass: 'badge-status-escalated' },
  RESOLVED: { label: 'Resolved', color: 'status-resolved', badgeClass: 'badge-status-resolved' },
  CLOSED: { label: 'Closed', color: 'status-closed', badgeClass: 'badge-status-closed' },
};

/**
 * Alert severity levels with display labels and colors.
 */
export const ALERT_SEVERITIES = {
  INFO: { label: 'Info', color: 'status-active', badgeClass: 'badge-status-active' },
  WARNING: { label: 'Warning', color: 'risk-medium', badgeClass: 'badge-risk-medium' },
  HIGH: { label: 'High', color: 'risk-high', badgeClass: 'badge-risk-high' },
  CRITICAL: { label: 'Critical', color: 'risk-critical', badgeClass: 'badge-risk-critical' },
};

/**
 * Default date range presets for dashboard filters.
 * Each preset has a label and a function that returns { startDate, endDate } relative to REFERENCE_DATE.
 */
export const DATE_RANGE_PRESETS = {
  TODAY: {
    label: 'Today',
    getRange: () => ({
      startDate: REFERENCE_DATE,
      endDate: REFERENCE_DATE,
    }),
  },
  YESTERDAY: {
    label: 'Yesterday',
    getRange: () => ({
      startDate: subDays(REFERENCE_DATE, 1),
      endDate: subDays(REFERENCE_DATE, 1),
    }),
  },
  LAST_7_DAYS: {
    label: 'Last 7 Days',
    getRange: () => ({
      startDate: subDays(REFERENCE_DATE, 6),
      endDate: REFERENCE_DATE,
    }),
  },
  LAST_30_DAYS: {
    label: 'Last 30 Days',
    getRange: () => ({
      startDate: subDays(REFERENCE_DATE, 29),
      endDate: REFERENCE_DATE,
    }),
  },
  LAST_90_DAYS: {
    label: 'Last 90 Days',
    getRange: () => ({
      startDate: subDays(REFERENCE_DATE, 89),
      endDate: REFERENCE_DATE,
    }),
  },
  THIS_MONTH: {
    label: 'This Month',
    getRange: () => {
      const start = new Date(REFERENCE_DATE.getFullYear(), REFERENCE_DATE.getMonth(), 1);
      return { startDate: start, endDate: REFERENCE_DATE };
    },
  },
  LAST_MONTH: {
    label: 'Last Month',
    getRange: () => {
      const start = new Date(REFERENCE_DATE.getFullYear(), REFERENCE_DATE.getMonth() - 1, 1);
      const end = new Date(REFERENCE_DATE.getFullYear(), REFERENCE_DATE.getMonth(), 0);
      return { startDate: start, endDate: end };
    },
  },
  CUSTOM: {
    label: 'Custom Range',
    getRange: () => ({
      startDate: subDays(REFERENCE_DATE, 30),
      endDate: REFERENCE_DATE,
    }),
  },
};

/**
 * API base path for backend services.
 * @type {string}
 */
export const API_BASE_PATH = '/api/v1';

/**
 * Maximum number of items to display in notification dropdown.
 * @type {number}
 */
export const MAX_NOTIFICATIONS_DISPLAY = 50;

/**
 * Session timeout in milliseconds (30 minutes).
 * @type {number}
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Chart color palette for consistent visualization across the application.
 * @type {string[]}
 */
export const CHART_COLORS = [
  '#4c6ef5',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
];

/**
 * Format a date consistently across the application.
 * @param {Date} date - The date to format.
 * @param {string} [formatStr='yyyy-MM-dd'] - The date-fns format string.
 * @returns {string}
 */
export const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  return format(date, formatStr);
};