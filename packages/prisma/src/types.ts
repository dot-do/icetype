/**
 * Type definitions for Prisma schema import/export and IceType conversion
 *
 * Supports both:
 * - Import: Parse Prisma schemas and convert to IceType
 * - Export: Generate Prisma schemas from IceType schemas
 *
 * @packageDocumentation
 */

// =============================================================================
// Prisma Type Definitions
// =============================================================================

/**
 * Prisma scalar types that map directly to IceType primitives
 */
export type PrismaScalarType =
  | 'String'
  | 'Int'
  | 'BigInt'
  | 'Float'
  | 'Decimal'
  | 'Boolean'
  | 'DateTime'
  | 'Json'
  | 'Bytes';

/**
 * Prisma attribute with name and optional arguments
 */
export interface PrismaAttribute {
  /** Attribute name (e.g., 'id', 'unique', 'default', 'relation') */
  name: string;
  /** Attribute arguments (e.g., 'uuid()' for @default(uuid())) */
  args?: string[];
}

/**
 * Parsed Prisma field definition
 */
export interface PrismaField {
  /** Field name */
  name: string;
  /** Field type (scalar type or model reference) */
  type: string;
  /** Whether the field is an array */
  isArray: boolean;
  /** Whether the field is optional */
  isOptional: boolean;
  /** Field attributes (@id, @unique, @default, etc.) */
  attributes: PrismaAttribute[];
}

/**
 * Parsed Prisma model definition
 */
export interface PrismaModel {
  /** Model name */
  name: string;
  /** Model fields */
  fields: PrismaField[];
}

/**
 * Parsed Prisma enum definition
 */
export interface PrismaEnum {
  /** Enum name */
  name: string;
  /** Enum values */
  values: string[];
}

/**
 * Complete parsed Prisma schema
 */
export interface ParsedPrismaSchema {
  /** Parsed models */
  models: PrismaModel[];
  /** Parsed enums */
  enums: PrismaEnum[];
}

// =============================================================================
// IceType Output Types
// =============================================================================

/**
 * IceType field definition object (raw format for conversion output)
 */
export interface IceTypeFieldDefinition {
  /** The IceType type string (e.g., 'uuid!', 'string#', 'int?') */
  type: string;
}

/**
 * IceType schema definition object
 *
 * This is the raw object format that can be passed to parseSchema()
 */
export interface IceTypeSchemaDefinition {
  /** Schema/entity type name */
  $type: string;
  /** Partition key fields */
  $partitionBy?: string[];
  /** Secondary indexes */
  $index?: string[][];
  /** Full-text search fields */
  $fts?: string[];
  /** Vector index configuration */
  $vector?: Record<string, number>;
  /** Field definitions (string values for simple types) */
  [key: string]: unknown;
}

// =============================================================================
// Type Mapping Configuration
// =============================================================================

/**
 * Configuration for Prisma to IceType type mapping
 */
export interface TypeMappingConfig {
  /** Prisma scalar type */
  prisma: PrismaScalarType;
  /** Corresponding IceType base type */
  icetype: string;
}

/**
 * Mapping table for Prisma scalar types to IceType types
 */
export const PRISMA_TYPE_MAPPINGS: TypeMappingConfig[] = [
  { prisma: 'String', icetype: 'string' },
  { prisma: 'Int', icetype: 'int' },
  { prisma: 'BigInt', icetype: 'bigint' },
  { prisma: 'Float', icetype: 'float' },
  { prisma: 'Decimal', icetype: 'double' },
  { prisma: 'Boolean', icetype: 'bool' },
  { prisma: 'DateTime', icetype: 'timestamp' },
  { prisma: 'Json', icetype: 'json' },
  { prisma: 'Bytes', icetype: 'binary' },
];

/**
 * Map of Prisma types to IceType types
 */
export const PRISMA_TO_ICETYPE_MAP: Record<string, string> = {
  String: 'string',
  Int: 'int',
  BigInt: 'bigint',
  Float: 'float',
  Decimal: 'double',
  Boolean: 'bool',
  DateTime: 'timestamp',
  Json: 'json',
  Bytes: 'binary',
};

// =============================================================================
// Import Options
// =============================================================================

/**
 * Options for Prisma schema import
 */
export interface PrismaImportOptions {
  /**
   * Whether to include relation fields in output
   * @default true
   */
  includeRelations?: boolean;

  /**
   * Whether to convert unique constraints to IceType # modifier
   * @default true
   */
  convertUniqueToIndexed?: boolean;

  /**
   * Whether to include @db.* native type annotations as comments
   * @default false
   */
  includeNativeTypeComments?: boolean;

  /**
   * Custom type mappings to override defaults
   */
  customTypeMappings?: Record<string, string>;
}

// =============================================================================
// Export Types (IceType -> Prisma)
// =============================================================================

/**
 * Supported Prisma datasource providers
 */
export type PrismaProvider =
  | 'postgresql'
  | 'mysql'
  | 'sqlite'
  | 'sqlserver'
  | 'mongodb';

/**
 * Prisma datasource configuration
 */
export interface PrismaDatasource {
  /** Datasource name (typically 'db') */
  name: string;
  /** Database provider */
  provider: PrismaProvider;
  /** Database connection URL or environment variable reference */
  url: string;
}

/**
 * Prisma generator configuration
 */
export interface PrismaGenerator {
  /** Generator name (typically 'client') */
  name: string;
  /** Generator provider (e.g., 'prisma-client-js') */
  provider: string;
  /** Optional output path */
  output?: string;
  /** Optional preview features */
  previewFeatures?: string[];
}

/**
 * Prisma schema export output
 */
export interface PrismaSchemaOutput {
  /** The generated Prisma schema as a string */
  schema: string;
  /** Generated model definitions */
  models: PrismaModelOutput[];
  /** Generated enum definitions */
  enums: PrismaEnumOutput[];
}

/**
 * Generated Prisma model output
 */
export interface PrismaModelOutput {
  /** Model name */
  name: string;
  /** Field definitions */
  fields: PrismaFieldOutput[];
  /** Block attributes (@@unique, @@index, etc.) */
  blockAttributes?: string[];
}

/**
 * Generated Prisma field output
 */
export interface PrismaFieldOutput {
  /** Field name */
  name: string;
  /** Prisma type */
  type: string;
  /** Whether the field is optional */
  isOptional: boolean;
  /** Whether the field is an array */
  isArray: boolean;
  /** Field attributes */
  attributes: string[];
}

/**
 * Generated Prisma enum output
 */
export interface PrismaEnumOutput {
  /** Enum name */
  name: string;
  /** Enum values */
  values: string[];
}

/**
 * Options for Prisma schema export
 */
export interface PrismaExportOptions {
  /**
   * Database provider
   * @default 'postgresql'
   */
  provider?: PrismaProvider;

  /**
   * Database URL or environment variable reference
   * @default 'env("DATABASE_URL")'
   */
  databaseUrl?: string;

  /**
   * Datasource name
   * @default 'db'
   */
  datasourceName?: string;

  /**
   * Generator name
   * @default 'client'
   */
  generatorName?: string;

  /**
   * Generator provider
   * @default 'prisma-client-js'
   */
  generatorProvider?: string;

  /**
   * Whether to include system fields ($id, $type, etc.)
   * @default false
   */
  includeSystemFields?: boolean;

  /**
   * Preview features to enable
   */
  previewFeatures?: string[];

  /**
   * Custom type mappings to override defaults
   */
  customTypeMappings?: Record<string, string>;

  /**
   * Whether to generate @@map attributes for table name mapping
   * @default false
   */
  generateTableMaps?: boolean;
}

// =============================================================================
// IceType to Prisma Type Mapping
// =============================================================================

/**
 * Mapping configuration from IceType to Prisma
 */
export interface IceTypeToPrismaMappingConfig {
  /** IceType base type */
  icetype: string;
  /** Corresponding Prisma scalar type */
  prisma: string;
  /** Optional default attribute generator (e.g., 'uuid()' for uuid type) */
  defaultGenerator?: string;
}

/**
 * Mapping table for IceType types to Prisma scalar types
 */
export const ICETYPE_TO_PRISMA_MAPPINGS: IceTypeToPrismaMappingConfig[] = [
  { icetype: 'string', prisma: 'String' },
  { icetype: 'text', prisma: 'String' },
  { icetype: 'int', prisma: 'Int' },
  { icetype: 'long', prisma: 'BigInt' },
  { icetype: 'bigint', prisma: 'BigInt' },
  { icetype: 'float', prisma: 'Float' },
  { icetype: 'double', prisma: 'Float' },
  { icetype: 'bool', prisma: 'Boolean' },
  { icetype: 'boolean', prisma: 'Boolean' },
  { icetype: 'uuid', prisma: 'String', defaultGenerator: 'uuid()' },
  { icetype: 'timestamp', prisma: 'DateTime' },
  { icetype: 'timestamptz', prisma: 'DateTime' },
  { icetype: 'date', prisma: 'DateTime' },
  { icetype: 'time', prisma: 'DateTime' },
  { icetype: 'json', prisma: 'Json' },
  { icetype: 'binary', prisma: 'Bytes' },
  { icetype: 'decimal', prisma: 'Decimal' },
];

/**
 * Map of IceType types to Prisma types
 */
export const ICETYPE_TO_PRISMA_MAP: Record<string, string> = {
  string: 'String',
  text: 'String',
  int: 'Int',
  long: 'BigInt',
  bigint: 'BigInt',
  float: 'Float',
  double: 'Float',
  bool: 'Boolean',
  boolean: 'Boolean',
  uuid: 'String',
  timestamp: 'DateTime',
  timestamptz: 'DateTime',
  date: 'DateTime',
  time: 'DateTime',
  json: 'Json',
  binary: 'Bytes',
  decimal: 'Decimal',
};

/**
 * Map of IceType types to Prisma default generators
 */
export const ICETYPE_DEFAULT_GENERATORS: Record<string, string> = {
  uuid: 'uuid()',
  timestamp: 'now()',
  timestamptz: 'now()',
};
