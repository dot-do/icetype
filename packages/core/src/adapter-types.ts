/**
 * Adapter Type Definitions
 *
 * Defines the interfaces for schema adapters that transform IceType schemas
 * to various output formats such as Apache Iceberg, Parquet, SQL DDL, and more.
 *
 * These types are defined in @icetype/core to avoid cyclic dependencies between
 * @icetype/adapters and individual adapter packages.
 *
 * @module adapter-types
 * @packageDocumentation
 */

import type { IceTypeSchema } from './types.js';

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Schema adapter interface for transforming IceType schemas to various output formats.
 *
 * Adapters are the core abstraction for converting IceType schemas to target formats.
 * Each adapter must provide:
 * - A unique `name` for registry identification
 * - A `version` string (semver recommended) for tracking compatibility
 * - A `transform` method to convert schemas to the target format
 * - A `serialize` method to convert the output to a string
 *
 * @typeParam TOutput - The output type produced by the adapter's `transform` method.
 *   This should represent the target format's schema structure.
 * @typeParam TOptions - The options type accepted by the `transform` method.
 *   Use this for adapter-specific configuration like output locations or format settings.
 *
 * @example Implementing a custom adapter
 * ```typescript
 * import type { SchemaAdapter, IceTypeSchema } from '@icetype/core';
 *
 * interface JsonSchemaOutput {
 *   $schema: string;
 *   type: string;
 *   properties: Record<string, unknown>;
 *   required: string[];
 * }
 *
 * interface JsonSchemaOptions {
 *   draft?: '2020-12' | '2019-09' | 'draft-07';
 * }
 *
 * const jsonSchemaAdapter: SchemaAdapter<JsonSchemaOutput, JsonSchemaOptions> = {
 *   name: 'json-schema',
 *   version: '1.0.0',
 *
 *   transform(schema: IceTypeSchema, options?: JsonSchemaOptions): JsonSchemaOutput {
 *     const draft = options?.draft ?? '2020-12';
 *     return {
 *       $schema: `https://json-schema.org/draft/${draft}/schema`,
 *       type: 'object',
 *       properties: mapFieldsToProperties(schema.fields),
 *       required: getRequiredFields(schema.fields),
 *     };
 *   },
 *
 *   serialize(output: JsonSchemaOutput): string {
 *     return JSON.stringify(output, null, 2);
 *   },
 * };
 * ```
 *
 * @example Using an adapter
 * ```typescript
 * import { createAdapterRegistry } from '@icetype/adapters';
 * import { parseSchema } from '@icetype/core';
 *
 * const registry = createAdapterRegistry();
 * registry.register(jsonSchemaAdapter);
 *
 * const schema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });
 * const adapter = registry.get('json-schema');
 *
 * if (adapter) {
 *   const output = adapter.transform(schema, { draft: '2020-12' });
 *   const jsonString = adapter.serialize(output);
 *   console.log(jsonString);
 * }
 * ```
 */
export interface SchemaAdapter<TOutput = unknown, TOptions = unknown> {
  /**
   * Unique name identifying this adapter.
   *
   * This name is used as the key for registry operations. Choose a descriptive,
   * lowercase name with hyphens for multi-word names (e.g., 'json-schema', 'iceberg').
   *
   * Names can contain any characters, including Unicode and special characters,
   * but lowercase-hyphenated names are recommended for consistency.
   */
  readonly name: string;

  /**
   * Adapter version following semantic versioning (semver).
   *
   * Used for tracking adapter compatibility and debugging. When making
   * breaking changes to the adapter's output format, increment the major version.
   *
   * @example '1.0.0', '2.1.3', '1.0.0-beta.1'
   */
  readonly version: string;

  /**
   * Transform an IceType schema to the adapter's output format.
   *
   * This is the core method that converts an IceType schema into the target
   * format. The transformation should be deterministic - the same input
   * schema and options should always produce the same output.
   *
   * @param schema - The IceType schema to transform. Contains the type name,
   *   field definitions, and directives.
   * @param options - Optional adapter-specific configuration. The structure
   *   depends on the adapter implementation.
   * @returns The transformed output in the adapter's target format.
   * @throws May throw errors if the schema contains unsupported constructs
   *   or if required options are missing.
   *
   * @example
   * ```typescript
   * const output = adapter.transform(schema, {
   *   location: 's3://bucket/tables/users',
   *   properties: { 'write.format.default': 'parquet' },
   * });
   * ```
   */
  transform(schema: IceTypeSchema, options?: TOptions): TOutput;

  /**
   * Serialize the output to a string representation.
   *
   * Converts the transform output to a string suitable for storage or
   * transmission. The format depends on the adapter (e.g., JSON, SQL, Avro).
   *
   * @param output - The output from the `transform` method.
   * @returns String representation of the output.
   *
   * @example
   * ```typescript
   * const output = adapter.transform(schema);
   * const serialized = adapter.serialize(output);
   * await fs.writeFile('schema.json', serialized);
   * ```
   */
  serialize(output: TOutput): string;

  /**
   * Serialize the output including index creation statements.
   *
   * This optional method generates a complete DDL string that includes both
   * the primary schema definition (e.g., CREATE TABLE) and any associated
   * index statements (e.g., CREATE INDEX).
   *
   * This is particularly useful for SQL adapters where indexes are created
   * with separate statements from the table definition.
   *
   * @param output - The output from the `transform` method.
   * @returns String representation including all index statements.
   *
   * @example SQL adapter with indexes
   * ```typescript
   * const output = sqlAdapter.transform(schema);
   *
   * // Without indexes - just CREATE TABLE
   * console.log(sqlAdapter.serialize(output));
   * // CREATE TABLE users (id UUID PRIMARY KEY, email VARCHAR(255));
   *
   * // With indexes - CREATE TABLE + CREATE INDEX
   * console.log(sqlAdapter.serializeWithIndexes?.(output));
   * // CREATE TABLE users (id UUID PRIMARY KEY, email VARCHAR(255));
   * // CREATE INDEX idx_users_email ON users (email);
   * ```
   */
  serializeWithIndexes?(output: TOutput): string;
}

// =============================================================================
// Registry Interface
// =============================================================================

/**
 * Registry for managing schema adapters.
 *
 * The registry provides a centralized store for adapters, allowing them to be
 * registered once and retrieved by name throughout an application. This pattern
 * enables:
 * - Dynamic adapter selection at runtime
 * - Plugin architectures where adapters are registered at startup
 * - Testing with mock adapters
 *
 * Use {@link createAdapterRegistry} to create an instance, or use
 * {@link globalRegistry} for a shared singleton.
 *
 * @example Basic registry usage
 * ```typescript
 * import { createAdapterRegistry } from '@icetype/adapters';
 *
 * const registry = createAdapterRegistry();
 * registry.register(icebergAdapter);
 * registry.register(parquetAdapter);
 *
 * // Get and use an adapter
 * const adapter = registry.get('iceberg');
 * if (adapter) {
 *   const output = adapter.transform(schema);
 * }
 *
 * // List all available adapters
 * console.log(registry.list()); // ['iceberg', 'parquet']
 * ```
 *
 * @example Plugin pattern
 * ```typescript
 * // plugins/iceberg.ts
 * export function registerIcebergAdapters(registry: AdapterRegistry) {
 *   registry.register(new IcebergAdapter());
 *   registry.register(new ParquetAdapter());
 * }
 *
 * // app.ts
 * import { globalRegistry } from '@icetype/adapters';
 * import { registerIcebergAdapters } from './plugins/iceberg.js';
 *
 * registerIcebergAdapters(globalRegistry);
 * ```
 */
export interface AdapterRegistry {
  /**
   * Register an adapter with the registry.
   *
   * @param adapter - The adapter to register. Must have a unique `name` property.
   * @throws {AdapterError} If an adapter with the same name is already registered.
   *   Use `unregister()` first if you need to replace an adapter.
   *
   * @example
   * ```typescript
   * registry.register({
   *   name: 'my-adapter',
   *   version: '1.0.0',
   *   transform: (schema) => transformSchema(schema),
   *   serialize: (output) => JSON.stringify(output),
   * });
   * ```
   */
  register(adapter: SchemaAdapter): void;

  /**
   * Get an adapter by name.
   *
   * @param name - The adapter name to look up
   * @returns The adapter if found, `undefined` otherwise
   *
   * @example
   * ```typescript
   * const adapter = registry.get('iceberg');
   * if (adapter) {
   *   const output = adapter.transform(schema);
   * }
   * ```
   */
  get(name: string): SchemaAdapter | undefined;

  /**
   * List all registered adapter names.
   *
   * @returns Array of registered adapter names. Returns an empty array if
   *   no adapters are registered. The returned array is a snapshot and
   *   does not reflect subsequent modifications.
   *
   * @example
   * ```typescript
   * const names = registry.list();
   * for (const name of names) {
   *   console.log(`Available adapter: ${name}`);
   * }
   * ```
   */
  list(): string[];

  /**
   * Check if an adapter is registered.
   *
   * @param name - The adapter name to check
   * @returns `true` if an adapter with the given name is registered
   *
   * @example
   * ```typescript
   * if (registry.has('parquet')) {
   *   const adapter = registry.get('parquet')!; // Safe non-null assertion
   *   // ...
   * }
   * ```
   */
  has(name: string): boolean;

  /**
   * Unregister an adapter by name.
   *
   * Removes the adapter from the registry. After unregistering, the name
   * can be reused for a new adapter registration.
   *
   * @param name - The adapter name to unregister
   * @returns `true` if the adapter was found and unregistered,
   *   `false` if no adapter with that name was registered
   *
   * @example Replacing an adapter
   * ```typescript
   * // Replace with a new version
   * registry.unregister('my-adapter');
   * registry.register(newVersionAdapter);
   * ```
   */
  unregister(name: string): boolean;

  /**
   * Clear all registered adapters.
   *
   * Removes all adapters from the registry. The registry will be empty
   * after this operation.
   *
   * @example Test cleanup
   * ```typescript
   * afterEach(() => {
   *   globalRegistry.clear();
   * });
   * ```
   */
  clear(): void;
}

// =============================================================================
// Adapter Options Types
// =============================================================================

/**
 * Options for the Iceberg adapter.
 *
 * These options configure how IceType schemas are transformed to Apache Iceberg
 * table metadata format.
 *
 * @example
 * ```typescript
 * const options: IcebergAdapterOptions = {
 *   location: 's3://my-bucket/warehouse/tables/users',
 *   tableUuid: '550e8400-e29b-41d4-a716-446655440000',
 *   properties: {
 *     'write.format.default': 'parquet',
 *     'write.parquet.compression-codec': 'zstd',
 *   },
 * };
 *
 * const output = icebergAdapter.transform(schema, options);
 * ```
 */
export interface IcebergAdapterOptions {
  /**
   * Base location for the table data and metadata.
   *
   * This should be a fully qualified path to where the table will be stored.
   * Supports cloud storage paths (S3, GCS, Azure) and local file paths.
   *
   * @example
   * - 's3://my-bucket/warehouse/tables/users'
   * - 'gs://my-bucket/iceberg/products'
   * - '/data/warehouse/tables/orders'
   */
  location: string;

  /**
   * Optional table UUID for the Iceberg table.
   *
   * If not provided, a new UUID will be generated. Specify this when
   * creating metadata for an existing table or when you need deterministic
   * table identifiers.
   */
  tableUuid?: string;

  /**
   * Additional Iceberg table properties.
   *
   * These properties are written to the table metadata and control various
   * aspects of table behavior like write format, compression, and partitioning.
   *
   * @see https://iceberg.apache.org/docs/latest/configuration/ for available properties
   *
   * @example
   * ```typescript
   * properties: {
   *   'write.format.default': 'parquet',
   *   'write.parquet.compression-codec': 'zstd',
   *   'write.target-file-size-bytes': '536870912',
   * }
   * ```
   */
  properties?: Record<string, string>;
}

/**
 * Options for the Parquet adapter.
 *
 * Configures the output format for Parquet schema generation.
 *
 * @example
 * ```typescript
 * // Get schema as an object
 * const objectOutput = parquetAdapter.transform(schema, { format: 'object' });
 *
 * // Get schema as a string representation
 * const stringOutput = parquetAdapter.transform(schema, { format: 'string' });
 * ```
 */
export interface ParquetAdapterOptions {
  /**
   * Output format for the Parquet schema.
   *
   * - `'object'` - Returns the schema as a structured ParquetSchema object
   * - `'string'` - Returns the schema as a human-readable string representation
   *
   * @default 'object'
   */
  format?: 'object' | 'string';
}
