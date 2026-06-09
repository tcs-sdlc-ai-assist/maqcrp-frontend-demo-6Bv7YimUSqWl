import { debug, info, warn, error } from '../utils/logger';

const ALERT_EVALUATOR_NAME = 'AlertEvaluator';

const VALID_METRICS = [
  'overallDefectRate',
  'remedyResponseTime',
  'repurchaseExposure',
  'slaBreachCount',
  'highSeverityDefectRate',
];

const VALID_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];

const DEFAULT_THRESHOLD = {
  breached: false,
  actualValue: 0,
  threshold: 0,
  operator: 'gt',
  metric: '',
};

/**
 * Validates that a metric name is one of the supported metrics.
 * @param {string} metric - The metric name to validate.
 * @returns {boolean}
 */
const isValidMetric = (metric) => {
  return VALID_METRICS.includes(metric);
};

/**
 * Validates that an operator is one of the supported operators.
 * @param {string} operator - The operator to validate.
 * @returns {boolean}
 */
const isValidOperator = (operator) => {
  return VALID_OPERATORS.includes(operator);
};

/**
 * Evaluates a comparison between an actual value and a threshold value
 * using the specified operator.
 *
 * @param {number} actualValue - The actual metric value.
 * @param {string} operator - The comparison operator.
 * @param {number} thresholdValue - The threshold value to compare against.
 * @returns {boolean} True if the threshold is breached.
 */
const evaluateOperator = (actualValue, operator, thresholdValue) => {
  if (actualValue === null || actualValue === undefined || isNaN(actualValue)) {
    return false;
  }

  if (thresholdValue === null || thresholdValue === undefined || isNaN(thresholdValue)) {
    return false;
  }

  switch (operator) {
    case 'gt':
      return actualValue > thresholdValue;
    case 'gte':
      return actualValue >= thresholdValue;
    case 'lt':
      return actualValue < thresholdValue;
    case 'lte':
      return actualValue <= thresholdValue;
    case 'eq':
      return actualValue === thresholdValue;
    case 'neq':
      return actualValue !== thresholdValue;
    default:
      return false;
  }
};

/**
 * Calculates the overall defect rate for a counterparty.
 * Defect rate = total defects / total loans.
 *
 * @param {Array<Object>} defects - Array of defect objects for the counterparty.
 * @param {Array<Object>} loans - Array of loan objects for the counterparty.
 * @returns {number} Defect rate as a decimal (0.0 to 1.0).
 */
const calculateOverallDefectRate = (defects, loans) => {
  const loanCount = Array.isArray(loans) ? loans.length : 0;

  if (loanCount === 0) {
    return 0;
  }

  const defectCount = Array.isArray(defects) ? defects.length : 0;

  if (defectCount === 0) {
    return 0;
  }

  return Math.min(1, defectCount / loanCount);
};

/**
 * Calculates the high-severity defect rate for a counterparty.
 * High severity = critical or major defects.
 *
 * @param {Array<Object>} defects - Array of defect objects for the counterparty.
 * @param {Array<Object>} loans - Array of loan objects for the counterparty.
 * @returns {number} High-severity defect rate as a decimal (0.0 to 1.0).
 */
const calculateHighSeverityDefectRate = (defects, loans) => {
  const loanCount = Array.isArray(loans) ? loans.length : 0;

  if (loanCount === 0) {
    return 0;
  }

  const highSeverityDefects = Array.isArray(defects)
    ? defects.filter((d) => d && (d.severity === 'critical' || d.severity === 'major'))
    : [];

  if (highSeverityDefects.length === 0) {
    return 0;
  }

  return Math.min(1, highSeverityDefects.length / loanCount);
};

/**
 * Calculates the average remedy response time in days for a counterparty.
 * Only considers open or in-progress remedy cases.
 *
 * @param {Array<Object>} remedies - Array of remedy case objects for the counterparty.
 * @returns {number} Average response time in days.
 */
const calculateRemedyResponseTime = (remedies) => {
  if (!Array.isArray(remedies) || remedies.length === 0) {
    return 0;
  }

  const openRemedies = remedies.filter(
    (r) =>
      r &&
      r.status !== 'closed' &&
      r.status !== 'resolved' &&
      r.createdAt,
  );

  if (openRemedies.length === 0) {
    return 0;
  }

  const now = new Date();
  let totalAgingDays = 0;
  let count = 0;

  for (const remedy of openRemedies) {
    const createdAt = new Date(remedy.createdAt);
    if (isNaN(createdAt.getTime())) {
      continue;
    }
    const ageInMs = now - createdAt;
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
    totalAgingDays += ageInDays;
    count++;
  }

  if (count === 0) {
    return 0;
  }

  return Math.round((totalAgingDays / count) * 10) / 10;
};

/**
 * Calculates the total repurchase exposure for a counterparty.
 * Sums exposure from open repurchase cases.
 *
 * @param {Array<Object>} repurchases - Array of repurchase case objects for the counterparty.
 * @returns {number} Total exposure in dollars.
 */
const calculateRepurchaseExposure = (repurchases) => {
  if (!Array.isArray(repurchases) || repurchases.length === 0) {
    return 0;
  }

  let totalExposure = 0;

  for (const repurchase of repurchases) {
    if (!repurchase) continue;
    if (repurchase.status === 'closed') continue;

    if (repurchase.exposure !== undefined && repurchase.exposure !== null) {
      totalExposure += repurchase.exposure;
    } else if (
      repurchase.demandAmount !== undefined &&
      repurchase.demandAmount !== null
    ) {
      totalExposure += repurchase.demandAmount;
    }
  }

  return Math.round(totalExposure * 100) / 100;
};

/**
 * Calculates the SLA breach count for a counterparty.
 * Counts remedy cases and repurchase cases that have breached their SLA.
 *
 * @param {Array<Object>} remedies - Array of remedy case objects for the counterparty.
 * @param {Array<Object>} repurchases - Array of repurchase case objects for the counterparty.
 * @returns {number} Total breach count.
 */
const calculateSLABreachCount = (remedies, repurchases) => {
  let breachCount = 0;

  if (Array.isArray(remedies)) {
    for (const remedy of remedies) {
      if (!remedy) continue;
      if (remedy.slaBreached === true) {
        breachCount++;
      }
    }
  }

  if (Array.isArray(repurchases)) {
    for (const repurchase of repurchases) {
      if (!repurchase) continue;
      if (repurchase.status === 'closed' || repurchase.status === 'draft') continue;

      if (repurchase.createdAt) {
        const createdAt = new Date(repurchase.createdAt);
        if (!isNaN(createdAt.getTime())) {
          const now = new Date();
          const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
          if (ageInDays > 90) {
            breachCount++;
          }
        }
      }
    }
  }

  return breachCount;
};

/**
 * Computes the actual metric value for a given metric name and counterparty data.
 *
 * @param {string} metric - The metric name to compute.
 * @param {Array<Object>} defects - Array of defect objects for the counterparty.
 * @param {Array<Object>} loans - Array of loan objects for the counterparty.
 * @param {Array<Object>} remedies - Array of remedy case objects for the counterparty.
 * @param {Array<Object>} repurchases - Array of repurchase case objects for the counterparty.
 * @returns {number} The computed metric value.
 */
const computeMetricValue = (metric, defects, loans, remedies, repurchases) => {
  switch (metric) {
    case 'overallDefectRate':
      return calculateOverallDefectRate(defects, loans);
    case 'highSeverityDefectRate':
      return calculateHighSeverityDefectRate(defects, loans);
    case 'remedyResponseTime':
      return calculateRemedyResponseTime(remedies);
    case 'repurchaseExposure':
      return calculateRepurchaseExposure(repurchases);
    case 'slaBreachCount':
      return calculateSLABreachCount(remedies, repurchases);
    default:
      return 0;
  }
};

/**
 * Evaluates a single alert rule against the provided counterparty metrics.
 *
 * @param {Object} rule - The alert rule to evaluate.
 * @param {string} rule.metric - The metric to evaluate.
 * @param {string} rule.operator - The comparison operator.
 * @param {number} rule.value - The threshold value.
 * @param {Object} metrics - The computed metrics for the counterparty.
 * @param {number} metrics.overallDefectRate
 * @param {number} metrics.highSeverityDefectRate
 * @param {number} metrics.remedyResponseTime
 * @param {number} metrics.repurchaseExposure
 * @param {number} metrics.slaBreachCount
 * @returns {{ breached: boolean, actualValue: number, threshold: number, operator: string, metric: string }}
 *
 * @example
 * const result = evaluateThreshold(
 *   { metric: 'overallDefectRate', operator: 'gt', value: 0.05 },
 *   { overallDefectRate: 0.07, highSeverityDefectRate: 0.02, remedyResponseTime: 5, repurchaseExposure: 100000, slaBreachCount: 2 }
 * );
 * // Returns { breached: true, actualValue: 0.07, threshold: 0.05, operator: 'gt', metric: 'overallDefectRate' }
 */
export const evaluateThreshold = (rule, metrics) => {
  if (!rule || typeof rule !== 'object') {
    warn(ALERT_EVALUATOR_NAME, 'evaluateThreshold called with invalid rule', {
      ruleType: typeof rule,
    });
    return { ...DEFAULT_THRESHOLD };
  }

  if (!rule.metric || !isValidMetric(rule.metric)) {
    warn(ALERT_EVALUATOR_NAME, 'evaluateThreshold called with invalid metric', {
      metric: rule.metric,
    });
    return { ...DEFAULT_THRESHOLD, metric: rule.metric || '' };
  }

  if (!rule.operator || !isValidOperator(rule.operator)) {
    warn(ALERT_EVALUATOR_NAME, 'evaluateThreshold called with invalid operator', {
      operator: rule.operator,
    });
    return { ...DEFAULT_THRESHOLD, metric: rule.metric };
  }

  if (rule.value === undefined || rule.value === null || isNaN(rule.value)) {
    warn(ALERT_EVALUATOR_NAME, 'evaluateThreshold called with invalid threshold value', {
      value: rule.value,
    });
    return { ...DEFAULT_THRESHOLD, metric: rule.metric, operator: rule.operator };
  }

  const safeMetrics = metrics && typeof metrics === 'object' ? metrics : {};
  const actualValue = safeMetrics[rule.metric];

  if (actualValue === undefined || actualValue === null) {
    debug(ALERT_EVALUATOR_NAME, 'Metric value not found in provided metrics', {
      metric: rule.metric,
    });
    return {
      breached: false,
      actualValue: 0,
      threshold: rule.value,
      operator: rule.operator,
      metric: rule.metric,
    };
  }

  const breached = evaluateOperator(actualValue, rule.operator, rule.value);

  debug(ALERT_EVALUATOR_NAME, 'Threshold evaluated', {
    metric: rule.metric,
    operator: rule.operator,
    threshold: rule.value,
    actualValue,
    breached,
  });

  return {
    breached,
    actualValue,
    threshold: rule.value,
    operator: rule.operator,
    metric: rule.metric,
  };
};

/**
 * Evaluates all alert rules against all counterparties and returns an array of
 * alert breaches. Each breach includes the counterparty information, the rule
 * that was breached, the actual value, and a unique breach ID.
 *
 * @param {Array<Object>} alertRules - Array of alert rule objects.
 * @param {Array<Object>} counterparties - Array of counterparty objects.
 * @param {Array<Object>} defects - Array of all defect objects.
 * @param {Array<Object>} remedies - Array of all remedy case objects.
 * @param {Array<Object>} repurchases - Array of all repurchase case objects.
 * @returns {Array<Object>} Array of alert breach objects.
 *
 * @example
 * const breaches = evaluateAllThresholds(alertRules, counterparties, defects, remedies, repurchases);
 * console.log(breaches.length); // Number of breached thresholds
 */
export const evaluateAllThresholds = (
  alertRules,
  counterparties,
  defects,
  remedies,
  repurchases,
) => {
  if (!Array.isArray(alertRules) || alertRules.length === 0) {
    debug(ALERT_EVALUATOR_NAME, 'No alert rules to evaluate');
    return [];
  }

  if (!Array.isArray(counterparties) || counterparties.length === 0) {
    debug(ALERT_EVALUATOR_NAME, 'No counterparties to evaluate');
    return [];
  }

  const safeDefects = Array.isArray(defects) ? defects : [];
  const safeRemedies = Array.isArray(remedies) ? remedies : [];
  const safeRepurchases = Array.isArray(repurchases) ? repurchases : [];

  const enabledRules = alertRules.filter((rule) => rule && rule.enabled !== false);

  if (enabledRules.length === 0) {
    debug(ALERT_EVALUATOR_NAME, 'No enabled alert rules to evaluate');
    return [];
  }

  const breaches = [];
  let breachIndex = 0;

  for (const counterparty of counterparties) {
    if (!counterparty || !counterparty.id) {
      continue;
    }

    const counterpartyId = counterparty.id;
    const counterpartyName = counterparty.name || counterpartyId;

    const counterpartyDefects = safeDefects.filter(
      (d) => d && d.sellerId === counterpartyId,
    );
    const counterpartyRemedies = safeRemedies.filter(
      (r) => r && r.sellerId === counterpartyId,
    );
    const counterpartyRepurchases = safeRepurchases.filter(
      (r) => r && r.sellerId === counterpartyId,
    );

    const counterpartyLoans = [];

    const metrics = {
      overallDefectRate: computeMetricValue(
        'overallDefectRate',
        counterpartyDefects,
        counterpartyLoans,
        counterpartyRemedies,
        counterpartyRepurchases,
      ),
      highSeverityDefectRate: computeMetricValue(
        'highSeverityDefectRate',
        counterpartyDefects,
        counterpartyLoans,
        counterpartyRemedies,
        counterpartyRepurchases,
      ),
      remedyResponseTime: computeMetricValue(
        'remedyResponseTime',
        counterpartyDefects,
        counterpartyLoans,
        counterpartyRemedies,
        counterpartyRepurchases,
      ),
      repurchaseExposure: computeMetricValue(
        'repurchaseExposure',
        counterpartyDefects,
        counterpartyLoans,
        counterpartyRemedies,
        counterpartyRepurchases,
      ),
      slaBreachCount: computeMetricValue(
        'slaBreachCount',
        counterpartyDefects,
        counterpartyLoans,
        counterpartyRemedies,
        counterpartyRepurchases,
      ),
    };

    for (const rule of enabledRules) {
      if (!rule || !rule.metric) {
        continue;
      }

      if (
        Array.isArray(rule.counterpartyIds) &&
        rule.counterpartyIds.length > 0 &&
        !rule.counterpartyIds.includes(counterpartyId)
      ) {
        continue;
      }

      const result = evaluateThreshold(rule, metrics);

      if (result.breached) {
        breachIndex++;
        const breachId = `ALT-${String(breachIndex).padStart(4, '0')}-${Date.now().toString(36)}`;

        breaches.push({
          breachId,
          ruleId: rule.id || '',
          ruleName: rule.name || 'Unnamed Rule',
          counterpartyId,
          counterpartyName,
          metric: result.metric,
          operator: result.operator,
          configuredValue: result.threshold,
          actualValue: result.actualValue,
          severity: rule.severity || 'warning',
          triggeredAt: new Date().toISOString(),
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null,
        });
      }
    }
  }

  info(ALERT_EVALUATOR_NAME, 'Alert evaluation complete', {
    rulesEvaluated: enabledRules.length,
    counterpartiesEvaluated: counterparties.length,
    breachesFound: breaches.length,
  });

  return breaches;
};

/**
 * Filters an array of alert breaches to return only those that are currently active
 * (not acknowledged and not resolved).
 *
 * @param {Array<Object>} breaches - Array of alert breach objects.
 * @returns {Array<Object>} Array of active alert breaches.
 *
 * @example
 * const active = getActiveAlerts(breaches);
 * console.log(active.length); // Number of active (unacknowledged, unresolved) breaches
 */
export const getActiveAlerts = (breaches) => {
  if (!Array.isArray(breaches) || breaches.length === 0) {
    return [];
  }

  return breaches.filter(
    (breach) =>
      breach &&
      breach.acknowledged === false &&
      breach.resolvedAt === null,
  );
};

/**
 * Returns the list of valid metric names supported by the alert evaluator.
 *
 * @returns {string[]} Array of valid metric names.
 */
export const getValidMetrics = () => {
  return [...VALID_METRICS];
};

/**
 * Returns the list of valid operators supported by the alert evaluator.
 *
 * @returns {string[]} Array of valid operator strings.
 */
export const getValidOperators = () => {
  return [...VALID_OPERATORS];
};

export default {
  evaluateThreshold,
  evaluateAllThresholds,
  getActiveAlerts,
  getValidMetrics,
  getValidOperators,
};