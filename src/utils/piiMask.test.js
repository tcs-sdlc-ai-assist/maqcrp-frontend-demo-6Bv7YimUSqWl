import { describe, it, expect } from 'vitest';
import {
  maskPII,
  isPIIField,
  getPIISensitivity,
  getPIICategory,
  getPIIFieldNames,
  getPIIFieldsBySensitivity,
  getPIIFieldsByCategory,
  maskPIIObject,
  PII_FIELD_TYPES,
  PII_SENSITIVITY_LEVELS,
  PII_CATEGORIES,
} from './piiMask';

describe('maskPII', () => {
  describe('fullName', () => {
    it('should mask a full name with first and last name', () => {
      const result = maskPII('Jane Doe', 'fullName');
      expect(result).toBe('J*** D**');
    });

    it('should mask a single name', () => {
      const result = maskPII('Jane', 'fullName');
      expect(result).toBe('J***');
    });

    it('should mask a name with middle name', () => {
      const result = maskPII('Jane Marie Doe', 'fullName');
      expect(result).toBe('J*** D**');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'fullName');
      expect(result).toBe('');
    });

    it('should return empty string for undefined value', () => {
      const result = maskPII(undefined, 'fullName');
      expect(result).toBe('');
    });

    it('should return empty string for empty string value', () => {
      const result = maskPII('', 'fullName');
      expect(result).toBe('');
    });

    it('should handle non-string value gracefully', () => {
      const result = maskPII(12345, 'fullName');
      expect(result).toBe('1****');
    });
  });

  describe('firstName', () => {
    it('should mask a first name', () => {
      const result = maskPII('Jane', 'firstName');
      expect(result).toBe('J***');
    });

    it('should mask a short first name', () => {
      const result = maskPII('Jo', 'firstName');
      expect(result).toBe('J*');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'firstName');
      expect(result).toBe('');
    });
  });

  describe('lastName', () => {
    it('should mask a last name', () => {
      const result = maskPII('Doe', 'lastName');
      expect(result).toBe('D**');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'lastName');
      expect(result).toBe('');
    });
  });

  describe('email', () => {
    it('should mask an email address', () => {
      const result = maskPII('jane.doe@example.com', 'email');
      expect(result).toBe('j*******e@example.com');
    });

    it('should mask a short email local part', () => {
      const result = maskPII('ab@example.com', 'email');
      expect(result).toBe('a*@example.com');
    });

    it('should mask an email with no @ symbol', () => {
      const result = maskPII('noatsign', 'email');
      expect(result).toBe('********');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'email');
      expect(result).toBe('');
    });
  });

  describe('phone', () => {
    it('should mask a phone number in (XXX) XXX-XXXX format', () => {
      const result = maskPII('(555) 123-4567', 'phone');
      expect(result).toBe('(***) ***-4567');
    });

    it('should mask a phone number with different formatting', () => {
      const result = maskPII('555-123-4567', 'phone');
      expect(result).toBe('(***) ***-4567');
    });

    it('should mask a short phone number', () => {
      const result = maskPII('123', 'phone');
      expect(result).toBe('***');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'phone');
      expect(result).toBe('');
    });
  });

  describe('ssn', () => {
    it('should mask an SSN showing only last 4 digits', () => {
      const result = maskPII('123-45-6789', 'ssn');
      expect(result).toBe('***-**-6789');
    });

    it('should mask an SSN without dashes', () => {
      const result = maskPII('123456789', 'ssn');
      expect(result).toBe('***-**-6789');
    });

    it('should mask a short SSN-like value', () => {
      const result = maskPII('123', 'ssn');
      expect(result).toBe('***');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'ssn');
      expect(result).toBe('');
    });
  });

  describe('accountNumber', () => {
    it('should mask an account number showing only last 4 digits', () => {
      const result = maskPII('LN-1234567890', 'accountNumber');
      expect(result).toBe('**********7890');
    });

    it('should mask a short account number', () => {
      const result = maskPII('1234', 'accountNumber');
      expect(result).toBe('1234');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'accountNumber');
      expect(result).toBe('');
    });
  });

  describe('address', () => {
    it('should mask an address showing only last 8 characters', () => {
      const result = maskPII('123 Main Street, Springfield, IL 62701', 'address');
      expect(result).toBe('**************************IL 62701');
    });

    it('should mask a short address', () => {
      const result = maskPII('Short', 'address');
      expect(result).toBe('*****');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'address');
      expect(result).toBe('');
    });
  });

  describe('city', () => {
    it('should mask a city name showing first 3 characters', () => {
      const result = maskPII('Springfield', 'city');
      expect(result).toBe('Spr********');
    });

    it('should not mask a short city name', () => {
      const result = maskPII('NYC', 'city');
      expect(result).toBe('NYC');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'city');
      expect(result).toBe('');
    });
  });

  describe('state', () => {
    it('should not mask a state abbreviation', () => {
      const result = maskPII('IL', 'state');
      expect(result).toBe('IL');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'state');
      expect(result).toBe('');
    });
  });

  describe('zipCode', () => {
    it('should mask a 5-digit zip code', () => {
      const result = maskPII('62701', 'zipCode');
      expect(result).toBe('*****');
    });

    it('should mask a 9-digit zip code showing last 4', () => {
      const result = maskPII('62701-1234', 'zipCode');
      expect(result).toBe('*****-1234');
    });

    it('should mask a short zip code', () => {
      const result = maskPII('12', 'zipCode');
      expect(result).toBe('**');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'zipCode');
      expect(result).toBe('');
    });
  });

  describe('country', () => {
    it('should not mask a country name', () => {
      const result = maskPII('United States', 'country');
      expect(result).toBe('United States');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'country');
      expect(result).toBe('');
    });
  });

  describe('taxId', () => {
    it('should mask a tax ID showing last 4 digits', () => {
      const result = maskPII('12-3456789', 'taxId');
      expect(result).toBe('**-***6789');
    });

    it('should mask a short tax ID', () => {
      const result = maskPII('123', 'taxId');
      expect(result).toBe('***');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'taxId');
      expect(result).toBe('');
    });
  });

  describe('passportNumber', () => {
    it('should mask a passport number showing last 4 characters', () => {
      const result = maskPII('AB123456', 'passportNumber');
      expect(result).toBe('****3456');
    });

    it('should mask a short passport number', () => {
      const result = maskPII('AB12', 'passportNumber');
      expect(result).toBe('****');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'passportNumber');
      expect(result).toBe('');
    });
  });

  describe('driversLicense', () => {
    it('should mask a drivers license showing last 4 characters', () => {
      const result = maskPII('D123-4567-8901', 'driversLicense');
      expect(result).toBe('**********8901');
    });

    it('should mask a short drivers license', () => {
      const result = maskPII('D123', 'driversLicense');
      expect(result).toBe('****');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'driversLicense');
      expect(result).toBe('');
    });
  });

  describe('dateOfBirth', () => {
    it('should mask a date of birth showing only year', () => {
      const result = maskPII('1990-05-15', 'dateOfBirth');
      expect(result).toBe('**/**/15');
    });

    it('should mask a date of birth with slashes', () => {
      const result = maskPII('05/15/1990', 'dateOfBirth');
      expect(result).toBe('**/**/1990');
    });

    it('should mask an invalid date format', () => {
      const result = maskPII('notadate', 'dateOfBirth');
      expect(result).toBe('********');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'dateOfBirth');
      expect(result).toBe('');
    });
  });

  describe('ipAddress', () => {
    it('should mask an IP address showing first and last octets', () => {
      const result = maskPII('192.168.1.100', 'ipAddress');
      expect(result).toBe('192.*.*.100');
    });

    it('should mask an invalid IP address', () => {
      const result = maskPII('notanip', 'ipAddress');
      expect(result).toBe('*******');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'ipAddress');
      expect(result).toBe('');
    });
  });

  describe('deviceId', () => {
    it('should mask a device ID showing first 4 and last 4 characters', () => {
      const result = maskPII('DEVICE-1234-5678-ABCD', 'deviceId');
      expect(result).toBe('DEVI************ABCD');
    });

    it('should mask a short device ID', () => {
      const result = maskPII('DEV1234', 'deviceId');
      expect(result).toBe('********');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'deviceId');
      expect(result).toBe('');
    });
  });

  describe('routingNumber', () => {
    it('should mask a routing number showing last 4 digits', () => {
      const result = maskPII('123456789', 'routingNumber');
      expect(result).toBe('*****6789');
    });

    it('should mask a short routing number', () => {
      const result = maskPII('123', 'routingNumber');
      expect(result).toBe('***');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'routingNumber');
      expect(result).toBe('');
    });
  });

  describe('creditCardNumber', () => {
    it('should mask a credit card number showing last 4 digits', () => {
      const result = maskPII('4111-1111-1111-1111', 'creditCardNumber');
      expect(result).toBe('****-****-****-1111');
    });

    it('should mask a credit card number without dashes', () => {
      const result = maskPII('4111111111111111', 'creditCardNumber');
      expect(result).toBe('****-****-****-1111');
    });

    it('should mask a short credit card number', () => {
      const result = maskPII('4111', 'creditCardNumber');
      expect(result).toBe('****');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'creditCardNumber');
      expect(result).toBe('');
    });
  });

  describe('bankName', () => {
    it('should not mask a bank name', () => {
      const result = maskPII('First National Bank', 'bankName');
      expect(result).toBe('First National Bank');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'bankName');
      expect(result).toBe('');
    });
  });

  describe('transactionId', () => {
    it('should mask a transaction ID showing first 3 and last 3 characters', () => {
      const result = maskPII('TXN-1234567890-ABC', 'transactionId');
      expect(result).toBe('TXN**********ABC');
    });

    it('should mask a short transaction ID', () => {
      const result = maskPII('TXN12', 'transactionId');
      expect(result).toBe('*****');
    });

    it('should return empty string for null value', () => {
      const result = maskPII(null, 'transactionId');
      expect(result).toBe('');
    });
  });

  describe('unknown field type', () => {
    it('should fully mask an unknown field type', () => {
      const result = maskPII('sensitive data', 'unknownField');
      expect(result).toBe('**************');
    });

    it('should return empty string for null value with unknown field type', () => {
      const result = maskPII(null, 'unknownField');
      expect(result).toBe('');
    });
  });

  describe('non-string values', () => {
    it('should handle number values by converting to string', () => {
      const result = maskPII(123456789, 'ssn');
      expect(result).toBe('***-**-6789');
    });

    it('should handle boolean values by converting to string', () => {
      const result = maskPII(true, 'fullName');
      expect(result).toBe('t***');
    });
  });
});

describe('isPIIField', () => {
  it('should return true for known PII fields', () => {
    expect(isPIIField('fullName')).toBe(true);
    expect(isPIIField('ssn')).toBe(true);
    expect(isPIIField('email')).toBe(true);
    expect(isPIIField('phone')).toBe(true);
    expect(isPIIField('accountNumber')).toBe(true);
    expect(isPIIField('creditCardNumber')).toBe(true);
  });

  it('should return false for unknown fields', () => {
    expect(isPIIField('unknownField')).toBe(false);
    expect(isPIIField('productType')).toBe(false);
    expect(isPIIField('loanAmount')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isPIIField('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isPIIField(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isPIIField(undefined)).toBe(false);
  });
});

describe('getPIISensitivity', () => {
  it('should return correct sensitivity for known fields', () => {
    expect(getPIISensitivity('ssn')).toBe('critical');
    expect(getPIISensitivity('creditCardNumber')).toBe('critical');
    expect(getPIISensitivity('fullName')).toBe('high');
    expect(getPIISensitivity('email')).toBe('high');
    expect(getPIISensitivity('accountNumber')).toBe('high');
    expect(getPIISensitivity('city')).toBe('medium');
    expect(getPIISensitivity('zipCode')).toBe('medium');
    expect(getPIISensitivity('country')).toBe('low');
    expect(getPIISensitivity('transactionId')).toBe('low');
  });

  it('should return "unknown" for unknown fields', () => {
    expect(getPIISensitivity('unknownField')).toBe('unknown');
  });

  it('should return "unknown" for empty string', () => {
    expect(getPIISensitivity('')).toBe('unknown');
  });
});

describe('getPIICategory', () => {
  it('should return correct category for known fields', () => {
    expect(getPIICategory('fullName')).toBe('identity');
    expect(getPIICategory('ssn')).toBe('government');
    expect(getPIICategory('email')).toBe('contact');
    expect(getPIICategory('accountNumber')).toBe('financial');
    expect(getPIICategory('ipAddress')).toBe('digital');
  });

  it('should return "unknown" for unknown fields', () => {
    expect(getPIICategory('unknownField')).toBe('unknown');
  });

  it('should return "unknown" for empty string', () => {
    expect(getPIICategory('')).toBe('unknown');
  });
});

describe('getPIIFieldNames', () => {
  it('should return an array of PII field names', () => {
    const fieldNames = getPIIFieldNames();
    expect(Array.isArray(fieldNames)).toBe(true);
    expect(fieldNames.length).toBeGreaterThan(0);
    expect(fieldNames).toContain('fullName');
    expect(fieldNames).toContain('ssn');
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('phone');
    expect(fieldNames).toContain('accountNumber');
    expect(fieldNames).toContain('creditCardNumber');
  });
});

describe('getPIIFieldsBySensitivity', () => {
  it('should return critical sensitivity fields', () => {
    const fields = getPIIFieldsBySensitivity('critical');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.sensitivity).toBe('critical');
    }
  });

  it('should return high sensitivity fields', () => {
    const fields = getPIIFieldsBySensitivity('high');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.sensitivity).toBe('high');
    }
  });

  it('should return medium sensitivity fields', () => {
    const fields = getPIIFieldsBySensitivity('medium');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.sensitivity).toBe('medium');
    }
  });

  it('should return low sensitivity fields', () => {
    const fields = getPIIFieldsBySensitivity('low');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.sensitivity).toBe('low');
    }
  });

  it('should return empty array for unknown sensitivity', () => {
    const fields = getPIIFieldsBySensitivity('unknown');
    expect(fields).toEqual([]);
  });
});

describe('getPIIFieldsByCategory', () => {
  it('should return identity category fields', () => {
    const fields = getPIIFieldsByCategory('identity');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.category).toBe('identity');
    }
  });

  it('should return contact category fields', () => {
    const fields = getPIIFieldsByCategory('contact');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.category).toBe('contact');
    }
  });

  it('should return government category fields', () => {
    const fields = getPIIFieldsByCategory('government');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.category).toBe('government');
    }
  });

  it('should return digital category fields', () => {
    const fields = getPIIFieldsByCategory('digital');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.category).toBe('digital');
    }
  });

  it('should return financial category fields', () => {
    const fields = getPIIFieldsByCategory('financial');
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.category).toBe('financial');
    }
  });

  it('should return empty array for unknown category', () => {
    const fields = getPIIFieldsByCategory('unknown');
    expect(fields).toEqual([]);
  });
});

describe('maskPIIObject', () => {
  it('should mask all PII fields in an object', () => {
    const data = {
      borrowerName: 'Jane Doe',
      ssn: '123-45-6789',
      email: 'jane.doe@example.com',
      phone: '(555) 123-4567',
      loanAmount: 250000,
      productType: 'conventional',
    };

    const masked = maskPIIObject(data);

    expect(masked.borrowerName).not.toBe('Jane Doe');
    expect(masked.borrowerName).toBe('J*** D**');
    expect(masked.ssn).toBe('***-**-6789');
    expect(masked.email).not.toBe('jane.doe@example.com');
    expect(masked.phone).toBe('(***) ***-4567');
    expect(masked.loanAmount).toBe(250000);
    expect(masked.productType).toBe('conventional');
  });

  it('should handle null data', () => {
    const result = maskPIIObject(null);
    expect(result).toBeNull();
  });

  it('should handle undefined data', () => {
    const result = maskPIIObject(undefined);
    expect(result).toBeUndefined();
  });

  it('should handle non-object data', () => {
    const result = maskPIIObject('string');
    expect(result).toBe('string');
  });

  it('should not modify the original object', () => {
    const data = {
      borrowerName: 'Jane Doe',
      ssn: '123-45-6789',
    };

    const masked = maskPIIObject(data);

    expect(data.borrowerName).toBe('Jane Doe');
    expect(data.ssn).toBe('123-45-6789');
    expect(masked.borrowerName).not.toBe('Jane Doe');
  });

  it('should handle object with null PII values', () => {
    const data = {
      borrowerName: null,
      ssn: null,
      email: null,
      productType: 'conventional',
    };

    const masked = maskPIIObject(data);

    expect(masked.borrowerName).toBeNull();
    expect(masked.ssn).toBeNull();
    expect(masked.email).toBeNull();
    expect(masked.productType).toBe('conventional');
  });

  it('should handle object with undefined PII values', () => {
    const data = {
      borrowerName: undefined,
      productType: 'conventional',
    };

    const masked = maskPIIObject(data);

    expect(masked.borrowerName).toBeUndefined();
    expect(masked.productType).toBe('conventional');
  });

  it('should mask all known PII fields in a complex object', () => {
    const data = {
      fullName: 'John Smith',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '(555) 987-6543',
      address: '456 Oak Ave, Riverside, CA 92501',
      city: 'Riverside',
      state: 'CA',
      zipCode: '92501',
      country: 'United States',
      ssn: '987-65-4321',
      taxId: '98-7654321',
      passportNumber: 'US12345678',
      driversLicense: 'D98765432',
      dateOfBirth: '1985-03-20',
      ipAddress: '10.0.0.1',
      deviceId: 'DEV-ABCD-1234-EFGH',
      accountNumber: 'LN-9876543210',
      routingNumber: '987654321',
      creditCardNumber: '5500-0000-0000-0004',
      bankName: 'Test Bank',
      transactionId: 'TXN-ABCDEF123456',
    };

    const masked = maskPIIObject(data);

    expect(masked.fullName).not.toBe('John Smith');
    expect(masked.ssn).toBe('***-**-4321');
    expect(masked.email).not.toBe('john.smith@example.com');
    expect(masked.phone).toBe('(***) ***-6543');
    expect(masked.accountNumber).not.toBe('LN-9876543210');
    expect(masked.creditCardNumber).toBe('****-****-****-0004');
    expect(masked.bankName).toBe('Test Bank');
    expect(masked.country).toBe('United States');
    expect(masked.state).toBe('CA');
  });
});

describe('PII_FIELD_TYPES', () => {
  it('should contain all expected field type constants', () => {
    expect(PII_FIELD_TYPES).toHaveProperty('fullName');
    expect(PII_FIELD_TYPES).toHaveProperty('ssn');
    expect(PII_FIELD_TYPES).toHaveProperty('email');
    expect(PII_FIELD_TYPES).toHaveProperty('phone');
    expect(PII_FIELD_TYPES).toHaveProperty('accountNumber');
    expect(PII_FIELD_TYPES).toHaveProperty('creditCardNumber');
  });

  it('should have values matching the field names', () => {
    expect(PII_FIELD_TYPES.fullName).toBe('fullName');
    expect(PII_FIELD_TYPES.ssn).toBe('ssn');
    expect(PII_FIELD_TYPES.email).toBe('email');
  });
});

describe('PII_SENSITIVITY_LEVELS', () => {
  it('should contain all sensitivity level constants', () => {
    expect(PII_SENSITIVITY_LEVELS.LOW).toBe('low');
    expect(PII_SENSITIVITY_LEVELS.MEDIUM).toBe('medium');
    expect(PII_SENSITIVITY_LEVELS.HIGH).toBe('high');
    expect(PII_SENSITIVITY_LEVELS.CRITICAL).toBe('critical');
  });
});

describe('PII_CATEGORIES', () => {
  it('should contain all category constants', () => {
    expect(PII_CATEGORIES.IDENTITY).toBe('identity');
    expect(PII_CATEGORIES.CONTACT).toBe('contact');
    expect(PII_CATEGORIES.GOVERNMENT).toBe('government');
    expect(PII_CATEGORIES.DIGITAL).toBe('digital');
    expect(PII_CATEGORIES.FINANCIAL).toBe('financial');
  });
});

describe('all PII_FIELDS have mask patterns', () => {
  it('should have a mask pattern for every PII field defined in config', () => {
    const fieldNames = getPIIFieldNames();

    for (const fieldName of fieldNames) {
      const testValue = fieldName === 'ssn'
        ? '123-45-6789'
        : fieldName === 'email'
          ? 'test@example.com'
          : fieldName === 'phone'
            ? '(555) 123-4567'
            : fieldName === 'accountNumber'
              ? 'LN-1234567890'
              : fieldName === 'creditCardNumber'
                ? '4111-1111-1111-1111'
                : fieldName === 'dateOfBirth'
                  ? '1990-01-01'
                  : fieldName === 'ipAddress'
                    ? '192.168.1.1'
                    : fieldName === 'zipCode'
                      ? '12345'
                      : 'test-value';

      const masked = maskPII(testValue, fieldName);

      expect(masked).not.toBe(testValue);
      expect(typeof masked).toBe('string');
      expect(masked.length).toBeGreaterThan(0);
    }
  });
});