import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initSentry,
  captureError,
  setUser,
  addBreadcrumb,
  Sentry,
} from '../sentry';

// Mock Sentry module
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  withScope: vi.fn((callback) => {
    const scope = {
      setExtras: vi.fn(),
    };
    callback(scope);
  }),
  captureException: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('sentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('initSentry', () => {
    it('should not throw when called', () => {
      expect(() => initSentry()).not.toThrow();
    });

    it('should be callable multiple times without errors', () => {
      expect(() => {
        initSentry();
        initSentry();
        initSentry();
      }).not.toThrow();
    });
  });

  describe('captureError', () => {
    it('should not throw when capturing error with context', () => {
      const testError = new Error('Test error');
      const context = { userId: '123', action: 'trade' };

      expect(() => captureError(testError, context)).not.toThrow();
    });

    it('should not throw when capturing error without context', () => {
      const testError = new Error('Test error');

      expect(() => captureError(testError)).not.toThrow();
    });

    it('should handle TypeError', () => {
      const typeError = new TypeError('Type mismatch');

      expect(() => captureError(typeError)).not.toThrow();
    });

    it('should handle RangeError', () => {
      const rangeError = new RangeError('Out of range');

      expect(() => captureError(rangeError)).not.toThrow();
    });

    it('should handle errors with complex context objects', () => {
      const error = new Error('Complex error');
      const context = {
        tokenAddress: 'CTOKEN123...',
        bondingCurve: 'active',
        amount: '1000000',
        nested: {
          data: {
            deep: 'value',
          },
        },
      };

      expect(() => captureError(error, context)).not.toThrow();
    });

    it('should handle undefined context gracefully', () => {
      const error = new Error('Test');

      expect(() => captureError(error, undefined)).not.toThrow();
    });

    it('should handle empty context object', () => {
      const error = new Error('Test');

      expect(() => captureError(error, {})).not.toThrow();
    });
  });

  describe('setUser', () => {
    it('should not throw when setting user with address', () => {
      const address = 'GTEST123ABC';

      expect(() => setUser(address)).not.toThrow();
    });

    it('should not throw when clearing user', () => {
      expect(() => setUser(null)).not.toThrow();
    });

    it('should be callable multiple times', () => {
      expect(() => {
        setUser('GTEST1');
        setUser('GTEST2');
        setUser(null);
        setUser('GTEST3');
      }).not.toThrow();
    });

    it('should handle long Stellar addresses', () => {
      const longAddress = 'G' + 'A'.repeat(55); // 56 chars total

      expect(() => setUser(longAddress)).not.toThrow();
    });
  });

  describe('addBreadcrumb', () => {
    it('should not throw when adding breadcrumb with message and category', () => {
      expect(() => addBreadcrumb('User created token', 'create')).not.toThrow();
    });

    it('should not throw when adding breadcrumb with additional data', () => {
      const data = { tokenName: 'TestToken', symbol: 'TST', supply: '1000000' };

      expect(() => addBreadcrumb('Token created', 'create', data)).not.toThrow();
    });

    it('should handle empty message', () => {
      expect(() => addBreadcrumb('', 'category')).not.toThrow();
    });

    it('should handle long messages', () => {
      const longMessage = 'A'.repeat(1000);

      expect(() => addBreadcrumb(longMessage, 'test')).not.toThrow();
    });

    it('should handle undefined data', () => {
      expect(() => addBreadcrumb('Message', 'category', undefined)).not.toThrow();
    });

    it('should handle empty data object', () => {
      expect(() => addBreadcrumb('Message', 'category', {})).not.toThrow();
    });

    it('should handle complex nested data', () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      expect(() => addBreadcrumb('Test', 'test', complexData)).not.toThrow();
    });

    it('should be callable multiple times consecutively', () => {
      expect(() => {
        addBreadcrumb('Message 1', 'cat1');
        addBreadcrumb('Message 2', 'cat2');
        addBreadcrumb('Message 3', 'cat3');
      }).not.toThrow();
    });
  });

  describe('Sentry export', () => {
    it('should export Sentry module', () => {
      expect(Sentry).toBeDefined();
    });

    it('should export Sentry.init function', () => {
      expect(Sentry.init).toBeDefined();
      expect(typeof Sentry.init).toBe('function');
    });

    it('should export Sentry.captureException function', () => {
      expect(Sentry.captureException).toBeDefined();
      expect(typeof Sentry.captureException).toBe('function');
    });

    it('should export Sentry.setUser function', () => {
      expect(Sentry.setUser).toBeDefined();
      expect(typeof Sentry.setUser).toBe('function');
    });

    it('should export Sentry.addBreadcrumb function', () => {
      expect(Sentry.addBreadcrumb).toBeDefined();
      expect(typeof Sentry.addBreadcrumb).toBe('function');
    });

    it('should export Sentry.withScope function', () => {
      expect(Sentry.withScope).toBeDefined();
      expect(typeof Sentry.withScope).toBe('function');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle null error object', () => {
      expect(() => captureError(null as any)).not.toThrow();
    });

    it('should handle error with no message', () => {
      const error = new Error();

      expect(() => captureError(error)).not.toThrow();
    });

    it('should handle non-Error objects', () => {
      const notAnError = { message: 'I am not an Error' };

      expect(() => captureError(notAnError as any)).not.toThrow();
    });
  });

  describe('function return values', () => {
    it('initSentry should return undefined', () => {
      const result = initSentry();

      expect(result).toBeUndefined();
    });

    it('captureError should return undefined', () => {
      const result = captureError(new Error('test'));

      expect(result).toBeUndefined();
    });

    it('setUser should return undefined', () => {
      const result = setUser('GTEST');

      expect(result).toBeUndefined();
    });

    it('addBreadcrumb should return undefined', () => {
      const result = addBreadcrumb('test', 'category');

      expect(result).toBeUndefined();
    });
  });
});
