/**
 * Iceberg Adapter Implementation
 *
 * Wraps @icetype/iceberg's generateIcebergMetadata to provide
 * a consistent adapter interface.
 *
 * @packageDocumentation
 */

import { AdapterError, ErrorCodes, type IceTypeSchema } from '@icetype/core';
import type { SchemaAdapter, IcebergAdapterOptions } from '@icetype/adapters';

import { generateIcebergMetadata } from './metadata.js';
import type { IcebergTableMetadata } from './types.js';

// =============================================================================
// Iceberg Adapter
// =============================================================================

/**
 * Adapter for transforming IceType schemas to Apache Iceberg table metadata.
 *
 * @example
 * ```typescript
 * import { parseSchema } from '@icetype/core';
 * import { IcebergAdapter } from '@icetype/iceberg';
 *
 * const schema = parseSchema({
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 *   name: 'string',
 * });
 *
 * const adapter = new IcebergAdapter();
 * const metadata = adapter.transform(schema, {
 *   location: 's3://my-bucket/tables/users',
 * });
 *
 * // Serialize to JSON
 * const json = adapter.serialize(metadata);
 * ```
 */
export class IcebergAdapter
  implements SchemaAdapter<IcebergTableMetadata, IcebergAdapterOptions>
{
  readonly name = 'iceberg';
  readonly version = '0.1.0';

  /**
   * Transform an IceType schema to Iceberg table metadata.
   *
   * @param schema - The IceType schema to transform
   * @param options - Iceberg-specific options including location
   * @returns Iceberg table metadata
   * @throws AdapterError if location is not provided
   */
  transform(
    schema: IceTypeSchema,
    options?: IcebergAdapterOptions
  ): IcebergTableMetadata {
    if (!options?.location) {
      throw new AdapterError('Missing required option: location', {
        adapterName: this.name,
        operation: 'transform',
        code: ErrorCodes.MISSING_ADAPTER_OPTION,
        context: {
          requiredOption: 'location',
          schema: schema.name,
        },
      });
    }

    return generateIcebergMetadata(schema, options.location, options.properties);
  }

  /**
   * Serialize Iceberg metadata to JSON string.
   *
   * @param output - The Iceberg metadata to serialize
   * @returns JSON string representation
   */
  serialize(output: IcebergTableMetadata): string {
    return JSON.stringify(output, null, 2);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Iceberg adapter instance.
 *
 * @returns A new IcebergAdapter instance
 */
export function createIcebergAdapter(): IcebergAdapter {
  return new IcebergAdapter();
}
