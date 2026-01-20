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
