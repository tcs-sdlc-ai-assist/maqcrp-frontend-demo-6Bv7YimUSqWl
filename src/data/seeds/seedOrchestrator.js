import { seedLoans } from './seedLoans';
import { seedSellers } from './seedSellers';
import { seedQCCases } from './seedQCCases';
import { seedDefects } from './seedDefects';
import { seedRepurchases } from './seedRepurchases';
import { seedRules } from './seedRules';
import { seedChecklists } from './seedChecklists';
import { seedAuditLog } from './seedAuditLog';
import { STORAGE_KEYS } from '../../config';
import { debug, info, warn, error } from '../../utils/logger';

/**
 * Current data version for localStorage schema.
 * Increment this when the data structure changes to trigger re-seeding.
 * @type {number}
 */
export const DATA_VERSION = 1;

/**
 * Key used to store the data version in localStorage.
 * @type {string}
 */
const DATA_VERSION_KEY = 'maqcrop_data_version';

/**
 * Key used to store the seeded flag in localStorage.
 * @type {string}
 */
const SEEDED_KEY = 'maqcrop_seeded';

/**
 * All localStorage keys managed by the seed orchestrator.
 * Used for clearing data during reset.
 * @type {string[]}
 */
const ALL_DOMAIN_KEYS = [
  STORAGE_KEYS.ACTIVE_PERSONA,
  STORAGE_KEYS.THEME_PREFERENCE,
  STORAGE_KEYS.SIDEBAR_COLLAPSED,
  STORAGE_KEYS.DASHBOARD_FILTERS,
  STORAGE_KEYS.ALERT_FILTERS,
  STORAGE_KEYS.CASE_FILTERS,
  STORAGE_KEYS.TABLE_PAGE_SIZE,
  STORAGE_KEYS.LAST_VISITED_ROUTE,
  STORAGE_KEYS.NOTIFICATION_PREFERENCES,
  STORAGE_KEYS.RECENT_SEARCHES,
  STORAGE_KEYS.COLUMN_VISIBILITY,
  STORAGE_KEYS.SORT_PREFERENCES,
  STORAGE_KEYS.DATE_RANGE_PRESETS,
  STORAGE_KEYS.ONBOARDING_COMPLETED,
  STORAGE_KEYS.FEATURE_FLAGS_CACHE,
  'maqcrop_loans',
  'maqcrop_sellers',
  'maqcrop_rules',
  'maqcrop_rule_versions',
  'maqcrop_qc_cases',
  'maqcrop_checklist_templates',
  'maqcrop_defects',
  'maqcrop_defect_taxonomy',
  'maqcrop_remedy_cases',
  'maqcrop_repurchase_cases',
  'maqcrop_audit_log',
  'maqcrop_notifications',
  'maqcrop_sampling_configs',
  'maqcrop_auth',
];

/**
 * Serializes data to a JSON string for localStorage storage.
 * @param {*} data - The data to serialize.
 * @returns {string} The JSON string.
 * @throws {Error} If serialization fails.
 */
const serialize = (data) => {
  try {
    return JSON.stringify(data);
  } catch (err) {
    error('seedOrchestrator: Failed to serialize data', err);
    throw new Error('Failed to serialize seed data.');
  }
};

/**
 * Safely writes data to localStorage with error handling.
 * @param {string} key - The localStorage key.
 * @param {*} data - The data to store.
 * @returns {boolean} True if the write was successful.
 */
const safeSetItem = (key, data) => {
  try {
    const jsonString = serialize(data);
    localStorage.setItem(key, jsonString);
    debug('seedOrchestrator: Data written to localStorage', { key });
    return true;
  } catch (err) {
    error('seedOrchestrator: Failed to write to localStorage', { key }, err);
    return false;
  }
};

/**
 * Safely removes an item from localStorage with error handling.
 * @param {string} key - The localStorage key to remove.
 * @returns {boolean} True if the removal was successful.
 */
const safeRemoveItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    error('seedOrchestrator: Failed to remove from localStorage', { key }, err);
    return false;
  }
};

/**
 * Checks if seed data exists in localStorage and is at the current data version.
 * @returns {boolean} True if data is already seeded and up to date.
 */
const isAlreadySeeded = () => {
  try {
    const seededFlag = localStorage.getItem(SEEDED_KEY);
    const storedVersion = localStorage.getItem(DATA_VERSION_KEY);

    if (!seededFlag || seededFlag !== 'true') {
      debug('seedOrchestrator: Seed flag not set or false');
      return false;
    }

    if (!storedVersion || parseInt(storedVersion, 10) < DATA_VERSION) {
      debug('seedOrchestrator: Data version mismatch', {
        stored: storedVersion,
        current: DATA_VERSION,
      });
      return false;
    }

    const loansExist = localStorage.getItem('maqcrop_loans');
    if (!loansExist) {
      debug('seedOrchestrator: Core data missing (loans)');
      return false;
    }

    return true;
  } catch (err) {
    error('seedOrchestrator: Failed to check seed status', err);
    return false;
  }
};

/**
 * Clears all application data from localStorage.
 * Removes all keys managed by the seed orchestrator.
 * @returns {boolean} True if the clear operation was successful.
 */
const clearAllDomainKeys = () => {
  let allCleared = true;

  for (const key of ALL_DOMAIN_KEYS) {
    const success = safeRemoveItem(key);
    if (!success) {
      allCleared = false;
    }
  }

  safeRemoveItem(SEEDED_KEY);
  safeRemoveItem(DATA_VERSION_KEY);

  if (allCleared) {
    info('seedOrchestrator: All domain keys cleared');
  } else {
    warn('seedOrchestrator: Some domain keys failed to clear');
  }

  return allCleared;
};

/**
 * Runs all seed factories in dependency order and writes results to localStorage.
 *
 * Dependency order:
 * 1. Sellers (no dependencies)
 * 2. Loans (no dependencies)
 * 3. Rules (no dependencies)
 * 4. Checklists (no dependencies)
 * 5. QC Cases (depends on Loans)
 * 6. Defects (depends on QC Cases, Sellers)
 * 7. Repurchases (no dependencies, but references Loans and Defects)
 * 8. Audit Log (no dependencies, but references all entities)
 *
 * @returns {boolean} True if seeding was successful.
 */
const runSeedFactories = () => {
  try {
    info('seedOrchestrator: Starting seed data generation');

    const sellers = seedSellers();
    if (!safeSetItem('maqcrop_sellers', sellers)) {
      throw new Error('Failed to seed sellers');
    }
    debug('seedOrchestrator: Sellers seeded', { count: sellers.length });

    const loans = seedLoans();
    if (!safeSetItem('maqcrop_loans', loans)) {
      throw new Error('Failed to seed loans');
    }
    debug('seedOrchestrator: Loans seeded', { count: loans.length });

    const { rules, ruleVersions } = seedRules();
    if (!safeSetItem('maqcrop_rules', rules)) {
      throw new Error('Failed to seed rules');
    }
    if (!safeSetItem('maqcrop_rule_versions', ruleVersions)) {
      throw new Error('Failed to seed rule versions');
    }
    debug('seedOrchestrator: Rules seeded', {
      ruleCount: rules.length,
      versionCount: ruleVersions.length,
    });

    const checklists = seedChecklists();
    if (!safeSetItem('maqcrop_checklist_templates', checklists)) {
      throw new Error('Failed to seed checklists');
    }
    debug('seedOrchestrator: Checklists seeded', { count: checklists.length });

    const loanIds = loans.map((loan) => loan.id);
    const qcCases = seedQCCases(loanIds);
    if (!safeSetItem('maqcrop_qc_cases', qcCases)) {
      throw new Error('Failed to seed QC cases');
    }
    debug('seedOrchestrator: QC cases seeded', { count: qcCases.length });

    const qcCaseLoanPairs = qcCases.map((qc) => ({
      id: qc.id,
      loanId: qc.loanId,
    }));

    const { defects, taxonomy } = seedDefects(qcCaseLoanPairs, sellers);
    if (!safeSetItem('maqcrop_defects', defects)) {
      throw new Error('Failed to seed defects');
    }
    if (!safeSetItem('maqcrop_defect_taxonomy', taxonomy)) {
      throw new Error('Failed to seed defect taxonomy');
    }
    debug('seedOrchestrator: Defects seeded', {
      defectCount: defects.length,
      taxonomyVersion: taxonomy.version,
    });

    const repurchases = seedRepurchases();
    if (!safeSetItem('maqcrop_repurchase_cases', repurchases)) {
      throw new Error('Failed to seed repurchases');
    }
    debug('seedOrchestrator: Repurchases seeded', { count: repurchases.length });

    const auditLog = seedAuditLog();
    if (!safeSetItem('maqcrop_audit_log', auditLog)) {
      throw new Error('Failed to seed audit log');
    }
    debug('seedOrchestrator: Audit log seeded', { count: auditLog.length });

    if (!safeSetItem('maqcrop_remedy_cases', [])) {
      throw new Error('Failed to seed remedy cases');
    }
    debug('seedOrchestrator: Remedy cases initialized (empty)');

    if (!safeSetItem('maqcrop_notifications', [])) {
      throw new Error('Failed to seed notifications');
    }
    debug('seedOrchestrator: Notifications initialized (empty)');

    if (!safeSetItem('maqcrop_sampling_configs', [])) {
      throw new Error('Failed to seed sampling configs');
    }
    debug('seedOrchestrator: Sampling configs initialized (empty)');

    if (!safeSetItem('maqcrop_auth', null)) {
      throw new Error('Failed to seed auth');
    }
    debug('seedOrchestrator: Auth initialized (null)');

    localStorage.setItem(SEEDED_KEY, 'true');
    localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION));

    info('seedOrchestrator: Seed data generation complete', {
      loans: loans.length,
      sellers: sellers.length,
      rules: rules.length,
      qcCases: qcCases.length,
      defects: defects.length,
      repurchases: repurchases.length,
      auditEntries: auditLog.length,
      dataVersion: DATA_VERSION,
    });

    return true;
  } catch (err) {
    error('seedOrchestrator: Seed data generation failed', err);
    return false;
  }
};

/**
 * Checks if seed data needs to be generated and runs the seed factories if necessary.
 * This is the main entry point — call once during application startup.
 *
 * Scenarios handled:
 * - First load (no data in localStorage): Runs full seed
 * - Data version mismatch: Clears old data and re-seeds
 * - Corrupted data (missing core collections): Clears and re-seeds
 * - Already seeded and up to date: No-op
 *
 * @returns {{ seeded: boolean, wasReset: boolean }} Result object indicating what happened.
 *
 * @example
 * const result = checkAndSeed();
 * if (result.seeded) {
 *   console.log('Data is ready');
 * }
 */
export const checkAndSeed = () => {
  try {
    if (isAlreadySeeded()) {
      info('seedOrchestrator: Data already seeded and up to date');
      return { seeded: true, wasReset: false };
    }

    info('seedOrchestrator: Seed data needed — clearing and re-seeding');
    clearAllDomainKeys();

    const success = runSeedFactories();

    if (!success) {
      error('seedOrchestrator: Seed data generation failed after clearing');
      return { seeded: false, wasReset: true };
    }

    return { seeded: true, wasReset: true };
  } catch (err) {
    error('seedOrchestrator: Unexpected error during checkAndSeed', err);
    return { seeded: false, wasReset: false };
  }
};

/**
 * Resets all application data by clearing all domain keys and re-running seed factories.
 * This is a destructive operation — all user modifications will be lost.
 *
 * @returns {boolean} True if the reset and re-seed was successful.
 *
 * @example
 * const success = resetData();
 * if (success) {
 *   console.log('Data has been reset to defaults');
 * }
 */
export const resetData = () => {
  try {
    info('seedOrchestrator: Resetting all data');

    clearAllDomainKeys();

    const success = runSeedFactories();

    if (!success) {
      error('seedOrchestrator: Failed to re-seed after reset');
      return false;
    }

    info('seedOrchestrator: Data reset complete');
    return true;
  } catch (err) {
    error('seedOrchestrator: Unexpected error during resetData', err);
    return false;
  }
};

/**
 * Returns the current seed status information.
 * Useful for debugging and displaying seed information in admin panels.
 *
 * @returns {Object} Seed status information.
 * @returns {boolean} returns.isSeeded - Whether data has been seeded.
 * @returns {number} returns.dataVersion - The current data version.
 * @returns {number|null} returns.storedVersion - The version stored in localStorage, or null.
 * @returns {Object} returns.counts - Count of records in each collection.
 *
 * @example
 * const status = getSeedStatus();
 * console.log(`Seeded: ${status.isSeeded}, Loans: ${status.counts.loans}`);
 */
export const getSeedStatus = () => {
  try {
    const isSeeded = isAlreadySeeded();
    const storedVersionRaw = localStorage.getItem(DATA_VERSION_KEY);
    const storedVersion = storedVersionRaw ? parseInt(storedVersionRaw, 10) : null;

    const counts = {
      loans: 0,
      sellers: 0,
      rules: 0,
      qcCases: 0,
      defects: 0,
      repurchases: 0,
      auditEntries: 0,
      remedyCases: 0,
      notifications: 0,
    };

    try {
      const loansRaw = localStorage.getItem('maqcrop_loans');
      if (loansRaw) {
        const loans = JSON.parse(loansRaw);
        counts.loans = Array.isArray(loans) ? loans.length : 0;
      }
    } catch {
      counts.loans = 0;
    }

    try {
      const sellersRaw = localStorage.getItem('maqcrop_sellers');
      if (sellersRaw) {
        const sellers = JSON.parse(sellersRaw);
        counts.sellers = Array.isArray(sellers) ? sellers.length : 0;
      }
    } catch {
      counts.sellers = 0;
    }

    try {
      const rulesRaw = localStorage.getItem('maqcrop_rules');
      if (rulesRaw) {
        const rules = JSON.parse(rulesRaw);
        counts.rules = Array.isArray(rules) ? rules.length : 0;
      }
    } catch {
      counts.rules = 0;
    }

    try {
      const qcRaw = localStorage.getItem('maqcrop_qc_cases');
      if (qcRaw) {
        const qcCases = JSON.parse(qcRaw);
        counts.qcCases = Array.isArray(qcCases) ? qcCases.length : 0;
      }
    } catch {
      counts.qcCases = 0;
    }

    try {
      const defectsRaw = localStorage.getItem('maqcrop_defects');
      if (defectsRaw) {
        const defects = JSON.parse(defectsRaw);
        counts.defects = Array.isArray(defects) ? defects.length : 0;
      }
    } catch {
      counts.defects = 0;
    }

    try {
      const repurchasesRaw = localStorage.getItem('maqcrop_repurchase_cases');
      if (repurchasesRaw) {
        const repurchases = JSON.parse(repurchasesRaw);
        counts.repurchases = Array.isArray(repurchases) ? repurchases.length : 0;
      }
    } catch {
      counts.repurchases = 0;
    }

    try {
      const auditRaw = localStorage.getItem('maqcrop_audit_log');
      if (auditRaw) {
        const auditEntries = JSON.parse(auditRaw);
        counts.auditEntries = Array.isArray(auditEntries) ? auditEntries.length : 0;
      }
    } catch {
      counts.auditEntries = 0;
    }

    try {
      const remedyRaw = localStorage.getItem('maqcrop_remedy_cases');
      if (remedyRaw) {
        const remedyCases = JSON.parse(remedyRaw);
        counts.remedyCases = Array.isArray(remedyCases) ? remedyCases.length : 0;
      }
    } catch {
      counts.remedyCases = 0;
    }

    try {
      const notifRaw = localStorage.getItem('maqcrop_notifications');
      if (notifRaw) {
        const notifications = JSON.parse(notifRaw);
        counts.notifications = Array.isArray(notifications) ? notifications.length : 0;
      }
    } catch {
      counts.notifications = 0;
    }

    return {
      isSeeded,
      dataVersion: DATA_VERSION,
      storedVersion,
      counts,
    };
  } catch (err) {
    error('seedOrchestrator: Failed to get seed status', err);
    return {
      isSeeded: false,
      dataVersion: DATA_VERSION,
      storedVersion: null,
      counts: {
        loans: 0,
        sellers: 0,
        rules: 0,
        qcCases: 0,
        defects: 0,
        repurchases: 0,
        auditEntries: 0,
        remedyCases: 0,
        notifications: 0,
      },
    };
  }
};

export default checkAndSeed;