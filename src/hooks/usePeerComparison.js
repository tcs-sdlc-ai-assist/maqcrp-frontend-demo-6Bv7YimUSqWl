import { useMemo } from 'react';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { calculatePeerAverages } from '../services/scorecardAggregator';
import { debug, warn } from '../utils/logger';

const HOOK_NAME = 'usePeerComparison';

/**
 * @typedef {Object} PeerAverages
 * @property {number} peerAvgDefectRate
 * @property {number} peerAvgCriticalDefectRate
 * @property {number} peerAvgResponseDays
 * @property {number} peerAvgExposure
 * @property {number} peerAvgPassRate
 * @property {number} percentileRank
 * @property {number} peerCount
 */

/**
 * @typedef {Object} ComparisonData
 * @property {number} defectRateDelta
 * @property {number} criticalDefectRateDelta
 * @property {number} responseDaysDelta
 * @property {number} exposureDelta
 * @property {number} passRateDelta
 * @property {string} defectRateComparison
 * @property {string} criticalDefectRateComparison
 * @property {string} responseDaysComparison
 * @property {string} exposureComparison
 * @property {string} passRateComparison
 * @property {string} overallAssessment
 */

/**
 * @typedef {Object} PeerComparisonResult
 * @property {PeerAverages} peerAverages
 * @property {ComparisonData} comparisonData
 * @property {boolean} isLoading
 */

/**
 * Custom hook that returns peer comparison data for a single counterparty.
 *
 * Computes peer averages across all other counterparties and compares the
 * target counterparty's metrics against those averages. Results are memoized
 * and only recomputed when the underlying data or counterpartyId changes.
 *
 * @param {string} counterpartyId - The counterparty identifier.
 * @returns {PeerComparisonResult}
 *
 * @example
 * const { peerAverages, comparisonData, isLoading } = usePeerComparison('SELL-0001');
 * console.log(peerAverages.peerAvgDefectRate);
 * console.log(comparisonData.overallAssessment);
 */
export const usePeerComparison = (counterpartyId) => {
  const {
    sellers,
    defects,
    remedyCases,
    loans,
    isLoading: isMockDataLoading,
  } = useMockData();

  const { riskTierCache } = useOversight();

  const safeCounterpartyId = counterpartyId && typeof counterpartyId === 'string' ? counterpartyId : '';

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

  const safeDefects = useMemo(() => {
    return Array.isArray(defects) ? defects : [];
  }, [defects]);

  const safeRemedies = useMemo(() => {
    return Array.isArray(remedyCases) ? remedyCases : [];
  }, [remedyCases]);

  const safeLoans = useMemo(() => {
    return Array.isArray(loans) ? loans : [];
  }, [loans]);

  const targetCounterparty = useMemo(() => {
    if (!safeCounterpartyId) {
      return null;
    }
    return allCounterparties.find((cp) => cp && cp.id === safeCounterpartyId) || null;
  }, [safeCounterpartyId, allCounterparties]);

  const targetDefects = useMemo(() => {
    if (!safeCounterpartyId) {
      return [];
    }
    return safeDefects.filter((d) => d && d.sellerId === safeCounterpartyId);
  }, [safeCounterpartyId, safeDefects]);

  const targetRemedies = useMemo(() => {
    if (!safeCounterpartyId) {
      return [];
    }
    return safeRemedies.filter((r) => r && r.sellerId === safeCounterpartyId);
  }, [safeCounterpartyId, safeRemedies]);

  const targetLoans = useMemo(() => {
    if (!safeCounterpartyId) {
      return [];
    }
    return safeLoans.filter((l) => l && l.sellerId === safeCounterpartyId);
  }, [safeCounterpartyId, safeLoans]);

  const peerAverages = useMemo(() => {
    if (!safeCounterpartyId) {
      debug(HOOK_NAME, 'No counterpartyId provided, returning default peer averages');
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

    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Mock data is loading, deferring peer averages calculation');
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
        safeDefects,
        safeRemedies,
      );

      debug(HOOK_NAME, 'Peer averages calculated', {
        counterpartyId: safeCounterpartyId,
        peerCount: comparison.peerCount,
        percentileRank: comparison.percentileRank,
      });

      return comparison;
    } catch (err) {
      warn(HOOK_NAME, 'Failed to calculate peer averages', {
        counterpartyId: safeCounterpartyId,
        error: err,
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
  }, [safeCounterpartyId, allCounterparties, safeDefects, safeRemedies, isMockDataLoading]);

  const comparisonData = useMemo(() => {
    if (!safeCounterpartyId || !targetCounterparty) {
      return {
        defectRateDelta: 0,
        criticalDefectRateDelta: 0,
        responseDaysDelta: 0,
        exposureDelta: 0,
        passRateDelta: 0,
        defectRateComparison: 'neutral',
        criticalDefectRateComparison: 'neutral',
        responseDaysComparison: 'neutral',
        exposureComparison: 'neutral',
        passRateComparison: 'neutral',
        overallAssessment: 'No data available for comparison.',
      };
    }

    if (isMockDataLoading) {
      return {
        defectRateDelta: 0,
        criticalDefectRateDelta: 0,
        responseDaysDelta: 0,
        exposureDelta: 0,
        passRateDelta: 0,
        defectRateComparison: 'neutral',
        criticalDefectRateComparison: 'neutral',
        responseDaysComparison: 'neutral',
        exposureComparison: 'neutral',
        passRateComparison: 'neutral',
        overallAssessment: 'Loading data...',
      };
    }

    if (peerAverages.peerCount === 0) {
      return {
        defectRateDelta: 0,
        criticalDefectRateDelta: 0,
        responseDaysDelta: 0,
        exposureDelta: 0,
        passRateDelta: 0,
        defectRateComparison: 'neutral',
        criticalDefectRateComparison: 'neutral',
        responseDaysComparison: 'neutral',
        exposureComparison: 'neutral',
        passRateComparison: 'neutral',
        overallAssessment: 'Insufficient peer data for comparison.',
      };
    }

    const targetDefectRate =
      targetLoans.length > 0
        ? targetDefects.length / targetLoans.length
        : 0;

    const targetCriticalDefectRate =
      targetLoans.length > 0
        ? targetDefects.filter((d) => d && d.severity === 'critical').length / targetLoans.length
        : 0;

    let targetResponseDays = 0;
    const openTargetRemedies = targetRemedies.filter(
      (r) =>
        r &&
        r.status !== 'closed' &&
        r.status !== 'resolved' &&
        r.createdAt,
    );
    if (openTargetRemedies.length > 0) {
      const now = new Date();
      let totalAgingDays = 0;
      let agingCount = 0;
      for (const remedy of openTargetRemedies) {
        const createdAt = new Date(remedy.createdAt);
        if (isNaN(createdAt.getTime())) continue;
        const ageInMs = now - createdAt;
        const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
        totalAgingDays += ageInDays;
        agingCount++;
      }
      if (agingCount > 0) {
        targetResponseDays = Math.round((totalAgingDays / agingCount) * 10) / 10;
      }
    }

    let targetExposure = 0;
    for (const remedy of targetRemedies) {
      if (!remedy) continue;
      if (remedy.status === 'closed' || remedy.status === 'resolved') continue;
      if (remedy.financialImpact) {
        targetExposure +=
          remedy.financialImpact.actual ||
          remedy.financialImpact.estimated ||
          0;
      }
    }

    const targetPassRate =
      targetLoans.length > 0
        ? targetLoans.filter((l) => l && (l.status === 'PASS' || l.status === 'VALIDATED')).length /
          targetLoans.length
        : 0;

    const defectRateDelta =
      Math.round((targetDefectRate - peerAverages.peerAvgDefectRate) * 10000) / 10000;
    const criticalDefectRateDelta =
      Math.round((targetCriticalDefectRate - peerAverages.peerAvgCriticalDefectRate) * 10000) / 10000;
    const responseDaysDelta =
      Math.round((targetResponseDays - peerAverages.peerAvgResponseDays) * 10) / 10;
    const exposureDelta =
      Math.round((targetExposure - peerAverages.peerAvgExposure) * 100) / 100;
    const passRateDelta =
      Math.round((targetPassRate - peerAverages.peerAvgPassRate) * 10000) / 10000;

    const determineComparison = (delta, metricName) => {
      const absDelta = Math.abs(delta);

      if (absDelta < 0.001) {
        return 'neutral';
      }

      if (metricName === 'defectRate' || metricName === 'criticalDefectRate' || metricName === 'responseDays' || metricName === 'exposure') {
        if (delta < -0.01) return 'better';
        if (delta > 0.01) return 'worse';
        return 'neutral';
      }

      if (metricName === 'passRate') {
        if (delta > 0.01) return 'better';
        if (delta < -0.01) return 'worse';
        return 'neutral';
      }

      return 'neutral';
    };

    const defectRateComparison = determineComparison(defectRateDelta, 'defectRate');
    const criticalDefectRateComparison = determineComparison(criticalDefectRateDelta, 'criticalDefectRate');
    const responseDaysComparison = determineComparison(responseDaysDelta, 'responseDays');
    const exposureComparison = determineComparison(exposureDelta, 'exposure');
    const passRateComparison = determineComparison(passRateDelta, 'passRate');

    const comparisonCounts = {
      better: 0,
      worse: 0,
      neutral: 0,
    };

    comparisonCounts[defectRateComparison]++;
    comparisonCounts[criticalDefectRateComparison]++;
    comparisonCounts[responseDaysComparison]++;
    comparisonCounts[exposureComparison]++;
    comparisonCounts[passRateComparison]++;

    let overallAssessment;
    if (comparisonCounts.worse >= 3) {
      overallAssessment = 'This counterparty is underperforming compared to peers across multiple metrics. Immediate attention may be required.';
    } else if (comparisonCounts.worse >= 2) {
      overallAssessment = 'This counterparty is underperforming compared to peers in some areas. Monitoring is recommended.';
    } else if (comparisonCounts.better >= 3) {
      overallAssessment = 'This counterparty is performing better than peers across multiple metrics.';
    } else if (comparisonCounts.better >= 2) {
      overallAssessment = 'This counterparty is performing above peer averages in several areas.';
    } else {
      overallAssessment = 'This counterparty is performing in line with peer averages.';
    }

    debug(HOOK_NAME, 'Comparison data computed', {
      counterpartyId: safeCounterpartyId,
      overallAssessment,
      defectRateComparison,
      criticalDefectRateComparison,
      responseDaysComparison,
      exposureComparison,
      passRateComparison,
    });

    return {
      defectRateDelta,
      criticalDefectRateDelta,
      responseDaysDelta,
      exposureDelta,
      passRateDelta,
      defectRateComparison,
      criticalDefectRateComparison,
      responseDaysComparison,
      exposureComparison,
      passRateComparison,
      overallAssessment,
    };
  }, [
    safeCounterpartyId,
    targetCounterparty,
    targetDefects,
    targetRemedies,
    targetLoans,
    peerAverages,
    isMockDataLoading,
  ]);

  const isLoading = isMockDataLoading;

  return {
    peerAverages,
    comparisonData,
    isLoading,
  };
};

export default usePeerComparison;