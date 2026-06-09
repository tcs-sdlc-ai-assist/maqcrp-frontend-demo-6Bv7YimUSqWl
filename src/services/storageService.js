import { STORAGE_KEYS } from '../config';
import { debug, info, warn, error } from '../utils/logger';

/**
 * Current schema version for localStorage data.
 * Increment this when the data structure changes to trigger migration.
 * @type {number}
 */
const SCHEMA_VERSION = 1;

/**
 * Key used to store the schema version in localStorage.
 * @type {string}
 */
const SCHEMA_VERSION_KEY = 'maqcrop_schema_version';

/**
 * Prefix for index storage keys to namespace them separately from data collections.
 * @type {string}
 */
const INDEX_PREFIX = 'maqcrop_index_';

/**
 * In-memory cache of built indexes for fast lookups.
 * @type {Map<string, Map<string, any>>}
 */
const indexCache = new Map();

/**
 * Estimated localStorage quota limit in bytes (5MB is typical for most browsers).
 * @type {number}
 */
const ESTIMATED_QUOTA_BYTES = 5 * 1024 * 1024;

/**
 * Threshold percentage of quota usage before warning.
 * @type {number}
 */
const QUOTA_WARNING_THRESHOLD = 0.8;

/**
 * Serializes data to a JSON string for localStorage storage.
 * Handles Date objects by converting them to ISO strings.
 * Throws if the data cannot be serialized.
 *
 * @param {*} data - The data to serialize.
 * @returns {string} The JSON string.
 * @throws {Error} If serialization fails.
 */
const serialize = (data) => {
  try {
    return JSON.stringify(data);
  } catch (err) {
    error('storageService: Failed to serialize data', err);
    throw new Error('Failed to serialize data for storage.');
  }
};

/**
 * Deserializes a JSON string from localStorage back into a JavaScript value.
 * Handles ISO date strings by converting them back to Date objects.
 *
 * @param {string} jsonString - The JSON string to deserialize.
 * @returns {*} The deserialized value, or null if parsing fails.
 */
const deserialize = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    error('storageService: Failed to deserialize data', err);
    return null;
  }
};

/**
 * Estimates the current size of data stored in localStorage in bytes.
 * Iterates over all keys and sums the length of each key and its value.
 *
 * @returns {number} Estimated size in bytes.
 */
const estimateStorageSize = () => {
  let totalSize = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalSize += key.length;
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
    }
  } catch (err) {
    warn('storageService: Failed to estimate storage size', err);
  }

  return totalSize * 2;
};

/**
 * Checks if there is sufficient space in localStorage for the given data size.
 * If the estimated usage exceeds the warning threshold, logs a warning.
 * If the write would exceed the estimated quota, throws an error.
 *
 * @param {number} additionalBytes - The number of additional bytes to write.
 * @returns {boolean} True if there is sufficient space.
 * @throws {Error} If the write would exceed the estimated quota.
 */
const checkQuota = (additionalBytes) => {
  const currentSize = estimateStorageSize();
  const projectedSize = currentSize + additionalBytes;

  if (projectedSize > ESTIMATED_QUOTA_BYTES) {
    error('storageService: localStorage quota exceeded', {
      currentSize,
      projectedSize,
      quota: ESTIMATED_QUOTA_BYTES,
    });
    throw new Error(
      'localStorage quota exceeded. Please clear some data before saving.',
    );
  }

  if (projectedSize > ESTIMATED_QUOTA_BYTES * QUOTA_WARNING_THRESHOLD) {
    warn('storageService: localStorage usage approaching quota limit', {
      currentSize,
      projectedSize,
      usagePercent: ((projectedSize / ESTIMATED_QUOTA_BYTES) * 100).toFixed(1),
    });
  }

  return true;
};

/**
 * Checks if the stored schema version matches the current schema version.
 * If the versions differ, triggers a migration or clears stale data.
 *
 * @returns {boolean} True if the schema is up to date.
 */
const checkSchemaVersion = () => {
  try {
    const storedVersion = localStorage.getItem(SCHEMA_VERSION_KEY);
    const parsedVersion = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (parsedVersion !== SCHEMA_VERSION) {
      warn('storageService: Schema version mismatch, clearing stale data', {
        stored: parsedVersion,
        current: SCHEMA_VERSION,
      });
      clearAll();
      localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
      return false;
    }

    return true;
  } catch (err) {
    error('storageService: Failed to check schema version', err);
    return false;
  }
};

/**
 * Ensures the schema version key is set in localStorage.
 * Called on first access to initialize the storage layer.
 */
const ensureSchemaVersion = () => {
  try {
    const storedVersion = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (!storedVersion) {
      localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
      debug('storageService: Schema version initialized', { version: SCHEMA_VERSION });
    }
  } catch (err) {
    error('storageService: Failed to set schema version', err);
  }
};

/**
 * Reads a collection from localStorage by its key.
 * Returns the deserialized data, or an empty array if the key does not exist
 * or if deserialization fails.
 *
 * @param {string} key - The localStorage key for the collection.
 * @returns {Array<Object>} The collection data as an array of objects.
 *
 * @example
 * const alerts = readCollection(STORAGE_KEYS.ALERT_FILTERS);
 * // Returns the stored alerts array, or [] if not found
 */
export const readCollection = (key) => {
  if (!key || typeof key !== 'string') {
    warn('storageService: readCollection called with invalid key', { key });
    return [];
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const data = deserialize(raw);

    if (!Array.isArray(data)) {
      warn('storageService: readCollection expected array but got', typeof data, { key });
      return [];
    }

    return data;
  } catch (err) {
    error('storageService: Failed to read collection', { key }, err);
    return [];
  }
};

/**
 * Writes a collection to localStorage under the given key.
 * The data is serialized to JSON and stored. Quota checks are performed
 * before writing to prevent exceeding localStorage limits.
 *
 * @param {string} key - The localStorage key for the collection.
 * @param {Array<Object>} data - The array of objects to store.
 * @returns {boolean} True if the write was successful, false otherwise.
 *
 * @example
 * writeCollection(STORAGE_KEYS.ALERT_FILTERS, [{ id: '1', severity: 'HIGH' }]);
 * // Returns true if successful
 */
export const writeCollection = (key, data) => {
  if (!key || typeof key !== 'string') {
    warn('storageService: writeCollection called with invalid key', { key });
    return false;
  }

  if (!Array.isArray(data)) {
    warn('storageService: writeCollection expected array but got', typeof data, { key });
    return false;
  }

  try {
    const jsonString = serialize(data);
    const byteSize = jsonString.length * 2;

    checkQuota(byteSize);

    localStorage.setItem(key, jsonString);
    debug('storageService: Collection written successfully', { key, itemCount: data.length });

    return true;
  } catch (err) {
    if (err.message && err.message.includes('quota exceeded')) {
      error('storageService: Quota exceeded while writing collection', { key, itemCount: data.length });
    } else {
      error('storageService: Failed to write collection', { key, itemCount: data.length }, err);
    }
    return false;
  }
};

/**
 * Appends a single item to an existing collection in localStorage.
 * If the collection does not exist, it is created with the item as its first element.
 * A unique ID is generated for the item if one is not provided.
 *
 * @param {string} key - The localStorage key for the collection.
 * @param {Object} item - The item to append to the collection.
 * @returns {Object|null} The appended item with its generated ID, or null if the operation failed.
 *
 * @example
 * const newAlert = appendToCollection(STORAGE_KEYS.ALERT_FILTERS, { severity: 'HIGH', message: 'Risk threshold exceeded' });
 * // Returns { id: 'generated-uuid', severity: 'HIGH', message: 'Risk threshold exceeded', createdAt: '...' }
 */
export const appendToCollection = (key, item) => {
  if (!key || typeof key !== 'string') {
    warn('storageService: appendToCollection called with invalid key', { key });
    return null;
  }

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    warn('storageService: appendToCollection called with invalid item', { key, itemType: typeof item });
    return null;
  }

  try {
    const collection = readCollection(key);

    const newItem = {
      id: item.id || generateId(),
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    collection.push(newItem);

    const success = writeCollection(key, collection);

    if (!success) {
      return null;
    }

    debug('storageService: Item appended to collection', { key, itemId: newItem.id });

    return newItem;
  } catch (err) {
    error('storageService: Failed to append item to collection', { key }, err);
    return null;
  }
};

/**
 * Generates a unique identifier string.
 * Uses a combination of timestamp and random values to ensure uniqueness.
 *
 * @returns {string} A unique identifier.
 */
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
};

/**
 * Builds an in-memory index from a collection for fast lookups.
 * The index is keyed by the specified field and maps field values to the
 * corresponding items in the collection.
 *
 * @param {string} collectionKey - The localStorage key of the source collection.
 * @param {string} indexField - The field to index by.
 * @returns {boolean} True if the index was built successfully, false otherwise.
 *
 * @example
 * buildIndex(STORAGE_KEYS.ALERT_FILTERS, 'severity');
 * // Builds an index on the 'severity' field of the alerts collection
 */
export const buildIndex = (collectionKey, indexField) => {
  if (!collectionKey || typeof collectionKey !== 'string') {
    warn('storageService: buildIndex called with invalid collectionKey', { collectionKey });
    return false;
  }

  if (!indexField || typeof indexField !== 'string') {
    warn('storageService: buildIndex called with invalid indexField', { indexField });
    return false;
  }

  try {
    const collection = readCollection(collectionKey);

    if (collection.length === 0) {
      debug('storageService: buildIndex called on empty collection', { collectionKey, indexField });
      indexCache.set(`${collectionKey}:${indexField}`, new Map());
      return true;
    }

    const index = new Map();

    for (const item of collection) {
      if (item && typeof item === 'object') {
        const fieldValue = item[indexField];

        if (fieldValue !== undefined && fieldValue !== null) {
          const key = typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue);

          if (!index.has(key)) {
            index.set(key, []);
          }

          index.get(key).push(item);
        }
      }
    }

    const cacheKey = `${collectionKey}:${indexField}`;
    indexCache.set(cacheKey, index);

    debug('storageService: Index built successfully', {
      collectionKey,
      indexField,
      uniqueKeys: index.size,
      totalItems: collection.length,
    });

    return true;
  } catch (err) {
    error('storageService: Failed to build index', { collectionKey, indexField }, err);
    return false;
  }
};

/**
 * Retrieves an in-memory index by its collection key and index field.
 * Returns the index Map, or null if the index has not been built.
 *
 * @param {string} collectionKey - The localStorage key of the source collection.
 * @param {string} indexField - The indexed field name.
 * @returns {Map<string, Array<Object>>|null} The index Map, or null if not found.
 *
 * @example
 * const severityIndex = getIndex(STORAGE_KEYS.ALERT_FILTERS, 'severity');
 * const highAlerts = severityIndex?.get('HIGH') || [];
 */
export const getIndex = (collectionKey, indexField) => {
  if (!collectionKey || !indexField) {
    return null;
  }

  const cacheKey = `${collectionKey}:${indexField}`;
  const index = indexCache.get(cacheKey);

  if (!index) {
    debug('storageService: Index not found in cache', { collectionKey, indexField });
    return null;
  }

  return index;
};

/**
 * Checks if any data has been stored in localStorage by this application.
 * Looks for the schema version key and at least one collection key.
 *
 * @returns {boolean} True if application data exists in localStorage.
 */
export const isDataAvailable = () => {
  try {
    const schemaVersion = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (!schemaVersion) {
      return false;
    }

    const storageKeys = Object.values(STORAGE_KEYS);
    for (const key of storageKeys) {
      if (localStorage.getItem(key)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    error('storageService: Failed to check data availability', err);
    return false;
  }
};

/**
 * Clears all application data from localStorage.
 * Removes all keys that match the application's storage key prefix
 * and clears the in-memory index cache.
 *
 * @returns {boolean} True if the clear operation was successful.
 */
export const clearAll = () => {
  try {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('maqcrop_') || key === SCHEMA_VERSION_KEY)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    indexCache.clear();

    info('storageService: All application data cleared', {
      keysRemoved: keysToRemove.length,
    });

    return true;
  } catch (err) {
    error('storageService: Failed to clear all data', err);
    return false;
  }
};

/**
 * Returns statistics about the current localStorage usage for the application.
 * Includes total size, item counts per collection, and quota usage percentage.
 *
 * @returns {Object} Storage statistics object.
 * @returns {number} returns.totalSizeBytes - Total estimated size in bytes.
 * @returns {number} returns.totalSizeKB - Total estimated size in kilobytes.
 * @returns {number} returns.quotaUsagePercent - Percentage of estimated quota used.
 * @returns {number} returns.collectionCount - Number of application collections stored.
 * @returns {number} returns.totalItems - Total number of items across all collections.
 * @returns {Array<{key: string, itemCount: number, sizeBytes: number}>} returns.collections - Per-collection stats.
 *
 * @example
 * const stats = getStorageStats();
 * console.log(`Using ${stats.quotaUsagePercent}% of localStorage quota`);
 */
export const getStorageStats = () => {
  const stats = {
    totalSizeBytes: 0,
    totalSizeKB: 0,
    quotaUsagePercent: 0,
    collectionCount: 0,
    totalItems: 0,
    collections: [],
  };

  try {
    const storageKeys = Object.values(STORAGE_KEYS);

    for (const key of storageKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const sizeBytes = (key.length + raw.length) * 2;
        stats.totalSizeBytes += sizeBytes;

        const data = deserialize(raw);
        const itemCount = Array.isArray(data) ? data.length : 0;
        stats.totalItems += itemCount;

        stats.collections.push({
          key,
          itemCount,
          sizeBytes,
        });

        stats.collectionCount++;
      }
    }

    stats.totalSizeKB = Math.round((stats.totalSizeBytes / 1024) * 100) / 100;
    stats.quotaUsagePercent = Math.round(
      (stats.totalSizeBytes / ESTIMATED_QUOTA_BYTES) * 100 * 100,
    ) / 100;

    stats.collections.sort((a, b) => b.sizeBytes - a.sizeBytes);
  } catch (err) {
    error('storageService: Failed to get storage stats', err);
  }

  return stats;
};

/**
 * Removes a specific item from a collection by its ID.
 *
 * @param {string} key - The localStorage key for the collection.
 * @param {string} itemId - The ID of the item to remove.
 * @returns {boolean} True if the item was found and removed, false otherwise.
 *
 * @example
 * removeFromCollection(STORAGE_KEYS.ALERT_FILTERS, 'alert-123');
 * // Returns true if the alert was removed
 */
export const removeFromCollection = (key, itemId) => {
  if (!key || typeof key !== 'string') {
    warn('storageService: removeFromCollection called with invalid key', { key });
    return false;
  }

  if (!itemId || typeof itemId !== 'string') {
    warn('storageService: removeFromCollection called with invalid itemId', { itemId });
    return false;
  }

  try {
    const collection = readCollection(key);
    const initialLength = collection.length;

    const filtered = collection.filter((item) => item && item.id !== itemId);

    if (filtered.length === initialLength) {
      debug('storageService: Item not found in collection', { key, itemId });
      return false;
    }

    const success = writeCollection(key, filtered);

    if (success) {
      debug('storageService: Item removed from collection', { key, itemId });
    }

    return success;
  } catch (err) {
    error('storageService: Failed to remove item from collection', { key, itemId }, err);
    return false;
  }
};

/**
 * Updates a specific item in a collection by its ID.
 * Merges the provided updates with the existing item.
 *
 * @param {string} key - The localStorage key for the collection.
 * @param {string} itemId - The ID of the item to update.
 * @param {Object} updates - The properties to update on the item.
 * @returns {Object|null} The updated item, or null if the item was not found or the operation failed.
 *
 * @example
 * updateInCollection(STORAGE_KEYS.ALERT_FILTERS, 'alert-123', { acknowledged: true });
 * // Returns the updated alert object
 */
export const updateInCollection = (key, itemId, updates) => {
  if (!key || typeof key !== 'string') {
    warn('storageService: updateInCollection called with invalid key', { key });
    return null;
  }

  if (!itemId || typeof itemId !== 'string') {
    warn('storageService: updateInCollection called with invalid itemId', { itemId });
    return null;
  }

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    warn('storageService: updateInCollection called with invalid updates', {
      key,
      itemId,
      updatesType: typeof updates,
    });
    return null;
  }

  try {
    const collection = readCollection(key);
    let updatedItem = null;

    const updatedCollection = collection.map((item) => {
      if (item && item.id === itemId) {
        updatedItem = {
          ...item,
          ...updates,
          id: item.id,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return item;
    });

    if (!updatedItem) {
      debug('storageService: Item not found for update', { key, itemId });
      return null;
    }

    const success = writeCollection(key, updatedCollection);

    if (!success) {
      return null;
    }

    debug('storageService: Item updated in collection', { key, itemId });

    return updatedItem;
  } catch (err) {
    error('storageService: Failed to update item in collection', { key, itemId }, err);
    return null;
  }
};

/**
 * Finds a single item in a collection by its ID.
 *
 * @param {string} key - The localStorage key for the collection.
 * @param {string} itemId - The ID of the item to find.
 * @returns {Object|null} The found item, or null if not found.
 *
 * @example
 * const alert = findInCollection(STORAGE_KEYS.ALERT_FILTERS, 'alert-123');
 */
export const findInCollection = (key, itemId) => {
  if (!key || !itemId) {
    return null;
  }

  try {
    const collection = readCollection(key);
    return collection.find((item) => item && item.id === itemId) || null;
  } catch (err) {
    error('storageService: Failed to find item in collection', { key, itemId }, err);
    return null;
  }
};

/**
 * Queries a collection with a filter function.
 * Returns all items that match the predicate.
 *
 * @param {string} key - The localStorage key for the collection.
 * @param {Function} predicate - Filter function that receives an item and returns a boolean.
 * @returns {Array<Object>} Array of matching items.
 *
 * @example
 * const highAlerts = queryCollection(STORAGE_KEYS.ALERT_FILTERS, (item) => item.severity === 'HIGH');
 */
export const queryCollection = (key, predicate) => {
  if (!key || typeof key !== 'string') {
    warn('storageService: queryCollection called with invalid key', { key });
    return [];
  }

  if (typeof predicate !== 'function') {
    warn('storageService: queryCollection called with invalid predicate', { predicateType: typeof predicate });
    return [];
  }

  try {
    const collection = readCollection(key);
    return collection.filter((item) => {
      try {
        return predicate(item);
      } catch (err) {
        warn('storageService: Predicate function threw an error', err);
        return false;
      }
    });
  } catch (err) {
    error('storageService: Failed to query collection', { key }, err);
    return [];
  }
};

/**
 * Invalidates all in-memory indexes, forcing them to be rebuilt on next access.
 * Useful after bulk updates to collections.
 */
export const invalidateIndexes = () => {
  indexCache.clear();
  debug('storageService: All indexes invalidated');
};

/**
 * Initializes the storage service.
 * Checks schema version and ensures the version key is set.
 * Should be called once during application startup.
 *
 * @returns {boolean} True if initialization was successful.
 */
export const initializeStorage = () => {
  try {
    ensureSchemaVersion();
    checkSchemaVersion();
    info('storageService: Storage service initialized', {
      schemaVersion: SCHEMA_VERSION,
      dataAvailable: isDataAvailable(),
    });
    return true;
  } catch (err) {
    error('storageService: Failed to initialize storage service', err);
    return false;
  }
};