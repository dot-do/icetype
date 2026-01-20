/**
 * Apache Iceberg type definitions
 *
 * @packageDocumentation
 */

// =============================================================================
// Iceberg Types
// =============================================================================

/**
 * Iceberg primitive type names
 * @see https://iceberg.apache.org/spec/#primitive-types
 */
export type IcebergPrimitiveType =
  | 'boolean'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'decimal'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'timestamptz'
  | 'string'
  | 'uuid'
  | 'fixed'
  | 'binary';

/** Iceberg type definition */
export interface IcebergType {
  type: IcebergPrimitiveType | 'list' | 'map' | 'struct';
  precision?: number;
  scale?: number;
  length?: number;
  elementType?: IcebergType;
  keyType?: IcebergType;
  valueType?: IcebergType;
  fields?: IcebergField[];
}

/** Iceberg field definition */
export interface IcebergField {
  id: number;
  name: string;
  required: boolean;
  type: IcebergType;
  doc?: string;
  initialDefault?: unknown;
  writeDefault?: unknown;
}

/** Iceberg schema definition */
export interface IcebergSchema {
  type: 'struct';
  schemaId: number;
  identifierFieldIds: number[];
  fields: IcebergField[];
}

/** Iceberg partition field */
export interface IcebergPartitionField {
  sourceId: number;
  fieldId: number;
  name: string;
  transform: 'identity' | 'bucket' | 'truncate' | 'year' | 'month' | 'day' | 'hour' | 'void';
  transformArg?: number;
}

/** Iceberg partition spec */
export interface IcebergPartitionSpec {
  specId: number;
  fields: IcebergPartitionField[];
}

/** Iceberg sort field */
export interface IcebergSortField {
  transform: string;
  sourceId: number;
  direction: 'asc' | 'desc';
  nullOrder: 'nulls-first' | 'nulls-last';
}

/** Iceberg sort order */
export interface IcebergSortOrder {
  orderId: number;
  fields: IcebergSortField[];
}

/** Iceberg table metadata */
export interface IcebergTableMetadata {
  formatVersion: 1 | 2;
  tableUuid: string;
  location: string;
  lastSequenceNumber: number;
  lastUpdatedMs: number;
  lastColumnId: number;
  currentSchemaId: number;
  schemas: IcebergSchema[];
  defaultSpecId: number;
  partitionSpecs: IcebergPartitionSpec[];
  lastPartitionId: number;
  defaultSortOrderId: number;
  sortOrders: IcebergSortOrder[];
  properties: Record<string, string>;
  currentSnapshotId?: number;
  snapshots?: IcebergSnapshot[];
  snapshotLog?: IcebergSnapshotRef[];
  refs?: Record<string, IcebergSnapshotRef>;
}

/** Iceberg snapshot */
export interface IcebergSnapshot {
  snapshotId: number;
  parentSnapshotId?: number;
  sequenceNumber: number;
  timestampMs: number;
  manifestList: string;
  summary: Record<string, string>;
  schemaId?: number;
}

/** Iceberg snapshot reference */
export interface IcebergSnapshotRef {
  snapshotId: number;
  type: 'branch' | 'tag';
  timestampMs: number;
  maxRefAgeMs?: number;
  minSnapshotsToKeep?: number;
  maxSnapshotAgeMs?: number;
}

// =============================================================================
// Parquet Types
// =============================================================================

/** Parquet primitive type */
export type ParquetPrimitiveType =
  | 'BOOLEAN'
  | 'INT32'
  | 'INT64'
  | 'INT96'
  | 'FLOAT'
  | 'DOUBLE'
  | 'BYTE_ARRAY'
  | 'FIXED_LEN_BYTE_ARRAY';

/** Parquet converted type (logical type in older spec) */
export type ParquetConvertedType =
  | 'UTF8'
  | 'MAP'
  | 'MAP_KEY_VALUE'
  | 'LIST'
  | 'ENUM'
  | 'DECIMAL'
  | 'DATE'
  | 'TIME_MILLIS'
  | 'TIME_MICROS'
  | 'TIMESTAMP_MILLIS'
  | 'TIMESTAMP_MICROS'
  | 'UINT_8'
  | 'UINT_16'
  | 'UINT_32'
  | 'UINT_64'
  | 'INT_8'
  | 'INT_16'
  | 'INT_32'
  | 'INT_64'
  | 'JSON'
  | 'BSON'
  | 'INTERVAL'
  | 'UUID';

/** Parquet repetition type */
export type ParquetRepetition = 'REQUIRED' | 'OPTIONAL' | 'REPEATED';

/** Parquet logical type (newer spec) */
export interface ParquetLogicalType {
  type: string;
  precision?: number;
  scale?: number;
  isAdjustedToUTC?: boolean;
  unit?: 'MILLIS' | 'MICROS' | 'NANOS';
}

/** Parquet field/column definition */
export interface ParquetField {
  name: string;
  type?: ParquetPrimitiveType;
  repetition: ParquetRepetition;
  convertedType?: ParquetConvertedType;
  logicalType?: ParquetLogicalType;
  typeLength?: number;
  precision?: number;
  scale?: number;
  children?: ParquetField[];
  fieldId?: number;
}

/** Parquet schema (message type) */
export interface ParquetSchema {
  name: string;
  fields: ParquetField[];
}
