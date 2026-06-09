import { subDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} RuleCondition
 * @property {string} field
 * @property {string} operator
 * @property {*} value
 * @property {string} message
 */

/**
 * @typedef {Object} EligibilityRule
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} productTypes
 * @property {string[]} channels
 * @property {string[]|null} sellerIds
 * @property {string} ruleType
 * @property {RuleCondition[]} conditions
 * @property {number} weight
 * @property {string} effectiveDate
 * @property {string|null} expirationDate
 * @property {string} status
 * @property {number} version
 * @property {string} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} RuleVersion
 * @property {string} id
 * @property {string} ruleId
 * @property {number} version
 * @property {EligibilityRule} snapshot
 * @property {string} changedBy
 * @property {string} changedAt
 * @property {string} changeReason
 */

const RULE_DEFINITIONS = [
  {
    id: 'RULE-0001',
    name: 'Minimum Credit Score — Conventional',
    description: 'Conventional loans require a minimum credit score of 620.',
    productTypes: ['conventional'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 620,
        message: 'Credit score {actual} is below the minimum of 620 required for conventional loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 2,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0002',
    name: 'Minimum Credit Score — FHA',
    description: 'FHA loans require a minimum credit score of 580.',
    productTypes: ['FHA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 580,
        message: 'Credit score {actual} is below the minimum of 580 required for FHA loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0003',
    name: 'Minimum Credit Score — VA',
    description: 'VA loans require a minimum credit score of 620.',
    productTypes: ['VA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 620,
        message: 'Credit score {actual} is below the minimum of 620 required for VA loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0004',
    name: 'Minimum Credit Score — USDA',
    description: 'USDA loans require a minimum credit score of 640.',
    productTypes: ['USDA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 640,
        message: 'Credit score {actual} is below the minimum of 640 required for USDA loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0005',
    name: 'Maximum LTV — Conventional',
    description: 'Conventional loans must not exceed 97% LTV.',
    productTypes: ['conventional'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'ltv',
        operator: 'gt',
        value: 97,
        message: 'LTV of {actual}% exceeds the maximum of 97% for conventional loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0006',
    name: 'Maximum LTV — FHA',
    description: 'FHA loans must not exceed 96.5% LTV.',
    productTypes: ['FHA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'ltv',
        operator: 'gt',
        value: 96.5,
        message: 'LTV of {actual}% exceeds the maximum of 96.5% for FHA loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0007',
    name: 'Maximum LTV — VA',
    description: 'VA loans must not exceed 100% LTV.',
    productTypes: ['VA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'ltv',
        operator: 'gt',
        value: 100,
        message: 'LTV of {actual}% exceeds the maximum of 100% for VA loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0008',
    name: 'Maximum DTI — All Products',
    description: 'Debt-to-income ratio should not exceed 43% for any product type. Weighted score rule.',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'weighted_score',
    conditions: [
      {
        field: 'dti',
        operator: 'lte',
        value: 43,
        message: 'DTI of {actual}% is within the acceptable threshold of 43%.',
      },
    ],
    weight: 30,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0009',
    name: 'Minimum Loan Amount',
    description: 'Loan amount should be at least $50,000. Weighted score rule.',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'weighted_score',
    conditions: [
      {
        field: 'loanAmount',
        operator: 'gte',
        value: 50000,
        message: 'Loan amount of ${actual} meets the minimum threshold of $50,000.',
      },
    ],
    weight: 10,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0010',
    name: 'Jumbo Loan Limit Check',
    description: 'Loans exceeding $726,200 must be classified as jumbo, not conventional.',
    productTypes: ['conventional'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'loanAmount',
        operator: 'gt',
        value: 726200,
        message:
          'Loan amount of ${actual} exceeds the conforming limit of $726,200. Must be classified as jumbo.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0011',
    name: 'High-Cost Area LTV Adjustment',
    description:
      'Loans over $500,000 with LTV above 80% in high-cost areas require additional scrutiny. Weighted score rule.',
    productTypes: ['conventional', 'FHA', 'VA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'weighted_score',
    conditions: [
      {
        field: 'ltv',
        operator: 'lte',
        value: 80,
        message: 'LTV of {actual}% is within standard limits for high-balance loans.',
      },
    ],
    weight: 20,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0012',
    name: 'Credit Score Floor — Jumbo',
    description: 'Jumbo loans require a minimum credit score of 700.',
    productTypes: ['jumbo'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 700,
        message: 'Credit score {actual} is below the minimum of 700 required for jumbo loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0013',
    name: 'Maximum LTV — Jumbo',
    description: 'Jumbo loans must not exceed 80% LTV.',
    productTypes: ['jumbo'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'ltv',
        operator: 'gt',
        value: 80,
        message: 'LTV of {actual}% exceeds the maximum of 80% for jumbo loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0014',
    name: 'Cash-Out Refinance LTV Limit',
    description: 'Cash-out refinance loans must not exceed 80% LTV.',
    productTypes: ['conventional', 'FHA', 'VA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'ltv',
        operator: 'gt',
        value: 80,
        message: 'LTV of {actual}% exceeds the maximum of 80% for cash-out refinance loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0015',
    name: 'USDA Income Limit',
    description: 'USDA loans have income limits. Borrower income should not exceed $110,000.',
    productTypes: ['USDA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'borrowerIncome',
        operator: 'gt',
        value: 110000,
        message:
          'Borrower income of ${actual} exceeds the USDA income limit of $110,000.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0016',
    name: 'Watchlist Seller — Enhanced Scrutiny',
    description:
      'Loans from watchlisted sellers require additional weighted scrutiny on credit score and LTV.',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: ['SELL-0008', 'SELL-0009'],
    ruleType: 'weighted_score',
    conditions: [
      {
        field: 'creditScore',
        operator: 'gte',
        value: 680,
        message: 'Credit score of {actual} meets enhanced scrutiny threshold for watchlisted seller.',
      },
    ],
    weight: 25,
    effectiveDate: '2025-11-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Counterparty Risk Manager',
  },
  {
    id: 'RULE-0017',
    name: 'Suspended Seller — Automatic Fail',
    description: 'Loans from suspended sellers are automatically failed.',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: ['SELL-0012'],
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'sellerId',
        operator: 'in',
        value: ['SELL-0012'],
        message: 'Seller SELL-0012 is currently suspended. Loan cannot be processed.',
      },
    ],
    weight: 0,
    effectiveDate: '2026-03-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Counterparty Risk Manager',
  },
  {
    id: 'RULE-0018',
    name: 'Correspondent Channel — Additional Documentation',
    description:
      'Correspondent channel loans require additional documentation verification. Weighted score rule.',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    channels: ['correspondent'],
    sellerIds: null,
    ruleType: 'weighted_score',
    conditions: [
      {
        field: 'channel',
        operator: 'neq',
        value: 'correspondent',
        message: 'Non-correspondent channel — standard documentation requirements apply.',
      },
    ],
    weight: 15,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0019',
    name: 'Broker Channel — Enhanced Verification',
    description:
      'Broker channel loans require enhanced income and asset verification. Weighted score rule.',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    channels: ['broker'],
    sellerIds: null,
    ruleType: 'weighted_score',
    conditions: [
      {
        field: 'borrowerIncome',
        operator: 'gte',
        value: 1,
        message: 'Borrower income is documented for broker channel verification.',
      },
    ],
    weight: 15,
    effectiveDate: '2025-09-01',
    expirationDate: null,
    status: 'active',
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'RULE-0020',
    name: 'Archived — Legacy Minimum Credit Score',
    description:
      'Legacy rule: Conventional loans required minimum credit score of 600. Replaced by RULE-0001.',
    productTypes: ['conventional'],
    channels: ['retail', 'correspondent', 'broker', 'wholesale'],
    sellerIds: null,
    ruleType: 'hard_stop',
    conditions: [
      {
        field: 'creditScore',
        operator: 'lt',
        value: 600,
        message: 'Credit score {actual} is below the minimum of 600 required for conventional loans.',
      },
    ],
    weight: 0,
    effectiveDate: '2025-01-01',
    expirationDate: '2025-08-31',
    status: 'archived',
    version: 1,
    createdBy: 'Operations Leader',
  },
];

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Ensures deterministic output for the same seed value.
 * @param {number} seed
 * @returns {function(): number}
 */
const createRNG = (seed) => {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rng = createRNG(20260609);

/**
 * Generates a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

/**
 * Generates version history entries for a rule.
 * If the rule has version > 1, generates prior version snapshots.
 * @param {EligibilityRule} rule - The current rule definition.
 * @returns {RuleVersion[]}
 */
const generateVersionHistory = (rule) => {
  const versions = [];

  if (rule.version > 1) {
    for (let v = 1; v < rule.version; v++) {
      const versionDate = subDays(new Date(rule.effectiveDate), randInt(30, 180));

      const priorSnapshot = {
        ...rule,
        version: v,
        effectiveDate: format(versionDate, 'yyyy-MM-dd'),
        updatedAt: versionDate.toISOString(),
      };

      if (v === 1 && rule.id === 'RULE-0001') {
        priorSnapshot.conditions = [
          {
            field: 'creditScore',
            operator: 'lt',
            value: 600,
            message:
              'Credit score {actual} is below the minimum of 600 required for conventional loans.',
          },
        ];
        priorSnapshot.description =
          'Conventional loans require a minimum credit score of 600.';
        priorSnapshot.name = 'Minimum Credit Score — Conventional (Legacy)';
      }

      versions.push({
        id: `RVER-${String(randInt(1, 9999)).padStart(4, '0')}`,
        ruleId: rule.id,
        version: v,
        snapshot: priorSnapshot,
        changedBy: v === 1 ? rule.createdBy : 'Operations Leader',
        changedAt: versionDate.toISOString(),
        changeReason:
          v === 1
            ? 'Initial creation'
            : `Updated threshold from ${v === 1 ? '600' : 'previous value'} to current value.`,
      });
    }
  }

  versions.push({
    id: `RVER-${String(randInt(1, 9999)).padStart(4, '0')}`,
    ruleId: rule.id,
    version: rule.version,
    snapshot: { ...rule },
    changedBy: rule.version === 1 ? rule.createdBy : 'Operations Leader',
    changedAt: new Date(rule.effectiveDate).toISOString(),
    changeReason:
      rule.version === 1
        ? 'Initial creation'
        : `Updated to version ${rule.version} with revised thresholds.`,
  });

  return versions;
};

/**
 * Generates the full array of mock eligibility rules with version history.
 * Produces 20 rules (18 active, 1 archived) with deterministic data.
 * @returns {{ rules: EligibilityRule[], ruleVersions: RuleVersion[] }}
 */
export const seedRules = () => {
  const rules = [];
  const ruleVersions = [];

  for (const ruleDef of RULE_DEFINITIONS) {
    const effectiveDate = new Date(ruleDef.effectiveDate);
    const createdAt = subDays(effectiveDate, randInt(1, 14));
    const updatedAt = subDays(REFERENCE_DATE, randInt(0, 30));

    const rule = {
      ...ruleDef,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };

    rules.push(rule);

    const versions = generateVersionHistory(rule);
    ruleVersions.push(...versions);
  }

  return { rules, ruleVersions };
};

export default seedRules;