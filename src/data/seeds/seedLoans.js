import { addDays, subDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} Loan
 * @property {string} id
 * @property {string} borrowerName
 * @property {string} ssn
 * @property {string} propertyAddress
 * @property {number} loanAmount
 * @property {string} productType
 * @property {string} channel
 * @property {string} sellerId
 * @property {string} [borrowerAddress]
 * @property {number} [borrowerIncome]
 * @property {number} [creditScore]
 * @property {string} [accountNumber]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [loanPurpose]
 * @property {number} [ltv]
 * @property {number} [dti]
 * @property {string} status
 * @property {Object|null} decisionResult
 * @property {Array<Object>} documents
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const PRODUCT_TYPES = ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];
const CHANNELS = ['retail', 'correspondent', 'broker', 'wholesale'];
const LOAN_PURPOSES = ['purchase', 'refinance', 'cash-out'];
const STATUSES = [
  'PENDING_VALIDATION',
  'VALIDATED',
  'PASS',
  'FAIL',
  'EXCEPTION',
  'OVERRIDDEN',
];

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Dorothy', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna',
  'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
  'Timothy', 'Deborah', 'Ronald', 'Stephanie',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts', 'Gomez',
];

const STREETS = [
  '123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm Dr', '654 Maple Ln',
  '987 Cedar Ct', '147 Birch Blvd', '258 Walnut Way', '369 Cherry Cir', '741 Spruce Pl',
  '852 Ash St', '963 Willow Dr', '159 Poplar Ave', '753 Hickory Rd', '951 Sycamore Ln',
  '357 Magnolia Ct', '486 Dogwood Blvd', '159 Redwood Way', '268 Juniper Cir', '374 Cypress Pl',
  '582 Laurel St', '693 Alder Dr', '417 Beech Ave', '825 Hemlock Rd', '136 Fir Ln',
  '249 Spruce Ct', '368 Aspen Blvd', '475 Linden Way', '589 Cottonwood Cir', '694 Sequoia Pl',
];

const CITIES = [
  'Springfield', 'Riverside', 'Franklin', 'Greenville', 'Fairview',
  'Madison', 'Georgetown', 'Arlington', 'Centerville', 'Liberty',
  'Kingston', 'Newport', 'Ashland', 'Burlington', 'Manchester',
  'Clayton', 'Milton', 'Oxford', 'Clinton', 'Auburn',
];

const STATES = [
  'IL', 'CA', 'TX', 'FL', 'NY', 'PA', 'OH', 'GA', 'NC', 'MI',
  'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI',
];

const SELLER_IDS = [
  'SELL-0001', 'SELL-0002', 'SELL-0003', 'SELL-0004', 'SELL-0005',
  'SELL-0006', 'SELL-0007', 'SELL-0008', 'SELL-0009', 'SELL-0010',
];

const DOCUMENT_TYPES = [
  'income_verification', 'asset_verification', 'credit_report',
  'appraisal', 'title_report', 'insurance', 'tax_return',
  'bank_statement', 'employment_verification', 'gift_letter',
];

const DOCUMENT_STATUSES = ['verified', 'pending', 'rejected', 'not_required'];

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
 * Generates a fake SSN string in XXX-XX-XXXX format.
 * @returns {string}
 */
const generateSSN = () => {
  const area = randInt(100, 899);
  const group = randInt(10, 99);
  const serial = randInt(1000, 9999);
  return `${String(area).padStart(3, '0')}-${String(group).padStart(2, '0')}-${String(serial).padStart(4, '0')}`;
};

/**
 * Generates a fake phone number in (XXX) XXX-XXXX format.
 * @returns {string}
 */
const generatePhone = () => {
  const area = randInt(200, 999);
  const prefix = randInt(200, 999);
  const line = randInt(1000, 9999);
  return `(${area}) ${prefix}-${line}`;
};

/**
 * Generates a fake email address from first and last name.
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string}
 */
const generateEmail = (firstName, lastName) => {
  const domains = ['example.com', 'email.com', 'mail.org', 'web.net'];
  const domain = pick(domains);
  const separator = rng() > 0.5 ? '.' : '_';
  return `${firstName.toLowerCase()}${separator}${lastName.toLowerCase()}@${domain}`;
};

/**
 * Generates a fake account number in LN-XXXXXXXX format.
 * @returns {string}
 */
const generateAccountNumber = () => {
  const num = randInt(10000000, 99999999);
  return `LN-${num}`;
};

/**
 * Generates a fake property address.
 * @returns {string}
 */
const generatePropertyAddress = () => {
  const street = pick(STREETS);
  const city = pick(CITIES);
  const state = pick(STATES);
  const zip = randInt(10000, 99999);
  return `${street}, ${city}, ${state} ${zip}`;
};

/**
 * Generates a fake borrower address (different from property address).
 * @returns {string}
 */
const generateBorrowerAddress = () => {
  const street = pick(STREETS);
  const city = pick(CITIES);
  const state = pick(STATES);
  const zip = randInt(10000, 99999);
  return `${street}, ${city}, ${state} ${zip}`;
};

/**
 * Generates mock document metadata for a loan.
 * @param {string} loanId
 * @param {string} createdAt
 * @returns {Array<Object>}
 */
const generateDocuments = (loanId, createdAt) => {
  const docCount = randInt(2, 6);
  const docs = [];
  const usedTypes = new Set();

  for (let i = 0; i < docCount; i++) {
    let docType;
    do {
      docType = pick(DOCUMENT_TYPES);
    } while (usedTypes.has(docType) && usedTypes.size < DOCUMENT_TYPES.length);
    usedTypes.add(docType);

    const docDate = subDays(new Date(createdAt), randInt(0, 30));

    docs.push({
      id: `DOC-${String(randInt(1, 9999)).padStart(4, '0')}`,
      name: `${docType.replace(/_/g, '_')}_${format(docDate, 'MMM_yyyy')}.pdf`,
      type: docType,
      uploadDate: docDate.toISOString(),
      status: pick(DOCUMENT_STATUSES),
    });
  }

  return docs;
};

/**
 * Determines the loan status based on index to ensure a realistic distribution.
 * @param {number} index
 * @returns {string}
 */
const determineStatus = (index) => {
  if (index < 5) return 'PENDING_VALIDATION';
  if (index < 15) return 'VALIDATED';
  if (index < 30) return 'PASS';
  if (index < 38) return 'FAIL';
  if (index < 45) return 'EXCEPTION';
  return 'OVERRIDDEN';
};

/**
 * Generates a single mock loan record.
 * @param {number} index - The loan index (0-based).
 * @returns {Loan}
 */
const generateLoan = (index) => {
  const id = `LOAN-${String(index + 1).padStart(4, '0')}`;
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const borrowerName = `${firstName} ${lastName}`;
  const productType = pick(PRODUCT_TYPES);
  const channel = pick(CHANNELS);
  const sellerId = pick(SELLER_IDS);
  const status = determineStatus(index);

  const daysAgo = randInt(0, 180);
  const createdAt = subDays(REFERENCE_DATE, daysAgo);
  const updatedAt = addDays(createdAt, randInt(0, Math.min(daysAgo, 14)));

  const loanAmount = (() => {
    switch (productType) {
      case 'jumbo':
        return randInt(726201, 2000000);
      case 'FHA':
        return randInt(80000, 472030);
      case 'VA':
        return randInt(100000, 726200);
      case 'USDA':
        return randInt(50000, 350000);
      default:
        return randInt(75000, 726200);
    }
  })();

  const creditScore = randInt(500, 850);
  const ltv = randFloat(50, 105, 1);
  const dti = randFloat(15, 55, 1);
  const borrowerIncome = randInt(30000, 500000);

  const loan = {
    id,
    borrowerName,
    ssn: generateSSN(),
    propertyAddress: generatePropertyAddress(),
    loanAmount,
    productType,
    channel,
    sellerId,
    borrowerAddress: rng() > 0.3 ? generateBorrowerAddress() : undefined,
    borrowerIncome: rng() > 0.2 ? borrowerIncome : undefined,
    creditScore: rng() > 0.15 ? creditScore : undefined,
    accountNumber: generateAccountNumber(),
    email: generateEmail(firstName, lastName),
    phone: generatePhone(),
    loanPurpose: rng() > 0.25 ? pick(LOAN_PURPOSES) : undefined,
    ltv: rng() > 0.2 ? ltv : undefined,
    dti: rng() > 0.2 ? dti : undefined,
    status,
    decisionResult: null,
    documents: generateDocuments(id, createdAt.toISOString()),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };

  return loan;
};

/**
 * Generates the full array of mock loan records.
 * Produces exactly 50 loans with deterministic pseudo-random data.
 * @returns {Loan[]}
 */
export const seedLoans = () => {
  const loans = [];

  for (let i = 0; i < 50; i++) {
    loans.push(generateLoan(i));
  }

  return loans;
};

export default seedLoans;