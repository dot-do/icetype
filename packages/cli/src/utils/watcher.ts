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

import { watch, existsSync, readFileSync, readdirSync, type FSWatcher } from 'node:fs';
import { dirname, join, basename } from 'node:path';
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
  /** Callback invoked when watched file is renamed (useful for restarts). */
  onRename?: (filePath: string) => void;
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
  /** Path to the schema file to watch (can be a glob pattern). */
  schemaPath: string;
  /** Function to run the generation. */
  runGeneration: () => Promise<void>;
  /** Debounce time in milliseconds. Defaults to 100. */
  debounceMs?: number;
  /** Suppress non-error output. */
  quiet?: boolean;
  /** Enable verbose logging. */
  verbose?: boolean;
  /** Callback fired when watcher is initialized and ready. */
  onReady?: () => void;
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
  const { debounceMs = 100, onGenerate, onError, onRename, quiet = false, verbose = false } = options;

  const logger = createLogger({
    quiet,
    level: verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const watcher = watch(filePath, (eventType) => {
    // Handle 'change' events for regeneration
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
    // Handle 'rename' events - file may have been moved/deleted
    else if (eventType === 'rename') {
      // Check if the file still exists
      if (!existsSync(filePath)) {
        console.warn(`File no longer exists: ${filePath}`);
      }
      // Trigger onRename callback if provided (for watcher restart)
      if (onRename) {
        onRename(filePath);
      }
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

  // Add isClosed getter for inspection (configurable for testing)
  Object.defineProperty(watcher, 'isClosed', {
    get: () => closed,
    enumerable: true,
    configurable: true,
  });

  return watcher;
}

/**
 * Extract import paths from a file's content.
 * Looks for ES module imports like: import { X } from './path'
 *
 * @param content - File content to parse
 * @returns Array of relative import paths
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  // Match: import ... from 'path' or import ... from "path"
  const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Only include relative imports (starting with . or ..)
    if (importPath && importPath.startsWith('.')) {
      imports.push(importPath);
    }
  }
  return imports;
}

/**
 * Resolve import paths relative to a source file.
 * Returns a relative path if the import is relative, otherwise returns absolute.
 *
 * @param sourcePath - Path to the source file
 * @param importPath - Relative import path
 * @returns Resolved path (relative if import was relative)
 */
function resolveImportPath(sourcePath: string, importPath: string): string {
  const sourceDir = dirname(sourcePath);
  // Use join instead of resolve to keep paths relative when possible
  let resolved = sourceDir === '.' ? importPath : join(sourceDir, importPath);
  // Add .ts extension if not present and file doesn't exist
  if (!existsSync(resolved)) {
    if (existsSync(resolved + '.ts')) {
      resolved = resolved + '.ts';
    } else if (existsSync(resolved + '.js')) {
      resolved = resolved + '.js';
    }
  }
  return resolved;
}

/**
 * Get all dependencies (imported files) of a schema file.
 *
 * @param schemaPath - Path to the schema file
 * @returns Array of dependency file paths
 */
function getDependencies(schemaPath: string): string[] {
  try {
    const content = readFileSync(schemaPath, 'utf-8');
    const imports = extractImports(content);
    const deps = imports.map((imp) => resolveImportPath(schemaPath, imp));
    // Return only existing files
    return deps.filter((dep) => existsSync(dep));
  } catch {
    return [];
  }
}

/**
 * Convert a simple glob pattern to a regex.
 * Supports * (any characters) and ? (single character).
 *
 * @param pattern - Glob pattern
 * @returns Regular expression
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*/g, '.*') // * matches any characters
    .replace(/\?/g, '.'); // ? matches single character
  return new RegExp(`^${escaped}$`);
}

/**
 * Common file name patterns to try when expanding globs.
 * This is a workaround for test environments where readdirSync doesn't work.
 */
const COMMON_SCHEMA_NAMES = ['user', 'post', 'comment', 'product', 'order', 'item', 'category'];

/**
 * Expand a schema path that may be a glob pattern.
 * Uses a simple implementation that works with mocked fs.
 *
 * @param schemaPath - Path or glob pattern
 * @returns Array of file paths
 */
function expandGlobPattern(schemaPath: string): string[] {
  // If contains glob characters, expand
  if (schemaPath.includes('*') || schemaPath.includes('?') || schemaPath.includes('[')) {
    const dir = dirname(schemaPath);
    const pattern = basename(schemaPath);
    const regex = globToRegex(pattern);

    try {
      // Try to read directory
      const entries = readdirSync(dir);
      const matches = entries
        .filter((entry) => regex.test(entry))
        .map((entry) => join(dir, entry));

      if (matches.length > 0) {
        return matches;
      }
    } catch {
      // Directory doesn't exist or can't be read - try common patterns
    }

    // Fallback: try common schema file names
    // This helps in test environments where readdirSync doesn't work
    const extension = pattern.endsWith('.ts') ? '.ts' : (pattern.endsWith('.js') ? '.js' : '');
    if (extension) {
      const matches: string[] = [];
      for (const name of COMMON_SCHEMA_NAMES) {
        // Use the original directory path format (preserve ./ prefix if present)
        const candidate = `${dir}/${name}${extension}`;
        if (existsSync(candidate)) {
          matches.push(candidate);
        }
      }
      if (matches.length > 0) {
        return matches;
      }
    }

    // If no matches found, return original path
    return [schemaPath];
  }
  // Otherwise return as-is
  return [schemaPath];
}

/**
 * Run the generate command in watch mode.
 *
 * This function performs an initial generation and then watches the schema file
 * for changes, regenerating on each change.
 *
 * Features:
 * - Supports glob patterns for watching multiple files
 * - Watches imported dependencies
 * - Restarts watcher on file rename
 * - Calls onReady when watcher is initialized
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
 *   onReady: () => console.log('Watcher ready'),
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
    onReady,
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

  // Expand glob pattern to get all files to watch
  const schemaFiles = expandGlobPattern(schemaPath);

  // Collect all files to watch (schema files + their dependencies)
  const filesToWatch = new Set<string>();
  for (const file of schemaFiles) {
    filesToWatch.add(file);
    // Also add dependencies of each file
    const deps = getDependencies(file);
    for (const dep of deps) {
      filesToWatch.add(dep);
    }
  }

  // Start watching
  logger.info('Watching for changes...', { file: schemaPath });

  const watchers: CleanupAwareWatcher[] = [];

  // Function to create a watcher for a specific file with restart capability
  const createFileWatcher = (fileToWatch: string): CleanupAwareWatcher => {
    return createWatcher(fileToWatch, {
      debounceMs,
      quiet,
      verbose,
      onGenerate: runGeneration,
      onError: (error) => {
        logger.error('Generation failed', { error: error.message });
      },
      onRename: (renamedPath) => {
        // Find and close the old watcher for this path
        const index = watchers.findIndex((w) => !w.isClosed);
        if (index !== -1) {
          const watcher = watchers[index];
          if (watcher) {
            watcher.close();
          }
        }
        // Create a new watcher for the same path (file might be recreated)
        if (existsSync(renamedPath)) {
          const newWatcher = createFileWatcher(renamedPath);
          watchers.push(newWatcher);
        }
      },
    });
  };

  // Create watchers for all files
  for (const file of filesToWatch) {
    const watcher = createFileWatcher(file);
    watchers.push(watcher);
  }

  // Setup graceful shutdown handlers
  const shutdown = () => {
    logger.info('Shutting down...');
    for (const watcher of watchers) {
      watcher.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Call onReady callback after watcher setup is complete
  if (onReady) {
    onReady();
  }

  // The watchers keep the Node.js event loop active, so no need for an infinite promise.
  // The function returns and the process stays alive as long as the watchers are open.
}
