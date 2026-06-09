import { useMemo } from 'react';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { aggregateScorecardData, calculateTrendData, calculatePeerAverages } from '../services/scorecardAggregator';
import { debug, warn } from '../utils/logger';

const HOOK_NAME = 'useScorecardData';

/**
 * @typedef {Object} DefectBreakdown
 * @property {string} category
 * @property {number} count
 * @property {number} percentage
 */

/**
 * @typedef {Object} ScorecardResult
 * @property {Object} scorecard - Aggregated scorecard metrics for the counterparty.
 * @property {Object} trendData - Month-over-month trend analysis.
 * @property {Object} peerComparison - Peer comparison data.
 * @property {Array<DefectBreakdown>} defectBreakdown - Defect breakdown by category.
 * @property {boolean} isLoading - Whether data is still loading.
 */

/**
 * Custom hook that returns scorecard data for a single counterparty.
 *
 * Aggregates metrics, trend data, peer comparisons, and defect breakdowns
 * from the mock data context. Results are memoized and only recomputed
 * when the underlying data or counterpartyId changes.
 *
 * @param {string} counterpartyId - The counterparty identifier.
 * @returns {ScorecardResult}
 *
 * @example
 * const { scorecard, trendData, peerComparison, defectBreakdown, isLoading } = useScorecardData('SELL-0001');
 */
export const useScorecardData = (counterpartyId) => {
  const {
    sellers,
    defects,
    remedyCases,
    repurchaseCases,
    loans,
    isLoading: isMockDataLoading,
  } = useMockData();

  const { riskTierCache } = useOversight();

  const safeCounterpartyId = counterpartyId && typeof counterpartyId === 'string' ? counterpartyId : '';

  const counterpartyLoans = useMemo(() => {
    if (!safeCounterpartyId || !Array.isArray(loans)) {
      return [];
    }
    return loans.filter((loan) => loan && loan.sellerId === safeCounterpartyId);
  }, [loans, safeCounterpartyId]);

  const counterpartyDefects = useMemo(() => {
    if (!safeCounterpartyId || !Array.isArray(defects)) {
      return [];
    }
    return defects.filter((defect) => defect && defect.sellerId === safeCounterpartyId);
  }, [defects, safeCounterpartyId]);

  const counterpartyRemedies = useMemo(() => {
    if (!safeCounterpartyId || !Array.isArray(remedyCases)) {
      return [];
    }
    return remedyCases.filter((remedy) => remedy && remedy.sellerId === safeCounterpartyId);
  }, [remedyCases, safeCounterpartyId]);

  const counterpartyRepurchases = useMemo(() => {
    if (!safeCounterpartyId || !Array.isArray(repurchaseCases)) {
      return [];
    }
    return repurchaseCases.filter((repurchase) => repurchase && repurchase.sellerId === safeCounterpartyId);
  }, [repurchaseCases, safeCounterpartyId]);

  const allCounterparties = useMemo(() => {
    if (!Array.isArray(sellers)) {
      return [];
    }
    return sellers.map((seller) => ({
      id: seller.id,
      name: seller.name,
      status: seller.status,
      performanceMetrics: seller.performanceMetrics,
    }));
  }, [sellers]);

  const scorecard = useMemo(() => {
    if (!safeCounterpartyId) {
      debug(HOOK_NAME, 'No counterpartyId provided, returning empty scorecard');
      return null;
    }

    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Mock data is loading, deferring scorecard aggregation');
      return null;
    }

    try {
      const result = aggregateScorecardData(
        safeCounterpartyId,
        counterpartyLoans,
        counterpartyDefects,
        counterpartyRemedies,
        counterpartyRepurchases,
      );

      if (riskTierCache && riskTierCache[safeCounterpartyId]) {
        const cachedTier = riskTierCache[safeCounterpartyId];
        result.riskTier = {
          current: cachedTier.current || 'unknown',
          previous: cachedTier.previous || 'unknown',
          score: cachedTier.score || 0,
          factors: cachedTier.factors || [],
        };
      } else {
        result.riskTier = {
          current: 'unknown',
          previous: 'unknown',
          score: 0,
          factors: [],
        };
      }

      debug(HOOK_NAME, 'Scorecard aggregated', {
        counterpartyId: safeCounterpartyId,
        totalLoans: result.metrics.totalLoansSubmitted,
        defectRate: result.metrics.defectRate,
      });

      return result;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to aggregate scorecard data', {
        counterpartyId: safeCounterpartyId,
        error: err,
      });
      return null;
    }
  }, [
    safeCounterpartyId,
    counterpartyLoans,
    counterpartyDefects,
    counterpartyRemedies,
    counterpartyRepurchases,
    riskTierCache,
    isMockDataLoading,
  ]);

  const trendData = useMemo(() => {
    if (!safeCounterpartyId) {
      return null;
    }

    if (isMockDataLoading) {
      return null;
    }

    try {
      const trends = calculateTrendData(
        safeCounterpartyId,
        counterpartyDefects,
        counterpartyRemedies,
        6,
      );

      debug(HOOK_NAME, 'Trend data calculated', {
        counterpartyId: safeCounterpartyId,
        defectRateTrend: trends.defectRateTrend,
      });

      return trends;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to calculate trend data', {
        counterpartyId: safeCounterpartyId,
        error: err,
      });
      return null;
    }
  }, [safeCounterpartyId, counterpartyDefects, counterpartyRemedies, isMockDataLoading]);

  const peerComparison = useMemo(() => {
    if (!safeCounterpartyId) {
      return null;
    }

    if (isMockDataLoading) {
      return null;
    }

    if (allCounterparties.length <= 1) {
      debug(HOOK_NAME, 'Insufficient peers for comparison', {
        counterpartyId: safeCounterpartyId,
        totalCounterparties: allCounterparties.length,
      });
      return {
        peerAvgDefectRate: 0,
        peerAvgCriticalDefectRate: 0,
        peerAvgResponseDays: 0,
        peerAvgExposure: 0,
        peerAvgPassRate: 0,
        percentileRank: 50,
        peerCount: 0,
      };
    }

    try {
      const comparison = calculatePeerAverages(
        safeCounterpartyId,
        allCounterparties,
        defects,
        remedyCases,
      );

      debug(HOOK_NAME, 'Peer comparison calculated', {
        counterpartyId: safeCounterpartyId,
        peerCount: comparison.peerCount,
        percentileRank: comparison.percentileRank,
      });

      return comparison;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to calculate peer comparison', {
        counterpartyId: safeCounterpartyId,
        error: err,
      });
      return null;
    }
  }, [safeCounterpartyId, allCounterparties, defects, remedyCases, isMockDataLoading]);

  const defectBreakdown = useMemo(() => {
    if (!safeCounterpartyId) {
      return [];
    }

    if (isMockDataLoading) {
      return [];
    }

    if (counterpartyDefects.length === 0) {
      return [];
    }

    try {
      const categoryMap = new Map();

      for (const defect of counterpartyDefects) {
        if (!defect || !defect.category) {
          continue;
        }

        const category = defect.category;
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }

      const totalDefects = counterpartyDefects.length;
      const breakdown = [];

      for (const [category, count] of categoryMap.entries()) {
        breakdown.push({
          category,
          count,
          percentage: totalDefects > 0
            ? Math.round((count / totalDefects) * 10000) / 100
            : 0,
        });
      }

      breakdown.sort((a, b) => b.count - a.count);

      debug(HOOK_NAME, 'Defect breakdown computed', {
        counterpartyId: safeCounterpartyId,
        totalDefects,
        categoryCount: breakdown.length,
      });

      return breakdown;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to compute defect breakdown', {
        counterpartyId: safeCounterpartyId,
        error: err,
      });
      return [];
    }
  }, [safeCounterpartyId, counterpartyDefects, isMockDataLoading]);

  const isLoading = isMockDataLoading;

  return {
    scorecard,
    trendData,
    peerComparison,
    defectBreakdown,
    isLoading,
  };
};

export default useScorecardData;