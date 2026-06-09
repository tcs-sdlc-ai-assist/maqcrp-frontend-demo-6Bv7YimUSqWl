import { useMemo } from 'react';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { getPortfolioSummary, getTopCounterparties, getConcentrationData } from '../services/portfolioMetrics';
import { debug, warn } from '../utils/logger';

const HOOK_NAME = 'usePortfolioMetrics';

/**
 * @typedef {Object} PortfolioSummary
 * @property {number} totalLoans
 * @property {number} totalCounterparties
 * @property {number} overallDefectRate
 * @property {number} overallCriticalDefectRate
 * @property {number} passFailRatio
 * @property {number} activeWatchlistCount
 * @property {number} totalExposure
 * @property {number} openRemedyCases
 * @property {number} openRepurchaseCases
 * @property {number} slaBreachRate
 * @property {number} avgRemedyResponseDays
 */

/**
 * @typedef {Object} TopCounterparty
 * @property {string} counterpartyId
 * @property {string} counterpartyName
 * @property {number} totalLoans
 * @property {number} defectRate
 * @property {number} criticalDefectRate
 * @property {number} passRate
 * @property {number} totalExposure
 * @property {string} riskTier
 * @property {number} riskScore
 * @property {boolean} onWatchlist
 */

/**
 * @typedef {Object} ConcentrationData
 * @property {Array<Object>} byCounterparty
 * @property {Array<Object>} byProductType
 * @property {Array<Object>} byChannel
 * @property {Array<Object>} byRiskTier
 */

/**
 * @typedef {Object} PortfolioMetricsResult
 * @property {PortfolioSummary} portfolioSummary
 * @property {TopCounterparty[]} topCounterparties
 * @property {ConcentrationData} concentrationData
 * @property {boolean} isLoading
 */

/**
 * Custom hook that provides portfolio-level metrics for executive dashboards.
 *
 * Aggregates data from loans, defects, remedies, repurchases, counterparties,
 * and watchlist to produce executive KPIs, top counterparty rankings, and
 * concentration breakdowns. All results are memoized and only recomputed
 * when the underlying data changes.
 *
 * @returns {PortfolioMetricsResult}
 *
 * @example
 * const { portfolioSummary, topCounterparties, concentrationData, isLoading } = usePortfolioMetrics();
 * console.log(portfolioSummary.totalLoans);
 * console.log(topCounterparties[0].counterpartyName);
 */
export const usePortfolioMetrics = () => {
  const {
    loans,
    sellers,
    defects,
    remedyCases,
    repurchaseCases,
    isLoading: isMockDataLoading,
  } = useMockData();

  const { watchlist } = useOversight();

  const safeLoans = useMemo(() => {
    return Array.isArray(loans) ? loans : [];
  }, [loans]);

  const safeSellers = useMemo(() => {
    return Array.isArray(sellers) ? sellers : [];
  }, [sellers]);

  const safeDefects = useMemo(() => {
    return Array.isArray(defects) ? defects : [];
  }, [defects]);

  const safeRemedies = useMemo(() => {
    return Array.isArray(remedyCases) ? remedyCases : [];
  }, [remedyCases]);

  const safeRepurchases = useMemo(() => {
    return Array.isArray(repurchaseCases) ? repurchaseCases : [];
  }, [repurchaseCases]);

  const safeWatchlist = useMemo(() => {
    return Array.isArray(watchlist) ? watchlist : [];
  }, [watchlist]);

  const counterparties = useMemo(() => {
    if (safeSellers.length === 0) {
      return [];
    }

    return safeSellers.map((seller) => ({
      id: seller.id,
      name: seller.name,
      status: seller.status,
      performanceMetrics: seller.performanceMetrics,
    }));
  }, [safeSellers]);

  const portfolioSummary = useMemo(() => {
    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Mock data is loading, deferring portfolio summary calculation');
      return null;
    }

    if (safeLoans.length === 0 && counterparties.length === 0) {
      debug(HOOK_NAME, 'No data available for portfolio summary');
      return null;
    }

    try {
      const summary = getPortfolioSummary(
        safeLoans,
        safeDefects,
        safeRemedies,
        safeRepurchases,
        counterparties,
        safeWatchlist,
      );

      debug(HOOK_NAME, 'Portfolio summary computed', {
        totalLoans: summary.totalLoans,
        totalCounterparties: summary.totalCounterparties,
        overallDefectRate: summary.overallDefectRate,
      });

      return summary;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to compute portfolio summary', err);
      return null;
    }
  }, [
    isMockDataLoading,
    safeLoans,
    safeDefects,
    safeRemedies,
    safeRepurchases,
    counterparties,
    safeWatchlist,
  ]);

  const topCounterparties = useMemo(() => {
    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Mock data is loading, deferring top counterparties calculation');
      return [];
    }

    if (counterparties.length === 0) {
      debug(HOOK_NAME, 'No counterparties available for top ranking');
      return [];
    }

    try {
      const top = getTopCounterparties(
        safeLoans,
        safeDefects,
        safeRemedies,
        safeRepurchases,
        counterparties,
        safeWatchlist,
        10,
        'defectRate',
        'desc',
      );

      debug(HOOK_NAME, 'Top counterparties computed', {
        resultCount: top.length,
      });

      return top;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to compute top counterparties', err);
      return [];
    }
  }, [
    isMockDataLoading,
    safeLoans,
    safeDefects,
    safeRemedies,
    safeRepurchases,
    counterparties,
    safeWatchlist,
  ]);

  const concentrationData = useMemo(() => {
    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Mock data is loading, deferring concentration data calculation');
      return null;
    }

    if (safeLoans.length === 0) {
      debug(HOOK_NAME, 'No loan data available for concentration analysis');
      return null;
    }

    try {
      const concentration = getConcentrationData(
        safeLoans,
        safeDefects,
        counterparties,
      );

      debug(HOOK_NAME, 'Concentration data computed', {
        counterpartyCount: concentration.byCounterparty.length,
        productTypeCount: concentration.byProductType.length,
        channelCount: concentration.byChannel.length,
      });

      return concentration;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to compute concentration data', err);
      return null;
    }
  }, [
    isMockDataLoading,
    safeLoans,
    safeDefects,
    counterparties,
  ]);

  const isLoading = isMockDataLoading;

  return {
    portfolioSummary,
    topCounterparties,
    concentrationData,
    isLoading,
  };
};

export default usePortfolioMetrics;