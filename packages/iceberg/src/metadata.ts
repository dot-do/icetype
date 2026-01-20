/**
 * Iceberg Metadata Generation from IceType Schemas
 *
 * Converts IceType schema definitions to Apache Iceberg table metadata.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';

import type {
  IceTypeSchema,
  FieldDefinition,
} from '@icetype/core';

import type {
  IcebergType,
  IcebergField,
  IcebergSchema,
  IcebergPartitionField,
  IcebergPartitionSpec,
  IcebergSortField,
  IcebergSortOrder,
  IcebergTableMetadata,
} from './types.js';

// =============================================================================
// Type Mapping
// =============================================================================

function mapPrimitiveType(iceType: string): IcebergType {
  const normalized = iceType.toLowerCase();

  switch (normalized) {
    case 'string':
    case 'text':
      return { type: 'string' };
    case 'int':
      return { type: 'int' };
    case 'long':
    case 'bigint':
      return { type: 'long' };
    case 'float':
      return { type: 'float' };
    case 'double':
      return { type: 'double' };
    case 'bool':
    case 'boolean':
      return { type: 'boolean' };
    case 'uuid':
      return { type: 'uuid' };
    case 'timestamp':
      return { type: 'timestamp' };
    case 'timestamptz':
      return { type: 'timestamptz' };
    case 'date':
      return { type: 'date' };
    case 'time':
      return { type: 'time' };
    case 'binary':
      return { type: 'binary' };
    case 'json':
      return { type: 'string' };
    case 'decimal':
      return { type: 'decimal', precision: 38, scale: 9 };
    default:
      return { type: 'string' };
  }
}

function fieldToIcebergField(
  field: FieldDefinition,
  fieldId: number
): IcebergField {
  let icebergType: IcebergType;

  if (field.relation) {
    if (field.isArray) {
      icebergType = {
        type: 'list',
        elementType: { type: 'string' },
      };
    } else {
      icebergType = { type: 'string' };
    }
  } else if (field.isArray) {
    const elementType = mapPrimitiveType(field.type);
    icebergType = {
      type: 'list',
      elementType,
    };
  } else {
    icebergType = mapPrimitiveType(field.type);
  }

  return {
    id: fieldId,
    name: field.name,
    required: !field.isOptional && field.modifier !== '?',
    type: icebergType,
    doc: field.name,
    initialDefault: field.defaultValue,
  };
}

// =============================================================================
// UUID Generator
// =============================================================================

function generateUUID(): string {
  // Use randomUUID() from node:crypto for cryptographically secure UUIDs
  return randomUUID();
}

// =============================================================================
// Schema Generator
// =============================================================================

/**
 * Generator for Iceberg metadata from IceType schemas.
 */
export class IcebergMetadataGenerator {
  private nextFieldId = 1;
  private nextPartitionId = 1000;

  /**
   * Generate Iceberg schema from IceType schema.
   */
  generateSchema(schema: IceTypeSchema): IcebergSchema {
    const fields: IcebergField[] = [];
    const identifierFieldIds: number[] = [];

    const systemFields = this.generateSystemFields();
    for (const field of systemFields) {
      field.id = this.nextFieldId++;
      fields.push(field);
      if (field.name === '$id') {
        identifierFieldIds.push(field.id);
      }
    }

    for (const [fieldName, fieldDef] of schema.fields) {
      if (fieldName.startsWith('$')) continue;

      const icebergField = fieldToIcebergField(
        { ...fieldDef, name: fieldName },
        this.nextFieldId++
      );
      fields.push(icebergField);
    }

    return {
      type: 'struct',
      schemaId: schema.version,
      identifierFieldIds,
      fields,
    };
  }

  private generateSystemFields(): IcebergField[] {
    return [
      {
        id: 0,
        name: '$id',
        required: true,
        type: { type: 'string' },
        doc: 'Document unique identifier',
      },
      {
        id: 0,
        name: '$type',
        required: true,
        type: { type: 'string' },
        doc: 'Document type/collection',
      },
      {
        id: 0,
        name: '$version',
        required: true,
        type: { type: 'int' },
        doc: 'Document version for optimistic concurrency',
      },
      {
        id: 0,
        name: '$createdAt',
        required: true,
        type: { type: 'long' },
        doc: 'Document creation timestamp (epoch ms)',
      },
      {
        id: 0,
        name: '$updatedAt',
        required: true,
        type: { type: 'long' },
        doc: 'Document last update timestamp (epoch ms)',
      },
    ];
  }

  /**
   * Generate partition spec from schema directives.
   */
  generatePartitionSpec(
    schema: IceTypeSchema,
    icebergSchema: IcebergSchema
  ): IcebergPartitionSpec {
    const fields: IcebergPartitionField[] = [];
    const partitionBy = schema.directives.partitionBy ?? [];

    for (const partitionField of partitionBy) {
      const sourceField = icebergSchema.fields.find(f => f.name === partitionField);
      if (!sourceField) continue;

      let transform: IcebergPartitionField['transform'] = 'identity';

      if (sourceField.type.type === 'timestamp' || sourceField.type.type === 'timestamptz') {
        transform = 'day';
      }

      fields.push({
        sourceId: sourceField.id,
        fieldId: this.nextPartitionId++,
        name: partitionField,
        transform,
      });
    }

    if (fields.length === 0) {
      const typeField = icebergSchema.fields.find(f => f.name === '$type');
      if (typeField) {
        fields.push({
          sourceId: typeField.id,
          fieldId: this.nextPartitionId++,
          name: '$type',
          transform: 'identity',
        });
      }
    }

    return {
      specId: 0,
      fields,
    };
  }

  /**
   * Generate sort order from schema.
   */
  generateSortOrder(schema: IceTypeSchema, icebergSchema: IcebergSchema): IcebergSortOrder {
    const fields: IcebergSortField[] = [];

    const createdAtField = icebergSchema.fields.find(f => f.name === '$createdAt');
    if (createdAtField) {
      fields.push({
        transform: 'identity',
        sourceId: createdAtField.id,
        direction: 'desc',
        nullOrder: 'nulls-last',
      });
    }

    return {
      orderId: 0,
      fields,
    };
  }

  /**
   * Generate complete table metadata.
   */
  generateTableMetadata(
    schema: IceTypeSchema,
    options: {
      location: string;
      tableUuid?: string;
      properties?: Record<string, string>;
    }
  ): IcebergTableMetadata {
    this.nextFieldId = 1;
    this.nextPartitionId = 1000;

    const icebergSchema = this.generateSchema(schema);
    const partitionSpec = this.generatePartitionSpec(schema, icebergSchema);
    const sortOrder = this.generateSortOrder(schema, icebergSchema);

    const now = Date.now();
    const tableUuid = options.tableUuid ?? generateUUID();

    return {
      formatVersion: 2,
      tableUuid,
      location: options.location,
      lastSequenceNumber: 0,
      lastUpdatedMs: now,
      lastColumnId: this.nextFieldId - 1,
      currentSchemaId: icebergSchema.schemaId,
      schemas: [icebergSchema],
      defaultSpecId: partitionSpec.specId,
      partitionSpecs: [partitionSpec],
      lastPartitionId: this.nextPartitionId - 1,
      defaultSortOrderId: sortOrder.orderId,
      sortOrders: [sortOrder],
      properties: {
        'write.format.default': 'parquet',
        'write.parquet.compression-codec': 'snappy',
        'icetype.source.schema': schema.name,
        'icetype.source.version': String(schema.version),
        ...options.properties,
      },
    };
  }

  /**
   * Serialize table metadata to JSON.
   */
  serializeMetadata(metadata: IcebergTableMetadata): string {
    return JSON.stringify(metadata, null, 2);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new Iceberg metadata generator.
 */
export function createIcebergMetadataGenerator(): IcebergMetadataGenerator {
  return new IcebergMetadataGenerator();
}

/**
 * Generate Iceberg table metadata from an IceType schema.
 *
 * @example
 * ```typescript
 * import { generateIcebergMetadata } from '@icetype/iceberg';
 *
 * const metadata = generateIcebergMetadata(
 *   userSchema,
 *   's3://my-bucket/tables/users',
 *   { 'write.parquet.compression-codec': 'zstd' }
 * );
 * ```
 */
export function generateIcebergMetadata(
  schema: IceTypeSchema,
  location: string,
  properties?: Record<string, string>
): IcebergTableMetadata {
  const generator = new IcebergMetadataGenerator();
  return generator.generateTableMetadata(schema, { location, properties });
}
