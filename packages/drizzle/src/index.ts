/**
 * @icetype/drizzle
 *
 * IceType adapter for Drizzle ORM - generates Drizzle schema files from IceType schemas.
 *
 * This package transforms IceType schemas to Drizzle ORM schema files,
 * supporting PostgreSQL, MySQL, and SQLite dialects.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { DrizzleAdapter, transformToDrizzle } from '@icetype/drizzle';
 *
 * // Define an IceType schema
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   age: 'int?',
 *   createdAt: 'timestamp',
 * });
 *
 * // Option 1: Use the adapter directly
 * const adapter = new DrizzleAdapter();
 * const drizzleSchema = adapter.transform(schema, { dialect: 'pg' });
 * const code = adapter.serialize(drizzleSchema);
 *
 * // Option 2: Use the convenience function
 * const code = transformToDrizzle(schema, { dialect: 'pg' });
 *
 * console.log(code);
 * // Output:
 * // import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
 * //
 * // export const users = pgTable('users', {
 * //   id: uuid('id').primaryKey().notNull(),
 * //   email: varchar('email', { length: 255 }).notNull().unique(),
 * //   name: varchar('name', { length: 255 }),
 * //   age: integer('age'),
 * //   createdAt: timestamp('createdAt'),
 * // });
 * //
 * // export type Users = typeof users.$inferSelect;
 * // export type NewUsers = typeof users.$inferInsert;
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  DrizzleDialect,
  DrizzleColumn,
  DrizzleIndex,
  DrizzleTable,
  DrizzleSchema,
  DrizzleImport,
  DrizzleAdapterOptions,
  DrizzleTypeMapping,
  DrizzleTypeMappings,
} from './types.js';

// =============================================================================
// Adapter
// =============================================================================

export {
  DrizzleAdapter,
  createDrizzleAdapter,
  transformToDrizzle,
  generateDrizzleSchema,
  transformSchemasToDrizzle,
} from './adapter.js';

// =============================================================================
// Type Mappings
// =============================================================================

export {
  DRIZZLE_TYPE_MAPPINGS,
  getDrizzleType,
  getDrizzleImportPath,
  getTableFunction,
  isKnownDrizzleType,
  getRequiredTypeImports,
} from './mappings.js';

// =============================================================================
// Code Generation Utilities
// =============================================================================

export {
  toCamelCase,
  toSnakeCase,
  toPascalCase,
  escapeString,
  generateImports,
  collectImports,
  generateColumn,
  generateTable,
  generateSchemaCode,
  formatDefaultValue,
  validateTableName,
  validateColumnName,
} from './generator.js';

// =============================================================================
// Importer (Drizzle -> IceType)
// =============================================================================

export type {
  DrizzleImportOptions,
  ParsedDrizzleColumn,
  ParsedDrizzleTable,
} from './importer.js';

export {
  parseDrizzleSchema,
  parseDrizzleFile,
  parseRawTables,
  getIceTypeFromDrizzle,
  detectDialect,
  parseTypeArgs,
  parseObjectLiteral,
  parseMethodChain,
  parseColumn,
  parseColumnsBody,
  dialectFromTableFunc,
  parseDrizzleTables,
  columnToFieldDefinition,
  tableToIceTypeSchema,
} from './importer.js';
