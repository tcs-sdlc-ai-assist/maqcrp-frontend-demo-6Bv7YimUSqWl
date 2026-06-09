import { debug, info, warn, error } from '../utils/logger';

const PORTFOLIO_NAME = 'PortfolioMetrics';

const DEFAULT_PORTFOLIO_SUMMARY = {
  totalLoans: 0,
  totalCounterparties: 0,
  overallDefectRate: 0,
  overallCriticalDefectRate: 0,
  passFailRatio: 0,
  activeWatchlistCount: 0,
  totalExposure: 0,
  openRemedyCases: 0,
  openRepurchaseCases: 0,
  slaBreachRate: 0,
  avgRemedyResponseDays: 0,
};

const DEFAULT_TOP_COUNTERPARTY = {
  counterpartyId: '',
  counterpartyName: '',
  totalLoans: 0,
  defectRate: 0,
  criticalDefectRate: 0,
  passRate: 0,
  totalExposure: 0,
  riskTier: 'unknown',
  riskScore: 0,
  onWatchlist: false,
};

const DEFAULT_CONCENTRATION = {
  byCounterparty: [],
  byProductType: [],
  byChannel: [],
  byRiskTier: [],
};

/**
 * Validates that a value is an array, returning an empty array if not.
 * Logs a warning if the value is not an array.
 * @param {*} value - The value to validate.
 * @param {string} label - A label for logging purposes.
 * @returns {Array}
 */
const ensureArray = (value, label) => {
  if (!Array.isArray(value)) {
    warn(PORTFOLIO_NAME, `${label} is not an array, using empty array`, {
      type: typeof value,
    });
    return [];
  }
  return value;
};

/**
 * Calculates the overall defect rate across all counterparties.
 * Defect rate = total defects / total loans.
 * @param {Array<Object>} defects - Array of defect objects.
 * @param {Array<Object>} loans - Array of loan objects.
 * @returns {number} Defect rate as a decimal (0.0 to 1.0).
 */
const calculateOverallDefectRate = (defects, loans) => {
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
 * Calculates the overall critical defect rate across all counterparties.
 * @param {Array<Object>} defects - Array of defect objects.
 * @param {Array<Object>} loans - Array of loan objects.
 * @returns {number} Critical defect rate as a decimal (0.0 to 1.0).
 */
const calculateOverallCriticalDefectRate = (defects, loans) => {
  const loanCount = loans.length;

  if (loanCount === 0) {
    return 0;
  }

  const criticalDefects = defects.filter((d) => d && d.severity === 'critical');

  if (criticalDefects.length === 0) {
    return 0;
  }

  return Math.min(1, criticalDefects.length / loanCount);
};

/**
 * Calculates the pass/fail ratio across all loans.
 * Ratio = passed loans / failed loans. Returns 0 if no failed loans.
 * @param {Array<Object>} loans - Array of loan objects.
 * @returns {number} Pass/fail ratio.
 */
const calculatePassFailRatio = (loans) => {
  const passedLoans = loans.filter(
    (loan) => loan && (loan.status === 'PASS' || loan.status === 'VALIDATED'),
  ).length;

  const failedLoans = loans.filter(
    (loan) => loan && (loan.status === 'FAIL'),
  ).length;

  if (failedLoans === 0) {
    return passedLoans > 0 ? Infinity : 0;
  }

  return Math.round((passedLoans / failedLoans) * 100) / 100;
};

/**
 * Counts the number of active watchlist entries.
 * @param {Array<Object>} watchlist - Array of watchlist entry objects.
 * @returns {number}
 */
const countActiveWatchlist = (watchlist) => {
  if (!Array.isArray(watchlist)) {
    return 0;
  }

  return watchlist.filter((entry) => entry && entry.status === 'active').length;
};

/**
 * Calculates the total financial exposure across all open remedy and repurchase cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number} Total exposure in dollars.
 */
const calculateTotalExposure = (remedies, repurchases) => {
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
      } else if (
        repurchase.demandAmount !== undefined &&
        repurchase.demandAmount !== null
      ) {
        totalExposure += repurchase.demandAmount;
      }
    }
  }

  return Math.round(totalExposure * 100) / 100;
};

/**
 * Counts the number of open remedy cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @returns {number}
 */
const countOpenRemedyCases = (remedies) => {
  if (!Array.isArray(remedies)) {
    return 0;
  }

  return remedies.filter(
    (r) => r && r.status !== 'closed' && r.status !== 'resolved',
  ).length;
};

/**
 * Counts the number of open repurchase cases.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number}
 */
const countOpenRepurchaseCases = (repurchases) => {
  if (!Array.isArray(repurchases)) {
    return 0;
  }

  return repurchases.filter(
    (r) => r && r.status !== 'closed' && r.status !== 'draft',
  ).length;
};

/**
 * Calculates the SLA breach rate across all remedy and repurchase cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @param {Array<Object>} repurchases - Array of repurchase case objects.
 * @returns {number} SLA breach rate as a decimal (0.0 to 1.0).
 */
const calculateSLABreachRate = (remedies, repurchases) => {
  let totalCases = 0;
  let breachedCases = 0;

  if (Array.isArray(remedies)) {
    for (const remedy of remedies) {
      if (!remedy) continue;
      totalCases++;
      if (remedy.slaBreached === true) {
        breachedCases++;
      }
    }
  }

  if (Array.isArray(repurchases)) {
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
  }

  if (totalCases === 0) {
    return 0;
  }

  return Math.min(1, breachedCases / totalCases);
};

/**
 * Calculates the average remedy response time in days for open/in-progress remedy cases.
 * @param {Array<Object>} remedies - Array of remedy case objects.
 * @returns {number} Average response time in days.
 */
const calculateAvgRemedyResponseDays = (remedies) => {
  if (!Array.isArray(remedies)) {
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
 * Calculates the defect rate for a specific counterparty.
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} defects - Array of all defect objects.
 * @param {Array<Object>} loans - Array of all loan objects.
 * @returns {number} Defect rate as a decimal (0.0 to 1.0).
 */
const calculateCounterpartyDefectRate = (counterpartyId, defects, loans) => {
  const counterpartyLoans = loans.filter(
    (loan) => loan && loan.sellerId === counterpartyId,
  );

  const loanCount = counterpartyLoans.length;

  if (loanCount === 0) {
    return 0;
  }

  const counterpartyDefects = defects.filter(
    (defect) => defect && defect.sellerId === counterpartyId,
  );

  return Math.min(1, counterpartyDefects.length / loanCount);
};

/**
 * Calculates the critical defect rate for a specific counterparty.
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} defects - Array of all defect objects.
 * @param {Array<Object>} loans - Array of all loan objects.
 * @returns {number} Critical defect rate as a decimal (0.0 to 1.0).
 */
const calculateCounterpartyCriticalDefectRate = (counterpartyId, defects, loans) => {
  const counterpartyLoans = loans.filter(
    (loan) => loan && loan.sellerId === counterpartyId,
  );

  const loanCount = counterpartyLoans.length;

  if (loanCount === 0) {
    return 0;
  }

  const criticalDefects = defects.filter(
    (defect) =>
      defect &&
      defect.sellerId === counterpartyId &&
      defect.severity === 'critical',
  );

  return Math.min(1, criticalDefects.length / loanCount);
};

/**
 * Calculates the pass rate for a specific counterparty.
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} loans - Array of all loan objects.
 * @returns {number} Pass rate as a decimal (0.0 to 1.0).
 */
const calculateCounterpartyPassRate = (counterpartyId, loans) => {
  const counterpartyLoans = loans.filter(
    (loan) => loan && loan.sellerId === counterpartyId,
  );

  const loanCount = counterpartyLoans.length;

  if (loanCount === 0) {
    return 0;
  }

  const passedLoans = counterpartyLoans.filter(
    (loan) => loan.status === 'PASS' || loan.status === 'VALIDATED',
  );

  return passedLoans.length / loanCount;
};

/**
 * Calculates the total exposure for a specific counterparty.
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} remedies - Array of all remedy case objects.
 * @param {Array<Object>} repurchases - Array of all repurchase case objects.
 * @returns {number} Total exposure in dollars.
 */
const calculateCounterpartyExposure = (counterpartyId, remedies, repurchases) => {
  let totalExposure = 0;

  if (Array.isArray(remedies)) {
    for (const remedy of remedies) {
      if (!remedy) continue;
      if (remedy.sellerId !== counterpartyId) continue;
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
      if (repurchase.sellerId !== counterpartyId) continue;
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
  }

  return Math.round(totalExposure * 100) / 100;
};

/**
 * Determines the risk tier for a counterparty based on defect rate.
 * Uses a simplified tier calculation for portfolio-level ranking.
 * @param {number} defectRate - The counterparty's defect rate.
 * @param {number} criticalDefectRate - The counterparty's critical defect rate.
 * @returns {{ tier: string, score: number }}
 */
const determineRiskTier = (defectRate, criticalDefectRate) => {
  let score = 0;

  if (defectRate > 0) {
    score += Math.min(60, Math.round((defectRate / 0.1) * 60));
  }

  if (criticalDefectRate > 0) {
    score += Math.min(40, Math.round((criticalDefectRate / 0.05) * 40));
  }

  score = Math.max(0, Math.min(100, score));

  let tier;
  if (score >= 67) {
    tier = 'high';
  } else if (score >= 34) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  return { tier, score };
};

/**
 * Checks if a counterparty is on the active watchlist.
 * @param {string} counterpartyId - The counterparty identifier.
 * @param {Array<Object>} watchlist - Array of watchlist entry objects.
 * @returns {boolean}
 */
const isOnWatchlist = (counterpartyId, watchlist) => {
  if (!Array.isArray(watchlist)) {
    return false;
  }

  return watchlist.some(
    (entry) =>
      entry &&
      entry.counterpartyId === counterpartyId &&
      entry.status === 'active',
  );
};

/**
 * Computes the portfolio-level summary metrics across all counterparties.
 *
 * Aggregates data from loans, defects, remedies, repurchases, counterparties,
 * and watchlist to produce executive-level KPIs.
 *
 * @param {Array<Object>} loans - Array of all loan objects.
 * @param {Array<Object>} defects - Array of all defect objects.
 * @param {Array<Object>} remedies - Array of all remedy case objects.
 * @param {Array<Object>} repurchases - Array of all repurchase case objects.
 * @param {Array<Object>} counterparties - Array of all counterparty objects.
 * @param {Array<Object>} [watchlist] - Array of watchlist entry objects.
 * @returns {Object} Portfolio summary object with executive KPIs.
 *
 * @example
 * const summary = getPortfolioSummary(loans, defects, remedies, repurchases, counterparties, watchlist);
 * console.log(summary.totalLoans); // 50
 * console.log(summary.overallDefectRate); // 0.031
 */
export const getPortfolioSummary = (
  loans,
  defects,
  remedies,
  repurchases,
  counterparties,
  watchlist,
) => {
  const safeLoans = ensureArray(loans, 'loans');
  const safeDefects = ensureArray(defects, 'defects');
  const safeRemedies = ensureArray(remedies, 'remedies');
  const safeRepurchases = ensureArray(repurchases, 'repurchases');
  const safeCounterparties = ensureArray(counterparties, 'counterparties');
  const safeWatchlist = ensureArray(watchlist, 'watchlist');

  if (safeLoans.length === 0 && safeCounterparties.length === 0) {
    debug(PORTFOLIO_NAME, 'No data available for portfolio summary');
    return { ...DEFAULT_PORTFOLIO_SUMMARY };
  }

  const totalLoans = safeLoans.length;
  const totalCounterparties = safeCounterparties.length;
  const overallDefectRate = calculateOverallDefectRate(safeDefects, safeLoans);
  const overallCriticalDefectRate = calculateOverallCriticalDefectRate(safeDefects, safeLoans);
  const passFailRatio = calculatePassFailRatio(safeLoans);
  const activeWatchlistCount = countActiveWatchlist(safeWatchlist);
  const totalExposure = calculateTotalExposure(safeRemedies, safeRepurchases);
  const openRemedyCases = countOpenRemedyCases(safeRemedies);
  const openRepurchaseCases = countOpenRepurchaseCases(safeRepurchases);
  const slaBreachRate = calculateSLABreachRate(safeRemedies, safeRepurchases);
  const avgRemedyResponseDays = calculateAvgRemedyResponseDays(safeRemedies);

  const summary = {
    totalLoans,
    totalCounterparties,
    overallDefectRate: Math.round(overallDefectRate * 10000) / 10000,
    overallCriticalDefectRate: Math.round(overallCriticalDefectRate * 10000) / 10000,
    passFailRatio,
    activeWatchlistCount,
    totalExposure,
    openRemedyCases,
    openRepurchaseCases,
    slaBreachRate: Math.round(slaBreachRate * 10000) / 10000,
    avgRemedyResponseDays,
  };

  debug(PORTFOLIO_NAME, 'Portfolio summary computed', {
    totalLoans,
    totalCounterparties,
    overallDefectRate: summary.overallDefectRate,
  });

  return summary;
};

/**
 * Returns a ranked list of the top counterparties by defect rate.
 *
 * Each entry includes the counterparty's key metrics: total loans, defect rate,
 * critical defect rate, pass rate, total exposure, risk tier, risk score,
 * and watchlist status.
 *
 * @param {Array<Object>} loans - Array of all loan objects.
 * @param {Array<Object>} defects - Array of all defect objects.
 * @param {Array<Object>} remedies - Array of all remedy case objects.
 * @param {Array<Object>} repurchases - Array of all repurchase case objects.
 * @param {Array<Object>} counterparties - Array of all counterparty objects.
 * @param {Array<Object>} [watchlist] - Array of watchlist entry objects.
 * @param {number} [limit=10] - Maximum number of counterparties to return.
 * @param {string} [sortBy='defectRate'] - Metric to sort by: 'defectRate', 'criticalDefectRate', 'exposure', 'passRate'.
 * @param {string} [order='desc'] - Sort order: 'asc' or 'desc'.
 * @returns {Array<Object>} Ranked array of counterparty summary objects.
 *
 * @example
 * const top = getTopCounterparties(loans, defects, remedies, repurchases, counterparties, watchlist, 5);
 * console.log(top[0].counterpartyName); // Name of the counterparty with the highest defect rate
 */
export const getTopCounterparties = (
  loans,
  defects,
  remedies,
  repurchases,
  counterparties,
  watchlist,
  limit = 10,
  sortBy = 'defectRate',
  order = 'desc',
) => {
  const safeLoans = ensureArray(loans, 'loans');
  const safeDefects = ensureArray(defects, 'defects');
  const safeRemedies = ensureArray(remedies, 'remedies');
  const safeRepurchases = ensureArray(repurchases, 'repurchases');
  const safeCounterparties = ensureArray(counterparties, 'counterparties');
  const safeWatchlist = ensureArray(watchlist, 'watchlist');

  if (safeCounterparties.length === 0) {
    debug(PORTFOLIO_NAME, 'No counterparties available for top ranking');
    return [];
  }

  const validSortFields = ['defectRate', 'criticalDefectRate', 'exposure', 'passRate'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'defectRate';
  const safeOrder = order === 'asc' ? 'asc' : 'desc';
  const safeLimit = typeof limit === 'number' && limit > 0 ? limit : 10;

  const ranked = [];

  for (const counterparty of safeCounterparties) {
    if (!counterparty || !counterparty.id) {
      continue;
    }

    const counterpartyId = counterparty.id;
    const counterpartyName = counterparty.name || counterpartyId;
    const totalLoans = safeLoans.filter(
      (loan) => loan && loan.sellerId === counterpartyId,
    ).length;

    const defectRate = calculateCounterpartyDefectRate(
      counterpartyId,
      safeDefects,
      safeLoans,
    );
    const criticalDefectRate = calculateCounterpartyCriticalDefectRate(
      counterpartyId,
      safeDefects,
      safeLoans,
    );
    const passRate = calculateCounterpartyPassRate(counterpartyId, safeLoans);
    const totalExposure = calculateCounterpartyExposure(
      counterpartyId,
      safeRemedies,
      safeRepurchases,
    );
    const { tier, score } = determineRiskTier(defectRate, criticalDefectRate);
    const onWatchlist = isOnWatchlist(counterpartyId, safeWatchlist);

    ranked.push({
      counterpartyId,
      counterpartyName,
      totalLoans,
      defectRate: Math.round(defectRate * 10000) / 10000,
      criticalDefectRate: Math.round(criticalDefectRate * 10000) / 10000,
      passRate: Math.round(passRate * 10000) / 10000,
      totalExposure,
      riskTier: tier,
      riskScore: score,
      onWatchlist,
    });
  }

  ranked.sort((a, b) => {
    const aVal = a[safeSortBy];
    const bVal = b[safeSortBy];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (safeOrder === 'asc') {
      return aVal - bVal;
    }
    return bVal - aVal;
  });

  const result = ranked.slice(0, safeLimit);

  debug(PORTFOLIO_NAME, 'Top counterparties computed', {
    sortBy: safeSortBy,
    order: safeOrder,
    limit: safeLimit,
    resultCount: result.length,
  });

  return result;
};

/**
 * Returns concentration breakdown data for portfolio analysis.
 *
 * Provides three breakdowns:
 * - byCounterparty: Loan count and percentage per counterparty
 * - byProductType: Loan count and percentage per product type
 * - byChannel: Loan count and percentage per channel
 * - byRiskTier: Counterparty count per risk tier
 *
 * @param {Array<Object>} loans - Array of all loan objects.
 * @param {Array<Object>} defects - Array of all defect objects.
 * @param {Array<Object>} counterparties - Array of all counterparty objects.
 * @returns {Object} Concentration breakdown object.
 *
 * @example
 * const concentration = getConcentrationData(loans, defects, counterparties);
 * console.log(concentration.byProductType);
 * // [{ name: 'conventional', count: 20, percentage: 40 }, ...]
 */
export const getConcentrationData = (loans, defects, counterparties) => {
  const safeLoans = ensureArray(loans, 'loans');
  const safeDefects = ensureArray(defects, 'defects');
  const safeCounterparties = ensureArray(counterparties, 'counterparties');

  if (safeLoans.length === 0) {
    debug(PORTFOLIO_NAME, 'No loan data available for concentration analysis');
    return { ...DEFAULT_CONCENTRATION };
  }

  const totalLoans = safeLoans.length;

  const counterpartyMap = new Map();
  for (const loan of safeLoans) {
    if (!loan || !loan.sellerId) continue;
    const sellerId = loan.sellerId;
    counterpartyMap.set(sellerId, (counterpartyMap.get(sellerId) || 0) + 1);
  }

  const byCounterparty = [];
  for (const [sellerId, count] of counterpartyMap.entries()) {
    const counterparty = safeCounterparties.find((cp) => cp && cp.id === sellerId);
    const name = counterparty ? counterparty.name : sellerId;
    byCounterparty.push({
      counterpartyId: sellerId,
      counterpartyName: name,
      count,
      percentage: Math.round((count / totalLoans) * 10000) / 100,
    });
  }
  byCounterparty.sort((a, b) => b.count - a.count);

  const productTypeMap = new Map();
  for (const loan of safeLoans) {
    if (!loan || !loan.productType) continue;
    const productType = loan.productType;
    productTypeMap.set(productType, (productTypeMap.get(productType) || 0) + 1);
  }

  const byProductType = [];
  for (const [productType, count] of productTypeMap.entries()) {
    byProductType.push({
      name: productType,
      count,
      percentage: Math.round((count / totalLoans) * 10000) / 100,
    });
  }
  byProductType.sort((a, b) => b.count - a.count);

  const channelMap = new Map();
  for (const loan of safeLoans) {
    if (!loan || !loan.channel) continue;
    const channel = loan.channel;
    channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
  }

  const byChannel = [];
  for (const [channel, count] of channelMap.entries()) {
    byChannel.push({
      name: channel,
      count,
      percentage: Math.round((count / totalLoans) * 10000) / 100,
    });
  }
  byChannel.sort((a, b) => b.count - a.count);

  const riskTierMap = new Map();
  for (const counterparty of safeCounterparties) {
    if (!counterparty || !counterparty.id) continue;

    const counterpartyId = counterparty.id;
    const defectRate = calculateCounterpartyDefectRate(
      counterpartyId,
      safeDefects,
      safeLoans,
    );
    const criticalDefectRate = calculateCounterpartyCriticalDefectRate(
      counterpartyId,
      safeDefects,
      safeLoans,
    );
    const { tier } = determineRiskTier(defectRate, criticalDefectRate);

    riskTierMap.set(tier, (riskTierMap.get(tier) || 0) + 1);
  }

  const byRiskTier = [];
  const tierOrder = ['high', 'medium', 'low'];
  for (const tier of tierOrder) {
    const count = riskTierMap.get(tier) || 0;
    if (count > 0 || tierOrder.indexOf(tier) === 0) {
      byRiskTier.push({
        name: tier,
        count,
        percentage:
          safeCounterparties.length > 0
            ? Math.round((count / safeCounterparties.length) * 10000) / 100
            : 0,
      });
    }
  }

  const concentration = {
    byCounterparty,
    byProductType,
    byChannel,
    byRiskTier,
  };

  debug(PORTFOLIO_NAME, 'Concentration data computed', {
    counterpartyCount: byCounterparty.length,
    productTypeCount: byProductType.length,
    channelCount: byChannel.length,
    riskTierCount: byRiskTier.length,
  });

  return concentration;
};

export default {
  getPortfolioSummary,
  getTopCounterparties,
  getConcentrationData,
};