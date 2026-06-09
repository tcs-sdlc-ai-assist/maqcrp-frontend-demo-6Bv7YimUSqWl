import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getReferenceDate,
  getRelativeDate,
  formatDate,
  calculateSlaDeadline,
  isDateBreached,
  getAgingBucket,
} from './dateUtils';
import { REFERENCE_DATE } from '../config';

describe('dateUtils', () => {
  describe('getReferenceDate', () => {
    it('should return the reference date from config', () => {
      const refDate = getReferenceDate();
      expect(refDate).toBeInstanceOf(Date);
      expect(refDate).toBe(REFERENCE_DATE);
    });

    it('should return June 9, 2026', () => {
      const refDate = getReferenceDate();
      expect(refDate.getFullYear()).toBe(2026);
      expect(refDate.getMonth()).toBe(5);
      expect(refDate.getDate()).toBe(9);
    });
  });

  describe('getRelativeDate', () => {
    it('should return the reference date when offset is 0', () => {
      const result = getRelativeDate(0);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(9);
    });

    it('should return a future date when offset is positive', () => {
      const result = getRelativeDate(5);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(14);
    });

    it('should return a past date when offset is negative', () => {
      const result = getRelativeDate(-5);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(4);
    });

    it('should handle large positive offsets across month boundaries', () => {
      const result = getRelativeDate(30);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(6);
      expect(result.getDate()).toBe(9);
    });

    it('should handle large negative offsets across month boundaries', () => {
      const result = getRelativeDate(-30);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(4);
      expect(result.getDate()).toBe(10);
    });

    it('should handle offset across year boundaries', () => {
      const result = getRelativeDate(365);
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(9);
    });

    it('should handle negative offset across year boundaries', () => {
      const result = getRelativeDate(-365);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(9);
    });
  });

  describe('formatDate', () => {
    it('should format a date with default format yyyy-MM-dd', () => {
      const date = new Date(2026, 5, 9);
      const result = formatDate(date);
      expect(result).toBe('2026-06-09');
    });

    it('should format a date with custom format string', () => {
      const date = new Date(2026, 5, 9);
      const result = formatDate(date, 'MMM d, yyyy');
      expect(result).toBe('Jun 9, 2026');
    });

    it('should format a date with time', () => {
      const date = new Date(2026, 5, 9, 14, 30, 0);
      const result = formatDate(date, 'yyyy-MM-dd HH:mm:ss');
      expect(result).toBe('2026-06-09 14:30:00');
    });

    it('should return empty string for null date', () => {
      const result = formatDate(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined date', () => {
      const result = formatDate(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date', () => {
      const result = formatDate(new Date('invalid'));
      expect(result).toBe('');
    });

    it('should format a date with MMM d, yyyy format', () => {
      const date = new Date(2026, 0, 15);
      const result = formatDate(date, 'MMM d, yyyy');
      expect(result).toBe('Jan 15, 2026');
    });

    it('should format a date with full month name', () => {
      const date = new Date(2026, 11, 25);
      const result = formatDate(date, 'MMMM d, yyyy');
      expect(result).toBe('December 25, 2026');
    });
  });

  describe('calculateSlaDeadline', () => {
    it('should calculate CRITICAL SLA deadline as 1 day from base date', () => {
      const baseDate = new Date(2026, 5, 9);
      const result = calculateSlaDeadline('CRITICAL', baseDate);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(10);
    });

    it('should calculate HIGH SLA deadline as 3 days from base date', () => {
      const baseDate = new Date(2026, 5, 9);
      const result = calculateSlaDeadline('HIGH', baseDate);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(12);
    });

    it('should calculate WARNING SLA deadline as 7 days from base date', () => {
      const baseDate = new Date(2026, 5, 9);
      const result = calculateSlaDeadline('WARNING', baseDate);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(16);
    });

    it('should calculate INFO SLA deadline as 14 days from base date', () => {
      const baseDate = new Date(2026, 5, 9);
      const result = calculateSlaDeadline('INFO', baseDate);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(23);
    });

    it('should default to INFO deadline for unknown severity', () => {
      const baseDate = new Date(2026, 5, 9);
      const result = calculateSlaDeadline('UNKNOWN', baseDate);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(23);
    });

    it('should use reference date when no base date is provided', () => {
      const result = calculateSlaDeadline('CRITICAL');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle null base date by using reference date', () => {
      const result = calculateSlaDeadline('HIGH', null);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(12);
    });

    it('should handle invalid base date by using reference date', () => {
      const result = calculateSlaDeadline('HIGH', new Date('invalid'));
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(12);
    });

    it('should handle SLA deadline crossing month boundary', () => {
      const baseDate = new Date(2026, 5, 28);
      const result = calculateSlaDeadline('INFO', baseDate);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(6);
      expect(result.getDate()).toBe(12);
    });

    it('should handle SLA deadline crossing year boundary', () => {
      const baseDate = new Date(2026, 11, 30);
      const result = calculateSlaDeadline('INFO', baseDate);
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(13);
    });

    it('should return start of day for SLA deadline', () => {
      const baseDate = new Date(2026, 5, 9, 14, 30, 45);
      const result = calculateSlaDeadline('CRITICAL', baseDate);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('isDateBreached', () => {
    it('should return true when due date is before reference date', () => {
      const dueDate = new Date(2026, 5, 1);
      const result = isDateBreached(dueDate);
      expect(result).toBe(true);
    });

    it('should return false when due date is after reference date', () => {
      const dueDate = new Date(2026, 5, 15);
      const result = isDateBreached(dueDate);
      expect(result).toBe(false);
    });

    it('should return false when due date equals reference date', () => {
      const dueDate = new Date(2026, 5, 9);
      const result = isDateBreached(dueDate);
      expect(result).toBe(false);
    });

    it('should return false for null due date', () => {
      const result = isDateBreached(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined due date', () => {
      const result = isDateBreached(undefined);
      expect(result).toBe(false);
    });

    it('should return false for invalid due date', () => {
      const result = isDateBreached(new Date('invalid'));
      expect(result).toBe(false);
    });

    it('should ignore time component and compare by day', () => {
      const dueDate = new Date(2026, 5, 8, 23, 59, 59);
      const result = isDateBreached(dueDate);
      expect(result).toBe(true);
    });

    it('should return true for due date far in the past', () => {
      const dueDate = new Date(2025, 0, 1);
      const result = isDateBreached(dueDate);
      expect(result).toBe(true);
    });

    it('should return false for due date far in the future', () => {
      const dueDate = new Date(2027, 0, 1);
      const result = isDateBreached(dueDate);
      expect(result).toBe(false);
    });
  });

  describe('getAgingBucket', () => {
    it('should return "Current" for due date equal to reference date', () => {
      const dueDate = new Date(2026, 5, 9);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('Current');
    });

    it('should return "Current" for due date after reference date', () => {
      const dueDate = new Date(2026, 5, 15);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('Current');
    });

    it('should return "1-7 Days" for due date 1 day before reference date', () => {
      const dueDate = new Date(2026, 5, 8);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('1-7 Days');
    });

    it('should return "1-7 Days" for due date 7 days before reference date', () => {
      const dueDate = new Date(2026, 5, 2);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('1-7 Days');
    });

    it('should return "8-14 Days" for due date 8 days before reference date', () => {
      const dueDate = new Date(2026, 5, 1);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('8-14 Days');
    });

    it('should return "8-14 Days" for due date 14 days before reference date', () => {
      const dueDate = new Date(2026, 4, 26);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('8-14 Days');
    });

    it('should return "15-30 Days" for due date 15 days before reference date', () => {
      const dueDate = new Date(2026, 4, 25);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('15-30 Days');
    });

    it('should return "15-30 Days" for due date 30 days before reference date', () => {
      const dueDate = new Date(2026, 4, 10);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('15-30 Days');
    });

    it('should return "31-60 Days" for due date 31 days before reference date', () => {
      const dueDate = new Date(2026, 4, 9);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('31-60 Days');
    });

    it('should return "31-60 Days" for due date 60 days before reference date', () => {
      const dueDate = new Date(2026, 3, 10);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('31-60 Days');
    });

    it('should return "61-90 Days" for due date 61 days before reference date', () => {
      const dueDate = new Date(2026, 3, 9);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('61-90 Days');
    });

    it('should return "61-90 Days" for due date 90 days before reference date', () => {
      const dueDate = new Date(2026, 2, 11);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('61-90 Days');
    });

    it('should return "Over 90 Days" for due date 91 days before reference date', () => {
      const dueDate = new Date(2026, 2, 10);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('Over 90 Days');
    });

    it('should return "Over 90 Days" for due date far in the past', () => {
      const dueDate = new Date(2025, 0, 1);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('Over 90 Days');
    });

    it('should return "Unknown" for null due date', () => {
      const result = getAgingBucket(null);
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for undefined due date', () => {
      const result = getAgingBucket(undefined);
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" for invalid due date', () => {
      const result = getAgingBucket(new Date('invalid'));
      expect(result).toBe('Unknown');
    });

    it('should ignore time component when calculating aging', () => {
      const dueDate = new Date(2026, 5, 8, 23, 59, 59);
      const result = getAgingBucket(dueDate);
      expect(result).toBe('1-7 Days');
    });
  });
});