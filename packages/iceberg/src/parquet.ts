/**
 * Parquet Schema Generation from IceType Schemas
 *
 * Converts IceType schema definitions to Apache Parquet schema format.
 *
 * @packageDocumentation
 */

import type {
  IceTypeSchema,
  FieldDefinition,
} from '@icetype/core';
import { SYSTEM_COLUMNS } from '@icetype/core';

import type {
  ParquetPrimitiveType,
  ParquetConvertedType,
  ParquetRepetition,
  ParquetLogicalType,
  ParquetField,
  ParquetSchema,
} from './types.js';

// =============================================================================
// Type Mapping
// =============================================================================

interface ParquetTypeInfo {
  type: ParquetPrimitiveType;
  convertedType?: ParquetConvertedType;
  logicalType?: ParquetLogicalType;
  typeLength?: number;
  precision?: number;
  scale?: number;
}

function mapPrimitiveType(iceType: string): ParquetTypeInfo {
  const normalized = iceType.toLowerCase();

  switch (normalized) {
    case 'string':
    case 'text':
      return {
        type: 'BYTE_ARRAY',
        convertedType: 'UTF8',
        logicalType: { type: 'STRING' },
      };
    case 'int':
      return {
        type: 'INT32',
        convertedType: 'INT_32',
        logicalType: { type: 'INTEGER', precision: 32 },
      };
    case 'long':
    case 'bigint':
      return {
        type: 'INT64',
        convertedType: 'INT_64',
        logicalType: { type: 'INTEGER', precision: 64 },
      };
    case 'float':
      return { type: 'FLOAT' };
    case 'double':
      return { type: 'DOUBLE' };
    case 'bool':
    case 'boolean':
      return { type: 'BOOLEAN' };
    case 'uuid':
      return {
        type: 'FIXED_LEN_BYTE_ARRAY',
        typeLength: 16,
        convertedType: 'UUID',
        logicalType: { type: 'UUID' },
      };
    case 'timestamp':
      return {
        type: 'INT64',
        convertedType: 'TIMESTAMP_MILLIS',
        logicalType: { type: 'TIMESTAMP', isAdjustedToUTC: false, unit: 'MILLIS' },
      };
    case 'timestamptz':
      return {
        type: 'INT64',
        convertedType: 'TIMESTAMP_MILLIS',
        logicalType: { type: 'TIMESTAMP', isAdjustedToUTC: true, unit: 'MILLIS' },
      };
    case 'date':
      return {
        type: 'INT32',
        convertedType: 'DATE',
        logicalType: { type: 'DATE' },
      };
    case 'time':
      return {
        type: 'INT32',
        convertedType: 'TIME_MILLIS',
        logicalType: { type: 'TIME', isAdjustedToUTC: false, unit: 'MILLIS' },
      };
    case 'binary':
      return { type: 'BYTE_ARRAY' };
    case 'json':
      return {
        type: 'BYTE_ARRAY',
        convertedType: 'JSON',
        logicalType: { type: 'JSON' },
      };
    case 'decimal':
      return {
        type: 'BYTE_ARRAY',
        convertedType: 'DECIMAL',
        logicalType: { type: 'DECIMAL', precision: 38, scale: 9 },
        precision: 38,
        scale: 9,
      };
    default:
      return {
        type: 'BYTE_ARRAY',
        convertedType: 'UTF8',
        logicalType: { type: 'STRING' },
      };
  }
}

function fieldToParquetField(
  field: FieldDefinition,
  fieldId: number
): ParquetField {
  const repetition: ParquetRepetition = field.isOptional || field.modifier === '?'
    ? 'OPTIONAL'
    : 'REQUIRED';

  if (field.relation) {
    if (field.isArray) {
      return createListField(field.name, repetition, {
        type: 'BYTE_ARRAY',
        convertedType: 'UTF8',
        logicalType: { type: 'STRING' },
      }, fieldId);
    } else {
      return {
        name: field.name,
        type: 'BYTE_ARRAY',
        repetition,
        convertedType: 'UTF8',
        logicalType: { type: 'STRING' },
        fieldId,
      };
    }
  }

  if (field.isArray) {
    const elementTypeInfo = mapPrimitiveType(field.type);
    return createListField(field.name, repetition, elementTypeInfo, fieldId);
  }

  const typeInfo = mapPrimitiveType(field.type);
  return {
    name: field.name,
    type: typeInfo.type,
    repetition,
    convertedType: typeInfo.convertedType,
    logicalType: typeInfo.logicalType,
    typeLength: typeInfo.typeLength,
    precision: typeInfo.precision,
    scale: typeInfo.scale,
    fieldId,
  };
}

function createListField(
  name: string,
  repetition: ParquetRepetition,
  elementTypeInfo: ParquetTypeInfo,
  fieldId: number
): ParquetField {
  return {
    name,
    repetition,
    convertedType: 'LIST',
    logicalType: { type: 'LIST' },
    fieldId,
    children: [
      {
        name: 'list',
        repetition: 'REPEATED',
        children: [
          {
            name: 'element',
            type: elementTypeInfo.type,
            repetition: 'OPTIONAL',
            ...(elementTypeInfo.convertedType !== undefined && { convertedType: elementTypeInfo.convertedType }),
            ...(elementTypeInfo.logicalType !== undefined && { logicalType: elementTypeInfo.logicalType }),
            ...(elementTypeInfo.typeLength !== undefined && { typeLength: elementTypeInfo.typeLength }),
          },
        ],
      },
    ],
  };
}

// =============================================================================
// Schema Generator
// =============================================================================

/**
 * Generator for Parquet schemas from IceType schemas.
 */
export class ParquetSchemaGenerator {
  private nextFieldId = 1;

  /**
   * Generate Parquet schema from IceType schema.
   */
  generateSchema(schema: IceTypeSchema): ParquetSchema {
    this.nextFieldId = 1;

    const fields: ParquetField[] = [];

    const systemFields = this.generateSystemFields();
    fields.push(...systemFields);

    for (const [fieldName, fieldDef] of schema.fields) {
      if (fieldName.startsWith('$')) continue;

      const parquetField = fieldToParquetField(
        { ...fieldDef, name: fieldName },
        this.nextFieldId++
      );
      fields.push(parquetField);
    }

    return {
      name: schema.name,
      fields,
    };
  }

  private generateSystemFields(): ParquetField[] {
    return [
      {
        name: SYSTEM_COLUMNS.$id.name,
        type: 'BYTE_ARRAY',
        repetition: SYSTEM_COLUMNS.$id.nullable ? 'OPTIONAL' : 'REQUIRED',
        convertedType: 'UTF8',
        logicalType: { type: 'STRING' },
        fieldId: this.nextFieldId++,
      },
      {
        name: SYSTEM_COLUMNS.$type.name,
        type: 'BYTE_ARRAY',
        repetition: SYSTEM_COLUMNS.$type.nullable ? 'OPTIONAL' : 'REQUIRED',
        convertedType: 'UTF8',
        logicalType: { type: 'STRING' },
        fieldId: this.nextFieldId++,
      },
      {
        name: SYSTEM_COLUMNS.$version.name,
        type: 'INT32',
        repetition: SYSTEM_COLUMNS.$version.nullable ? 'OPTIONAL' : 'REQUIRED',
        convertedType: 'INT_32',
        logicalType: { type: 'INTEGER', precision: 32 },
        fieldId: this.nextFieldId++,
      },
      {
        name: SYSTEM_COLUMNS.$createdAt.name,
        type: 'INT64',
        repetition: SYSTEM_COLUMNS.$createdAt.nullable ? 'OPTIONAL' : 'REQUIRED',
        convertedType: 'TIMESTAMP_MILLIS',
        logicalType: { type: 'TIMESTAMP', isAdjustedToUTC: false, unit: 'MILLIS' },
        fieldId: this.nextFieldId++,
      },
      {
        name: SYSTEM_COLUMNS.$updatedAt.name,
        type: 'INT64',
        repetition: SYSTEM_COLUMNS.$updatedAt.nullable ? 'OPTIONAL' : 'REQUIRED',
        convertedType: 'TIMESTAMP_MILLIS',
        logicalType: { type: 'TIMESTAMP', isAdjustedToUTC: false, unit: 'MILLIS' },
        fieldId: this.nextFieldId++,
      },
    ];
  }

  /**
   * Generate Parquet schema definition string (for debugging/documentation).
   */
  toSchemaString(schema: ParquetSchema): string {
    const lines: string[] = [`message ${schema.name} {`];

    for (const field of schema.fields) {
      lines.push(this.fieldToString(field, 1));
    }

    lines.push('}');
    return lines.join('\n');
  }

  private fieldToString(field: ParquetField, indent: number): string {
    const prefix = '  '.repeat(indent);

    if (field.children) {
      const lines: string[] = [];
      const groupType = field.convertedType ? ` (${field.convertedType})` : '';
      lines.push(`${prefix}${field.repetition} group ${field.name}${groupType} {`);
      for (const child of field.children) {
        lines.push(this.fieldToString(child, indent + 1));
      }
      lines.push(`${prefix}}`);
      return lines.join('\n');
    }

    const converted = field.convertedType ? ` (${field.convertedType})` : '';
    const typeStr = field.typeLength ? `${field.type}(${field.typeLength})` : field.type;
    return `${prefix}${field.repetition} ${typeStr} ${field.name}${converted};`;
  }
}

// =============================================================================
// Row Conversion
// =============================================================================

/**
 * Convert a document to Parquet row format.
 */
export function documentToParquetRow(
  document: Record<string, unknown>,
  schema: ParquetSchema
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const value = document[field.name];
    row[field.name] = convertValue(value, field);
  }

  return row;
}

function convertValue(value: unknown, field: ParquetField): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (field.convertedType === 'LIST' && Array.isArray(value)) {
    return value.map(item => {
      const elementField = field.children?.[0]?.children?.[0];
      if (elementField) {
        return convertValue(item, elementField);
      }
      return item;
    });
  }

  switch (field.type) {
    case 'BOOLEAN':
      return Boolean(value);
    case 'INT32':
      return typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);
    case 'INT64':
    case 'INT96':
      if (value instanceof Date) {
        return value.getTime();
      }
      return typeof value === 'number' ? value : parseInt(String(value), 10);
    case 'FLOAT':
    case 'DOUBLE':
      return typeof value === 'number' ? value : parseFloat(String(value));
    case 'BYTE_ARRAY':
      if (field.convertedType === 'JSON' && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    case 'FIXED_LEN_BYTE_ARRAY':
      if (field.convertedType === 'UUID' && typeof value === 'string') {
        return value.replace(/-/g, '');
      }
      return value;
    case undefined:
      // Group fields (with children) don't have a primitive type
      return value;
    default: {
      const _exhaustive: never = field.type;
      throw new Error(`Unhandled Parquet type: ${_exhaustive}`);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Parquet schema generator.
 */
export function createParquetSchemaGenerator(): ParquetSchemaGenerator {
  return new ParquetSchemaGenerator();
}

/**
 * Generate Parquet schema from IceType schema.
 */
export function generateParquetSchema(schema: IceTypeSchema): ParquetSchema {
  const generator = new ParquetSchemaGenerator();
  return generator.generateSchema(schema);
}

/**
 * Generate Parquet schema string from IceType schema.
 */
export function generateParquetSchemaString(schema: IceTypeSchema): string {
  const generator = new ParquetSchemaGenerator();
  const parquetSchema = generator.generateSchema(schema);
  return generator.toSchemaString(parquetSchema);
}
