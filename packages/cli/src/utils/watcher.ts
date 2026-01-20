/**
 * File Watcher Utility for @icetype/cli
 *
 * Provides file watching capabilities for the generate command's watch mode.
 * Supports debouncing rapid changes to avoid redundant regenerations.
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
 * @param filePath - Path to the file to watch
 * @param options - Watcher configuration options
 * @returns The FSWatcher instance
 *
 * @example
 * ```typescript
 * const watcher = createWatcher('./schema.ts', {
 *   onGenerate: async () => {
 *     await runGeneration(options);
 *   },
 *   debounceMs: 100,
 * });
 * ```
 */
export function createWatcher(
  filePath: string,
  options: WatcherOptions
): FSWatcher {
  const { debounceMs = 100, onGenerate, onError, quiet = false, verbose = false } = options;

  const logger = createLogger({
    quiet,
    level: verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(filePath, (eventType) => {
    // Only trigger on 'change' events, not 'rename' or other events
    if (eventType === 'change') {
      // Clear any pending timeout to debounce rapid changes
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(async () => {
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

  createWatcher(schemaPath, {
    debounceMs,
    quiet,
    verbose,
    onGenerate: runGeneration,
    onError: (error) => {
      logger.error('Generation failed', { error: error.message });
    },
  });

  // Keep the process alive
  // This promise never resolves - the watcher runs until the process is killed
  await new Promise(() => {});
}
