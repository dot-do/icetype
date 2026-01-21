/**
 * File Watcher Utility for @icetype/cli
 *
 * Provides file watching capabilities for the generate command's watch mode.
 * Supports debouncing rapid changes to avoid redundant regenerations.
 *
 * ## Resource Management
 *
 * The watcher manages internal resources (timeouts) that must be cleaned up
 * when watching is no longer needed. The `close()` method handles all cleanup:
 *
 * - Clears any pending debounce timeouts
 * - Prevents callbacks from firing after close
 * - Closes the underlying FSWatcher
 *
 * @example
 * ```typescript
 * const watcher = createWatcher('./schema.ts', {
 *   onGenerate: async () => await runGeneration(),
 * });
 *
 * // Later, clean up all resources:
 * watcher.close();
 * ```
 */

import { watch, type FSWatcher } from 'node:fs';
import { createLogger, LogLevel } from './logger.js';

/**
 * Options for creating a file watcher.
 */
export interface WatcherOptions {
  /** Debounce time in milliseconds. Defaults to 100. */
  debounceMs?: number;
  /** Suppress non-error output. */
  quiet?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
  /** Callback invoked when regeneration should occur. */
  onGenerate: () => Promise<void>;
  /** Optional error handler. If not provided, errors are logged. */
  onError?: (error: Error) => void;
}

/**
 * A cleanup-aware file watcher that manages both the underlying FSWatcher
 * and any internal resources like debounce timeouts.
 *
 * The `close()` method performs complete cleanup:
 * 1. Clears any pending debounce timeouts to prevent callbacks after close
 * 2. Sets an internal flag to prevent any in-flight callbacks from executing
 * 3. Closes the underlying FSWatcher
 *
 * @example
 * ```typescript
 * const watcher = createWatcher('./schema.ts', { onGenerate });
 *
 * // Access underlying FSWatcher if needed
 * watcher.ref();  // Keep process alive
 * watcher.unref(); // Allow process to exit
 *
 * // Clean shutdown - clears timeouts and closes watcher
 * watcher.close();
 * ```
 */
export interface CleanupAwareWatcher extends FSWatcher {
  /**
   * Whether the watcher has been closed.
   * After close() is called, no more callbacks will fire.
   */
  readonly isClosed: boolean;
}

/**
 * Options for the watchGenerate function.
 */
export interface WatchGenerateOptions {
  /** Path to the schema file to watch. */
  schemaPath: string;
  /** Function to run the generation. */
  runGeneration: () => Promise<void>;
  /** Debounce time in milliseconds. Defaults to 100. */
  debounceMs?: number;
  /** Suppress non-error output. */
  quiet?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
}

/**
 * Create a file watcher that triggers regeneration on file changes.
 *
 * This function returns a `CleanupAwareWatcher` that extends `FSWatcher` with
 * proper resource cleanup. The `close()` method is enhanced to:
 *
 * 1. Clear any pending debounce timeouts
 * 2. Prevent callbacks from firing after close
 * 3. Close the underlying FSWatcher
 *
 * This prevents resource leaks and ensures clean shutdown in watch mode.
 *
 * @param filePath - Path to the file to watch
 * @param options - Watcher configuration options
 * @returns A CleanupAwareWatcher instance with enhanced close() behavior
 *
 * @example
 * ```typescript
 * const watcher = createWatcher('./schema.ts', {
 *   onGenerate: async () => {
 *     await runGeneration(options);
 *   },
 *   debounceMs: 100,
 * });
 *
 * // On shutdown, close() clears timeouts and closes the watcher
 * process.on('SIGINT', () => {
 *   watcher.close(); // Safe cleanup - no callbacks will fire after this
 *   process.exit(0);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Check if watcher has been closed
 * const watcher = createWatcher(path, options);
 * console.log(watcher.isClosed); // false
 * watcher.close();
 * console.log(watcher.isClosed); // true
 * ```
 */
export function createWatcher(
  filePath: string,
  options: WatcherOptions
): CleanupAwareWatcher {
  const { debounceMs = 100, onGenerate, onError, quiet = false, verbose = false } = options;

  const logger = createLogger({
    quiet,
    level: verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const watcher = watch(filePath, (eventType) => {
    // Only trigger on 'change' events, not 'rename' or other events
    if (eventType === 'change') {
      // Clear any pending timeout to debounce rapid changes
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(async () => {
        // Don't execute callback if watcher has been closed
        if (closed) {
          return;
        }
        logger.info('File changed, regenerating...');
        try {
          await onGenerate();
          logger.success('Regenerated successfully');
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (onError) {
            onError(err);
          } else {
            logger.error('Generation failed', { error: err.message });
          }
        }
      }, debounceMs);
    }
  }) as CleanupAwareWatcher;

  // Store original close for cleanup
  const originalClose = watcher.close.bind(watcher);

  /**
   * Enhanced close() that performs complete resource cleanup:
   * - Clears pending debounce timeouts
   * - Prevents callbacks from firing
   * - Closes the underlying FSWatcher
   */
  watcher.close = () => {
    closed = true;
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    return originalClose();
  };

  // Add isClosed getter for inspection
  Object.defineProperty(watcher, 'isClosed', {
    get: () => closed,
    enumerable: true,
    configurable: false,
  });

  return watcher;
}

/**
 * Run the generate command in watch mode.
 *
 * This function performs an initial generation and then watches the schema file
 * for changes, regenerating on each change.
 *
 * @param options - Watch generation options
 * @returns Promise that resolves when watching starts (never resolves in practice)
 *
 * @example
 * ```typescript
 * await watchGenerate({
 *   schemaPath: './schema.ts',
 *   runGeneration: async () => {
 *     await generate({ schema: './schema.ts', output: './types.ts' });
 *   },
 * });
 * ```
 */
export async function watchGenerate(
  options: WatchGenerateOptions
): Promise<void> {
  const {
    schemaPath,
    runGeneration,
    debounceMs = 100,
    quiet = false,
    verbose = false,
  } = options;

  const logger = createLogger({
    quiet,
    level: verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Run initial generation
  logger.info('Running initial generation...');
  try {
    await runGeneration();
    logger.success('Initial generation complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Initial generation failed', { error: message });
    // Continue watching despite initial failure
  }

  // Start watching
  logger.info('Watching for changes...', { file: schemaPath });

  const watcher = createWatcher(schemaPath, {
    debounceMs,
    quiet,
    verbose,
    onGenerate: runGeneration,
    onError: (error) => {
      logger.error('Generation failed', { error: error.message });
    },
  });

  // Setup graceful shutdown handlers
  const shutdown = () => {
    logger.info('Shutting down...');
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive
  // This promise never resolves - the watcher runs until the process is killed
  await new Promise(() => {});
}
