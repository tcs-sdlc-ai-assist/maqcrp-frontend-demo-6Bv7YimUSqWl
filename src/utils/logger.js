import { PII_FIELDS } from '../config';

/**
 * PII-safe console logging utility.
 *
 * Provides debug(), info(), warn(), and error() functions that automatically
 * strip PII fields from logged objects before writing to the console.
 *
 * In production (NODE_ENV === 'production'), debug() and info() are no-ops
 * to prevent accidental exposure of sensitive data in production logs.
 *
 * @module logger
 */

/**
 * Set of PII field names for fast lookup during sanitization.
 * Built from the PII_FIELDS constant in config.js.
 * @type {Set<string>}
 */
const PII_FIELD_SET = new Set(PII_FIELDS.map((f) => f.field));

/**
 * Maximum depth for recursive object sanitization to prevent
 * infinite loops from circular references.
 * @type {number}
 */
const MAX_SANITIZE_DEPTH = 10;

/**
 * Placeholder string used to replace PII values in logged objects.
 * @type {string}
 */
const PII_PLACEHOLDER = '[REDACTED]';

/**
 * WeakSet used to track objects already visited during sanitization
 * to prevent infinite recursion from circular references.
 * @type {WeakSet<Object>}
 */
const visitedObjects = new WeakSet();

/**
 * Checks if the current environment is production.
 * @returns {boolean}
 */
const isProduction = () => {
  try {
    return import.meta.env.MODE === 'production';
  } catch {
    return false;
  }
};

/**
 * Checks if a value is a plain object (not null, not an array, not a Date, etc.).
 * @param {*} value - The value to check.
 * @returns {boolean}
 */
const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  if (value instanceof Date) {
    return false;
  }

  if (value instanceof Error) {
    return false;
  }

  if (value instanceof Map || value instanceof Set) {
    return false;
  }

  if (value instanceof RegExp) {
    return false;
  }

  return true;
};

/**
 * Recursively sanitizes an object by replacing PII field values with a placeholder.
 * Handles nested objects, arrays, and circular references.
 *
 * @param {*} data - The data to sanitize.
 * @param {number} [depth=0] - Current recursion depth.
 * @returns {*} The sanitized copy of the data.
 */
const sanitizeObject = (data, depth = 0) => {
  if (depth > MAX_SANITIZE_DEPTH) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
    };
  }

  if (data instanceof RegExp) {
    return data.toString();
  }

  if (visitedObjects.has(data)) {
    return '[CIRCULAR_REFERENCE]';
  }

  if (Array.isArray(data)) {
    visitedObjects.add(data);
    const sanitized = data.map((item) => sanitizeObject(item, depth + 1));
    visitedObjects.delete(data);
    return sanitized;
  }

  if (isPlainObject(data)) {
    visitedObjects.add(data);
    const sanitized = {};

    for (const key of Object.keys(data)) {
      if (PII_FIELD_SET.has(key)) {
        sanitized[key] = PII_PLACEHOLDER;
      } else {
        sanitized[key] = sanitizeObject(data[key], depth + 1);
      }
    }

    visitedObjects.delete(data);
    return sanitized;
  }

  return data;
};

/**
 * Sanitizes all arguments passed to a log function.
 * Each argument is processed: PII fields in objects are replaced with placeholders.
 * Primitive values are passed through unchanged.
 *
 * @param {Array<*>} args - The arguments to sanitize.
 * @returns {Array<*>} The sanitized arguments.
 */
const sanitizeArgs = (args) => {
  visitedObjects.clear();

  return args.map((arg) => {
    if (arg === null || arg === undefined) {
      return arg;
    }

    if (typeof arg === 'string') {
      return arg;
    }

    if (typeof arg === 'number' || typeof arg === 'boolean') {
      return arg;
    }

    if (typeof arg === 'object') {
      return sanitizeObject(arg);
    }

    return arg;
  });
};

/**
 * Logs a debug-level message.
 * In production, this is a no-op.
 *
 * @param {...*} args - Values to log.
 *
 * @example
 * debug('Processing loan', { borrowerName: 'Jane Doe', loanAmount: 250000 });
 * // In development: logs 'Processing loan' with borrowerName replaced by '[REDACTED]'
 * // In production: no-op
 */
export const debug = (...args) => {
  if (isProduction()) {
    return;
  }

  const sanitized = sanitizeArgs(args);
  console.debug(...sanitized);
};

/**
 * Logs an info-level message.
 * In production, this is a no-op.
 *
 * @param {...*} args - Values to log.
 *
 * @example
 * info('Loan pipeline updated', { count: 42, updatedBy: 'system' });
 * // In development: logs the message
 * // In production: no-op
 */
export const info = (...args) => {
  if (isProduction()) {
    return;
  }

  const sanitized = sanitizeArgs(args);
  console.info(...sanitized);
};

/**
 * Logs a warning-level message.
 * Always logs regardless of environment.
 *
 * @param {...*} args - Values to log.
 *
 * @example
 * warn('High risk score detected', { score: 85, borrowerName: 'Jane Doe' });
 * // Logs with borrowerName replaced by '[REDACTED]'
 */
export const warn = (...args) => {
  const sanitized = sanitizeArgs(args);
  console.warn(...sanitized);
};

/**
 * Logs an error-level message.
 * Always logs regardless of environment.
 * Error objects are preserved with their name, message, and stack trace.
 *
 * @param {...*} args - Values to log.
 *
 * @example
 * error('Failed to process loan', new Error('Validation failed'), { loanId: 'LN-12345' });
 * // Logs the error with full stack trace, PII fields in context objects are redacted
 */
export const error = (...args) => {
  const sanitized = sanitizeArgs(args);
  console.error(...sanitized);
};

/**
 * Creates a logger instance with a specific context prefix.
 * All log messages from the returned logger will be prefixed with the context string.
 *
 * @param {string} context - The context prefix for log messages (e.g., 'LoanService', 'RiskEngine').
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 *
 * @example
 * const loanLogger = create