/**
 * @icetype/core
 *
 * IceType schema language - parser, types, and validation.
 *
 * IceType is a type-safe, concise schema language with:
 * - Field modifiers: `!` (required), `#` (indexed), `?` (optional), `[]` (array)
 * - Relation operators: `->` (forward), `~>` (fuzzy), `<-` (backward), `<~` (fuzzy backward)
 * - AI generation directives: `~>` for auto-generation from source fields
 * - Directives: `$partitionBy`, `$index`, `$fts`, `$vector`
 *
 * @example
 * ```typescript
 * import { parseSchema, validateSchema, inferType } from '@icetype/core';
 *
 * // Define a schema
 * const userSchema = parseSchema({
 *   $type: 'User',
 *   $partitionBy: ['id'],
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
 * if (!result.valid) {
 *   console.error('Schema errors:', result.errors);
 * }
 *
 * // Infer types from values
 * inferType('hello')                  // 'string'
 * inferType(42)                       // 'int'
 * inferType('2024-01-15T10:30:00Z')   // 'timestamp'
 * ```
 *
 * @packageDocumentation
 */

// Re-export all types
export type {
  // Brand utility type
  Brand,

  // Branded types
  SchemaId,
  FieldId,
  RelationId,

  // Field and schema types
  FieldModifier,
  RelationOperator,
  PrimitiveType,
  ParametricType,
  GenericType,
  FieldDefinition,
  RelationDefinition,
  IndexDirective,
  VectorDirective,
  SchemaDirectives,
  IceTypeSchema,

  // Validation types
  ValidationError,
  ValidationResult,

  // Parser types
  ParsedType,
  Token,
  TokenType,
  SchemaDefinition,
} from './types.js';

// Re-export ParseError class and branded type creators from types.js
// (ParseError in types.js now re-exports from errors.ts for backward compatibility)
export {
  ParseError,
  createSchemaId,
  createFieldId,
  createRelationId,
} from './types.js';

// Re-export all error classes and utilities
export {
  // Error classes
  IceTypeError,
  SchemaValidationError,
  AdapterError,
  SchemaLoadError,
  // Error codes
  ErrorCodes,
  // Type guards
  isIceTypeError,
  isParseError,
  isSchemaValidationError,
  isAdapterError,
  isSchemaLoadError,
  // Utilities
  getErrorMessage,
  assertNever,
} from './errors.js';

// Re-export error option types
export type {
  ErrorCode,
  IceTypeErrorOptions,
  ParseErrorOptions,
  SchemaValidationErrorOptions,
  AdapterErrorOptions,
  SchemaLoadErrorOptions,
  SchemaLoadErrorContext,
  SchemaLoadSuggestion,
} from './errors.js';

// Re-export documentation links for schema load errors
export { SchemaLoadErrorDocs } from './errors.js';

// Re-export parser functions
export {
  // Parser class
  IceTypeParser,
  parser,

  // Convenience functions
  parseSchema,
  parseField,
  parseRelation,
  parseDirectives,
  validateSchema,

  // Utilities
  tokenize,
  inferType,
  parseTypeString,
  parseRelationString,
  isRelationString,
  parseDefaultValue,
  splitGenericParams,

  // Type guards
  isValidPrimitiveType,
  isValidModifier,
  isValidRelationOperator,
  isValidParametricType,
  isValidGenericType,

  // Constants
  PRIMITIVE_TYPES,
  PARAMETRIC_TYPES,
  GENERIC_TYPES,
  TYPE_ALIASES,
  RELATION_OPERATORS,
  KNOWN_DIRECTIVES,
} from './parser.js';

// Re-export parser types
export type {
  SchemaDirectivesExtended,
  ParseTypeOptions,
  ParseRelationOptions,
} from './parser.js';

// Re-export type mappings
export {
  // Type mapping table
  TYPE_MAPPINGS,

  // Helper functions
  getIcebergType,
  getDuckDBType,
  getClickHouseType,
  getPostgresType,
  getParquetType,
  getTypeMapping,
  isKnownType,
  getSupportedTypes,
} from './type-mappings.js';

// Re-export type mapping types
export type { TypeMapping, KnownIceType } from './type-mappings.js';

// Re-export schema diff functions (new interface)
export { diffSchemas } from './diff.js';

// Re-export schema diff types (new interface)
export type { SchemaDiff, SchemaChange } from './diff.js';

// Re-export migration functions
export { diffSchemas as diffSchemasLegacy, generateMigrationPlan } from './migrations.js';

// Re-export migration types
export type {
  FieldChange,
  FieldChangeType,
  SchemaDiff as SchemaDiffLegacy,
  MigrationPlan,
  MigrationPlanOptions,
  SqlDialect,
} from './migrations.js';

// Re-export projection functions
export {
  parseProjectionDirectives,
  isProjection,
  validateProjection,
  getProjectionSource,
} from './projection.js';

// Re-export projection types
export type {
  ProjectionType,
  ProjectionDirectives,
  ProjectionSchemaDefinition,
  ProjectionSchema,
} from './projection.js';

// Re-export version functions
export {
  createSchemaVersion,
  parseSchemaVersion,
  serializeSchemaVersion,
  compareVersions,
  isCompatible,
  incrementMajor,
  incrementMinor,
  incrementPatch,
} from './version.js';

// Re-export version types
export type { SchemaVersion } from './version.js';

// Re-export Migration functions
export {
  createMigrationFromDiff,
  isBreakingMigration,
  mergeMigrations,
  validateMigration,
} from './migration.js';

// Re-export Migration types
export type {
  Migration,
  MigrationOperation,
  ColumnChanges,
  Constraint,
  MigrationValidationError,
  MigrationValidationResult,
  CreateMigrationOptions,
} from './migration.js';

// Re-export relation expansion functions
export {
  expandRelations,
  ExpandError,
  isExpandError,
  ExpandErrorCodes,
} from './expand.js';

// Re-export relation expansion types
export type {
  ExpandedSchema,
  ExpandErrorCode,
  ExpandErrorOptions,
} from './expand.js';

// Re-export History functions
export {
  createSchemaHistory,
  addHistoryEntry,
  getHistoryEntry,
  getLatestEntry,
  serializeHistory,
  parseHistory,
  computeSchemaChecksum,
} from './history.js';

// Re-export History types
export type { SchemaHistory, SchemaHistoryEntry } from './history.js';

// Re-export unified type mappings
export {
  getUnifiedTypeMapping,
  getAllDialects,
  getDialectMappings,
  getUnifiedMapping,
  isKnownUnifiedType,
  getSupportedUnifiedTypes,
  UnknownTypeError,
  InvalidDialectError,
} from './unified-type-mappings.js';

// Re-export unified type mapping types
export type { Dialect, UnifiedTypeMapping } from './unified-type-mappings.js';

// Re-export system column functions and constants
export {
  SYSTEM_COLUMNS,
  SYSTEM_COLUMN_NAMES,
  getSystemColumn,
  isSystemColumn,
} from './system-columns.js';

// Re-export system column types
export type {
  SystemColumnDefinition,
  SystemColumnName,
  SystemColumnType,
  SystemColumnsMap,
} from './system-columns.js';

// Re-export plugin system functions
export {
  // Factory
  createPluginManager,

  // Discovery
  discoverAdapters,
  discoverAdaptersFromPath,

  // Error classes
  PluginDiscoveryError,
  PluginLoadError,
  PluginDependencyError,
  PluginLifecycleError,

  // Type guards
  isPluginDiscoveryError,
  isPluginLoadError,
  isPluginDependencyError,
  isPluginLifecycleError,
} from './plugin-system.js';

// Re-export plugin system types
export type {
  Plugin,
  PluginManager,
  PluginManifest,
  PluginConfig,
  PluginHooks,
  PluginDependency,
  PluginManagerConfig,
  DiscoveredAdapter,
  DiscoverOptions,
  SchemaAdapterCompat,
  DiscoveredItem,
  TypedPlugin,
  TypedPluginHooks,
  TypedPluginConfig,
} from './plugin-system.js';

// Re-export plugin config functions
export {
  // Config loading
  loadConfig,
  loadConfigFile,
  loadPackageJsonConfig,
  findConfigFile,
  defineConfig,

  // Config resolution
  resolveConfig,
  validateConfig,
  normalizePluginEntry,

  // Error classes
  ConfigLoadError,
  ConfigValidationError,

  // Type guards
  isConfigLoadError,
  isConfigValidationError,

  // Constants
  CONFIG_FILE_NAMES,
  DEFAULT_CONFIG,
} from './plugin-config.js';

// Re-export plugin config types
export type {
  IceTypeConfig,
  PluginEntry,
  ResolvedPluginConfig,
  ResolvedConfig,
  LoadConfigOptions,
} from './plugin-config.js';

// Re-export adapter types (defined here to avoid cyclic dependencies)
export type {
  SchemaAdapter,
  AdapterRegistry,
  IcebergAdapterOptions,
  ParquetAdapterOptions,
} from './adapter-types.js';
