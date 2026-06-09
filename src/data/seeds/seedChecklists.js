import { subDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} ChecklistTemplateItem
 * @property {string} id
 * @property {string} category
 * @property {string} question
 * @property {boolean} required
 * @property {number} order
 */

/**
 * @typedef {Object} ChecklistTemplate
 * @property {string} id
 * @property {string} name
 * @property {string[]} productTypes
 * @property {string} workflowPhase
 * @property {ChecklistTemplateItem[]} items
 * @property {boolean} isActive
 * @property {number} version
 * @property {string} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const CHECKLIST_CATEGORIES = [
  'Income Verification',
  'Asset Verification',
  'Credit Review',
  'Appraisal Review',
  'Title Review',
  'Insurance Verification',
  'Employment Verification',
  'Identity Verification',
  'Property Eligibility',
  'Compliance Check',
];

const CHECKLIST_QUESTIONS = {
  'Income Verification': [
    { question: 'Are all pay stubs present and consistent with the application?', required: true },
    { question: 'Is the most recent pay stub dated within 30 days of application?', required: true },
    { question: 'Are W-2 forms provided for the last two years?', required: true },
    { question: 'Are tax returns provided for self-employed borrowers?', required: false },
    { question: 'Is year-to-date income consistent with stated annual income?', required: true },
    { question: 'Are any gaps in employment history explained and documented?', required: false },
    { question: 'Is the employer contact information valid and verified?', required: true },
  ],
  'Asset Verification': [
    { question: 'Are bank statements provided for the last two months?', required: true },
    { question: 'Are all pages of each bank statement included?', required: true },
    { question: 'Are large deposits (>50% of monthly income) sourced and documented?', required: true },
    { question: 'Is the earnest money deposit documented?', required: true },
    { question: 'Are gift funds properly documented with a gift letter?', required: false },
    { question: 'Do asset statements match the account information on the application?', required: true },
    { question: 'Are any business asset statements included if self-employed?', required: false },
  ],
  'Credit Review': [
    { question: 'Is the credit report dated within 90 days of application?', required: true },
    { question: 'Are all credit inquiries addressed with letters of explanation?', required: true },
    { question: 'Are any disputed accounts resolved or documented?', required: true },
    { question: 'Is the credit score consistent across all three bureaus?', required: false },
    { question: 'Are any public records (bankruptcies, foreclosures) within allowable timeframes?', required: true },
    { question: 'Is the credit report a tri-merge report from an approved vendor?', required: true },
  ],
  'Appraisal Review': [
    { question: 'Is the appraisal dated within 120 days of closing?', required: true },
    { question: 'Are comparable sales within 1 mile of subject property?', required: true },
    { question: 'Are comparable sales dated within 6 months of appraisal?', required: true },
    { question: 'Are any adjustments to comparables reasonable and supported?', required: true },
    { question: 'Is the appraised value sufficient for the requested LTV?', required: true },
    { question: 'Is the appraiser licensed and in good standing?', required: true },
    { question: 'Are any required repairs noted and addressed?', required: false },
  ],
  'Title Review': [
    { question: 'Is the title commitment dated within 90 days of closing?', required: true },
    { question: 'Are all liens and encumbrances addressed?', required: true },
    { question: 'Is the vesting correct per the sales contract?', required: true },
    { question: 'Are property taxes current?', required: true },
    { question: 'Are any easements or restrictions acceptable per guidelines?', required: true },
    { question: 'Is the legal description accurate and complete?', required: true },
  ],
  'Insurance Verification': [
    { question: 'Is hazard insurance coverage equal to the replacement cost?', required: true },
    { question: 'Is flood insurance required and obtained if in a flood zone?', required: true },
    { question: 'Is mortgage insurance (PMI/MIP) properly calculated?', required: false },
    { question: 'Is the insurance deductible within allowable limits?', required: true },
    { question: 'Are all insurance policies active and paid?', required: true },
    { question: 'Is the mortgagee clause correct on all policies?', required: true },
  ],
  'Employment Verification': [
    { question: 'Is employment verified within 10 days of closing?', required: true },
    { question: 'Is the employment history consistent with the application?', required: true },
    { question: 'Are any employment gaps (>30 days) explained?', required: true },
    { question: 'Is the probability of continued employment acceptable?', required: false },
    { question: 'Is the employer contact information valid and verified?', required: true },
    { question: 'For self-employed borrowers, is business existence verified?', required: false },
  ],
  'Identity Verification': [
    { question: 'Is a valid government-issued photo ID provided?', required: true },
    { question: 'Does the name on ID match the application exactly?', required: true },
    { question: 'Is the SSN verified through SSA or equivalent?', required: true },
    { question: 'Is the date of birth consistent across all documents?', required: true },
    { question: 'Are any OFAC or watchlist matches resolved?', required: true },
    { question: 'Is the borrower\'s citizenship or residency status documented?', required: false },
  ],
  'Property Eligibility': [
    { question: 'Is the property type eligible for the loan product?', required: true },
    { question: 'Is the property in an eligible geographic area?', required: true },
    { question: 'Are any HOA fees within allowable limits?', required: false },
    { question: 'Is the property condition acceptable per guidelines?', required: true },
    { question: 'Are any environmental hazards disclosed and acceptable?', required: true },
    { question: 'Is the property a primary residence, second home, or investment property as stated?', required: true },
  ],
  'Compliance Check': [
    { question: 'Is the Loan Estimate provided within 3 days of application?', required: true },
    { question: 'Is the Closing Disclosure provided at least 3 days before closing?', required: true },
    { question: 'Are all required disclosures signed and dated?', required: true },
    { question: 'Is the loan within QM/ATR requirements?', required: true },
    { question: 'Are any high-cost or HPML triggers properly addressed?', required: true },
    { question: 'Are state-specific disclosures provided where applicable?', required: false },
    { question: 'Is the right of rescission period observed for refinances?', required: false },
  ],
};

const TEMPLATE_DEFINITIONS = [
  {
    id: 'TMPL-0001',
    name: 'Standard Pre-Closing QC — Conventional',
    productTypes: ['conventional'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
      'Compliance Check',
    ],
    isActive: true,
    version: 2,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0002',
    name: 'Standard Pre-Closing QC — FHA',
    productTypes: ['FHA'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0003',
    name: 'Standard Pre-Closing QC — VA',
    productTypes: ['VA'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0004',
    name: 'Standard Pre-Closing QC — Jumbo',
    productTypes: ['jumbo'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0005',
    name: 'Standard Pre-Closing QC — USDA',
    productTypes: ['USDA'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0006',
    name: 'Post-Closing QC — All Products',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    workflowPhase: 'post_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0007',
    name: 'Servicing Transfer QC',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    workflowPhase: 'servicing',
    categories: [
      'Title Review',
      'Insurance Verification',
      'Compliance Check',
      'Property Eligibility',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0008',
    name: 'High-Risk Targeted Review',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Identity Verification',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Counterparty Risk Manager',
  },
  {
    id: 'TMPL-0009',
    name: 'Correspondent Channel Enhanced Review',
    productTypes: ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
      'Compliance Check',
    ],
    isActive: true,
    version: 1,
    createdBy: 'Operations Leader',
  },
  {
    id: 'TMPL-0010',
    name: 'Legacy Pre-Closing QC — Conventional (Archived)',
    productTypes: ['conventional'],
    workflowPhase: 'pre_closing',
    categories: [
      'Income Verification',
      'Asset Verification',
      'Credit Review',
      'Appraisal Review',
      'Title Review',
      'Insurance Verification',
      'Employment Verification',
      'Identity Verification',
      'Property Eligibility',
    ],
    isActive: false,
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
 * Generates the checklist items for a template based on its category list.
 * @param {string} templateId
 * @param {string[]} categories
 * @returns {ChecklistTemplateItem[]}
 */
const generateItems = (templateId, categories) => {
  const items = [];
  let globalOrder = 1;

  for (const category of categories) {
    const questions = CHECKLIST_QUESTIONS[category];

    if (!questions || questions.length === 0) {
      continue;
    }

    const selectedQuestions = [...questions];

    for (const q of selectedQuestions) {
      items.push({
        id: `TMPL-ITEM-${String(randInt(1, 9999)).padStart(3, '0')}`,
        category,
        question: q.question,
        required: q.required,
        order: globalOrder,
      });
      globalOrder++;
    }
  }

  return items;
};

/**
 * Generates a single mock checklist template record.
 * @param {Object} templateDef - The template definition.
 * @returns {ChecklistTemplate}
 */
const generateTemplate = (templateDef) => {
  const items = generateItems(templateDef.id, templateDef.categories);

  const daysAgo = templateDef.isActive ? randInt(30, 365) : randInt(366, 540);
  const createdAt = subDays(REFERENCE_DATE, daysAgo);
  const updatedDaysAgo = randInt(0, Math.max(daysAgo, 1));
  const updatedAt = subDays(REFERENCE_DATE, updatedDaysAgo);

  return {
    id: templateDef.id,
    name: templateDef.name,
    productTypes: templateDef.productTypes,
    workflowPhase: templateDef.workflowPhase,
    items,
    isActive: templateDef.isActive,
    version: templateDef.version,
    createdBy: templateDef.createdBy,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

/**
 * Generates the full array of mock checklist template records.
 * Produces 10 templates (9 active, 1 archived) with deterministic data.
 * @returns {ChecklistTemplate[]}
 */
export const seedChecklists = () => {
  const templates = [];

  for (const templateDef of TEMPLATE_DEFINITIONS) {
    templates.push(generateTemplate(templateDef));
  }

  return templates;
};

export default seedChecklists;