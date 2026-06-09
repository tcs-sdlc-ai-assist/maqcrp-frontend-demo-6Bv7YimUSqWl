import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateThreshold,
  evaluateAllThresholds,
  getActiveAlerts,
  getValidMetrics,
  getValidOperators,
} from './alertEvaluator';

describe('alertEvaluator', () => {
  const createAlertRule = (overrides = {}) => ({
    id: 'ALR-0001',
    name: 'Test Alert Rule',
    description: 'Test description',
    metric: 'overallDefectRate',
    operator: 'gt',
    value: 0.05,
    severity: 'warning',
    enabled: true,
    counterpartyIds: null,
    createdBy: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createCounterparty = (overrides = {}) => ({
    id: 'SELL-0001',
    name: 'Test Counterparty',
    status: 'active',
    performanceMetrics: {
      totalLoans: 100,
      defectRate: 0.03,
      passRate: 0.92,
      avgRemedyResponseDays: 5,
      openExposure: 250000,
      watchlistCount: 0,
    },
    ...overrides,
  });

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

  describe('evaluateThreshold', () => {
    it('should detect breach when actual value exceeds threshold with gt operator', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const metrics = { overallDefectRate: 0.07 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
      expect(result.actualValue).toBe(0.07);
      expect(result.threshold).toBe(0.05);
      expect(result.operator).toBe('gt');
      expect(result.metric).toBe('overallDefectRate');
    });

    it('should not breach when actual value is below threshold with gt operator', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const metrics = { overallDefectRate: 0.03 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(false);
    });

    it('should detect breach when actual value is below threshold with lt operator', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'lt', value: 0.02 });
      const metrics = { overallDefectRate: 0.01 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
    });

    it('should not breach when actual value exceeds threshold with lt operator', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'lt', value: 0.02 });
      const metrics = { overallDefectRate: 0.05 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(false);
    });

    it('should detect breach with gte operator when values are equal', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gte', value: 0.05 });
      const metrics = { overallDefectRate: 0.05 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
    });

    it('should detect breach with lte operator when values are equal', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'lte', value: 0.05 });
      const metrics = { overallDefectRate: 0.05 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
    });

    it('should detect breach with eq operator when values match', () => {
      const rule = createAlertRule({ metric: 'slaBreachCount', operator: 'eq', value: 3 });
      const metrics = { slaBreachCount: 3 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
    });

    it('should not breach with eq operator when values differ', () => {
      const rule = createAlertRule({ metric: 'slaBreachCount', operator: 'eq', value: 3 });
      const metrics = { slaBreachCount: 5 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(false);
    });

    it('should detect breach with neq operator when values differ', () => {
      const rule = createAlertRule({ metric: 'slaBreachCount', operator: 'neq', value: 0 });
      const metrics = { slaBreachCount: 2 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
    });

    it('should not breach with neq operator when values match', () => {
      const rule = createAlertRule({ metric: 'slaBreachCount', operator: 'neq', value: 0 });
      const metrics = { slaBreachCount: 0 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(false);
    });

    it('should return default result for null rule', () => {
      const result = evaluateThreshold(null, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
      expect(result.actualValue).toBe(0);
      expect(result.threshold).toBe(0);
    });

    it('should return default result for undefined rule', () => {
      const result = evaluateThreshold(undefined, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should return default result for rule with invalid metric', () => {
      const rule = createAlertRule({ metric: 'invalidMetric', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should return default result for rule with invalid operator', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'invalidOp', value: 0.05 });
      const result = evaluateThreshold(rule, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should return default result for rule with null threshold value', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: null });
      const result = evaluateThreshold(rule, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should return default result for rule with undefined threshold value', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: undefined });
      const result = evaluateThreshold(rule, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should return default result for rule with NaN threshold value', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: NaN });
      const result = evaluateThreshold(rule, { overallDefectRate: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should handle null metrics object', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, null);
      expect(result.breached).toBe(false);
    });

    it('should handle undefined metrics object', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, undefined);
      expect(result.breached).toBe(false);
    });

    it('should handle missing metric in metrics object', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, { otherMetric: 0.07 });
      expect(result.breached).toBe(false);
    });

    it('should handle null actual value', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, { overallDefectRate: null });
      expect(result.breached).toBe(false);
    });

    it('should handle undefined actual value', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, { overallDefectRate: undefined });
      expect(result.breached).toBe(false);
    });

    it('should handle NaN actual value', () => {
      const rule = createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 });
      const result = evaluateThreshold(rule, { overallDefectRate: NaN });
      expect(result.breached).toBe(false);
    });

    it('should evaluate remedyResponseTime metric', () => {
      const rule = createAlertRule({ metric: 'remedyResponseTime', operator: 'gt', value: 7 });
      const metrics = { remedyResponseTime: 10 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
      expect(result.metric).toBe('remedyResponseTime');
    });

    it('should evaluate repurchaseExposure metric', () => {
      const rule = createAlertRule({ metric: 'repurchaseExposure', operator: 'gt', value: 500000 });
      const metrics = { repurchaseExposure: 750000 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
      expect(result.metric).toBe('repurchaseExposure');
    });

    it('should evaluate slaBreachCount metric', () => {
      const rule = createAlertRule({ metric: 'slaBreachCount', operator: 'gte', value: 3 });
      const metrics = { slaBreachCount: 5 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
      expect(result.metric).toBe('slaBreachCount');
    });

    it('should evaluate highSeverityDefectRate metric', () => {
      const rule = createAlertRule({ metric: 'highSeverityDefectRate', operator: 'gt', value: 0.02 });
      const metrics = { highSeverityDefectRate: 0.04 };
      const result = evaluateThreshold(rule, metrics);
      expect(result.breached).toBe(true);
      expect(result.metric).toBe('highSeverityDefectRate');
    });
  });

  describe('evaluateAllThresholds', () => {
    it('should return empty array when no alert rules provided', () => {
      const result = evaluateAllThresholds([], [createCounterparty()], [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when alert rules is null', () => {
      const result = evaluateAllThresholds(null, [createCounterparty()], [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when alert rules is undefined', () => {
      const result = evaluateAllThresholds(undefined, [createCounterparty()], [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when no counterparties provided', () => {
      const rules = [createAlertRule()];
      const result = evaluateAllThresholds(rules, [], [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when counterparties is null', () => {
      const rules = [createAlertRule()];
      const result = evaluateAllThresholds(rules, null, [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when no enabled rules exist', () => {
      const rules = [createAlertRule({ enabled: false })];
      const result = evaluateAllThresholds(rules, [createCounterparty()], [], [], []);
      expect(result).toEqual([]);
    });

    it('should detect breach for counterparty exceeding defect rate threshold', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0003' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0004' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0005' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0006' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyId).toBe('SELL-0001');
      expect(result[0].metric).toBe('overallDefectRate');
      expect(result[0].breachId).toBeDefined();
      expect(result[0].ruleId).toBe('ALR-0001');
      expect(result[0].acknowledged).toBe(false);
      expect(result[0].resolvedAt).toBeNull();
    });

    it('should not detect breach when counterparty is within threshold', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.50 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result).toEqual([]);
    });

    it('should filter by specific counterpartyIds in rule scope', () => {
      const rules = [
        createAlertRule({
          id: 'ALR-0001',
          metric: 'overallDefectRate',
          operator: 'gt',
          value: 0.01,
          counterpartyIds: ['SELL-0001'],
        }),
      ];
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
        createDefect({ sellerId: 'SELL-0002', loanId: 'LOAN-0003' }),
        createDefect({ sellerId: 'SELL-0002', loanId: 'LOAN-0004' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      for (const breach of result) {
        expect(breach.counterpartyId).toBe('SELL-0001');
      }
    });

    it('should evaluate all counterparties when counterpartyIds is null (scope all)', () => {
      const rules = [
        createAlertRule({
          id: 'ALR-0001',
          metric: 'overallDefectRate',
          operator: 'gt',
          value: 0.01,
          counterpartyIds: null,
        }),
      ];
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
        createDefect({ sellerId: 'SELL-0002', loanId: 'LOAN-0003' }),
        createDefect({ sellerId: 'SELL-0002', loanId: 'LOAN-0004' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      const counterpartyIds = result.map((b) => b.counterpartyId);
      expect(counterpartyIds).toContain('SELL-0001');
      expect(counterpartyIds).toContain('SELL-0002');
    });

    it('should skip disabled rules', () => {
      const rules = [
        createAlertRule({ id: 'ALR-0001', enabled: false, metric: 'overallDefectRate', operator: 'gt', value: 0.01 }),
        createAlertRule({ id: 'ALR-0002', enabled: true, metric: 'overallDefectRate', operator: 'gt', value: 0.01 }),
      ];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      for (const breach of result) {
        expect(breach.ruleId).toBe('ALR-0002');
      }
    });

    it('should detect multiple simultaneous breaches across counterparties', () => {
      const rules = [
        createAlertRule({ id: 'ALR-0001', metric: 'overallDefectRate', operator: 'gt', value: 0.01 }),
        createAlertRule({ id: 'ALR-0002', metric: 'slaBreachCount', operator: 'gt', value: 0 }),
      ];
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
        createDefect({ sellerId: 'SELL-0002', loanId: 'LOAN-0003' }),
        createDefect({ sellerId: 'SELL-0002', loanId: 'LOAN-0004' }),
      ];
      const remedies = [
        createRemedy({ sellerId: 'SELL-0001', slaBreached: true }),
        createRemedy({ sellerId: 'SELL-0002', slaBreached: true }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, remedies, []);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect multiple breaches for the same counterparty across different rules', () => {
      const rules = [
        createAlertRule({ id: 'ALR-0001', metric: 'overallDefectRate', operator: 'gt', value: 0.01 }),
        createAlertRule({ id: 'ALR-0002', metric: 'slaBreachCount', operator: 'gt', value: 0 }),
      ];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const remedies = [
        createRemedy({ sellerId: 'SELL-0001', slaBreached: true }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, remedies, []);
      const ruleIds = result.map((b) => b.ruleId);
      expect(ruleIds).toContain('ALR-0001');
      expect(ruleIds).toContain('ALR-0002');
    });

    it('should handle non-array defects gracefully', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = evaluateAllThresholds(rules, counterparties, null, [], []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle non-array remedies gracefully', () => {
      const rules = [createAlertRule({ metric: 'slaBreachCount', operator: 'gt', value: 0 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = evaluateAllThresholds(rules, counterparties, [], null, []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle non-array repurchases gracefully', () => {
      const rules = [createAlertRule({ metric: 'repurchaseExposure', operator: 'gt', value: 0 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = evaluateAllThresholds(rules, counterparties, [], [], null);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should skip counterparties without id', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [
        { name: 'No ID' },
        createCounterparty({ id: 'SELL-0001' }),
      ];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      for (const breach of result) {
        expect(breach.counterpartyId).toBe('SELL-0001');
      }
    });

    it('should include severity from rule in breach result', () => {
      const rules = [createAlertRule({ severity: 'critical', metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].severity).toBe('critical');
    });

    it('should default severity to warning if not specified', () => {
      const rules = [createAlertRule({ severity: undefined, metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].severity).toBe('warning');
    });

    it('should include counterparty name in breach result', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001', name: 'Test Corp' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyName).toBe('Test Corp');
    });

    it('should fallback counterparty name to id if name is missing', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001', name: undefined })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyName).toBe('SELL-0001');
    });

    it('should generate unique breach IDs', () => {
      const rules = [
        createAlertRule({ id: 'ALR-0001', metric: 'overallDefectRate', operator: 'gt', value: 0.01 }),
        createAlertRule({ id: 'ALR-0002', metric: 'slaBreachCount', operator: 'gt', value: 0 }),
      ];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const remedies = [
        createRemedy({ sellerId: 'SELL-0001', slaBreached: true }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, remedies, []);
      const breachIds = result.map((b) => b.breachId);
      const uniqueIds = new Set(breachIds);
      expect(uniqueIds.size).toBe(breachIds.length);
    });

    it('should set triggeredAt to current timestamp', () => {
      const before = new Date().toISOString();
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      const after = new Date().toISOString();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].triggeredAt).toBeDefined();
      expect(result[0].triggeredAt >= before).toBe(true);
      expect(result[0].triggeredAt <= after).toBe(true);
    });

    it('should set acknowledged to false for new breaches', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].acknowledged).toBe(false);
      expect(result[0].acknowledgedBy).toBeNull();
      expect(result[0].acknowledgedAt).toBeNull();
    });

    it('should set resolvedAt to null for new breaches', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].resolvedAt).toBeNull();
    });

    it('should compute overallDefectRate from defects', () => {
      const rules = [createAlertRule({ metric: 'overallDefectRate', operator: 'gt', value: 0.05 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0003' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0004' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0005' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0006' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].actualValue).toBeGreaterThan(0.05);
    });

    it('should compute highSeverityDefectRate from critical and major defects', () => {
      const rules = [createAlertRule({ metric: 'highSeverityDefectRate', operator: 'gt', value: 0.01 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const defects = [
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ sellerId: 'SELL-0001', loanId: 'LOAN-0002', severity: 'major' }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, defects, [], []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].actualValue).toBeGreaterThan(0);
    });

    it('should compute remedyResponseTime from open remedies', () => {
      const rules = [createAlertRule({ metric: 'remedyResponseTime', operator: 'gt', value: 1 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const remedies = [
        createRemedy({
          sellerId: 'SELL-0001',
          status: 'open',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, [], remedies, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].actualValue).toBeGreaterThan(1);
    });

    it('should compute repurchaseExposure from open repurchases', () => {
      const rules = [createAlertRule({ metric: 'repurchaseExposure', operator: 'gt', value: 1000 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const repurchases = [
        createRepurchase({ sellerId: 'SELL-0001', status: 'demand_issued', exposure: 500000 }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, [], [], repurchases);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].actualValue).toBeGreaterThan(1000);
    });

    it('should compute slaBreachCount from breached remedies and aged repurchases', () => {
      const rules = [createAlertRule({ metric: 'slaBreachCount', operator: 'gt', value: 0 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const remedies = [
        createRemedy({ sellerId: 'SELL-0001', slaBreached: true }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, [], remedies, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].actualValue).toBeGreaterThan(0);
    });

    it('should exclude closed remedies from response time calculation', () => {
      const rules = [createAlertRule({ metric: 'remedyResponseTime', operator: 'gt', value: 100 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const remedies = [
        createRemedy({
          sellerId: 'SELL-0001',
          status: 'closed',
          createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, [], remedies, []);
      expect(result).toEqual([]);
    });

    it('should exclude closed repurchases from exposure calculation', () => {
      const rules = [createAlertRule({ metric: 'repurchaseExposure', operator: 'gt', value: 1000 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const repurchases = [
        createRepurchase({ sellerId: 'SELL-0001', status: 'closed', exposure: 500000 }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, [], [], repurchases);
      expect(result).toEqual([]);
    });

    it('should exclude draft repurchases from breach count', () => {
      const rules = [createAlertRule({ metric: 'slaBreachCount', operator: 'gt', value: 0 })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const repurchases = [
        createRepurchase({
          sellerId: 'SELL-0001',
          status: 'draft',
          createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = evaluateAllThresholds(rules, counterparties, [], [], repurchases);
      expect(result).toEqual([]);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return empty array for null input', () => {
      expect(getActiveAlerts(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(getActiveAlerts(undefined)).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      expect(getActiveAlerts('not an array')).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(getActiveAlerts([])).toEqual([]);
    });

    it('should return only unacknowledged and unresolved alerts', () => {
      const breaches = [
        { breachId: 'ALT-0001', acknowledged: false, resolvedAt: null },
        { breachId: 'ALT-0002', acknowledged: true, resolvedAt: null },
        { breachId: 'ALT-0003', acknowledged: false, resolvedAt: '2026-06-09T00:00:00Z' },
        { breachId: 'ALT-0004', acknowledged: true, resolvedAt: '2026-06-09T00:00:00Z' },
      ];
      const active = getActiveAlerts(breaches);
      expect(active).toHaveLength(1);
      expect(active[0].breachId).toBe('ALT-0001');
    });

    it('should filter out null entries', () => {
      const breaches = [
        { breachId: 'ALT-0001', acknowledged: false, resolvedAt: null },
        null,
        { breachId: 'ALT-0002', acknowledged: false, resolvedAt: null },
        undefined,
      ];
      const active = getActiveAlerts(breaches);
      expect(active).toHaveLength(2);
    });
  });

  describe('getValidMetrics', () => {
    it('should return an array of valid metric names', () => {
      const metrics = getValidMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics).toContain('overallDefectRate');
      expect(metrics).toContain('highSeverityDefectRate');
      expect(metrics).toContain('remedyResponseTime');
      expect(metrics).toContain('repurchaseExposure');
      expect(metrics).toContain('slaBreachCount');
    });
  });

  describe('getValidOperators', () => {
    it('should return an array of valid operator strings', () => {
      const operators = getValidOperators();
      expect(Array.isArray(operators)).toBe(true);
      expect(operators.length).toBeGreaterThan(0);
      expect(operators).toContain('gt');
      expect(operators).toContain('gte');
      expect(operators).toContain('lt');
      expect(operators).toContain('lte');
      expect(operators).toContain('eq');
      expect(operators).toContain('neq');
    });
  });
});