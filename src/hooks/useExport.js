import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV as exportCSV, exportToJSON as exportJSON, generateExportFilename } from '../utils/exportUtils';
import { debug, info, warn, error } from '../utils/logger';

const HOOK_NAME = 'useExport';

/**
 * @typedef {Object} ExportResult
 * @property {boolean} success - Whether the export was successful.
 * @property {string} [filename] - The filename that was generated.
 * @property {string} [error] - Error message if the export failed.
 */

/**
 * @typedef {Object} UseExportResult
 * @property {Function} exportToCSV - Exports data as a CSV file with audit logging.
 * @property {Function} exportToJSON - Exports data as a JSON file with audit logging.
 * @property {boolean} isExporting - Whether an export is currently in progress.
 */

/**
 * Custom hook that wraps export utilities with audit logging and loading state management.
 *
 * Provides exportToCSV and exportToJSON functions that:
 * - Log a DASHBOARD_EXPORTED audit event before each export
 * - Track loading state via isExporting
 * - Handle errors gracefully with logging
 * - Prevent concurrent exports
 *
 * @returns {UseExportResult}
 *
 * @example
 * const { exportToCSV, exportToJSON, isExporting } = useExport();
 *
 * // Export data as CSV
 * const result = await exportToCSV(loanData, 'loans-report');
 * if (result.success) {
 *   console.log('Exported to', result.filename);
 * }
 *
 * // Export data as JSON
 * const result = await exportToJSON(defectData, 'defects-export');
 */
export const useExport = () => {
  const { logEvent } = useAudit();
  const { currentPersona } = useAuth();

  const [isExporting, setIsExporting] = useState(false);

  const isMountedRef = useRef(true);
  const exportInProgressRef = useRef(false);

  const personaName = currentPersona?.label || currentPersona?.id || 'Unknown';

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Logs an audit event for the export operation.
   * @param {string} format - The export format ('csv' or 'json').
   * @param {string} filename - The generated filename.
   * @param {number} recordCount - The number of records exported.
   * @param {boolean} success - Whether the export was successful.
   */
  const logExportAudit = useCallback(
    (format, filename, recordCount, success) => {
      try {
        logEvent(
          'DASHBOARD_EXPORTED',
          'export',
          filename || 'batch-export',
          {
            format,
            recordCount,
            success,
            exportedBy: personaName,
          },
          personaName,
        );

        debug(HOOK_NAME, 'Export audit event logged', {
          format,
          filename,
          recordCount,
          success,
        });
      } catch (err) {
        warn(HOOK_NAME, 'Failed to log export audit event', err);
      }
    },
    [logEvent, personaName],
  );

  /**
   * Exports an array of data objects as a CSV file.
   * Logs an audit event and tracks loading state.
   *
   * @param {Array<Object>} data - Array of data objects to export.
   * @param {string} [filename] - Optional filename (without extension). Auto-generated if omitted.
   * @returns {Promise<ExportResult>} Result object indicating success or failure.
   *
   * @example
   * const result = await exportToCSV(loans, 'loan-portfolio');
   * if (result.success) {
   *   console.log('CSV exported successfully');
   * }
   */
  const exportToCSV = useCallback(
    async (data, filename) => {
      if (exportInProgressRef.current) {
        warn(HOOK_NAME, 'Export already in progress, rejecting new CSV export request');
        return {
          success: false,
          error: 'An export is already in progress. Please wait for it to complete.',
        };
      }

      if (!Array.isArray(data)) {
        warn(HOOK_NAME, 'exportToCSV called with non-array data', {
          dataType: typeof data,
        });
        return {
          success: false,
          error: 'Data must be an array.',
        };
      }

      exportInProgressRef.current = true;

      if (isMountedRef.current) {
        setIsExporting(true);
      }

      const generatedFilename = filename || generateExportFilename('export');

      try {
        info(HOOK_NAME, 'Starting CSV export', {
          recordCount: data.length,
          filename: generatedFilename,
        });

        const success = exportCSV(data, generatedFilename);

        if (success) {
          logExportAudit('csv', generatedFilename, data.length, true);

          info(HOOK_NAME, 'CSV export completed successfully', {
            filename: generatedFilename,
            recordCount: data.length,
          });

          return {
            success: true,
            filename: `${generatedFilename}.csv`,
          };
        }

        logExportAudit('csv', generatedFilename, data.length, false);

        error(HOOK_NAME, 'CSV export failed', {
          filename: generatedFilename,
          recordCount: data.length,
        });

        return {
          success: false,
          error: 'Failed to generate CSV file. Please try again.',
        };
      } catch (err) {
        logExportAudit('csv', generatedFilename, data.length, false);

        error(HOOK_NAME, 'CSV export threw an unexpected error', err);

        return {
          success: false,
          error: err.message || 'An unexpected error occurred during CSV export.',
        };
      } finally {
        exportInProgressRef.current = false;

        if (isMountedRef.current) {
          setIsExporting(false);
        }
      }
    },
    [logExportAudit],
  );

  /**
   * Exports data as a JSON file.
   * Logs an audit event and tracks loading state.
   *
   * @param {*} data - The data to export as JSON. Can be any JSON-serializable value.
   * @param {string} [filename] - Optional filename (without extension). Auto-generated if omitted.
   * @returns {Promise<ExportResult>} Result object indicating success or failure.
   *
   * @example
   * const result = await exportToJSON({ users: [...] }, 'users-export');
   * if (result.success) {
   *   console.log('JSON exported successfully');
   * }
   */
  const exportToJSON = useCallback(
    async (data, filename) => {
      if (exportInProgressRef.current) {
        warn(HOOK_NAME, 'Export already in progress, rejecting new JSON export request');
        return {
          success: false,
          error: 'An export is already in progress. Please wait for it to complete.',
        };
      }

      if (data === undefined) {
        warn(HOOK_NAME, 'exportToJSON called with undefined data');
        return {
          success: false,
          error: 'Data cannot be undefined.',
        };
      }

      exportInProgressRef.current = true;

      if (isMountedRef.current) {
        setIsExporting(true);
      }

      const generatedFilename = filename || generateExportFilename('export');

      let recordCount = 0;

      if (Array.isArray(data)) {
        recordCount = data.length;
      } else if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 1 && Array.isArray(data[keys[0]])) {
          recordCount = data[keys[0]].length;
        } else {
          recordCount = keys.length;
        }
      }

      try {
        info(HOOK_NAME, 'Starting JSON export', {
          recordCount,
          filename: generatedFilename,
        });

        const success = exportJSON(data, generatedFilename);

        if (success) {
          logExportAudit('json', generatedFilename, recordCount, true);

          info(HOOK_NAME, 'JSON export completed successfully', {
            filename: generatedFilename,
            recordCount,
          });

          return {
            success: true,
            filename: `${generatedFilename}.json`,
          };
        }

        logExportAudit('json', generatedFilename, recordCount, false);

        error(HOOK_NAME, 'JSON export failed', {
          filename: generatedFilename,
          recordCount,
        });

        return {
          success: false,
          error: 'Failed to generate JSON file. Please try again.',
        };
      } catch (err) {
        logExportAudit('json', generatedFilename, recordCount, false);

        error(HOOK_NAME, 'JSON export threw an unexpected error', err);

        return {
          success: false,
          error: err.message || 'An unexpected error occurred during JSON export.',
        };
      } finally {
        exportInProgressRef.current = false;

        if (isMountedRef.current) {
          setIsExporting(false);
        }
      }
    },
    [logExportAudit],
  );

  return {
    exportToCSV,
    exportToJSON,
    isExporting,
  };
};

export default useExport;