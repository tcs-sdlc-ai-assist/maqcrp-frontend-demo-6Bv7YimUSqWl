import { format } from 'date-fns';

/**
 * Formats a number as a currency string using locale-aware formatting.
 * Defaults to USD with 2 decimal places.
 * @param {number} amount - The monetary amount to format.
 * @param {string} [currency='USD'] - ISO 4217 currency code.
 * @param {string} [locale='en-US'] - BCP 47 language tag for locale formatting.
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  if (amount == null || isNaN(amount)) {
    return '';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

/**
 * Formats a value as a percentage string with the specified number of decimal places.
 * The input value should be a decimal (e.g., 0.156 for 15.6%).
 * @param {number} value - The decimal value to format as a percentage.
 * @param {number} [decimals=1] - Number of decimal places to display.
 * @param {string} [locale='en-US'] - BCP 47 language tag for locale formatting.
 * @returns {string}
 */
export const formatPercentage = (value, decimals = 1, locale = 'en-US') => {
  if (value == null || isNaN(value)) {
    return '';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(decimals)}%`;
  }
};

/**
 * Formats a number with locale-aware grouping separators and the specified number of decimal places.
 * @param {number} value - The number to format.
 * @param {number} [decimals=0] - Number of decimal places to display.
 * @param {string} [locale='en-US'] - BCP 47 language tag for locale formatting.
 * @returns {string}
 */
export const formatNumber = (value, decimals = 0, locale = 'en-US') => {
  if (value == null || isNaN(value)) {
    return '';
  }

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
};

/**
 * Formats a Social Security Number (SSN) as XXX-XX-XXXX.
 * Accepts a 9-digit string or number, with or without existing dashes.
 * Returns the original value if it cannot be formatted.
 * @param {string|number} ssn - The SSN value to format.
 * @returns {string}
 */
export const formatSSN = (ssn) => {
  if (ssn == null) {
    return '';
  }

  const cleaned = String(ssn).replace(/\D/g, '');

  if (cleaned.length !== 9) {
    return String(ssn);
  }

  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
};

/**
 * Formats a US phone number as (XXX) XXX-XXXX.
 * Accepts a 10-digit string or number, with or without existing formatting.
 * Returns the original value if it cannot be formatted.
 * @param {string|number} phone - The phone number to format.
 * @returns {string}
 */
export const formatPhone = (phone) => {
  if (phone == null) {
    return '';
  }

  const cleaned = String(phone).replace(/\D/g, '');

  if (cleaned.length !== 10) {
    return String(phone);
  }

  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

/**
 * Formats an account number by masking all but the last 4 digits.
 * Preserves the original length with asterisks for masked characters.
 * Returns the original value if it is fewer than 5 characters.
 * @param {string|number} accountNumber - The account number to format.
 * @returns {string}
 */
export const formatAccountNumber = (accountNumber) => {
  if (accountNumber == null) {
    return '';
  }

  const cleaned = String(accountNumber).replace(/\s/g, '');

  if (cleaned.length < 5) {
    return cleaned;
  }

  const lastFour = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);

  return `${masked}${lastFour}`;
};

/**
 * Formats a date string or Date object using the specified format pattern.
 * Wraps date-fns format for consistent usage across the application.
 * @param {Date|string} date - The date to format.
 * @param {string} [formatStr='yyyy-MM-dd'] - The date-fns format string.
 * @returns {string}
 */
export const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  if (!date) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return format(dateObj, formatStr);
};

/**
 * Formats a file size in bytes to a human-readable string.
 * Uses binary units (KiB, MiB, GiB, TiB).
 * @param {number} bytes - The file size in bytes.
 * @param {number} [decimals=1] - Number of decimal places to display.
 * @returns {string}
 */
export const formatFileSize = (bytes, decimals = 1) => {
  if (bytes == null || isNaN(bytes) || bytes < 0) {
    return '';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const base = 1024;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, exponent);

  return `${value.toFixed(decimals)} ${units[exponent]}`;
};

/**
 * Truncates a string to the specified maximum length, appending an ellipsis if truncated.
 * @param {string} str - The string to truncate.
 * @param {number} [maxLength=50] - Maximum length before truncation.
 * @returns {string}
 */
export const truncateText = (str, maxLength = 50) => {
  if (str == null) {
    return '';
  }

  if (str.length <= maxLength) {
    return str;
  }

  return `${str.slice(0, maxLength).trimEnd()}...`;
};

/**
 * Converts a string to title case, capitalizing the first letter of each word.
 * Handles hyphenated and underscored words by splitting on word boundaries.
 * @param {string} str - The string to convert.
 * @returns {string}
 */
export const toTitleCase = (str) => {
  if (str == null) {
    return '';
  }

  return String(str)
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Formats a duration in milliseconds to a human-readable string.
 * Displays the two most significant units (e.g., "2h 30m" or "45m 12s").
 * @param {number} ms - Duration in milliseconds.
 * @returns {string}
 */
export const formatDuration = (ms) => {
  if (ms == null || isNaN(ms) || ms < 0) {
    return '';
  }

  if (ms === 0) {
    return '0s';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
};