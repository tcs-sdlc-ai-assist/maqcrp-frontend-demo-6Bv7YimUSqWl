import { subDays, format } from 'date-fns';
import { REFERENCE_DATE } from '../../config';

/**
 * @typedef {Object} Seller
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} status
 * @property {string} contactName
 * @property {string} contactEmail
 * @property {string} contactPhone
 * @property {Object} performanceMetrics
 * @property {number} performanceMetrics.totalLoans
 * @property {number} performanceMetrics.defectRate
 * @property {number} performanceMetrics.passRate
 * @property {number} performanceMetrics.avgRemedyResponseDays
 * @property {number} performanceMetrics.openExposure
 * @property {number} performanceMetrics.watchlistCount
 * @property {string} onboardingDate
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const SELLER_NAMES = [
  'First National Mortgage',
  'Pacific Coast Lending',
  'Heartland Home Finance',
  'Summit Mortgage Group',
  'Liberty Loan Corporation',
  'Golden State Funding',
  'Capital City Mortgage',
  'Blue Ridge Lending Partners',
  'Prairie Home Loans',
  'Atlantic Financial Services',
  'Evergreen Mortgage Solutions',
  'Metroplex Funding Group',
];

const SELLER_TYPES = ['seller', 'servicer', 'both'];

const SELLER_STATUSES = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'watchlist', 'watchlist', 'active', 'active', 'suspended'];

const CONTACT_FIRST_NAMES = [
  'Robert', 'Maria', 'James', 'Patricia', 'Michael', 'Linda', 'William', 'Barbara',
  'Richard', 'Susan', 'Joseph', 'Jessica',
];

const CONTACT_LAST_NAMES = [
  'Chen', 'Garcia', 'Williams', 'Johnson', 'Brown', 'Martinez', 'Anderson', 'Taylor',
  'Thomas', 'Jackson', 'White', 'Harris',
];

const EMAIL_DOMAINS = ['example.com', 'mortgage.example.com', 'lending.example.com', 'finance.example.com'];

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
  const domain = pick(EMAIL_DOMAINS);
  const separator = rng() > 0.5 ? '.' : '';
  return `${firstName.toLowerCase()}${separator}${lastName.toLowerCase()}@${domain}`;
};

/**
 * Generates performance metrics for a seller based on their status.
 * Sellers with watchlist/suspended status have worse metrics.
 * @param {string} status
 * @returns {Object}
 */
const generatePerformanceMetrics = (status) => {
  const isProblematic = status === 'watchlist' || status === 'suspended';

  const totalLoans = randInt(80, 500);
  const defectRate = isProblematic ? randFloat(0.05, 0.15, 3) : randFloat(0.01, 0.05, 3);
  const passRate = isProblematic ? randFloat(0.75, 0.90, 3) : randFloat(0.90, 0.99, 3);
  const avgRemedyResponseDays = isProblematic ? randFloat(8, 25, 1) : randFloat(1, 7, 1);
  const openExposure = isProblematic ? randInt(500000, 3000000) : randInt(0, 500000);
  const watchlistCount = isProblematic ? randInt(1, 5) : 0;

  return {
    totalLoans,
    defectRate,
    passRate,
    avgRemedyResponseDays,
    openExposure,
    watchlistCount,
  };
};

/**
 * Generates a single mock seller record.
 * @param {number} index - The seller index (0-based).
 * @returns {Seller}
 */
const generateSeller = (index) => {
  const id = `SELL-${String(index + 1).padStart(4, '0')}`;
  const name = SELLER_NAMES[index];
  const type = pick(SELLER_TYPES);
  const status = SELLER_STATUSES[index];
  const firstName = CONTACT_FIRST_NAMES[index];
  const lastName = CONTACT_LAST_NAMES[index];
  const contactName = `${firstName} ${lastName}`;
  const contactEmail = generateEmail(firstName, lastName);
  const contactPhone = generatePhone();

  const onboardingDaysAgo = randInt(180, 1095);
  const onboardingDate = subDays(REFERENCE_DATE, onboardingDaysAgo);

  const updatedDaysAgo = randInt(0, 7);
  const updatedAt = subDays(REFERENCE_DATE, updatedDaysAgo);

  const performanceMetrics = generatePerformanceMetrics(status);

  return {
    id,
    name,
    type,
    status,
    contactName,
    contactEmail,
    contactPhone,
    performanceMetrics,
    onboardingDate: format(onboardingDate, 'yyyy-MM-dd'),
    createdAt: onboardingDate.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

/**
 * Generates the full array of mock seller/servicer records.
 * Produces exactly 12 counterparties with deterministic pseudo-random data.
 * @returns {Seller[]}
 */
export const seedSellers = () => {
  const sellers = [];

  for (let i = 0; i < 12; i++) {
    sellers.push(generateSeller(i));
  }

  return sellers;
};

export default seedSellers;