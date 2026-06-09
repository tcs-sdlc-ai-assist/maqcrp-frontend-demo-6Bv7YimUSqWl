import { subDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} DefectTaxonomyCategory
 * @property {string} code
 * @property {string} name
 * @property {Array<Object>} subcategories
 */

/**
 * @typedef {Object} DefectTaxonomy
 * @property {number} version
 * @property {Array<DefectTaxonomyCategory>} categories
 */

/**
 * @typedef {Object} EvidenceAttachment
 * @property {string} id
 * @property {string} fileName
 * @property {string} fileType
 * @property {string} uploadDate
 * @property {string} uploadedBy
 */

/**
 * @typedef {Object} Defect
 * @property {string} id
 * @property {string} qcCaseId
 * @property {string} loanId
 * @property {string} sellerId
 * @property {string} taxonomyCode
 * @property {string} category
 * @property {string} subcategory
 * @property {string} severity
 * @property {string} rootCause
 * @property {string} sourceOfDefect
 * @property {string} description
 * @property {Array<EvidenceAttachment>} evidence
 * @property {string|null} linkedRemedyCaseId
 * @property {string|null} linkedRepurchaseCaseId
 * @property {string} status
 * @property {string|null} resolution
 * @property {string} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} closedAt
 */

const DEFECT_TAXONOMY = {
  version: 1,
  categories: [
    {
      code: 'DOC',
      name: 'Documentation',
      subcategories: [
        {
          code: 'INC',
          name: 'Income Verification',
          defectTypes: [
            { code: '001', name: 'Missing Pay Stub', defaultSeverity: 'major' },
            { code: '002', name: 'Incomplete W-2', defaultSeverity: 'minor' },
            { code: '003', name: 'Tax Return Discrepancy', defaultSeverity: 'critical' },
            { code: '004', name: 'YTD Income Mismatch', defaultSeverity: 'major' },
            { code: '005', name: 'Self-Employment Documentation Gap', defaultSeverity: 'major' },
          ],
        },
        {
          code: 'AST',
          name: 'Asset Verification',
          defectTypes: [
            { code: '001', name: 'Missing Bank Statement', defaultSeverity: 'major' },
            { code: '002', name: 'Incomplete Bank Statement Pages', defaultSeverity: 'minor' },
            { code: '003', name: 'Large Deposit Not Sourced', defaultSeverity: 'critical' },
            { code: '004', name: 'Earnest Money Not Documented', defaultSeverity: 'major' },
            { code: '005', name: 'Gift Letter Missing or Incomplete', defaultSeverity: 'major' },
          ],
        },
        {
          code: 'CRD',
          name: 'Credit Documentation',
          defectTypes: [
            { code: '001', name: 'Credit Report Expired', defaultSeverity: 'major' },
            { code: '002', name: 'Credit Inquiry Not Addressed', defaultSeverity: 'minor' },
            { code: '003', name: 'Disputed Account Not Resolved', defaultSeverity: 'major' },
            { code: '004', name: 'Credit Score Discrepancy Across Bureaus', defaultSeverity: 'minor' },
          ],
        },
        {
          code: 'EMP',
          name: 'Employment Verification',
          defectTypes: [
            { code: '001', name: 'Employment Not Verified Within 10 Days', defaultSeverity: 'major' },
            { code: '002', name: 'Employment Gap Not Explained', defaultSeverity: 'minor' },
            { code: '003', name: 'Employer Contact Invalid', defaultSeverity: 'major' },
            { code: '004', name: 'Employment History Inconsistency', defaultSeverity: 'critical' },
          ],
        },
      ],
    },
    {
      code: 'APP',
      name: 'Appraisal',
      subcategories: [
        {
          code: 'VAL',
          name: 'Valuation Issues',
          defectTypes: [
            { code: '001', name: 'Appraisal Expired', defaultSeverity: 'major' },
            { code: '002', name: 'Comparable Sales Out of Range', defaultSeverity: 'critical' },
            { code: '003', name: 'Comparable Sales Too Old', defaultSeverity: 'major' },
            { code: '004', name: 'Unsupported Adjustments', defaultSeverity: 'major' },
            { code: '005', name: 'Appraised Value Insufficient for LTV', defaultSeverity: 'critical' },
          ],
        },
        {
          code: 'CND',
          name: 'Property Condition',
          defectTypes: [
            { code: '001', name: 'Required Repairs Not Addressed', defaultSeverity: 'critical' },
            { code: '002', name: 'Environmental Hazard Not Disclosed', defaultSeverity: 'critical' },
            { code: '003', name: 'Property Condition Rating Inaccurate', defaultSeverity: 'major' },
          ],
        },
      ],
    },
    {
      code: 'TTL',
      name: 'Title & Legal',
      subcategories: [
        {
          code: 'LIE',
          name: 'Liens & Encumbrances',
          defectTypes: [
            { code: '001', name: 'Unresolved Lien', defaultSeverity: 'critical' },
            { code: '002', name: 'Judgment Not Addressed', defaultSeverity: 'critical' },
            { code: '003', name: 'Tax Lien Outstanding', defaultSeverity: 'critical' },
          ],
        },
        {
          code: 'VST',
          name: 'Vesting Issues',
          defectTypes: [
            { code: '001', name: 'Vesting Does Not Match Contract', defaultSeverity: 'major' },
            { code: '002', name: 'Entity Vesting Not Properly Documented', defaultSeverity: 'major' },
          ],
        },
        {
          code: 'ESM',
          name: 'Easements & Restrictions',
          defectTypes: [
            { code: '001', name: 'Easement Not Acceptable Per Guidelines', defaultSeverity: 'major' },
            { code: '002', name: 'HOA Restriction Violation', defaultSeverity: 'minor' },
          ],
        },
      ],
    },
    {
      code: 'CMP',
      name: 'Compliance',
      subcategories: [
        {
          code: 'DIS',
          name: 'Disclosure Violations',
          defectTypes: [
            { code: '001', name: 'Loan Estimate Not Timely', defaultSeverity: 'critical' },
            { code: '002', name: 'Closing Disclosure Timing Violation', defaultSeverity: 'critical' },
            { code: '003', name: 'Missing Required Disclosure', defaultSeverity: 'major' },
            { code: '004', name: 'Disclosure Not Signed', defaultSeverity: 'minor' },
          ],
        },
        {
          code: 'REG',
          name: 'Regulatory Compliance',
          defectTypes: [
            { code: '001', name: 'QM/ATR Violation', defaultSeverity: 'critical' },
            { code: '002', name: 'High-Cost Loan Trigger Not Addressed', defaultSeverity: 'critical' },
            { code: '003', name: 'HPML Requirements Not Met', defaultSeverity: 'critical' },
            { code: '004', name: 'State-Specific Regulation Violation', defaultSeverity: 'major' },
          ],
        },
      ],
    },
    {
      code: 'IDV',
      name: 'Identity & Fraud',
      subcategories: [
        {
          code: 'IDN',
          name: 'Identity Verification',
          defectTypes: [
            { code: '001', name: 'Government ID Missing or Invalid', defaultSeverity: 'critical' },
            { code: '002', name: 'Name Mismatch Across Documents', defaultSeverity: 'major' },
            { code: '003', name: 'SSN Verification Failed', defaultSeverity: 'critical' },
            { code: '004', name: 'Date of Birth Inconsistency', defaultSeverity: 'major' },
          ],
        },
        {
          code: 'FRD',
          name: 'Fraud Indicators',
          defectTypes: [
            { code: '001', name: 'Occupancy Misrepresentation', defaultSeverity: 'critical' },
            { code: '002', name: 'Income Fabrication Suspected', defaultSeverity: 'critical' },
            { code: '003', name: 'Asset Fabrication Suspected', defaultSeverity: 'critical' },
            { code: '004', name: 'Straw Buyer Indicators', defaultSeverity: 'critical' },
            { code: '005', name: 'OFAC/Watchlist Match', defaultSeverity: 'critical' },
          ],
        },
      ],
    },
    {
      code: 'INS',
      name: 'Insurance',
      subcategories: [
        {
          code: 'HZD',
          name: 'Hazard Insurance',
          defectTypes: [
            { code: '001', name: 'Coverage Below Replacement Cost', defaultSeverity: 'major' },
            { code: '002', name: 'Policy Not Active', defaultSeverity: 'critical' },
            { code: '003', name: 'Deductible Exceeds Limit', defaultSeverity: 'minor' },
          ],
        },
        {
          code: 'FLD',
          name: 'Flood Insurance',
          defectTypes: [
            { code: '001', name: 'Flood Insurance Required But Missing', defaultSeverity: 'critical' },
            { code: '002', name: 'Flood Zone Determination Missing', defaultSeverity: 'major' },
          ],
        },
        {
          code: 'MIP',
          name: 'Mortgage Insurance',
          defectTypes: [
            { code: '001', name: 'PMI/MIP Calculation Error', defaultSeverity: 'major' },
            { code: '002', name: 'MI Certificate Missing', defaultSeverity: 'major' },
          ],
        },
      ],
    },
  ],
};

const SEVERITIES = ['critical', 'major', 'minor', 'observation'];
const ROOT_CAUSES = [
  'Seller Error',
  'Process Gap',
  'System Issue',
  'Third-Party Error',
  'Borrower Misrepresentation',
  'Underwriter Error',
  'Documentation Deficiency',
  'Training Gap',
];
const SOURCES_OF_DEFECT = ['pre_closing', 'post_closing', 'servicing'];
const DEFECT_STATUSES = ['open', 'open', 'open', 'open', 'in_review', 'in_review', 'closed', 'closed', 'disputed'];
const REVIEWER_NAMES = [
  'Alice Morgan',
  'Brian Torres',
  'Catherine Wells',
  'David Park',
  'Elena Vasquez',
  'Frank Osei',
  'Grace Nakamura',
  'Henry Patel',
];

const DEFECT_DESCRIPTIONS = {
  'DOC.INC.001': [
    'Most recent pay stub is missing from the loan file. Only 1 of 2 required pay stubs provided.',
    'Pay stub for the month of application was not included in the documentation package.',
    'Borrower changed employers; pay stub from new employer not provided.',
  ],
  'DOC.INC.002': [
    'W-2 form for the most recent tax year is incomplete — only page 1 of 2 provided.',
    'W-2 shows employer information but wage details are cut off on the provided copy.',
  ],
  'DOC.INC.003': [
    'Tax return shows income of $72,000 but application states $95,000. Discrepancy not explained.',
    'Schedule C income does not match the stated self-employment income on the application.',
  ],
  'DOC.AST.001': [
    'Bank statement for the most recent month is missing. Only 1 of 2 required months provided.',
    'Statements from the wrong account were submitted — does not match account on application.',
  ],
  'DOC.AST.003': [
    'Large deposit of $45,000 on 05/15/2026 is not sourced. Exceeds 50% of monthly qualifying income.',
    'Multiple large deposits totaling $78,000 in the last 60 days with no documentation of source.',
  ],
  'DOC.CRD.001': [
    'Credit report is dated 02/15/2026 — exceeds the 90-day validity window for this application.',
    'Tri-merge credit report expired 15 days before loan submission.',
  ],
  'DOC.EMP.001': [
    'Employment verification was completed 14 days before closing — exceeds the 10-day requirement.',
    'Verbal verification of employment not documented within the required timeframe.',
  ],
  'APP.VAL.002': [
    'Comparable sale at 456 Oak Ave is 2.3 miles from subject property — exceeds 1-mile guideline.',
    'Two of three comparable sales are outside the acceptable geographic radius.',
  ],
  'APP.VAL.005': [
    'Appraised value of $285,000 is insufficient for the requested LTV of 95%. Maximum loan amount at this value is $270,750.',
    'Appraisal came in $35,000 below the purchase price with no explanation.',
  ],
  'TTL.LIE.001': [
    'Mechanic\'s lien for $12,500 recorded against the property has not been released.',
    'Federal tax lien of $28,000 remains outstanding on the subject property.',
  ],
  'CMP.DIS.001': [
    'Loan Estimate was provided 5 business days after application — exceeds the 3-day requirement.',
    'Changed circumstance triggered re-disclosure but revised LE was not sent within 3 days.',
  ],
  'CMP.REG.001': [
    'DTI of 47% exceeds the QM threshold of 43% without documented compensating factors.',
    'Loan does not meet ATR requirements — residual income calculation not performed.',
  ],
  'IDV.FRD.001': [
    'Borrower claims primary residence but property is listed as a rental on tax returns.',
    'Utility bills show different occupants at the subject property address.',
  ],
  'IDV.FRD.002': [
    'Pay stubs show employer that is not registered with the state business registry.',
    'Income stated on application is 3x the industry average for the borrower\'s occupation.',
  ],
  'INS.HZD.001': [
    'Hazard insurance coverage is $180,000 but replacement cost estimator shows $225,000 needed.',
    'Insurance policy has a $10,000 deductible — exceeds the $5,000 maximum allowed.',
  ],
  'INS.FLD.001': [
    'Property is in FEMA Flood Zone AE but no flood insurance policy is in the file.',
    'Flood zone determination was not ordered prior to closing.',
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
 * Flattens the taxonomy into an array of all defect type entries with their full path.
 * @returns {Array<{taxonomyCode: string, category: string, subcategory: string, defectName: string, defaultSeverity: string}>}
 */
const flattenTaxonomy = () => {
  const flat = [];

  for (const category of DEFECT_TAXONOMY.categories) {
    for (const subcategory of category.subcategories) {
      for (const defectType of subcategory.defectTypes) {
        flat.push({
          taxonomyCode: `${category.code}.${subcategory.code}.${defectType.code}`,
          category: category.name,
          subcategory: subcategory.name,
          defectName: defectType.name,
          defaultSeverity: defectType.defaultSeverity,
        });
      }
    }
  }

  return flat;
};

/**
 * Gets a description for a given taxonomy code, or generates a generic one.
 * @param {string} taxonomyCode
 * @returns {string}
 */
const getDescription = (taxonomyCode) => {
  const options = DEFECT_DESCRIPTIONS[taxonomyCode];
  if (options && options.length > 0) {
    return pick(options);
  }

  const genericDescriptions = [
    'Documentation deficiency identified during QC review. Further investigation required.',
    'Quality control review found this item to be non-compliant with established guidelines.',
    'Review identified a gap in documentation that requires seller remediation.',
    'Standard checklist review flagged this item as deficient.',
    'Automated validation check identified this issue during the QC process.',
  ];

  return pick(genericDescriptions);
};

/**
 * Generates mock evidence attachments for a defect.
 * @param {string} defectId
 * @param {string} createdAt
 * @returns {Array<EvidenceAttachment>}
 */
const generateEvidence = (defectId, createdAt) => {
  const hasEvidence = rng() > 0.3;

  if (!hasEvidence) {
    return [];
  }

  const evidenceCount = randInt(1, 3);
  const evidence = [];

  const fileTypes = [
    { ext: 'png', mime: 'image/png' },
    { ext: 'pdf', mime: 'application/pdf' },
    { ext: 'jpg', mime: 'image/jpeg' },
    { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ];

  const fileLabels = [
    'checklist_screenshot',
    'document_review',
    'evidence_attachment',
    'qc_finding',
    'supporting_document',
    'review_notes',
  ];

  for (let i = 0; i < evidenceCount; i++) {
    const fileType = pick(fileTypes);
    const label = pick(fileLabels);
    const uploadDaysAgo = randInt(0, 5);
    const uploadDate = subDays(new Date(createdAt), -uploadDaysAgo);

    evidence.push({
      id: `EVD-${String(randInt(1, 9999)).padStart(4, '0')}`,
      fileName: `${label}_${defectId.toLowerCase()}.${fileType.ext}`,
      fileType: fileType.mime,
      uploadDate: uploadDate.toISOString(),
      uploadedBy: pick(REVIEWER_NAMES),
    });
  }

  return evidence;
};

/**
 * Determines the severity for a defect, potentially overriding the taxonomy default.
 * @param {string} defaultSeverity
 * @returns {string}
 */
const determineSeverity = (defaultSeverity) => {
  const roll = rng();

  if (roll < 0.7) {
    return defaultSeverity;
  }

  if (roll < 0.8 && defaultSeverity !== 'critical') {
    const severityIndex = SEVERITIES.indexOf(defaultSeverity);
    if (severityIndex > 0) {
      return SEVERITIES[severityIndex - 1];
    }
  }

  if (roll < 0.9 && defaultSeverity !== 'observation') {
    const severityIndex = SEVERITIES.indexOf(defaultSeverity);
    if (severityIndex < SEVERITIES.length - 1) {
      return SEVERITIES[severityIndex + 1];
    }
  }

  return defaultSeverity;
};

/**
 * Determines the defect status based on index to ensure a realistic distribution.
 * @param {number} index
 * @returns {string}
 */
const determineStatus = (index) => {
  if (index < 25) return 'closed';
  if (index < 35) return 'closed';
  if (index < 45) return 'in_review';
  if (index < 50) return 'in_review';
  if (index < 58) return 'disputed';
  return 'open';
};

/**
 * Generates a single mock defect record.
 * @param {number} index - The defect index (0-based).
 * @param {Array<{id: string, loanId: string}>} qcCaseLoanPairs - Array of { id: qcCaseId, loanId } pairs.
 * @param {Array<{id: string}>} sellers - Array of seller objects.
 * @returns {Defect}
 */
const generateDefect = (index, qcCaseLoanPairs, sellers) => {
  const id = `DEF-${String(index + 1).padStart(4, '0')}`;
  const qcCasePair = qcCaseLoanPairs[index % qcCaseLoanPairs.length];
  const qcCaseId = qcCasePair.id;
  const loanId = qcCasePair.loanId;
  const seller = sellers[index % sellers.length];
  const sellerId = seller.id;

  const flatTaxonomy = flattenTaxonomy();
  const taxonomyEntry = flatTaxonomy[index % flatTaxonomy.length];

  const severity = determineSeverity(taxonomyEntry.defaultSeverity);
  const rootCause = pick(ROOT_CAUSES);
  const sourceOfDefect = pick(SOURCES_OF_DEFECT);
  const status = determineStatus(index);

  const daysAgo = randInt(0, 120);
  const createdAt = subDays(REFERENCE_DATE, daysAgo);
  const updatedDaysAgo = randInt(0, Math.max(daysAgo, 1));
  const updatedAt = subDays(REFERENCE_DATE, updatedDaysAgo);

  let closedAt = null;
  let resolution = null;

  if (status === 'closed') {
    const closedDaysAgo = randInt(0, Math.max(updatedDaysAgo, 1));
    closedAt = subDays(REFERENCE_DATE, closedDaysAgo).toISOString();

    const resolutions = [
      'Seller provided corrected documentation. Defect resolved.',
      'Issue addressed through seller remediation process.',
      'Documentation updated and verified. No further action required.',
      'Defect resolved after seller submitted missing documents.',
      'Corrected by seller within SLA timeframe.',
      'Resolved through exception process with management approval.',
    ];
    resolution = pick(resolutions);
  }

  const description = getDescription(taxonomyEntry.taxonomyCode);

  const hasRemedyLink = (severity === 'critical' || severity === 'major') && rng() > 0.3;
  const linkedRemedyCaseId = hasRemedyLink
    ? `REM-${String(randInt(1, 50)).padStart(4, '0')}`
    : null;

  const hasRepurchaseLink = severity === 'critical' && rng() > 0.6;
  const linkedRepurchaseCaseId = hasRepurchaseLink
    ? `REP-${String(randInt(1, 20)).padStart(4, '0')}`
    : null;

  const evidence = generateEvidence(id, createdAt.toISOString());

  return {
    id,
    qcCaseId,
    loanId,
    sellerId,
    taxonomyCode: taxonomyEntry.taxonomyCode,
    category: taxonomyEntry.category,
    subcategory: taxonomyEntry.subcategory,
    severity,
    rootCause,
    sourceOfDefect,
    description,
    evidence,
    linkedRemedyCaseId,
    linkedRepurchaseCaseId,
    status,
    resolution,
    createdBy: pick(REVIEWER_NAMES),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    closedAt,
  };
};

/**
 * Generates the full array of mock defect records and the defect taxonomy.
 * Produces exactly 60 defects with deterministic pseudo-random data.
 * @param {Array<{id: string, loanId: string}>} qcCaseLoanPairs - Array of { id: qcCaseId, loanId } pairs from QC cases.
 * @param {Array<{id: string}>} sellers - Array of seller objects.
 * @returns {{ defects: Defect[], taxonomy: DefectTaxonomy }}
 */
export const seedDefects = (qcCaseLoanPairs, sellers) => {
  if (!Array.isArray(qcCaseLoanPairs) || qcCaseLoanPairs.length === 0) {
    console.warn('seedDefects: No QC case/loan pairs provided, generating with fallback data.');
    const fallbackPairs = Array.from({ length: 60 }, (_, i) => ({
      id: `QC-${String((i % 100) + 1).padStart(4, '0')}`,
      loanId: `LOAN-${String((i % 50) + 1).padStart(4, '0')}`,
    }));
    const fallbackSellers = Array.from({ length: 12 }, (_, i) => ({
      id: `SELL-${String(i + 1).padStart(4, '0')}`,
    }));
    const defects = [];
    for (let i = 0; i < 60; i++) {
      defects.push(generateDefect(i, fallbackPairs, fallbackSellers));
    }
    return { defects, taxonomy: DEFECT_TAXONOMY };
  }

  if (!Array.isArray(sellers) || sellers.length === 0) {
    console.warn('seedDefects: No sellers provided, generating with fallback seller data.');
    const fallbackSellers = Array.from({ length: 12 }, (_, i) => ({
      id: `SELL-${String(i + 1).padStart(4, '0')}`,
    }));
    const defects = [];
    for (let i = 0; i < 60; i++) {
      defects.push(generateDefect(i, qcCaseLoanPairs, fallbackSellers));
    }
    return { defects, taxonomy: DEFECT_TAXONOMY };
  }

  const defects = [];

  for (let i = 0; i < 60; i++) {
    defects.push(generateDefect(i, qcCaseLoanPairs, sellers));
  }

  return { defects, taxonomy: DEFECT_TAXONOMY };
};

export default seedDefects;