/**
 * Drizzle Schema Generator
 *
 * Generates TypeScript code for Drizzle ORM schema files.
 *
 * @packageDocumentation
 */

import type {
  DrizzleSchema,
  DrizzleTable,
  DrizzleColumn,
  DrizzleImport,
  DrizzleDialect,
} from './types.js';

import { getDrizzleImportPath, getTableFunction } from './mappings.js';

// =============================================================================
// Code Generation Helpers
// =============================================================================

/**
 * Convert a string to camelCase.
 *
 * @param str - The string to convert
 * @returns camelCase version of the string
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^(.)/, (_, char: string) => char.toLowerCase());
}

/**
 * Convert a string to snake_case.
 *
 * @param str - The string to convert
 * @returns snake_case version of the string
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

/**
 * Convert a string to PascalCase.
 *
 * @param str - The string to convert
 * @returns PascalCase version of the string
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Escape a string for use in TypeScript code.
 *
 * @param str - The string to escape
 * @returns Escaped string with quotes
 */
export function escapeString(str: string): string {
  return `'${str.replace(/'/g, "\\'")}'`;
}

// =============================================================================
// Import Generation
// =============================================================================

/**
 * Generate import statements for a Drizzle schema.
 *
 * @param schema - The Drizzle schema
 * @returns Generated import code
 */
export function generateImports(schema: DrizzleSchema): string {
  const lines: string[] = [];

  for (const imp of schema.imports) {
    const names = imp.names.sort().join(', ');
    lines.push(`import { ${names} } from '${imp.from}';`);
  }

  return lines.join('\n');
}

/**
 * Collect all required imports for a schema.
 *
 * @param tables - Table definitions
 * @param dialect - Target dialect
 * @returns Array of import definitions
 */
export function collectImports(
  tables: DrizzleTable[],
  dialect: DrizzleDialect
): DrizzleImport[] {
  const typeSet = new Set<string>();

  // Always need the table function
  typeSet.add(getTableFunction(dialect));

  // Collect all type functions used
  for (const table of tables) {
    for (const column of table.columns) {
      typeSet.add(column.type);
    }
  }

  return [
    {
      from: getDrizzleImportPath(dialect),
      names: Array.from(typeSet).sort(),
    },
  ];
}

// =============================================================================
// Column Generation
// =============================================================================

/**
 * Generate the type call parameters for a column.
 *
 * @param column - The column definition
 * @param dialect - Target dialect
 * @returns Type parameters string
 */
function generateTypeParams(column: DrizzleColumn, dialect: DrizzleDialect): string {
  const params: string[] = [];

  // Always add the column name
  params.push(escapeString(column.originalName));

  // Add type-specific parameters
  if (column.typeParams) {
    if (column.typeParams['length'] !== undefined) {
      params.push(`{ length: ${column.typeParams['length']} }`);
    } else if (column.typeParams['precision'] !== undefined) {
      const precision = column.typeParams['precision'];
      const scale = column.typeParams['scale'] ?? 0;
      params.push(`{ precision: ${precision}, scale: ${scale} }`);
    } else if (column.typeParams['withTimezone'] !== undefined && dialect === 'pg') {
      params.push(`{ withTimezone: ${column.typeParams['withTimezone']} }`);
    } else if (column.typeParams['mode'] !== undefined) {
      params.push(`{ mode: '${column.typeParams['mode']}' }`);
    }
  }

  // Handle UUID length for MySQL
  if (column.type === 'varchar' && column.originalName.toLowerCase().includes('uuid')) {
    if (!column.typeParams?.['length'] && dialect === 'mysql') {
      // UUID needs 36 characters
      return `${escapeString(column.originalName)}, { length: 36 }`;
    }
  }

  return params.join(', ');
}

/**
 * Generate a column definition.
 *
 * @param column - The column definition
 * @param dialect - Target dialect
 * @returns Generated column code
 */
export function generateColumn(column: DrizzleColumn, dialect: DrizzleDialect): string {
  const parts: string[] = [];

  // Type function call
  const typeParams = generateTypeParams(column, dialect);
  parts.push(`${column.type}(${typeParams})`);

  // Primary key
  if (column.primaryKey) {
    parts.push('.primaryKey()');
  }

  // Not null
  if (!column.nullable) {
    parts.push('.notNull()');
  }

  // Unique
  if (column.unique && !column.primaryKey) {
    parts.push('.unique()');
  }

  // Default value
  if (column.defaultValue !== undefined) {
    parts.push(`.default(${column.defaultValue})`);
  }

  // Array type (PostgreSQL only)
  if (column.isArray && dialect === 'pg') {
    parts.push('.array()');
  }

  return parts.join('');
}

// =============================================================================
// Table Generation
// =============================================================================

/**
 * Generate a table definition.
 *
 * @param table - The table definition
 * @param dialect - Target dialect
 * @returns Generated table code
 */
export function generateTable(table: DrizzleTable, dialect: DrizzleDialect): string {
  const tableFunc = getTableFunction(dialect);
  const lines: string[] = [];

  // Table declaration
  lines.push(`export const ${table.exportName} = ${tableFunc}(${escapeString(table.tableName)}, {`);

  // Column definitions
  for (const column of table.columns) {
    const columnCode = generateColumn(column, dialect);
    lines.push(`  ${column.name}: ${columnCode},`);
  }

  lines.push('});');

  // Generate type export
  lines.push('');
  lines.push(`export type ${toPascalCase(table.exportName)} = typeof ${table.exportName}.$inferSelect;`);
  lines.push(`export type New${toPascalCase(table.exportName)} = typeof ${table.exportName}.$inferInsert;`);

  return lines.join('\n');
}

// =============================================================================
// Schema Generation
// =============================================================================

/**
 * Generate a complete Drizzle schema file.
 *
 * @param schema - The Drizzle schema
 * @returns Generated TypeScript code
 */
export function generateSchemaCode(schema: DrizzleSchema): string {
  const sections: string[] = [];

  // Header comment
  sections.push('/**');
  sections.push(' * Drizzle ORM Schema');
  sections.push(' * ');
  sections.push(' * Generated by @icetype/drizzle');
  sections.push(' * ');
  sections.push(` * Dialect: ${schema.dialect}`);
  sections.push(' */');
  sections.push('');

  // Imports
  sections.push(generateImports(schema));
  sections.push('');

  // Tables
  for (let i = 0; i < schema.tables.length; i++) {
    const table = schema.tables[i];
    if (table) {
      sections.push(generateTable(table, schema.dialect));
      if (i < schema.tables.length - 1) {
        sections.push('');
      }
    }
  }

  return sections.join('\n');
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a default value for code generation.
 *
 * @param value - The default value
 * @param type - The column type
 * @returns Formatted default value string
 */
export function formatDefaultValue(value: unknown, _type: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  // String values
  if (typeof value === 'string') {
    return escapeString(value);
  }

  // Boolean values
  if (typeof value === 'boolean') {
    return value.toString();
  }

  // Numeric values
  if (typeof value === 'number') {
    return value.toString();
  }

  // Special SQL functions
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'now()' || lower === 'current_timestamp') {
      return 'sql`now()`';
    }
    if (lower === 'gen_random_uuid()' || lower === 'uuid_generate_v4()') {
      return 'sql`gen_random_uuid()`';
    }
  }

  // JSON values
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return undefined;
}

/**
 * Validate table name for Drizzle.
 *
 * @param name - The table name
 * @returns Validated table name
 */
export function validateTableName(name: string): string {
  // Remove invalid characters
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(cleaned)) {
    return `t_${cleaned}`;
  }

  return cleaned;
}

/**
 * Validate column name for Drizzle.
 *
 * @param name - The column name
 * @returns Validated column name
 */
export function validateColumnName(name: string): string {
  // Remove invalid characters but keep letters, numbers, and underscores
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(cleaned)) {
    return `c_${cleaned}`;
  }

  return cleaned;
}
