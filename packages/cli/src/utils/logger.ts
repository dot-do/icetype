/**
 * Structured Logging Utility for @icetype/cli
 *
 * Provides a configurable logger with:
 * - Log levels (DEBUG, INFO, WARN, ERROR, SILENT)
 * - Quiet mode for CI environments
 * - Optional color output
 * - Timestamps in debug mode
 * - Structured context objects
 */

/**
 * Log levels in order of verbosity.
 * Lower numbers are more verbose.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Options for creating a logger instance.
 */
export interface LoggerOptions {
  /** Minimum log level to display. Defaults to INFO. */
  level?: LogLevel;
  /** Suppress all non-error output. Useful for CI. */
  quiet?: boolean;
  /** Disable color output. */
  noColor?: boolean;
}

/**
 * Logger interface with methods for each log level.
 */
export interface Logger {
  /** Log debug messages (only shown at DEBUG level). */
  debug(message: string, context?: Record<string, unknown>): void;
  /** Log informational messages. */
  info(message: string, context?: Record<string, unknown>): void;
  /** Log success messages with a checkmark. */
  success(message: string, context?: Record<string, unknown>): void;
  /** Log warning messages. */
  warn(message: string, context?: Record<string, unknown>): void;
  /** Log error messages. */
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * ANSI color codes for terminal output.
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Symbols for log messages.
 */
const symbols = {
  checkmark: '\u2713',
  cross: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
  debug: '\u2022',
};

/**
 * Format a timestamp for debug output.
 */
function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const millis = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

/**
 * Format context object for log output.
 */
function formatContext(context: Record<string, unknown> | undefined, noColor: boolean): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  const pairs = Object.entries(context)
    .map(([key, value]) => {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (noColor) {
        return `${key}=${valueStr}`;
      }
      return `${colors.cyan}${key}${colors.reset}=${valueStr}`;
    })
    .join(' ');

  return ` ${pairs}`;
}

/**
 * Create a logger instance with the given options.
 *
 * @param options - Configuration options for the logger
 * @returns A Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: LogLevel.DEBUG });
 * logger.info('Starting process', { pid: process.pid });
 * logger.success('Process complete');
 * logger.error('Failed', { code: 'E001' });
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const { level = LogLevel.INFO, quiet = false, noColor = false } = options;

  /**
   * Check if a message at the given level should be logged.
   */
  function shouldLog(messageLevel: LogLevel): boolean {
    if (level === LogLevel.SILENT) {
      return false;
    }
    return messageLevel >= level;
  }

  /**
   * Format a message with optional prefix and color.
   */
  function formatMessage(
    prefix: string,
    message: string,
    color: string,
    context: Record<string, unknown> | undefined,
    includeTimestamp: boolean
  ): string {
    const timestamp = includeTimestamp ? `${formatTimestamp()} ` : '';
    const contextStr = formatContext(context, noColor);

    if (noColor) {
      return `${timestamp}${prefix} ${message}${contextStr}`;
    }

    return `${colors.dim}${timestamp}${colors.reset}${color}${prefix}${colors.reset} ${message}${contextStr}`;
  }

  return {
    debug(message: string, context?: Record<string, unknown>): void {
      if (!shouldLog(LogLevel.DEBUG)) return;

      const formatted = formatMessage(
        symbols.debug,
        message,
        colors.dim,
        context,
        true // Always include timestamp for debug
      );
      console.log(formatted);
    },

    info(message: string, context?: Record<string, unknown>): void {
      if (quiet) return;
      if (!shouldLog(LogLevel.INFO)) return;

      const formatted = formatMessage(symbols.info, message, colors.blue, context, false);
      console.log(formatted);
    },

    success(message: string, context?: Record<string, unknown>): void {
      if (quiet) return;
      if (!shouldLog(LogLevel.INFO)) return;

      const formatted = formatMessage(symbols.checkmark, message, colors.green, context, false);
      console.log(formatted);
    },

    warn(message: string, context?: Record<string, unknown>): void {
      if (quiet) return;
      if (!shouldLog(LogLevel.WARN)) return;

      const formatted = formatMessage(symbols.warning, message, colors.yellow, context, false);
      console.warn(formatted);
    },

    error(message: string, context?: Record<string, unknown>): void {
      if (!shouldLog(LogLevel.ERROR)) return;

      const formatted = formatMessage(symbols.cross, message, colors.red, context, false);
      console.error(formatted);
    },
  };
}
