import { subDays, addDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {string} timestamp
 * @property {string} persona
 * @property {string} action
 * @property {string} entityType
 * @property {string} entityId
 * @property {Object} details
 * @property {string} ipAddress
 * @property {string} sessionId
 */

const PERSONAS = [
  'Risk Analyst',
  'Compliance Officer',
  'Fraud Investigator',
  'Administrator',
  'Executive',
];

const ACTIONS = {
  LOAN_SUBMIT: 'LOAN_SUBMIT',
  LOAN_VALIDATE: 'LOAN_VALIDATE',
  LOAN_STATUS_CHANGE: 'LOAN_STATUS_CHANGE',
  RULE_CREATE: 'RULE_CREATE',
  RULE_UPDATE: 'RULE_UPDATE',
  RULE_ARCHIVE: 'RULE_ARCHIVE',
  RULE_EXECUTE: 'RULE_EXECUTE',
  OVERRIDE_REQUEST: 'OVERRIDE_REQUEST',
  OVERRIDE_APPROVE: 'OVERRIDE_APPROVE',
  QC_CASE_CREATE: 'QC_CASE_CREATE',
  QC_CASE_ASSIGN: 'QC_CASE_ASSIGN',
  QC_CHECKLIST_UPDATE: 'QC_CHECKLIST_UPDATE',
  QC_REVIEW_COMPLETE: 'QC_REVIEW_COMPLETE',
  QC_SAMPLING_RUN: 'QC_SAMPLING_RUN',
  DEFECT_CREATE: 'DEFECT_CREATE',
  DEFECT_UPDATE: 'DEFECT_UPDATE',
  DEFECT_CLOSE: 'DEFECT_CLOSE',
  TAXONOMY_UPDATE: 'TAXONOMY_UPDATE',
  REMEDY_CREATE: 'REMEDY_CREATE',
  REMEDY_ASSIGN: 'REMEDY_ASSIGN',
  REMEDY_TRANSITION: 'REMEDY_TRANSITION',
  REMEDY_ESCALATE: 'REMEDY_ESCALATE',
  REMEDY_CLOSE: 'REMEDY_CLOSE',
  REPURCHASE_INITIATE: 'REPURCHASE_INITIATE',
  REPURCHASE_RESPONSE: 'REPURCHASE_RESPONSE',
  REPURCHASE_NEGOTIATE: 'REPURCHASE_NEGOTIATE',
  REPURCHASE_CLOSE: 'REPURCHASE_CLOSE',
  PERSONA_SWITCH: 'PERSONA_SWITCH',
  PII_REVEAL: 'PII_REVEAL',
  EXPORT_DATA: 'EXPORT_DATA',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  SELLER_STATUS_CHANGE: 'SELLER_STATUS_CHANGE',
  CHECKLIST_TEMPLATE_CREATE: 'CHECKLIST_TEMPLATE_CREATE',
  CHECKLIST_TEMPLATE_UPDATE: 'CHECKLIST_TEMPLATE_UPDATE',
  SAMPLING_CONFIG_SAVE: 'SAMPLING_CONFIG_SAVE',
};

const ENTITY_TYPES = [
  'loan',
  'rule',
  'qc_case',
  'defect',
  'remedy_case',
  'repurchase_case',
  'seller',
  'checklist_template',
  'sampling_config',
  'taxonomy',
  'override',
  'system',
];

const SESSION_IDS = [
  'session-mock-001',
  'session-mock-002',
  'session-mock-003',
  'session-mock-004',
  'session-mock-005',
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
 * Generates a timestamp within the last 180 days relative to the reference date.
 * @returns {string}
 */
const generateTimestamp = () => {
  const daysAgo = randInt(0, 180);
  const hoursAgo = randInt(0, 23);
  const minutesAgo = randInt(0, 59);
  const secondsAgo = randInt(0, 59);

  const date = subDays(REFERENCE_DATE, daysAgo);
  date.setHours(hoursAgo, minutesAgo, secondsAgo, randInt(0, 999));

  return date.toISOString();
};

/**
 * Generates a timestamp after a given base timestamp, within a specified range of days.
 * @param {string} baseTimestamp
 * @param {number} [maxDaysAfter=30]
 * @returns {string}
 */
const generateTimestampAfter = (baseTimestamp, maxDaysAfter = 30) => {
  const baseDate = new Date(baseTimestamp);
  const daysAfter = randInt(0, maxDaysAfter);
  const hoursAfter = randInt(0, 23);
  const minutesAfter = randInt(0, 59);

  const date = addDays(baseDate, daysAfter);
  date.setHours(hoursAfter, minutesAfter, randInt(0, 59), randInt(0, 999));

  return date.toISOString();
};

/**
 * Generates a batch of related audit entries for a loan intake workflow.
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} loanIndex - Loan index for entity IDs.
 * @returns {AuditEntry[]}
 */
const generateLoanIntakeAudit = (startIndex, loanIndex) => {
  const entries = [];
  const loanId = `LOAN-${String(loanIndex + 1).padStart(4, '0')}`;
  const sellerId = `SELL-${String(randInt(1, 12)).padStart(4, '0')}`;
  const persona = pick(PERSONAS);
  const sessionId = pick(SESSION_IDS);

  const submitTimestamp = generateTimestamp();

  entries.push({
    id: `AUD-${String(startIndex + 1).padStart(6, '0')}`,
    timestamp: submitTimestamp,
    persona,
    action: ACTIONS.LOAN_SUBMIT,
    entityType: 'loan',
    entityId: loanId,
    details: {
      productType: pick(['conventional', 'FHA', 'VA', 'jumbo', 'USDA']),
      channel: pick(['retail', 'correspondent', 'broker', 'wholesale']),
      loanAmount: randInt(75000, 2000000),
      sellerId,
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  const validateTimestamp = generateTimestampAfter(submitTimestamp, 1);

  entries.push({
    id: `AUD-${String(startIndex + 2).padStart(6, '0')}`,
    timestamp: validateTimestamp,
    persona: 'Administrator',
    action: ACTIONS.LOAN_VALIDATE,
    entityType: 'loan',
    entityId: loanId,
    details: {
      validationResult: rng() > 0.15 ? 'passed' : 'failed',
      errors: rng() > 0.15 ? [] : [{ field: 'borrowerName', code: 'REQUIRED', message: 'Borrower name is required' }],
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId: pick(SESSION_IDS),
  });

  const statusTimestamp = generateTimestampAfter(validateTimestamp, 3);

  entries.push({
    id: `AUD-${String(startIndex + 3).padStart(6, '0')}`,
    timestamp: statusTimestamp,
    persona,
    action: ACTIONS.LOAN_STATUS_CHANGE,
    entityType: 'loan',
    entityId: loanId,
    details: {
      previousStatus: 'PENDING_VALIDATION',
      newStatus: pick(['VALIDATED', 'PASS', 'FAIL', 'EXCEPTION']),
      reason: 'Validation completed',
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  return entries;
};

/**
 * Generates a batch of related audit entries for a rule management workflow.
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} ruleIndex - Rule index for entity IDs.
 * @returns {AuditEntry[]}
 */
const generateRuleManagementAudit = (startIndex, ruleIndex) => {
  const entries = [];
  const ruleId = `RULE-${String(ruleIndex + 1).padStart(4, '0')}`;
  const persona = 'Administrator';
  const sessionId = pick(SESSION_IDS);

  const createTimestamp = generateTimestamp();

  entries.push({
    id: `AUD-${String(startIndex + 1).padStart(6, '0')}`,
    timestamp: createTimestamp,
    persona,
    action: ACTIONS.RULE_CREATE,
    entityType: 'rule',
    entityId: ruleId,
    details: {
      ruleName: `Eligibility Rule ${ruleIndex + 1}`,
      ruleType: pick(['hard_stop', 'weighted_score']),
      productTypes: [pick(['conventional', 'FHA', 'VA', 'jumbo', 'USDA'])],
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  if (rng() > 0.4) {
    const updateTimestamp = generateTimestampAfter(createTimestamp, 60);

    entries.push({
      id: `AUD-${String(startIndex + 2).padStart(6, '0')}`,
      timestamp: updateTimestamp,
      persona,
      action: ACTIONS.RULE_UPDATE,
      entityType: 'rule',
      entityId: ruleId,
      details: {
        changes: {
          weight: randInt(10, 50),
          description: 'Updated threshold values',
        },
        version: 2,
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  if (rng() > 0.7) {
    const executeTimestamp = generateTimestampAfter(createTimestamp, 90);
    const loanId = `LOAN-${String(randInt(1, 50)).padStart(4, '0')}`;

    entries.push({
      id: `AUD-${String(startIndex + 3).padStart(6, '0')}`,
      timestamp: executeTimestamp,
      persona: pick(PERSONAS),
      action: ACTIONS.RULE_EXECUTE,
      entityType: 'rule',
      entityId: ruleId,
      details: {
        loanId,
        result: pick(['pass', 'fail', 'exception']),
        score: randInt(0, 100),
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId: pick(SESSION_IDS),
    });
  }

  return entries;
};

/**
 * Generates a batch of related audit entries for a QC review workflow.
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} qcIndex - QC case index for entity IDs.
 * @returns {AuditEntry[]}
 */
const generateQCReviewAudit = (startIndex, qcIndex) => {
  const entries = [];
  const qcCaseId = `QC-${String(qcIndex + 1).padStart(4, '0')}`;
  const loanId = `LOAN-${String(randInt(1, 50)).padStart(4, '0')}`;
  const reviewer = pick(PERSONAS);
  const sessionId = pick(SESSION_IDS);

  const createTimestamp = generateTimestamp();

  entries.push({
    id: `AUD-${String(startIndex + 1).padStart(6, '0')}`,
    timestamp: createTimestamp,
    persona: 'Administrator',
    action: ACTIONS.QC_CASE_CREATE,
    entityType: 'qc_case',
    entityId: qcCaseId,
    details: {
      loanId,
      methodology: pick(['random', 'risk_based', 'targeted', 'threshold']),
      priority: pick(['high', 'medium', 'low']),
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  const assignTimestamp = generateTimestampAfter(createTimestamp, 2);

  entries.push({
    id: `AUD-${String(startIndex + 2).padStart(6, '0')}`,
    timestamp: assignTimestamp,
    persona: 'Administrator',
    action: ACTIONS.QC_CASE_ASSIGN,
    entityType: 'qc_case',
    entityId: qcCaseId,
    details: {
      assignedTo: reviewer,
      previousAssignee: null,
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  const checklistUpdateTimestamp = generateTimestampAfter(assignTimestamp, 5);

  entries.push({
    id: `AUD-${String(startIndex + 3).padStart(6, '0')}`,
    timestamp: checklistUpdateTimestamp,
    persona: reviewer,
    action: ACTIONS.QC_CHECKLIST_UPDATE,
    entityType: 'qc_case',
    entityId: qcCaseId,
    details: {
      checklistItemId: `CLI-${String(randInt(1, 50)).padStart(4, '0')}`,
      response: pick(['pass', 'fail', 'na']),
      category: pick([
        'Income Verification',
        'Asset Verification',
        'Credit Review',
        'Appraisal Review',
        'Title Review',
      ]),
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  const completeTimestamp = generateTimestampAfter(checklistUpdateTimestamp, 7);

  entries.push({
    id: `AUD-${String(startIndex + 4).padStart(6, '0')}`,
    timestamp: completeTimestamp,
    persona: reviewer,
    action: ACTIONS.QC_REVIEW_COMPLETE,
    entityType: 'qc_case',
    entityId: qcCaseId,
    details: {
      overallResult: pick(['pass', 'fail', 'conditional_pass']),
      defectsCreated: randInt(0, 3),
      reviewDurationMinutes: randInt(15, 120),
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  return entries;
};

/**
 * Generates a batch of related audit entries for a defect management workflow.
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} defectIndex - Defect index for entity IDs.
 * @returns {AuditEntry[]}
 */
const generateDefectManagementAudit = (startIndex, defectIndex) => {
  const entries = [];
  const defectId = `DEF-${String(defectIndex + 1).padStart(4, '0')}`;
  const qcCaseId = `QC-${String(randInt(1, 100)).padStart(4, '0')}`;
  const loanId = `LOAN-${String(randInt(1, 50)).padStart(4, '0')}`;
  const sellerId = `SELL-${String(randInt(1, 12)).padStart(4, '0')}`;
  const persona = pick(PERSONAS);
  const sessionId = pick(SESSION_IDS);

  const createTimestamp = generateTimestamp();

  entries.push({
    id: `AUD-${String(startIndex + 1).padStart(6, '0')}`,
    timestamp: createTimestamp,
    persona,
    action: ACTIONS.DEFECT_CREATE,
    entityType: 'defect',
    entityId: defectId,
    details: {
      qcCaseId,
      loanId,
      sellerId,
      taxonomyCode: `DOC.INC.${String(randInt(1, 5)).padStart(3, '0')}`,
      severity: pick(['critical', 'major', 'minor', 'observation']),
      category: 'Documentation',
      subcategory: 'Income Verification',
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  if (rng() > 0.3) {
    const updateTimestamp = generateTimestampAfter(createTimestamp, 14);

    entries.push({
      id: `AUD-${String(startIndex + 2).padStart(6, '0')}`,
      timestamp: updateTimestamp,
      persona,
      action: ACTIONS.DEFECT_UPDATE,
      entityType: 'defect',
      entityId: defectId,
      details: {
        changes: {
          severity: pick(['major', 'minor']),
          rootCause: pick(['Seller Error', 'Process Gap', 'System Issue']),
        },
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  if (rng() > 0.5) {
    const closeTimestamp = generateTimestampAfter(createTimestamp, 30);

    entries.push({
      id: `AUD-${String(startIndex + 3).padStart(6, '0')}`,
      timestamp: closeTimestamp,
      persona,
      action: ACTIONS.DEFECT_CLOSE,
      entityType: 'defect',
      entityId: defectId,
      details: {
        resolution: 'Seller provided corrected documentation. Defect resolved.',
        linkedRemedyCaseId: rng() > 0.5 ? `REM-${String(randInt(1, 50)).padStart(4, '0')}` : null,
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  return entries;
};

/**
 * Generates a batch of related audit entries for a remedy case workflow.
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} remedyIndex - Remedy case index for entity IDs.
 * @returns {AuditEntry[]}
 */
const generateRemedyWorkflowAudit = (startIndex, remedyIndex) => {
  const entries = [];
  const remedyId = `REM-${String(remedyIndex + 1).padStart(4, '0')}`;
  const sellerId = `SELL-${String(randInt(1, 12)).padStart(4, '0')}`;
  const persona = pick(PERSONAS);
  const sessionId = pick(SESSION_IDS);

  const createTimestamp = generateTimestamp();

  entries.push({
    id: `AUD-${String(startIndex + 1).padStart(6, '0')}`,
    timestamp: createTimestamp,
    persona: 'Administrator',
    action: ACTIONS.REMEDY_CREATE,
    entityType: 'remedy_case',
    entityId: remedyId,
    details: {
      sourceType: pick(['eligibility_failure', 'qc_defect', 'manual']),
      sellerId,
      remedyType: pick(['cure', 'repurchase', 'indemnification', 'price_adjustment']),
      priority: pick(['critical', 'high', 'medium', 'low']),
      dueDate: format(addDays(new Date(createTimestamp), randInt(1, 14)), 'yyyy-MM-dd'),
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  const assignTimestamp = generateTimestampAfter(createTimestamp, 3);

  entries.push({
    id: `AUD-${String(startIndex + 2).padStart(6, '0')}`,
    timestamp: assignTimestamp,
    persona: 'Administrator',
    action: ACTIONS.REMEDY_ASSIGN,
    entityType: 'remedy_case',
    entityId: remedyId,
    details: {
      assignedTo: persona,
      previousAssignee: null,
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  const transitionTimestamp = generateTimestampAfter(assignTimestamp, 7);

  entries.push({
    id: `AUD-${String(startIndex + 3).padStart(6, '0')}`,
    timestamp: transitionTimestamp,
    persona,
    action: ACTIONS.REMEDY_TRANSITION,
    entityType: 'remedy_case',
    entityId: remedyId,
    details: {
      previousStatus: 'assigned',
      newStatus: 'in_progress',
      notes: 'Investigation underway. Contacted seller for documentation.',
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  if (rng() > 0.6) {
    const escalateTimestamp = generateTimestampAfter(transitionTimestamp, 5);

    entries.push({
      id: `AUD-${String(startIndex + 4).padStart(6, '0')}`,
      timestamp: escalateTimestamp,
      persona,
      action: ACTIONS.REMEDY_ESCALATE,
      entityType: 'remedy_case',
      entityId: remedyId,
      details: {
        escalationLevel: 1,
        reason: 'Seller not responding within SLA timeframe',
        slaBreached: true,
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  if (rng() > 0.4) {
    const closeTimestamp = generateTimestampAfter(transitionTimestamp, 21);

    entries.push({
      id: `AUD-${String(startIndex + 5).padStart(6, '0')}`,
      timestamp: closeTimestamp,
      persona,
      action: ACTIONS.REMEDY_CLOSE,
      entityType: 'remedy_case',
      entityId: remedyId,
      details: {
        outcome: pick(['Seller provided documentation', 'Issue resolved', 'Exception granted']),
        finalImpact: randInt(0, 50000),
        resolutionDays: randInt(1, 30),
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  return entries;
};

/**
 * Generates a batch of related audit entries for a repurchase case workflow.
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} repurchaseIndex - Repurchase case index for entity IDs.
 * @returns {AuditEntry[]}
 */
const generateRepurchaseWorkflowAudit = (startIndex, repurchaseIndex) => {
  const entries = [];
  const repurchaseId = `REP-${String(repurchaseIndex + 1).padStart(4, '0')}`;
  const sellerId = `SELL-${String(randInt(1, 12)).padStart(4, '0')}`;
  const loanId = `LOAN-${String(randInt(1, 50)).padStart(4, '0')}`;
  const persona = pick(PERSONAS);
  const sessionId = pick(SESSION_IDS);

  const initiateTimestamp = generateTimestamp();

  entries.push({
    id: `AUD-${String(startIndex + 1).padStart(6, '0')}`,
    timestamp: initiateTimestamp,
    persona,
    action: ACTIONS.REPURCHASE_INITIATE,
    entityType: 'repurchase_case',
    entityId: repurchaseId,
    details: {
      sellerId,
      loanId,
      demandAmount: randInt(80000, 750000),
      linkedDefectCount: randInt(1, 4),
      rationale: 'Multiple critical defects identified during QC review',
    },
    ipAddress: '127.0.0.1 (mock)',
    sessionId,
  });

  if (rng() > 0.3) {
    const responseTimestamp = generateTimestampAfter(initiateTimestamp, 14);

    entries.push({
      id: `AUD-${String(startIndex + 2).padStart(6, '0')}`,
      timestamp: responseTimestamp,
      persona,
      action: ACTIONS.REPURCHASE_RESPONSE,
      entityType: 'repurchase_case',
      entityId: repurchaseId,
      details: {
        responseType: pick(['accept', 'dispute', 'counter']),
        proposedAmount: rng() > 0.5 ? randInt(40000, 500000) : null,
        rationale: 'Seller response received and logged',
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  if (rng() > 0.5) {
    const negotiateTimestamp = generateTimestampAfter(initiateTimestamp, 21);

    entries.push({
      id: `AUD-${String(startIndex + 3).padStart(6, '0')}`,
      timestamp: negotiateTimestamp,
      persona,
      action: ACTIONS.REPURCHASE_NEGOTIATE,
      entityType: 'repurchase_case',
      entityId: repurchaseId,
      details: {
        proposalType: pick(['indemnification', 'price_adjustment', 'partial_repurchase']),
        proposedAmount: randInt(20000, 300000),
        status: 'proposed',
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  if (rng() > 0.6) {
    const closeTimestamp = generateTimestampAfter(initiateTimestamp, 45);

    entries.push({
      id: `AUD-${String(startIndex + 4).padStart(6, '0')}`,
      timestamp: closeTimestamp,
      persona,
      action: ACTIONS.REPURCHASE_CLOSE,
      entityType: 'repurchase_case',
      entityId: repurchaseId,
      details: {
        outcomeType: pick(['full_repurchase', 'partial_repurchase', 'indemnification', 'price_adjustment', 'withdrawn']),
        settledAmount: randInt(0, 500000),
        notes: 'Case closed with mutual agreement',
      },
      ipAddress: '127.0.0.1 (mock)',
      sessionId,
    });
  }

  return entries;
};

/**
 * Generates miscellaneous system audit entries (persona switches, PII reveals, exports, config changes).
 * @param {number} startIndex - Starting audit entry index.
 * @param {number} count - Number of miscellaneous entries to generate.
 * @returns {AuditEntry[]}
 */
const generateMiscellaneousAudit = (startIndex, count) => {
  const entries = [];

  for (let i = 0; i < count; i++) {
    const actionType = rng();
    let action;
    let entityType;
    let entityId;
    let details;

    if (actionType < 0.2) {
      action = ACTIONS.PERSONA_SWITCH;
      entityType = 'system';
      entityId = 'auth';
      details = {
        previousPersona: pick(PERSONAS),
        newPersona: pick(PERSONAS),
      };
    } else if (actionType < 0.35) {
      action = ACTIONS.PII_REVEAL;
      entityType = 'loan';
      entityId = `LOAN-${String(randInt(1, 50)).padStart(4, '0')}`;
      details = {
        fieldRevealed: pick(['borrowerName', 'ssn', 'email', 'phone', 'propertyAddress']),
        revealedBy: pick(PERSONAS),
      };
    } else if (actionType < 0.5) {
      action = ACTIONS.EXPORT_DATA;
      entityType = pick(['loan', 'defect', 'remedy_case', 'repurchase_case', 'audit_log']);
      entityId = 'batch-export';
      details = {
        format: pick(['csv', 'json']),
        recordCount: randInt(10, 500),
        exportedBy: pick(PERSONAS),
      };
    } else if (actionType < 0.65) {
      action = ACTIONS.CONFIG_UPDATE;
      entityType = 'system';
      entityId = 'config';
      details = {
        setting: pick(['pagination.pageSize', 'notifications.enabled', 'alertPollingInterval']),
        previousValue: String(randInt(10, 100)),
        newValue: String(randInt(10, 100)),
      };
    } else if (actionType < 0.8) {
      action = ACTIONS.SELLER_STATUS_CHANGE;
      entityType = 'seller';
      entityId = `SELL-${String(randInt(1, 12)).padStart(4, '0')}`;
      details = {
        previousStatus: pick(['active', 'watchlist']),
        newStatus: pick(['active', 'watchlist', 'suspended']),
        reason: pick(['Performance review', 'Defect rate exceeded threshold', 'Compliance issue resolved']),
      };
    } else if (actionType < 0.9) {
      action = ACTIONS.CHECKLIST_TEMPLATE_CREATE;
      entityType = 'checklist_template';
      entityId = `TMPL-${String(randInt(1, 10)).padStart(4, '0')}`;
      details = {
        templateName: `QC Checklist Template ${randInt(1, 10)}`,
        productTypes: [pick(['conventional', 'FHA', 'VA', 'jumbo', 'USDA'])],
        itemCount: randInt(5, 30),
      };
    } else {
      action = ACTIONS.SAMPLING_CONFIG_SAVE;
      entityType = 'sampling_config';
      entityId = `SMPL-${String(randInt(1, 5)).padStart(4, '0')}`;
      details = {
        methodology: pick(['random', 'risk_based', 'targeted', 'threshold']),
        sampleRate: randInt(5, 25),
        isActive: rng() > 0.3,
      };
    }

    entries.push({
      id: `AUD-${String(startIndex + i + 1).padStart(6, '0')}`,
      timestamp: generateTimestamp(),
      persona: pick(PERSONAS),
      action,
      entityType,
      entityId,
      details,
      ipAddress: '127.0.0.1 (mock)',
      sessionId: pick(SESSION_IDS),
    });
  }

  return entries;
};

/**
 * Generates the full array of mock audit log entries.
 * Produces approximately 500-600 audit entries spanning 6 months of history
 * with deterministic pseudo-random data across all modules.
 * @returns {AuditEntry[]}
 */
export const seedAuditLog = () => {
  const allEntries = [];

  let currentIndex = 0;

  for (let i = 0; i < 50; i++) {
    const loanEntries = generateLoanIntakeAudit(currentIndex, i);
    allEntries.push(...loanEntries);
    currentIndex += loanEntries.length;
  }

  for (let i = 0; i < 20; i++) {
    const ruleEntries = generateRuleManagementAudit(currentIndex, i);
    allEntries.push(...ruleEntries);
    currentIndex += ruleEntries.length;
  }

  for (let i = 0; i < 40; i++) {
    const qcEntries = generateQCReviewAudit(currentIndex, i);
    allEntries.push(...qcEntries);
    currentIndex += qcEntries.length;
  }

  for (let i = 0; i < 30; i++) {
    const defectEntries = generateDefectManagementAudit(currentIndex, i);
    allEntries.push(...defectEntries);
    currentIndex += defectEntries.length;
  }

  for (let i = 0; i < 25; i++) {
    const remedyEntries = generateRemedyWorkflowAudit(currentIndex, i);
    allEntries.push(...remedyEntries);
    currentIndex += remedyEntries.length;
  }

  for (let i = 0; i < 15; i++) {
    const repurchaseEntries = generateRepurchaseWorkflowAudit(currentIndex, i);
    allEntries.push(...repurchaseEntries);
    currentIndex += repurchaseEntries.length;
  }

  const miscEntries = generateMiscellaneousAudit(currentIndex, 80);
  allEntries.push(...miscEntries);

  allEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const reindexedEntries = allEntries.map((entry, index) => ({
    ...entry,
    id: `AUD-${String(index + 1).padStart(6, '0')}`,
  }));

  return reindexedEntries;
};

export default seedAuditLog;