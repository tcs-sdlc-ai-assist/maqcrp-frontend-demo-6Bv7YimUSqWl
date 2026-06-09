import { subDays, addDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} CounterpartyResponse
 * @property {string|null} receivedAt
 * @property {string|null} responseType
 * @property {string|null} rationale
 * @property {number|null} proposedAmount
 */

/**
 * @typedef {Object} AlternativeProposal
 * @property {string|null} type
 * @property {string|null} terms
 * @property {number|null} amount
 * @property {string|null} status
 */

/**
 * @typedef {Object} FinalOutcome
 * @property {string|null} type
 * @property {number|null} settledAmount
 * @property {string|null} closedAt
 * @property {string|null} notes
 */

/**
 * @typedef {Object} RepurchaseCase
 * @property {string} id
 * @property {string[]} linkedDefectIds
 * @property {string} sellerId
 * @property {string} loanId
 * @property {number} demandAmount
 * @property {string} rationale
 * @property {Array<Object>} evidence
 * @property {string} status
 * @property {CounterpartyResponse} counterpartyResponse
 * @property {AlternativeProposal} alternativeProposal
 * @property {FinalOutcome} finalOutcome
 * @property {number} exposure
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const REPURCHASE_STATUSES = [
  'draft',
  'demand_issued',
  'demand_issued',
  'demand_issued',
  'counterparty_review',
  'counterparty_review',
  'negotiation',
  'negotiation',
  'accepted',
  'accepted',
  'disputed',
  'disputed',
  'alternative_accepted',
  'alternative_accepted',
  'closed',
  'closed',
  'closed',
  'closed',
  'closed',
  'closed',
  'demand_issued',
  'counterparty_review',
  'negotiation',
  'closed',
  'closed',
];

const RATIONALES = [
  'Multiple critical defects including occupancy misrepresentation and income fabrication identified during QC review.',
  'Appraisal overvaluation detected — comparable sales analysis shows 15% overstatement of property value.',
  'Undisclosed liens discovered during post-closing title review. Seller failed to resolve prior to sale.',
  'Borrower employment verification failed — stated employer has no record of borrower employment.',
  'Asset documentation fabricated — bank statements provided do not match issuing institution records.',
  'Credit report manipulation detected — unauthorized inquiries and altered tradelines identified.',
  'Property condition misrepresentation — inspection report conflicts with seller disclosures.',
  'Income documentation contains material discrepancies exceeding tolerance thresholds.',
  'Flood zone misclassification resulted in missing required flood insurance coverage.',
  'Title defects discovered post-closing including unresolved mechanic\'s lien and tax lien.',
  'Borrower identity verification failed — SSN mismatch and inconsistent identity documents.',
  'Loan file contains multiple critical defects across documentation, compliance, and identity categories.',
  'Seller pattern of defective loans identified — this is the 5th repurchase demand in 90 days.',
  'Regulatory compliance violation — loan does not meet QM/ATR requirements.',
  'Fraud indicators present — straw buyer pattern detected with multiple red flags.',
];

const COUNTERPARTY_RESPONSE_TYPES = ['accept', 'dispute', 'counter'];
const COUNTERPARTY_RATIONALE_ACCEPT = [
  'Seller acknowledges defects and agrees to repurchase. Processing buyback within 30 days.',
  'After internal review, seller accepts repurchase demand. Settlement being processed.',
  'Seller concurs with findings and will execute repurchase per agreement terms.',
];
const COUNTERPARTY_RATIONALE_DISPUTE = [
  'Seller disputes defect findings. Claims documentation was complete at time of sale.',
  'Seller contests severity classification. Requests re-review of defect taxonomy application.',
  'Seller asserts defects are immaterial and do not warrant repurchase. Requests mediation.',
];
const COUNTERPARTY_RATIONALE_COUNTER = [
  'Seller proposes indemnification agreement in lieu of full repurchase. Terms to follow.',
  'Seller offers partial repurchase of 50% of demand amount with indemnification for remainder.',
  'Seller proposes price adjustment of $15,000 in lieu of repurchase.',
];

const ALTERNATIVE_TYPES = ['indemnification', 'price_adjustment', 'partial_repurchase', 'other'];
const ALTERNATIVE_TERMS = [
  'Seller agrees to indemnify purchaser against all losses related to identified defects for a period of 36 months.',
  'Price adjustment of $25,000 applied to offset defect-related risk. Full release of repurchase obligation.',
  'Partial repurchase of 60% of loan balance with indemnification for remaining exposure.',
  'Seller to repurchase 40% participation interest with full release of remaining exposure.',
  'Indemnification agreement with $50,000 cap on claims related to identified defects.',
];

const FINAL_OUTCOME_TYPES = [
  'full_repurchase',
  'partial_repurchase',
  'indemnification',
  'price_adjustment',
  'withdrawn',
];

const FINAL_OUTCOME_NOTES = [
  'Full repurchase executed. Seller remitted $320,000 on settlement date.',
  'Partial repurchase of $180,000 completed. Remaining exposure released per agreement.',
  'Indemnification agreement executed with 36-month coverage period.',
  'Price adjustment of $25,000 applied. Case closed with mutual release.',
  'Repurchase demand withdrawn after seller provided additional documentation resolving defects.',
  'Settlement reached at 85% of demand amount. Case closed with prejudice.',
];

const SELLER_IDS = [
  'SELL-0001',
  'SELL-0002',
  'SELL-0003',
  'SELL-0004',
  'SELL-0005',
  'SELL-0006',
  'SELL-0007',
  'SELL-0008',
  'SELL-0009',
  'SELL-0010',
  'SELL-0011',
  'SELL-0012',
];

const LOAN_IDS = Array.from({ length: 50 }, (_, i) => `LOAN-${String(i + 1).padStart(4, '0')}`);

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
 * Generates mock evidence attachments for a repurchase case.
 * @param {string} caseId
 * @param {string} createdAt
 * @returns {Array<Object>}
 */
const generateEvidence = (caseId, createdAt) => {
  const hasEvidence = rng() > 0.2;

  if (!hasEvidence) {
    return [];
  }

  const evidenceCount = randInt(1, 4);
  const evidence = [];

  const fileTypes = [
    { ext: 'pdf', mime: 'application/pdf' },
    { ext: 'png', mime: 'image/png' },
    { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  ];

  const fileLabels = [
    'defect_report',
    'qc_findings',
    'appraisal_review',
    'title_report',
    'demand_letter',
    'supporting_evidence',
    'seller_correspondence',
    'loan_file_excerpt',
  ];

  for (let i = 0; i < evidenceCount; i++) {
    const fileType = pick(fileTypes);
    const label = pick(fileLabels);
    const uploadDaysAgo = randInt(0, 10);
    const uploadDate = subDays(new Date(createdAt), -uploadDaysAgo);

    evidence.push({
      id: `EVD-${String(randInt(1, 9999)).padStart(4, '0')}`,
      fileName: `${label}_${caseId.toLowerCase()}.${fileType.ext}`,
      fileType: fileType.mime,
      uploadDate: uploadDate.toISOString(),
      uploadedBy: 'Repurchase Specialist',
    });
  }

  return evidence;
};

/**
 * Generates linked defect IDs for a repurchase case.
 * @param {number} index
 * @returns {string[]}
 */
const generateLinkedDefectIds = (index) => {
  const defectCount = randInt(1, 4);
  const defectIds = [];

  for (let i = 0; i < defectCount; i++) {
    const defectNum = ((index * 3 + i * 7) % 60) + 1;
    defectIds.push(`DEF-${String(defectNum).padStart(4, '0')}`);
  }

  return [...new Set(defectIds)];
};

/**
 * Generates a counterparty response based on the case status.
 * @param {string} status
 * @param {string} createdAt
 * @param {number} demandAmount
 * @returns {CounterpartyResponse}
 */
const generateCounterpartyResponse = (status, createdAt, demandAmount) => {
  const needsResponse = [
    'counterparty_review',
    'negotiation',
    'accepted',
    'disputed',
    'alternative_accepted',
    'closed',
  ].includes(status);

  if (!needsResponse) {
    return {
      receivedAt: null,
      responseType: null,
      rationale: null,
      proposedAmount: null,
    };
  }

  const responseDaysAfter = randInt(3, 21);
  const receivedAt = addDays(new Date(createdAt), responseDaysAfter).toISOString();

  let responseType;
  let rationale;
  let proposedAmount = null;

  if (status === 'accepted' || (status === 'closed' && rng() > 0.5)) {
    responseType = 'accept';
    rationale = pick(COUNTERPARTY_RATIONALE_ACCEPT);
  } else if (status === 'disputed') {
    responseType = 'dispute';
    rationale = pick(COUNTERPARTY_RATIONALE_DISPUTE);
  } else if (status === 'negotiation' || status === 'alternative_accepted') {
    responseType = 'counter';
    rationale = pick(COUNTERPARTY_RATIONALE_COUNTER);
    proposedAmount = Math.round(demandAmount * randFloat(0.4, 0.9, 2));
  } else if (status === 'closed') {
    const roll = rng();
    if (roll < 0.4) {
      responseType = 'accept';
      rationale = pick(COUNTERPARTY_RATIONALE_ACCEPT);
    } else if (roll < 0.7) {
      responseType = 'counter';
      rationale = pick(COUNTERPARTY_RATIONALE_COUNTER);
      proposedAmount = Math.round(demandAmount * randFloat(0.5, 0.85, 2));
    } else {
      responseType = 'dispute';
      rationale = pick(COUNTERPARTY_RATIONALE_DISPUTE);
    }
  } else {
    responseType = pick(COUNTERPARTY_RESPONSE_TYPES);
    if (responseType === 'accept') {
      rationale = pick(COUNTERPARTY_RATIONALE_ACCEPT);
    } else if (responseType === 'dispute') {
      rationale = pick(COUNTERPARTY_RATIONALE_DISPUTE);
    } else {
      rationale = pick(COUNTERPARTY_RATIONALE_COUNTER);
      proposedAmount = Math.round(demandAmount * randFloat(0.4, 0.9, 2));
    }
  }

  return {
    receivedAt,
    responseType,
    rationale,
    proposedAmount,
  };
};

/**
 * Generates an alternative proposal based on the case status.
 * @param {string} status
 * @param {string} createdAt
 * @param {number} demandAmount
 * @returns {AlternativeProposal}
 */
const generateAlternativeProposal = (status, createdAt, demandAmount) => {
  const needsProposal = ['negotiation', 'alternative_accepted', 'closed'].includes(status);

  if (!needsProposal) {
    return {
      type: null,
      terms: null,
      amount: null,
      status: null,
    };
  }

  const type = pick(ALTERNATIVE_TYPES);
  const terms = pick(ALTERNATIVE_TERMS);
  const amount = Math.round(demandAmount * randFloat(0.3, 0.85, 2));

  let proposalStatus;
  if (status === 'alternative_accepted') {
    proposalStatus = 'accepted';
  } else if (status === 'closed') {
    proposalStatus = rng() > 0.5 ? 'accepted' : 'rejected';
  } else {
    proposalStatus = 'proposed';
  }

  return {
    type,
    terms,
    amount,
    status: proposalStatus,
  };
};

/**
 * Generates the final outcome for closed cases.
 * @param {string} status
 * @param {string} createdAt
 * @param {number} demandAmount
 * @param {AlternativeProposal} alternativeProposal
 * @returns {FinalOutcome}
 */
const generateFinalOutcome = (status, createdAt, demandAmount, alternativeProposal) => {
  if (status !== 'closed') {
    return {
      type: null,
      settledAmount: null,
      closedAt: null,
      notes: null,
    };
  }

  const outcomeType = pick(FINAL_OUTCOME_TYPES);
  const closedDaysAfter = randInt(30, 180);
  const closedAt = addDays(new Date(createdAt), closedDaysAfter).toISOString();
  const notes = pick(FINAL_OUTCOME_NOTES);

  let settledAmount;
  if (outcomeType === 'full_repurchase') {
    settledAmount = demandAmount;
  } else if (outcomeType === 'partial_repurchase') {
    settledAmount = Math.round(demandAmount * randFloat(0.4, 0.8, 2));
  } else if (outcomeType === 'indemnification' || outcomeType === 'price_adjustment') {
    settledAmount = alternativeProposal.amount || Math.round(demandAmount * randFloat(0.05, 0.3, 2));
  } else {
    settledAmount = 0;
  }

  return {
    type: outcomeType,
    settledAmount,
    closedAt,
    notes,
  };
};

/**
 * Calculates the current exposure for a repurchase case.
 * @param {string} status
 * @param {number} demandAmount
 * @param {AlternativeProposal} alternativeProposal
 * @param {FinalOutcome} finalOutcome
 * @returns {number}
 */
const calculateExposure = (status, demandAmount, alternativeProposal, finalOutcome) => {
  if (status === 'closed') {
    return finalOutcome.settledAmount || 0;
  }

  if (status === 'draft') {
    return 0;
  }

  if (
    alternativeProposal.status === 'accepted' &&
    alternativeProposal.amount !== null
  ) {
    return alternativeProposal.amount;
  }

  return demandAmount;
};

/**
 * Generates a single mock repurchase case record.
 * @param {number} index - The case index (0-based).
 * @returns {RepurchaseCase}
 */
const generateRepurchaseCase = (index) => {
  const id = `REP-${String(index + 1).padStart(4, '0')}`;
  const sellerId = SELLER_IDS[index % SELLER_IDS.length];
  const loanId = LOAN_IDS[index % LOAN_IDS.length];
  const status = REPURCHASE_STATUSES[index % REPURCHASE_STATUSES.length];

  const daysAgo = randInt(5, 365);
  const createdAt = subDays(REFERENCE_DATE, daysAgo);
  const updatedDaysAgo = randInt(0, Math.max(daysAgo, 1));
  const updatedAt = subDays(REFERENCE_DATE, updatedDaysAgo);

  const demandAmount = Math.round(randFloat(80000, 750000, 2));
  const rationale = pick(RATIONALES);
  const linkedDefectIds = generateLinkedDefectIds(index);
  const evidence = generateEvidence(id, createdAt.toISOString());

  const counterpartyResponse = generateCounterpartyResponse(status, createdAt.toISOString(), demandAmount);
  const alternativeProposal = generateAlternativeProposal(status, createdAt.toISOString(), demandAmount);
  const finalOutcome = generateFinalOutcome(status, createdAt.toISOString(), demandAmount, alternativeProposal);
  const exposure = calculateExposure(status, demandAmount, alternativeProposal, finalOutcome);

  return {
    id,
    linkedDefectIds,
    sellerId,
    loanId,
    demandAmount,
    rationale,
    evidence,
    status,
    counterpartyResponse,
    alternativeProposal,
    finalOutcome,
    exposure,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

/**
 * Generates the full array of mock repurchase case records.
 * Produces exactly 25 repurchase cases with deterministic pseudo-random data.
 * @returns {RepurchaseCase[]}
 */
export const seedRepurchases = () => {
  const cases = [];

  for (let i = 0; i < 25; i++) {
    cases.push(generateRepurchaseCase(i));
  }

  return cases;
};

export default seedRepurchases;