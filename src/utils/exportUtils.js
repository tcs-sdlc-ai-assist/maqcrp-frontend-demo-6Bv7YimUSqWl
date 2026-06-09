import { formatDate } from './dateUtils';

/**
 * Sanitizes a filename by removing or replacing characters that are invalid
 * in file systems (Windows, macOS, Linux).
 *
 * Replaces characters that are not alphanumeric, hyphens, underscores, or periods
 * with underscores. Collapses multiple underscores into one. Trims leading/trailing
 * underscores and periods.
 *
 * @param {string} name - The raw filename to sanitize.
 * @returns {string} The sanitized filename.
 *
 * @example
 * sanitizeFilename('My Report (2024).csv')
 * // Returns 'My_Report_2024.csv'
 *
 * @example
 * sanitizeFilename('../../../etc/passwd')
 * // Returns 'etc_passwd'
 */
export const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') {
    return 'export';
  }

  let sanitized = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '');

  if (sanitized.length === 0) {
    return 'export';
  }

  if (sanitized.length > 255) {
    const dotIndex = sanitized.lastIndexOf('.');
    if (dotIndex > 0) {
      const ext = sanitized.slice(dotIndex);
      const base = sanitized.slice(0, dotIndex);
      sanitized = base.slice(0, 255 - ext.length) + ext;
    } else {
      sanitized = sanitized.slice(0, 255);
    }
  }

  return sanitized;
};

/**
 * Escapes a single CSV field value according to RFC 4180.
 * If the value contains commas, double quotes, or newlines, it is wrapped
 * in double quotes and any internal double quotes are escaped by doubling them.
 *
 * @param {*} value - The field value to escape.
 * @returns {string} The escaped CSV field value.
 *
 * @example
 * escapeCSVField('hello')
 * // Returns 'hello'
 *
 * @example
 * escapeCSVField('hello, world')
 * // Returns '"hello, world"'
 *
 * @example
 * escapeCSVField('say "hello"')
 * // Returns '"say ""hello"""'
 */
const escapeCSVField = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Formats an array of values into a single CSV row string according to RFC 4180.
 * Each value is properly escaped and joined with commas. The row is terminated
 * with a CRLF line ending.
 *
 * @param {Array<*>} row - Array of values representing a single CSV row.
 * @returns {string} The formatted CSV row string.
 *
 * @example
 * formatCSVRow(['Name', 'Age', 'City'])
 * // Returns 'Name,Age,City\r\n'
 *
 * @example
 * formatCSVRow(['Doe, John', 30, 'New York'])
 * // Returns '"Doe, John",30,New York\r\n'
 */
export const formatCSVRow = (row) => {
  if (!Array.isArray(row)) {
    return '\r\n';
  }

  const escapedFields = row.map((field) => escapeCSVField(field));
  return escapedFields.join(',') + '\r\n';
};

/**
 * Extracts column headers from an array of objects.
 * Collects all unique keys from all objects in the array, preserving
 * the order of first appearance.
 *
 * @param {Array<Object>} data - Array of data objects.
 * @returns {string[]} Array of unique column header names.
 */
const extractHeaders = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const headerSet = new Set();

  for (const item of data) {
    if (item && typeof item === 'object') {
      for (const key of Object.keys(item)) {
        headerSet.add(key);
      }
    }
  }

  return Array.from(headerSet);
};

/**
 * Converts a value to a CSV-safe string representation.
 * Handles Date objects by formatting them as ISO date strings.
 * Handles arrays and objects by JSON-stringifying them.
 *
 * @param {*} value - The value to convert.
 * @returns {string} The string representation for CSV output.
 */
const valueToCSVString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return formatDate(value, 'yyyy-MM-dd');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

/**
 * Generates a CSV string from an array of data objects according to RFC 4180.
 * The first row contains column headers extracted from the data objects.
 * Each subsequent row contains the values for each object.
 *
 * @param {Array<Object>} data - Array of data objects to convert to CSV.
 * @param {Object} [options] - CSV generation options.
 * @param {string[]} [options.columns] - Specific columns to include, in order. If omitted, all columns are included.
 * @param {boolean} [options.includeHeaders=true] - Whether to include a header row.
 * @returns {string} The generated CSV string.
 *
 * @example
 * generateCSV([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }])
 * // Returns 'name,age\r\nAlice,30\r\nBob,25\r\n'
 */
const generateCSV = (data, options = {}) => {
  const { columns, includeHeaders = true } = options;

  if (!Array.isArray(data) || data.length === 0) {
    return includeHeaders && columns && columns.length > 0
      ? formatCSVRow(columns)
      : '';
  }

  const headers = columns || extractHeaders(data);

  if (headers.length === 0) {
    return '';
  }

  const rows = [];

  if (includeHeaders) {
    rows.push(formatCSVRow(headers));
  }

  for (const item of data) {
    if (item && typeof item === 'object') {
      const rowValues = headers.map((header) => valueToCSVString(item[header]));
      rows.push(formatCSVRow(rowValues));
    }
  }

  return rows.join('');
};

/**
 * Triggers a file download in the browser using a Blob and a temporary anchor element.
 * Creates an object URL, programmatically clicks a download link, and then revokes
 * the object URL to free memory.
 *
 * @param {Blob} blob - The Blob containing the file data.
 * @param {string} filename - The filename for the downloaded file.
 */
const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * Exports an array of data objects as a CSV file and triggers a browser download.
 * The CSV is generated according to RFC 4180 with proper escaping of special characters.
 * The filename is sanitized to prevent filesystem issues.
 *
 * @param {Array<Object>} data - Array of data objects to export.
 * @param {string} filename - The desired filename (without extension, will be appended with .csv).
 * @param {Object} [options] - Export options.
 * @param {string[]} [options.columns] - Specific columns to include, in order.
 * @param {boolean} [options.includeHeaders=true] - Whether to include a header row.
 * @returns {boolean} True if the export was successful, false if there was an error.
 *
 * @example
 * const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
 * exportToCSV(data, 'users-report');
 * // Downloads a file named 'users-report.csv'
 *
 * @example
 * exportToCSV(data, 'users-report', { columns: ['name'], includeHeaders: false });
 * // Downloads a CSV with only the name column and no header row
 */
export const exportToCSV = (data, filename, options = {}) => {
  try {
    if (!Array.isArray(data)) {
      console.error('exportToCSV: data must be an array');
      return false;
    }

    const sanitizedFilename = sanitizeFilename(filename);
    const csvContent = generateCSV(data, options);

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const fullFilename = sanitizedFilename.endsWith('.csv')
      ? sanitizedFilename
      : `${sanitizedFilename}.csv`;

    triggerDownload(blob, fullFilename);

    return true;
  } catch (error) {
    console.error('exportToCSV: Failed to export CSV', error);
    return false;
  }
};

/**
 * Exports data as a formatted JSON file and triggers a browser download.
 * The JSON is pretty-printed with 2-space indentation for readability.
 * The filename is sanitized to prevent filesystem issues.
 *
 * @param {*} data - The data to export as JSON. Can be any JSON-serializable value.
 * @param {string} filename - The desired filename (without extension, will be appended with .json).
 * @param {Object} [options] - Export options.
 * @param {boolean} [options.pretty=true] - Whether to pretty-print the JSON with indentation.
 * @param {number} [options.indent=2] - Number of spaces for indentation when pretty is true.
 * @returns {boolean} True if the export was successful, false if there was an error.
 *
 * @example
 * const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
 * exportToJSON(data, 'users-export');
 * // Downloads a file named 'users-export.json'
 *
 * @example
 * exportToJSON(data, 'users-export', { pretty: false });
 * // Downloads a minified JSON file
 */
export const exportToJSON = (data, filename, options = {}) => {
  try {
    const { pretty = true, indent = 2 } = options;

    if (data === undefined) {
      console.error('exportToJSON: data is undefined');
      return false;
    }

    const sanitizedFilename = sanitizeFilename(filename);

    let jsonContent;

    try {
      jsonContent = pretty
        ? JSON.stringify(data, null, indent)
        : JSON.stringify(data);
    } catch (stringifyError) {
      console.error('exportToJSON: Failed to stringify data', stringifyError);
      return false;
    }

    const blob = new Blob([jsonContent], {
      type: 'application/json;charset=utf-8;',
    });

    const fullFilename = sanitizedFilename.endsWith('.json')
      ? sanitizedFilename
      : `${sanitizedFilename}.json`;

    triggerDownload(blob, fullFilename);

    return true;
  } catch (error) {
    console.error('exportToJSON: Failed to export JSON', error);
    return false;
  }
};

/**
 * Exports data as a tab-separated values (TSV) file and triggers a browser download.
 * Useful for data that may contain commas, or for compatibility with spreadsheet
 * applications that prefer tab-separated input.
 *
 * @param {Array<Object>} data - Array of data objects to export.
 * @param {string} filename - The desired filename (without extension, will be appended with .tsv).
 * @param {Object} [options] - Export options.
 * @param {string[]} [options.columns] - Specific columns to include, in order.
 * @param {boolean} [options.includeHeaders=true] - Whether to include a header row.
 * @returns {boolean} True if the export was successful, false if there was an error.
 *
 * @example
 * const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
 * exportToTSV(data, 'users-report');
 * // Downloads a file named 'users-report.tsv'
 */
export const exportToTSV = (data, filename, options = {}) => {
  try {
    if (!Array.isArray(data)) {
      console.error('exportToTSV: data must be an array');
      return false;
    }

    const sanitizedFilename = sanitizeFilename(filename);
    const csvContent = generateCSV(data, options);
    const tsvContent = csvContent.replace(/,/g, '\t');

    const blob = new Blob([tsvContent], {
      type: 'text/tab-separated-values;charset=utf-8;',
    });

    const fullFilename = sanitizedFilename.endsWith('.tsv')
      ? sanitizedFilename
      : `${sanitizedFilename}.tsv`;

    triggerDownload(blob, fullFilename);

    return true;
  } catch (error) {
    console.error('exportToTSV: Failed to export TSV', error);
    return false;
  }
};

/**
 * Generates a timestamped filename for exports.
 * Uses the format: {prefix}-{YYYY-MM-DD}-{HHmmss}
 *
 * @param {string} [prefix='export'] - Prefix for the filename.
 * @returns {string} The generated filename with timestamp.
 *
 * @example
 * generateExportFilename('risk-report')
 * // Returns 'risk-report-2026-06-09-143025'
 */
export const generateExportFilename = (prefix = 'export') => {
  const now = new Date();
  const datePart = formatDate(now, 'yyyy-MM-dd');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timePart = `${hours}${minutes}${seconds}`;

  return `${prefix}-${datePart}-${timePart}`;
};

/**
 * Exports data in multiple formats simultaneously.
 * Triggers separate downloads for each requested format.
 *
 * @param {Array<Object>} data - Array of data objects to export.
 * @param {string} filename - The base filename (without extension).
 * @param {Object} [options] - Export options.
 * @param {boolean} [options.csv=true] - Whether to export as CSV.
 * @param {boolean} [options.json=true] - Whether to export as JSON.
 * @param {boolean} [options.tsv=false] - Whether to export as TSV.
 * @param {string[]} [options.columns] - Specific columns to include.
 * @returns {{ csv: boolean, json: boolean, tsv: boolean }} Object indicating success/failure for each format.
 *
 * @example
 * exportMultiple(data, 'report', { csv: true, json: true })
 * // Downloads both 'report.csv' and 'report.json'
 */
export const exportMultiple = (data, filename, options = {}) => {
  const { csv = true, json = true, tsv = false, columns } = options;

  const results = {
    csv: false,
    json: false,
    tsv: false,
  };

  if (csv) {
    results.csv = exportToCSV(data, filename, { columns });
  }

  if (json) {
    results.json = exportToJSON(data, filename);
  }

  if (tsv) {
    results.tsv = exportToTSV(data, filename, { columns });
  }

  return results;
};