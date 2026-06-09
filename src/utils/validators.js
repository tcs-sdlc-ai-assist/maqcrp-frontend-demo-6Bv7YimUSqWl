import { REFERENCE_DATE, PRODUCT_TYPES, CHANNELS } from '../config';

/**
 * @typedef {Object} ValidationError
 * @property {string} field - The field name that failed validation.
 * @property {string} code - Machine-readable error code (e.g., "REQUIRED", "INVALID_FORMAT").
 * @property {string} message - Human-readable error message.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the data passed all validations.
 * @property {ValidationError[]} errors - Array of validation errors (empty if valid).
 */

/**
 * @typedef {Object} LoanInput
 * @property {string} borrowerName
 * @property {string} ssn
 * @property {string} propertyAddress
 * @property {number} loanAmount
 * @property {string} productType
 * @property {string} channel
 * @property {string} sellerId
 * @property {string} [borrowerAddress]
 * @property {number} [borrowerIncome]
 * @property {number} [creditScore]
 * @property {string} [accountNumber]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [loanPurpose]
 * @property {number} [ltv]
 * @property {number} [dti]
 */

/**
 * @typedef {Object} RuleInput
 * @property {string} name
 * @property {string} description
 * @property {string[]} productTypes
 * @property {string[]} channels
 * @property {string[]|null} sellerIds
 * @property {string} ruleType
 * @property {Array<{field: string, operator: string, value: any, message: string}>} conditions
 * @property {number} weight
 * @property {string} effectiveDate
 * @property {string|null} expirationDate
 */

const VALID_PRODUCT_TYPES = ['conventional', 'FHA', 'VA', 'jumbo', 'USDA'];
const VALID_CHANNELS = ['retail', 'correspondent', 'broker', 'wholesale'];
const VALID_LOAN_PURPOSES = ['purchase', 'refinance', 'cash-out'];
const VALID_RULE_TYPES = ['hard_stop', 'weighted_score'];
const VALID_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'not_in'];

const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(\d{3}\) \d{3}-\d{4}$/;
const ACCOUNT_NUMBER_REGEX = /^LN-\d{4,10}$/;

const MAX_LOAN_AMOUNT = 5000000;
const MIN_CREDIT_SCORE = 300;
const MAX_CREDIT_SCORE = 850;
const MIN_LTV = 0;
const MAX_LTV = 100;
const MIN_DTI = 0;
const MAX_DTI = 100;
const MIN_RULE_WEIGHT = 1;
const MAX_RULE_WEIGHT = 100;

/**
 * Creates a validation error object.
 * @param {string} field - The field name.
 * @param {string} code - Error code.
 * @param {string} message - Error message.
 * @returns {ValidationError}
 */
const createError = (field, code, message) => ({
  field,
  code,
  message,
});

/**
 * Validates that a value is present and non-empty.
 * @param {*} value - The value to check.
 * @param {string} field - The field name for error reporting.
 * @param {string} [label] - Human-readable field label.
 * @returns {ValidationError|null}
 */
const validateRequired = (value, field, label) => {
  const fieldLabel = label || field;
  if (value === undefined || value === null) {
    return createError(field, 'REQUIRED', `${fieldLabel} is required.`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    return createError(field, 'REQUIRED', `${fieldLabel} is required.`);
  }
  return null;
};

/**
 * Validates that a value is a positive number.
 * @param {*} value - The value to check.
 * @param {string} field - The field name.
 * @param {string} [label] - Human-readable field label.
 * @returns {ValidationError|null}
 */
const validatePositiveNumber = (value, field, label) => {
  const fieldLabel = label || field;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || isNaN(value)) {
    return createError(field, 'INVALID_TYPE', `${fieldLabel} must be a number.`);
  }
  if (value <= 0) {
    return createError(field, 'OUT_OF_RANGE', `${fieldLabel} must be a positive number.`);
  }
  return null;
};

/**
 * Validates that a number falls within a specified range.
 * @param {*} value - The value to check.
 * @param {string} field - The field name.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @param {string} [label] - Human-readable field label.
 * @returns {ValidationError|null}
 */
const validateNumberRange = (value, field, min, max, label) => {
  const fieldLabel = label || field;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || isNaN(value)) {
    return createError(field, 'INVALID_TYPE', `${fieldLabel} must be a number.`);
  }
  if (value < min || value > max) {
    return createError(
      field,
      'OUT_OF_RANGE',
      `${fieldLabel} must be between ${min} and ${max}.`,
    );
  }
  return null;
};

/**
 * Validates that a string matches a regex pattern.
 * @param {*} value - The value to check.
 * @param {string} field - The field name.
 * @param {RegExp} regex - The regex pattern.
 * @param {string} formatDescription - Human-readable format description.
 * @param {string} [label] - Human-readable field label.
 * @returns {ValidationError|null}
 */
const validatePattern = (value, field, regex, formatDescription, label) => {
  const fieldLabel = label || field;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!regex.test(String(value))) {
    return createError(
      field,
      'INVALID_FORMAT',
      `${fieldLabel} must be in format: ${formatDescription}.`,
    );
  }
  return null;
};

/**
 * Validates that a value is one of the allowed enum values.
 * @param {*} value - The value to check.
 * @param {string} field - The field name.
 * @param {string[]} allowedValues - Array of allowed values.
 * @param {string} [label] - Human-readable field label.
 * @returns {ValidationError|null}
 */
const validateEnum = (value, field, allowedValues, label) => {
  const fieldLabel = label || field;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!allowedValues.includes(value)) {
    return createError(
      field,
      'INVALID_VALUE',
      `${fieldLabel} must be one of: ${allowedValues.join(', ')}.`,
    );
  }
  return null;
};

/**
 * Validates a complete loan input object against the loan schema.
 * Returns all validation errors found.
 * @param {LoanInput} loan - The loan data to validate.
 * @returns {ValidationResult}
 */
export const validateLoanSchema = (loan) => {
  const errors = [];

  if (!loan || typeof loan !== 'object') {
    errors.push(createError('loan', 'INVALID_INPUT', 'Loan data must be an object.'));
    return { valid: false, errors };
  }

  const requiredError = validateRequired(loan.borrowerName, 'borrowerName', 'Borrower name');
  if (requiredError) errors.push(requiredError);

  const ssnRequired = validateRequired(loan.ssn, 'ssn', 'SSN');
  if (ssnRequired) {
    errors.push(ssnRequired);
  } else {
    const ssnFormat = validatePattern(loan.ssn, 'ssn', SSN_REGEX, 'XXX-XX-XXXX', 'SSN');
    if (ssnFormat) errors.push(ssnFormat);
  }

  const addressRequired = validateRequired(loan.propertyAddress, 'propertyAddress', 'Property address');
  if (addressRequired) errors.push(addressRequired);

  const amountRequired = validateRequired(loan.loanAmount, 'loanAmount', 'Loan amount');
  if (amountRequired) {
    errors.push(amountRequired);
  } else {
    const amountPositive = validatePositiveNumber(loan.loanAmount, 'loanAmount', 'Loan amount');
    if (amountPositive) {
      errors.push(amountPositive);
    } else if (loan.loanAmount > MAX_LOAN_AMOUNT) {
      errors.push(
        createError(
          'loanAmount',
          'OUT_OF_RANGE',
          `Loan amount must not exceed $${MAX_LOAN_AMOUNT.toLocaleString()}.`,
        ),
      );
    }
  }

  const productRequired = validateRequired(loan.productType, 'productType', 'Product type');
  if (productRequired) {
    errors.push(productRequired);
  } else {
    const productEnum = validateEnum(loan.productType, 'productType', VALID_PRODUCT_TYPES, 'Product type');
    if (productEnum) errors.push(productEnum);
  }

  const channelRequired = validateRequired(loan.channel, 'channel', 'Channel');
  if (channelRequired) {
    errors.push(channelRequired);
  } else {
    const channelEnum = validateEnum(loan.channel, 'channel', VALID_CHANNELS, 'Channel');
    if (channelEnum) errors.push(channelEnum);
  }

  const sellerRequired = validateRequired(loan.sellerId, 'sellerId', 'Seller ID');
  if (sellerRequired) errors.push(sellerRequired);

  if (loan.creditScore !== undefined && loan.creditScore !== null) {
    const creditRange = validateNumberRange(
      loan.creditScore,
      'creditScore',
      MIN_CREDIT_SCORE,
      MAX_CREDIT_SCORE,
      'Credit score',
    );
    if (creditRange) errors.push(creditRange);
  }

  if (loan.ltv !== undefined && loan.ltv !== null) {
    const ltvRange = validateNumberRange(loan.ltv, 'ltv', MIN_LTV, MAX_LTV, 'LTV');
    if (ltvRange) errors.push(ltvRange);
  }

  if (loan.dti !== undefined && loan.dti !== null) {
    const dtiRange = validateNumberRange(loan.dti, 'dti', MIN_DTI, MAX_DTI, 'DTI');
    if (dtiRange) errors.push(dtiRange);
  }

  if (loan.borrowerIncome !== undefined && loan.borrowerIncome !== null) {
    const incomePositive = validatePositiveNumber(
      loan.borrowerIncome,
      'borrowerIncome',
      'Borrower income',
    );
    if (incomePositive) errors.push(incomePositive);
  }

  if (loan.email !== undefined && loan.email !== null && loan.email !== '') {
    const emailFormat = validatePattern(
      loan.email,
      'email',
      EMAIL_REGEX,
      'user@example.com',
      'Email',
    );
    if (emailFormat) errors.push(emailFormat);
  }

  if (loan.phone !== undefined && loan.phone !== null && loan.phone !== '') {
    const phoneFormat = validatePattern(
      loan.phone,
      'phone',
      PHONE_REGEX,
      '(XXX) XXX-XXXX',
      'Phone',
    );
    if (phoneFormat) errors.push(phoneFormat);
  }

  if (loan.accountNumber !== undefined && loan.accountNumber !== null && loan.accountNumber !== '') {
    const accountFormat = validatePattern(
      loan.accountNumber,
      'accountNumber',
      ACCOUNT_NUMBER_REGEX,
      'LN-XXXXXXXX',
      'Account number',
    );
    if (accountFormat) errors.push(accountFormat);
  }

  if (loan.loanPurpose !== undefined && loan.loanPurpose !== null && loan.loanPurpose !== '') {
    const purposeEnum = validateEnum(
      loan.loanPurpose,
      'loanPurpose',
      VALID_LOAN_PURPOSES,
      'Loan purpose',
    );
    if (purposeEnum) errors.push(purposeEnum);
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates required fields against a schema definition.
 * The schema is an array of field definitions: { field, label, type, required }.
 * @param {Object} data - The data object to validate.
 * @param {Array<{field: string, label: string, type?: string, required?: boolean}>} schema - Field definitions.
 * @returns {ValidationResult}
 */
export const validateRequiredFields = (data, schema) => {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push(createError('data', 'INVALID_INPUT', 'Data must be an object.'));
    return { valid: false, errors };
  }

  for (const fieldDef of schema) {
    if (fieldDef.required) {
      const error = validateRequired(data[fieldDef.field], fieldDef.field, fieldDef.label);
      if (error) errors.push(error);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates cross-field dependency rules for a loan.
 * Checks business rules that depend on multiple fields.
 * @param {LoanInput} loan - The loan data to validate.
 * @returns {ValidationResult}
 */
export const validateDependencyRules = (loan) => {
  const errors = [];

  if (!loan || typeof loan !== 'object') {
    errors.push(createError('loan', 'INVALID_INPUT', 'Loan data must be an object.'));
    return { valid: false, errors };
  }

  if (loan.productType === 'FHA' && loan.ltv !== undefined && loan.ltv !== null && loan.ltv > 96.5) {
    errors.push(
      createError(
        'ltv',
        'DEPENDENCY_VIOLATION',
        'FHA loans require LTV of 96.5% or lower.',
      ),
    );
  }

  if (loan.productType === 'VA' && loan.ltv !== undefined && loan.ltv !== null && loan.ltv > 100) {
    errors.push(
      createError(
        'ltv',
        'DEPENDENCY_VIOLATION',
        'VA loans require LTV of 100% or lower.',
      ),
    );
  }

  if (
    loan.productType === 'jumbo' &&
    loan.loanAmount !== undefined &&
    loan.loanAmount !== null &&
    loan.loanAmount <= 726200
  ) {
    errors.push(
      createError(
        'loanAmount',
        'DEPENDENCY_VIOLATION',
        'Jumbo loans must exceed the conforming loan limit of $726,200.',
      ),
    );
  }

  if (
    loan.productType === 'conventional' &&
    loan.loanAmount !== undefined &&
    loan.loanAmount !== null &&
    loan.loanAmount > 726200
  ) {
    errors.push(
      createError(
        'productType',
        'DEPENDENCY_VIOLATION',
        'Conventional loans exceeding $726,200 should be classified as jumbo.',
      ),
    );
  }

  if (
    loan.productType === 'USDA' &&
    loan.borrowerIncome !== undefined &&
    loan.borrowerIncome !== null &&
    loan.borrowerIncome > 110000
  ) {
    errors.push(
      createError(
        'borrowerIncome',
        'DEPENDENCY_VIOLATION',
        'USDA loans have income limits. Borrower income exceeds typical USDA limit of $110,000.',
      ),
    );
  }

  if (
    loan.loanPurpose === 'cash-out' &&
    loan.ltv !== undefined &&
    loan.ltv !== null &&
    loan.ltv > 80
  ) {
    errors.push(
      createError(
        'ltv',
        'DEPENDENCY_VIOLATION',
        'Cash-out refinance loans typically require LTV of 80% or lower.',
      ),
    );
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates a single rule condition object.
 * @param {Object} condition - The condition to validate.
 * @param {number} index - The index of the condition in the array.
 * @returns {ValidationError[]}
 */
const validateCondition = (condition, index) => {
  const errors = [];
  const prefix = `conditions[${index}]`;

  if (!condition || typeof condition !== 'object') {
    errors.push(createError(prefix, 'INVALID_INPUT', `Condition at index ${index} must be an object.`));
    return errors;
  }

  const fieldError = validateRequired(condition.field, `${prefix}.field`, 'Condition field');
  if (fieldError) errors.push(fieldError);

  const operatorError = validateRequired(condition.operator, `${prefix}.operator`, 'Condition operator');
  if (operatorError) {
    errors.push(operatorError);
  } else {
    const operatorEnum = validateEnum(
      condition.operator,
      `${prefix}.operator`,
      VALID_OPERATORS,
      'Operator',
    );
    if (operatorEnum) errors.push(operatorEnum);
  }

  if (condition.value === undefined || condition.value === null) {
    errors.push(
      createError(`${prefix}.value`, 'REQUIRED', 'Condition value is required.'),
    );
  }

  const messageError = validateRequired(condition.message, `${prefix}.message`, 'Condition message');
  if (messageError) errors.push(messageError);

  return errors;
};

/**
 * Validates a complete eligibility rule configuration.
 * @param {RuleInput} rule - The rule configuration to validate.
 * @returns {ValidationResult}
 */
export const validateRuleConfig = (rule) => {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    errors.push(createError('rule', 'INVALID_INPUT', 'Rule must be an object.'));
    return { valid: false, errors };
  }

  const nameError = validateRequired(rule.name, 'name', 'Rule name');
  if (nameError) errors.push(nameError);

  const descError = validateRequired(rule.description, 'description', 'Rule description');
  if (descError) errors.push(descError);

  const ruleTypeError = validateRequired(rule.ruleType, 'ruleType', 'Rule type');
  if (ruleTypeError) {
    errors.push(ruleTypeError);
  } else {
    const ruleTypeEnum = validateEnum(rule.ruleType, 'ruleType', VALID_RULE_TYPES, 'Rule type');
    if (ruleTypeEnum) errors.push(ruleTypeEnum);
  }

  if (!Array.isArray(rule.productTypes) || rule.productTypes.length === 0) {
    errors.push(
      createError('productTypes', 'REQUIRED', 'At least one product type must be selected.'),
    );
  } else {
    for (let i = 0; i < rule.productTypes.length; i++) {
      const productEnum = validateEnum(
        rule.productTypes[i],
        `productTypes[${i}]`,
        VALID_PRODUCT_TYPES,
        'Product type',
      );
      if (productEnum) errors.push(productEnum);
    }
  }

  if (!Array.isArray(rule.channels) || rule.channels.length === 0) {
    errors.push(createError('channels', 'REQUIRED', 'At least one channel must be selected.'));
  } else {
    for (let i = 0; i < rule.channels.length; i++) {
      const channelEnum = validateEnum(
        rule.channels[i],
        `channels[${i}]`,
        VALID_CHANNELS,
        'Channel',
      );
      if (channelEnum) errors.push(channelEnum);
    }
  }

  if (rule.sellerIds !== null && rule.sellerIds !== undefined) {
    if (!Array.isArray(rule.sellerIds)) {
      errors.push(
        createError('sellerIds', 'INVALID_TYPE', 'Seller IDs must be an array or null.'),
      );
    } else if (rule.sellerIds.length === 0) {
      errors.push(
        createError('sellerIds', 'INVALID_VALUE', 'Seller IDs array must not be empty. Use null for all sellers.'),
      );
    }
  }

  if (rule.ruleType === 'weighted_score') {
    if (rule.weight === undefined || rule.weight === null) {
      errors.push(
        createError('weight', 'REQUIRED', 'Weight is required for weighted score rules.'),
      );
    } else if (typeof rule.weight !== 'number' || isNaN(rule.weight)) {
      errors.push(createError('weight', 'INVALID_TYPE', 'Weight must be a number.'));
    } else if (rule.weight < MIN_RULE_WEIGHT || rule.weight > MAX_RULE_WEIGHT) {
      errors.push(
        createError(
          'weight',
          'OUT_OF_RANGE',
          `Weight must be between ${MIN_RULE_WEIGHT} and ${MAX_RULE_WEIGHT}.`,
        ),
      );
    }
  }

  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    errors.push(
      createError('conditions', 'REQUIRED', 'At least one condition is required.'),
    );
  } else {
    for (let i = 0; i < rule.conditions.length; i++) {
      const conditionErrors = validateCondition(rule.conditions[i], i);
      errors.push(...conditionErrors);
    }
  }

  const effectiveError = validateRequired(rule.effectiveDate, 'effectiveDate', 'Effective date');
  if (effectiveError) {
    errors.push(effectiveError);
  } else {
    const effectiveDate = new Date(rule.effectiveDate);
    if (isNaN(effectiveDate.getTime())) {
      errors.push(
        createError(
          'effectiveDate',
          'INVALID_FORMAT',
          'Effective date must be a valid date in YYYY-MM-DD format.',
        ),
      );
    }
  }

  if (rule.expirationDate !== null && rule.expirationDate !== undefined && rule.expirationDate !== '') {
    const expirationDate = new Date(rule.expirationDate);
    if (isNaN(expirationDate.getTime())) {
      errors.push(
        createError(
          'expirationDate',
          'INVALID_FORMAT',
          'Expiration date must be a valid date in YYYY-MM-DD format or null.',
        ),
      );
    } else if (rule.effectiveDate) {
      const effectiveDate = new Date(rule.effectiveDate);
      if (!isNaN(effectiveDate.getTime()) && expirationDate <= effectiveDate) {
        errors.push(
          createError(
            'expirationDate',
            'DEPENDENCY_VIOLATION',
            'Expiration date must be after the effective date.',
          ),
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates that a seller ID references an existing seller.
 * @param {string} sellerId - The seller ID to validate.
 * @param {Array<{id: string}>} existingSellers - Array of existing seller objects.
 * @returns {ValidationResult}
 */
export const validateSellerReference = (sellerId, existingSellers) => {
  const errors = [];

  if (!sellerId || typeof sellerId !== 'string') {
    errors.push(createError('sellerId', 'REQUIRED', 'Seller ID is required.'));
    return { valid: false, errors };
  }

  if (!Array.isArray(existingSellers)) {
    errors.push(createError('sellerId', 'INTERNAL_ERROR', 'Unable to validate seller reference.'));
    return { valid: false, errors };
  }

  const sellerExists = existingSellers.some((seller) => seller.id === sellerId);

  if (!sellerExists) {
    errors.push(
      createError(
        'sellerId',
        'REFERENCE_NOT_FOUND',
        `Seller with ID "${sellerId}" does not exist.`,
      ),
    );
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates a complete loan input including schema, dependency rules, and seller reference.
 * This is the primary validation function for loan intake.
 * @param {LoanInput} loan - The loan data to validate.
 * @param {Array<{id: string}>} existingSellers - Array of existing seller objects for reference validation.
 * @returns {ValidationResult}
 */
export const validateLoan = (loan, existingSellers) => {
  const allErrors = [];

  const schemaResult = validateLoanSchema(loan);
  allErrors.push(...schemaResult.errors);

  if (schemaResult.valid) {
    const dependencyResult = validateDependencyRules(loan);
    allErrors.push(...dependencyResult.errors);

    if (loan.sellerId) {
      const sellerResult = validateSellerReference(loan.sellerId, existingSellers);
      allErrors.push(...sellerResult.errors);
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors };
};

/**
 * Validates a file upload for loan intake.
 * Checks file type, size, and basic structure.
 * @param {File} file - The file object to validate.
 * @param {Object} [options] - Validation options.
 * @param {number} [options.maxSizeMB=10] - Maximum file size in megabytes.
 * @param {string[]} [options.allowedTypes=['text/csv', 'application/json']] - Allowed MIME types.
 * @returns {ValidationResult}
 */
export const validateFileUpload = (file, options = {}) => {
  const errors = [];
  const { maxSizeMB = 10, allowedTypes = ['text/csv', 'application/json'] } = options;

  if (!file) {
    errors.push(createError('file', 'REQUIRED', 'A file must be selected for upload.'));
    return { valid: false, errors };
  }

  if (!allowedTypes.includes(file.type)) {
    errors.push(
      createError(
        'file',
        'INVALID_TYPE',
        `File type "${file.type}" is not supported. Allowed types: ${allowedTypes.join(', ')}.`,
      ),
    );
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    errors.push(
      createError(
        'file',
        'FILE_TOO_LARGE',
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum of ${maxSizeMB} MB.`,
      ),
    );
  }

  if (file.size === 0) {
    errors.push(createError('file', 'FILE_EMPTY', 'The selected file is empty.'));
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates a sampling configuration for QC workflows.
 * @param {Object} config - The sampling configuration to validate.
 * @returns {ValidationResult}
 */
export const validateSamplingConfig = (config) => {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push(createError('config', 'INVALID_INPUT', 'Sampling configuration must be an object.'));
    return { valid: false, errors };
  }

  const nameError = validateRequired(config.name, 'name', 'Configuration name');
  if (nameError) errors.push(nameError);

  const methodologyError = validateRequired(config.methodology, 'methodology', 'Sampling methodology');
  if (methodologyError) {
    errors.push(methodologyError);
  } else {
    const validMethodologies = ['random', 'risk_based', 'targeted', 'threshold'];
    const methodologyEnum = validateEnum(
      config.methodology,
      'methodology',
      validMethodologies,
      'Methodology',
    );
    if (methodologyEnum) errors.push(methodologyEnum);
  }

  if (config.sampleRate === undefined || config.sampleRate === null) {
    errors.push(createError('sampleRate', 'REQUIRED', 'Sample rate is required.'));
  } else if (typeof config.sampleRate !== 'number' || isNaN(config.sampleRate)) {
    errors.push(createError('sampleRate', 'INVALID_TYPE', 'Sample rate must be a number.'));
  } else if (config.sampleRate < 0 || config.sampleRate > 100) {
    errors.push(
      createError('sampleRate', 'OUT_OF_RANGE', 'Sample rate must be between 0 and 100.'),
    );
  }

  if (config.methodology === 'risk_based') {
    if (!Array.isArray(config.riskCriteria) || config.riskCriteria.length === 0) {
      errors.push(
        createError(
          'riskCriteria',
          'REQUIRED',
          'Risk criteria are required for risk-based sampling.',
        ),
      );
    } else {
      for (let i = 0; i < config.riskCriteria.length; i++) {
        const criterion = config.riskCriteria[i];
        const prefix = `riskCriteria[${i}]`;

        const fieldError = validateRequired(criterion.field, `${prefix}.field`, 'Risk criterion field');
        if (fieldError) errors.push(fieldError);

        const operatorError = validateRequired(
          criterion.operator,
          `${prefix}.operator`,
          'Risk criterion operator',
        );
        if (operatorError) {
          errors.push(operatorError);
        } else {
          const operatorEnum = validateEnum(
            criterion.operator,
            `${prefix}.operator`,
            VALID_OPERATORS,
            'Operator',
          );
          if (operatorEnum) errors.push(operatorEnum);
        }

        if (criterion.value === undefined || criterion.value === null) {
          errors.push(
            createError(`${prefix}.value`, 'REQUIRED', 'Risk criterion value is required.'),
          );
        }

        if (criterion.weight === undefined || criterion.weight === null) {
          errors.push(
            createError(`${prefix}.weight`, 'REQUIRED', 'Risk criterion weight is required.'),
          );
        } else if (typeof criterion.weight !== 'number' || isNaN(criterion.weight)) {
          errors.push(
            createError(`${prefix}.weight`, 'INVALID_TYPE', 'Risk criterion weight must be a number.'),
          );
        } else if (criterion.weight <= 0) {
          errors.push(
            createError(
              `${prefix}.weight`,
              'OUT_OF_RANGE',
              'Risk criterion weight must be a positive number.',
            ),
          );
        }
      }
    }
  }

  if (config.methodology === 'threshold') {
    if (!Array.isArray(config.thresholdRules) || config.thresholdRules.length === 0) {
      errors.push(
        createError(
          'thresholdRules',
          'REQUIRED',
          'Threshold rules are required for threshold-based sampling.',
        ),
      );
    } else {
      for (let i = 0; i < config.thresholdRules.length; i++) {
        const rule = config.thresholdRules[i];
        const prefix = `thresholdRules[${i}]`;

        const fieldError = validateRequired(rule.field, `${prefix}.field`, 'Threshold rule field');
        if (fieldError) errors.push(fieldError);

        const operatorError = validateRequired(
          rule.operator,
          `${prefix}.operator`,
          'Threshold rule operator',
        );
        if (operatorError) {
          errors.push(operatorError);
        } else {
          const operatorEnum = validateEnum(
            rule.operator,
            `${prefix}.operator`,
            VALID_OPERATORS,
            'Operator',
          );
          if (operatorEnum) errors.push(operatorEnum);
        }

        if (rule.value === undefined || rule.value === null) {
          errors.push(
            createError(`${prefix}.value`, 'REQUIRED', 'Threshold rule value is required.'),
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
};