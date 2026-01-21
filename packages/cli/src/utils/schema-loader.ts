/**
 * Schema Loader
 *
 * Utility for loading IceType schema files (.ts, .js, .mjs, .json).
 * Uses jiti for TypeScript loading without requiring tsx or pre-compilation.
 *
 * TypeScript files are transpiled on-the-fly using jiti, which provides:
 * - Native ESM support
 * - TypeScript syntax support (including generics, type annotations, etc.)
 * - Automatic interop between ESM and CommonJS
 * - No type checking (faster, but type errors won't be caught)
 * - tsconfig.json path alias resolution
 *
 * Supported file types:
 * - .ts  - TypeScript (transpiled via jiti)
 * - .js  - JavaScript ESM (native import)
 * - .mjs - JavaScript ESM (native import)
 * - .json - JSON (parsed directly)
 *
 * @module schema-loader
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti, type Jiti } from 'jiti';
import type { IceTypeSchema, SchemaLoadErrorContext, SchemaLoadSuggestion, ErrorCode } from '@icetype/core';
import { SchemaLoadError, ErrorCodes, SchemaLoadErrorDocs } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed tsconfig.json configuration relevant to module resolution.
 */
interface TsConfigResult {
  /** Absolute path to the tsconfig.json file */
  path: string;
  /** Resolved path aliases for jiti */
  aliases: Record<string, string>;
  /** Resolved baseUrl (absolute path) */
  baseUrl: string | null;
}

// =============================================================================
// Caches
// =============================================================================

/**
 * Cache for tsconfig.json lookup results.
 * Maps directory path to the found tsconfig.json path (or null if not found).
 */
const tsConfigPathCache = new Map<string, string | null>();

/**
 * Cache for parsed tsconfig.json configurations.
 * Maps tsconfig.json absolute path to parsed result.
 */
const tsConfigCache = new Map<string, TsConfigResult>();

/**
 * Cache for jiti instances.
 * Maps tsconfig.json path (or 'default' for no tsconfig) to jiti instance.
 * This improves performance by reusing jiti instances for files sharing the same tsconfig.
 */
const jitiCache = new Map<string, Jiti>();

// =============================================================================
// TSConfig Resolution
// =============================================================================

/**
 * Find tsconfig.json by walking up from the starting directory.
 *
 * Results are cached to avoid repeated filesystem traversals for files
 * in the same directory tree.
 *
 * @param startDir - Directory to start searching from
 * @returns Absolute path to tsconfig.json, or null if not found
 *
 * @example
 * ```ts
 * const tsconfig = findTsConfig('/project/src/schemas');
 * // Returns '/project/tsconfig.json' if it exists
 * ```
 */
function findTsConfig(startDir: string): string | null {
  // Check cache first
  if (tsConfigPathCache.has(startDir)) {
    return tsConfigPathCache.get(startDir)!;
  }

  let currentDir = startDir;
  const root = resolve('/');
  const checkedDirs: string[] = [];

  while (currentDir !== root) {
    // If we've already cached this directory, use that result
    if (tsConfigPathCache.has(currentDir)) {
      const result = tsConfigPathCache.get(currentDir)!;
      // Cache all directories we checked along the way
      for (const dir of checkedDirs) {
        tsConfigPathCache.set(dir, result);
      }
      return result;
    }

    checkedDirs.push(currentDir);

    const tsConfigPath = join(currentDir, 'tsconfig.json');
    if (existsSync(tsConfigPath)) {
      // Cache all directories that lead to this tsconfig
      for (const dir of checkedDirs) {
        tsConfigPathCache.set(dir, tsConfigPath);
      }
      return tsConfigPath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  // No tsconfig found - cache negative result for all checked directories
  for (const dir of checkedDirs) {
    tsConfigPathCache.set(dir, null);
  }
  return null;
}

/**
 * Parse tsconfig.json and extract path aliases.
 *
 * Converts TypeScript path mappings to jiti alias format.
 * Results are cached to avoid re-parsing the same tsconfig.json.
 *
 * @param tsConfigPath - Absolute path to tsconfig.json
 * @returns Parsed configuration with aliases and baseUrl
 *
 * @example
 * tsconfig.json:
 * ```json
 * {
 *   "compilerOptions": {
 *     "baseUrl": ".",
 *     "paths": { "@schemas/*": ["./schemas/*"] }
 *   }
 * }
 * ```
 *
 * Result:
 * ```ts
 * {
 *   path: '/project/tsconfig.json',
 *   aliases: { '@schemas': '/project/schemas' },
 *   baseUrl: '/project'
 * }
 * ```
 */
function loadTsConfigPaths(tsConfigPath: string): TsConfigResult {
  // Check cache first
  if (tsConfigCache.has(tsConfigPath)) {
    return tsConfigCache.get(tsConfigPath)!;
  }

  const result: TsConfigResult = {
    path: tsConfigPath,
    aliases: {},
    baseUrl: null,
  };

  try {
    const content = readFileSync(tsConfigPath, 'utf-8');
    const tsConfig = JSON.parse(content);
    const compilerOptions = tsConfig.compilerOptions || {};
    const paths = compilerOptions.paths || {};
    const baseUrl = compilerOptions.baseUrl || '.';

    // Resolve baseUrl relative to tsconfig.json location
    const tsConfigDir = dirname(tsConfigPath);
    const resolvedBaseUrl = resolve(tsConfigDir, baseUrl);
    result.baseUrl = resolvedBaseUrl;

    // Convert tsconfig paths to jiti aliases
    // tsconfig paths: { "@schemas/*": ["./schemas/*"] }
    // jiti aliases:   { "@schemas": "/abs/path/to/schemas" }
    for (const [pattern, targets] of Object.entries(paths)) {
      if (!Array.isArray(targets) || targets.length === 0) continue;

      // Get the first target (TypeScript uses the first match)
      const target = targets[0] as string;

      // Handle wildcard patterns (e.g., "@schemas/*": ["./schemas/*"])
      if (pattern.endsWith('/*') && target.endsWith('/*')) {
        // Remove the /* suffix for jiti alias
        const aliasKey = pattern.slice(0, -2);
        const aliasValue = resolve(resolvedBaseUrl, target.slice(0, -2));
        result.aliases[aliasKey] = aliasValue;
      } else if (!pattern.includes('*') && !target.includes('*')) {
        // Exact match alias (e.g., "@config": ["./config.ts"])
        result.aliases[pattern] = resolve(resolvedBaseUrl, target);
      }
      // Note: Complex patterns with multiple wildcards are not supported
    }
  } catch (error) {
    // Log warning but continue with empty aliases
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Warning: Failed to parse tsconfig.json at ${tsConfigPath}: ${message}\n` +
      `  Path aliases will not be resolved. Check that your tsconfig.json is valid JSON.`
    );
  }

  // Cache the result
  tsConfigCache.set(tsConfigPath, result);
  return result;
}

// =============================================================================
// Jiti Instance Management
// =============================================================================

/**
 * Create or retrieve a cached jiti instance configured for a specific schema file.
 *
 * Jiti instances are cached per tsconfig.json to improve performance when
 * loading multiple files that share the same configuration.
 *
 * @param filePath - Path to the TypeScript file to be loaded
 * @returns Configured jiti instance
 *
 * @remarks
 * The jiti instance is configured with:
 * - `interopDefault: true` - Automatically handle default exports
 * - `moduleCache: false` - Disable caching for watch mode compatibility
 * - `alias` - Path aliases from tsconfig.json (if present)
 */
function getJitiForFile(filePath: string): Jiti {
  const absolutePath = resolve(filePath);
  const fileDir = dirname(absolutePath);
  const tsConfigPath = findTsConfig(fileDir);

  // Use tsconfig path as cache key, or 'default' if no tsconfig found
  const cacheKey = tsConfigPath ?? 'default';

  // Check cache first
  if (jitiCache.has(cacheKey)) {
    return jitiCache.get(cacheKey)!;
  }

  // Load tsconfig aliases if present
  const aliases = tsConfigPath ? loadTsConfigPaths(tsConfigPath).aliases : {};

  // Create new jiti instance
  // Use import.meta.url as the base for jiti's own module resolution.
  // The aliases handle tsconfig path resolution.
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false, // Disable cache for watch mode compatibility
    alias: aliases,
  });

  // Cache the instance
  jitiCache.set(cacheKey, jiti);
  return jiti;
}


// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all internal caches.
 *
 * Use this when you need to reload schemas after tsconfig.json changes,
 * or in watch mode after detecting configuration file changes.
 *
 * @example
 * ```ts
 * // After detecting tsconfig.json change
 * clearSchemaLoaderCaches();
 * const schema = await loadSingleSchema('schema.ts');
 * ```
 */
export function clearSchemaLoaderCaches(): void {
  tsConfigPathCache.clear();
  tsConfigCache.clear();
  jitiCache.clear();
}

// =============================================================================
// Public Types
// =============================================================================

/**
 * A loaded schema with its export name.
 */
export interface LoadedSchema {
  /** The name of the export (e.g., 'UserSchema') */
  name: string;
  /** The parsed IceTypeSchema */
  schema: IceTypeSchema;
}

/**
 * Result of loading schemas from a file.
 */
export interface LoadResult {
  /** Successfully loaded schemas */
  schemas: LoadedSchema[];
  /** Error messages encountered during loading */
  errors: string[];
  /** Original error object if an error occurred (for cause chaining) */
  originalError?: Error;
  /** Structured error context for programmatic handling */
  errorContext?: SchemaLoadErrorContext;
}

// =============================================================================
// Schema Validation
// =============================================================================

/**
 * Type guard to check if a value is an IceTypeSchema.
 *
 * @param value - Value to check
 * @returns True if the value is an IceTypeSchema
 *
 * @remarks
 * Checks for the required properties: name (string), version (number),
 * fields (Map), and directives (object).
 */
function isIceTypeSchema(value: unknown): value is IceTypeSchema {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.version === 'number' &&
    obj.fields instanceof Map &&
    typeof obj.directives === 'object'
  );
}

// =============================================================================
// Error Context Helpers
// =============================================================================

/**
 * Extract location information from an error message or stack trace.
 *
 * @param error - The error to extract location from
 * @param filePath - The file path being loaded
 * @returns Object with line and column if found
 */
function extractLocation(error: Error, filePath: string): { line?: number; column?: number } {
  const message = error.message;
  const stack = error.stack || '';
  const absolutePath = resolve(filePath);

  // Try to extract location from the error message (common for syntax errors)
  // Pattern: "filename:line:column" or "(line:column)"
  const messagePatterns = [
    /at\s+line\s+(\d+),?\s*column\s+(\d+)/i,
    /:(\d+):(\d+)\s*$/,
    /\((\d+):(\d+)\)/,
  ];

  for (const pattern of messagePatterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[2]) {
      return { line: parseInt(match[1], 10), column: parseInt(match[2], 10) };
    }
  }

  // Try to extract from stack trace - look for our file
  const stackLines = stack.split('\n');
  for (const line of stackLines) {
    if (line.includes(absolutePath) || line.includes(filePath)) {
      const stackMatch = line.match(/:(\d+):(\d+)/);
      if (stackMatch && stackMatch[1] && stackMatch[2]) {
        return { line: parseInt(stackMatch[1], 10), column: parseInt(stackMatch[2], 10) };
      }
      // Sometimes only line number is present
      const lineOnlyMatch = line.match(/:(\d+)(?:\)|$)/);
      if (lineOnlyMatch && lineOnlyMatch[1]) {
        return { line: parseInt(lineOnlyMatch[1], 10) };
      }
    }
  }

  return {};
}

/**
 * Detect the type of error and extract relevant information.
 *
 * @param error - The original error
 * @param filePath - The file path being loaded
 * @returns Structured error context
 */
function analyzeModuleError(error: Error, filePath: string): SchemaLoadErrorContext {
  const message = error.message;
  const location = extractLocation(error, filePath);

  // Detect module not found errors
  if (message.includes('Cannot find module') || message.includes('Module not found')) {
    const moduleMatch = message.match(/Cannot find module ['"]([^'"]+)['"]/);
    const moduleName = moduleMatch?.[1];
    const isPathAlias = moduleName ? (moduleName.startsWith('@') || moduleName.startsWith('~')) : false;

    const suggestions: SchemaLoadSuggestion[] = [];

    if (isPathAlias && moduleName) {
      suggestions.push(
        {
          message: `The import '${moduleName}' looks like a path alias`,
          docLink: SchemaLoadErrorDocs.PATH_ALIASES,
        },
        {
          message: `Ensure your tsconfig.json has the correct 'paths' configuration`,
          docLink: SchemaLoadErrorDocs.PATH_ALIASES,
        },
        {
          message: `Example: "paths": { "${moduleName.split('/')[0]}/*": ["./src/*"] }`,
        }
      );
    } else if (moduleName && !moduleName.startsWith('.') && !moduleName.startsWith('/')) {
      suggestions.push(
        {
          message: `The module '${moduleName}' may need to be installed`,
          command: `npm install ${moduleName}`,
        }
      );
    } else {
      suggestions.push(
        { message: 'Check that the file exists at the specified path' },
        { message: "Relative imports should use './' or '../' prefix" }
      );
    }

    // Check for missing tsconfig
    const fileDir = dirname(resolve(filePath));
    const tsConfigPath = findTsConfig(fileDir);
    if (!tsConfigPath) {
      suggestions.push(
        { message: 'No tsconfig.json found in the project' },
        {
          message: "Path aliases require a tsconfig.json with 'baseUrl' and 'paths' configured",
          docLink: SchemaLoadErrorDocs.PATH_ALIASES,
        }
      );
    }

    return {
      errorType: 'import_error',
      filePath,
      missingModule: moduleName,
      isPathAlias,
      suggestions,
      docLink: SchemaLoadErrorDocs.MODULE_RESOLUTION,
      ...location,
    };
  }

  // Detect syntax errors
  if (message.includes('Unexpected token') || message.includes('SyntaxError') ||
      error.name === 'SyntaxError') {
    return {
      errorType: 'syntax_error',
      filePath,
      suggestions: [
        { message: 'The file contains invalid JavaScript/TypeScript syntax' },
        { message: 'Check for missing commas, brackets, or parentheses' },
        {
          message: 'Review the error location for syntax issues',
          docLink: SchemaLoadErrorDocs.SYNTAX_ERRORS,
        }
      ],
      docLink: SchemaLoadErrorDocs.SYNTAX_ERRORS,
      ...location,
    };
  }

  // Detect runtime errors (TypeError, ReferenceError, etc.)
  if (error.name === 'TypeError' || error.name === 'ReferenceError' ||
      error.name === 'RangeError') {
    const suggestions: SchemaLoadSuggestion[] = [
      { message: `A ${error.name} occurred while loading the schema file` },
    ];

    if (error.name === 'TypeError') {
      suggestions.push({ message: 'Check for undefined or null values being accessed' });
    } else if (error.name === 'ReferenceError') {
      suggestions.push({ message: 'Check that all variables are properly defined' });
    } else if (error.name === 'RangeError') {
      suggestions.push({ message: 'Check for invalid array lengths or numeric values' });
    }

    return {
      errorType: 'runtime_error',
      filePath,
      suggestions,
      ...location,
    };
  }

  // Generic module load error
  return {
    errorType: 'module_load',
    filePath,
    suggestions: [
      { message: 'An error occurred while loading the module' },
      { message: 'Check the error message for details' },
    ],
    docLink: SchemaLoadErrorDocs.FILE_TYPES,
    ...location,
  };
}

/**
 * Format a module load error with structured context.
 *
 * @param filePath - Path to the file that failed to load
 * @param error - The original error
 * @returns Object with formatted message and structured context
 */
function formatModuleLoadError(filePath: string, error: unknown): { message: string; context: SchemaLoadErrorContext } {
  const err = error instanceof Error ? error : new Error(String(error));
  const context = analyzeModuleError(err, filePath);
  const baseMessage = err.message;

  // Build the error message
  let message = `Failed to load module: ${filePath}\n  Error: ${baseMessage}`;

  // Add location info
  if (context.line !== undefined) {
    const locationStr = context.column !== undefined
      ? `line ${context.line}, column ${context.column}`
      : `line ${context.line}`;
    message += `\n  Location: ${locationStr}`;
  }

  // Add suggestions
  if (context.suggestions && context.suggestions.length > 0) {
    message += '\n\n  Suggestions:';
    for (const suggestion of context.suggestions) {
      message += `\n    - ${suggestion.message}`;
      if (suggestion.command) {
        message += `\n      Run: ${suggestion.command}`;
      }
    }
  }

  // Add documentation link
  if (context.docLink) {
    message += `\n\n  Documentation: ${context.docLink}`;
  }

  // Add stack trace for debugging (truncated)
  const errorStack = err.stack;
  if (errorStack && process.env.DEBUG) {
    const stackLines = errorStack.split('\n').slice(1, 5);
    message += '\n\n  Stack trace:\n' + stackLines.map(l => `    ${l.trim()}`).join('\n');
  }

  return { message, context };
}

// =============================================================================
// Module Loading
// =============================================================================

/**
 * Load schemas from a JavaScript or TypeScript module.
 *
 * @param filePath - Path to the module file (.ts, .js, or .mjs)
 * @returns LoadResult with extracted schemas and any errors
 *
 * @remarks
 * - TypeScript files are transpiled on-the-fly using jiti
 * - JavaScript files are loaded using native ESM import
 * - All exports are examined for IceTypeSchema instances
 */
async function loadFromModule(filePath: string): Promise<LoadResult> {
  const schemas: LoadedSchema[] = [];
  const errors: string[] = [];
  const absolutePath = resolve(filePath);

  try {
    let module: Record<string, unknown>;

    // Use jiti for TypeScript files, native import for JS files
    if (filePath.endsWith('.ts')) {
      // Get a jiti instance with tsconfig path resolution for this file
      const jiti = getJitiForFile(absolutePath);
      module = await jiti.import(absolutePath) as Record<string, unknown>;
    } else {
      const fileUrl = pathToFileURL(absolutePath).href;
      module = await import(fileUrl);
    }

    // Extract all IceTypeSchema exports
    for (const [exportName, exportValue] of Object.entries(module)) {
      if (isIceTypeSchema(exportValue)) {
        schemas.push({
          name: exportName,
          schema: exportValue,
        });
      }
    }

    if (schemas.length === 0) {
      const context: SchemaLoadErrorContext = {
        errorType: 'no_schemas_found',
        filePath: absolutePath,
        suggestions: [
          { message: 'Ensure your schema file exports at least one IceTypeSchema instance' },
          { message: 'Example: export const MySchema = parseSchema({ $type: \'MyEntity\', ... });' },
        ],
        docLink: SchemaLoadErrorDocs.SCHEMA_FORMAT,
      };
      errors.push(
        `No IceTypeSchema exports found in ${filePath}\n` +
        `  Ensure your schema file exports at least one IceTypeSchema instance.\n` +
        `  Example: export const MySchema = parseSchema({ $type: 'MyEntity', ... });\n\n` +
        `  Documentation: ${SchemaLoadErrorDocs.SCHEMA_FORMAT}`
      );
      return { schemas, errors, errorContext: context };
    }
  } catch (error) {
    const { message, context } = formatModuleLoadError(filePath, error);
    errors.push(message);
    // Preserve original error for cause chaining
    return {
      schemas,
      errors,
      originalError: error instanceof Error ? error : new Error(String(error)),
      errorContext: context,
    };
  }

  return { schemas, errors };
}

/**
 * Load schemas from a JSON file.
 *
 * @param filePath - Path to the JSON file
 * @returns LoadResult with parsed schemas and any errors
 *
 * @remarks
 * The JSON file can contain:
 * - A single IceTypeSchema object
 * - An object with multiple IceTypeSchema values
 */
async function loadFromJson(filePath: string): Promise<LoadResult> {
  const schemas: LoadedSchema[] = [];
  const errors: string[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // JSON can be a single schema or an object with multiple schemas
    if (isIceTypeSchema(data)) {
      schemas.push({
        name: data.name,
        schema: data,
      });
    } else if (typeof data === 'object' && data !== null) {
      // Check if it's an object containing schemas
      for (const [key, value] of Object.entries(data)) {
        if (isIceTypeSchema(value)) {
          schemas.push({
            name: key,
            schema: value,
          });
        }
      }
    }

    if (schemas.length === 0) {
      const context: SchemaLoadErrorContext = {
        errorType: 'no_schemas_found',
        filePath,
        suggestions: [
          { message: 'The JSON file should contain an IceTypeSchema object' },
          { message: 'Required properties: name (string), version (number), fields (Map), directives (object)' },
        ],
        docLink: SchemaLoadErrorDocs.JSON_FORMAT,
      };
      errors.push(
        `No valid IceTypeSchema found in ${filePath}\n` +
        `  The JSON file should contain an IceTypeSchema object with:\n` +
        `    - name: string\n` +
        `    - version: number\n` +
        `    - fields: Map\n` +
        `    - directives: object\n\n` +
        `  Documentation: ${SchemaLoadErrorDocs.JSON_FORMAT}`
      );
      return { schemas, errors, errorContext: context };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message;

    if (message.includes('Unexpected token') || message.includes('JSON')) {
      const context: SchemaLoadErrorContext = {
        errorType: 'json_parse',
        filePath,
        suggestions: [
          { message: 'Ensure the file contains valid JSON syntax' },
          { message: 'Check for trailing commas, missing quotes, or unescaped characters' },
        ],
        docLink: SchemaLoadErrorDocs.JSON_FORMAT,
      };
      errors.push(
        `Failed to parse JSON: ${filePath}\n` +
        `  Error: ${message}\n` +
        `  Ensure the file contains valid JSON syntax.\n\n` +
        `  Documentation: ${SchemaLoadErrorDocs.JSON_FORMAT}`
      );
      return { schemas, errors, originalError: err, errorContext: context };
    } else {
      const context: SchemaLoadErrorContext = {
        errorType: 'unknown',
        filePath,
        suggestions: [
          { message: 'An error occurred while reading the JSON file' },
        ],
      };
      errors.push(`Failed to read JSON file: ${filePath}\n  Error: ${message}`);
      return { schemas, errors, originalError: err, errorContext: context };
    }
  }

  return { schemas, errors };
}

// =============================================================================
// Public API
// =============================================================================

/** Supported file extensions for schema loading */
const SUPPORTED_EXTENSIONS = ['.ts', '.js', '.mjs', '.json'] as const;

/**
 * Load IceType schemas from a file.
 *
 * Supports the following file types:
 * - `.ts` - TypeScript files (transpiled via jiti, no pre-compilation required)
 * - `.js` - JavaScript ESM modules
 * - `.mjs` - JavaScript ESM modules (explicit ESM extension)
 * - `.json` - JSON files with serialized schemas
 *
 * @param filePath - Path to the schema file (relative or absolute)
 * @returns LoadResult with schemas and any errors encountered
 *
 * @example
 * ```ts
 * const result = await loadSchemaFile('./schemas/user.ts');
 * if (result.errors.length > 0) {
 *   console.error('Errors:', result.errors);
 * } else {
 *   console.log('Loaded schemas:', result.schemas.map(s => s.name));
 * }
 * ```
 */
export async function loadSchemaFile(filePath: string): Promise<LoadResult> {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    const context: SchemaLoadErrorContext = {
      errorType: 'file_not_found',
      filePath: absolutePath,
      suggestions: [
        { message: 'Ensure the file exists and the path is correct' },
        { message: 'Check for typos in the file name or path' },
      ],
    };
    return {
      schemas: [],
      errors: [
        `File not found: ${filePath}\n` +
        `  Checked path: ${absolutePath}\n` +
        `  Ensure the file exists and the path is correct.`
      ],
      errorContext: context,
    };
  }

  const ext = extname(absolutePath).toLowerCase();

  switch (ext) {
    case '.json':
      return loadFromJson(absolutePath);

    case '.ts':
    case '.js':
    case '.mjs':
      return loadFromModule(absolutePath);

    default: {
      const context: SchemaLoadErrorContext = {
        errorType: 'unsupported_extension',
        filePath: absolutePath,
        extension: ext,
        suggestions: [
          { message: `Supported extensions: ${SUPPORTED_EXTENSIONS.join(', ')}` },
          { message: 'Rename your file to use a supported extension' },
        ],
        docLink: SchemaLoadErrorDocs.FILE_TYPES,
      };
      return {
        schemas: [],
        errors: [
          `Unsupported file extension: ${ext}\n` +
          `  Supported extensions: ${SUPPORTED_EXTENSIONS.join(', ')}\n` +
          `  File: ${filePath}\n\n` +
          `  Documentation: ${SchemaLoadErrorDocs.FILE_TYPES}`
        ],
        errorContext: context,
      };
    }
  }
}

/**
 * Load a single schema from a file.
 *
 * Returns the first IceTypeSchema export found in the file.
 * Throws an error if the file cannot be loaded or contains no schemas.
 *
 * @param filePath - Path to the schema file
 * @returns The first IceTypeSchema found in the file
 * @throws {SchemaLoadError} If the file cannot be loaded or contains no schemas
 *
 * @example
 * ```ts
 * try {
 *   const schema = await loadSingleSchema('./schemas/user.ts');
 *   console.log('Loaded schema:', schema.name);
 * } catch (error) {
 *   if (error instanceof SchemaLoadError) {
 *     console.error('Failed to load schema:', error.message);
 *   }
 * }
 * ```
 */
export async function loadSingleSchema(filePath: string): Promise<IceTypeSchema> {
  const result = await loadSchemaFile(filePath);

  if (result.errors.length > 0) {
    // Determine the appropriate error code based on error context
    let code: ErrorCode = ErrorCodes.SCHEMA_LOAD_ERROR;
    if (result.errorContext?.errorType === 'file_not_found') {
      code = ErrorCodes.FILE_NOT_FOUND;
    } else if (result.errorContext?.errorType === 'unsupported_extension') {
      code = ErrorCodes.UNSUPPORTED_FILE_TYPE;
    } else if (result.errorContext?.errorType === 'module_load' || result.errorContext?.errorType === 'import_error') {
      code = ErrorCodes.MODULE_LOAD_ERROR;
    } else if (result.errorContext?.errorType === 'json_parse') {
      code = ErrorCodes.JSON_PARSE_ERROR;
    } else if (result.errorContext?.errorType === 'no_schemas_found') {
      code = ErrorCodes.NO_SCHEMAS_FOUND;
    }

    throw new SchemaLoadError(result.errors.join('\n'), {
      filePath,
      code,
      cause: result.originalError,
      errorContext: result.errorContext,
    });
  }

  const firstSchema = result.schemas[0];
  if (!firstSchema) {
    const errorContext: SchemaLoadErrorContext = {
      errorType: 'no_schemas_found',
      filePath,
      suggestions: [
        { message: 'Ensure the file exports at least one IceTypeSchema instance' },
      ],
      docLink: SchemaLoadErrorDocs.SCHEMA_FORMAT,
    };
    throw new SchemaLoadError(
      `No schemas found in file: ${filePath}\n` +
      `  Ensure the file exports at least one IceTypeSchema instance.`,
      {
        filePath,
        code: ErrorCodes.NO_SCHEMAS_FOUND,
        errorContext,
      }
    );
  }

  return firstSchema.schema;
}

/**
 * Load all schemas from a file.
 *
 * Returns an array of all IceTypeSchema exports found in the file.
 * Throws an error if the file cannot be loaded.
 *
 * @param filePath - Path to the schema file
 * @returns Array of all IceTypeSchema instances found in the file
 * @throws {SchemaLoadError} If the file cannot be loaded
 *
 * @example
 * ```ts
 * const schemas = await loadAllSchemas('./schemas/index.ts');
 * console.log(`Loaded ${schemas.length} schemas`);
 * for (const schema of schemas) {
 *   console.log(`  - ${schema.name}`);
 * }
 * ```
 */
export async function loadAllSchemas(filePath: string): Promise<IceTypeSchema[]> {
  const result = await loadSchemaFile(filePath);

  if (result.errors.length > 0) {
    // Determine the appropriate error code based on error context
    let code: ErrorCode = ErrorCodes.SCHEMA_LOAD_ERROR;
    if (result.errorContext?.errorType === 'file_not_found') {
      code = ErrorCodes.FILE_NOT_FOUND;
    } else if (result.errorContext?.errorType === 'unsupported_extension') {
      code = ErrorCodes.UNSUPPORTED_FILE_TYPE;
    } else if (result.errorContext?.errorType === 'module_load' || result.errorContext?.errorType === 'import_error') {
      code = ErrorCodes.MODULE_LOAD_ERROR;
    } else if (result.errorContext?.errorType === 'json_parse') {
      code = ErrorCodes.JSON_PARSE_ERROR;
    } else if (result.errorContext?.errorType === 'no_schemas_found') {
      code = ErrorCodes.NO_SCHEMAS_FOUND;
    }

    throw new SchemaLoadError(result.errors.join('\n'), {
      filePath,
      code,
      cause: result.originalError,
      errorContext: result.errorContext,
    });
  }

  return result.schemas.map((s) => s.schema);
}
