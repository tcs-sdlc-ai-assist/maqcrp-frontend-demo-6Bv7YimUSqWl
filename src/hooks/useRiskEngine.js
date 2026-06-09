import { useMemo, useCallback, useState, useRef } from 'react';
import { useMockData } from '../contexts/MockDataContext';
import { useOversight } from '../contexts/OversightContext';
import { calculateRiskScore, calculateRiskTier, getContributingFactors } from '../services/riskCalculationEngine';
import { debug, info, warn, error } from '../utils/logger';

const HOOK_NAME = 'useRiskEngine';

/**
 * @typedef {Object} RankedCounterparty
 * @property {string} counterpartyId
 * @property {string} counterpartyName
 * @property {number} riskScore
 * @property {string} riskTier
 * @property {number} defectRate
 * @property {number} criticalDefectRate
 * @property {number} totalExposure
 * @property {number} breachCount
 * @property {number} avgRemedyResponseDays
 * @property {Array<Object>} factors
 */

/**
 * @typedef {Object} RiskEngineResult
 * @property {RankedCounterparty[]} rankedCounterparties
 * @property {Object<string, Object>} riskTiers
 * @property {boolean} isCalculating
 * @property {Function} recalculate
 * @property {string|null} lastCalculatedAt
 */

/**
 * Custom hook that provides risk engine calculations for all counterparties.
 *
 * Consumes MockDataContext and OversightContext to compute risk scores, tiers,
 * and contributing factors for each counterparty. Results are memoized and
 * recalculated when underlying data changes.
 *
 * @returns {RiskEngineResult}
 *
 * @example
 * const { rankedCounterparties, riskTiers, isCalculating, recalculate, lastCalculatedAt } = useRiskEngine();
 */
export const useRiskEngine = () => {
  const {
    sellers,
    defects,
    remedyCases,
    repurchaseCases,
    loans,
    isLoading: isMockDataLoading,
  } = useMockData();

  const {
    riskTierCache,
    recalculateRiskTiers,
  } = useOversight();

  const [isCalculating, setIsCalculating] = useState(false);
  const lastCalculatedAtRef = useRef(null);

  const counterparties = useMemo(() => {
    if (!Array.isArray(sellers) || sellers.length === 0) {
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

  const safeRepurchases = useMemo(() => {
    return Array.isArray(repurchaseCases) ? repurchaseCases : [];
  }, [repurchaseCases]);

  const safeLoans = useMemo(() => {
    return Array.isArray(loans) ? loans : [];
  }, [loans]);

  const rankedCounterparties = useMemo(() => {
    if (isMockDataLoading) {
      return [];
    }

    if (counterparties.length === 0) {
      debug(HOOK_NAME, 'No counterparties available for risk ranking');
      return [];
    }

    const ranked = [];

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

      const counterpartyLoans = safeLoans.filter(
        (l) => l && l.sellerId === counterpartyId,
      );

      const riskScore = calculateRiskScore(
        counterparty,
        counterpartyDefects,
        counterpartyRemedies,
        counterpartyRepurchases,
      );

      const riskTier = calculateRiskTier(riskScore);

      const factorsResult = getContributingFactors(
        counterparty,
        counterpartyDefects,
        counterpartyRemedies,
        counterpartyRepurchases,
      );

      const defectRate =
        counterpartyLoans.length > 0
          ? counterpartyDefects.length / counterpartyLoans.length
          : 0;

      const criticalDefectRate =
        counterpartyLoans.length > 0
          ? counterpartyDefects.filter((d) => d && d.severity === 'critical').length /
            counterpartyLoans.length
          : 0;

      let totalExposure = 0;
      for (const remedy of counterpartyRemedies) {
        if (!remedy) continue;
        if (remedy.status === 'closed' || remedy.status === 'resolved') continue;
        if (remedy.financialImpact) {
          totalExposure +=
            remedy.financialImpact.actual ||
            remedy.financialImpact.estimated ||
            0;
        }
      }
      for (const repurchase of counterpartyRepurchases) {
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

      let breachCount = 0;
      for (const remedy of counterpartyRemedies) {
        if (!remedy) continue;
        if (remedy.slaBreached === true) {
          breachCount++;
        }
      }
      for (const repurchase of counterpartyRepurchases) {
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

      let avgRemedyResponseDays = 0;
      const openRemedies = counterpartyRemedies.filter(
        (r) =>
          r &&
          r.status !== 'closed' &&
          r.status !== 'resolved' &&
          r.createdAt,
      );
      if (openRemedies.length > 0) {
        const now = new Date();
        let totalAgingDays = 0;
        let agingCount = 0;
        for (const remedy of openRemedies) {
          const createdAt = new Date(remedy.createdAt);
          if (isNaN(createdAt.getTime())) continue;
          const ageInMs = now - createdAt;
          const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
          totalAgingDays += ageInDays;
          agingCount++;
        }
        if (agingCount > 0) {
          avgRemedyResponseDays = Math.round((totalAgingDays / agingCount) * 10) / 10;
        }
      }

      ranked.push({
        counterpartyId,
        counterpartyName,
        riskScore,
        riskTier,
        defectRate: Math.round(defectRate * 10000) / 10000,
        criticalDefectRate: Math.round(criticalDefectRate * 10000) / 10000,
        totalExposure: Math.round(totalExposure * 100) / 100,
        breachCount,
        avgRemedyResponseDays,
        factors: factorsResult.factors || [],
      });
    }

    ranked.sort((a, b) => b.riskScore - a.riskScore);

    debug(HOOK_NAME, 'Risk ranking computed', {
      counterpartyCount: ranked.length,
      topScore: ranked.length > 0 ? ranked[0].riskScore : 0,
    });

    return ranked;
  }, [counterparties, safeDefects, safeRemedies, safeRepurchases, safeLoans, isMockDataLoading]);

  const riskTiers = useMemo(() => {
    if (isMockDataLoading) {
      return {};
    }

    if (rankedCounterparties.length === 0) {
      return {};
    }

    const tiers = {};

    for (const entry of rankedCounterparties) {
      tiers[entry.counterpartyId] = {
        current: entry.riskTier,
        previous: riskTierCache[entry.counterpartyId]
          ? riskTierCache[entry.counterpartyId].current
          : 'unknown',
        score: entry.riskScore,
        factors: entry.factors,
      };
    }

    return tiers;
  }, [rankedCounterparties, riskTierCache, isMockDataLoading]);

  const recalculate = useCallback(() => {
    if (isMockDataLoading) {
      debug(HOOK_NAME, 'Cannot recalculate while data is loading');
      return;
    }

    setIsCalculating(true);

    try {
      const counterpartyMetricsMap = {};

      for (const entry of rankedCounterparties) {
        counterpartyMetricsMap[entry.counterpartyId] = {
          counterpartyName: entry.counterpartyName,
          defectRate: entry.defectRate,
          criticalDefectRate: entry.criticalDefectRate,
          avgRemedyResponseDays: entry.avgRemedyResponseDays,
          totalExposure: entry.totalExposure,
          slaBreachRate: 0,
          passRate: 0,
          openRemedyCases: 0,
          openRepurchaseCases: 0,
        };
      }

      const trendsMap = {};

      recalculateRiskTiers(counterpartyMetricsMap, trendsMap);

      lastCalculatedAtRef.current = new Date().toISOString();

      info(HOOK_NAME, 'Risk recalculation completed', {
        counterpartyCount: Object.keys(counterpartyMetricsMap).length,
      });
    } catch (err) {
      error(HOOK_NAME, 'Failed to recalculate risk tiers', err);
    } finally {
      setIsCalculating(false);
    }
  }, [isMockDataLoading, rankedCounterparties, recalculateRiskTiers]);

  const lastCalculatedAt = lastCalculatedAtRef.current;

  return {
    rankedCounterparties,
    riskTiers,
    isCalculating: isCalculating || isMockDataLoading,
    recalculate,
    lastCalculatedAt,
  };
};

export default useRiskEngine;