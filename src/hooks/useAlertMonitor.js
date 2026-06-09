import { useState, useEffect, useCallback, useRef } from 'react';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { useNotifications } from '../contexts/NotificationContext';
import { evaluateAllThresholds, getActiveAlerts } from '../services/alertEvaluator';
import { debug, info, warn, error } from '../utils/logger';

const HOOK_NAME = 'useAlertMonitor';

const DEFAULT_POLLING_INTERVAL_MS = 30000;
const MIN_POLLING_INTERVAL_MS = 10000;
const MAX_POLLING_INTERVAL_MS = 300000;

/**
 * @typedef {Object} BreachedAlert
 * @property {string} breachId
 * @property {string} ruleId
 * @property {string} ruleName
 * @property {string} counterpartyId
 * @property {string} counterpartyName
 * @property {string} metric
 * @property {string} operator
 * @property {number} configuredValue
 * @property {number} actualValue
 * @property {string} severity
 * @property {string} triggeredAt
 * @property {boolean} acknowledged
 * @property {string|null} acknowledgedBy
 * @property {string|null} acknowledgedAt
 * @property {string|null} resolvedAt
 */

/**
 * @typedef {Object} AlertMonitorResult
 * @property {BreachedAlert[]} breachedAlerts
 * @property {boolean} isMonitoring
 * @property {number} pollingInterval
 * @property {Function} setPollingInterval
 * @property {Function} acknowledgeAlert
 * @property {Function} resolveAlert
 * @property {Function} startMonitoring
 * @property {Function} stopMonitoring
 * @property {Function} forceEvaluate
 * @property {number} activeAlertCount
 * @property {string|null} lastEvaluatedAt
 */

/**
 * Custom hook that monitors alert thresholds on a configurable polling interval.
 *
 * Evaluates all enabled alert rules against current counterparty data and
 * dispatches notifications when new breaches are detected. Manages the
 * lifecycle of the polling interval and provides controls for manual
 * evaluation, acknowledgment, and resolution of alerts.
 *
 * @param {number} [initialIntervalMs=30000] - Initial polling interval in milliseconds.
 * @returns {AlertMonitorResult}
 *
 * @example
 * const {
 *   breachedAlerts,
 *   isMonitoring,
 *   pollingInterval,
 *   setPollingInterval,
 *   acknowledgeAlert,
 *   activeAlertCount,
 *   lastEvaluatedAt,
 * } = useAlertMonitor(30000);
 */
export const useAlertMonitor = (initialIntervalMs = DEFAULT_POLLING_INTERVAL_MS) => {
  const {
    sellers,
    defects,
    remedyCases,
    repurchaseCases,
    loans,
    isLoading: isMockDataLoading,
  } = useMockData();

  const {
    alertRules,
    getEnabledAlertRules,
  } = useOversight();

  const {
    addNotification,
  } = useNotifications();

  const [breachedAlerts, setBreachedAlerts] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [pollingInterval, setPollingIntervalState] = useState(() => {
    const safeInterval = typeof initialIntervalMs === 'number' && initialIntervalMs >= MIN_POLLING_INTERVAL_MS
      ? initialIntervalMs
      : DEFAULT_POLLING_INTERVAL_MS;
    return Math.min(safeInterval, MAX_POLLING_INTERVAL_MS);
  });

  const intervalRef = useRef(null);
  const isEvaluatingRef = useRef(false);
  const lastEvaluatedAtRef = useRef(null);
  const previousBreachIdsRef = useRef(new Set());
  const isMountedRef = useRef(true);

  const safeSellers = Array.isArray(sellers) ? sellers : [];
  const safeDefects = Array.isArray(defects) ? defects : [];
  const safeRemedies = Array.isArray(remedyCases) ? remedyCases : [];
  const safeRepurchases = Array.isArray(repurchaseCases) ? repurchaseCases : [];
  const safeLoans = Array.isArray(loans) ? loans : [];

  const counterparties = safeSellers.map((seller) => ({
    id: seller.id,
    name: seller.name,
    status: seller.status,
    performanceMetrics: seller.performanceMetrics,
  }));

  const evaluateAlerts = useCallback(() => {
    if (isEvaluatingRef.current) {
      debug(HOOK_NAME, 'Evaluation already in progress, skipping');
      return;
    }

    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Mock data is loading, deferring alert evaluation');
      return;
    }

    isEvaluatingRef.current = true;

    try {
      const enabledRules = getEnabledAlertRules();

      if (enabledRules.length === 0) {
        debug(HOOK_NAME, 'No enabled alert rules to evaluate');
        isEvaluatingRef.current = false;
        return;
      }

      if (counterparties.length === 0) {
        debug(HOOK_NAME, 'No counterparties available for alert evaluation');
        isEvaluatingRef.current = false;
        return;
      }

      const allBreaches = evaluateAllThresholds(
        enabledRules,
        counterparties,
        safeDefects,
        safeRemedies,
        safeRepurchases,
      );

      const activeBreaches = getActiveAlerts(allBreaches);

      const currentBreachIds = new Set(activeBreaches.map((b) => b.breachId));

      const newBreaches = activeBreaches.filter(
        (breach) => !previousBreachIdsRef.current.has(breach.breachId),
      );

      for (const breach of newBreaches) {
        const severityLabel = breach.severity || 'warning';
        const notificationType = severityLabel === 'critical' ? 'error' : 'warning';

        addNotification(
          notificationType,
          `Alert: ${breach.ruleName || 'Threshold Breached'}`,
          `${breach.counterpartyName || breach.counterpartyId}: ${breach.metric} is ${breach.actualValue} (threshold: ${breach.operator} ${breach.configuredValue})`,
          `/risk/counterparty/${breach.counterpartyId}`,
        );

        debug(HOOK_NAME, 'New alert breach detected', {
          breachId: breach.breachId,
          counterpartyId: breach.counterpartyId,
          metric: breach.metric,
          severity: breach.severity,
        });
      }

      previousBreachIdsRef.current = currentBreachIds;

      if (isMountedRef.current) {
        setBreachedAlerts(activeBreaches);
      }

      lastEvaluatedAtRef.current = new Date().toISOString();

      info(HOOK_NAME, 'Alert evaluation cycle completed', {
        totalBreaches: allBreaches.length,
        activeBreaches: activeBreaches.length,
        newBreaches: newBreaches.length,
      });
    } catch (err) {
      error(HOOK_NAME, 'Alert evaluation failed', err);
    } finally {
      isEvaluatingRef.current = false;
    }
  }, [
    isMockDataLoading,
    getEnabledAlertRules,
    counterparties,
    safeDefects,
    safeRemedies,
    safeRepurchases,
    addNotification,
  ]);

  const startMonitoring = useCallback(() => {
    if (intervalRef.current) {
      debug(HOOK_NAME, 'Monitoring already active, clearing existing interval');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    evaluateAlerts();

    intervalRef.current = setInterval(() => {
      evaluateAlerts();
    }, pollingInterval);

    setIsMonitoring(true);

    info(HOOK_NAME, 'Alert monitoring started', {
      pollingIntervalMs: pollingInterval,
    });
  }, [evaluateAlerts, pollingInterval]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsMonitoring(false);

    info(HOOK_NAME, 'Alert monitoring stopped');
  }, []);

  const setPollingInterval = useCallback((newIntervalMs) => {
    if (typeof newIntervalMs !== 'number' || isNaN(newIntervalMs)) {
      warn(HOOK_NAME, 'setPollingInterval called with invalid value', { newIntervalMs });
      return;
    }

    const clampedInterval = Math.max(
      MIN_POLLING_INTERVAL_MS,
      Math.min(newIntervalMs, MAX_POLLING_INTERVAL_MS),
    );

    setPollingIntervalState(clampedInterval);

    if (isMonitoring && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        evaluateAlerts();
      }, clampedInterval);

      debug(HOOK_NAME, 'Polling interval updated while monitoring', {
        previousInterval: pollingInterval,
        newInterval: clampedInterval,
      });
    }

    debug(HOOK_NAME, 'Polling interval set', { intervalMs: clampedInterval });
  }, [isMonitoring, evaluateAlerts, pollingInterval]);

  const acknowledgeAlert = useCallback((breachId) => {
    if (!breachId || typeof breachId !== 'string') {
      warn(HOOK_NAME, 'acknowledgeAlert called with invalid breachId', { breachId });
      return false;
    }

    setBreachedAlerts((prev) =>
      prev.map((alert) => {
        if (alert && alert.breachId === breachId) {
          return {
            ...alert,
            acknowledged: true,
            acknowledgedBy: 'User',
            acknowledgedAt: new Date().toISOString(),
          };
        }
        return alert;
      }),
    );

    debug(HOOK_NAME, 'Alert acknowledged', { breachId });

    return true;
  }, []);

  const resolveAlert = useCallback((breachId) => {
    if (!breachId || typeof breachId !== 'string') {
      warn(HOOK_NAME, 'resolveAlert called with invalid breachId', { breachId });
      return false;
    }

    setBreachedAlerts((prev) =>
      prev.map((alert) => {
        if (alert && alert.breachId === breachId) {
          return {
            ...alert,
            resolvedAt: new Date().toISOString(),
          };
        }
        return alert;
      }),
    );

    previousBreachIdsRef.current.delete(breachId);

    debug(HOOK_NAME, 'Alert resolved', { breachId });

    return true;
  }, []);

  const forceEvaluate = useCallback(() => {
    debug(HOOK_NAME, 'Manual alert evaluation triggered');
    evaluateAlerts();
  }, [evaluateAlerts]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMockDataLoading) {
      return;
    }

    startMonitoring();

    return () => {
      stopMonitoring();
    };
  }, [isMockDataLoading, startMonitoring, stopMonitoring]);

  const activeAlertCount = breachedAlerts.filter(
    (alert) => alert && !alert.acknowledged && !alert.resolvedAt,
  ).length;

  const lastEvaluatedAt = lastEvaluatedAtRef.current;

  return {
    breachedAlerts,
    isMonitoring,
    pollingInterval,
    setPollingInterval,
    acknowledgeAlert,
    resolveAlert,
    startMonitoring,
    stopMonitoring,
    forceEvaluate,
    activeAlertCount,
    lastEvaluatedAt,
  };
};

export default useAlertMonitor;