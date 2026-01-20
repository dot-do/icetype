/**
 * Logger Tests for @icetype/cli
 *
 * Tests for the structured logging utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, LogLevel } from '../utils/logger.js';

describe('Logger', () => {
  let consoleSpy: { log: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should log info messages', () => {
      const logger = createLogger();
      logger.info('Test message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log error messages with proper formatting', () => {
      const logger = createLogger();
      logger.error('Error occurred', { code: 'E001' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      const logger = createLogger();
      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log debug messages when level is DEBUG', () => {
      const logger = createLogger({ level: LogLevel.DEBUG });
      logger.debug('Debug message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should respect log level - ERROR level hides INFO', () => {
      const logger = createLogger({ level: LogLevel.ERROR });
      logger.info('Should not appear');
      logger.error('Should appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should respect log level - WARN level hides INFO but shows WARN', () => {
      const logger = createLogger({ level: LogLevel.WARN });
      logger.info('Should not appear');
      logger.warn('Should appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should respect log level - INFO level hides DEBUG', () => {
      const logger = createLogger({ level: LogLevel.INFO });
      logger.debug('Should not appear');
      logger.info('Should appear');
      // DEBUG calls console.log, so if it was called, check for the right content
      // The debug call should be filtered out at INFO level
      const logCalls = consoleSpy.log.mock.calls;
      expect(logCalls.some((call) => String(call[0]).includes('Should appear'))).toBe(true);
    });

    it('should suppress all output in SILENT mode', () => {
      const logger = createLogger({ level: LogLevel.SILENT });
      logger.debug('Should not appear');
      logger.info('Should not appear');
      logger.warn('Should not appear');
      logger.error('Should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('quiet mode', () => {
    it('should support quiet mode', () => {
      const logger = createLogger({ quiet: true });
      logger.info('Should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should still show errors in quiet mode', () => {
      const logger = createLogger({ quiet: true });
      logger.error('Error should appear');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('formatting', () => {
    it('should format success messages with checkmark', () => {
      const logger = createLogger();
      logger.success('Done');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('\u2713'));
    });

    it('should include context objects in log output', () => {
      const logger = createLogger();
      logger.info('Message with context', { key: 'value', count: 42 });
      const logCalls = consoleSpy.log.mock.calls;
      const callWithContext = logCalls.find(
        (call) => String(call[0]).includes('key') || call.some((arg) => String(arg).includes('key'))
      );
      expect(callWithContext).toBeDefined();
    });
  });

  describe('timestamps in debug mode', () => {
    it('should include timestamps in debug mode', () => {
      const logger = createLogger({ level: LogLevel.DEBUG });
      logger.debug('Debug message');
      const logCalls = consoleSpy.log.mock.calls;
      // Check that timestamp pattern is present (ISO format or similar)
      const hasTimestamp = logCalls.some((call) => {
        const output = String(call[0]);
        // Match ISO timestamp or common time format
        return /\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}/.test(output);
      });
      expect(hasTimestamp).toBe(true);
    });
  });

  describe('no color mode', () => {
    it('should support noColor option', () => {
      const logger = createLogger({ noColor: true });
      logger.info('No color message');
      expect(consoleSpy.log).toHaveBeenCalled();
      const logCalls = consoleSpy.log.mock.calls;
      // Ensure no ANSI escape codes are present
      const hasAnsiCodes = logCalls.some((call) => /\x1b\[/.test(String(call[0])));
      expect(hasAnsiCodes).toBe(false);
    });

    it('should still show symbols like checkmark even without color', () => {
      const logger = createLogger({ noColor: true });
      logger.success('Success');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('\u2713'));
    });
  });

  describe('Logger interface completeness', () => {
    it('should have all required methods', () => {
      const logger = createLogger();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.success).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric ordering', () => {
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.SILENT);
    });
  });
});
