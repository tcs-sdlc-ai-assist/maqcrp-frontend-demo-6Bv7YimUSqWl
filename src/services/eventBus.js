import { debug, info, warn, error } from '../utils/logger';

/**
 * Lightweight publish-subscribe event bus for cross-module communication.
 *
 * Provides on(), off(), emit(), and once() methods for decoupled communication
 * between modules. Used for events such as:
 * - DEFECT_REQUIRES_REMEDY
 * - LOAN_DECISION_COMPLETE
 * - SLA_BREACHED
 * - ALERT_ACKNOWLEDGED
 * - CASE_STATUS_CHANGED
 * - INVESTIGATION_ESCALATED
 *
 * Each subscription returns an unsubscribe function for cleanup.
 * The bus tracks subscriber counts and logs warnings for potential memory leaks
 * (e.g., too many subscribers on a single event).
 *
 * @module eventBus
 */

/**
 * Maximum number of subscribers allowed per event before a warning is logged.
 * @type {number}
 */
const MAX_SUBSCRIBERS_PER_EVENT = 100;

/**
 * Maximum number of unique event types before a warning is logged.
 * @type {number}
 */
const MAX_EVENT_TYPES = 500;

/**
 * Internal map of event names to arrays of subscriber callbacks.
 * @type {Map<string, Array<{callback: Function, once: boolean}>>}
 */
const subscribers = new Map();

/**
 * Set of event names that have been emitted at least once.
 * Used for debugging and monitoring.
 * @type {Set<string>}
 */
const emittedEvents = new Set();

/**
 * Counter for total number of emit calls across all events.
 * @type {number}
 */
let totalEmitCount = 0;

/**
 * Counter for total number of subscribe calls across all events.
 * @type {number}
 */
let totalSubscribeCount = 0;

/**
 * Validates that an event name is a non-empty string.
 * Logs a warning and returns false if invalid.
 *
 * @param {string} event - The event name to validate.
 * @returns {boolean} True if the event name is valid.
 */
const validateEventName = (event) => {
  if (!event || typeof event !== 'string') {
    warn('eventBus: Invalid event name', { event, type: typeof event });
    return false;
  }

  if (event.trim() === '') {
    warn('eventBus: Event name cannot be empty');
    return false;
  }

  return true;
};

/**
 * Validates that a callback is a function.
 * Logs a warning and returns false if invalid.
 *
 * @param {Function} callback - The callback to validate.
 * @returns {boolean} True if the callback is a valid function.
 */
const validateCallback = (callback) => {
  if (typeof callback !== 'function') {
    warn('eventBus: Invalid callback', { type: typeof callback });
    return false;
  }

  return true;
};

/**
 * Checks if the number of subscribers for a given event exceeds the maximum threshold.
 * Logs a warning if the threshold is exceeded.
 *
 * @param {string} event - The event name to check.
 */
const checkSubscriberThreshold = (event) => {
  const eventSubscribers = subscribers.get(event);

  if (eventSubscribers && eventSubscribers.length > MAX_SUBSCRIBERS_PER_EVENT) {
    warn('eventBus: High subscriber count detected', {
      event,
      subscriberCount: eventSubscribers.length,
      threshold: MAX_SUBSCRIBERS_PER_EVENT,
    });
  }
};

/**
 * Checks if the total number of unique event types exceeds the maximum threshold.
 * Logs a warning if the threshold is exceeded.
 */
const checkEventTypeThreshold = () => {
  if (subscribers.size > MAX_EVENT_TYPES) {
    warn('eventBus: High number of unique event types detected', {
      eventTypeCount: subscribers.size,
      threshold: MAX_EVENT_TYPES,
    });
  }
};

/**
 * Subscribes a callback to an event.
 * Returns an unsubscribe function that removes the subscription when called.
 *
 * @param {string} event - The event name to subscribe to.
 * @param {Function} callback - The callback function to invoke when the event is emitted.
 * @returns {Function} An unsubscribe function that removes this subscription.
 *
 * @example
 * const unsubscribe = on('LOAN_DECISION_COMPLETE', (payload) => {
 *   console.log('Loan decision:', payload);
 * });
 *
 * // Later, to unsubscribe:
 * unsubscribe();
 */
export const on = (event, callback) => {
  if (!validateEventName(event) || !validateCallback(callback)) {
    return () => {};
  }

  const subscription = { callback, once: false };

  if (!subscribers.has(event)) {
    subscribers.set(event, []);
  }

  subscribers.get(event).push(subscription);
  totalSubscribeCount++;

  checkSubscriberThreshold(event);
  checkEventTypeThreshold();

  debug('eventBus: Subscribed to event', {
    event,
    subscriberCount: subscribers.get(event).length,
  });

  return () => {
    off(event, callback);
  };
};

/**
 * Subscribes a callback to an event that will only be invoked once.
 * After the first invocation, the subscription is automatically removed.
 * Returns an unsubscribe function that can be used to cancel the subscription
 * before it is invoked.
 *
 * @param {string} event - The event name to subscribe to.
 * @param {Function} callback - The callback function to invoke once when the event is emitted.
 * @returns {Function} An unsubscribe function that removes this subscription.
 *
 * @example
 * const unsubscribe = once('LOAN_DECISION_COMPLETE', (payload) => {
 *   console.log('This will only fire once:', payload);
 * });
 */
export const once = (event, callback) => {
  if (!validateEventName(event) || !validateCallback(callback)) {
    return () => {};
  }

  const subscription = { callback, once: true };

  if (!subscribers.has(event)) {
    subscribers.set(event, []);
  }

  subscribers.get(event).push(subscription);
  totalSubscribeCount++;

  checkSubscriberThreshold(event);
  checkEventTypeThreshold();

  debug('eventBus: Subscribed to event (once)', {
    event,
    subscriberCount: subscribers.get(event).length,
  });

  return () => {
    off(event, callback);
  };
};

/**
 * Unsubscribes a specific callback from an event.
 * If called with only the event name, all subscribers for that event are removed.
 * If called with no arguments, all subscribers for all events are removed.
 *
 * @param {string} [event] - The event name to unsubscribe from.
 * @param {Function} [callback] - The specific callback to remove. If omitted, all callbacks for the event are removed.
 *
 * @example
 * // Remove a specific callback
 * off('LOAN_DECISION_COMPLETE', myCallback);
 *
 * // Remove all callbacks for an event
 * off('LOAN_DECISION_COMPLETE');
 *
 * // Remove all callbacks for all events
 * off();
 */
export const off = (event, callback) => {
  if (!event) {
    const totalSubscribers = Array.from(subscribers.values()).reduce(
      (sum, subs) => sum + subs.length,
      0,
    );

    subscribers.clear();

    info('eventBus: All subscribers removed', {
      previousSubscriberCount: totalSubscribers,
    });

    return;
  }

  if (!validateEventName(event)) {
    return;
  }

  if (!subscribers.has(event)) {
    debug('eventBus: No subscribers found for event', { event });
    return;
  }

  if (!callback) {
    const removedCount = subscribers.get(event).length;
    subscribers.delete(event);

    info('eventBus: All subscribers removed for event', {
      event,
      removedCount,
    });

    return;
  }

  if (!validateCallback(callback)) {
    return;
  }

  const eventSubscribers = subscribers.get(event);
  const initialLength = eventSubscribers.length;

  const filtered = eventSubscribers.filter((sub) => sub.callback !== callback);

  if (filtered.length === initialLength) {
    debug('eventBus: Callback not found for event', { event });
    return;
  }

  if (filtered.length === 0) {
    subscribers.delete(event);
  } else {
    subscribers.set(event, filtered);
  }

  debug('eventBus: Subscriber removed from event', {
    event,
    removedCount: initialLength - filtered.length,
    remainingCount: filtered.length,
  });
};

/**
 * Emits an event with an optional payload to all subscribers.
 * Subscribers are invoked synchronously in the order they were registered.
 * Errors thrown by individual subscribers are caught and logged, preventing
 * one subscriber's error from blocking others.
 *
 * @param {string} event - The event name to emit.
 * @param {*} [payload] - Optional payload to pass to each subscriber callback.
 *
 * @example
 * emit('LOAN_DECISION_COMPLETE', { loanId: 'LN-12345', decision: 'APPROVED' });
 *
 * @example
 * emit('SLA_BREACHED', { alertId: 'ALT-67890', severity: 'CRITICAL' });
 */
export const emit = (event, payload) => {
  if (!validateEventName(event)) {
    return;
  }

  emittedEvents.add(event);
  totalEmitCount++;

  if (!subscribers.has(event)) {
    debug('eventBus: Emitted event with no subscribers', { event });
    return;
  }

  const eventSubscribers = subscribers.get(event);

  if (eventSubscribers.length === 0) {
    debug('eventBus: Emitted event with empty subscriber list', { event });
    return;
  }

  const subscribersToInvoke = [...eventSubscribers];
  const onceSubscribers = [];

  debug('eventBus: Emitting event', {
    event,
    subscriberCount: subscribersToInvoke.length,
    hasPayload: payload !== undefined,
  });

  for (const subscription of subscribersToInvoke) {
    try {
      subscription.callback(payload);
    } catch (err) {
      error('eventBus: Subscriber callback threw an error', {
        event,
        error: err,
      });
    }

    if (subscription.once) {
      onceSubscribers.push(subscription);
    }
  }

  if (onceSubscribers.length > 0) {
    const remaining = eventSubscribers.filter(
      (sub) => !onceSubscribers.includes(sub),
    );

    if (remaining.length === 0) {
      subscribers.delete(event);
    } else {
      subscribers.set(event, remaining);
    }

    debug('eventBus: Removed once subscribers after emit', {
      event,
      removedCount: onceSubscribers.length,
      remainingCount: remaining.length,
    });
  }
};

/**
 * Returns the number of subscribers for a specific event.
 * If no event is specified, returns the total number of subscribers across all events.
 *
 * @param {string} [event] - The event name to check.
 * @returns {number} The number of subscribers.
 *
 * @example
 * const count = subscriberCount('LOAN_DECISION_COMPLETE');
 * console.log(`Loan decision has ${count} subscribers`);
 */
export const subscriberCount = (event) => {
  if (!event) {
    let total = 0;
    for (const subs of subscribers.values()) {
      total += subs.length;
    }
    return total;
  }

  if (!subscribers.has(event)) {
    return 0;
  }

  return subscribers.get(event).length;
};

/**
 * Returns an array of all event names that currently have subscribers.
 *
 * @returns {string[]} Array of event names with active subscribers.
 *
 * @example
 * const activeEvents = getActiveEvents();
 * console.log('Active events:', activeEvents);
 */
export const getActiveEvents = () => {
  return Array.from(subscribers.keys());
};

/**
 * Returns an array of all event names that have been emitted at least once.
 *
 * @returns {string[]} Array of event names that have been emitted.
 *
 * @example
 * const emitted = getEmittedEvents();
 * console.log('Emitted events:', emitted);
 */
export const getEmittedEvents = () => {
  return Array.from(emittedEvents);
};

/**
 * Checks if an event has any active subscribers.
 *
 * @param {string} event - The event name to check.
 * @returns {boolean} True if the event has at least one subscriber.
 *
 * @example
 * if (hasSubscribers('LOAN_DECISION_COMPLETE')) {
 *   console.log('Someone is listening for loan decisions');
 * }
 */
export const hasSubscribers = (event) => {
  if (!event || typeof event !== 'string') {
    return false;
  }

  if (!subscribers.has(event)) {
    return false;
  }

  return subscribers.get(event).length > 0;
};

/**
 * Returns statistics about the event bus for debugging and monitoring.
 *
 * @returns {Object} Event bus statistics.
 * @returns {number} returns.totalEvents - Total number of unique event types with subscribers.
 * @returns {number} returns.totalSubscribers - Total number of subscribers across all events.
 * @returns {number} returns.totalEmitCount - Total number of emit calls.
 * @returns {number} returns.totalSubscribeCount - Total number of subscribe calls.
 * @returns {number} returns.emittedEventCount - Number of unique events that have been emitted.
 * @returns {Array<{event: string, subscriberCount: number}>} returns.topEvents - Top 10 events by subscriber count.
 *
 * @example
 * const stats = getStats();
 * console.log('Event bus stats:', stats);
 */
export const getStats = () => {
  const stats = {
    totalEvents: subscribers.size,
    totalSubscribers: 0,
    totalEmitCount,
    totalSubscribeCount,
    emittedEventCount: emittedEvents.size,
    topEvents: [],
  };

  const eventStats = [];

  for (const [event, subs] of subscribers.entries()) {
    stats.totalSubscribers += subs.length;
    eventStats.push({ event, subscriberCount: subs.length });
  }

  eventStats.sort((a, b) => b.subscriberCount - a.subscriberCount);
  stats.topEvents = eventStats.slice(0, 10);

  return stats;
};

/**
 * Resets the event bus to its initial state.
 * Removes all subscribers and clears all tracking data.
 * Primarily useful for testing.
 *
 * @example
 * reset();
 * // All subscribers removed, all counters reset
 */
export const reset = () => {
  const previousSubscriberCount = Array.from(subscribers.values()).reduce(
    (sum, subs) => sum + subs.length,
    0,
  );

  subscribers.clear();
  emittedEvents.clear();
  totalEmitCount = 0;
  totalSubscribeCount = 0;

  info('eventBus: Event bus reset', {
    previousSubscriberCount,
    previousEmittedEventCount: emittedEvents.size,
  });
};

/**
 * Well-known event name constants for use across the application.
 * Using these constants prevents typos and enables IDE autocompletion.
 *
 * @enum {string}
 */
export const EVENTS = {
  /** Fired when a defect is identified that requires a remedy action */
  DEFECT_REQUIRES_REMEDY: 'DEFECT_REQUIRES_REMEDY',

  /** Fired when a loan decision (approve/deny/refer) is completed */
  LOAN_DECISION_COMPLETE: 'LOAN_DECISION_COMPLETE',

  /** Fired when an SLA deadline has been breached */
  SLA_BREACHED: 'SLA_BREACHED',

  /** Fired when an alert is acknowledged by a user */
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',

  /** Fired when a case status changes */
  CASE_STATUS_CHANGED: 'CASE_STATUS_CHANGED',

  /** Fired when an investigation is escalated */
  INVESTIGATION_ESCALATED: 'INVESTIGATION_ESCALATED',

  /** Fired when a new alert is generated */
  ALERT_GENERATED: 'ALERT_GENERATED',

  /** Fired when a risk score crosses a threshold */
  RISK_THRESHOLD_CROSSED: 'RISK_THRESHOLD_CROSSED',

  /** Fired when a loan is submitted for review */
  LOAN_SUBMITTED: 'LOAN_SUBMITTED',

  /** Fired when a QC review is completed */
  QC_REVIEW_COMPLETED: 'QC_REVIEW_COMPLETED',

  /** Fired when a sampling run is completed */
  SAMPLING_RUN_COMPLETED: 'SAMPLING_RUN_COMPLETED',

  /** Fired when a rule configuration is updated */
  RULE_CONFIG_UPDATED: 'RULE_CONFIG_UPDATED',

  /** Fired when a user changes their active persona */
  PERSONA_CHANGED: 'PERSONA_CHANGED',

  /** Fired when a notification is received */
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',

  /** Fired when data export is completed */
  EXPORT_COMPLETED: 'EXPORT_COMPLETED',

  /** Fired when a batch operation completes */
  BATCH_OPERATION_COMPLETE: 'BATCH_OPERATION_COMPLETE',
};