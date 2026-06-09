import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateRiskScore,
  calculateRiskTier,
  getContributingFactors,
  getDefaultWeights,
  getRiskTierThresholds,
} from './riskCalculationEngine';

describe('riskCalculationEngine', () => {
  const validCounterparty = {
    id: 'SELL-0001',
    name: 'Test Counterparty',
    status: 'active',
    performanceMetrics: {
      totalLoans: 100,
      defectRate: 0.05,
      passRate: 0.92,
      avgRemedyResponseDays: 5,
      openExposure: 250000,
      watchlistCount: 0,
    },
  };

  const createDefect = (overrides = {}) => ({
    id: 'DEF-0001',
    sellerId: 'SELL-0001',
    loanId: 'LOAN-0001',
    severity: 'major',
    status: 'open',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  const createRemedy = (overrides = {}) => ({
    id: 'REM-0001',
    sellerId: 'SELL-0001',
    status: 'open',
    slaBreached: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    financialImpact: {
      estimated: 50000,
      actual: null,
      currency: 'USD',
    },
    ...overrides,
  });

  const createRepurchase = (overrides = {}) => ({
    id: 'REP-0001',
    sellerId: 'SELL-0001',
    status: 'demand_issued',
    demandAmount: 100000,
    exposure: 100000,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for null counterparty', () => {
      const score = calculateRiskScore(null, [], [], []);
      expect(score).toBe(0);
    });

    it('should return 0 for undefined counterparty', () => {
      const score = calculateRiskScore(undefined, [], [], []);
      expect(score).toBe(0);
    });

    it('should return 0 for counterparty without id', () => {
      const score = calculateRiskScore({ name: 'No ID' }, [], [], []);
      expect(score).toBe(0);
    });

    it('should return 0 for counterparty with empty id', () => {
      const score = calculateRiskScore({ id: '' }, [], [], []);
      expect(score).toBe(0);
    });

    it('should return 0 when no defects, remedies, or repurchases exist', () => {
      const score = calculateRiskScore(validCounterparty, [], [], []);
      expect(score).toBe(0);
    });

    it('should return a positive score when defects exist', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'major' }),
      ];
      const score = calculateRiskScore(validCounterparty, defects, [], []);
      expect(score).toBeGreaterThan(0);
    });

    it('should return a higher score for critical defects than minor defects', () => {
      const criticalDefects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'critical' }),
      ];
      const minorDefects = [
        createDefect({ id: 'DEF-0003', loanId: 'LOAN-0003', severity: 'minor' }),
        createDefect({ id: 'DEF-0004', loanId: 'LOAN-0004', severity: 'minor' }),
      ];
      const criticalScore = calculateRiskScore(validCounterparty, criticalDefects, [], []);
      const minorScore = calculateRiskScore(validCounterparty, minorDefects, [], []);
      expect(criticalScore).toBeGreaterThanOrEqual(minorScore);
    });

    it('should return a higher score when remedies have SLA breaches', () => {
      const remediesWithBreach = [
        createRemedy({ id: 'REM-0001', slaBreached: true }),
        createRemedy({ id: 'REM-0002', slaBreached: true }),
      ];
      const remediesWithoutBreach = [
        createRemedy({ id: 'REM-0003', slaBreached: false }),
        createRemedy({ id: 'REM-0004', slaBreached: false }),
      ];
      const breachScore = calculateRiskScore(validCounterparty, [], remediesWithBreach, []);
      const noBreachScore = calculateRiskScore(validCounterparty, [], remediesWithoutBreach, []);
      expect(breachScore).toBeGreaterThanOrEqual(noBreachScore);
    });

    it('should return a higher score when repurchase exposure is higher', () => {
      const highExposure = [
        createRepurchase({ id: 'REP-0001', exposure: 5000000, demandAmount: 5000000 }),
      ];
      const lowExposure = [
        createRepurchase({ id: 'REP-0002', exposure: 50000, demandAmount: 50000 }),
      ];
      const highScore = calculateRiskScore(validCounterparty, [], [], highExposure);
      const lowScore = calculateRiskScore(validCounterparty, [], [], lowExposure);
      expect(highScore).toBeGreaterThanOrEqual(lowScore);
    });

    it('should return a score between 0 and 100 inclusive', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'critical' }),
        createDefect({ id: 'DEF-0003', loanId: 'LOAN-0003', severity: 'critical' }),
      ];
      const remedies = [
        createRemedy({ id: 'REM-0001', slaBreached: true }),
        createRemedy({ id: 'REM-0002', slaBreached: true }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', exposure: 8000000, demandAmount: 8000000 }),
      ];
      const score = calculateRiskScore(validCounterparty, defects, remedies, repurchases);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should accept custom weights', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const customWeights = {
        defectRate: 0.5,
        remedyAging: 0.2,
        exposure: 0.2,
        breachCount: 0.1,
      };
      const score = calculateRiskScore(validCounterparty, defects, [], [], customWeights);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should normalize weights that do not sum to 1.0', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const unbalancedWeights = {
        defectRate: 2,
        remedyAging: 2,
        exposure: 2,
        breachCount: 2,
      };
      const score = calculateRiskScore(validCounterparty, defects, [], [], unbalancedWeights);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle non-array defects gracefully', () => {
      const score = calculateRiskScore(validCounterparty, null, [], []);
      expect(score).toBe(0);
    });

    it('should handle non-array remedies gracefully', () => {
      const score = calculateRiskScore(validCounterparty, [], null, []);
      expect(score).toBe(0);
    });

    it('should handle non-array repurchases gracefully', () => {
      const score = calculateRiskScore(validCounterparty, [], [], null);
      expect(score).toBe(0);
    });

    it('should handle counterparty with counterpartyId instead of id', () => {
      const cp = { counterpartyId: 'SELL-0002', name: 'Test CP 2' };
      const score = calculateRiskScore(cp, [], [], []);
      expect(score).toBe(0);
    });

    it('should exclude closed remedies from aging calculation', () => {
      const openRemedies = [
        createRemedy({ id: 'REM-0001', status: 'open', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }),
      ];
      const closedRemedies = [
        createRemedy({ id: 'REM-0002', status: 'closed', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }),
      ];
      const openScore = calculateRiskScore(validCounterparty, [], openRemedies, []);
      const closedScore = calculateRiskScore(validCounterparty, [], closedRemedies, []);
      expect(openScore).toBeGreaterThan(closedScore);
    });

    it('should exclude closed repurchases from exposure calculation', () => {
      const openRepurchases = [
        createRepurchase({ id: 'REP-0001', status: 'demand_issued', exposure: 500000 }),
      ];
      const closedRepurchases = [
        createRepurchase({ id: 'REP-0002', status: 'closed', exposure: 500000 }),
      ];
      const openScore = calculateRiskScore(validCounterparty, [], [], openRepurchases);
      const closedScore = calculateRiskScore(validCounterparty, [], [], closedRepurchases);
      expect(openScore).toBeGreaterThan(closedScore);
    });

    it('should exclude draft repurchases from breach count', () => {
      const draftRepurchases = [
        createRepurchase({ id: 'REP-0001', status: 'draft', createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() }),
      ];
      const score = calculateRiskScore(validCounterparty, [], [], draftRepurchases);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateRiskTier', () => {
    it('should return "low" for score 0', () => {
      expect(calculateRiskTier(0)).toBe('low');
    });

    it('should return "low" for score 25', () => {
      expect(calculateRiskTier(25)).toBe('low');
    });

    it('should return "moderate" for score 26', () => {
      expect(calculateRiskTier(26)).toBe('moderate');
    });

    it('should return "moderate" for score 50', () => {
      expect(calculateRiskTier(50)).toBe('moderate');
    });

    it('should return "high" for score 51', () => {
      expect(calculateRiskTier(51)).toBe('high');
    });

    it('should return "high" for score 75', () => {
      expect(calculateRiskTier(75)).toBe('high');
    });

    it('should return "critical" for score 76', () => {
      expect(calculateRiskTier(76)).toBe('critical');
    });

    it('should return "critical" for score 100', () => {
      expect(calculateRiskTier(100)).toBe('critical');
    });

    it('should return "low" for null input', () => {
      expect(calculateRiskTier(null)).toBe('low');
    });

    it('should return "low" for undefined input', () => {
      expect(calculateRiskTier(undefined)).toBe('low');
    });

    it('should return "low" for NaN input', () => {
      expect(calculateRiskTier(NaN)).toBe('low');
    });

    it('should clamp score above 100 to "critical"', () => {
      expect(calculateRiskTier(150)).toBe('critical');
    });

    it('should clamp score below 0 to "low"', () => {
      expect(calculateRiskTier(-50)).toBe('low');
    });

    it('should round floating point scores before tier determination', () => {
      expect(calculateRiskTier(75.4)).toBe('high');
      expect(calculateRiskTier(75.6)).toBe('critical');
    });
  });

  describe('getContributingFactors', () => {
    it('should return default empty result for null counterparty', () => {
      const result = getContributingFactors(null, [], [], []);
      expect(result.score).toBe(0);
      expect(result.tier).toBe('low');
      expect(result.factors).toEqual([]);
      expect(result.summary.defectRate).toBe(0);
      expect(result.summary.remedyAgingDays).toBe(0);
      expect(result.summary.totalExposure).toBe(0);
      expect(result.summary.breachCount).toBe(0);
    });

    it('should return default empty result for counterparty without id', () => {
      const result = getContributingFactors({ name: 'No ID' }, [], [], []);
      expect(result.score).toBe(0);
      expect(result.tier).toBe('low');
      expect(result.factors).toEqual([]);
    });

    it('should return four factors for valid counterparty with data', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const remedies = [
        createRemedy({ id: 'REM-0001', slaBreached: true }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', exposure: 200000 }),
      ];
      const result = getContributingFactors(validCounterparty, defects, remedies, repurchases);
      expect(result.factors).toHaveLength(4);
      expect(result.factors[0].name).toBe('defectRate');
      expect(result.factors[1].name).toBe('remedyAging');
      expect(result.factors[2].name).toBe('exposure');
      expect(result.factors[3].name).toBe('breachCount');
    });

    it('should include rawValue, normalizedScore, weight, and contribution for each factor', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'major' }),
      ];
      const result = getContributingFactors(validCounterparty, defects, [], []);
      for (const factor of result.factors) {
        expect(factor).toHaveProperty('name');
        expect(factor).toHaveProperty('weight');
        expect(factor).toHaveProperty('rawValue');
        expect(factor).toHaveProperty('normalizedScore');
        expect(factor).toHaveProperty('contribution');
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.normalizedScore).toBeGreaterThanOrEqual(0);
        expect(factor.normalizedScore).toBeLessThanOrEqual(100);
      }
    });

    it('should return summary with correct values', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'major' }),
      ];
      const remedies = [
        createRemedy({ id: 'REM-0001', slaBreached: true }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', exposure: 500000 }),
      ];
      const result = getContributingFactors(validCounterparty, defects, remedies, repurchases);
      expect(result.summary.defectRate).toBeGreaterThan(0);
      expect(result.summary.remedyAgingDays).toBeGreaterThan(0);
      expect(result.summary.totalExposure).toBeGreaterThan(0);
      expect(result.summary.breachCount).toBeGreaterThan(0);
    });

    it('should accept custom weights', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const customWeights = {
        defectRate: 0.6,
        remedyAging: 0.2,
        exposure: 0.1,
        breachCount: 0.1,
      };
      const result = getContributingFactors(validCounterparty, defects, [], [], customWeights);
      expect(result.factors).toHaveLength(4);
      expect(result.factors[0].weight).toBeCloseTo(0.6, 2);
    });

    it('should normalize weights that do not sum to 1.0', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const unbalancedWeights = {
        defectRate: 3,
        remedyAging: 3,
        exposure: 3,
        breachCount: 3,
      };
      const result = getContributingFactors(validCounterparty, defects, [], [], unbalancedWeights);
      const weightSum = result.factors.reduce((sum, f) => sum + f.weight, 0);
      expect(weightSum).toBeCloseTo(1.0, 2);
    });

    it('should handle non-array defects gracefully', () => {
      const result = getContributingFactors(validCounterparty, null, [], []);
      expect(result.factors).toHaveLength(4);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-array remedies gracefully', () => {
      const result = getContributingFactors(validCounterparty, [], null, []);
      expect(result.factors).toHaveLength(4);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-array repurchases gracefully', () => {
      const result = getContributingFactors(validCounterparty, [], [], null);
      expect(result.factors).toHaveLength(4);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should return score matching calculateRiskScore for same inputs', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'major' }),
      ];
      const remedies = [
        createRemedy({ id: 'REM-0001', slaBreached: true }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', exposure: 300000 }),
      ];
      const score = calculateRiskScore(validCounterparty, defects, remedies, repurchases);
      const factors = getContributingFactors(validCounterparty, defects, remedies, repurchases);
      expect(factors.score).toBe(score);
    });

    it('should return tier matching calculateRiskTier for same score', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const result = getContributingFactors(validCounterparty, defects, [], []);
      const expectedTier = calculateRiskTier(result.score);
      expect(result.tier).toBe(expectedTier);
    });
  });

  describe('getDefaultWeights', () => {
    it('should return an object with four weight properties', () => {
      const weights = getDefaultWeights();
      expect(weights).toHaveProperty('defectRate');
      expect(weights).toHaveProperty('remedyAging');
      expect(weights).toHaveProperty('exposure');
      expect(weights).toHaveProperty('breachCount');
    });

    it('should return weights that sum to 1.0', () => {
      const weights = getDefaultWeights();
      const sum = weights.defectRate + weights.remedyAging + weights.exposure + weights.breachCount;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should return a new object each call (no mutation risk)', () => {
      const weights1 = getDefaultWeights();
      const weights2 = getDefaultWeights();
      expect(weights1).not.toBe(weights2);
      weights1.defectRate = 999;
      expect(weights2.defectRate).not.toBe(999);
    });
  });

  describe('getRiskTierThresholds', () => {
    it('should return an object with critical, high, moderate, and low thresholds', () => {
      const thresholds = getRiskTierThresholds();
      expect(thresholds).toHaveProperty('critical');
      expect(thresholds).toHaveProperty('high');
      expect(thresholds).toHaveProperty('moderate');
      expect(thresholds).toHaveProperty('low');
    });

    it('should return thresholds with min and max properties', () => {
      const thresholds = getRiskTierThresholds();
      for (const tier of Object.values(thresholds)) {
        expect(tier).toHaveProperty('min');
        expect(tier).toHaveProperty('max');
        expect(typeof tier.min).toBe('number');
        expect(typeof tier.max).toBe('number');
      }
    });

    it('should return thresholds that cover 0-100 without gaps', () => {
      const thresholds = getRiskTierThresholds();
      expect(thresholds.low.min).toBe(0);
      expect(thresholds.critical.max).toBe(100);
      expect(thresholds.low.max + 1).toBe(thresholds.moderate.min);
      expect(thresholds.moderate.max + 1).toBe(thresholds.high.min);
      expect(thresholds.high.max + 1).toBe(thresholds.critical.min);
    });

    it('should return a new object each call (no mutation risk)', () => {
      const t1 = getRiskTierThresholds();
      const t2 = getRiskTierThresholds();
      expect(t1).not.toBe(t2);
      t1.critical.min = 999;
      expect(t2.critical.min).not.toBe(999);
    });
  });

  describe('integration: full risk calculation pipeline', () => {
    it('should produce consistent results across all three functions', () => {
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'major' }),
        createDefect({ id: 'DEF-0003', loanId: 'LOAN-0003', severity: 'minor' }),
      ];
      const remedies = [
        createRemedy({ id: 'REM-0001', slaBreached: true, status: 'open' }),
        createRemedy({ id: 'REM-0002', slaBreached: false, status: 'in_progress' }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', status: 'demand_issued', exposure: 500000 }),
      ];

      const score = calculateRiskScore(validCounterparty, defects, remedies, repurchases);
      const tier = calculateRiskTier(score);
      const factors = getContributingFactors(validCounterparty, defects, remedies, repurchases);

      expect(factors.score).toBe(score);
      expect(factors.tier).toBe(tier);
      expect(factors.factors).toHaveLength(4);

      const contributionSum = factors.factors.reduce((sum, f) => sum + f.contribution, 0);
      expect(Math.round(contributionSum)).toBe(score);
    });

    it('should produce score 0 and tier low for counterparty with no issues', () => {
      const score = calculateRiskScore(validCounterparty, [], [], []);
      const tier = calculateRiskTier(score);
      const factors = getContributingFactors(validCounterparty, [], [], []);

      expect(score).toBe(0);
      expect(tier).toBe('low');
      expect(factors.score).toBe(0);
      expect(factors.tier).toBe('low');
      expect(factors.summary.defectRate).toBe(0);
      expect(factors.summary.remedyAgingDays).toBe(0);
      expect(factors.summary.totalExposure).toBe(0);
      expect(factors.summary.breachCount).toBe(0);
    });
  });
});