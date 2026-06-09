import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';
import { maskPII, isPIIField } from '../utils/piiMask';
import { debug, warn } from '../utils/logger';

const HOOK_NAME = 'usePIIMask';

const AUTO_REMASK_DELAY_MS = 10000;

const MAX_REVEALED_FIELDS = 50;

/**
 * @typedef {Object} RevealedFieldEntry
 * @property {string} fieldType - The PII field type.
 * @property {string} entityId - The entity identifier.
 * @property {string} revealedAt - ISO timestamp of when the field was revealed.
 * @property {number} timerId - The setTimeout ID for auto re-masking.
 */

/**
 * @typedef {Object} PIIMaskResult
 * @property {Function} maskValue - Masks a PII value based on field type.
 * @property {Function} revealValue - Reveals a PII value, logs audit, and auto re-masks after 10 seconds.
 * @property {Function} isRevealed - Checks if a specific field/entity combination is currently revealed.
 * @property {Function} remaskValue - Manually re-masks a specific field/entity combination.
 * @property {Function} remaskAll - Re-masks all currently revealed fields.
 * @property {Set<string>} revealedFields - Set of currently revealed field keys (format: "fieldType:entityId").
 * @property {number} revealedCount - Number of currently revealed fields.
 */

/**
 * Generates a unique key for tracking revealed field state.
 * @param {string} fieldType - The PII field type.
 * @param {string} entityId - The entity identifier.
 * @returns {string} The composite key.
 */
const generateRevealKey = (fieldType, entityId) => {
  return `${fieldType}:${entityId}`;
};

/**
 * Custom hook that manages PII masking and reveal state with automatic re-masking.
 *
 * Provides functions to mask and reveal PII values. When a value is revealed,
 * an audit log entry is created and a 10-second timer is started to automatically
 * re-mask the value. The hook tracks all currently revealed fields and provides
 * manual re-masking capabilities.
 *
 * @returns {PIIMaskResult}
 *
 * @example
 * const { maskValue, revealValue, isRevealed, revealedFields } = usePIIMask();
 *
 * // Mask a value
 * const masked = maskValue('email', 'jane.doe@example.com');
 *
 * // Reveal a value (logs audit, auto re-masks after 10s)
 * const revealed = revealValue('email', 'LOAN-0001', 'jane.doe@example.com');
 *
 * // Check if revealed
 * if (isRevealed('email', 'LOAN-0001')) {
 *   // Show the raw value
 * }
 */
export const usePIIMask = () => {
  const { logEvent } = useAudit();
  const { currentPersona } = useAuth();

  const [revealedKeys, setRevealedKeys] = useState(new Set());

  const revealedTimersRef = useRef(new Map());

  const personaName = currentPersona?.label || currentPersona?.id || 'Unknown';

  useEffect(() => {
    const timers = revealedTimersRef.current;

    return () => {
      for (const timerId of timers.values()) {
        clearTimeout(timerId);
      }
      timers.clear();
    };
  }, []);

  const maskValue = useCallback(
    (fieldType, value) => {
      if (value === null || value === undefined || value === '') {
        return '';
      }

      if (!isPIIField(fieldType)) {
        return String(value);
      }

      return maskPII(String(value), fieldType);
    },
    [],
  );

  const revealValue = useCallback(
    (fieldType, entityId, value) => {
      if (!fieldType || typeof fieldType !== 'string') {
        warn(HOOK_NAME, 'revealValue called with invalid fieldType', { fieldType });
        return maskValue(fieldType, value);
      }

      if (!entityId || typeof entityId !== 'string') {
        warn(HOOK_NAME, 'revealValue called with invalid entityId', { entityId });
        return maskValue(fieldType, value);
      }

      if (!isPIIField(fieldType)) {
        debug(HOOK_NAME, 'revealValue called on non-PII field', { fieldType });
        return String(value ?? '');
      }

      const revealKey = generateRevealKey(fieldType, entityId);

      setRevealedKeys((prev) => {
        if (prev.has(revealKey)) {
          return prev;
        }

        if (prev.size >= MAX_REVEALED_FIELDS) {
          warn(HOOK_NAME, 'Maximum revealed fields reached, cannot reveal more', {
            currentCount: prev.size,
            maxAllowed: MAX_REVEALED_FIELDS,
          });
          return prev;
        }

        const next = new Set(prev);
        next.add(revealKey);
        return next;
      });

      const existingTimer = revealedTimersRef.current.get(revealKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timerId = setTimeout(() => {
        setRevealedKeys((prev) => {
          const next = new Set(prev);
          next.delete(revealKey);
          return next;
        });

        revealedTimersRef.current.delete(revealKey);

        debug(HOOK_NAME, 'PII field auto re-masked', {
          fieldType,
          entityId,
        });
      }, AUTO_REMASK_DELAY_MS);

      revealedTimersRef.current.set(revealKey, timerId);

      try {
        logEvent(
          'PII_REVEAL',
          entityId.startsWith('LOAN') ? 'loan' : entityId.startsWith('SELL') ? 'seller' : 'entity',
          entityId,
          {
            fieldType,
            action: 'PII reveal',
          },
          personaName,
        );
      } catch (err) {
        warn(HOOK_NAME, 'Failed to log PII reveal audit event', err);
      }

      debug(HOOK_NAME, 'PII field revealed', {
        fieldType,
        entityId,
        autoRemaskMs: AUTO_REMASK_DELAY_MS,
      });

      return String(value ?? '');
    },
    [maskValue, logEvent, personaName],
  );

  const isRevealed = useCallback(
    (fieldType, entityId) => {
      if (!fieldType || !entityId) {
        return false;
      }

      const revealKey = generateRevealKey(fieldType, entityId);
      return revealedKeys.has(revealKey);
    },
    [revealedKeys],
  );

  const remaskValue = useCallback(
    (fieldType, entityId) => {
      if (!fieldType || !entityId) {
        return;
      }

      const revealKey = generateRevealKey(fieldType, entityId);

      const existingTimer = revealedTimersRef.current.get(revealKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        revealedTimersRef.current.delete(revealKey);
      }

      setRevealedKeys((prev) => {
        if (!prev.has(revealKey)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(revealKey);
        return next;
      });

      debug(HOOK_NAME, 'PII field manually re-masked', {
        fieldType,
        entityId,
      });
    },
    [],
  );

  const remaskAll = useCallback(() => {
    for (const timerId of revealedTimersRef.current.values()) {
      clearTimeout(timerId);
    }
    revealedTimersRef.current.clear();

    setRevealedKeys(new Set());

    debug(HOOK_NAME, 'All PII fields re-masked');
  }, []);

  const revealedCount = revealedKeys.size;

  return {
    maskValue,
    revealValue,
    isRevealed,
    remaskValue,
    remaskAll,
    revealedFields: revealedKeys,
    revealedCount,
  };
};

export default usePIIMask;