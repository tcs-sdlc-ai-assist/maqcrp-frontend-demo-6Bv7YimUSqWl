import { debug, info, warn, error } from '../utils/logger';

const WATCHLIST_MANAGER_NAME = 'WatchlistManager';

const DEFAULT_WEIGHTS = {
  defectRate: 0.3,
  criticalDefectRate: 0.25,
  responseTime: 0.2,
  exposure: 0.15,
  trendDirection: 0.1,
};

const DEFAULT_RECOMMENDATION_THRESHOLDS = {
  watchlist: 60,
  monitor: 35,
  clear: 0,
};

const MAX_DEFECT_RATE = 0.15;
const MAX_CRITICAL_DEFECT_RATE = 0.05;
const MAX_RESPONSE_DAYS = 30;
const MAX_EXPOSURE = 10000000;

/**
 * Normalizes a defect rate to a 0-100 score.
 * Higher defect rate = higher risk score.
 * @param {number} defectRate - Defect rate as a decimal (e.g., 0.05 = 5%).
 * @returns {number} Normalized score 0-100.
 */
const normalizeDefectRate = (defectRate) => {
  if (defectRate === null || defectRate === undefined || isNaN(defectRate)) {
    return 0;
  }
  if (defectRate < 0) {
    return 0;
  }
  if (defectRate > MAX_DEFECT_RATE) {
    return 100;
  }
  return Math.min(100, Math.round((defectRate / MAX_DEFECT_RATE) * 100));
};

/**
 * Normalizes a critical defect rate to a 0-100 score.
 * Higher critical defect rate = higher risk score.
 * @param {number} criticalDefectRate - Critical defect rate as a decimal.
 * @returns {number} Normalized score 0-100.
 */
const normalizeCriticalDefectRate = (criticalDefectRate) => {
  if (criticalDefectRate === null || criticalDefectRate === undefined || isNaN(criticalDefectRate)) {
    return 0;
  }
  if (criticalDefectRate < 0) {
    return 0;
  }
  if (criticalDefectRate > MAX_CRITICAL_DEFECT_RATE) {
    return 100;
  }
  return Math.min(100, Math.round((criticalDefectRate / MAX_CRITICAL_DEFECT_RATE) * 100));
};

/**
 * Normalizes response time (days) to a 0-100 score.
 * Higher response time = higher risk score.
 * @param {number} responseDays - Average remedy response time in days.
 * @returns {number} Normalized score 0-100.
 */
const normalizeResponseTime = (responseDays) => {
  if (responseDays === null || responseDays === undefined || isNaN(responseDays)) {
    return 0;
  }
  if (responseDays < 0) {
    return 0;
  }
  if (responseDays > MAX_RESPONSE_DAYS) {
    return 100;
  }
  return Math.min(100, Math.round((responseDays / MAX_RESPONSE_DAYS) * 100));
};

/**
 * Normalizes total exposure to a 0-100 score.
 * Higher exposure = higher risk score.
 * @param {number} exposure - Total financial exposure in dollars.
 * @returns {number} Normalized score 0-100.
 */
const normalizeExposure = (exposure) => {
  if (exposure === null || exposure === undefined || isNaN(exposure)) {
    return 0;
  }
  if (exposure < 0) {
    return 0;
  }
  if (exposure > MAX_EXPOSURE) {
    return 100;
  }
  return Math.min(100, Math.round((exposure / MAX_EXPOSURE) * 100));
};

/**
 * Normalizes trend direction to a 0-100 score.
 * Worsening trends = higher risk score.
 * @param {Object|null} trends - Trend data object.
 * @param {string} [trends.defectRateTrend] - 'improving', 'worsening', or 'stable'.
 * @param {number} [trends.defectRateChange] - Magnitude of change.
 * @returns {number} Normalized score 0-100.
 */
const normalizeTrend = (trends) => {
  if (!trends || !trends.defectRateTrend) {
    return 50;
  }

  switch (trends.defectRateTrend) {
    case 'improving':
      return Math.max(0, 50 - Math.abs(trends.defectRateChange || 0) * 1000);
    case 'worsening':
      return Math.min(100, 50 + Math.abs(trends.defectRateChange || 0) * 1000);
    case 'stable':
      return 50;
    default:
      return 50;
  }
};

/**
 * Validates that the counterparty object has the minimum required fields.
 * @param {Object} counterparty - The counterparty object to validate.
 * @returns {boolean} True if the counterparty is valid.
 */
const validateCounterparty = (counterparty) => {
  if (!counterparty || typeof counterparty !== 'object') {
    warn(WATCHLIST_MANAGER_NAME, 'Invalid counterparty provided', {
      counterpartyType: typeof counterparty,
    });
    return false;
  }

  if (!counterparty.id && !counterparty.counterpartyId) {
    warn(WATCHLIST_MANAGER_NAME, 'Counterparty missing id or counterpartyId');
    return false;
  }

  return true;
};

/**
 * Validates that the riskData object has the expected structure.
 * @param {Object} riskData - The risk data object to validate.
 * @returns {boolean} True if the riskData is valid.
 */
const validateRiskData = (riskData) => {
  if (!riskData || typeof riskData !== 'object') {
    warn(WATCHLIST_MANAGER_NAME, 'Invalid riskData provided', {
      riskDataType: typeof riskData,
    });
    return false;
  }

  return true;
};

/**
 * Computes a watchlist priority score (0-100) for a counterparty based on
 * their risk metrics and trend data.
 *
 * Uses a weighted formula:
 *   DefectRate(0.30) + CriticalDefectRate(0.25) + ResponseTime(0.20) + Exposure(0.15) + TrendDirection(0.10)
 *
 * @param {Object} counterparty - The counterparty object (must have id or counterpartyId).
 * @param {Object} riskData - Aggregated risk data for the counterparty.
 * @param {Object} [riskData.metrics] - Counterparty metrics.
 * @param {number} [riskData.metrics.defectRate] - Overall defect rate (0.0 to 1.0).
 * @param {number} [riskData.metrics.criticalDefectRate] - Critical defect rate (0.0 to 1.0).
 * @param {number} [riskData.metrics.avgRemedyResponseDays] - Average remedy response time in days.
 * @param {number} [riskData.metrics.totalExposure] - Total financial exposure in dollars.
 * @param {Object} [riskData.trends] - Trend data.
 * @param {Object} [weights] - Optional custom weights to override defaults.
 * @returns {number} Watchlist priority score 0-100. Returns 0 if inputs are invalid.
 *
 * @example
 * const score = computeWatchlistScore(counterparty, riskData);
 * console.log(score); // e.g., 62
 */
export const computeWatchlistScore = (counterparty, riskData, weights) => {
  if (!validateCounterparty(counterparty)) {
    return 0;
  }

  if (!validateRiskData(riskData)) {
    return 0;
  }

  const appliedWeights =
    weights && typeof weights === 'object'
      ? { ...DEFAULT_WEIGHTS, ...weights }
      : DEFAULT_WEIGHTS;

  const weightSum =
    appliedWeights.defectRate +
    appliedWeights.criticalDefectRate +
    appliedWeights.responseTime +
    appliedWeights.exposure +
    appliedWeights.trendDirection;

  if (Math.abs(weightSum - 1.0) > 0.001) {
    warn(WATCHLIST_MANAGER_NAME, 'Weights do not sum to 1.0, normalizing', {
      providedWeights: appliedWeights,
      sum: weightSum,
    });

    const factor = 1.0 / weightSum;
    appliedWeights.defectRate *= factor;
    appliedWeights.criticalDefectRate *= factor;
    appliedWeights.responseTime *= factor;
    appliedWeights.exposure *= factor;
    appliedWeights.trendDirection *= factor;
  }

  const metrics = riskData.metrics || {};
  const trends = riskData.trends || null;

  const defectScore = normalizeDefectRate(metrics.defectRate);
  const criticalDefectScore = normalizeCriticalDefectRate(metrics.criticalDefectRate);
  const responseScore = normalizeResponseTime(metrics.avgRemedyResponseDays);
  const exposureScore = normalizeExposure(metrics.totalExposure);
  const trendScore = normalizeTrend(trends);

  const compositeScore =
    defectScore * appliedWeights.defectRate +
    criticalDefectScore * appliedWeights.criticalDefectRate +
    responseScore * appliedWeights.responseTime +
    exposureScore * appliedWeights.exposure +
    trendScore * appliedWeights.trendDirection;

  const roundedScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

  debug(WATCHLIST_MANAGER_NAME, 'Watchlist score computed', {
    counterpartyId: counterparty.id || counterparty.counterpartyId,
    defectScore,
    criticalDefectScore,
    responseScore,
    exposureScore,
    trendScore,
    compositeScore: roundedScore,
  });

  return roundedScore;
};

/**
 * Determines the watchlist recommendation for a counterparty based on their
 * watchlist priority score.
 *
 * Thresholds (configurable via recommendationThresholds parameter):
 *   - score >= watchlist threshold: 'add' (add to watchlist)
 *   - score >= monitor threshold: 'monitor' (keep monitoring)
 *   - score < monitor threshold: 'remove' (safe to remove from watchlist)
 *
 * @param {Object} counterparty - The counterparty object.
 * @param {Object} riskData - Aggregated risk data for the counterparty.
 * @param {Object} [options] - Optional configuration.
 * @param {Object} [options.weights] - Custom scoring weights.
 * @param {Object} [options.recommendationThresholds] - Custom recommendation thresholds.
 * @param {number} [options.recommendationThresholds.watchlist=60] - Score threshold for 'add' recommendation.
 * @param {number} [options.recommendationThresholds.monitor=35] - Score threshold for 'monitor' recommendation.
 * @returns {{ score: number, recommendation: string, factors: Array<{name: string, weight: number, rawValue: number, normalizedScore: number, contribution: number}> }}
 *
 * @example
 * const result = getRecommendation(counterparty, riskData);
 * console.log(result.recommendation); // 'add', 'monitor', or 'remove'
 * console.log(result.score); // 62
 */
export const getRecommendation = (counterparty, riskData, options = {}) => {
  if (!validateCounterparty(counterparty)) {
    return {
      score: 0,
      recommendation: 'remove',
      factors: [],
    };
  }

  if (!validateRiskData(riskData)) {
    return {
      score: 0,
      recommendation: 'remove',
      factors: [],
    };
  }

  const appliedWeights =
    options.weights && typeof options.weights === 'object'
      ? { ...DEFAULT_WEIGHTS, ...options.weights }
      : DEFAULT_WEIGHTS;

  const appliedThresholds =
    options.recommendationThresholds && typeof options.recommendationThresholds === 'object'
      ? { ...DEFAULT_RECOMMENDATION_THRESHOLDS, ...options.recommendationThresholds }
      : DEFAULT_RECOMMENDATION_THRESHOLDS;

  const weightSum =
    appliedWeights.defectRate +
    appliedWeights.criticalDefectRate +
    appliedWeights.responseTime +
    appliedWeights.exposure +
    appliedWeights.trendDirection;

  if (Math.abs(weightSum - 1.0) > 0.001) {
    const factor = 1.0 / weightSum;
    appliedWeights.defectRate *= factor;
    appliedWeights.criticalDefectRate *= factor;
    appliedWeights.responseTime *= factor;
    appliedWeights.exposure *= factor;
    appliedWeights.trendDirection *= factor;
  }

  const metrics = riskData.metrics || {};
  const trends = riskData.trends || null;

  const defectRate = metrics.defectRate ?? 0;
  const criticalDefectRate = metrics.criticalDefectRate ?? 0;
  const avgRemedyResponseDays = metrics.avgRemedyResponseDays ?? 0;
  const totalExposure = metrics.totalExposure ?? 0;

  const defectScore = normalizeDefectRate(defectRate);
  const criticalDefectScore = normalizeCriticalDefectRate(criticalDefectRate);
  const responseScore = normalizeResponseTime(avgRemedyResponseDays);
  const exposureScore = normalizeExposure(totalExposure);
  const trendScore = normalizeTrend(trends);

  const factors = [
    {
      name: 'defectRate',
      weight: Math.round(appliedWeights.defectRate * 10000) / 10000,
      rawValue: Math.round(defectRate * 10000) / 10000,
      normalizedScore: defectScore,
      contribution: Math.round(defectScore * appliedWeights.defectRate * 100) / 100,
    },
    {
      name: 'criticalDefectRate',
      weight: Math.round(appliedWeights.criticalDefectRate * 10000) / 10000,
      rawValue: Math.round(criticalDefectRate * 10000) / 10000,
      normalizedScore: criticalDefectScore,
      contribution: Math.round(criticalDefectScore * appliedWeights.criticalDefectRate * 100) / 100,
    },
    {
      name: 'responseTime',
      weight: Math.round(appliedWeights.responseTime * 10000) / 10000,
      rawValue: avgRemedyResponseDays,
      normalizedScore: responseScore,
      contribution: Math.round(responseScore * appliedWeights.responseTime * 100) / 100,
    },
    {
      name: 'exposure',
      weight: Math.round(appliedWeights.exposure * 10000) / 10000,
      rawValue: Math.round(totalExposure * 100) / 100,
      normalizedScore: exposureScore,
      contribution: Math.round(exposureScore * appliedWeights.exposure * 100) / 100,
    },
    {
      name: 'trendDirection',
      weight: Math.round(appliedWeights.trendDirection * 10000) / 10000,
      rawValue: trends ? trends.defectRateTrend || 'unknown' : 'unknown',
      normalizedScore: trendScore,
      contribution: Math.round(trendScore * appliedWeights.trendDirection * 100) / 100,
    },
  ];

  const compositeScore =
    defectScore * appliedWeights.defectRate +
    criticalDefectScore * appliedWeights.criticalDefectRate +
    responseScore * appliedWeights.responseTime +
    exposureScore * appliedWeights.exposure +
    trendScore * appliedWeights.trendDirection;

  const roundedScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

  let recommendation;
  if (roundedScore >= appliedThresholds.watchlist) {
    recommendation = 'add';
  } else if (roundedScore >= appliedThresholds.monitor) {
    recommendation = 'monitor';
  } else {
    recommendation = 'remove';
  }

  debug(WATCHLIST_MANAGER_NAME, 'Watchlist recommendation computed', {
    counterpartyId: counterparty.id || counterparty.counterpartyId,
    score: roundedScore,
    recommendation,
    factorCount: factors.length,
  });

  return {
    score: roundedScore,
    recommendation,
    factors,
  };
};

/**
 * Aggregates watchlist entries and action plans into a comprehensive watchlist report.
 *
 * Each entry in the report includes the watchlist entry details, associated action plans,
 * and a summary of monitoring activity.
 *
 * @param {Array<Object>} watchlistEntries - Array of watchlist entry objects.
 * @param {Array<Object>} actionPlans - Array of action plan objects.
 * @returns {Object} Aggregated watchlist report.
 * @returns {Array<Object>} returns.entries - Enriched watchlist entries with action plans.
 * @returns {Object} returns.summary - Summary statistics.
 * @returns {number} returns.summary.totalEntries - Total watchlist entries.
 * @returns {number} returns.summary.activeEntries - Number of active watchlist entries.
 * @returns {number} returns.summary.monitoringEntries - Number of monitoring entries.
 * @returns {number} returns.summary.clearedEntries - Number of cleared entries.
 * @returns {number} returns.summary.totalActionPlans - Total associated action plans.
 * @returns {number} returns.summary.pendingActionPlans - Number of pending action plans.
 * @returns {number} returns.summary.completedActionPlans - Number of completed action plans.
 * @returns {number} returns.summary.overdueActionPlans - Number of overdue action plans.
 *
 * @example
 * const report = getWatchlistReport(watchlistEntries, actionPlans);
 * console.log(report.summary.activeEntries); // 3
 */
export const getWatchlistReport = (watchlistEntries, actionPlans) => {
  const safeWatchlistEntries = Array.isArray(watchlistEntries) ? watchlistEntries : [];
  const safeActionPlans = Array.isArray(actionPlans) ? actionPlans : [];

  if (!Array.isArray(watchlistEntries)) {
    warn(WATCHLIST_MANAGER_NAME, 'watchlistEntries is not an array, using empty array', {
      watchlistEntriesType: typeof watchlistEntries,
    });
  }

  if (!Array.isArray(actionPlans)) {
    warn(WATCHLIST_MANAGER_NAME, 'actionPlans is not an array, using empty array', {
      actionPlansType: typeof actionPlans,
    });
  }

  const now = new Date();

  const summary = {
    totalEntries: safeWatchlistEntries.length,
    activeEntries: 0,
    monitoringEntries: 0,
    clearedEntries: 0,
    totalActionPlans: 0,
    pendingActionPlans: 0,
    completedActionPlans: 0,
    overdueActionPlans: 0,
  };

  const entries = [];

  for (const entry of safeWatchlistEntries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    switch (entry.status) {
      case 'active':
        summary.activeEntries++;
        break;
      case 'monitoring':
        summary.monitoringEntries++;
        break;
      case 'cleared':
        summary.clearedEntries++;
        break;
      default:
        break;
    }

    const associatedPlans = safeActionPlans.filter(
      (plan) =>
        plan &&
        (plan.watchlistEntryId === entry.id ||
          plan.counterpartyId === entry.counterpartyId),
    );

    summary.totalActionPlans += associatedPlans.length;

    let entryPendingPlans = 0;
    let entryCompletedPlans = 0;
    let entryOverduePlans = 0;

    for (const plan of associatedPlans) {
      if (plan.status === 'completed') {
        entryCompletedPlans++;
        summary.completedActionPlans++;
      } else if (plan.status === 'cancelled') {
        continue;
      } else {
        entryPendingPlans++;
        summary.pendingActionPlans++;

        if (plan.dueDate) {
          const dueDate = new Date(plan.dueDate);
          if (!isNaN(dueDate.getTime()) && dueDate < now) {
            entryOverduePlans++;
            summary.overdueActionPlans++;
          }
        }
      }
    }

    const monitoringNoteCount = Array.isArray(entry.monitoringNotes)
      ? entry.monitoringNotes.length
      : 0;

    const lastMonitoringNote =
      Array.isArray(entry.monitoringNotes) && entry.monitoringNotes.length > 0
        ? entry.monitoringNotes[entry.monitoringNotes.length - 1]
        : null;

    entries.push({
      entryId: entry.id || '',
      counterpartyId: entry.counterpartyId || '',
      counterpartyName: entry.counterpartyName || '',
      status: entry.status || 'unknown',
      reason: entry.reason || '',
      watchlistScore: entry.watchlistScore ?? null,
      recommendation: entry.recommendation || '',
      addedDate: entry.addedDate || null,
      addedBy: entry.addedBy || '',
      reviewDate: entry.reviewDate || null,
      actionPlans: associatedPlans.map((plan) => ({
        planId: plan.id || '',
        title: plan.title || '',
        status: plan.status || 'unknown',
        priority: plan.priority || 'medium',
        dueDate: plan.dueDate || null,
        assignedTo: plan.assignedTo || null,
        isOverdue:
          plan.dueDate &&
          plan.status !== 'completed' &&
          plan.status !== 'cancelled'
            ? new Date(plan.dueDate) < now
            : false,
      })),
      monitoringNoteCount,
      lastMonitoringNote: lastMonitoringNote
        ? {
            noteId: lastMonitoringNote.id || '',
            date: lastMonitoringNote.createdAt || '',
            author: lastMonitoringNote.author || '',
            content: lastMonitoringNote.content || '',
          }
        : null,
    });
  }

  entries.sort((a, b) => {
    const statusOrder = { active: 0, monitoring: 1, cleared: 2 };
    const aOrder = statusOrder[a.status] ?? 99;
    const bOrder = statusOrder[b.status] ?? 99;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aScore = a.watchlistScore ?? 0;
    const bScore = b.watchlistScore ?? 0;
    return bScore - aScore;
  });

  debug(WATCHLIST_MANAGER_NAME, 'Watchlist report generated', {
    totalEntries: entries.length,
    activeEntries: summary.activeEntries,
    totalActionPlans: summary.totalActionPlans,
  });

  return {
    entries,
    summary,
  };
};

/**
 * Returns the default scoring weights used by the watchlist manager.
 * @returns {{ defectRate: number, criticalDefectRate: number, responseTime: number, exposure: number, trendDirection: number }}
 */
export const getDefaultWeights = () => {
  return { ...DEFAULT_WEIGHTS };
};

/**
 * Returns the default recommendation thresholds.
 * @returns {{ watchlist: number, monitor: number, clear: number }}
 */
export const getDefaultRecommendationThresholds = () => {
  return { ...DEFAULT_RECOMMENDATION_THRESHOLDS };
};

export default {
  computeWatchlistScore,
  getRecommendation,
  getWatchlistReport,
  getDefaultWeights,
  getDefaultRecommendationThresholds,
};