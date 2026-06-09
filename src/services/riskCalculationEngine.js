import { debug, info, warn, error } from '../utils/logger';

const ENGINE_NAME = 'RiskCalculationEngine';

const DEFAULT_WEIGHTS = {
  defectRate: 0.35,
  remedyAging: 0.25,
  exposure: 0.25,
  breachCount: 0.15,
};

const RISK_TIER_THRESHOLDS = {
  critical: { min: 76, max: 100 },
  high: { min: 51, max: 75 },
  moderate: { min: 26, max: 50 },
  low: { min: 0, max: 25 },
};

const MAX_DEFECT_RATE = 0.15;
const MAX_REMEDY_AGING_DAYS = 30;
const MAX_EXPOSURE = 10000000;
const MAX_BREACH_COUNT = 10;

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
 * Normalizes remedy aging (average days to resolve) to a 0-100 score.
 * Higher aging = higher risk score.
 * @param {number} avgAgingDays - Average remedy response time in days.
 * @returns {number} Normalized score 0-100.
 */
const normalizeRemedyAging = (avgAgingDays) => {
  if (avgAgingDays === null || avgAgingDays === undefined || isNaN(avgAgingDays)) {
    return 0;
  }
  if (avgAgingDays < 0) {
    return 0;
  }
  if (avgAgingDays > MAX_REMEDY_AGING_DAYS) {
    return 100;
  }
  return Math.min(100, Math.round((avgAgingDays / MAX_REMEDY_AGING_DAYS) * 100));
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
 * Normalizes breach count to a 0-100 score.
 * Higher breach count = higher risk score.
 * @param {number} breachCount - Number of SLA breaches.
 * @returns {number} Normalized score 0-100.
 */
const normalizeBreachCount = (breachCount) => {
  if (breachCount === null || breachCount === undefined || isNaN(breachCount)) {
    return 0;
  }
  if (breachCount < 0) {
    return 0;
  }
  if (breachCount > MAX_BREACH_COUNT) {
    return 100;
  }
  return Math.min(100, Math.round((breachCount / MAX_BREACH_COUNT) * 100));
};

/**
 * Calculates the defect rate for a counterparty based on their defects.
 * Defect rate = number of defects / total loans (estimated from unique loan IDs in defects).
 * If no defects or no loans can be determined, returns 0.
 * @param {Array<Object>} defects - Array of defect objects.
 * @returns {number} Defect rate as a decimal (0.0 to 1.0).
 */
const calculateDefectRate = (defects) => {
  if (!Array.isArray(defects) || defects.length === 0) {
    return 0;
  }

  const validDefects = defects.filter((d) => d && d.loanId);

  if (validDefects.length === 0) {
    return 0;
  }

  const uniqueLoanIds = new Set(validDefects.map((d) => d.loanId));

  const defectCount = validDefects.length;
  const loanCount = uniqueLoanIds.size;

  if (loanCount === 0) {
    return 0;
  }

  return Math.min(1, defectCount / loanCount);
};

/**
 * Calculates the average remedy aging in days for a counterparty.
 * Only considers open or in-progress remedy cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @returns {number} Average aging in days.
 */
const calculateRemedyAging = (remedies) => {
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
 * Calculates the total financial exposure for a counterparty.
 * Sums exposure from open repurchase cases and remedy cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number} Total exposure in dollars.
 */
const calculateExposure = (remedies, repurchases) => {
  let totalExposure = 0;

  if (Array.isArray(remedies)) {
    for (const remedy of remedies) {
      if (!remedy) continue;
      if (remedy.status === 'closed' || remedy.status === 'resolved') continue;

      if (remedy.financialImpact) {
        const exposure =
          remedy.financialImpact.actual ||
          remedy.financialImpact.estimated ||
          0;
        totalExposure += exposure;
      }
    }
  }

  if (Array.isArray(repurchases)) {
    for (const repurchase of repurchases) {
      if (!repurchase) continue;
      if (repurchase.status === 'closed') continue;

      if (repurchase.exposure !== undefined && repurchase.exposure !== null) {
        totalExposure += repurchase.exposure;
      } else if (repurchase.demandAmount !== undefined && repurchase.demandAmount !== null) {
        totalExposure += repurchase.demandAmount;
      }
    }
  }

  return totalExposure;
};

/**
 * Calculates the SLA breach count for a counterparty.
 * Counts remedy cases and repurchase cases that have breached their SLA.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number} Total breach count.
 */
const calculateBreachCount = (remedies, repurchases) => {
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
 * Validates the counterparty object has the minimum required fields.
 * @param {Object} counterparty - The counterparty object to validate.
 * @returns {boolean} True if the counterparty is valid.
 */
const validateCounterparty = (counterparty) => {
  if (!counterparty || typeof counterparty !== 'object') {
    warn(ENGINE_NAME, 'Invalid counterparty provided', { counterpartyType: typeof counterparty });
    return false;
  }

  if (!counterparty.id && !counterparty.counterpartyId) {
    warn(ENGINE_NAME, 'Counterparty missing id or counterpartyId');
    return false;
  }

  return true;
};

/**
 * Validates that the provided arrays are actually arrays.
 * Returns sanitized arrays (empty arrays for invalid inputs).
 * @param {*} defects - Defects input.
 * @param {*} remedies - Remedies input.
 * @param {*} repurchases - Repurchases input.
 * @returns {{ defects: Array, remedies: Array, repurchases: Array }}
 */
const sanitizeInputs = (defects, remedies, repurchases) => {
  const safeDefects = Array.isArray(defects) ? defects : [];
  const safeRemedies = Array.isArray(remedies) ? remedies : [];
  const safeRepurchases = Array.isArray(repurchases) ? repurchases : [];

  if (!Array.isArray(defects)) {
    warn(ENGINE_NAME, 'Defects is not an array, using empty array', {
      defectsType: typeof defects,
    });
  }

  if (!Array.isArray(remedies)) {
    warn(ENGINE_NAME, 'Remedies is not an array, using empty array', {
      remediesType: typeof remedies,
    });
  }

  if (!Array.isArray(repurchases)) {
    warn(ENGINE_NAME, 'Repurchases is not an array, using empty array', {
      repurchasesType: typeof repurchases,
    });
  }

  return { defects: safeDefects, remedies: safeRemedies, repurchases: safeRepurchases };
};

/**
 * Calculates the composite risk score (0-100) for a counterparty based on
 * their defects, remedy cases, and repurchase cases.
 *
 * Uses a weighted formula:
 *   DefectRateWeight(0.35) + RemedyAgingWeight(0.25) + ExposureWeight(0.25) + BreachCountWeight(0.15)
 *
 * @param {Object} counterparty - The counterparty object (must have id or counterpartyId).
 * @param {Array<Object>} defects - Array of defect objects associated with this counterparty.
 * @param {Array<Object>} remedies - Array of remedy case objects associated with this counterparty.
 * @param {Array<Object>} repurchases - Array of repurchase case objects associated with this counterparty.
 * @param {Object} [weights] - Optional custom weights to override defaults.
 * @returns {number} Composite risk score 0-100. Returns 0 if counterparty is invalid.
 *
 * @example
 * const score = calculateRiskScore(counterparty, defects, remedies, repurchases);
 * console.log(score); // e.g., 62
 *
 * @example
 * const score = calculateRiskScore(counterparty, defects, remedies, repurchases, {
 *   defectRate: 0.40,
 *   remedyAging: 0.20,
 *   exposure: 0.25,
 *   breachCount: 0.15,
 * });
 */
export const calculateRiskScore = (
  counterparty,
  defects,
  remedies,
  repurchases,
  weights,
) => {
  if (!validateCounterparty(counterparty)) {
    return 0;
  }

  const { defects: safeDefects, remedies: safeRemedies, repurchases: safeRepurchases } =
    sanitizeInputs(defects, remedies, repurchases);

  const appliedWeights = weights && typeof weights === 'object'
    ? { ...DEFAULT_WEIGHTS, ...weights }
    : DEFAULT_WEIGHTS;

  const weightSum =
    appliedWeights.defectRate +
    appliedWeights.remedyAging +
    appliedWeights.exposure +
    appliedWeights.breachCount;

  if (Math.abs(weightSum - 1.0) > 0.001) {
    warn(ENGINE_NAME, 'Weights do not sum to 1.0, normalizing', {
      providedWeights: appliedWeights,
      sum: weightSum,
    });

    const factor = 1.0 / weightSum;
    appliedWeights.defectRate *= factor;
    appliedWeights.remedyAging *= factor;
    appliedWeights.exposure *= factor;
    appliedWeights.breachCount *= factor;
  }

  const defectRate = calculateDefectRate(safeDefects);
  const remedyAging = calculateRemedyAging(safeRemedies);
  const exposure = calculateExposure(safeRemedies, safeRepurchases);
  const breachCount = calculateBreachCount(safeRemedies, safeRepurchases);

  const defectScore = normalizeDefectRate(defectRate);
  const remedyScore = normalizeRemedyAging(remedyAging);
  const exposureScore = normalizeExposure(exposure);
  const breachScore = normalizeBreachCount(breachCount);

  const compositeScore =
    defectScore * appliedWeights.defectRate +
    remedyScore * appliedWeights.remedyAging +
    exposureScore * appliedWeights.exposure +
    breachScore * appliedWeights.breachCount;

  const roundedScore = Math.round(compositeScore);

  debug(ENGINE_NAME, 'Risk score calculated', {
    counterpartyId: counterparty.id || counterparty.counterpartyId,
    defectRate,
    remedyAging,
    exposure,
    breachCount,
    defectScore,
    remedyScore,
    exposureScore,
    breachScore,
    compositeScore: roundedScore,
  });

  return Math.max(0, Math.min(100, roundedScore));
};

/**
 * Determines the risk tier from a composite risk score.
 *
 * Thresholds:
 *   - 0-25: 'low'
 *   - 26-50: 'moderate'
 *   - 51-75: 'high'
 *   - 76-100: 'critical'
 *
 * @param {number} score - Composite risk score 0-100.
 * @returns {string} Risk tier: 'critical', 'high', 'moderate', or 'low'.
 *
 * @example
 * const tier = calculateRiskTier(62);
 * console.log(tier); // 'high'
 *
 * @example
 * const tier = calculateRiskTier(15);
 * console.log(tier); // 'low'
 */
export const calculateRiskTier = (score) => {
  if (score === null || score === undefined || isNaN(score)) {
    warn(ENGINE_NAME, 'Invalid score provided to calculateRiskTier', { score });
    return 'low';
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  if (clampedScore >= RISK_TIER_THRESHOLDS.critical.min) {
    return 'critical';
  }
  if (clampedScore >= RISK_TIER_THRESHOLDS.high.min) {
    return 'high';
  }
  if (clampedScore >= RISK_TIER_THRESHOLDS.moderate.min) {
    return 'moderate';
  }
  return 'low';
};

/**
 * Returns a detailed breakdown of the contributing factors that make up
 * the composite risk score for a counterparty.
 *
 * Each factor includes:
 *   - name: The factor name (e.g., 'defectRate')
 *   - weight: The weight applied to this factor (0.0-1.0)
 *   - rawValue: The raw calculated value (e.g., defect rate as decimal)
 *   - normalizedScore: The normalized score (0-100)
 *   - contribution: The weighted contribution to the final score
 *
 * @param {Object} counterparty - The counterparty object.
 * @param {Array<Object>} defects - Array of defect objects.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @param {Object} [weights] - Optional custom weights to override defaults.
 * @returns {{
 *   score: number,
 *   tier: string,
 *   factors: Array<{
 *     name: string,
 *     weight: number,
 *     rawValue: number,
 *     normalizedScore: number,
 *     contribution: number,
 *   }>,
 *   summary: {
 *     defectRate: number,
 *     remedyAgingDays: number,
 *     totalExposure: number,
 *     breachCount: number,
 *   },
 * }}
 *
 * @example
 * const breakdown = getContributingFactors(counterparty, defects, remedies, repurchases);
 * console.log(breakdown.factors);
 * // [
 * //   { name: 'defectRate', weight: 0.35, rawValue: 0.05, normalizedScore: 33, contribution: 11.55 },
 * //   { name: 'remedyAging', weight: 0.25, rawValue: 12, normalizedScore: 40, contribution: 10.0 },
 * //   { name: 'exposure', weight: 0.25, rawValue: 250000, normalizedScore: 3, contribution: 0.75 },
 * //   { name: 'breachCount', weight: 0.15, rawValue: 2, normalizedScore: 20, contribution: 3.0 },
 * // ]
 */
export const getContributingFactors = (
  counterparty,
  defects,
  remedies,
  repurchases,
  weights,
) => {
  if (!validateCounterparty(counterparty)) {
    return {
      score: 0,
      tier: 'low',
      factors: [],
      summary: {
        defectRate: 0,
        remedyAgingDays: 0,
        totalExposure: 0,
        breachCount: 0,
      },
    };
  }

  const { defects: safeDefects, remedies: safeRemedies, repurchases: safeRepurchases } =
    sanitizeInputs(defects, remedies, repurchases);

  const appliedWeights = weights && typeof weights === 'object'
    ? { ...DEFAULT_WEIGHTS, ...weights }
    : DEFAULT_WEIGHTS;

  const weightSum =
    appliedWeights.defectRate +
    appliedWeights.remedyAging +
    appliedWeights.exposure +
    appliedWeights.breachCount;

  if (Math.abs(weightSum - 1.0) > 0.001) {
    const factor = 1.0 / weightSum;
    appliedWeights.defectRate *= factor;
    appliedWeights.remedyAging *= factor;
    appliedWeights.exposure *= factor;
    appliedWeights.breachCount *= factor;
  }

  const defectRate = calculateDefectRate(safeDefects);
  const remedyAging = calculateRemedyAging(safeRemedies);
  const exposure = calculateExposure(safeRemedies, safeRepurchases);
  const breachCount = calculateBreachCount(safeRemedies, safeRepurchases);

  const defectScore = normalizeDefectRate(defectRate);
  const remedyScore = normalizeRemedyAging(remedyAging);
  const exposureScore = normalizeExposure(exposure);
  const breachScore = normalizeBreachCount(breachCount);

  const factors = [
    {
      name: 'defectRate',
      weight: Math.round(appliedWeights.defectRate * 10000) / 10000,
      rawValue: Math.round(defectRate * 10000) / 10000,
      normalizedScore: defectScore,
      contribution: Math.round(defectScore * appliedWeights.defectRate * 100) / 100,
    },
    {
      name: 'remedyAging',
      weight: Math.round(appliedWeights.remedyAging * 10000) / 10000,
      rawValue: remedyAging,
      normalizedScore: remedyScore,
      contribution: Math.round(remedyScore * appliedWeights.remedyAging * 100) / 100,
    },
    {
      name: 'exposure',
      weight: Math.round(appliedWeights.exposure * 10000) / 10000,
      rawValue: Math.round(exposure * 100) / 100,
      normalizedScore: exposureScore,
      contribution: Math.round(exposureScore * appliedWeights.exposure * 100) / 100,
    },
    {
      name: 'breachCount',
      weight: Math.round(appliedWeights.breachCount * 10000) / 10000,
      rawValue: breachCount,
      normalizedScore: breachScore,
      contribution: Math.round(breachScore * appliedWeights.breachCount * 100) / 100,
    },
  ];

  const compositeScore =
    defectScore * appliedWeights.defectRate +
    remedyScore * appliedWeights.remedyAging +
    exposureScore * appliedWeights.exposure +
    breachScore * appliedWeights.breachCount;

  const roundedScore = Math.max(0, Math.min(100, Math.round(compositeScore)));
  const tier = calculateRiskTier(roundedScore);

  debug(ENGINE_NAME, 'Contributing factors calculated', {
    counterpartyId: counterparty.id || counterparty.counterpartyId,
    score: roundedScore,
    tier,
    factorCount: factors.length,
  });

  return {
    score: roundedScore,
    tier,
    factors,
    summary: {
      defectRate: Math.round(defectRate * 10000) / 10000,
      remedyAgingDays: remedyAging,
      totalExposure: Math.round(exposure * 100) / 100,
      breachCount,
    },
  };
};

/**
 * Returns the default weights used by the risk calculation engine.
 * @returns {{ defectRate: number, remedyAging: number, exposure: number, breachCount: number }}
 */
export const getDefaultWeights = () => {
  return { ...DEFAULT_WEIGHTS };
};

/**
 * Returns the risk tier threshold definitions.
 * @returns {{ critical: { min: number, max: number }, high: { min: number, max: number }, moderate: { min: number, max: number }, low: { min: number, max: number } }}
 */
export const getRiskTierThresholds = () => {
  return {
    critical: { ...RISK_TIER_THRESHOLDS.critical },
    high: { ...RISK_TIER_THRESHOLDS.high },
    moderate: { ...RISK_TIER_THRESHOLDS.moderate },
    low: { ...RISK_TIER_THRESHOLDS.low },
  };
};

export default {
  calculateRiskScore,
  calculateRiskTier,
  getContributingFactors,
  getDefaultWeights,
  getRiskTierThresholds,
};