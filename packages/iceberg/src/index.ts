/**
 * @icetype/iceberg
 *
 * IceType to Apache Iceberg metadata and Parquet schema generation.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { generateIcebergMetadata, generateParquetSchema } from '@icetype/iceberg';
 *
 * // Parse an IceType schema
 * const schema = parseSchema({
 *   $type: 'User',
 *   $partitionBy: ['tenantId'],
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 *   tenantId: 'string!',
 * });
 *
 * // Generate Iceberg table metadata
 * const icebergMetadata = generateIcebergMetadata(
 *   schema,
 *   's3://my-bucket/tables/users'
 * );
 *
 * // Generate Parquet schema
 * const parquetSchema = generateParquetSchema(schema);
 * ```
 *
 * @packageDocumentation
 */

// Re-export Iceberg types
export type {
  IcebergPrimitiveType,
  IcebergType,
  IcebergField,
  IcebergSchema,
  IcebergPartitionField,
  IcebergPartitionSpec,
  IcebergSortField,
  IcebergSortOrder,
  IcebergTableMetadata,
  IcebergSnapshot,
  IcebergSnapshotRef,
} from './types.js';

// Re-export Parquet types
export type {
  ParquetPrimitiveType,
  ParquetConvertedType,
  ParquetRepetition,
  ParquetLogicalType,
  ParquetField,
  ParquetSchema,
} from './types.js';

// Re-export Iceberg metadata generation
export {
  IcebergMetadataGenerator,
  createIcebergMetadataGenerator,
  generateIcebergMetadata,
} from './metadata.js';

// Re-export Parquet schema generation
export {
  ParquetSchemaGenerator,
  createParquetSchemaGenerator,
  generateParquetSchema,
  generateParquetSchemaString,
  documentToParquetRow,
} from './parquet.js';

// Re-export adapters
export {
  IcebergAdapter,
  createIcebergAdapter,
} from './adapter.js';

export {
  ParquetAdapter,
  createParquetAdapter,
  transformToParquetString,
} from './parquet-adapter.js';

// Re-export Iceberg schema evolution/migrations
export type {
  IcebergAddColumn,
  IcebergDropColumn,
  IcebergRenameColumn,
  IcebergUpdateType,
  IcebergMakeOptional,
  IcebergMakeRequired,
  IcebergOperation,
  IcebergSchemaUpdate,
} from './migrations.js';

export {
  IcebergMigrationGenerator,
  createIcebergMigrationGenerator,
  generateIcebergSchemaUpdate,
} from './migrations.js';

// Re-export projection schema generation
export {
  ProjectionSchemaGenerator,
  createProjectionSchemaGenerator,
  generateProjectionSchema,
} from './projection-generator.js';

// Re-export projection types
export type { ProjectionDefinition } from './projection-generator.js';

// Re-export GraphDL adapter functions
export {
  compileGraphToIceberg,
  compileEntityToIceberg,
} from './graphdl-adapter.js';

// Re-export GraphDL adapter types
export type {
  CompileGraphOptions,
  CompileEntityOptions,
} from './graphdl-adapter.js';
