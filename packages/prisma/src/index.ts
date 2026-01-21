/**
 * @icetype/prisma
 *
 * Prisma schema import and export capability for IceType.
 *
 * This package provides functionality to:
 * - Parse Prisma schema files (.prisma) and convert them to IceType schema definitions
 * - Export IceType schemas to Prisma schema format
 *
 * @example Import Prisma to IceType
 * ```typescript
 * import { parsePrismaSchema, parsePrismaFile } from '@icetype/prisma';
 *
 * // Parse a Prisma schema string
 * const schemas = parsePrismaSchema(`
 *   model User {
 *     id    String @id @default(uuid())
 *     email String @unique
 *     name  String?
 *     posts Post[]
 *   }
 *
 *   model Post {
 *     id       String @id @default(uuid())
 *     title    String
 *     content  String?
 *     author   User   @relation(fields: [authorId], references: [id])
 *     authorId String
 *   }
 * `);
 *
 * // Result:
 * // [
 * //   { $type: 'User', id: 'uuid!#', email: 'string!#', name: 'string?', posts: '[Post]' },
 * //   { $type: 'Post', id: 'uuid!#', title: 'string!', content: 'string?', author: 'User!', authorId: 'string!' }
 * // ]
 *
 * // Parse a Prisma schema file
 * const fileSchemas = await parsePrismaFile('./prisma/schema.prisma');
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Prisma types
  PrismaScalarType,
  PrismaAttribute,
  PrismaField,
  PrismaModel,
  PrismaEnum,
  ParsedPrismaSchema,
  // IceType types
  IceTypeFieldDefinition,
  IceTypeSchemaDefinition,
  // Import options
  PrismaImportOptions,
  // Export options
  PrismaExportOptions,
  PrismaProvider,
  PrismaDatasource,
  PrismaGenerator,
  PrismaSchemaOutput,
  PrismaModelOutput,
  PrismaFieldOutput,
  PrismaEnumOutput,
  // Mapping config
  TypeMappingConfig,
  IceTypeToPrismaMappingConfig,
} from './types.js';

// =============================================================================
// Constants
// =============================================================================

export {
  PRISMA_TYPE_MAPPINGS,
  PRISMA_TO_ICETYPE_MAP,
  ICETYPE_TO_PRISMA_MAPPINGS,
  ICETYPE_TO_PRISMA_MAP,
  ICETYPE_DEFAULT_GENERATORS,
} from './types.js';

// =============================================================================
// Import Functions (Prisma -> IceType)
// =============================================================================

export {
  parsePrismaSchema,
  parsePrismaFile,
  parsePrismaSchemaToAst,
  convertPrismaModel,
} from './importer.js';

// =============================================================================
// Export Functions (IceType -> Prisma)
// =============================================================================

export {
  // Type mapping functions
  mapIceTypeToPrisma,
  getDefaultGenerator,

  // Field generation
  fieldToPrismaField,
  formatPrismaDefault,

  // Model generation
  schemaToPrismaModel,

  // Schema generation blocks
  generateDatasourceBlock,
  generateGeneratorBlock,

  // Serialization
  serializePrismaField,
  serializePrismaModel,
  serializePrismaEnum,

  // Main export functions
  transformToPrisma,
  generatePrismaSchema,
  generatePrismaSchemaOutput,

  // Adapter class and factory
  PrismaAdapter,
  createPrismaAdapter,
} from './exporter.js';
