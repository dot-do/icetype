/**
 * Path Sanitization Utilities for @icetype/cli
 *
 * Security utilities to prevent path traversal attacks, symlink attacks,
 * and other file path injection vulnerabilities.
 *
 * @module path-sanitizer
 */

import { resolve, normalize, isAbsolute, extname, dirname } from 'node:path';
import { lstatSync, realpathSync, existsSync } from 'node:fs';

// =============================================================================
// Test Mode Support
// =============================================================================

/**
 * Check if strict path validation should be skipped (for testing).
 * This allows tests to use mock paths without failing security checks.
 *
 * Set ICETYPE_SKIP_PATH_SECURITY=1 in test environments.
 */
function shouldSkipStrictValidation(): boolean {
  return process.env.ICETYPE_SKIP_PATH_SECURITY === '1';
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum allowed path length (typical filesystem limit)
 */
const MAX_PATH_LENGTH = 4096;

/**
 * Allowed schema file extensions
 */
const VALID_SCHEMA_EXTENSIONS = ['.ts', '.js', '.mjs', '.json'];

/**
 * Allowed output file extensions for generated TypeScript
 */
const VALID_OUTPUT_EXTENSIONS = ['.ts', '.d.ts', '.js'];

/**
 * Allowed migration output extensions
 */
const VALID_MIGRATION_EXTENSIONS = ['.sql', '.json', '.ts', '.js'];

/**
 * Dangerous file extensions that should never be processed
 */
const DANGEROUS_EXTENSIONS = [
  '.sh', '.bash', '.zsh', '.fish', '.csh',
  '.exe', '.bat', '.cmd', '.com', '.msi',
  '.app', '.dmg', '.pkg',
  '.dll', '.so', '.dylib',
  '.bin', '.run',
  '.php', '.py', '.rb', '.pl', '.cgi',
];

/**
 * Characters that are dangerous in shell contexts.
 * Note: We allow * and ? for glob patterns which are common in schema paths.
 */
const DANGEROUS_SHELL_CHARS = /[;|&$`()<>!{}[\]#~\x00]/;

/**
 * Pattern for URL-encoded path traversal
 */
const URL_ENCODED_TRAVERSAL = /%2e%2e/gi;

/**
 * Pattern for Unicode full-width characters that could be used for traversal
 */
const UNICODE_DOT_PATTERN = /[\uFF0E\u2024\u2025\uFE52]/g;

/**
 * Windows UNC path pattern
 */
const UNC_PATH_PATTERN = /^\\\\|^\/\//;

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when path validation fails
 */
export class PathSecurityError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

// =============================================================================
// Core Sanitization Functions
// =============================================================================

/**
 * Sanitizes a path by removing dangerous characters and normalizing the path.
 *
 * @param inputPath - The path to sanitize
 * @returns The sanitized path
 * @throws PathSecurityError if the path contains dangerous elements
 */
export function sanitizePath(inputPath: string): string {
  // Check for empty path
  if (!inputPath || inputPath.trim() === '') {
    throw new PathSecurityError('Path cannot be empty', 'EMPTY_PATH');
  }

  // Check path length
  if (inputPath.length > MAX_PATH_LENGTH) {
    throw new PathSecurityError(
      `Path too long (${inputPath.length} characters, max ${MAX_PATH_LENGTH})`,
      'PATH_TOO_LONG'
    );
  }

  // Check for null bytes (injection attack)
  if (inputPath.includes('\x00')) {
    throw new PathSecurityError(
      'Path contains null byte - possible injection attack',
      'NULL_BYTE'
    );
  }

  // Check for dangerous shell characters
  if (DANGEROUS_SHELL_CHARS.test(inputPath)) {
    throw new PathSecurityError(
      'Path contains invalid shell characters - possible command injection',
      'SHELL_CHARS'
    );
  }

  // Check for command substitution patterns
  if (inputPath.includes('$(') || inputPath.includes('`')) {
    throw new PathSecurityError(
      'Path contains command substitution - possible command injection',
      'COMMAND_SUBSTITUTION'
    );
  }

  // Check for Windows UNC paths
  if (UNC_PATH_PATTERN.test(inputPath)) {
    throw new PathSecurityError(
      'UNC/network paths are not allowed for security reasons',
      'UNC_PATH'
    );
  }

  // Decode URL-encoded traversal attempts and reject them
  let decodedPath = inputPath;
  try {
    decodedPath = decodeURIComponent(inputPath);
  } catch {
    // If decoding fails, continue with original path
  }

  // Check for URL-encoded traversal
  if (URL_ENCODED_TRAVERSAL.test(inputPath)) {
    throw new PathSecurityError(
      'Path traversal detected - URL-encoded traversal sequence found',
      'ENCODED_TRAVERSAL'
    );
  }

  // Normalize Unicode characters that could be used for traversal
  let normalizedPath = inputPath.replace(UNICODE_DOT_PATTERN, '.');

  // Normalize backslashes to forward slashes for cross-platform consistency
  normalizedPath = normalizedPath.replace(/\\/g, '/');

  // Check for path traversal sequences before normalization
  if (normalizedPath.includes('../') || normalizedPath.includes('/..') || normalizedPath === '..') {
    throw new PathSecurityError(
      'Path traversal detected - paths cannot contain ".." sequences',
      'PATH_TRAVERSAL'
    );
  }

  // Check for paths that are only dots
  if (/^\.{3,}$/.test(normalizedPath)) {
    throw new PathSecurityError(
      'Invalid path - paths cannot consist only of dots',
      'INVALID_PATH'
    );
  }

  return normalizedPath;
}

/**
 * Checks if a given path is within the project directory.
 *
 * @param filePath - The path to check
 * @param projectRoot - The project root directory (defaults to cwd)
 * @returns true if the path is within the project directory
 */
export function isWithinProjectDirectory(filePath: string, projectRoot?: string): boolean {
  const root = projectRoot ?? process.cwd();
  const absoluteRoot = resolve(root);
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);
  const normalizedPath = normalize(absolutePath);

  // Path must start with the project root
  return normalizedPath.startsWith(absoluteRoot + '/') || normalizedPath === absoluteRoot;
}

/**
 * Checks if a symlink resolves to a path within the project directory.
 *
 * @param filePath - The path to check
 * @param projectRoot - The project root directory (defaults to cwd)
 * @returns true if the symlink is safe (resolves within project)
 * @throws PathSecurityError if the symlink points outside the project
 */
export function checkSymlinkSafety(filePath: string, projectRoot?: string): boolean {
  const root = projectRoot ?? process.cwd();
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);

  // Check if file exists and is a symlink
  try {
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) {
      // Get the real path the symlink points to
      const realPath = realpathSync(absolutePath);

      // Check if the real path is within project
      if (!isWithinProjectDirectory(realPath, root)) {
        throw new PathSecurityError(
          `Symlink '${filePath}' resolves to '${realPath}' which is outside the project directory`,
          'SYMLINK_ESCAPE'
        );
      }
    }
    return true;
  } catch (error) {
    if (error instanceof PathSecurityError) {
      throw error;
    }
    // File doesn't exist or can't be accessed - that's okay for paths that will be created
    return true;
  }
}

/**
 * Validates a file extension against a list of allowed extensions.
 *
 * @param filePath - The path to check
 * @param validExtensions - List of valid extensions (with leading dot)
 * @returns true if the extension is valid
 */
function hasValidExtension(filePath: string, validExtensions: string[]): boolean {
  const ext = extname(filePath).toLowerCase();

  // Check for double extensions (e.g., .ts.exe)
  const fileName = filePath.split('/').pop() ?? '';
  const parts = fileName.split('.');
  if (parts.length > 2) {
    // Check if any intermediate extension is dangerous
    for (let i = 1; i < parts.length - 1; i++) {
      const intermediateExt = '.' + parts[i].toLowerCase();
      if (DANGEROUS_EXTENSIONS.includes(intermediateExt)) {
        return false;
      }
    }
  }

  // Check if the final extension is in the dangerous list
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }

  return validExtensions.includes(ext);
}

/**
 * Validates a schema file path.
 *
 * @param schemaPath - The path to the schema file
 * @param projectRoot - The project root directory (defaults to cwd)
 * @throws PathSecurityError if the path is invalid
 */
export function validateSchemaPath(schemaPath: string, projectRoot?: string): void {
  // Skip strict validation in test mode (project boundary and symlink checks)
  const skipStrict = shouldSkipStrictValidation();
  const root = projectRoot ?? process.cwd();

  // First, sanitize the path (always done, catches dangerous chars)
  sanitizePath(schemaPath);

  // Check if path is within project directory (skip in test mode)
  if (!skipStrict) {
    const absolutePath = isAbsolute(schemaPath) ? resolve(schemaPath) : resolve(root, schemaPath);
    const normalizedPath = normalize(absolutePath);

    // Double-check for traversal after normalization
    if (!isWithinProjectDirectory(normalizedPath, root)) {
      throw new PathSecurityError(
        `Schema path '${schemaPath}' is outside project directory - invalid path for security reasons`,
        'OUTSIDE_PROJECT'
      );
    }

    // Check symlink safety if file exists
    checkSymlinkSafety(absolutePath, root);
  }

  // Validate file extension (always done)
  if (!hasValidExtension(schemaPath, VALID_SCHEMA_EXTENSIONS)) {
    const ext = extname(schemaPath) || '(none)';
    throw new PathSecurityError(
      `Invalid schema file extension '${ext}'. Valid extensions: ${VALID_SCHEMA_EXTENSIONS.join(', ')}`,
      'INVALID_EXTENSION'
    );
  }
}

/**
 * Validates an output file path.
 *
 * @param outputPath - The path to the output file
 * @param projectRoot - The project root directory (defaults to cwd)
 * @param validExtensions - Valid extensions for this output type (defaults to TypeScript extensions)
 * @throws PathSecurityError if the path is invalid
 */
export function validateOutputPath(
  outputPath: string,
  projectRoot?: string,
  validExtensions: string[] = VALID_OUTPUT_EXTENSIONS
): void {
  // Skip strict validation in test mode (project boundary and symlink checks)
  const skipStrict = shouldSkipStrictValidation();
  const root = projectRoot ?? process.cwd();

  // First, sanitize the path (always done)
  sanitizePath(outputPath);

  // Check if path is within project directory (skip in test mode)
  if (!skipStrict) {
    const absolutePath = isAbsolute(outputPath) ? resolve(outputPath) : resolve(root, outputPath);
    const normalizedPath = normalize(absolutePath);

    // Double-check for traversal after normalization
    if (!isWithinProjectDirectory(normalizedPath, root)) {
      throw new PathSecurityError(
        `Output path '${outputPath}' is outside project directory - invalid path for security reasons`,
        'OUTSIDE_PROJECT'
      );
    }

    // Check symlink safety for the output path or its parent directory
    const parentDir = dirname(absolutePath);
    if (existsSync(absolutePath)) {
      checkSymlinkSafety(absolutePath, root);
    } else if (existsSync(parentDir)) {
      checkSymlinkSafety(parentDir, root);
    }
  }

  // Validate file extension (always done)
  if (!hasValidExtension(outputPath, validExtensions)) {
    const ext = extname(outputPath) || '(none)';
    throw new PathSecurityError(
      `Invalid output file extension '${ext}'. Valid extensions: ${validExtensions.join(', ')}`,
      'INVALID_EXTENSION'
    );
  }
}

/**
 * Validates a directory path.
 *
 * @param dirPath - The path to the directory
 * @param projectRoot - The project root directory (defaults to cwd)
 * @throws PathSecurityError if the path is invalid
 */
export function validateDirectoryPath(dirPath: string, projectRoot?: string): void {
  // Skip strict validation in test mode (project boundary and symlink checks)
  const skipStrict = shouldSkipStrictValidation();
  const root = projectRoot ?? process.cwd();

  // First, sanitize the path (always done)
  sanitizePath(dirPath);

  // Check if path is within project directory (skip in test mode)
  if (!skipStrict) {
    const absolutePath = isAbsolute(dirPath) ? resolve(dirPath) : resolve(root, dirPath);
    const normalizedPath = normalize(absolutePath);

    // Double-check for traversal after normalization
    if (!isWithinProjectDirectory(normalizedPath, root)) {
      throw new PathSecurityError(
        `Directory path '${dirPath}' is outside project directory - invalid path for security reasons`,
        'OUTSIDE_PROJECT'
      );
    }

    // Check symlink safety if directory exists
    if (existsSync(absolutePath)) {
      checkSymlinkSafety(absolutePath, root);
    }
  }
}

/**
 * Validates a migration output path.
 *
 * @param outputPath - The path to the migration output
 * @param projectRoot - The project root directory (defaults to cwd)
 * @throws PathSecurityError if the path is invalid
 */
export function validateMigrationOutputPath(outputPath: string, projectRoot?: string): void {
  validateOutputPath(outputPath, projectRoot, VALID_MIGRATION_EXTENSIONS);
}
