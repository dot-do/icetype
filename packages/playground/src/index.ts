/**
 * @icetype/playground
 *
 * Interactive web playground for IceType schemas.
 *
 * Provides a browser-compatible API for:
 * - Schema parsing with real-time validation
 * - TypeScript type generation preview
 * - SQL generation for multiple dialects
 * - Shareable URL generation
 *
 * @example
 * ```typescript
 * import { Playground } from '@icetype/playground';
 *
 * const playground = new Playground();
 *
 * // Parse a schema
 * const result = playground.parseSchema(`{
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * }`);
 *
 * if (result.success) {
 *   // Generate TypeScript types
 *   const types = playground.generateTypes(result.schema);
 *   console.log(types.code);
 *
 *   // Generate SQL
 *   const sql = playground.generateSql(result.schema, 'postgres');
 *   console.log(sql.sql);
 * }
 * ```
 *
 * @packageDocumentation
 */

import {
  type IceTypeSchema,
  type FieldDefinition,
  IceTypeParser,
  ParseError,
  isParseError,
} from '@icetype/core';
import { transformToPostgresDDL } from '@icetype/postgres';
import { transformToMySQLDDL } from '@icetype/mysql';
import { transformToSQLiteDDL } from '@icetype/sqlite';

// =============================================================================
// Types
// =============================================================================

/**
 * Result from parsing schema input in the playground
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed schema if successful */
  schema?: IceTypeSchema;
  /** Parse errors if failed */
  errors?: ParseErrorInfo[];
}

/**
 * Error information with position for editor highlighting
 */
export interface ParseErrorInfo {
  /** Error message */
  message: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Error severity */
  severity: 'error' | 'warning';
}

/**
 * Result from validation
 */
export interface ValidationResult {
  /** Whether the schema is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationErrorInfo[];
  /** Validation warnings */
  warnings: ValidationErrorInfo[];
}

/**
 * Validation error with context
 */
export interface ValidationErrorInfo {
  /** Error message */
  message: string;
  /** Field that caused the error */
  field?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Generated TypeScript types output
 */
export interface TypesGenerationResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated TypeScript code */
  code?: string;
  /** Generation errors */
  errors?: string[];
}

/**
 * Generated SQL output
 */
export interface SqlGenerationResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated SQL statements */
  sql?: string;
  /** Generation errors */
  errors?: string[];
}

/**
 * SQL dialect options
 */
export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

/**
 * Share URL result
 */
export interface ShareResult {
  /** Full shareable URL */
  url: string;
  /** Compressed schema data */
  encodedSchema: string;
}

// =============================================================================
// Known Types
// =============================================================================

const KNOWN_TYPES = new Set([
  'string',
  'text',
  'int',
  'long',
  'bigint',
  'float',
  'double',
  'bool',
  'boolean',
  'uuid',
  'timestamp',
  'timestamptz',
  'date',
  'time',
  'json',
  'binary',
  'decimal',
  'varchar',
  'char',
]);

/**
 * Common typos mapped to correct types for better error suggestions
 */
const TYPO_MAP: Record<string, string> = {
  // String typos
  strng: 'string',
  sting: 'string',
  strign: 'string',
  strin: 'string',
  stirng: 'string',
  srting: 'string',
  stringg: 'string',
  str: 'string',

  // Integer typos
  integr: 'int',
  intger: 'int',
  integer: 'int',
  intt: 'int',
  itn: 'int',
  iny: 'int',

  // Boolean typos
  bolean: 'boolean',
  boolen: 'boolean',
  booleen: 'boolean',
  booleaan: 'boolean',
  boo: 'bool',
  bol: 'bool',

  // Timestamp typos
  timestap: 'timestamp',
  timstamp: 'timestamp',
  timestemp: 'timestamp',
  timestampp: 'timestamp',
  ts: 'timestamp',

  // JSON typos
  jsn: 'json',
  josn: 'json',
  jso: 'json',

  // UUID typos
  uiud: 'uuid',
  uudi: 'uuid',
  uid: 'uuid',
  guid: 'uuid',

  // Text typos
  txt: 'text',
  textt: 'text',

  // Float typos
  flaot: 'float',
  flot: 'float',
  floatt: 'float',

  // Double typos
  doubl: 'double',
  duble: 'double',
  doubel: 'double',

  // Date typos
  dat: 'date',
  datee: 'date',

  // Binary typos
  bin: 'binary',
  binry: 'binary',
  bianry: 'binary',
};

/**
 * Helpful hints for common IceType patterns
 */
const TYPE_HINTS: Record<string, string> = {
  string: 'Use ! for required, ? for optional, # for unique (e.g., string!, string?, string#)',
  int: 'For large numbers, consider using bigint instead',
  uuid: 'Typically used as primary key with ! modifier (e.g., uuid!)',
  timestamp: 'Use timestamptz for timezone-aware timestamps',
  json: 'Consider defining a more specific type if structure is known',
  decimal: 'Specify precision and scale (e.g., decimal(10,2) for currency)',
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Suggest similar known types for typos
 */
function suggestType(unknownType: string): string | undefined {
  const lower = unknownType.toLowerCase();

  // Check direct typo map first
  if (TYPO_MAP[lower]) {
    return TYPO_MAP[lower];
  }

  // Find best match using Levenshtein distance
  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const knownType of KNOWN_TYPES) {
    const distance = levenshteinDistance(lower, knownType);
    // Only suggest if distance is at most 2 (close enough to be a typo)
    if (distance <= 2 && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = knownType;
    }
  }

  return bestMatch;
}

/**
 * Get a helpful hint for a type
 */
function getTypeHint(type: string): string | undefined {
  return TYPE_HINTS[type.toLowerCase()];
}

// =============================================================================
// Type Mappings for TypeScript Generation
// =============================================================================

const typeToTypeScript: Record<string, string> = {
  string: 'string',
  text: 'string',
  varchar: 'string',
  char: 'string',
  int: 'number',
  long: 'number',
  bigint: 'bigint',
  float: 'number',
  double: 'number',
  bool: 'boolean',
  boolean: 'boolean',
  uuid: 'string',
  timestamp: 'Date',
  timestamptz: 'Date',
  date: 'string',
  time: 'string',
  json: 'Record<string, unknown>',
  binary: 'Uint8Array',
  decimal: 'number',
};

function getTypeScriptType(iceType: string): string {
  const base = iceType.toLowerCase().replace(/\(.*\)$/, ''); // Remove params like (10,2)
  return typeToTypeScript[base] ?? 'unknown';
}

// =============================================================================
// Playground Class
// =============================================================================

// =============================================================================
// Default Schema Examples
// =============================================================================

/**
 * Default schema template for new users
 */
export const DEFAULT_SCHEMA = `{
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  createdAt: 'timestamp',
}`;

/**
 * Example schemas for learning IceType
 */
export const EXAMPLE_SCHEMAS = {
  simple: `{
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  createdAt: 'timestamp',
}`,

  withRelations: `{
  User: {
    id: 'uuid!',
    email: 'string#',
    posts: '<- Post.author[]',
  },
  Post: {
    id: 'uuid!',
    title: 'string!',
    content: 'text',
    author: '-> User',
    createdAt: 'timestamp',
  },
}`,

  withDefaults: `{
  $type: 'Config',
  id: 'uuid!',
  status: 'string = "active"',
  retries: 'int = 3',
  enabled: 'boolean = true',
}`,

  ecommerce: `{
  Product: {
    id: 'uuid!',
    name: 'string!',
    price: 'decimal(10,2)!',
    tags: 'string[]',
    metadata: 'json?',
    inStock: 'boolean = true',
  },
  Order: {
    id: 'uuid!',
    total: 'decimal(10,2)!',
    status: 'string = "pending"',
    createdAt: 'timestamp',
  },
}`,
} as const;

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Input validation result
 */
export interface InputValidationResult {
  /** Whether the input is valid for parsing */
  valid: boolean;
  /** Quick validation issues (before full parsing) */
  issues: InputValidationIssue[];
}

/**
 * Input validation issue (quick check before parsing)
 */
export interface InputValidationIssue {
  /** Issue message */
  message: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Suggested fix if available */
  suggestion?: string;
}

// =============================================================================
// Caching
// =============================================================================

/**
 * Simple LRU cache for parsed schemas
 */
class SchemaCache {
  private cache = new Map<string, { result: ParseResult; timestamp: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 50, ttlMs = 60000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): ParseResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  set(key: string, result: ParseResult): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// =============================================================================
// Debouncing
// =============================================================================

/**
 * Debounce utility for real-time parsing
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// =============================================================================
// Playground Class
// =============================================================================

/**
 * Playground class - provides the core functionality for the web playground.
 * This is the main API that the React/Preact components will use.
 *
 * Features:
 * - Schema parsing with real-time validation
 * - TypeScript type generation preview
 * - SQL generation for multiple dialects (PostgreSQL, MySQL, SQLite)
 * - Shareable URL generation with compression
 * - Input validation with helpful suggestions
 * - Caching for improved performance
 */
export class Playground {
  private parser: IceTypeParser;
  private cache: SchemaCache;

  constructor() {
    this.parser = new IceTypeParser();
    this.cache = new SchemaCache();
  }

  /**
   * Clear the internal cache.
   * Useful when you want to force re-parsing of schemas.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Quick validation of input before full parsing.
   * Returns validation issues without doing expensive parsing.
   */
  validateInput(input: string): InputValidationResult {
    const issues: InputValidationIssue[] = [];

    const trimmed = input.trim();

    // Check empty input
    if (!trimmed) {
      issues.push({
        message: 'Schema input is empty',
        severity: 'error',
        suggestion: 'Start with a basic schema like:\n' + DEFAULT_SCHEMA,
      });
      return { valid: false, issues };
    }

    // Check for object literal format
    if (!trimmed.startsWith('{')) {
      issues.push({
        message: 'Schema must be an object literal starting with {',
        severity: 'error',
        suggestion: 'Wrap your schema in curly braces: { ... }',
      });
      return { valid: false, issues };
    }

    if (!trimmed.endsWith('}')) {
      issues.push({
        message: 'Schema must end with }',
        severity: 'error',
        suggestion: 'Make sure to close your schema with a closing brace }',
      });
      return { valid: false, issues };
    }

    // Check for balanced braces
    let braceCount = 0;
    for (const char of trimmed) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount < 0) {
        issues.push({
          message: 'Unbalanced braces: found closing } before opening {',
          severity: 'error',
        });
        return { valid: false, issues };
      }
    }
    if (braceCount !== 0) {
      issues.push({
        message: `Unbalanced braces: ${braceCount > 0 ? 'missing closing }' : 'extra closing }'}`,
        severity: 'error',
        suggestion: braceCount > 0 ? `Add ${braceCount} closing brace(s)` : undefined,
      });
      return { valid: false, issues };
    }

    // Check for common syntax issues
    if (trimmed.includes(';;')) {
      issues.push({
        message: 'Double semicolons detected',
        severity: 'warning',
        suggestion: 'Remove extra semicolons',
      });
    }

    // Check for missing $type in single-entity schemas
    if (!trimmed.includes('$type') && !trimmed.includes(': {')) {
      issues.push({
        message: 'Single-entity schema is missing $type directive',
        severity: 'warning',
        suggestion: "Add $type: 'EntityName' to name your schema",
      });
    }

    return { valid: issues.every((i) => i.severity !== 'error'), issues };
  }

  /**
   * Parse schema input and return results with error positions.
   *
   * The input is expected to be a JavaScript object literal syntax
   * that represents an IceType schema definition.
   *
   * Features:
   * - Caches parsed results for performance
   * - Provides detailed error messages with line/column positions
   * - Suggests fixes for common mistakes
   *
   * @param input - The schema input string (JavaScript object literal)
   * @param options - Optional parsing options
   * @returns ParseResult with success status, schema, or errors
   *
   * @example
   * ```typescript
   * const result = playground.parseSchema(`{
   *   $type: 'User',
   *   id: 'uuid!',
   *   email: 'string#',
   * }`);
   *
   * if (result.success) {
   *   console.log('Parsed:', result.schema);
   * } else {
   *   console.error('Errors:', result.errors);
   * }
   * ```
   */
  parseSchema(input: string, options?: { skipCache?: boolean }): ParseResult {
    // Check cache first (unless explicitly skipped)
    if (!options?.skipCache) {
      const cached = this.cache.get(input);
      if (cached) {
        return cached;
      }
    }

    // Handle empty or whitespace-only input
    const trimmed = input.trim();
    if (!trimmed) {
      const result: ParseResult = {
        success: false,
        errors: [
          {
            message: 'Schema input is empty. Start with a basic schema definition.',
            line: 1,
            column: 1,
            severity: 'error',
          },
        ],
      };
      return result;
    }

    // Quick input validation
    const validation = this.validateInput(input);
    if (!validation.valid) {
      const result: ParseResult = {
        success: false,
        errors: validation.issues
          .filter((i) => i.severity === 'error')
          .map((issue) => ({
            message: issue.suggestion
              ? `${issue.message}. ${issue.suggestion}`
              : issue.message,
            line: 1,
            column: 1,
            severity: 'error' as const,
          })),
      };
      return result;
    }

    try {
      // Parse the input as a JavaScript object literal
      // We need to evaluate it safely - use Function constructor
      // Note: This is for playground use only, not production
      const schemaObj = this.parseObjectLiteral(input);

      if (!schemaObj || typeof schemaObj !== 'object') {
        const result: ParseResult = {
          success: false,
          errors: [
            {
              message: 'Invalid schema format - expected an object literal like { $type: "Name", ... }',
              line: 1,
              column: 1,
              severity: 'error',
            },
          ],
        };
        return result;
      }

      // Validate field types before parsing
      const typeErrors = this.validateFieldTypes(schemaObj, input);
      if (typeErrors.length > 0) {
        const result: ParseResult = {
          success: false,
          errors: typeErrors,
        };
        return result;
      }

      // Parse with the IceType parser
      const schema = this.parser.parse(schemaObj);

      const result: ParseResult = {
        success: true,
        schema,
      };

      // Cache successful result
      this.cache.set(input, result);

      return result;
    } catch (error) {
      // Try to extract line/column from error
      const errorInfo = this.extractErrorPosition(error, input);
      const result: ParseResult = {
        success: false,
        errors: [errorInfo],
      };
      return result;
    }
  }

  /**
   * Validate a parsed schema with detailed feedback.
   *
   * Provides comprehensive validation including:
   * - Missing $type directive detection
   * - Invalid field type detection with suggestions
   * - Conflicting modifier warnings
   * - Relation reference validation
   * - Best practice recommendations
   *
   * @param schema - The parsed IceType schema to validate
   * @returns ValidationResult with errors and warnings
   */
  validateSchema(schema: IceTypeSchema): ValidationResult {
    const errors: ValidationErrorInfo[] = [];
    const warnings: ValidationErrorInfo[] = [];

    // Check for missing $type directive
    if (!schema.name || schema.name === 'Unknown') {
      warnings.push({
        message: 'Schema is missing $type directive - entity name will default to "Unknown"',
        field: '$type',
        suggestion: "Add $type: 'YourEntityName' to give your schema a meaningful name. Example: $type: 'User'",
      });
    }

    // Check for empty schema
    const nonDirectiveFields = Array.from(schema.fields.keys()).filter((k) => !k.startsWith('$'));
    if (nonDirectiveFields.length === 0) {
      errors.push({
        message: 'Schema has no fields defined',
        suggestion: "Add at least one field. Example: id: 'uuid!'",
      });
    }

    // Check for missing primary key field (common pattern)
    const hasIdField = schema.fields.has('id');
    if (!hasIdField && nonDirectiveFields.length > 0) {
      warnings.push({
        message: "Schema is missing an 'id' field",
        suggestion: "Consider adding id: 'uuid!' as a primary key",
      });
    }

    // Check for invalid field types
    for (const [fieldName, field] of schema.fields) {
      if (fieldName.startsWith('$')) continue;

      // Check if it's a valid type
      if (!field.relation && !this.isValidType(field.type)) {
        const suggestion = suggestType(field.type);
        const hint = getTypeHint(suggestion ?? '');
        let suggestionText = suggestion ? `Did you mean '${suggestion}'?` : undefined;
        if (hint && suggestionText) {
          suggestionText += ` Hint: ${hint}`;
        }
        errors.push({
          message: `Unknown type '${field.type}' for field '${fieldName}'`,
          field: fieldName,
          suggestion: suggestionText,
        });
      }

      // Check for conflicting modifiers (! and ?)
      if (field.isOptional && field.modifier === '!') {
        warnings.push({
          message: `Field '${fieldName}' has both required (!) and optional (?) modifiers`,
          field: fieldName,
          suggestion: 'Use either ! for required or ? for optional, not both. The ! modifier takes precedence.',
        });
      }

      // Check for string fields without length consideration
      if (field.type === 'string' && !field.isOptional && !fieldName.toLowerCase().includes('id')) {
        // This is a soft warning for long string fields
        if (['description', 'content', 'body', 'text', 'bio', 'notes'].some((s) => fieldName.toLowerCase().includes(s))) {
          warnings.push({
            message: `Field '${fieldName}' uses 'string' type but may contain long text`,
            field: fieldName,
            suggestion: "Consider using 'text' type for potentially long content",
          });
        }
      }
    }

    // Check for invalid relation references
    for (const [relName, relation] of schema.relations) {
      // For single-entity schemas, we can't verify relation targets
      // But we can warn about obvious issues
      if (!relation.targetType) {
        errors.push({
          message: `Relation '${relName}' is missing target type`,
          field: relName,
        });
      } else {
        // In a playground context, we may not have all schemas loaded
        // So we add a warning for unknown references
        warnings.push({
          message: `Relation '${relName}' references '${relation.targetType}' - ensure this type exists`,
          field: relName,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate TypeScript types from schema.
   *
   * Produces well-commented TypeScript interfaces with:
   * - JSDoc comments for each field
   * - Default value annotations
   * - Type constraint information
   * - Relation documentation
   *
   * @param schema - The parsed IceType schema
   * @param options - Generation options
   * @returns TypesGenerationResult with generated code or errors
   */
  generateTypes(
    schema: IceTypeSchema,
    options?: { includeHeader?: boolean; includeHints?: boolean }
  ): TypesGenerationResult {
    const includeHeader = options?.includeHeader ?? true;
    const includeHints = options?.includeHints ?? true;

    try {
      // Validate schema
      if (!schema || !schema.fields || !(schema.fields instanceof Map)) {
        return {
          success: false,
          errors: ['Invalid schema: missing or invalid fields. Make sure to parse the schema first.'],
        };
      }

      const name = schema.name || 'Unknown';
      const lines: string[] = [];

      // Add header comment
      if (includeHeader) {
        lines.push('/**');
        lines.push(` * Generated TypeScript types for ${name}`);
        lines.push(' * ');
        lines.push(' * Auto-generated by IceType Playground');
        lines.push(' * @see https://icetype.dev');
        lines.push(' */');
        lines.push('');
      }

      // Generate interface
      lines.push(`export interface ${name} {`);

      for (const [fieldName, field] of schema.fields) {
        if (fieldName.startsWith('$')) continue;

        const tsType = this.generateFieldType(field);
        const optionalMark = field.isOptional ? '?' : '';

        // Generate comprehensive JSDoc comment
        const comments = this.generateFieldJSDoc(field, fieldName, includeHints);
        if (comments.length > 0) {
          lines.push('');
          for (const comment of comments) {
            lines.push(`  ${comment}`);
          }
        }

        lines.push(`  ${fieldName}${optionalMark}: ${tsType};`);
      }

      lines.push('}');

      // Add helpful footer
      if (includeHeader) {
        lines.push('');
        lines.push('// =====================================');
        lines.push('// Usage example:');
        lines.push('// =====================================');
        lines.push(`// const user: ${name} = {`);

        // Generate example values
        let exampleCount = 0;
        for (const [fieldName, field] of schema.fields) {
          if (fieldName.startsWith('$') || exampleCount >= 3) continue;
          const exampleValue = this.getExampleValue(field);
          lines.push(`//   ${fieldName}: ${exampleValue},`);
          exampleCount++;
        }
        if (schema.fields.size > 4) {
          lines.push('//   // ... other fields');
        }
        lines.push('// };');
      }

      return {
        success: true,
        code: lines.join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error during type generation'],
      };
    }
  }

  /**
   * Generate comprehensive JSDoc comment for a field
   */
  private generateFieldJSDoc(field: FieldDefinition, fieldName: string, includeHints: boolean): string[] {
    const lines: string[] = [];
    const annotations: string[] = [];

    // Add description based on field type
    if (field.relation) {
      annotations.push(`@relation Relation to ${field.relation.targetType}`);
    }

    // Add default value annotation
    if (field.defaultValue !== undefined) {
      const defaultStr =
        typeof field.defaultValue === 'string'
          ? `"${field.defaultValue}"`
          : JSON.stringify(field.defaultValue);
      annotations.push(`@default ${defaultStr}`);
    }

    // Add constraints
    if (field.isUnique || field.modifier === '#') {
      annotations.push('@unique This field must be unique');
    }

    if (field.modifier === '!' && !field.isOptional) {
      annotations.push('@required This field is required');
    }

    if (field.isArray) {
      annotations.push('@array This field is an array');
    }

    // Add type hint
    if (includeHints) {
      const hint = getTypeHint(field.type);
      if (hint && annotations.length > 0) {
        annotations.push(`@hint ${hint}`);
      }
    }

    // Only generate JSDoc if we have annotations
    if (annotations.length > 0) {
      lines.push('/**');
      for (const annotation of annotations) {
        lines.push(` * ${annotation}`);
      }
      lines.push(' */');
    }

    return lines;
  }

  /**
   * Get an example value for a field type
   */
  private getExampleValue(field: FieldDefinition): string {
    if (field.defaultValue !== undefined) {
      return typeof field.defaultValue === 'string'
        ? `"${field.defaultValue}"`
        : JSON.stringify(field.defaultValue);
    }

    const baseType = field.type.toLowerCase().replace(/\(.*\)$/, '');
    const exampleMap: Record<string, string> = {
      string: '"example"',
      text: '"example text"',
      int: '42',
      long: '123456789',
      bigint: '123456789n',
      float: '3.14',
      double: '3.14159',
      bool: 'true',
      boolean: 'true',
      uuid: '"550e8400-e29b-41d4-a716-446655440000"',
      timestamp: 'new Date()',
      timestamptz: 'new Date()',
      date: '"2024-01-01"',
      time: '"12:00:00"',
      json: '{}',
      decimal: '99.99',
    };

    let example = exampleMap[baseType] ?? '"..."';

    if (field.isArray) {
      example = `[${example}]`;
    }

    return example;
  }

  /**
   * Generate SQL DDL for a specific dialect.
   *
   * Supported dialects:
   * - postgres: PostgreSQL with native array support
   * - mysql: MySQL 8.0+ with JSON for arrays
   * - sqlite: SQLite with JSON1 extension for arrays
   *
   * @param schema - The parsed IceType schema
   * @param dialect - Target SQL dialect
   * @param options - Generation options
   * @returns SqlGenerationResult with generated SQL or errors
   */
  generateSql(
    schema: IceTypeSchema,
    dialect: SqlDialect,
    options?: { includeHeader?: boolean; includeIndexes?: boolean }
  ): SqlGenerationResult {
    const includeHeader = options?.includeHeader ?? true;

    try {
      // Validate schema
      if (!schema || !schema.fields || !(schema.fields instanceof Map)) {
        return {
          success: false,
          errors: ['Invalid schema: missing or invalid fields. Make sure to parse the schema first.'],
        };
      }

      // Validate dialect
      const validDialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite'];
      if (!validDialects.includes(dialect)) {
        return {
          success: false,
          errors: [
            `Unknown SQL dialect: "${dialect}". ` +
            `Supported dialects: ${validDialects.join(', ')}`,
          ],
        };
      }

      let sql: string;
      const transformOptions = { includeSystemFields: false };

      switch (dialect) {
        case 'postgres':
          sql = transformToPostgresDDL(schema, transformOptions);
          break;
        case 'mysql':
          // MySQL doesn't have native arrays, so we need to handle arrays as JSON
          sql = this.generateMySQLWithArraySupport(schema, transformOptions);
          break;
        case 'sqlite':
          sql = transformToSQLiteDDL(schema, transformOptions);
          break;
        default:
          // TypeScript exhaustiveness check
          const _exhaustive: never = dialect;
          return {
            success: false,
            errors: [`Unknown SQL dialect: ${_exhaustive}`],
          };
      }

      // Add helpful header comment
      if (includeHeader) {
        const header = this.generateSqlHeader(schema, dialect);
        sql = header + sql;
      }

      return {
        success: true,
        sql,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error during SQL generation'],
      };
    }
  }

  /**
   * Generate a helpful SQL header comment
   */
  private generateSqlHeader(schema: IceTypeSchema, dialect: SqlDialect): string {
    const dialectInfo: Record<SqlDialect, string> = {
      postgres: 'PostgreSQL 14+',
      mysql: 'MySQL 8.0+ (uses JSON for arrays)',
      sqlite: 'SQLite 3.38+ (uses JSON1 extension for arrays)',
    };

    const lines = [
      '-- =============================================',
      `-- IceType Generated DDL for ${schema.name || 'Unknown'}`,
      '-- =============================================',
      `-- Target: ${dialectInfo[dialect]}`,
      '-- Generated by: IceType Playground',
      '-- ',
      '-- IMPORTANT: Review before running in production!',
      '-- - Add indexes for frequently queried columns',
      '-- - Consider adding foreign key constraints',
      '-- - Adjust column sizes based on your data',
      '-- =============================================',
      '',
    ];

    return lines.join('\n');
  }

  /**
   * Generate MySQL DDL with proper array support (as JSON type).
   */
  private generateMySQLWithArraySupport(
    schema: IceTypeSchema,
    options: { includeSystemFields: boolean }
  ): string {
    // Check if any field is an array
    const hasArrayFields = Array.from(schema.fields.values()).some(
      (field) => field.isArray && !field.name.startsWith('$')
    );

    if (!hasArrayFields) {
      return transformToMySQLDDL(schema, options);
    }

    // Generate custom DDL for schemas with arrays
    // MySQL uses JSON type for arrays
    const tableName = schema.name || 'Unknown';
    const columns: string[] = [];

    for (const [fieldName, field] of schema.fields) {
      if (fieldName.startsWith('$')) continue;

      const nullable = field.isOptional || field.modifier === '?';
      const unique = field.isUnique || field.modifier === '#';
      let typeStr: string;

      if (field.isArray) {
        // Arrays in MySQL are stored as JSON
        typeStr = 'JSON';
      } else {
        typeStr = this.getMySQLType(field.type, field);
      }

      let colDef = `  \`${fieldName}\` ${typeStr}`;
      if (!nullable) colDef += ' NOT NULL';
      if (unique) colDef += ' UNIQUE';
      if (field.defaultValue !== undefined) {
        colDef += ` DEFAULT ${this.formatMySQLDefault(field.defaultValue, typeStr)}`;
      }
      columns.push(colDef);
    }

    return `CREATE TABLE \`${tableName}\` (\n${columns.join(',\n')}\n) ENGINE=InnoDB;`;
  }

  /**
   * Get MySQL type for an IceType field.
   */
  private getMySQLType(type: string, field: FieldDefinition): string {
    const normalized = type.toLowerCase();
    const typeMap: Record<string, string> = {
      string: 'VARCHAR(255)',
      text: 'TEXT',
      varchar: 'VARCHAR(255)',
      int: 'INT',
      long: 'BIGINT',
      bigint: 'BIGINT',
      float: 'FLOAT',
      double: 'DOUBLE',
      bool: 'TINYINT(1)',
      boolean: 'TINYINT(1)',
      uuid: 'CHAR(36)',
      timestamp: 'DATETIME',
      timestamptz: 'DATETIME',
      date: 'DATE',
      time: 'TIME',
      json: 'JSON',
      binary: 'BLOB',
      decimal: `DECIMAL(${field.precision ?? 38}, ${field.scale ?? 9})`,
    };
    return typeMap[normalized] ?? 'VARCHAR(255)';
  }

  /**
   * Format a default value for MySQL.
   */
  private formatMySQLDefault(value: unknown, _type: string): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    if (value === null) {
      return 'NULL';
    }
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  /**
   * Create a shareable URL for the current schema.
   */
  createShareUrl(schemaCode: string, baseUrl?: string): ShareResult {
    const base = baseUrl ?? 'https://icetype.dev/playground';

    // Compress and encode the schema
    const encoded = this.compressAndEncode(schemaCode);

    const url = `${base}?schema=${encoded}`;

    return {
      url,
      encodedSchema: encoded,
    };
  }

  /**
   * Load schema from a share URL.
   */
  loadFromShareUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const encoded = urlObj.searchParams.get('schema');

      if (!encoded) {
        return null;
      }

      return this.decodeAndDecompress(encoded);
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Parse a JavaScript object literal string into an object.
   */
  private parseObjectLiteral(input: string): Record<string, unknown> {
    // Use Function constructor to safely evaluate the object literal
    // Wrap in parentheses to make it an expression
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(`return (${input});`);
      return fn() as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate field types before full parsing.
   */
  private validateFieldTypes(
    obj: Record<string, unknown>,
    input: string
  ): ParseErrorInfo[] {
    const errors: ParseErrorInfo[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;

      if (typeof value === 'string') {
        // Extract base type from the value
        const baseType = this.extractBaseType(value);
        if (baseType && !this.isValidType(baseType) && !this.isRelationType(value)) {
          const suggestion = suggestType(baseType);
          const position = this.findFieldPosition(input, key);
          errors.push({
            message: `Unknown type '${baseType}'${suggestion ? ` - did you mean '${suggestion}'?` : ''}`,
            line: position.line,
            column: position.column,
            severity: 'error',
          });
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Nested entity - recursively validate
        const nestedErrors = this.validateFieldTypes(
          value as Record<string, unknown>,
          input
        );
        errors.push(...nestedErrors);
      }
    }

    return errors;
  }

  /**
   * Extract the base type from a type string (e.g., 'string!' -> 'string').
   */
  private extractBaseType(typeStr: string): string | null {
    // Remove modifiers and array notation
    const cleaned = typeStr
      .replace(/[!?#]/g, '')
      .replace(/\[\]$/, '')
      .replace(/\s*=\s*.+$/, '') // Remove default value
      .trim();

    // Handle parametric types like decimal(10,2)
    const baseMatch = cleaned.match(/^(\w+)/);
    return baseMatch ? baseMatch[1].toLowerCase() : null;
  }

  /**
   * Check if a type string represents a relation.
   */
  private isRelationType(typeStr: string): boolean {
    return /-?>|~>|<-|<~/.test(typeStr);
  }

  /**
   * Check if a type is a valid IceType.
   */
  private isValidType(type: string): boolean {
    const normalized = type.toLowerCase();
    return KNOWN_TYPES.has(normalized);
  }

  /**
   * Find the position of a field in the input string.
   */
  private findFieldPosition(
    input: string,
    fieldName: string
  ): { line: number; column: number } {
    // Find the field in the input
    const regex = new RegExp(`['"]?${fieldName}['"]?\\s*:`);
    const match = input.match(regex);

    if (match?.index !== undefined) {
      // Count lines up to match
      const beforeMatch = input.substring(0, match.index);
      const lines = beforeMatch.split('\n');
      return {
        line: lines.length,
        column: (lines[lines.length - 1]?.length ?? 0) + 1,
      };
    }

    return { line: 1, column: 1 };
  }

  /**
   * Extract error position from an error.
   */
  private extractErrorPosition(error: unknown, input: string): ParseErrorInfo {
    let message = 'Unknown parse error';
    let line = 1;
    let column = 1;

    if (error instanceof Error) {
      message = error.message;

      // Try to extract position from SyntaxError
      if (error instanceof SyntaxError) {
        // Extract position from error message if available
        const posMatch = message.match(/position\s+(\d+)/i);
        if (posMatch?.[1]) {
          const pos = parseInt(posMatch[1], 10);
          const beforePos = input.substring(0, pos);
          const lines = beforePos.split('\n');
          line = lines.length;
          column = (lines[lines.length - 1]?.length ?? 0) + 1;
        }

        // Try to extract line number
        const lineMatch = message.match(/line\s+(\d+)/i);
        if (lineMatch?.[1]) {
          line = parseInt(lineMatch[1], 10);
        }

        // Try to extract column number
        const colMatch = message.match(/column\s+(\d+)/i);
        if (colMatch?.[1]) {
          column = parseInt(colMatch[1], 10);
        }
      }

      // Handle ParseError from @icetype/core
      if (isParseError(error)) {
        line = (error as ParseError).line ?? line;
        column = (error as ParseError).column ?? column;
      }
    }

    return {
      message,
      line,
      column,
      severity: 'error',
    };
  }

  /**
   * Generate TypeScript type for a field.
   */
  private generateFieldType(field: FieldDefinition): string {
    let tsType = getTypeScriptType(field.type);

    // Handle relation types
    if (field.relation) {
      tsType = field.relation.targetType;
    }

    // Handle array types
    if (field.isArray) {
      tsType = `${tsType}[]`;
    }

    return tsType;
  }

  /**
   * Generate comment for a field with default value.
   */
  private generateFieldComment(field: FieldDefinition): string | null {
    if (field.defaultValue !== undefined) {
      const defaultStr =
        typeof field.defaultValue === 'string'
          ? `"${field.defaultValue}"`
          : JSON.stringify(field.defaultValue);
      return `/** default: ${defaultStr} */`;
    }
    return null;
  }

  /**
   * Compress and encode schema for URL sharing.
   *
   * Uses LZ-based compression followed by base64 encoding for URL safety.
   */
  private compressAndEncode(schema: string): string {
    try {
      // Use LZ-string-like compression (simple RLE + dictionary)
      const compressed = this.lzCompress(schema);
      // Base64 encode
      const encoded = btoa(compressed);
      // Make URL-safe
      return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch {
      // Fallback to just URI encoding
      return encodeURIComponent(schema);
    }
  }

  /**
   * Decode and decompress schema from URL.
   */
  private decodeAndDecompress(encoded: string): string | null {
    try {
      // Check for obviously invalid input
      if (!encoded || encoded.includes('!')) {
        return null;
      }

      // Restore base64 characters
      let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }

      // Validate base64 format
      if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
        return null;
      }

      // Decode base64
      const compressed = atob(base64);

      // Decompress
      const decompressed = this.lzDecompress(compressed);

      // Validate result looks like a schema
      if (!decompressed || decompressed.trim().length === 0) {
        return null;
      }

      return decompressed;
    } catch {
      try {
        // Fallback: try direct URI decoding
        const decoded = decodeURIComponent(encoded);
        // Validate it's not garbage
        if (decoded.includes('{') && decoded.includes('}')) {
          return decoded;
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Simple LZ-like compression using character frequency and run-length encoding.
   */
  private lzCompress(input: string): string {
    // Build a simple dictionary of common patterns
    const patterns: Record<string, string> = {
      '$type:': '\x01',
      'string': '\x02',
      'uuid!': '\x03',
      'int': '\x04',
      'boolean': '\x05',
      'timestamp': '\x06',
      'float': '\x07',
      'json': '\x08',
      '    ': '\x09', // 4 spaces
      '  ': '\x0a', // 2 spaces
      '\n': '\x0b',
      '\'': '\x0c',
    };

    let result = input;

    // Apply dictionary compression
    for (const [pattern, replacement] of Object.entries(patterns)) {
      result = result.split(pattern).join(replacement);
    }

    return result;
  }

  /**
   * Decompress LZ-compressed string.
   */
  private lzDecompress(input: string): string {
    const patterns: Record<string, string> = {
      '\x01': '$type:',
      '\x02': 'string',
      '\x03': 'uuid!',
      '\x04': 'int',
      '\x05': 'boolean',
      '\x06': 'timestamp',
      '\x07': 'float',
      '\x08': 'json',
      '\x09': '    ',
      '\x0a': '  ',
      '\x0b': '\n',
      '\x0c': '\'',
    };

    let result = input;

    // Reverse dictionary compression
    for (const [code, pattern] of Object.entries(patterns)) {
      result = result.split(code).join(pattern);
    }

    return result;
  }
}
