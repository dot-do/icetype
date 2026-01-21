/**
 * Drizzle Schema Importer
 *
 * Parses Drizzle ORM schema files and converts them to IceType schemas.
 *
 * This module provides functionality to:
 * - Parse TypeScript files containing pgTable/mysqlTable/sqliteTable definitions
 * - Extract table names, columns, types, and constraints
 * - Convert to IceTypeSchema format
 *
 * @packageDocumentation
 */

import type {
  IceTypeSchema,
  FieldDefinition,
  FieldModifier,
  SchemaDirectives,
  IndexDirective,
} from '@icetype/core';
import type { DrizzleDialect } from './types.js';
import { toCamelCase, toPascalCase } from './generator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for parsing Drizzle schemas.
 */
export interface DrizzleImportOptions {
  /**
   * Inferred dialect from imports (automatically detected if not specified).
   */
  dialect?: DrizzleDialect;

  /**
   * Whether to convert snake_case column names to camelCase field names.
   * @default true
   */
  camelCase?: boolean;
}

/**
 * Parsed column information from Drizzle schema.
 */
export interface ParsedDrizzleColumn {
  /** Column name */
  name: string;
  /** Drizzle type function name */
  type: string;
  /** Type parameters (length, precision, scale) */
  typeParams?: Record<string, unknown>;
  /** Whether the column has notNull() */
  notNull: boolean;
  /** Whether the column has primaryKey() */
  primaryKey: boolean;
  /** Whether the column has unique() */
  unique: boolean;
  /** Default value expression */
  defaultValue?: string;
  /** Whether this is an array column */
  isArray: boolean;
  /** References another table */
  references?: string;
}

/**
 * Parsed table information from Drizzle schema.
 */
export interface ParsedDrizzleTable {
  /** Variable name (export name) */
  variableName: string;
  /** Table name in database */
  tableName: string;
  /** Dialect detected from table function */
  dialect: DrizzleDialect;
  /** Parsed columns */
  columns: ParsedDrizzleColumn[];
}

// =============================================================================
// Reverse Type Mappings (Drizzle -> IceType)
// =============================================================================

/**
 * Mapping from Drizzle type functions to IceType types.
 */
const DRIZZLE_TO_ICETYPE: Record<string, string> = {
  // String types
  varchar: 'string',
  text: 'text',
  char: 'string',

  // Integer types
  integer: 'int',
  int: 'int',
  smallint: 'int',
  bigint: 'long',
  serial: 'int',
  bigserial: 'long',

  // Floating point types
  real: 'float',
  float: 'float',
  doublePrecision: 'double',
  double: 'double',
  decimal: 'decimal',
  numeric: 'decimal',

  // Boolean
  boolean: 'bool',

  // UUID
  uuid: 'uuid',

  // Date/Time
  timestamp: 'timestamp',
  date: 'date',
  time: 'time',
  interval: 'string',

  // JSON
  json: 'json',
  jsonb: 'json',

  // Binary
  bytea: 'binary',
  blob: 'binary',
};

/**
 * Get IceType from a Drizzle type function name.
 *
 * @param drizzleType - The Drizzle type function name
 * @returns The corresponding IceType
 */
export function getIceTypeFromDrizzle(drizzleType: string): string {
  const normalized = drizzleType.toLowerCase();

  // Check direct mapping
  if (DRIZZLE_TO_ICETYPE[drizzleType]) {
    return DRIZZLE_TO_ICETYPE[drizzleType]!;
  }

  // Check normalized mapping
  for (const [key, value] of Object.entries(DRIZZLE_TO_ICETYPE)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }

  // Default to string for unknown types
  return 'string';
}

// =============================================================================
// Regex Patterns
// =============================================================================

/**
 * Pattern to extract chained method calls.
 */
const METHOD_CHAIN_PATTERN = /\.(\w+)\s*\(([^)]*)\)/g;

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Detect the dialect from import statements.
 *
 * @param code - The TypeScript code
 * @returns Detected dialect or undefined
 */
export function detectDialect(code: string): DrizzleDialect | undefined {
  // Create a new regex to avoid global state issues
  const pattern = /import\s*\{[^}]*\}\s*from\s*['"`]drizzle-orm\/(pg|mysql|sqlite)-core['"`]/;
  const match = pattern.exec(code);
  if (match) {
    const dialect = match[1];
    if (dialect === 'pg' || dialect === 'mysql' || dialect === 'sqlite') {
      return dialect;
    }
  }
  return undefined;
}

/**
 * Parse type arguments from a Drizzle type function call.
 *
 * @param args - The arguments string
 * @returns Parsed type parameters
 */
export function parseTypeArgs(args: string): { columnName?: string; params?: Record<string, unknown> } {
  const result: { columnName?: string; params?: Record<string, unknown> } = {};

  if (!args.trim()) {
    return result;
  }

  // Split by comma, but respect object literals
  const parts: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (const char of args) {
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;
    if (char === ',' && braceDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  // First part is typically the column name (quoted string)
  if (parts[0]) {
    const nameMatch = parts[0].match(/['"`]([^'"`]+)['"`]/);
    if (nameMatch) {
      result.columnName = nameMatch[1];
    }
  }

  // Second part is typically the params object
  if (parts[1]) {
    const paramsStr = parts[1].trim();
    if (paramsStr.startsWith('{')) {
      result.params = parseObjectLiteral(paramsStr);
    }
  }

  return result;
}

/**
 * Parse a simple object literal.
 *
 * @param str - The object literal string
 * @returns Parsed object
 */
export function parseObjectLiteral(str: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Remove braces
  const inner = str.slice(1, -1).trim();
  if (!inner) return result;

  // Parse key-value pairs
  const kvPattern = /(\w+)\s*:\s*(['"`]([^'"`]*?)['"`]|true|false|\d+(?:\.\d+)?)/g;
  let match;

  while ((match = kvPattern.exec(inner)) !== null) {
    const key = match[1]!;
    const value = match[2]!;

    if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (value.match(/^\d+(?:\.\d+)?$/)) {
      result[key] = parseFloat(value);
    } else {
      // String value - extract from quotes
      const strMatch = value.match(/['"`]([^'"`]*?)['"`]/);
      if (strMatch) {
        result[key] = strMatch[1];
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Parse method chain from a column definition.
 *
 * @param chain - The method chain string
 * @returns Parsed method information
 */
export function parseMethodChain(chain: string): {
  notNull: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
  isArray: boolean;
  references?: string;
} {
  const result = {
    notNull: false,
    primaryKey: false,
    unique: false,
    defaultValue: undefined as string | undefined,
    isArray: false,
    references: undefined as string | undefined,
  };

  let match;
  const pattern = new RegExp(METHOD_CHAIN_PATTERN);

  while ((match = pattern.exec(chain)) !== null) {
    const method = match[1]!;
    const args = match[2]?.trim() || '';

    switch (method) {
      case 'notNull':
        result.notNull = true;
        break;
      case 'primaryKey':
        result.primaryKey = true;
        // Primary keys are implicitly not null
        result.notNull = true;
        break;
      case 'unique':
        result.unique = true;
        break;
      case 'default':
        result.defaultValue = args;
        break;
      case 'array':
        result.isArray = true;
        break;
      case 'references':
        result.references = args;
        break;
    }
  }

  return result;
}

/**
 * Parse a single column definition.
 *
 * @param columnName - The column variable name
 * @param typeFunc - The type function name
 * @param typeArgs - The type function arguments
 * @param methodChain - The chained methods
 * @returns Parsed column definition
 */
export function parseColumn(
  columnName: string,
  typeFunc: string,
  typeArgs: string,
  methodChain: string
): ParsedDrizzleColumn {
  const { columnName: dbColumnName, params } = parseTypeArgs(typeArgs);
  const chainInfo = parseMethodChain(methodChain);

  return {
    name: dbColumnName || columnName,
    type: typeFunc,
    typeParams: params,
    notNull: chainInfo.notNull,
    primaryKey: chainInfo.primaryKey,
    unique: chainInfo.unique,
    defaultValue: chainInfo.defaultValue,
    isArray: chainInfo.isArray,
    references: chainInfo.references,
  };
}

/**
 * Parse columns from a table body.
 *
 * @param body - The columns body string
 * @returns Array of parsed columns
 */
export function parseColumnsBody(body: string): ParsedDrizzleColumn[] {
  const columns: ParsedDrizzleColumn[] = [];

  // Create a new pattern instance with global flag for multiple matches
  const pattern = /(\w+)\s*:\s*(\w+)\s*\(([^)]*)\)((?:\s*\.\s*\w+\s*\([^)]*\))*)/g;
  let match;

  while ((match = pattern.exec(body)) !== null) {
    const columnName = match[1]!;
    const typeFunc = match[2]!;
    const typeArgs = match[3] || '';
    const methodChain = match[4] || '';

    columns.push(parseColumn(columnName, typeFunc, typeArgs, methodChain));
  }

  return columns;
}

/**
 * Detect dialect from table function name.
 *
 * @param tableFunc - The table function name
 * @returns The dialect
 */
export function dialectFromTableFunc(tableFunc: string): DrizzleDialect {
  switch (tableFunc) {
    case 'pgTable':
      return 'pg';
    case 'mysqlTable':
      return 'mysql';
    case 'sqliteTable':
      return 'sqlite';
    default:
      return 'pg';
  }
}

/**
 * Extract content between balanced braces starting at a given position.
 *
 * @param code - The source code
 * @param startPos - Position of the opening brace
 * @returns The content between braces (excluding braces) and the end position
 */
function extractBalancedBraces(code: string, startPos: number): { content: string; endPos: number } | null {
  if (code[startPos] !== '{') return null;

  let depth = 1;
  let pos = startPos + 1;

  while (pos < code.length && depth > 0) {
    const char = code[pos];
    if (char === '{') depth++;
    else if (char === '}') depth--;
    pos++;
  }

  if (depth !== 0) return null;

  return {
    content: code.slice(startPos + 1, pos - 1),
    endPos: pos,
  };
}

/**
 * Parse all tables from Drizzle schema code.
 *
 * @param code - The TypeScript code
 * @returns Array of parsed tables
 */
export function parseDrizzleTables(code: string): ParsedDrizzleTable[] {
  const tables: ParsedDrizzleTable[] = [];

  // Pattern to find table declarations - capture up to the opening brace of the columns
  const tableStartPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(pgTable|mysqlTable|sqliteTable)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g;

  let match;
  while ((match = tableStartPattern.exec(code)) !== null) {
    const variableName = match[1]!;
    const tableFunc = match[2]!;
    const tableName = match[3]!;

    // Find the position of the opening brace for columns
    const braceStartPos = match.index + match[0].length - 1;

    // Extract balanced braces content
    const braceContent = extractBalancedBraces(code, braceStartPos);
    if (!braceContent) continue;

    const columnsBody = braceContent.content;
    const dialect = dialectFromTableFunc(tableFunc);
    const columns = parseColumnsBody(columnsBody);

    tables.push({
      variableName,
      tableName,
      dialect,
      columns,
    });
  }

  return tables;
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert a parsed Drizzle column to an IceType field definition.
 *
 * @param column - The parsed column
 * @param options - Import options
 * @returns The field definition
 */
export function columnToFieldDefinition(
  column: ParsedDrizzleColumn,
  options: DrizzleImportOptions = {}
): FieldDefinition {
  const useCamelCase = options.camelCase ?? true;
  const fieldName = useCamelCase ? toCamelCase(column.name) : column.name;

  // Get the base IceType
  let iceType = getIceTypeFromDrizzle(column.type);

  // Handle type parameters
  let length: number | undefined;
  let precision: number | undefined;
  let scale: number | undefined;

  if (column.typeParams) {
    if (column.typeParams['length'] !== undefined) {
      length = column.typeParams['length'] as number;
    }
    if (column.typeParams['precision'] !== undefined) {
      precision = column.typeParams['precision'] as number;
      scale = (column.typeParams['scale'] as number) ?? 0;
    }
  }

  // Determine modifier
  let modifier: FieldModifier = '';
  if (column.primaryKey || column.notNull) {
    modifier = '!';
  } else if (!column.notNull) {
    modifier = '?';
  }

  // Handle unique constraint (overrides required modifier for unique fields)
  if (column.unique) {
    modifier = '#';
  }

  // Parse default value
  let defaultValue: unknown;
  if (column.defaultValue !== undefined) {
    // Try to parse the default value
    const trimmed = column.defaultValue.trim();
    if (trimmed === 'true') {
      defaultValue = true;
    } else if (trimmed === 'false') {
      defaultValue = false;
    } else if (!isNaN(Number(trimmed))) {
      defaultValue = Number(trimmed);
    } else if (trimmed.startsWith("'") || trimmed.startsWith('"')) {
      // String default
      defaultValue = trimmed.slice(1, -1);
    } else {
      // SQL expression or complex default
      defaultValue = trimmed;
    }
  }

  return {
    name: fieldName,
    type: iceType,
    modifier,
    isArray: column.isArray,
    isOptional: !column.notNull && !column.primaryKey,
    isUnique: column.unique || column.primaryKey,
    isIndexed: column.unique || column.primaryKey,
    defaultValue,
    precision,
    scale,
    length,
  };
}

/**
 * Convert a parsed Drizzle table to an IceType schema.
 *
 * @param table - The parsed table
 * @param options - Import options
 * @returns The IceType schema
 */
export function tableToIceTypeSchema(
  table: ParsedDrizzleTable,
  options: DrizzleImportOptions = {}
): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  const indexDirectives: IndexDirective[] = [];

  // Convert columns to fields
  for (const column of table.columns) {
    const fieldDef = columnToFieldDefinition(column, options);
    fields.set(fieldDef.name, fieldDef);

    // Add index directive for indexed columns
    if (column.unique && !column.primaryKey) {
      indexDirectives.push({
        fields: [fieldDef.name],
        unique: true,
      });
    }
  }

  // Build directives
  const directives: SchemaDirectives = {};
  if (indexDirectives.length > 0) {
    directives.index = indexDirectives;
  }

  // Derive schema name from table name (PascalCase singular)
  const schemaName = toPascalCase(singularize(table.tableName));

  const now = Date.now();

  return {
    name: schemaName,
    fields,
    directives,
    relations: new Map(),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Simple singularization helper.
 *
 * @param word - The word to singularize
 * @returns Singularized word
 */
function singularize(word: string): string {
  // Handle common patterns
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('es') && (word.endsWith('sses') || word.endsWith('xes') || word.endsWith('ches') || word.endsWith('shes'))) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

// =============================================================================
// Main API Functions
// =============================================================================

/**
 * Parse Drizzle schema code and convert to IceType schemas.
 *
 * @param code - The TypeScript code containing Drizzle schema definitions
 * @param options - Import options
 * @returns Array of IceType schemas
 *
 * @example
 * ```typescript
 * import { parseDrizzleSchema } from '@icetype/drizzle';
 *
 * const code = `
 *   import { pgTable, varchar, uuid, integer, timestamp } from 'drizzle-orm/pg-core';
 *
 *   export const users = pgTable('users', {
 *     id: uuid('id').primaryKey().notNull(),
 *     email: varchar('email', { length: 255 }).notNull().unique(),
 *     name: varchar('name', { length: 255 }),
 *     age: integer('age'),
 *     createdAt: timestamp('created_at'),
 *   });
 * `;
 *
 * const schemas = parseDrizzleSchema(code);
 * console.log(schemas[0].name); // 'User'
 * console.log(schemas[0].fields.get('email')); // { name: 'email', type: 'string', ... }
 * ```
 */
export function parseDrizzleSchema(
  code: string,
  options: DrizzleImportOptions = {}
): IceTypeSchema[] {
  const tables = parseDrizzleTables(code);

  // Detect dialect from imports if not specified
  if (!options.dialect) {
    options.dialect = detectDialect(code);
  }

  return tables.map(table => tableToIceTypeSchema(table, options));
}

/**
 * Parse a Drizzle schema file and convert to IceType schemas.
 *
 * @param filePath - Path to the TypeScript file
 * @param options - Import options
 * @returns Promise resolving to array of IceType schemas
 *
 * @example
 * ```typescript
 * import { parseDrizzleFile } from '@icetype/drizzle';
 *
 * const schemas = await parseDrizzleFile('./schema.ts');
 * for (const schema of schemas) {
 *   console.log(`Found table: ${schema.name}`);
 * }
 * ```
 */
export async function parseDrizzleFile(
  filePath: string,
  options: DrizzleImportOptions = {}
): Promise<IceTypeSchema[]> {
  // Dynamic import for Node.js fs module
  const { readFile } = await import('node:fs/promises');
  const code = await readFile(filePath, 'utf-8');
  return parseDrizzleSchema(code, options);
}

/**
 * Parse raw table definitions (helper for testing).
 *
 * @param code - The code containing table definitions
 * @returns Array of parsed tables
 */
export function parseRawTables(code: string): ParsedDrizzleTable[] {
  return parseDrizzleTables(code);
}
