import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPortfolioSummary,
  getTopCounterparties,
  getConcentrationData,
} from './portfolioMetrics';

describe('portfolioMetrics', () => {
  const createLoan = (overrides = {}) => ({
    id: 'LOAN-0001',
    borrowerName: 'Test Borrower',
    ssn: '123-45-6789',
    propertyAddress: '123 Main St, Springfield, IL 62701',
    loanAmount: 250000,
    productType: 'conventional',
    channel: 'retail',
    sellerId: 'SELL-0001',
    status: 'PASS',
    decisionResult: null,
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createDefect = (overrides = {}) => ({
    id: 'DEF-0001',
    qcCaseId: 'QC-0001',
    loanId: 'LOAN-0001',
    sellerId: 'SELL-0001',
    taxonomyCode: 'DOC.INC.001',
    category: 'Documentation',
    subcategory: 'Income Verification',
    severity: 'major',
    rootCause: 'Seller Error',
    sourceOfDefect: 'pre_closing',
    description: 'Test defect description',
    evidence: [],
    linkedRemedyCaseId: null,
    linkedRepurchaseCaseId: null,
    status: 'open',
    resolution: null,
    createdBy: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closedAt: null,
    ...overrides,
  });

  const createRemedy = (overrides = {}) => ({
    id: 'REM-0001',
    sourceType: 'qc_defect',
    sourceId: 'QC-0001',
    linkedDefectIds: ['DEF-0001'],
    sellerId: 'SELL-0001',
    remedyType: 'cure',
    status: 'open',
    priority: 'high',
    ownerId: 'Test User',
    dueDate: '2026-07-09',
    slaBreached: false,
    escalationLevel: 0,
    description: 'Test remedy description',
    financialImpact: {
      estimated: 50000,
      actual: null,
      currency: 'USD',
    },
    outcome: null,
    history: [],
    createdBy: 'Test User',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    ...overrides,
  });

  const createRepurchase = (overrides = {}) => ({
    id: 'REP-0001',
    linkedDefectIds: ['DEF-0001'],
    sellerId: 'SELL-0001',
    loanId: 'LOAN-0001',
    demandAmount: 100000,
    rationale: 'Test rationale',
    evidence: [],
    status: 'demand_issued',
    counterpartyResponse: {
      receivedAt: null,
      responseType: null,
      rationale: null,
      proposedAmount: null,
    },
    alternativeProposal: {
      type: null,
      terms: null,
      amount: null,
      status: null,
    },
    finalOutcome: {
      type: null,
      settledAmount: null,
      closedAt: null,
      notes: null,
    },
    exposure: 100000,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createCounterparty = (overrides = {}) => ({
    id: 'SELL-0001',
    name: 'Test Counterparty',
    type: 'seller',
    status: 'active',
    contactName: 'Test Contact',
    contactEmail: 'test@example.com',
    contactPhone: '(555) 123-4567',
    performanceMetrics: {
      totalLoans: 100,
      defectRate: 0.05,
      passRate: 0.92,
      avgRemedyResponseDays: 5,
      openExposure: 250000,
      watchlistCount: 0,
    },
    onboardingDate: '2024-01-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createWatchlistEntry = (overrides = {}) => ({
    id: 'WLE-0001',
    counterpartyId: 'SELL-0001',
    counterpartyName: 'Test Counterparty',
    reason: 'Test reason for watchlist',
    status: 'active',
    watchlistScore: 65,
    recommendation: 'manual',
    actionPlanId: null,
    monitoringNotes: [],
    addedBy: 'Test User',
    addedDate: new Date().toISOString(),
    reviewDate: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  describe('getPortfolioSummary', () => {
    it('should return default summary when no data is provided', () => {
      const result = getPortfolioSummary([], [], [], [], [], []);
      expect(result.totalLoans).toBe(0);
      expect(result.totalCounterparties).toBe(0);
      expect(result.overallDefectRate).toBe(0);
      expect(result.overallCriticalDefectRate).toBe(0);
      expect(result.passFailRatio).toBe(0);
      expect(result.activeWatchlistCount).toBe(0);
      expect(result.totalExposure).toBe(0);
      expect(result.openRemedyCases).toBe(0);
      expect(result.openRepurchaseCases).toBe(0);
      expect(result.slaBreachRate).toBe(0);
      expect(result.avgRemedyResponseDays).toBe(0);
    });

    it('should return default summary when loans and counterparties are null', () => {
      const result = getPortfolioSummary(null, null, null, null, null, null);
      expect(result.totalLoans).toBe(0);
      expect(result.totalCounterparties).toBe(0);
    });

    it('should return default summary when loans and counterparties are undefined', () => {
      const result = getPortfolioSummary(undefined, undefined, undefined, undefined, undefined, undefined);
      expect(result.totalLoans).toBe(0);
      expect(result.totalCounterparties).toBe(0);
    });

    it('should return default summary when loans and counterparties are not arrays', () => {
      const result = getPortfolioSummary('not an array', {}, 123, 'invalid', true, false);
      expect(result.totalLoans).toBe(0);
      expect(result.totalCounterparties).toBe(0);
    });

    it('should calculate total loans correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001' }),
        createLoan({ id: 'LOAN-0002' }),
        createLoan({ id: 'LOAN-0003' }),
      ];
      const result = getPortfolioSummary(loans, [], [], [], [], []);
      expect(result.totalLoans).toBe(3);
    });

    it('should calculate total counterparties correctly', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const result = getPortfolioSummary([], [], [], [], counterparties, []);
      expect(result.totalCounterparties).toBe(2);
    });

    it('should calculate overall defect rate correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001' }),
        createLoan({ id: 'LOAN-0002' }),
        createLoan({ id: 'LOAN-0003' }),
        createLoan({ id: 'LOAN-0004' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002' }),
      ];
      const result = getPortfolioSummary(loans, defects, [], [], [], []);
      expect(result.overallDefectRate).toBe(0.5);
    });

    it('should return 0 defect rate when no defects exist', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001' }),
        createLoan({ id: 'LOAN-0002' }),
      ];
      const result = getPortfolioSummary(loans, [], [], [], [], []);
      expect(result.overallDefectRate).toBe(0);
    });

    it('should return 0 defect rate when no loans exist', () => {
      const defects = [
        createDefect({ id: 'DEF-0001' }),
        createDefect({ id: 'DEF-0002' }),
      ];
      const result = getPortfolioSummary([], defects, [], [], [], []);
      expect(result.overallDefectRate).toBe(0);
    });

    it('should cap defect rate at 1.0', () => {
      const loans = [createLoan({ id: 'LOAN-0001' })];
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0001' }),
        createDefect({ id: 'DEF-0003', loanId: 'LOAN-0001' }),
      ];
      const result = getPortfolioSummary(loans, defects, [], [], [], []);
      expect(result.overallDefectRate).toBe(1);
    });

    it('should calculate overall critical defect rate correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001' }),
        createLoan({ id: 'LOAN-0002' }),
        createLoan({ id: 'LOAN-0003' }),
        createLoan({ id: 'LOAN-0004' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'major' }),
      ];
      const result = getPortfolioSummary(loans, defects, [], [], [], []);
      expect(result.overallCriticalDefectRate).toBe(0.25);
    });

    it('should return 0 critical defect rate when no critical defects exist', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001' }),
        createLoan({ id: 'LOAN-0002' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', loanId: 'LOAN-0001', severity: 'minor' }),
        createDefect({ id: 'DEF-0002', loanId: 'LOAN-0002', severity: 'observation' }),
      ];
      const result = getPortfolioSummary(loans, defects, [], [], [], []);
      expect(result.overallCriticalDefectRate).toBe(0);
    });

    it('should calculate pass/fail ratio correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', status: 'PASS' }),
        createLoan({ id: 'LOAN-0002', status: 'PASS' }),
        createLoan({ id: 'LOAN-0003', status: 'PASS' }),
        createLoan({ id: 'LOAN-0004', status: 'FAIL' }),
      ];
      const result = getPortfolioSummary(loans, [], [], [], [], []);
      expect(result.passFailRatio).toBe(3);
    });

    it('should return Infinity when no failed loans exist', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', status: 'PASS' }),
        createLoan({ id: 'LOAN-0002', status: 'VALIDATED' }),
      ];
      const result = getPortfolioSummary(loans, [], [], [], [], []);
      expect(result.passFailRatio).toBe(Infinity);
    });

    it('should return 0 when no passed loans exist', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', status: 'FAIL' }),
        createLoan({ id: 'LOAN-0002', status: 'FAIL' }),
      ];
      const result = getPortfolioSummary(loans, [], [], [], [], []);
      expect(result.passFailRatio).toBe(0);
    });

    it('should count active watchlist entries correctly', () => {
      const watchlist = [
        createWatchlistEntry({ id: 'WLE-0001', status: 'active' }),
        createWatchlistEntry({ id: 'WLE-0002', status: 'active' }),
        createWatchlistEntry({ id: 'WLE-0003', status: 'monitoring' }),
        createWatchlistEntry({ id: 'WLE-0004', status: 'cleared' }),
      ];
      const result = getPortfolioSummary([], [], [], [], [], watchlist);
      expect(result.activeWatchlistCount).toBe(2);
    });

    it('should return 0 active watchlist count when watchlist is not an array', () => {
      const result = getPortfolioSummary([], [], [], [], [], null);
      expect(result.activeWatchlistCount).toBe(0);
    });

    it('should calculate total exposure from remedies and repurchases', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'open', financialImpact: { estimated: 50000, actual: null, currency: 'USD' } }),
        createRemedy({ id: 'REM-0002', status: 'in_progress', financialImpact: { estimated: 75000, actual: null, currency: 'USD' } }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', status: 'demand_issued', exposure: 200000 }),
      ];
      const result = getPortfolioSummary([], [], remedies, repurchases, [], []);
      expect(result.totalExposure).toBe(325000);
    });

    it('should exclude closed remedies from exposure calculation', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'closed', financialImpact: { estimated: 50000, actual: 50000, currency: 'USD' } }),
        createRemedy({ id: 'REM-0002', status: 'open', financialImpact: { estimated: 75000, actual: null, currency: 'USD' } }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.totalExposure).toBe(75000);
    });

    it('should exclude resolved remedies from exposure calculation', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'resolved', financialImpact: { estimated: 50000, actual: 50000, currency: 'USD' } }),
        createRemedy({ id: 'REM-0002', status: 'open', financialImpact: { estimated: 75000, actual: null, currency: 'USD' } }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.totalExposure).toBe(75000);
    });

    it('should exclude closed repurchases from exposure calculation', () => {
      const repurchases = [
        createRepurchase({ id: 'REP-0001', status: 'closed', exposure: 200000 }),
        createRepurchase({ id: 'REP-0002', status: 'demand_issued', exposure: 150000 }),
      ];
      const result = getPortfolioSummary([], [], [], repurchases, [], []);
      expect(result.totalExposure).toBe(150000);
    });

    it('should use demandAmount when exposure is not set on repurchase', () => {
      const repurchases = [
        createRepurchase({ id: 'REP-0001', status: 'demand_issued', exposure: null, demandAmount: 300000 }),
      ];
      const result = getPortfolioSummary([], [], [], repurchases, [], []);
      expect(result.totalExposure).toBe(300000);
    });

    it('should count open remedy cases correctly', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'open' }),
        createRemedy({ id: 'REM-0002', status: 'in_progress' }),
        createRemedy({ id: 'REM-0003', status: 'closed' }),
        createRemedy({ id: 'REM-0004', status: 'resolved' }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.openRemedyCases).toBe(2);
    });

    it('should count open repurchase cases correctly', () => {
      const repurchases = [
        createRepurchase({ id: 'REP-0001', status: 'demand_issued' }),
        createRepurchase({ id: 'REP-0002', status: 'negotiation' }),
        createRepurchase({ id: 'REP-0003', status: 'closed' }),
        createRepurchase({ id: 'REP-0004', status: 'draft' }),
      ];
      const result = getPortfolioSummary([], [], [], repurchases, [], []);
      expect(result.openRepurchaseCases).toBe(2);
    });

    it('should calculate SLA breach rate correctly', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', slaBreached: true }),
        createRemedy({ id: 'REM-0002', slaBreached: false }),
        createRemedy({ id: 'REM-0003', slaBreached: true }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.slaBreachRate).toBeCloseTo(2 / 3, 4);
    });

    it('should return 0 SLA breach rate when no cases exist', () => {
      const result = getPortfolioSummary([], [], [], [], [], []);
      expect(result.slaBreachRate).toBe(0);
    });

    it('should calculate average remedy response days correctly', () => {
      const remedies = [
        createRemedy({
          id: 'REM-0001',
          status: 'open',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createRemedy({
          id: 'REM-0002',
          status: 'in_progress',
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.avgRemedyResponseDays).toBeGreaterThan(0);
      expect(result.avgRemedyResponseDays).toBeLessThanOrEqual(30);
    });

    it('should return 0 avg remedy response days when no open remedies exist', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'closed' }),
        createRemedy({ id: 'REM-0002', status: 'resolved' }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.avgRemedyResponseDays).toBe(0);
    });

    it('should handle remedies without createdAt gracefully', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'open', createdAt: null }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.avgRemedyResponseDays).toBe(0);
    });

    it('should handle remedies with invalid createdAt gracefully', () => {
      const remedies = [
        createRemedy({ id: 'REM-0001', status: 'open', createdAt: 'invalid-date' }),
      ];
      const result = getPortfolioSummary([], [], remedies, [], [], []);
      expect(result.avgRemedyResponseDays).toBe(0);
    });

    it('should include aged repurchases in SLA breach rate', () => {
      const repurchases = [
        createRepurchase({
          id: 'REP-0001',
          status: 'demand_issued',
          createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = getPortfolioSummary([], [], [], repurchases, [], []);
      expect(result.slaBreachRate).toBe(1);
    });

    it('should exclude draft repurchases from SLA breach rate', () => {
      const repurchases = [
        createRepurchase({
          id: 'REP-0001',
          status: 'draft',
          createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = getPortfolioSummary([], [], [], repurchases, [], []);
      expect(result.slaBreachRate).toBe(0);
    });

    it('should exclude closed repurchases from SLA breach rate', () => {
      const repurchases = [
        createRepurchase({
          id: 'REP-0001',
          status: 'closed',
          createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      const result = getPortfolioSummary([], [], [], repurchases, [], []);
      expect(result.slaBreachRate).toBe(0);
    });

    it('should handle non-array remedies gracefully', () => {
      const result = getPortfolioSummary([], [], null, [], [], []);
      expect(result.openRemedyCases).toBe(0);
      expect(result.totalExposure).toBe(0);
    });

    it('should handle non-array repurchases gracefully', () => {
      const result = getPortfolioSummary([], [], [], null, [], []);
      expect(result.openRepurchaseCases).toBe(0);
      expect(result.totalExposure).toBe(0);
    });

    it('should handle non-array watchlist gracefully', () => {
      const result = getPortfolioSummary([], [], [], [], [], 'not an array');
      expect(result.activeWatchlistCount).toBe(0);
    });
  });

  describe('getTopCounterparties', () => {
    it('should return empty array when no counterparties exist', () => {
      const result = getTopCounterparties([], [], [], [], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when counterparties is null', () => {
      const result = getTopCounterparties([], [], [], [], null, []);
      expect(result).toEqual([]);
    });

    it('should return empty array when counterparties is not an array', () => {
      const result = getTopCounterparties([], [], [], [], 'invalid', []);
      expect(result).toEqual([]);
    });

    it('should rank counterparties by defect rate descending by default', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001', name: 'CP One' }),
        createCounterparty({ id: 'SELL-0002', name: 'CP Two' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0002' }),
        createLoan({ id: 'LOAN-0004', sellerId: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ id: 'DEF-0002', sellerId: 'SELL-0001', loanId: 'LOAN-0002' }),
        createDefect({ id: 'DEF-0003', sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ id: 'DEF-0004', sellerId: 'SELL-0002', loanId: 'LOAN-0003' }),
      ];
      const result = getTopCounterparties(loans, defects, [], [], counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyId).toBe('SELL-0001');
    });

    it('should respect the limit parameter', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
        createCounterparty({ id: 'SELL-0003' }),
        createCounterparty({ id: 'SELL-0004' }),
        createCounterparty({ id: 'SELL-0005' }),
      ];
      const loans = counterparties.map((cp) =>
        createLoan({ id: `LOAN-${cp.id}`, sellerId: cp.id }),
      );
      const result = getTopCounterparties(loans, [], [], [], counterparties, [], 3);
      expect(result.length).toBe(3);
    });

    it('should default limit to 10 when not specified', () => {
      const counterparties = Array.from({ length: 15 }, (_, i) =>
        createCounterparty({ id: `SELL-${String(i + 1).padStart(4, '0')}` }),
      );
      const loans = counterparties.map((cp) =>
        createLoan({ id: `LOAN-${cp.id}`, sellerId: cp.id }),
      );
      const result = getTopCounterparties(loans, [], [], [], counterparties, []);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should sort by criticalDefectRate when specified', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001', name: 'CP One' }),
        createCounterparty({ id: 'SELL-0002', name: 'CP Two' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', sellerId: 'SELL-0002', loanId: 'LOAN-0002', severity: 'minor' }),
      ];
      const result = getTopCounterparties(loans, defects, [], [], counterparties, [], 10, 'criticalDefectRate', 'desc');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyId).toBe('SELL-0001');
    });

    it('should sort by exposure when specified', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001', name: 'CP One' }),
        createCounterparty({ id: 'SELL-0002', name: 'CP Two' }),
      ];
      const remedies = [
        createRemedy({ id: 'REM-0001', sellerId: 'SELL-0001', status: 'open', financialImpact: { estimated: 500000, actual: null, currency: 'USD' } }),
        createRemedy({ id: 'REM-0002', sellerId: 'SELL-0002', status: 'open', financialImpact: { estimated: 100000, actual: null, currency: 'USD' } }),
      ];
      const result = getTopCounterparties([], [], remedies, [], counterparties, [], 10, 'exposure', 'desc');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyId).toBe('SELL-0001');
    });

    it('should sort by passRate when specified', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001', name: 'CP One' }),
        createCounterparty({ id: 'SELL-0002', name: 'CP Two' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001', status: 'PASS' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0001', status: 'PASS' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0002', status: 'FAIL' }),
        createLoan({ id: 'LOAN-0004', sellerId: 'SELL-0002', status: 'FAIL' }),
      ];
      const result = getTopCounterparties(loans, [], [], [], counterparties, [], 10, 'passRate', 'desc');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyId).toBe('SELL-0001');
    });

    it('should support ascending sort order', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001', name: 'CP One' }),
        createCounterparty({ id: 'SELL-0002', name: 'CP Two' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
        createDefect({ id: 'DEF-0002', sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
      ];
      const result = getTopCounterparties(loans, defects, [], [], counterparties, [], 10, 'defectRate', 'asc');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyId).toBe('SELL-0002');
    });

    it('should include risk tier and score in results', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const loans = [createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' })];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001', severity: 'critical' }),
      ];
      const result = getTopCounterparties(loans, defects, [], [], counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('riskTier');
      expect(result[0]).toHaveProperty('riskScore');
      expect(result[0].riskScore).toBeGreaterThanOrEqual(0);
      expect(result[0].riskScore).toBeLessThanOrEqual(100);
    });

    it('should include watchlist status in results', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const watchlist = [
        createWatchlistEntry({ id: 'WLE-0001', counterpartyId: 'SELL-0001', status: 'active' }),
      ];
      const result = getTopCounterparties([], [], [], [], counterparties, watchlist);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].onWatchlist).toBe(true);
    });

    it('should set onWatchlist to false when not on watchlist', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getTopCounterparties([], [], [], [], counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].onWatchlist).toBe(false);
    });

    it('should skip counterparties without id', () => {
      const counterparties = [
        { name: 'No ID' },
        createCounterparty({ id: 'SELL-0001' }),
      ];
      const result = getTopCounterparties([], [], [], [], counterparties, []);
      expect(result.length).toBe(1);
      expect(result[0].counterpartyId).toBe('SELL-0001');
    });

    it('should handle non-array loans gracefully', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getTopCounterparties(null, [], [], [], counterparties, []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle non-array defects gracefully', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getTopCounterparties([], null, [], [], counterparties, []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle non-array remedies gracefully', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getTopCounterparties([], [], null, [], counterparties, []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle non-array repurchases gracefully', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getTopCounterparties([], [], [], null, counterparties, []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle non-array watchlist gracefully', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getTopCounterparties([], [], [], [], counterparties, null);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should default sortBy to defectRate when invalid sort field provided', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
      ];
      const result = getTopCounterparties(loans, defects, [], [], counterparties, [], 10, 'invalidField', 'desc');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should default order to desc when invalid order provided', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0002' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001' }),
      ];
      const result = getTopCounterparties(loans, defects, [], [], counterparties, [], 10, 'defectRate', 'invalid');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should default limit to 10 when invalid limit provided', () => {
      const counterparties = Array.from({ length: 15 }, (_, i) =>
        createCounterparty({ id: `SELL-${String(i + 1).padStart(4, '0')}` }),
      );
      const loans = counterparties.map((cp) =>
        createLoan({ id: `LOAN-${cp.id}`, sellerId: cp.id }),
      );
      const result = getTopCounterparties(loans, [], [], [], counterparties, [], -5);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should include counterparty name in results', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001', name: 'Test Corp' })];
      const result = getTopCounterparties([], [], [], [], counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyName).toBe('Test Corp');
    });

    it('should fallback counterparty name to id when name is missing', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001', name: undefined })];
      const result = getTopCounterparties([], [], [], [], counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].counterpartyName).toBe('SELL-0001');
    });

    it('should calculate totalLoans per counterparty', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0001' }),
      ];
      const result = getTopCounterparties(loans, [], [], [], counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].totalLoans).toBe(3);
    });

    it('should calculate totalExposure per counterparty', () => {
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const remedies = [
        createRemedy({ id: 'REM-0001', sellerId: 'SELL-0001', status: 'open', financialImpact: { estimated: 50000, actual: null, currency: 'USD' } }),
      ];
      const repurchases = [
        createRepurchase({ id: 'REP-0001', sellerId: 'SELL-0001', status: 'demand_issued', exposure: 100000 }),
      ];
      const result = getTopCounterparties([], [], remedies, repurchases, counterparties, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].totalExposure).toBe(150000);
    });
  });

  describe('getConcentrationData', () => {
    it('should return default concentration when no loans exist', () => {
      const result = getConcentrationData([], [], []);
      expect(result.byCounterparty).toEqual([]);
      expect(result.byProductType).toEqual([]);
      expect(result.byChannel).toEqual([]);
      expect(result.byRiskTier).toEqual([]);
    });

    it('should return default concentration when loans is null', () => {
      const result = getConcentrationData(null, [], []);
      expect(result.byCounterparty).toEqual([]);
      expect(result.byProductType).toEqual([]);
      expect(result.byChannel).toEqual([]);
    });

    it('should return default concentration when loans is not an array', () => {
      const result = getConcentrationData('invalid', [], []);
      expect(result.byCounterparty).toEqual([]);
      expect(result.byProductType).toEqual([]);
    });

    it('should calculate byCounterparty correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0002' }),
      ];
      const counterparties = [
        createCounterparty({ id: 'SELL-0001', name: 'CP One' }),
        createCounterparty({ id: 'SELL-0002', name: 'CP Two' }),
      ];
      const result = getConcentrationData(loans, [], counterparties);
      expect(result.byCounterparty.length).toBe(2);
      expect(result.byCounterparty[0].count).toBe(2);
      expect(result.byCounterparty[0].counterpartyName).toBe('CP One');
      expect(result.byCounterparty[1].count).toBe(1);
      expect(result.byCounterparty[1].counterpartyName).toBe('CP Two');
    });

    it('should calculate percentages in byCounterparty', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0004', sellerId: 'SELL-0002' }),
      ];
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const result = getConcentrationData(loans, [], counterparties);
      expect(result.byCounterparty[0].percentage).toBe(75);
      expect(result.byCounterparty[1].percentage).toBe(25);
    });

    it('should sort byCounterparty by count descending', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0002' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0004', sellerId: 'SELL-0001' }),
      ];
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
      ];
      const result = getConcentrationData(loans, [], counterparties);
      expect(result.byCounterparty[0].counterpartyId).toBe('SELL-0001');
      expect(result.byCounterparty[0].count).toBe(3);
    });

    it('should calculate byProductType correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', productType: 'conventional' }),
        createLoan({ id: 'LOAN-0002', productType: 'conventional' }),
        createLoan({ id: 'LOAN-0003', productType: 'FHA' }),
        createLoan({ id: 'LOAN-0004', productType: 'VA' }),
      ];
      const result = getConcentrationData(loans, [], []);
      expect(result.byProductType.length).toBe(3);
      const conventional = result.byProductType.find((p) => p.name === 'conventional');
      expect(conventional.count).toBe(2);
      expect(conventional.percentage).toBe(50);
    });

    it('should sort byProductType by count descending', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', productType: 'FHA' }),
        createLoan({ id: 'LOAN-0002', productType: 'conventional' }),
        createLoan({ id: 'LOAN-0003', productType: 'conventional' }),
        createLoan({ id: 'LOAN-0004', productType: 'conventional' }),
      ];
      const result = getConcentrationData(loans, [], []);
      expect(result.byProductType[0].name).toBe('conventional');
      expect(result.byProductType[0].count).toBe(3);
    });

    it('should calculate byChannel correctly', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', channel: 'retail' }),
        createLoan({ id: 'LOAN-0002', channel: 'retail' }),
        createLoan({ id: 'LOAN-0003', channel: 'correspondent' }),
      ];
      const result = getConcentrationData(loans, [], []);
      expect(result.byChannel.length).toBe(2);
      const retail = result.byChannel.find((c) => c.name === 'retail');
      expect(retail.count).toBe(2);
    });

    it('should sort byChannel by count descending', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', channel: 'broker' }),
        createLoan({ id: 'LOAN-0002', channel: 'retail' }),
        createLoan({ id: 'LOAN-0003', channel: 'retail' }),
        createLoan({ id: 'LOAN-0004', channel: 'retail' }),
      ];
      const result = getConcentrationData(loans, [], []);
      expect(result.byChannel[0].name).toBe('retail');
      expect(result.byChannel[0].count).toBe(3);
    });

    it('should calculate byRiskTier correctly', () => {
      const counterparties = [
        createCounterparty({ id: 'SELL-0001' }),
        createCounterparty({ id: 'SELL-0002' }),
        createCounterparty({ id: 'SELL-0003' }),
      ];
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: 'SELL-0002' }),
        createLoan({ id: 'LOAN-0003', sellerId: 'SELL-0003' }),
      ];
      const defects = [
        createDefect({ id: 'DEF-0001', sellerId: 'SELL-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0002', sellerId: 'SELL-0001', loanId: 'LOAN-0001', severity: 'critical' }),
        createDefect({ id: 'DEF-0003', sellerId: 'SELL-0002', loanId: 'LOAN-0002', severity: 'major' }),
      ];
      const result = getConcentrationData(loans, defects, counterparties);
      expect(result.byRiskTier.length).toBeGreaterThan(0);
    });

    it('should handle non-array defects gracefully in concentration', () => {
      const loans = [createLoan({ id: 'LOAN-0001' })];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getConcentrationData(loans, null, counterparties);
      expect(result.byRiskTier.length).toBeGreaterThan(0);
    });

    it('should handle non-array counterparties gracefully in concentration', () => {
      const loans = [createLoan({ id: 'LOAN-0001' })];
      const result = getConcentrationData(loans, [], null);
      expect(result.byCounterparty.length).toBeGreaterThan(0);
    });

    it('should skip loans without sellerId in byCounterparty', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' }),
        createLoan({ id: 'LOAN-0002', sellerId: null }),
      ];
      const counterparties = [createCounterparty({ id: 'SELL-0001' })];
      const result = getConcentrationData(loans, [], counterparties);
      expect(result.byCounterparty.length).toBe(1);
    });

    it('should skip loans without productType in byProductType', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', productType: 'conventional' }),
        createLoan({ id: 'LOAN-0002', productType: null }),
      ];
      const result = getConcentrationData(loans, [], []);
      expect(result.byProductType.length).toBe(1);
    });

    it('should skip loans without channel in byChannel', () => {
      const loans = [
        createLoan({ id: 'LOAN-0001', channel: 'retail' }),
        createLoan({ id: 'LOAN-0002', channel: null }),
      ];
      const result = getConcentrationData(loans, [], []);
      expect(result.byChannel.length).toBe(1);
    });

    it('should fallback counterparty name to id when counterparty not found', () => {
      const loans = [createLoan({ id: 'LOAN-0001', sellerId: 'SELL-0001' })];
      const result = getConcentrationData(loans, [], []);
      expect(result.byCounterparty.length).toBe(1);
      expect(result.byCounterparty[0].counterpartyName).toBe('SELL-0001');
    });
  });
});