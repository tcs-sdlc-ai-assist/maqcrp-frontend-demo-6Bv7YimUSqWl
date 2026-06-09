import { PII_FIELDS } from '../config';

/**
 * Mask patterns for each PII field type.
 * Each pattern is a function that takes the raw value and returns the masked string.
 * @type {Record<string, (value: string) => string>}
 */
const MASK_PATTERNS = {
  fullName: (value) => {
    if (!value || typeof value !== 'string') return '';
    const parts = value.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) {
      return parts[0].charAt(0) + '*'.repeat(Math.max(parts[0].length - 1, 1));
    }
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const maskedFirst = firstName.charAt(0) + '*'.repeat(Math.max(firstName.length - 1, 1));
    const maskedLast = lastName.charAt(0) + '*'.repeat(Math.max(lastName.length - 1, 1));
    return `${maskedFirst} ${maskedLast}`;
  },
  firstName: (value) => {
    if (!value || typeof value !== 'string') return '';
    return value.charAt(0) + '*'.repeat(Math.max(value.length - 1, 1));
  },
  lastName: (value) => {
    if (!value || typeof value !== 'string') return '';
    return value.charAt(0) + '*'.repeat(Math.max(value.length - 1, 1));
  },
  email: (value) => {
    if (!value || typeof value !== 'string') return '';
    const atIndex = value.indexOf('@');
    if (atIndex === -1) return '*'.repeat(value.length);
    const localPart = value.slice(0, atIndex);
    const domain = value.slice(atIndex);
    if (localPart.length <= 2) {
      return localPart.charAt(0) + '*' + domain;
    }
    return localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1) + domain;
  },
  phone: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(value.length);
    return '(***) ***-' + cleaned.slice(-4);
  },
  address: (value) => {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 8) return '*'.repeat(value.length);
    return '*'.repeat(value.length - 8) + value.slice(-8);
  },
  city: (value) => {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 3) return value;
    return value.slice(0, 3) + '*'.repeat(value.length - 3);
  },
  state: (value) => {
    if (!value || typeof value !== 'string') return '';
    return value;
  },
  zipCode: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 5) return '*'.repeat(value.length);
    return '*****' + (cleaned.length > 5 ? '-' + cleaned.slice(-4) : '');
  },
  country: (value) => {
    if (!value || typeof value !== 'string') return '';
    return value;
  },
  ssn: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(value.length);
    return '***-**-' + cleaned.slice(-4);
  },
  taxId: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(value.length);
    return '**-***' + cleaned.slice(-4);
  },
  passportNumber: (value) => {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 4) return '*'.repeat(value.length);
    return '*'.repeat(value.length - 4) + value.slice(-4);
  },
  driversLicense: (value) => {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 4) return '*'.repeat(value.length);
    return '*'.repeat(value.length - 4) + value.slice(-4);
  },
  dateOfBirth: (value) => {
    if (!value || typeof value !== 'string') return '';
    const parts = value.split(/[-/]/);
    if (parts.length < 3) return '*'.repeat(value.length);
    return '**/**/' + parts[2];
  },
  ipAddress: (value) => {
    if (!value || typeof value !== 'string') return '';
    const parts = value.split('.');
    if (parts.length !== 4) return '*'.repeat(value.length);
    return parts[0] + '.*.*.' + parts[3];
  },
  deviceId: (value) => {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 8) return '*'.repeat(value.length);
    return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
  },
  accountNumber: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\s/g, '');
    if (cleaned.length < 5) return cleaned;
    const lastFour = cleaned.slice(-4);
    const masked = '*'.repeat(cleaned.length - 4);
    return masked + lastFour;
  },
  routingNumber: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(value.length);
    return '*****' + cleaned.slice(-4);
  },
  creditCardNumber: (value) => {
    if (!value || typeof value !== 'string') return '';
    const cleaned = value.replace(/\s/g, '');
    if (cleaned.length < 4) return '*'.repeat(value.length);
    return '****-****-****-' + cleaned.slice(-4);
  },
  bankName: (value) => {
    if (!value || typeof value !== 'string') return '';
    return value;
  },
  transactionId: (value) => {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 6) return '*'.repeat(value.length);
    return value.slice(0, 3) + '*'.repeat(value.length - 6) + value.slice(-3);
  },
};

/**
 * Maps PII field names to their sensitivity levels for quick lookup.
 * Built from the PII_FIELDS constant in config.js.
 * @type {Record<string, string>}
 */
const FIELD_SENSITIVITY_MAP = PII_FIELDS.reduce((map, field) => {
  map[field.field] = field.sensitivity;
  return map;
}, {});

/**
 * Maps PII field names to their categories for quick lookup.
 * Built from the PII_FIELDS constant in config.js.
 * @type {Record<string, string>}
 */
const FIELD_CATEGORY_MAP = PII_FIELDS.reduce((map, field) => {
  map[field.field] = field.category;
  return map;
}, {});

/**
 * Masks a PII value based on the field type.
 * Uses predefined mask patterns for each field type.
 * Falls back to full masking if the field type is unknown.
 *
 * @param {string} value - The raw PII value to mask.
 * @param {string} fieldType - The PII field type (must match a field in PII_FIELDS).
 * @returns {string} The masked value.
 *
 * @example
 * maskPII('jane.doe@example.com', 'email')
 * // Returns 'j*********e@example.com'
 *
 * @example
 * maskPII('123-45-6789', 'ssn')
 * // Returns '***-**-6789'
 *
 * @example
 * maskPII('(555) 123-4567', 'phone')
 * // Returns '(***) ***-4567'
 */
export const maskPII = (value, fieldType) => {
  if (value == null || value === '') {
    return '';
  }

  const maskFn = MASK_PATTERNS[fieldType];

  if (!maskFn) {
    return '*'.repeat(String(value).length);
  }

  return maskFn(String(value));
};

/**
 * Checks if a given field type is a recognized PII field.
 *
 * @param {string} fieldType - The field type to check.
 * @returns {boolean} True if the field is a known PII field.
 */
export const isPIIField = (fieldType) => {
  return fieldType in MASK_PATTERNS;
};

/**
 * Gets the sensitivity level for a PII field type.
 *
 * @param {string} fieldType - The PII field type.
 * @returns {string} The sensitivity level ('low', 'medium', 'high', 'critical') or 'unknown'.
 */
export const getPIISensitivity = (fieldType) => {
  return FIELD_SENSITIVITY_MAP[fieldType] || 'unknown';
};

/**
 * Gets the category for a PII field type.
 *
 * @param {string} fieldType - The PII field type.
 * @returns {string} The category (e.g., 'identity', 'contact', 'financial') or 'unknown'.
 */
export const getPIICategory = (fieldType) => {
  return FIELD_CATEGORY_MAP[fieldType] || 'unknown';
};

/**
 * Returns the list of all PII field type names.
 *
 * @returns {string[]} Array of PII field type names.
 */
export const getPIIFieldNames = () => {
  return PII_FIELDS.map((f) => f.field);
};

/**
 * Returns the list of PII fields filtered by sensitivity level.
 *
 * @param {string} sensitivity - The sensitivity level to filter by ('low', 'medium', 'high', 'critical').
 * @returns {Array<{field: string, category: string, sensitivity: string}>} Filtered PII field definitions.
 */
export const getPIIFieldsBySensitivity = (sensitivity) => {
  return PII_FIELDS.filter((f) => f.sensitivity === sensitivity);
};

/**
 * Returns the list of PII fields filtered by category.
 *
 * @param {string} category - The category to filter by ('identity', 'contact', 'government', 'digital', 'financial').
 * @returns {Array<{field: string, category: string, sensitivity: string}>} Filtered PII field definitions.
 */
export const getPIIFieldsByCategory = (category) => {
  return PII_FIELDS.filter((f) => f.category === category);
};

/**
 * Masks all PII fields in an object, returning a new object with masked values.
 * Non-PII fields are passed through unchanged.
 * Fields not present in the object are ignored.
 *
 * @param {Object} data - The data object containing potentially PII fields.
 * @returns {Object} A new object with PII fields masked.
 *
 * @example
 * maskPIIObject({ borrowerName: 'Jane Doe', loanAmount: 250000, productType: 'conventional' })
 * // Returns { borrowerName: 'J*** D**', loanAmount: '******', productType: 'conventional' }
 */
export const maskPIIObject = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const masked = { ...data };

  for (const piiField of PII_FIELDS) {
    if (piiField.field in masked && masked[piiField.field] != null) {
      masked[piiField.field] = maskPII(String(masked[piiField.field]), piiField.field);
    }
  }

  return masked;
};

/**
 * PII field type constants for use in components and hooks.
 * These match the field names defined in config.js PII_FIELDS.
 * @enum {string}
 */
export const PII_FIELD_TYPES = PII_FIELDS.reduce((types, field) => {
  types[field.field] = field.field;
  return types;
}, {});

/**
 * Sensitivity level constants.
 * @enum {string}
 */
export const PII_SENSITIVITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * PII category constants.
 * @enum {string}
 */
export const PII_CATEGORIES = {
  IDENTITY: 'identity',
  CONTACT: 'contact',
  GOVERNMENT: 'government',
  DIGITAL: 'digital',
  FINANCIAL: 'financial',
};