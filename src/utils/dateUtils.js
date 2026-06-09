import { format, addDays, subDays, isAfter, isBefore, differenceInDays, startOfDay } from 'date-fns';
import { REFERENCE_DATE } from '../config';

/**
 * Returns the reference date used across the application for mock data calculations.
 * @returns {Date}
 */
export const getReferenceDate = () => {
  return REFERENCE_DATE;
};

/**
 * Returns a date relative to the reference date by the given offset in days.
 * Positive offset returns a future date, negative offset returns a past date.
 * @param {number} daysOffset - Number of days to offset from the reference date.
 * @returns {Date}
 */
export const getRelativeDate = (daysOffset) => {
  if (daysOffset > 0) {
    return addDays(REFERENCE_DATE, daysOffset);
  }
  if (daysOffset < 0) {
    return subDays(REFERENCE_DATE, Math.abs(daysOffset));
  }
  return REFERENCE_DATE;
};

/**
 * Formats a date using the specified format string.
 * @param {Date} date - The date to format.
 * @param {string} [formatStr='yyyy-MM-dd'] - The date-fns format string.
 * @returns {string}
 */
export const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  return format(date, formatStr);
};

/**
 * SLA deadline durations in days mapped by severity level.
 * @type {Record<string, number>}
 */
const SLA_DEADLINES = {
  CRITICAL: 1,
  HIGH: 3,
  WARNING: 7,
  INFO: 14,
};

/**
 * Calculates the SLA deadline date based on severity and a base date.
 * If no base date is provided, the reference date is used.
 * @param {string} severity - The alert severity level (CRITICAL, HIGH, WARNING, INFO).
 * @param {Date} [baseDate] - The starting date for the SLA calculation. Defaults to reference date.
 * @returns {Date}
 */
export const calculateSlaDeadline = (severity, baseDate) => {
  const startDate = baseDate && !isNaN(baseDate.getTime()) ? baseDate : REFERENCE_DATE;
  const days = SLA_DEADLINES[severity] ?? SLA_DEADLINES.INFO;
  return addDays(startOfDay(startDate), days);
};

/**
 * Checks if a due date has been breached (i.e., the due date is before the reference date).
 * @param {Date} dueDate - The deadline date to check.
 * @returns {boolean}
 */
export const isDateBreached = (dueDate) => {
  if (!dueDate || isNaN(dueDate.getTime())) {
    return false;
  }
  return isBefore(startOfDay(dueDate), startOfDay(REFERENCE_DATE));
};

/**
 * Aging bucket thresholds in days relative to the reference date.
 * @type {Array<{label: string, minDays: number, maxDays: number}>}
 */
const AGING_BUCKETS = [
  { label: 'Current', minDays: -Infinity, maxDays: 0 },
  { label: '1-7 Days', minDays: 1, maxDays: 7 },
  { label: '8-14 Days', minDays: 8, maxDays: 14 },
  { label: '15-30 Days', minDays: 15, maxDays: 30 },
  { label: '31-60 Days', minDays: 31, maxDays: 60 },
  { label: '61-90 Days', minDays: 61, maxDays: 90 },
  { label: 'Over 90 Days', minDays: 91, maxDays: Infinity },
];

/**
 * Determines the aging bucket for a given due date based on how many days
 * have passed since the due date relative to the reference date.
 * Returns 'Unknown' if the due date is invalid.
 * @param {Date} dueDate - The due date to categorize.
 * @returns {string}
 */
export const getAgingBucket = (dueDate) => {
  if (!dueDate || isNaN(dueDate.getTime())) {
    return 'Unknown';
  }

  const daysSinceDue = differenceInDays(startOfDay(REFERENCE_DATE), startOfDay(dueDate));

  for (const bucket of AGING_BUCKETS) {
    if (daysSinceDue >= bucket.minDays && daysSinceDue <= bucket.maxDays) {
      return bucket.label;
    }
  }

  return 'Unknown';
};