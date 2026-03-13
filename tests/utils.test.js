import { describe, it, expect } from 'vitest';
import { timeAgo, timeAgoPt, stripHtml, escapeHtml, isWithinHours, decodeHtmlEntities, uid } from '../src/utils.js';

describe('utils.js', () => {
  describe('timeAgo', () => {
    it('should return "Just now" for very recent dates', () => {
      const now = new Date().toISOString();
      expect(timeAgo(now)).toBe('Just now');
    });

    it('should return minutes ago', () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      expect(timeAgo(tenMinsAgo)).toBe('10m ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(timeAgo(twoHoursAgo)).toBe('2h ago');
    });

    it('should return days ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      expect(timeAgo(twoDaysAgo)).toBe('2d ago');
    });

    it('should return locale date for old dates', () => {
      const oldDate = '2023-01-01T10:00:00Z';
      expect(timeAgo(oldDate)).toContain('Jan');
    });
  });

  describe('timeAgoPt', () => {
    it('should return "Agora" for very recent dates', () => {
      const now = new Date().toISOString();
      expect(timeAgoPt(now)).toBe('Agora');
    });

    it('should return "min atrás"', () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      expect(timeAgoPt(tenMinsAgo)).toBe('10min atrás');
    });

    it('should return "h atrás"', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(timeAgoPt(twoHoursAgo)).toBe('2h atrás');
    });

    it('should return "d atrás"', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      expect(timeAgoPt(twoDaysAgo)).toBe('2d atrás');
    });

    it('should return locale date for old dates (PT)', () => {
      const oldDate = '2023-01-01T10:00:00Z';
      expect(timeAgoPt(oldDate)).toContain('jan');
    });
  });

  describe('HTML utilities', () => {
    it('should strip HTML tags', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should handle null/empty in stripHtml', () => {
      expect(stripHtml('')).toBe('');
      expect(stripHtml(null)).toBe('');
    });

    it('should escape HTML', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should handle null/empty in escapeHtml', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
    });

    it('should decode HTML entities', () => {
      expect(decodeHtmlEntities('Hello &amp; World')).toBe('Hello & World');
    });

    it('should handle null/empty in decodeHtmlEntities', () => {
      expect(decodeHtmlEntities('')).toBe('');
      expect(decodeHtmlEntities(null)).toBe('');
    });
  });

  describe('uid', () => {
    it('should generate a unique id', () => {
      const id1 = uid();
      const id2 = uid();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(5);
    });
  });

  describe('isWithinHours', () => {
    it('should return true for dates within limit', () => {
      const recent = new Date(Date.now() - 12 * 3600000).toISOString();
      expect(isWithinHours(recent, 24)).toBe(true);
    });

    it('should return false for dates outside limit', () => {
      const old = new Date(Date.now() - 48 * 3600000).toISOString();
      expect(isWithinHours(old, 24)).toBe(false);
    });
  });
});
