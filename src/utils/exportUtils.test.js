import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizeFilename,
  formatCSVRow,
  exportToCSV,
  exportToJSON,
  exportToTSV,
  generateExportFilename,
  exportMultiple,
} from './exportUtils';

describe('sanitizeFilename', () => {
  it('should return "export" for null input', () => {
    expect(sanitizeFilename(null)).toBe('export');
  });

  it('should return "export" for undefined input', () => {
    expect(sanitizeFilename(undefined)).toBe('export');
  });

  it('should return "export" for empty string', () => {
    expect(sanitizeFilename('')).toBe('export');
  });

  it('should return "export" for non-string input', () => {
    expect(sanitizeFilename(123)).toBe('export');
  });

  it('should preserve alphanumeric characters, hyphens, underscores, and periods', () => {
    const result = sanitizeFilename('my-report_2024.csv');
    expect(result).toBe('my-report_2024.csv');
  });

  it('should replace spaces with underscores', () => {
    const result = sanitizeFilename('my report.csv');
    expect(result).toBe('my_report.csv');
  });

  it('should replace special characters with underscores', () => {
    const result = sanitizeFilename('report (2024) @#$%.csv');
    expect(result).toBe('report_2024_.csv');
  });

  it('should collapse multiple underscores into one', () => {
    const result = sanitizeFilename('my   report.csv');
    expect(result).toBe('my_report.csv');
  });

  it('should trim leading underscores and periods', () => {
    const result = sanitizeFilename('___.my_report.csv');
    expect(result).toBe('my_report.csv');
  });

  it('should trim trailing underscores and periods', () => {
    const result = sanitizeFilename('my_report.csv___...');
    expect(result).toBe('my_report.csv');
  });

  it('should handle path traversal attempts', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    expect(result).toBe('etc_passwd');
  });

  it('should handle filename with only special characters', () => {
    const result = sanitizeFilename('@#$%^&*()');
    expect(result).toBe('export');
  });

  it('should truncate filename longer than 255 characters', () => {
    const longName = 'a'.repeat(300) + '.csv';
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result.endsWith('.csv')).toBe(true);
  });

  it('should truncate filename longer than 255 characters without extension', () => {
    const longName = 'a'.repeat(300);
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('should handle filename with extension at max length', () => {
    const base = 'a'.repeat(251);
    const name = base + '.csv';
    const result = sanitizeFilename(name);
    expect(result.length).toBe(255);
    expect(result.endsWith('.csv')).toBe(true);
  });
});

describe('formatCSVRow', () => {
  it('should format a simple row with no special characters', () => {
    const result = formatCSVRow(['Name', 'Age', 'City']);
    expect(result).toBe('Name,Age,City\r\n');
  });

  it('should escape fields containing commas', () => {
    const result = formatCSVRow(['Doe, John', '30', 'New York']);
    expect(result).toBe('"Doe, John",30,New York\r\n');
  });

  it('should escape fields containing double quotes', () => {
    const result = formatCSVRow(['say "hello"', '42']);
    expect(result).toBe('"say ""hello""",42\r\n');
  });

  it('should escape fields containing newlines', () => {
    const result = formatCSVRow(['line1\nline2', 'value']);
    expect(result).toBe('"line1\nline2",value\r\n');
  });

  it('should escape fields containing carriage returns', () => {
    const result = formatCSVRow(['line1\rline2', 'value']);
    expect(result).toBe('"line1\rline2",value\r\n');
  });

  it('should handle null values as empty strings', () => {
    const result = formatCSVRow([null, 'value', null]);
    expect(result).toBe(',value,\r\n');
  });

  it('should handle undefined values as empty strings', () => {
    const result = formatCSVRow([undefined, 'value', undefined]);
    expect(result).toBe(',value,\r\n');
  });

  it('should handle numeric values', () => {
    const result = formatCSVRow([1, 2.5, -3]);
    expect(result).toBe('1,2.5,-3\r\n');
  });

  it('should handle boolean values', () => {
    const result = formatCSVRow([true, false]);
    expect(result).toBe('true,false\r\n');
  });

  it('should handle empty array', () => {
    const result = formatCSVRow([]);
    expect(result).toBe('\r\n');
  });

  it('should handle non-array input', () => {
    const result = formatCSVRow('not an array');
    expect(result).toBe('\r\n');
  });

  it('should handle null input', () => {
    const result = formatCSVRow(null);
    expect(result).toBe('\r\n');
  });

  it('should handle undefined input', () => {
    const result = formatCSVRow(undefined);
    expect(result).toBe('\r\n');
  });

  it('should escape a field that is just a comma', () => {
    const result = formatCSVRow([',', 'value']);
    expect(result).toBe('",",value\r\n');
  });

  it('should escape a field that is just a double quote', () => {
    const result = formatCSVRow(['"', 'value']);
    expect(result).toBe('"""",value\r\n');
  });
});

describe('exportToCSV', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockAnchor;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    mockAnchor = {
      href: '',
      download: '',
      style: {},
      click: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should return false for non-array data', () => {
    const result = exportToCSV('not an array', 'test');
    expect(result).toBe(false);
  });

  it('should return false for null data', () => {
    const result = exportToCSV(null, 'test');
    expect(result).toBe(false);
  });

  it('should return false for undefined data', () => {
    const result = exportToCSV(undefined, 'test');
    expect(result).toBe(false);
  });

  it('should export an array of objects as CSV', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = exportToCSV(data, 'users');
    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('users.csv');
  });

  it('should append .csv extension if not present', () => {
    const data = [{ name: 'Alice' }];
    const result = exportToCSV(data, 'report');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('report.csv');
  });

  it('should not double-append .csv extension', () => {
    const data = [{ name: 'Alice' }];
    const result = exportToCSV(data, 'report.csv');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('report.csv');
  });

  it('should sanitize the filename', () => {
    const data = [{ name: 'Alice' }];
    const result = exportToCSV(data, 'my report (2024)');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('my_report_2024.csv');
  });

  it('should export with specific columns', () => {
    const data = [
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
    ];
    const result = exportToCSV(data, 'users', { columns: ['name', 'city'] });
    expect(result).toBe(true);
  });

  it('should export without headers when includeHeaders is false', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportToCSV(data, 'users', { includeHeaders: false });
    expect(result).toBe(true);
  });

  it('should handle empty data array', () => {
    const result = exportToCSV([], 'empty');
    expect(result).toBe(true);
  });

  it('should handle data with null values', () => {
    const data = [{ name: 'Alice', age: null, city: undefined }];
    const result = exportToCSV(data, 'users');
    expect(result).toBe(true);
  });

  it('should handle data with Date objects', () => {
    const data = [{ name: 'Alice', createdAt: new Date(2026, 5, 9) }];
    const result = exportToCSV(data, 'users');
    expect(result).toBe(true);
  });

  it('should handle data with nested objects', () => {
    const data = [{ name: 'Alice', meta: { key: 'value' } }];
    const result = exportToCSV(data, 'users');
    expect(result).toBe(true);
  });

  it('should handle data with arrays', () => {
    const data = [{ name: 'Alice', tags: ['a', 'b'] }];
    const result = exportToCSV(data, 'users');
    expect(result).toBe(true);
  });

  it('should handle errors gracefully', () => {
    const circularObj = { name: 'test' };
    circularObj.self = circularObj;
    const data = [circularObj];
    const result = exportToCSV(data, 'circular');
    expect(result).toBe(false);
  });
});

describe('exportToJSON', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockAnchor;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    mockAnchor = {
      href: '',
      download: '',
      style: {},
      click: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should return false for undefined data', () => {
    const result = exportToJSON(undefined, 'test');
    expect(result).toBe(false);
  });

  it('should export an object as JSON', () => {
    const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
    const result = exportToJSON(data, 'users');
    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('users.json');
  });

  it('should export an array as JSON', () => {
    const data = [{ name: 'Alice' }, { name: 'Bob' }];
    const result = exportToJSON(data, 'users');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('users.json');
  });

  it('should export a primitive value as JSON', () => {
    const result = exportToJSON('hello', 'greeting');
    expect(result).toBe(true);
  });

  it('should export null as JSON', () => {
    const result = exportToJSON(null, 'null-value');
    expect(result).toBe(true);
  });

  it('should export number as JSON', () => {
    const result = exportToJSON(42, 'number');
    expect(result).toBe(true);
  });

  it('should append .json extension if not present', () => {
    const data = { key: 'value' };
    const result = exportToJSON(data, 'config');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('config.json');
  });

  it('should not double-append .json extension', () => {
    const data = { key: 'value' };
    const result = exportToJSON(data, 'config.json');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('config.json');
  });

  it('should sanitize the filename', () => {
    const data = { key: 'value' };
    const result = exportToJSON(data, 'my config (2024)');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('my_config_2024.json');
  });

  it('should pretty-print JSON by default', () => {
    const data = { name: 'Alice', age: 30 };
    const result = exportToJSON(data, 'users');
    expect(result).toBe(true);
  });

  it('should minify JSON when pretty is false', () => {
    const data = { name: 'Alice', age: 30 };
    const result = exportToJSON(data, 'users', { pretty: false });
    expect(result).toBe(true);
  });

  it('should use custom indent when specified', () => {
    const data = { name: 'Alice', age: 30 };
    const result = exportToJSON(data, 'users', { indent: 4 });
    expect(result).toBe(true);
  });

  it('should handle circular references gracefully', () => {
    const circularObj = { name: 'test' };
    circularObj.self = circularObj;
    const result = exportToJSON(circularObj, 'circular');
    expect(result).toBe(false);
  });
});

describe('exportToTSV', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockAnchor;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    mockAnchor = {
      href: '',
      download: '',
      style: {},
      click: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should return false for non-array data', () => {
    const result = exportToTSV('not an array', 'test');
    expect(result).toBe(false);
  });

  it('should return false for null data', () => {
    const result = exportToTSV(null, 'test');
    expect(result).toBe(false);
  });

  it('should export an array of objects as TSV', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = exportToTSV(data, 'users');
    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('users.tsv');
  });

  it('should append .tsv extension if not present', () => {
    const data = [{ name: 'Alice' }];
    const result = exportToTSV(data, 'report');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('report.tsv');
  });

  it('should not double-append .tsv extension', () => {
    const data = [{ name: 'Alice' }];
    const result = exportToTSV(data, 'report.tsv');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('report.tsv');
  });

  it('should sanitize the filename', () => {
    const data = [{ name: 'Alice' }];
    const result = exportToTSV(data, 'my report (2024)');
    expect(result).toBe(true);
    expect(mockAnchor.download).toBe('my_report_2024.tsv');
  });

  it('should export with specific columns', () => {
    const data = [
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
    ];
    const result = exportToTSV(data, 'users', { columns: ['name', 'city'] });
    expect(result).toBe(true);
  });

  it('should export without headers when includeHeaders is false', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportToTSV(data, 'users', { includeHeaders: false });
    expect(result).toBe(true);
  });

  it('should handle empty data array', () => {
    const result = exportToTSV([], 'empty');
    expect(result).toBe(true);
  });
});

describe('generateExportFilename', () => {
  it('should generate a filename with default prefix', () => {
    const result = generateExportFilename();
    expect(result).toMatch(/^export-\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('should generate a filename with custom prefix', () => {
    const result = generateExportFilename('risk-report');
    expect(result).toMatch(/^risk-report-\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('should include current date in the filename', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const expectedDatePart = `${year}-${month}-${day}`;

    const result = generateExportFilename('test');
    expect(result).toContain(expectedDatePart);
  });

  it('should include time in the filename', () => {
    const result = generateExportFilename('test');
    const timePart = result.split('-').slice(3).join('-');
    expect(timePart).toMatch(/^\d{6}$/);
  });

  it('should generate unique filenames on subsequent calls', () => {
    const result1 = generateExportFilename('test');
    const result2 = generateExportFilename('test');
    expect(result1).not.toBe(result2);
  });
});

describe('exportMultiple', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockAnchor;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    mockAnchor = {
      href: '',
      download: '',
      style: {},
      click: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should export CSV and JSON by default', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportMultiple(data, 'report');
    expect(result.csv).toBe(true);
    expect(result.json).toBe(true);
    expect(result.tsv).toBe(false);
  });

  it('should export only CSV when json is false', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportMultiple(data, 'report', { csv: true, json: false });
    expect(result.csv).toBe(true);
    expect(result.json).toBe(false);
    expect(result.tsv).toBe(false);
  });

  it('should export only JSON when csv is false', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportMultiple(data, 'report', { csv: false, json: true });
    expect(result.csv).toBe(false);
    expect(result.json).toBe(true);
    expect(result.tsv).toBe(false);
  });

  it('should export TSV when tsv is true', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportMultiple(data, 'report', { csv: false, json: false, tsv: true });
    expect(result.csv).toBe(false);
    expect(result.json).toBe(false);
    expect(result.tsv).toBe(true);
  });

  it('should export all three formats', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const result = exportMultiple(data, 'report', { csv: true, json: true, tsv: true });
    expect(result.csv).toBe(true);
    expect(result.json).toBe(true);
    expect(result.tsv).toBe(true);
  });

  it('should pass columns option to CSV and TSV exports', () => {
    const data = [
      { name: 'Alice', age: 30, city: 'NYC' },
    ];
    const result = exportMultiple(data, 'report', {
      csv: true,
      json: false,
      tsv: true,
      columns: ['name', 'city'],
    });
    expect(result.csv).toBe(true);
    expect(result.tsv).toBe(true);
  });

  it('should handle non-array data gracefully', () => {
    const result = exportMultiple(null, 'report');
    expect(result.csv).toBe(false);
    expect(result.json).toBe(false);
    expect(result.tsv).toBe(false);
  });
});

describe('CSV generation with special characters', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockAnchor;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    mockAnchor = {
      href: '',
      download: '',
      style: {},
      click: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('should handle data with commas in values', () => {
    const data = [
      { name: 'Doe, John', description: 'A "great" person' },
    ];
    const result = exportToCSV(data, 'special');
    expect(result).toBe(true);
  });

  it('should handle data with double quotes in values', () => {
    const data = [
      { name: 'Alice', quote: 'She said "hello"' },
    ];
    const result = exportToCSV(data, 'quotes');
    expect(result).toBe(true);
  });

  it('should handle data with newlines in values', () => {
    const data = [
      { name: 'Alice', bio: 'Line 1\nLine 2' },
    ];
    const result = exportToCSV(data, 'newlines');
    expect(result).toBe(true);
  });

  it('should handle data with mixed special characters', () => {
    const data = [
      { name: 'Doe, "John"', notes: 'Multi\nline, with "quotes"' },
    ];
    const result = exportToCSV(data, 'mixed');
    expect(result).toBe(true);
  });

  it('should handle data with empty objects', () => {
    const data = [{}, {}];
    const result = exportToCSV(data, 'empty-objects');
    expect(result).toBe(true);
  });

  it('should handle data with varying keys across objects', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', city: 'NYC' },
      { name: 'Charlie', age: 25, city: 'LA' },
    ];
    const result = exportToCSV(data, 'varying-keys');
    expect(result).toBe(true);
  });
});