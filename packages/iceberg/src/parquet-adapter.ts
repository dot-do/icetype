/**
 * Parquet Adapter Implementation
 *
 * Wraps @icetype/iceberg's generateParquetSchema to provide
 * a consistent adapter interface.
 *
 * @packageDocumentation
 */

import type { IceTypeSchema } from '@icetype/core';
import type { SchemaAdapter, ParquetAdapterOptions } from '@icetype/adapters';

import { generateParquetSchema, generateParquetSchemaString } from './parquet.js';
import type { ParquetSchema } from './types.js';

// =============================================================================
// Parquet Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to Apache Parquet schemas.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { ParquetAdapter } from '@icetype/iceberg';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 * });
 *
 * const adapter = new ParquetAdapter();
 *
 * // Get ParquetSchema object
 * const parquetSchema = adapter.transform(schema);
 *
 * // Serialize to Parquet schema definition string
 * const schemaString = adapter.serialize(parquetSchema);
 * ```
 */
export class ParquetAdapter
  implements SchemaAdapter<ParquetSchema, ParquetAdapterOptions>
{
  readonly name = 'parquet';
  readonly version = '0.1.0';

  /**
   * Transform an IceType schema to a Parquet schema.
   *
   * @param schema - The IceType schema to transform
   * @param _options - Optional Parquet-specific options (reserved for future use)
   * @returns Parquet schema definition
   */
  transform(
    schema: IceTypeSchema,
    _options?: ParquetAdapterOptions
  ): ParquetSchema {
    return generateParquetSchema(schema);
  }

  /**
   * Serialize Parquet schema to a schema definition string.
   *
   * @param output - The Parquet schema to serialize
   * @returns Parquet schema definition string
   */
  serialize(output: ParquetSchema): string {
    return schemaToString(output);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a ParquetSchema to a Parquet schema definition string.
 * This is a local implementation to avoid requiring the full generator.
 */
function schemaToString(schema: ParquetSchema): string {
  const lines: string[] = [`message ${schema.name} {`];

  for (const field of schema.fields) {
    lines.push(fieldToString(field, 1));
  }

  lines.push('}');
  return lines.join('\n');
}

function fieldToString(
  field: {
    name: string;
    type?: string;
    repetition: string;
    convertedType?: string;
    typeLength?: number;
    children?: Array<{
      name: string;
      type?: string;
      repetition: string;
      convertedType?: string;
      typeLength?: number;
      children?: unknown[];
    }>;
  },
  indent: number
): string {
  const prefix = '  '.repeat(indent);

  if (field.children) {
    const lines: string[] = [];
    const groupType = field.convertedType ? ` (${field.convertedType})` : '';
    lines.push(`${prefix}${field.repetition} group ${field.name}${groupType} {`);
    for (const child of field.children) {
      lines.push(fieldToString(child as typeof field, indent + 1));
    }
    lines.push(`${prefix}}`);
    return lines.join('\n');
  }

  const converted = field.convertedType ? ` (${field.convertedType})` : '';
  const typeStr = field.typeLength
    ? `${field.type}(${field.typeLength})`
    : field.type;
  return `${prefix}${field.repetition} ${typeStr} ${field.name}${converted};`;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Parquet adapter instance.
 *
 * @returns A new ParquetAdapter instance
 */
export function createParquetAdapter(): ParquetAdapter {
  return new ParquetAdapter();
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Transform an IceType schema directly to a Parquet schema string.
 *
 * This is a convenience function that combines the adapter transform
 * and serialize steps.
 *
 * @param schema - The IceType schema to transform
 * @returns Parquet schema definition string
 *
 * @example
 * ```typescript
 * import { transformToParquetString } from '@icetype/iceberg';
 *
 * const schemaString = transformToParquetString(schema);
 * console.log(schemaString);
 * // message User {
 * //   REQUIRED BYTE_ARRAY $id (UTF8);
 * //   REQUIRED BYTE_ARRAY $type (UTF8);
 * //   ...
 * // }
 * ```
 */
export function transformToParquetString(schema: IceTypeSchema): string {
  return generateParquetSchemaString(schema);
}
