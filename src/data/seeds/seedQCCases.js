import { addDays, subDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} ChecklistItem
 * @property {string} id
 * @property {string} templateItemId
 * @property {string} category
 * @property {string} question
 * @property {string|null} response
 * @property {string|null} notes
 * @property {boolean} evidenceAttached
 */

/**
 * @typedef {Object} ReviewFindings
 * @property {string} overallResult
 * @property {string} notes
 * @property {string} completedAt
 */

/**
 * @typedef {Object} QCCase
 * @property {string} id
 * @property {string} loanId
 * @property {string|null} reviewerId
 * @property {string} methodology
 * @property {string} priority
 * @property {string} status
 * @property {ChecklistItem[]} checklist
 * @property {ReviewFindings|null} findings
 * @property {string} dueDate
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} completedAt
 */

const METHODOLOGIES = ['random', 'risk_based', 'targeted', 'threshold'];
const PRIORITIES = ['high', 'medium', 'low'];
const STATUSES = ['pending', 'in_review', 'completed', 'escalated'];

const REVIEWER_NAMES = [
  'Alice Morgan',
  'Brian Torres',
  'Catherine Wells',
  'David Park',
  'Elena Vasquez',
  'Frank Osei',
  'Grace Nakamura',
  'Henry Patel',
  'Iris Johansson',
  'James Okonkwo',
];

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
    'Are all pay stubs present and consistent with the application?',
    'Is the most recent pay stub dated within 30 days of application?',
    'Are W-2 forms provided for the last two years?',
    'Are tax returns provided for self-employed borrowers?',
    'Is year-to-date income consistent with stated annual income?',
  ],
  'Asset Verification': [
    'Are bank statements provided for the last two months?',
    'Are all pages of each bank statement included?',
    'Are large deposits (>50% of monthly income) sourced and documented?',
    'Is the earnest money deposit documented?',
    'Are gift funds properly documented with a gift letter?',
  ],
  'Credit Review': [
    'Is the credit report dated within 90 days of application?',
    'Are all credit inquiries addressed with letters of explanation?',
    'Are any disputed accounts resolved or documented?',
    'Is the credit score consistent across all three bureaus?',
    'Are any public records (bankruptcies, foreclosures) within allowable timeframes?',
  ],
  'Appraisal Review': [
    'Is the appraisal dated within 120 days of closing?',
    'Are comparable sales within 1 mile of subject property?',
    'Are comparable sales dated within 6 months of appraisal?',
    'Are any adjustments to comparables reasonable and supported?',
    'Is the appraised value sufficient for the requested LTV?',
  ],
  'Title Review': [
    'Is the title commitment dated within 90 days of closing?',
    'Are all liens and encumbrances addressed?',
    'Is the vesting correct per the sales contract?',
    'Are property taxes current?',
    'Are any easements or restrictions acceptable per guidelines?',
  ],
  'Insurance Verification': [
    'Is hazard insurance coverage equal to the replacement cost?',
    'Is flood insurance required and obtained if in a flood zone?',
    'Is mortgage insurance (PMI/MIP) properly calculated?',
    'Is the insurance deductible within allowable limits?',
    'Are all insurance policies active and paid?',
  ],
  'Employment Verification': [
    'Is employment verified within 10 days of closing?',
    'Is the employment history consistent with the application?',
    'Are any employment gaps (>30 days) explained?',
    'Is the probability of continued employment acceptable?',
    'Is the employer contact information valid and verified?',
  ],
  'Identity Verification': [
    'Is a valid government-issued photo ID provided?',
    'Does the name on ID match the application exactly?',
    'Is the SSN verified through SSA or equivalent?',
    'Is the date of birth consistent across all documents?',
    'Are any OFAC or watchlist matches resolved?',
  ],
  'Property Eligibility': [
    'Is the property type eligible for the loan product?',
    'Is the property in an eligible geographic area?',
    'Are any HOA fees within allowable limits?',
    'Is the property condition acceptable per guidelines?',
    'Are any environmental hazards disclosed and acceptable?',
  ],
  'Compliance Check': [
    'Is the Loan Estimate provided within 3 days of application?',
    'Is the Closing Disclosure provided at least 3 days before closing?',
    'Are all required disclosures signed and dated?',
    'Is the loan within QM/ATR requirements?',
    'Are any high-cost or HPML triggers properly addressed?',
  ],
};

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
 * Picks a random element from an array using the seeded RNG.
 * @param {Array} arr
 * @returns {*}
 */
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

/**
 * Generates a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

/**
 * Generates a random float between min and max, rounded to the specified decimals.
 * @param {number} min
 * @param {number} max
 * @param {number} [decimals=2]
 * @returns {number}
 */
const randFloat = (min, max, decimals = 2) => {
  const value = rng() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Generates a checklist for a QC case.
 * Selects 3-5 random categories and picks 1-2 questions from each.
 * @param {string} caseId
 * @returns {ChecklistItem[]}
 */
const generateChecklist = (caseId) => {
  const numCategories = randInt(3, 5);
  const shuffledCategories = [...CHECKLIST_CATEGORIES].sort(() => rng() - 0.5);
  const selectedCategories = shuffledCategories.slice(0, numCategories);

  const items = [];
  let itemIndex = 1;

  for (const category of selectedCategories) {
    const questions = CHECKLIST_QUESTIONS[category];
    const numQuestions = randInt(1, Math.min(2, questions.length));
    const shuffledQuestions = [...questions].sort(() => rng() - 0.5);
    const selectedQuestions = shuffledQuestions.slice(0, numQuestions);

    for (const question of selectedQuestions) {
      items.push({
        id: `CLI-${String(itemIndex).padStart(4, '0')}`,
        templateItemId: `TMPL-ITEM-${String(randInt(1, 50)).padStart(3, '0')}`,
        category,
        question,
        response: null,
        notes: null,
        evidenceAttached: false,
      });
      itemIndex++;
    }
  }

  return items;
};

/**
 * Generates review findings for a completed QC case.
 * @param {string} completedAt
 * @returns {ReviewFindings}
 */
const generateFindings = (completedAt) => {
  const overallResults = ['pass', 'pass', 'pass', 'pass', 'pass', 'fail', 'fail', 'conditional_pass'];
  const overallResult = pick(overallResults);

  const notesOptions = [
    'All checklist items reviewed. No significant issues found.',
    'Minor documentation gaps identified but within acceptable thresholds.',
    'Income verification discrepancies noted. Seller contacted for clarification.',
    'Appraisal comparable sales outside acceptable range. Further review required.',
    'Credit report shows disputed accounts. Borrower provided satisfactory explanation.',
    'Title issues identified and resolved prior to closing.',
    'Multiple documentation deficiencies identified. Case escalated for further action.',
    'Review completed with findings. Defects logged for seller remediation.',
    'All required documentation verified. Loan meets eligibility criteria.',
    'Conditional approval granted pending additional documentation from seller.',
  ];

  return {
    overallResult,
    notes: pick(notesOptions),
    completedAt,
  };
};

/**
 * Determines the status distribution for QC cases.
 * Ensures a realistic mix of pending, in_review, completed, and escalated cases.
 * @param {number} index
 * @returns {string}
 */
const determineStatus = (index) => {
  if (index < 15) return 'completed';
  if (index < 25) return 'completed';
  if (index < 55) return 'in_review';
  if (index < 65) return 'in_review';
  if (index < 75) return 'pending';
  if (index < 85) return 'pending';
  if (index < 92) return 'completed';
  if (index < 97) return 'escalated';
  return 'pending';
};

/**
 * Determines the priority based on status and randomness.
 * Escalated cases are always high priority.
 * @param {string} status
 * @returns {string}
 */
const determinePriority = (status) => {
  if (status === 'escalated') return 'high';
  if (status === 'completed') {
    const roll = rng();
    if (roll < 0.3) return 'high';
    if (roll < 0.7) return 'medium';
    return 'low';
  }
  const roll = rng();
  if (roll < 0.25) return 'high';
  if (roll < 0.65) return 'medium';
  return 'low';
};

/**
 * Generates a single mock QC case record.
 * @param {number} index - The case index (0-based).
 * @param {string[]} loanIds - Array of available loan IDs to reference.
 * @returns {QCCase}
 */
const generateQCCase = (index, loanIds) => {
  const id = `QC-${String(index + 1).padStart(4, '0')}`;
  const loanId = loanIds[index % loanIds.length];
  const methodology = pick(METHODOLOGIES);
  const status = determineStatus(index);
  const priority = determinePriority(status);

  const reviewerId = status === 'pending'
    ? null
    : pick(REVIEWER_NAMES);

  const daysAgo = randInt(0, 120);
  const createdAt = subDays(REFERENCE_DATE, daysAgo);

  const dueDateDays = priority === 'high' ? randInt(1, 3) : priority === 'medium' ? randInt(4, 7) : randInt(8, 14);
  const dueDate = addDays(createdAt, dueDateDays);

  const updatedDaysAgo = randInt(0, Math.max(daysAgo, 1));
  const updatedAt = subDays(REFERENCE_DATE, updatedDaysAgo);

  let completedAt = null;
  let findings = null;
  let checklist = generateChecklist(id);

  if (status === 'completed') {
    const completedDaysAgo = randInt(0, Math.max(updatedDaysAgo, 1));
    completedAt = subDays(REFERENCE_DATE, completedDaysAgo).toISOString();
    findings = generateFindings(completedAt);

    checklist = checklist.map((item) => {
      const responseRoll = rng();
      let response = 'pass';
      if (responseRoll < 0.15) response = 'fail';
      else if (responseRoll < 0.25) response = 'na';

      const hasNotes = rng() > 0.6;
      const hasEvidence = rng() > 0.7;

      return {
        ...item,
        response,
        notes: hasNotes ? 'Reviewed and verified during QC review.' : null,
        evidenceAttached: hasEvidence,
      };
    });
  } else if (status === 'in_review') {
    checklist = checklist.map((item) => {
      const hasResponse = rng() > 0.4;
      if (!hasResponse) return item;

      const responseRoll = rng();
      let response = 'pass';
      if (responseRoll < 0.1) response = 'fail';
      else if (responseRoll < 0.2) response = 'na';

      const hasNotes = rng() > 0.5;

      return {
        ...item,
        response,
        notes: hasNotes ? 'Preliminary review notes.' : null,
        evidenceAttached: false,
      };
    });
  }

  return {
    id,
    loanId,
    reviewerId,
    methodology,
    priority,
    status,
    checklist,
    findings,
    dueDate: format(dueDate, 'yyyy-MM-dd'),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    completedAt,
  };
};

/**
 * Generates the full array of mock QC case records.
 * Produces exactly 100 QC cases with deterministic pseudo-random data.
 * @param {string[]} loanIds - Array of loan IDs to reference (from seedLoans).
 * @returns {QCCase[]}
 */
export const seedQCCases = (loanIds) => {
  if (!Array.isArray(loanIds) || loanIds.length === 0) {
    console.warn('seedQCCases: No loan IDs provided, generating without loan references.');
    const fallbackLoanIds = Array.from({ length: 50 }, (_, i) => `LOAN-${String(i + 1).padStart(4, '0')}`);
    return Array.from({ length: 100 }, (_, i) => generateQCCase(i, fallbackLoanIds));
  }

  const cases = [];

  for (let i = 0; i < 100; i++) {
    cases.push(generateQCCase(i, loanIds));
  }

  return cases;
};

export default seedQCCases;