import { describe, it, expect } from 'vitest';
import {
  validateLoanSchema,
  validateDependencyRules,
  validateRuleConfig,
  validateSellerReference,
  validateFileUpload,
  validateSamplingConfig,
  validateRequiredFields,
  validateLoan,
} from './validators';

describe('validateLoanSchema', () => {
  const validLoan = {
    borrowerName: 'Jane Doe',
    ssn: '123-45-6789',
    propertyAddress: '123 Main St, Springfield, IL 62701',
    loanAmount: 250000,
    productType: 'conventional',
    channel: 'retail',
    sellerId: 'SELL-0001',
  };

  it('should pass a valid loan with all required fields', () => {
    const result = validateLoanSchema(validLoan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass a valid loan with optional fields', () => {
    const loan = {
      ...validLoan,
      borrowerAddress: '456 Oak Ave, Springfield, IL 62702',
      borrowerIncome: 85000,
      creditScore: 720,
      accountNumber: 'LN-12345678',
      email: 'jane.doe@example.com',
      phone: '(555) 123-4567',
      loanPurpose: 'purchase',
      ltv: 80,
      dti: 36,
    };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when loan is null', () => {
    const result = validateLoanSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe('loan');
  });

  it('should fail when loan is undefined', () => {
    const result = validateLoanSchema(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail when loan is not an object', () => {
    const result = validateLoanSchema('not an object');
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('loan');
  });

  it('should fail when borrowerName is missing', () => {
    const loan = { ...validLoan };
    delete loan.borrowerName;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerName')).toBe(true);
  });

  it('should fail when borrowerName is empty string', () => {
    const loan = { ...validLoan, borrowerName: '' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerName')).toBe(true);
  });

  it('should fail when borrowerName is whitespace only', () => {
    const loan = { ...validLoan, borrowerName: '   ' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerName')).toBe(true);
  });

  it('should fail when ssn is missing', () => {
    const loan = { ...validLoan };
    delete loan.ssn;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ssn')).toBe(true);
  });

  it('should fail when ssn format is invalid', () => {
    const loan = { ...validLoan, ssn: '123456789' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ssn')).toBe(true);
  });

  it('should fail when ssn has wrong format', () => {
    const loan = { ...validLoan, ssn: '12-3456-789' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ssn')).toBe(true);
  });

  it('should pass when ssn is in correct format', () => {
    const loan = { ...validLoan, ssn: '987-65-4321' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when propertyAddress is missing', () => {
    const loan = { ...validLoan };
    delete loan.propertyAddress;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'propertyAddress')).toBe(true);
  });

  it('should fail when propertyAddress is empty', () => {
    const loan = { ...validLoan, propertyAddress: '' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'propertyAddress')).toBe(true);
  });

  it('should fail when loanAmount is missing', () => {
    const loan = { ...validLoan };
    delete loan.loanAmount;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanAmount')).toBe(true);
  });

  it('should fail when loanAmount is zero', () => {
    const loan = { ...validLoan, loanAmount: 0 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanAmount')).toBe(true);
  });

  it('should fail when loanAmount is negative', () => {
    const loan = { ...validLoan, loanAmount: -1000 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanAmount')).toBe(true);
  });

  it('should fail when loanAmount is not a number', () => {
    const loan = { ...validLoan, loanAmount: 'not a number' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanAmount')).toBe(true);
  });

  it('should fail when loanAmount exceeds maximum', () => {
    const loan = { ...validLoan, loanAmount: 6000000 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanAmount')).toBe(true);
  });

  it('should pass when loanAmount is at maximum', () => {
    const loan = { ...validLoan, loanAmount: 5000000 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when loanAmount is 1', () => {
    const loan = { ...validLoan, loanAmount: 1 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when productType is missing', () => {
    const loan = { ...validLoan };
    delete loan.productType;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'productType')).toBe(true);
  });

  it('should fail when productType is invalid', () => {
    const loan = { ...validLoan, productType: 'invalid_type' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'productType')).toBe(true);
  });

  it('should pass for all valid product types', () => {
    const validTypes = ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];
    for (const productType of validTypes) {
      const loan = { ...validLoan, productType };
      const result = validateLoanSchema(loan);
      expect(result.valid).toBe(true);
    }
  });

  it('should fail when channel is missing', () => {
    const loan = { ...validLoan };
    delete loan.channel;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'channel')).toBe(true);
  });

  it('should fail when channel is invalid', () => {
    const loan = { ...validLoan, channel: 'invalid_channel' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'channel')).toBe(true);
  });

  it('should pass for all valid channels', () => {
    const validChannels = ['retail', 'correspondent', 'broker', 'wholesale'];
    for (const channel of validChannels) {
      const loan = { ...validLoan, channel };
      const result = validateLoanSchema(loan);
      expect(result.valid).toBe(true);
    }
  });

  it('should fail when sellerId is missing', () => {
    const loan = { ...validLoan };
    delete loan.sellerId;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when sellerId is empty', () => {
    const loan = { ...validLoan, sellerId: '' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when creditScore is below minimum', () => {
    const loan = { ...validLoan, creditScore: 200 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'creditScore')).toBe(true);
  });

  it('should fail when creditScore is above maximum', () => {
    const loan = { ...validLoan, creditScore: 900 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'creditScore')).toBe(true);
  });

  it('should pass when creditScore is at minimum', () => {
    const loan = { ...validLoan, creditScore: 300 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when creditScore is at maximum', () => {
    const loan = { ...validLoan, creditScore: 850 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when creditScore is not provided', () => {
    const loan = { ...validLoan };
    delete loan.creditScore;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when creditScore is not a number', () => {
    const loan = { ...validLoan, creditScore: 'high' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'creditScore')).toBe(true);
  });

  it('should fail when ltv is below minimum', () => {
    const loan = { ...validLoan, ltv: -5 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('should fail when ltv is above maximum', () => {
    const loan = { ...validLoan, ltv: 150 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('should pass when ltv is at minimum', () => {
    const loan = { ...validLoan, ltv: 0 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when ltv is at maximum', () => {
    const loan = { ...validLoan, ltv: 100 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when ltv is not provided', () => {
    const loan = { ...validLoan };
    delete loan.ltv;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when dti is below minimum', () => {
    const loan = { ...validLoan, dti: -10 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'dti')).toBe(true);
  });

  it('should fail when dti is above maximum', () => {
    const loan = { ...validLoan, dti: 120 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'dti')).toBe(true);
  });

  it('should pass when dti is at minimum', () => {
    const loan = { ...validLoan, dti: 0 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when dti is at maximum', () => {
    const loan = { ...validLoan, dti: 100 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when dti is not provided', () => {
    const loan = { ...validLoan };
    delete loan.dti;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when borrowerIncome is negative', () => {
    const loan = { ...validLoan, borrowerIncome: -5000 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerIncome')).toBe(true);
  });

  it('should fail when borrowerIncome is zero', () => {
    const loan = { ...validLoan, borrowerIncome: 0 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerIncome')).toBe(true);
  });

  it('should pass when borrowerIncome is positive', () => {
    const loan = { ...validLoan, borrowerIncome: 50000 };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when borrowerIncome is not provided', () => {
    const loan = { ...validLoan };
    delete loan.borrowerIncome;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when email format is invalid', () => {
    const loan = { ...validLoan, email: 'not-an-email' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('should pass when email is valid', () => {
    const loan = { ...validLoan, email: 'test@example.com' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when email is not provided', () => {
    const loan = { ...validLoan };
    delete loan.email;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when email is empty string', () => {
    const loan = { ...validLoan, email: '' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when phone format is invalid', () => {
    const loan = { ...validLoan, phone: '555-123-4567' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'phone')).toBe(true);
  });

  it('should pass when phone is valid', () => {
    const loan = { ...validLoan, phone: '(555) 123-4567' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when phone is not provided', () => {
    const loan = { ...validLoan };
    delete loan.phone;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when phone is empty string', () => {
    const loan = { ...validLoan, phone: '' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when accountNumber format is invalid', () => {
    const loan = { ...validLoan, accountNumber: '12345' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'accountNumber')).toBe(true);
  });

  it('should pass when accountNumber is valid', () => {
    const loan = { ...validLoan, accountNumber: 'LN-12345678' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when accountNumber is not provided', () => {
    const loan = { ...validLoan };
    delete loan.accountNumber;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when accountNumber is empty string', () => {
    const loan = { ...validLoan, accountNumber: '' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when loanPurpose is invalid', () => {
    const loan = { ...validLoan, loanPurpose: 'invalid_purpose' };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanPurpose')).toBe(true);
  });

  it('should pass for all valid loan purposes', () => {
    const validPurposes = ['purchase', 'refinance', 'cash-out'];
    for (const loanPurpose of validPurposes) {
      const loan = { ...validLoan, loanPurpose };
      const result = validateLoanSchema(loan);
      expect(result.valid).toBe(true);
    }
  });

  it('should pass when loanPurpose is not provided', () => {
    const loan = { ...validLoan };
    delete loan.loanPurpose;
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should return multiple errors for multiple invalid fields', () => {
    const loan = {
      borrowerName: '',
      ssn: 'invalid',
      propertyAddress: '',
      loanAmount: -100,
      productType: 'invalid',
      channel: 'invalid',
      sellerId: '',
    };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('should handle loan with null optional fields', () => {
    const loan = {
      ...validLoan,
      borrowerAddress: null,
      borrowerIncome: null,
      creditScore: null,
      accountNumber: null,
      email: null,
      phone: null,
      loanPurpose: null,
      ltv: null,
      dti: null,
    };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });

  it('should handle loan with undefined optional fields', () => {
    const loan = {
      ...validLoan,
      borrowerAddress: undefined,
      borrowerIncome: undefined,
      creditScore: undefined,
      accountNumber: undefined,
      email: undefined,
      phone: undefined,
      loanPurpose: undefined,
      ltv: undefined,
      dti: undefined,
    };
    const result = validateLoanSchema(loan);
    expect(result.valid).toBe(true);
  });
});

describe('validateDependencyRules', () => {
  const baseLoan = {
    borrowerName: 'Jane Doe',
    ssn: '123-45-6789',
    propertyAddress: '123 Main St',
    loanAmount: 250000,
    productType: 'conventional',
    channel: 'retail',
    sellerId: 'SELL-0001',
  };

  it('should pass a conventional loan with valid LTV', () => {
    const loan = { ...baseLoan, productType: 'conventional', ltv: 80 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail FHA loan with LTV above 96.5', () => {
    const loan = { ...baseLoan, productType: 'FHA', ltv: 97 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('should pass FHA loan with LTV at 96.5', () => {
    const loan = { ...baseLoan, productType: 'FHA', ltv: 96.5 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass FHA loan with LTV below 96.5', () => {
    const loan = { ...baseLoan, productType: 'FHA', ltv: 90 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail VA loan with LTV above 100', () => {
    const loan = { ...baseLoan, productType: 'VA', ltv: 105 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('should pass VA loan with LTV at 100', () => {
    const loan = { ...baseLoan, productType: 'VA', ltv: 100 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass VA loan with LTV below 100', () => {
    const loan = { ...baseLoan, productType: 'VA', ltv: 95 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail jumbo loan with amount below conforming limit', () => {
    const loan = { ...baseLoan, productType: 'jumbo', loanAmount: 500000 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'loanAmount')).toBe(true);
  });

  it('should pass jumbo loan with amount above conforming limit', () => {
    const loan = { ...baseLoan, productType: 'jumbo', loanAmount: 800000 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail conventional loan with amount above conforming limit', () => {
    const loan = { ...baseLoan, productType: 'conventional', loanAmount: 800000 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'productType')).toBe(true);
  });

  it('should pass conventional loan with amount at conforming limit', () => {
    const loan = { ...baseLoan, productType: 'conventional', loanAmount: 726200 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail USDA loan with income above limit', () => {
    const loan = { ...baseLoan, productType: 'USDA', borrowerIncome: 150000 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerIncome')).toBe(true);
  });

  it('should pass USDA loan with income at limit', () => {
    const loan = { ...baseLoan, productType: 'USDA', borrowerIncome: 110000 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass USDA loan with income below limit', () => {
    const loan = { ...baseLoan, productType: 'USDA', borrowerIncome: 80000 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail cash-out refinance with LTV above 80', () => {
    const loan = { ...baseLoan, loanPurpose: 'cash-out', ltv: 85 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('should pass cash-out refinance with LTV at 80', () => {
    const loan = { ...baseLoan, loanPurpose: 'cash-out', ltv: 80 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass cash-out refinance with LTV below 80', () => {
    const loan = { ...baseLoan, loanPurpose: 'cash-out', ltv: 75 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass purchase loan with LTV above 80', () => {
    const loan = { ...baseLoan, loanPurpose: 'purchase', ltv: 90 };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should pass when optional fields are not provided', () => {
    const loan = { ...baseLoan };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(true);
  });

  it('should fail when loan is null', () => {
    const result = validateDependencyRules(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('loan');
  });

  it('should fail when loan is not an object', () => {
    const result = validateDependencyRules('invalid');
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('loan');
  });

  it('should return multiple errors for multiple dependency violations', () => {
    const loan = {
      ...baseLoan,
      productType: 'FHA',
      ltv: 100,
      loanPurpose: 'cash-out',
    };
    const result = validateDependencyRules(loan);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateRuleConfig', () => {
  const validRule = {
    name: 'Test Rule',
    description: 'A test rule for validation',
    productTypes: ['conventional'],
    channels: ['retail'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 620,
        message: 'Credit score is below minimum',
      },
    ],
    weight: 0,
    effectiveDate: '2026-01-01',
    expirationDate: null,
  };

  it('should pass a valid hard_stop rule', () => {
    const result = validateRuleConfig(validRule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass a valid weighted_score rule', () => {
    const rule = {
      ...validRule,
      ruleType: 'weighted_score',
      weight: 30,
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should fail when rule is null', () => {
    const result = validateRuleConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('rule');
  });

  it('should fail when rule is not an object', () => {
    const result = validateRuleConfig('invalid');
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('rule');
  });

  it('should fail when name is missing', () => {
    const rule = { ...validRule };
    delete rule.name;
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('should fail when name is empty', () => {
    const rule = { ...validRule, name: '' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('should fail when description is missing', () => {
    const rule = { ...validRule };
    delete rule.description;
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
  });

  it('should fail when description is empty', () => {
    const rule = { ...validRule, description: '' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
  });

  it('should fail when ruleType is missing', () => {
    const rule = { ...validRule };
    delete rule.ruleType;
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ruleType')).toBe(true);
  });

  it('should fail when ruleType is invalid', () => {
    const rule = { ...validRule, ruleType: 'invalid_type' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ruleType')).toBe(true);
  });

  it('should pass for both valid rule types', () => {
    const types = ['hard_stop', 'weighted_score'];
    for (const ruleType of types) {
      const rule = { ...validRule, ruleType, weight: ruleType === 'weighted_score' ? 30 : 0 };
      const result = validateRuleConfig(rule);
      expect(result.valid).toBe(true);
    }
  });

  it('should fail when productTypes is empty array', () => {
    const rule = { ...validRule, productTypes: [] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'productTypes')).toBe(true);
  });

  it('should fail when productTypes is not an array', () => {
    const rule = { ...validRule, productTypes: 'conventional' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'productTypes')).toBe(true);
  });

  it('should fail when productTypes contains invalid value', () => {
    const rule = { ...validRule, productTypes: ['conventional', 'invalid'] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.startsWith('productTypes'))).toBe(true);
  });

  it('should fail when channels is empty array', () => {
    const rule = { ...validRule, channels: [] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'channels')).toBe(true);
  });

  it('should fail when channels is not an array', () => {
    const rule = { ...validRule, channels: 'retail' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'channels')).toBe(true);
  });

  it('should fail when channels contains invalid value', () => {
    const rule = { ...validRule, channels: ['retail', 'invalid'] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.startsWith('channels'))).toBe(true);
  });

  it('should pass when sellerIds is null', () => {
    const rule = { ...validRule, sellerIds: null };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass when sellerIds is a non-empty array', () => {
    const rule = { ...validRule, sellerIds: ['SELL-0001', 'SELL-0002'] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should fail when sellerIds is an empty array', () => {
    const rule = { ...validRule, sellerIds: [] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerIds')).toBe(true);
  });

  it('should fail when sellerIds is not an array or null', () => {
    const rule = { ...validRule, sellerIds: 'SELL-0001' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerIds')).toBe(true);
  });

  it('should fail when weighted_score rule has no weight', () => {
    const rule = { ...validRule, ruleType: 'weighted_score' };
    delete rule.weight;
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'weight')).toBe(true);
  });

  it('should fail when weight is below minimum', () => {
    const rule = { ...validRule, ruleType: 'weighted_score', weight: 0 };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'weight')).toBe(true);
  });

  it('should fail when weight is above maximum', () => {
    const rule = { ...validRule, ruleType: 'weighted_score', weight: 101 };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'weight')).toBe(true);
  });

  it('should pass when weight is at minimum', () => {
    const rule = { ...validRule, ruleType: 'weighted_score', weight: 1 };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass when weight is at maximum', () => {
    const rule = { ...validRule, ruleType: 'weighted_score', weight: 100 };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass when weight is not a number', () => {
    const rule = { ...validRule, ruleType: 'weighted_score', weight: 'heavy' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'weight')).toBe(true);
  });

  it('should fail when conditions is empty array', () => {
    const rule = { ...validRule, conditions: [] };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'conditions')).toBe(true);
  });

  it('should fail when conditions is not an array', () => {
    const rule = { ...validRule, conditions: 'not an array' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'conditions')).toBe(true);
  });

  it('should fail when condition field is missing', () => {
    const rule = {
      ...validRule,
      conditions: [{ operator: 'gt', value: 620, message: 'Test' }],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('field'))).toBe(true);
  });

  it('should fail when condition operator is missing', () => {
    const rule = {
      ...validRule,
      conditions: [{ field: 'creditScore', value: 620, message: 'Test' }],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('operator'))).toBe(true);
  });

  it('should fail when condition operator is invalid', () => {
    const rule = {
      ...validRule,
      conditions: [{ field: 'creditScore', operator: 'invalid', value: 620, message: 'Test' }],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('operator'))).toBe(true);
  });

  it('should fail when condition value is missing', () => {
    const rule = {
      ...validRule,
      conditions: [{ field: 'creditScore', operator: 'gt', message: 'Test' }],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('value'))).toBe(true);
  });

  it('should fail when condition message is missing', () => {
    const rule = {
      ...validRule,
      conditions: [{ field: 'creditScore', operator: 'gt', value: 620 }],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('message'))).toBe(true);
  });

  it('should pass with multiple valid conditions', () => {
    const rule = {
      ...validRule,
      conditions: [
        { field: 'creditScore', operator: 'gte', value: 620, message: 'Credit score check' },
        { field: 'ltv', operator: 'lte', value: 80, message: 'LTV check' },
      ],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should fail when effectiveDate is missing', () => {
    const rule = { ...validRule };
    delete rule.effectiveDate;
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'effectiveDate')).toBe(true);
  });

  it('should fail when effectiveDate is invalid', () => {
    const rule = { ...validRule, effectiveDate: 'not-a-date' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'effectiveDate')).toBe(true);
  });

  it('should pass when effectiveDate is valid', () => {
    const rule = { ...validRule, effectiveDate: '2026-06-09' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass when expirationDate is null', () => {
    const rule = { ...validRule, expirationDate: null };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass when expirationDate is valid and after effectiveDate', () => {
    const rule = { ...validRule, effectiveDate: '2026-01-01', expirationDate: '2026-12-31' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should fail when expirationDate is invalid', () => {
    const rule = { ...validRule, expirationDate: 'not-a-date' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'expirationDate')).toBe(true);
  });

  it('should fail when expirationDate is before effectiveDate', () => {
    const rule = { ...validRule, effectiveDate: '2026-06-01', expirationDate: '2026-01-01' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'expirationDate')).toBe(true);
  });

  it('should fail when expirationDate equals effectiveDate', () => {
    const rule = { ...validRule, effectiveDate: '2026-06-01', expirationDate: '2026-06-01' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'expirationDate')).toBe(true);
  });

  it('should pass when expirationDate is empty string', () => {
    const rule = { ...validRule, expirationDate: '' };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass when expirationDate is undefined', () => {
    const rule = { ...validRule };
    delete rule.expirationDate;
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(true);
  });

  it('should pass for all valid operators', () => {
    const validOperators = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'not_in'];
    for (const operator of validOperators) {
      const rule = {
        ...validRule,
        conditions: [{ field: 'creditScore', operator, value: 620, message: 'Test' }],
      };
      const result = validateRuleConfig(rule);
      expect(result.valid).toBe(true);
    }
  });

  it('should validate condition at specific index', () => {
    const rule = {
      ...validRule,
      conditions: [
        { field: 'creditScore', operator: 'gte', value: 620, message: 'First condition' },
        { operator: 'lt', value: 80, message: 'Second condition' },
      ],
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('conditions[1].field'))).toBe(true);
  });

  it('should return multiple errors for multiple invalid fields', () => {
    const rule = {
      name: '',
      description: '',
      productTypes: [],
      channels: [],
      ruleType: 'invalid',
      conditions: [],
      effectiveDate: '',
    };
    const result = validateRuleConfig(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateSellerReference', () => {
  const existingSellers = [
    { id: 'SELL-0001', name: 'First National Mortgage' },
    { id: 'SELL-0002', name: 'Pacific Coast Lending' },
    { id: 'SELL-0003', name: 'Heartland Home Finance' },
  ];

  it('should pass when seller exists', () => {
    const result = validateSellerReference('SELL-0001', existingSellers);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when seller does not exist', () => {
    const result = validateSellerReference('SELL-9999', existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when sellerId is empty string', () => {
    const result = validateSellerReference('', existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when sellerId is null', () => {
    const result = validateSellerReference(null, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when sellerId is undefined', () => {
    const result = validateSellerReference(undefined, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when existingSellers is not an array', () => {
    const result = validateSellerReference('SELL-0001', 'not an array');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should fail when existingSellers is null', () => {
    const result = validateSellerReference('SELL-0001', null);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should pass when existingSellers is empty array', () => {
    const result = validateSellerReference('SELL-0001', []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });
});

describe('validateFileUpload', () => {
  const createMockFile = (name, type, size) => ({
    name,
    type,
    size,
  });

  it('should pass a valid CSV file', () => {
    const file = createMockFile('test.csv', 'text/csv', 1024 * 1024);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass a valid JSON file', () => {
    const file = createMockFile('test.json', 'application/json', 1024 * 1024);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when file is null', () => {
    const result = validateFileUpload(null);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'file')).toBe(true);
  });

  it('should fail when file is undefined', () => {
    const result = validateFileUpload(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'file')).toBe(true);
  });

  it('should fail when file type is not allowed', () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1024 * 1024);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'file')).toBe(true);
  });

  it('should fail when file size exceeds maximum', () => {
    const file = createMockFile('test.csv', 'text/csv', 20 * 1024 * 1024);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'file')).toBe(true);
  });

  it('should fail when file is empty', () => {
    const file = createMockFile('test.csv', 'text/csv', 0);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'file')).toBe(true);
  });

  it('should respect custom maxSizeMB option', () => {
    const file = createMockFile('test.csv', 'text/csv', 6 * 1024 * 1024);
    const result = validateFileUpload(file, { maxSizeMB: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'file')).toBe(true);
  });

  it('should respect custom allowedTypes option', () => {
    const file = createMockFile('test.xml', 'application/xml', 1024 * 1024);
    const result = validateFileUpload(file, { allowedTypes: ['application/xml'] });
    expect(result.valid).toBe(true);
  });

  it('should pass when file size is at maximum', () => {
    const file = createMockFile('test.csv', 'text/csv', 10 * 1024 * 1024);
    const result = validateFileUpload(file);
    expect(result.valid).toBe(true);
  });
});

describe('validateSamplingConfig', () => {
  const validConfig = {
    name: 'Test Sampling Config',
    methodology: 'random',
    sampleRate: 10,
    filters: {},
    isActive: true,
  };

  it('should pass a valid random sampling config', () => {
    const result = validateSamplingConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when config is null', () => {
    const result = validateSamplingConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('config');
  });

  it('should fail when config is not an object', () => {
    const result = validateSamplingConfig('invalid');
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('config');
  });

  it('should fail when name is missing', () => {
    const config = { ...validConfig };
    delete config.name;
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('should fail when name is empty', () => {
    const config = { ...validConfig, name: '' };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('should fail when methodology is missing', () => {
    const config = { ...validConfig };
    delete config.methodology;
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'methodology')).toBe(true);
  });

  it('should fail when methodology is invalid', () => {
    const config = { ...validConfig, methodology: 'invalid' };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'methodology')).toBe(true);
  });

  it('should pass for all valid methodologies', () => {
    const validMethodologies = ['random', 'risk_based', 'targeted', 'threshold'];
    for (const methodology of validMethodologies) {
      const config = { ...validConfig, methodology };
      const result = validateSamplingConfig(config);
      expect(result.valid).toBe(true);
    }
  });

  it('should fail when sampleRate is missing', () => {
    const config = { ...validConfig };
    delete config.sampleRate;
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sampleRate')).toBe(true);
  });

  it('should fail when sampleRate is not a number', () => {
    const config = { ...validConfig, sampleRate: 'ten' };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sampleRate')).toBe(true);
  });

  it('should fail when sampleRate is below 0', () => {
    const config = { ...validConfig, sampleRate: -5 };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sampleRate')).toBe(true);
  });

  it('should fail when sampleRate is above 100', () => {
    const config = { ...validConfig, sampleRate: 150 };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sampleRate')).toBe(true);
  });

  it('should pass when sampleRate is 0', () => {
    const config = { ...validConfig, sampleRate: 0 };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(true);
  });

  it('should pass when sampleRate is 100', () => {
    const config = { ...validConfig, sampleRate: 100 };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(true);
  });

  it('should fail risk_based config without riskCriteria', () => {
    const config = { ...validConfig, methodology: 'risk_based', riskCriteria: [] };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'riskCriteria')).toBe(true);
  });

  it('should pass risk_based config with valid riskCriteria', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'lt', value: 620, weight: 10 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(true);
  });

  it('should fail risk_based config with missing criterion field', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { operator: 'lt', value: 620, weight: 10 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('field'))).toBe(true);
  });

  it('should fail risk_based config with missing criterion operator', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', value: 620, weight: 10 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('operator'))).toBe(true);
  });

  it('should fail risk_based config with invalid criterion operator', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'invalid', value: 620, weight: 10 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('operator'))).toBe(true);
  });

  it('should fail risk_based config with missing criterion value', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'lt', weight: 10 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('value'))).toBe(true);
  });

  it('should fail risk_based config with missing criterion weight', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'lt', value: 620 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('weight'))).toBe(true);
  });

  it('should fail risk_based config with non-number weight', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'lt', value: 620, weight: 'heavy' },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('weight'))).toBe(true);
  });

  it('should fail risk_based config with zero weight', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'lt', value: 620, weight: 0 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('weight'))).toBe(true);
  });

  it('should fail risk_based config with negative weight', () => {
    const config = {
      ...validConfig,
      methodology: 'risk_based',
      riskCriteria: [
        { field: 'creditScore', operator: 'lt', value: 620, weight: -5 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('riskCriteria') && e.field.includes('weight'))).toBe(true);
  });

  it('should fail threshold config without thresholdRules', () => {
    const config = { ...validConfig, methodology: 'threshold', thresholdRules: [] };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'thresholdRules')).toBe(true);
  });

  it('should pass threshold config with valid thresholdRules', () => {
    const config = {
      ...validConfig,
      methodology: 'threshold',
      thresholdRules: [
        { field: 'creditScore', operator: 'lt', value: 620 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(true);
  });

  it('should fail threshold config with missing rule field', () => {
    const config = {
      ...validConfig,
      methodology: 'threshold',
      thresholdRules: [
        { operator: 'lt', value: 620 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('thresholdRules') && e.field.includes('field'))).toBe(true);
  });

  it('should fail threshold config with missing rule operator', () => {
    const config = {
      ...validConfig,
      methodology: 'threshold',
      thresholdRules: [
        { field: 'creditScore', value: 620 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('thresholdRules') && e.field.includes('operator'))).toBe(true);
  });

  it('should fail threshold config with invalid rule operator', () => {
    const config = {
      ...validConfig,
      methodology: 'threshold',
      thresholdRules: [
        { field: 'creditScore', operator: 'invalid', value: 620 },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('thresholdRules') && e.field.includes('operator'))).toBe(true);
  });

  it('should fail threshold config with missing rule value', () => {
    const config = {
      ...validConfig,
      methodology: 'threshold',
      thresholdRules: [
        { field: 'creditScore', operator: 'lt' },
      ],
    };
    const result = validateSamplingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field && e.field.includes('thresholdRules') && e.field.includes('value'))).toBe(true);
  });
});

describe('validateRequiredFields', () => {
  const schema = [
    { field: 'name', label: 'Name', required: true },
    { field: 'email', label: 'Email', required: true },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'notes', label: 'Notes', required: false },
  ];

  it('should pass when all required fields are present', () => {
    const data = { name: 'John', email: 'john@example.com' };
    const result = validateRequiredFields(data, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when a required field is missing', () => {
    const data = { name: 'John' };
    const result = validateRequiredFields(data, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('should fail when a required field is empty', () => {
    const data = { name: '', email: 'john@example.com' };
    const result = validateRequiredFields(data, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('should pass when optional fields are missing', () => {
    const data = { name: 'John', email: 'john@example.com' };
    const result = validateRequiredFields(data, schema);
    expect(result.valid).toBe(true);
  });

  it('should fail when data is null', () => {
    const result = validateRequiredFields(null, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('data');
  });

  it('should fail when data is not an object', () => {
    const result = validateRequiredFields('invalid', schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('data');
  });

  it('should return multiple errors for multiple missing required fields', () => {
    const data = {};
    const result = validateRequiredFields(data, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

describe('validateLoan', () => {
  const existingSellers = [
    { id: 'SELL-0001', name: 'First National Mortgage' },
    { id: 'SELL-0002', name: 'Pacific Coast Lending' },
  ];

  const validLoan = {
    borrowerName: 'Jane Doe',
    ssn: '123-45-6789',
    propertyAddress: '123 Main St, Springfield, IL 62701',
    loanAmount: 250000,
    productType: 'conventional',
    channel: 'retail',
    sellerId: 'SELL-0001',
  };

  it('should pass a completely valid loan with existing seller', () => {
    const result = validateLoan(validLoan, existingSellers);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when schema validation fails', () => {
    const loan = { ...validLoan };
    delete loan.borrowerName;
    const result = validateLoan(loan, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerName')).toBe(true);
  });

  it('should fail when dependency rules fail', () => {
    const loan = { ...validLoan, productType: 'FHA', ltv: 100 };
    const result = validateLoan(loan, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ltv')).toBe(true);
  });

  it('should fail when seller reference fails', () => {
    const loan = { ...validLoan, sellerId: 'SELL-9999' };
    const result = validateLoan(loan, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(true);
  });

  it('should skip dependency and seller checks when schema fails', () => {
    const loan = { ...validLoan };
    delete loan.borrowerName;
    loan.sellerId = 'SELL-9999';
    const result = validateLoan(loan, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'borrowerName')).toBe(true);
    expect(result.errors.some((e) => e.field === 'sellerId')).toBe(false);
  });

  it('should return all errors from all validation layers', () => {
    const loan = {
      ...validLoan,
      productType: 'FHA',
      ltv: 100,
      loanPurpose: 'cash-out',
    };
    const result = validateLoan(loan, existingSellers);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});