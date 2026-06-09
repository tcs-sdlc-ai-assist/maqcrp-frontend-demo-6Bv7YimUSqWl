import { debug, info, warn, error } from '../utils/logger';

const AGGREGATOR_NAME = 'ScorecardAggregator';

const DEFAULT_METRICS = {
  totalLoansSubmitted: 0,
  passRate: 0,
  defectRate: 0,
  criticalDefectRate: 0,
  avgRemedyResponseDays: 0,
  openRemedyCases: 0,
  openRepurchaseCases: 0,
  totalExposure: 0,
  slaBreachRate: 0,
};

const DEFAULT_TRENDS = {
  defectRateTrend: 'stable',
  defectRateChange: 0,
  responseTimeTrend: 'stable',
  responseTimeChange: 0,
  exposureTrend: 'stable',
  exposureChange: 0,
};

const DEFAULT_PEER_COMPARISON = {
  peerAvgDefectRate: 0,
  peerAvgCriticalDefectRate: 0,
  peerAvgResponseDays: 0,
  peerAvgExposure: 0,
  peerAvgPassRate: 0,
  percentileRank: 50,
  peerCount: 0,
};

/**
 * Validates that the counterpartyId is a non-empty string.
 * @param {string} counterpartyId
 * @returns {boolean}
 */
const validateCounterpartyId = (counterpartyId) => {
  if (!counterpartyId || typeof counterpartyId !== 'string' || counterpartyId.trim() === '') {
    warn(AGGREGATOR_NAME, 'Invalid counterpartyId provided', { counterpartyId });
    return false;
  }
  return true;
};

/**
 * Validates that a value is an array, returning an empty array if not.
 * @param {*} value
 * @param {string} label
 * @returns {Array}
 */
const ensureArray = (value, label) => {
  if (!Array.isArray(value)) {
    warn(AGGREGATOR_NAME, `${label} is not an array, using empty array`, {
      type: typeof value,
    });
    return [];
  }
  return value;
};

/**
 * Calculates the defect rate for a counterparty.
 * Defect rate = number of defects / number of loans.
 * @param {Array<Object>} defects - Array of defect objects.
 * @param {Array<Object>} loans - Array of loan objects.
 * @returns {number} Defect rate as a decimal (0.0 to 1.0).
 */
const calculateDefectRate = (defects, loans) => {
  const loanCount = loans.length;

  if (loanCount === 0) {
    return 0;
  }

  const defectCount = defects.length;

  if (defectCount === 0) {
    return 0;
  }

  return Math.min(1, defectCount / loanCount);
};

/**
 * Calculates the critical defect rate for a counterparty.
 * @param {Array<Object>} defects - Array of defect objects.
 * @param {Array<Object>} loans - Array of loan objects.
 * @returns {number} Critical defect rate as a decimal (0.0 to 1.0).
 */
const calculateCriticalDefectRate = (defects, loans) => {
  const loanCount = loans.length;

  if (loanCount === 0) {
    return 0;
  }

  const criticalDefects = defects.filter(
    (d) => d && (d.severity === 'critical'),
  );

  if (criticalDefects.length === 0) {
    return 0;
  }

  return Math.min(1, criticalDefects.length / loanCount);
};

/**
 * Calculates the pass rate for a counterparty.
 * Pass rate = number of passed loans / total loans.
 * @param {Array<Object>} loans - Array of loan objects.
 * @returns {number} Pass rate as a decimal (0.0 to 1.0).
 */
const calculatePassRate = (loans) => {
  const loanCount = loans.length;

  if (loanCount === 0) {
    return 0;
  }

  const passedLoans = loans.filter(
    (loan) => loan && (loan.status === 'PASS' || loan.status === 'VALIDATED'),
  );

  return passedLoans.length / loanCount;
};

/**
 * Calculates the average remedy response time in days for open/in-progress remedy cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @returns {number} Average response time in days.
 */
const calculateAvgRemedyResponseDays = (remedies) => {
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
 * Counts the number of open remedy cases for a counterparty.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @returns {number}
 */
const countOpenRemedyCases = (remedies) => {
  return remedies.filter(
    (r) => r && r.status !== 'closed' && r.status !== 'resolved',
  ).length;
};

/**
 * Counts the number of open repurchase cases for a counterparty.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number}
 */
const countOpenRepurchaseCases = (repurchases) => {
  return repurchases.filter(
    (r) => r && r.status !== 'closed' && r.status !== 'draft',
  ).length;
};

/**
 * Calculates the total financial exposure for a counterparty.
 * Sums exposure from open repurchase cases and remedy cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number} Total exposure in dollars.
 */
const calculateTotalExposure = (remedies, repurchases) => {
  let totalExposure = 0;

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
 * Calculates the SLA breach rate for a counterparty.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number} SLA breach rate as a decimal (0.0 to 1.0).
 */
const calculateSLABreachRate = (remedies, repurchases) => {
  let totalCases = 0;
  let breachedCases = 0;

  for (const remedy of remedies) {
    if (!remedy) continue;
    totalCases++;
    if (remedy.slaBreached === true) {
      breachedCases++;
    }
  }

  for (const repurchase of repurchases) {
    if (!repurchase) continue;
    if (repurchase.status === 'closed' || repurchase.status === 'draft') continue;

    totalCases++;
    if (repurchase.createdAt) {
      const createdAt = new Date(repurchase.createdAt);
      if (!isNaN(createdAt.getTime())) {
        const now = new Date();
        const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
        if (ageInDays > 90) {
          breachedCases++;
        }
      }
    }
  }

  if (totalCases === 0) {
    return 0;
  }

  return Math.min(1, breachedCases / totalCases);
};

/**
 * Aggregates all scorecard metrics for a single counterparty.
 *
 * Computes the following metrics from the provided data:
 * - totalLoansSubmitted
 * - passRate
 * - defectRate
 * - criticalDefectRate
 * - avgRemedyResponseDays
 * - openRemedyCases
 * - openRepurchaseCases
 * - totalExposure
 * - slaBreachRate
 *
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} loans - Array of loan objects for this counterparty.
 * @param {Array<Object>} defects - Array of defect objects for this counterparty.
 * @param {Array<Object>} remedies - Array of remedy case objects for this counterparty.
 * @param {Array<Object>} repurchases - Array of repurchase case objects for this counterparty.
 * @returns {Object} The aggregated scorecard object.
 *
 * @example
 * const scorecard = aggregateScorecardData('SELL-0001', loans, defects, remedies, repurchases);
 * console.log(scorecard.metrics.defectRate);
 */
export const aggregateScorecardData = (
  counterpartyId,
  loans,
  defects,
  remedies,
  repurchases,
) => {
  if (!validateCounterpartyId(counterpartyId)) {
    return {
      counterpartyId: counterpartyId || '',
      counterpartyName: '',
      metrics: { ...DEFAULT_METRICS },
      trends: { ...DEFAULT_TRENDS },
      peerComparison: { ...DEFAULT_PEER_COMPARISON },
    };
  }

  const safeLoans = ensureArray(loans, 'loans');
  const safeDefects = ensureArray(defects, 'defects');
  const safeRemedies = ensureArray(remedies, 'remedies');
  const safeRepurchases = ensureArray(repurchases, 'repurchases');

  const totalLoansSubmitted = safeLoans.length;
  const passRate = calculatePassRate(safeLoans);
  const defectRate = calculateDefectRate(safeDefects, safeLoans);
  const criticalDefectRate = calculateCriticalDefectRate(safeDefects, safeLoans);
  const avgRemedyResponseDays = calculateAvgRemedyResponseDays(safeRemedies);
  const openRemedyCases = countOpenRemedyCases(safeRemedies);
  const openRepurchaseCases = countOpenRepurchaseCases(safeRepurchases);
  const totalExposure = calculateTotalExposure(safeRemedies, safeRepurchases);
  const slaBreachRate = calculateSLABreachRate(safeRemedies, safeRepurchases);

  const counterpartyName =
    safeLoans.length > 0 && safeLoans[0].sellerId === counterpartyId
      ? counterpartyId
      : counterpartyId;

  const metrics = {
    totalLoansSubmitted,
    passRate: Math.round(passRate * 10000) / 10000,
    defectRate: Math.round(defectRate * 10000) / 10000,
    criticalDefectRate: Math.round(criticalDefectRate * 10000) / 10000,
    avgRemedyResponseDays,
    openRemedyCases,
    openRepurchaseCases,
    totalExposure,
    slaBreachRate: Math.round(slaBreachRate * 10000) / 10000,
  };

  debug(AGGREGATOR_NAME, 'Scorecard aggregated', {
    counterpartyId,
    totalLoansSubmitted,
    defectRate: metrics.defectRate,
  });

  return {
    counterpartyId,
    counterpartyName,
    metrics,
    trends: { ...DEFAULT_TRENDS },
    peerComparison: { ...DEFAULT_PEER_COMPARISON },
  };
};

/**
 * Calculates trend data for a counterparty over a specified number of months.
 *
 * Analyzes defect rates and remedy response times month-over-month to determine
 * trend direction (improving, worsening, stable) and magnitude of change.
 *
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} defects - Array of defect objects for this counterparty.
 * @param {Array<Object>} remedies - Array of remedy case objects for this counterparty.
 * @param {number} [months=6] - Number of months to look back for trend analysis.
 * @returns {Object} Trend data with direction and change values.
 *
 * @example
 * const trends = calculateTrendData('SELL-0001', defects, remedies, 6);
 * console.log(trends.defectRateTrend); // 'improving', 'worsening', or 'stable'
 */
export const calculateTrendData = (
  counterpartyId,
  defects,
  remedies,
  months = 6,
) => {
  if (!validateCounterpartyId(counterpartyId)) {
    return { ...DEFAULT_TRENDS };
  }

  const safeDefects = ensureArray(defects, 'defects');
  const safeRemedies = ensureArray(remedies, 'remedies');
  const safeMonths = typeof months === 'number' && months > 0 ? months : 6;

  const now = new Date();
  const monthBuckets = [];

  for (let i = safeMonths - 1; i >= 0; i--) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({
      label: `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`,
      startDate: bucketDate,
      endDate: new Date(bucketDate.getFullYear(), bucketDate.getMonth() + 1, 0, 23, 59, 59, 999),
      defectCount: 0,
      remedyCount: 0,
      totalRemedyAge: 0,
    });
  }

  for (const defect of safeDefects) {
    if (!defect || !defect.createdAt) continue;

    const defectDate = new Date(defect.createdAt);
    if (isNaN(defectDate.getTime())) continue;

    for (const bucket of monthBuckets) {
      if (defectDate >= bucket.startDate && defectDate <= bucket.endDate) {
        bucket.defectCount++;
        break;
      }
    }
  }

  for (const remedy of safeRemedies) {
    if (!remedy || !remedy.createdAt) continue;

    const remedyDate = new Date(remedy.createdAt);
    if (isNaN(remedyDate.getTime())) continue;

    for (const bucket of monthBuckets) {
      if (remedyDate >= bucket.startDate && remedyDate <= bucket.endDate) {
        bucket.remedyCount++;
        if (remedy.status !== 'closed' && remedy.status !== 'resolved') {
          const ageInMs = now - remedyDate;
          const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
          bucket.totalRemedyAge += ageInDays;
        }
        break;
      }
    }
  }

  const trendSeries = monthBuckets.map((bucket) => ({
    month: bucket.label,
    defectCount: bucket.defectCount,
    remedyCount: bucket.remedyCount,
    avgRemedyAge:
      bucket.remedyCount > 0
        ? Math.round((bucket.totalRemedyAge / bucket.remedyCount) * 10) / 10
        : 0,
  }));

  let defectRateTrend = 'stable';
  let defectRateChange = 0;
  let responseTimeTrend = 'stable';
  let responseTimeChange = 0;
  let exposureTrend = 'stable';
  let exposureChange = 0;

  if (trendSeries.length >= 2) {
    const firstHalf = trendSeries.slice(0, Math.floor(trendSeries.length / 2));
    const secondHalf = trendSeries.slice(Math.floor(trendSeries.length / 2));

    const firstHalfDefects = firstHalf.reduce((sum, b) => sum + b.defectCount, 0);
    const secondHalfDefects = secondHalf.reduce((sum, b) => sum + b.defectCount, 0);

    if (firstHalfDefects > 0) {
      defectRateChange =
        Math.round(
          ((secondHalfDefects - firstHalfDefects) / firstHalfDefects) * 10000,
        ) / 10000;
    } else if (secondHalfDefects > 0) {
      defectRateChange = 1;
    }

    if (defectRateChange < -0.1) {
      defectRateTrend = 'improving';
    } else if (defectRateChange > 0.1) {
      defectRateTrend = 'worsening';
    } else {
      defectRateTrend = 'stable';
    }

    const firstHalfRemedyAge =
      firstHalf.reduce((sum, b) => sum + b.avgRemedyAge, 0) /
      Math.max(1, firstHalf.filter((b) => b.remedyCount > 0).length);
    const secondHalfRemedyAge =
      secondHalf.reduce((sum, b) => sum + b.avgRemedyAge, 0) /
      Math.max(1, secondHalf.filter((b) => b.remedyCount > 0).length);

    if (firstHalfRemedyAge > 0) {
      responseTimeChange =
        Math.round(
          ((secondHalfRemedyAge - firstHalfRemedyAge) / firstHalfRemedyAge) * 10000,
        ) / 10000;
    } else if (secondHalfRemedyAge > 0) {
      responseTimeChange = 1;
    }

    if (responseTimeChange < -0.1) {
      responseTimeTrend = 'improving';
    } else if (responseTimeChange > 0.1) {
      responseTimeTrend = 'worsening';
    } else {
      responseTimeTrend = 'stable';
    }
  }

  debug(AGGREGATOR_NAME, 'Trend data calculated', {
    counterpartyId,
    defectRateTrend,
    defectRateChange,
    responseTimeTrend,
    responseTimeChange,
    monthsAnalyzed: trendSeries.length,
  });

  return {
    defectRateTrend,
    defectRateChange,
    responseTimeTrend,
    responseTimeChange,
    exposureTrend,
    exposureChange,
    trendSeries,
  };
};

/**
 * Calculates peer comparison data for a counterparty against all other counterparties.
 *
 * Computes peer averages for defect rate, critical defect rate, response time,
 * exposure, and pass rate. Also calculates the percentile rank of the given
 * counterparty among its peers.
 *
 * @param {string} counterpartyId - The counterparty identifier to compare.
 * @param {Array<Object>} allCounterparties - Array of all counterparty objects with their metrics.
 * @param {Array<Object>} allDefects - Array of all defect objects across all counterparties.
 * @param {Array<Object>} allRemedies - Array of all remedy case objects across all counterparties.
 * @returns {Object} Peer comparison data.
 *
 * @example
 * const peers = calculatePeerAverages('SELL-0001', allCounterparties, allDefects, allRemedies);
 * console.log(peers.peerAvgDefectRate);
 */
export const calculatePeerAverages = (
  counterpartyId,
  allCounterparties,
  allDefects,
  allRemedies,
) => {
  if (!validateCounterpartyId(counterpartyId)) {
    return { ...DEFAULT_PEER_COMPARISON };
  }

  const safeCounterparties = ensureArray(allCounterparties, 'allCounterparties');
  const safeDefects = ensureArray(allDefects, 'allDefects');
  const safeRemedies = ensureArray(allRemedies, 'allRemedies');

  const peers = safeCounterparties.filter(
    (cp) => cp && cp.id !== counterpartyId,
  );

  if (peers.length === 0) {
    debug(AGGREGATOR_NAME, 'No peers found for comparison', { counterpartyId });
    return {
      ...DEFAULT_PEER_COMPARISON,
      peerCount: 0,
    };
  }

  let totalPeerDefectRate = 0;
  let totalPeerCriticalDefectRate = 0;
  let totalPeerResponseDays = 0;
  let totalPeerExposure = 0;
  let totalPeerPassRate = 0;
  let peersWithData = 0;

  const peerScores = [];

  for (const peer of peers) {
    const peerId = peer.id;
    const peerDefects = safeDefects.filter((d) => d && d.sellerId === peerId);
    const peerRemedies = safeRemedies.filter((r) => r && r.sellerId === peerId);

    const peerLoans = peer.totalLoans || peer.performanceMetrics?.totalLoans || 0;
    const peerDefectRate =
      peerLoans > 0 ? peerDefects.length / peerLoans : 0;
    const peerCriticalDefectRate =
      peerLoans > 0
        ? peerDefects.filter((d) => d && d.severity === 'critical').length / peerLoans
        : 0;
    const peerResponseDays = calculateAvgRemedyResponseDays(peerRemedies);
    const peerExposure = calculateTotalExposure(peerRemedies, []);
    const peerPassRate =
      peer.performanceMetrics?.passRate || 0;

    totalPeerDefectRate += peerDefectRate;
    totalPeerCriticalDefectRate += peerCriticalDefectRate;
    totalPeerResponseDays += peerResponseDays;
    totalPeerExposure += peerExposure;
    totalPeerPassRate += peerPassRate;
    peersWithData++;

    peerScores.push({
      id: peerId,
      defectRate: peerDefectRate,
    });
  }

  if (peersWithData === 0) {
    return {
      ...DEFAULT_PEER_COMPARISON,
      peerCount: 0,
    };
  }

  const targetDefects = safeDefects.filter((d) => d && d.sellerId === counterpartyId);
  const targetLoans =
    safeCounterparties.find((cp) => cp && cp.id === counterpartyId)
      ?.performanceMetrics?.totalLoans || 0;
  const targetDefectRate =
    targetLoans > 0 ? targetDefects.length / targetLoans : 0;

  peerScores.sort((a, b) => a.defectRate - b.defectRate);

  let rank = 1;
  for (const peerScore of peerScores) {
    if (targetDefectRate > peerScore.defectRate) {
      rank++;
    }
  }

  const totalPeers = peerScores.length + 1;
  const percentileRank = Math.round(((totalPeers - rank) / totalPeers) * 100);

  const peerComparison = {
    peerAvgDefectRate:
      Math.round((totalPeerDefectRate / peersWithData) * 10000) / 10000,
    peerAvgCriticalDefectRate:
      Math.round((totalPeerCriticalDefectRate / peersWithData) * 10000) / 10000,
    peerAvgResponseDays:
      Math.round((totalPeerResponseDays / peersWithData) * 10) / 10,
    peerAvgExposure:
      Math.round((totalPeerExposure / peersWithData) * 100) / 100,
    peerAvgPassRate:
      Math.round((totalPeerPassRate / peersWithData) * 10000) / 10000,
    percentileRank,
    peerCount: peersWithData,
  };

  debug(AGGREGATOR_NAME, 'Peer comparison calculated', {
    counterpartyId,
    peerCount: peersWithData,
    percentileRank,
  });

  return peerComparison;
};

export default {
  aggregateScorecardData,
  calculateTrendData,
  calculatePeerAverages,
};