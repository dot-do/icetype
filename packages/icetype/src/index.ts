/**
 * IceType - Type-safe schema language for data lakes and databases
 *
 * IceType is a concise schema language that compiles to multiple backends
 * including Apache Iceberg, Parquet, ClickHouse, DuckDB, and more.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { parseSchema, validateSchema, inferType } from 'icetype';
 *
 * // Define a schema using IceType syntax
 * const userSchema = parseSchema({
 *   $type: 'User',
 *   $partitionBy: ['tenantId'],
 *   $index: [['email'], ['createdAt']],
 *
 *   id: 'uuid!',           // Required UUID
 *   email: 'string#',      // Indexed string
 *   name: 'string',        // Regular string
 *   age: 'int?',           // Optional integer
 *   status: 'string = "active"',  // Default value
 *   posts: '<- Post.author[]',    // Backward relation
 * });
 *
 * // Validate the schema
 * const result = validateSchema(userSchema);
 * ```
 *
 * ## IceType Syntax
 *
 * ### Field Modifiers
 * - `!` - Required/unique (e.g., `uuid!`)
 * - `#` - Indexed (e.g., `string#`)
 * - `?` - Optional/nullable (e.g., `int?`)
 * - `[]` - Array type (e.g., `string[]`)
 *
 * ### Primitive Types
 * - `string`, `text` - String values
 * - `int`, `long`, `bigint` - Integer values
 * - `float`, `double` - Floating point values
 * - `bool`, `boolean` - Boolean values
 * - `uuid` - UUID strings
 * - `timestamp`, `date`, `time` - Temporal values
 * - `json` - Arbitrary JSON
 * - `binary` - Binary data
 * - `decimal(precision,scale)` - Decimal numbers
 *
 * ### Relation Operators
 * - `->` - Forward relation (direct foreign key)
 * - `~>` - Fuzzy forward (AI-powered matching)
 * - `<-` - Backward relation (reverse reference)
 * - `<~` - Fuzzy backward
 *
 * ### Directives
 * - `$type` - Schema name
 * - `$partitionBy` - Partition fields
 * - `$index` - Composite indexes
 * - `$fts` - Full-text search fields
 * - `$vector` - Vector index fields
 *
 * @packageDocumentation
 * @module icetype
 */

// Re-export everything from @icetype/core
export * from '@icetype/core';

// Re-export Iceberg/Parquet generation from @icetype/iceberg
export {
  // Iceberg types
  type IcebergPrimitiveType,
  type IcebergType,
  type IcebergField,
  type IcebergSchema,
  type IcebergPartitionField,
  type IcebergPartitionSpec,
  type IcebergSortField,
  type IcebergSortOrder,
  type IcebergTableMetadata,
  type IcebergSnapshot,
  type IcebergSnapshotRef,

  // Parquet types
  type ParquetPrimitiveType,
  type ParquetConvertedType,
  type ParquetRepetition,
  type ParquetLogicalType,
  type ParquetField,
  type ParquetSchema,

  // Iceberg generation
  IcebergMetadataGenerator,
  createIcebergMetadataGenerator,
  generateIcebergMetadata,

  // Parquet generation
  ParquetSchemaGenerator,
  createParquetSchemaGenerator,
  generateParquetSchema,
  generateParquetSchemaString,
  documentToParquetRow,
} from '@icetype/iceberg';

// Re-export PostgreSQL adapter from @icetype/postgres
export {
  // PostgreSQL types
  type PostgresType,
  type PostgresColumn,
  type PostgresTableOptions,
  type PostgresDDL,
  type PostgresTypeMapping,
  type PostgresAdapterOptions,
  ICETYPE_TO_POSTGRES,

  // PostgreSQL DDL helpers
  mapIceTypeToPostgres,
  getPostgresTypeString,
  fieldToPostgresColumn,
  generateSystemColumns as generatePostgresSystemColumns,
  escapeIdentifier as escapePostgresIdentifier,
  serializeColumn as serializePostgresColumn,
  serializeDDL as serializePostgresDDL,
  generateIndexStatements as generatePostgresIndexStatements,

  // PostgreSQL adapter
  PostgresAdapter,
  createPostgresAdapter,
  transformToPostgresDDL,
  generatePostgresDDL,
} from '@icetype/postgres';

// Re-export MySQL adapter from @icetype/mysql
export {
  // MySQL types
  type MySQLType,
  type MySQLColumn,
  type MySQLTableOptions,
  type MySQLDDL,
  type MySQLTypeMapping,
  type MySQLAdapterOptions,
  ICETYPE_TO_MYSQL,

  // MySQL DDL helpers
  mapIceTypeToMySQL,
  getMySQLTypeString,
  fieldToMySQLColumn,
  formatDefaultValue as formatMySQLDefaultValue,
  generateSystemColumns as generateMySQLSystemColumns,
  escapeIdentifier as escapeMySQLIdentifier,
  serializeColumn as serializeMySQLColumn,
  serializeDDL as serializeMySQLDDL,
  generateIndexStatements as generateMySQLIndexStatements,

  // MySQL adapter
  MySQLAdapter,
  createMySQLAdapter,
  transformToMySQLDDL,
  generateMySQLDDL,
} from '@icetype/mysql';

// Re-export SQLite adapter from @icetype/sqlite
export {
  // SQLite types
  type SQLiteType,
  type SQLiteColumn,
  type SQLiteTableOptions,
  type SQLiteDDL,
  type SQLiteTypeMapping,
  type SQLiteAdapterOptions,
  ICETYPE_TO_SQLITE,

  // SQLite DDL helpers
  mapIceTypeToSQLite,
  getSQLiteTypeString,
  fieldToSQLiteColumn,
  formatDefaultValue as formatSQLiteDefaultValue,
  generateSystemColumns as generateSQLiteSystemColumns,
  escapeIdentifier as escapeSQLiteIdentifier,
  serializeColumn as serializeSQLiteColumn,
  serializeDDL as serializeSQLiteDDL,
  generateIndexStatements as generateSQLiteIndexStatements,

  // SQLite adapter
  SQLiteAdapter,
  createSQLiteAdapter,
  transformToSQLiteDDL,
  generateSQLiteDDL,
} from '@icetype/sqlite';

// Re-export Drizzle adapter from @icetype/drizzle
export {
  // Drizzle types
  type DrizzleDialect,
  type DrizzleColumn,
  type DrizzleIndex,
  type DrizzleTable,
  type DrizzleSchema,
  type DrizzleImport,
  type DrizzleAdapterOptions,
  type DrizzleTypeMapping,
  type DrizzleTypeMappings,
  type DrizzleImportOptions,
  type ParsedDrizzleColumn,
  type ParsedDrizzleTable,

  // Drizzle adapter
  DrizzleAdapter,
  createDrizzleAdapter,
  transformToDrizzle,
  generateDrizzleSchema,
  transformSchemasToDrizzle,

  // Drizzle type mappings
  DRIZZLE_TYPE_MAPPINGS,
  getDrizzleType,
  getDrizzleImportPath,
  getTableFunction,
  isKnownDrizzleType,
  getRequiredTypeImports,

  // Drizzle code generation utilities
  toCamelCase,
  toSnakeCase,
  toPascalCase,
  escapeString as escapeDrizzleString,
  generateImports as generateDrizzleImports,
  collectImports as collectDrizzleImports,
  generateColumn as generateDrizzleColumn,
  generateTable as generateDrizzleTable,
  generateSchemaCode as generateDrizzleSchemaCode,
  formatDefaultValue as formatDrizzleDefaultValue,
  validateTableName,
  validateColumnName,

  // Drizzle importer (Drizzle -> IceType)
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
} from '@icetype/drizzle';

// Re-export Prisma adapter from @icetype/prisma
export {
  // Prisma types
  type PrismaScalarType,
  type PrismaAttribute,
  type PrismaField,
  type PrismaModel,
  type PrismaEnum,
  type ParsedPrismaSchema,
  type IceTypeFieldDefinition,
  type IceTypeSchemaDefinition,
  type PrismaImportOptions,
  type PrismaExportOptions,
  type PrismaProvider,
  type PrismaDatasource,
  type PrismaGenerator,
  type PrismaSchemaOutput,
  type PrismaModelOutput,
  type PrismaFieldOutput,
  type PrismaEnumOutput,
  type TypeMappingConfig,
  type IceTypeToPrismaMappingConfig,

  // Prisma constants
  PRISMA_TYPE_MAPPINGS,
  PRISMA_TO_ICETYPE_MAP,
  ICETYPE_TO_PRISMA_MAPPINGS,
  ICETYPE_TO_PRISMA_MAP,
  ICETYPE_DEFAULT_GENERATORS,

  // Prisma import functions (Prisma -> IceType)
  parsePrismaSchema,
  parsePrismaFile,
  parsePrismaSchemaToAst,
  convertPrismaModel,

  // Prisma export functions (IceType -> Prisma)
  mapIceTypeToPrisma,
  getDefaultGenerator,
  fieldToPrismaField,
  formatPrismaDefault,
  schemaToPrismaModel,
  generateDatasourceBlock,
  generateGeneratorBlock,
  serializePrismaField,
  serializePrismaModel,
  serializePrismaEnum,
  transformToPrisma,
  generatePrismaSchema,
  generatePrismaSchemaOutput,

  // Prisma adapter
  PrismaAdapter,
  createPrismaAdapter,
} from '@icetype/prisma';
