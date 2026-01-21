/**
 * Tests for Prisma Schema Exporter
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchema } from '@icetype/core';
import type { IceTypeSchema } from '@icetype/core';

import {
  // Type mapping
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

  // Type mappings
  ICETYPE_TO_PRISMA_MAP,
  ICETYPE_DEFAULT_GENERATORS,
} from '../index.js';

import type { PrismaModelOutput, PrismaFieldOutput, PrismaEnumOutput } from '../types.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a simple test schema
 */
function createSimpleSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'User',
    id: 'uuid!',
    email: 'string#',
    name: 'string',
    age: 'int?',
  });
}

/**
 * Create a schema with all supported types
 */
function createAllTypesSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'AllTypes',
    stringField: 'string',
    textField: 'text',
    intField: 'int',
    longField: 'long',
    bigintField: 'bigint',
    floatField: 'float',
    doubleField: 'double',
    boolField: 'bool',
    booleanField: 'boolean',
    uuidField: 'uuid',
    timestampField: 'timestamp',
    timestamptzField: 'timestamptz',
    dateField: 'date',
    timeField: 'time',
    jsonField: 'json',
    binaryField: 'binary',
    decimalField: 'decimal',
  });
}

/**
 * Create a schema with timestamp fields for automatic defaults
 */
function createTimestampSchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Entity',
    id: 'uuid!',
    name: 'string',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  });
}

/**
 * Create a schema with array types
 */
function createArraySchema(): IceTypeSchema {
  return parseSchema({
    $type: 'Tags',
    id: 'uuid!',
    tags: 'string[]',
    scores: 'int[]',
  });
}

// =============================================================================
// Type Mapping Tests
// =============================================================================

describe('Type Mapping', () => {
  describe('ICETYPE_TO_PRISMA_MAP constant', () => {
    it('should map string to String', () => {
      expect(ICETYPE_TO_PRISMA_MAP['string']).toBe('String');
    });

    it('should map text to String', () => {
      expect(ICETYPE_TO_PRISMA_MAP['text']).toBe('String');
    });

    it('should map int to Int', () => {
      expect(ICETYPE_TO_PRISMA_MAP['int']).toBe('Int');
    });

    it('should map long to BigInt', () => {
      expect(ICETYPE_TO_PRISMA_MAP['long']).toBe('BigInt');
    });

    it('should map bigint to BigInt', () => {
      expect(ICETYPE_TO_PRISMA_MAP['bigint']).toBe('BigInt');
    });

    it('should map float to Float', () => {
      expect(ICETYPE_TO_PRISMA_MAP['float']).toBe('Float');
    });

    it('should map double to Float', () => {
      expect(ICETYPE_TO_PRISMA_MAP['double']).toBe('Float');
    });

    it('should map bool to Boolean', () => {
      expect(ICETYPE_TO_PRISMA_MAP['bool']).toBe('Boolean');
    });

    it('should map boolean to Boolean', () => {
      expect(ICETYPE_TO_PRISMA_MAP['boolean']).toBe('Boolean');
    });

    it('should map uuid to String', () => {
      expect(ICETYPE_TO_PRISMA_MAP['uuid']).toBe('String');
    });

    it('should map timestamp to DateTime', () => {
      expect(ICETYPE_TO_PRISMA_MAP['timestamp']).toBe('DateTime');
    });

    it('should map timestamptz to DateTime', () => {
      expect(ICETYPE_TO_PRISMA_MAP['timestamptz']).toBe('DateTime');
    });

    it('should map date to DateTime', () => {
      expect(ICETYPE_TO_PRISMA_MAP['date']).toBe('DateTime');
    });

    it('should map time to DateTime', () => {
      expect(ICETYPE_TO_PRISMA_MAP['time']).toBe('DateTime');
    });

    it('should map json to Json', () => {
      expect(ICETYPE_TO_PRISMA_MAP['json']).toBe('Json');
    });

    it('should map binary to Bytes', () => {
      expect(ICETYPE_TO_PRISMA_MAP['binary']).toBe('Bytes');
    });

    it('should map decimal to Decimal', () => {
      expect(ICETYPE_TO_PRISMA_MAP['decimal']).toBe('Decimal');
    });
  });

  describe('ICETYPE_DEFAULT_GENERATORS constant', () => {
    it('should provide uuid() generator for uuid type', () => {
      expect(ICETYPE_DEFAULT_GENERATORS['uuid']).toBe('uuid()');
    });

    it('should provide now() generator for timestamp type', () => {
      expect(ICETYPE_DEFAULT_GENERATORS['timestamp']).toBe('now()');
    });

    it('should provide now() generator for timestamptz type', () => {
      expect(ICETYPE_DEFAULT_GENERATORS['timestamptz']).toBe('now()');
    });
  });

  describe('mapIceTypeToPrisma()', () => {
    it('should map known types', () => {
      expect(mapIceTypeToPrisma('string')).toBe('String');
      expect(mapIceTypeToPrisma('int')).toBe('Int');
      expect(mapIceTypeToPrisma('uuid')).toBe('String');
      expect(mapIceTypeToPrisma('json')).toBe('Json');
    });

    it('should handle case insensitivity', () => {
      expect(mapIceTypeToPrisma('STRING')).toBe('String');
      expect(mapIceTypeToPrisma('Int')).toBe('Int');
      expect(mapIceTypeToPrisma('UUID')).toBe('String');
    });

    it('should return String for unknown types', () => {
      expect(mapIceTypeToPrisma('unknown')).toBe('String');
      expect(mapIceTypeToPrisma('customType')).toBe('String');
    });

    it('should use custom mappings when provided', () => {
      const customMappings = { string: 'Text', int: 'Integer' };
      expect(mapIceTypeToPrisma('string', customMappings)).toBe('Text');
      expect(mapIceTypeToPrisma('int', customMappings)).toBe('Integer');
    });

    it('should prefer custom mappings over defaults', () => {
      const customMappings = { uuid: 'UUID' };
      expect(mapIceTypeToPrisma('uuid', customMappings)).toBe('UUID');
    });
  });

  describe('getDefaultGenerator()', () => {
    it('should return uuid() for uuid type', () => {
      expect(getDefaultGenerator('uuid')).toBe('uuid()');
    });

    it('should return now() for timestamp type', () => {
      expect(getDefaultGenerator('timestamp')).toBe('now()');
    });

    it('should return undefined for types without default generators', () => {
      expect(getDefaultGenerator('string')).toBeUndefined();
      expect(getDefaultGenerator('int')).toBeUndefined();
      expect(getDefaultGenerator('json')).toBeUndefined();
    });
  });
});

// =============================================================================
// formatPrismaDefault() Tests
// =============================================================================

describe('formatPrismaDefault()', () => {
  it('should return null for null values', () => {
    expect(formatPrismaDefault(null, 'string')).toBeNull();
  });

  it('should format string values with quotes', () => {
    expect(formatPrismaDefault('hello', 'string')).toBe('"hello"');
  });

  it('should escape double quotes in strings', () => {
    expect(formatPrismaDefault('say "hello"', 'string')).toBe('"say \\"hello\\""');
  });

  it('should pass through function calls', () => {
    expect(formatPrismaDefault('uuid()', 'uuid')).toBe('uuid()');
    expect(formatPrismaDefault('now()', 'timestamp')).toBe('now()');
    expect(formatPrismaDefault('cuid()', 'string')).toBe('cuid()');
    expect(formatPrismaDefault('autoincrement()', 'int')).toBe('autoincrement()');
  });

  it('should format numbers', () => {
    expect(formatPrismaDefault(42, 'int')).toBe('42');
    expect(formatPrismaDefault(3.14, 'float')).toBe('3.14');
  });

  it('should format booleans', () => {
    expect(formatPrismaDefault(true, 'bool')).toBe('true');
    expect(formatPrismaDefault(false, 'bool')).toBe('false');
  });

  it('should handle JSON objects', () => {
    const obj = { key: 'value' };
    const result = formatPrismaDefault(obj, 'json');
    expect(result).toContain('key');
    expect(result).toContain('value');
  });
});

// =============================================================================
// fieldToPrismaField() Tests
// =============================================================================

describe('fieldToPrismaField()', () => {
  it('should convert simple string field', () => {
    const schema = createSimpleSchema();
    const field = schema.fields.get('name');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('name', field);
      expect(result.name).toBe('name');
      expect(result.type).toBe('String');
      expect(result.isOptional).toBe(false);
    }
  });

  it('should convert uuid field with default generator', () => {
    const schema = createSimpleSchema();
    const field = schema.fields.get('id');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('id', field);
      expect(result.name).toBe('id');
      expect(result.type).toBe('String');
      expect(result.attributes.some(a => a.includes('@default(uuid())'))).toBe(true);
    }
  });

  it('should convert unique field with @unique attribute', () => {
    const schema = createSimpleSchema();
    const field = schema.fields.get('email');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('email', field);
      expect(result.attributes).toContain('@unique');
    }
  });

  it('should convert optional field as optional', () => {
    const schema = createSimpleSchema();
    const field = schema.fields.get('age');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('age', field);
      expect(result.isOptional).toBe(true);
      expect(result.type).toBe('Int');
    }
  });

  it('should add @default(now()) for createdAt timestamp field', () => {
    const schema = createTimestampSchema();
    const field = schema.fields.get('createdAt');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('createdAt', field);
      expect(result.attributes.some(a => a.includes('@default(now())'))).toBe(true);
    }
  });

  it('should add @updatedAt for updatedAt timestamp field', () => {
    const schema = createTimestampSchema();
    const field = schema.fields.get('updatedAt');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('updatedAt', field);
      expect(result.attributes).toContain('@updatedAt');
    }
  });

  it('should handle array fields', () => {
    const schema = createArraySchema();
    const field = schema.fields.get('tags');
    expect(field).toBeDefined();
    if (field) {
      const result = fieldToPrismaField('tags', field);
      expect(result.isArray).toBe(true);
      expect(result.type).toBe('String');
    }
  });
});

// =============================================================================
// Datasource and Generator Block Tests
// =============================================================================

describe('generateDatasourceBlock()', () => {
  it('should generate default datasource block', () => {
    const block = generateDatasourceBlock();

    expect(block).toContain('datasource db {');
    expect(block).toContain('provider = "postgresql"');
    expect(block).toContain('url      = env("DATABASE_URL")');
    expect(block).toContain('}');
  });

  it('should use custom provider', () => {
    const block = generateDatasourceBlock({ provider: 'mysql' });
    expect(block).toContain('provider = "mysql"');
  });

  it('should use custom database URL', () => {
    const block = generateDatasourceBlock({ databaseUrl: '"postgres://localhost/db"' });
    expect(block).toContain('url      = "postgres://localhost/db"');
  });

  it('should use custom datasource name', () => {
    const block = generateDatasourceBlock({ datasourceName: 'database' });
    expect(block).toContain('datasource database {');
  });

  it('should support sqlite provider', () => {
    const block = generateDatasourceBlock({ provider: 'sqlite' });
    expect(block).toContain('provider = "sqlite"');
  });

  it('should support mongodb provider', () => {
    const block = generateDatasourceBlock({ provider: 'mongodb' });
    expect(block).toContain('provider = "mongodb"');
  });

  it('should support sqlserver provider', () => {
    const block = generateDatasourceBlock({ provider: 'sqlserver' });
    expect(block).toContain('provider = "sqlserver"');
  });
});

describe('generateGeneratorBlock()', () => {
  it('should generate default generator block', () => {
    const block = generateGeneratorBlock();

    expect(block).toContain('generator client {');
    expect(block).toContain('provider = "prisma-client-js"');
    expect(block).toContain('}');
  });

  it('should use custom generator name', () => {
    const block = generateGeneratorBlock({ generatorName: 'myClient' });
    expect(block).toContain('generator myClient {');
  });

  it('should use custom generator provider', () => {
    const block = generateGeneratorBlock({ generatorProvider: 'prisma-client-py' });
    expect(block).toContain('provider = "prisma-client-py"');
  });

  it('should include preview features', () => {
    const block = generateGeneratorBlock({
      previewFeatures: ['postgresqlExtensions', 'multiSchema'],
    });
    expect(block).toContain('previewFeatures = ["postgresqlExtensions", "multiSchema"]');
  });
});

// =============================================================================
// Field Serialization Tests
// =============================================================================

describe('serializePrismaField()', () => {
  it('should serialize simple required field', () => {
    const field: PrismaFieldOutput = {
      name: 'name',
      type: 'String',
      isOptional: false,
      isArray: false,
      attributes: [],
    };
    expect(serializePrismaField(field)).toBe('name String');
  });

  it('should serialize optional field', () => {
    const field: PrismaFieldOutput = {
      name: 'bio',
      type: 'String',
      isOptional: true,
      isArray: false,
      attributes: [],
    };
    expect(serializePrismaField(field)).toBe('bio String?');
  });

  it('should serialize array field', () => {
    const field: PrismaFieldOutput = {
      name: 'tags',
      type: 'String',
      isOptional: false,
      isArray: true,
      attributes: [],
    };
    expect(serializePrismaField(field)).toBe('tags String[]');
  });

  it('should serialize field with @id attribute', () => {
    const field: PrismaFieldOutput = {
      name: 'id',
      type: 'String',
      isOptional: false,
      isArray: false,
      attributes: ['@id', '@default(uuid())'],
    };
    expect(serializePrismaField(field)).toBe('id String @id @default(uuid())');
  });

  it('should serialize field with @unique attribute', () => {
    const field: PrismaFieldOutput = {
      name: 'email',
      type: 'String',
      isOptional: false,
      isArray: false,
      attributes: ['@unique'],
    };
    expect(serializePrismaField(field)).toBe('email String @unique');
  });

  it('should serialize field with @default attribute', () => {
    const field: PrismaFieldOutput = {
      name: 'createdAt',
      type: 'DateTime',
      isOptional: false,
      isArray: false,
      attributes: ['@default(now())'],
    };
    expect(serializePrismaField(field)).toBe('createdAt DateTime @default(now())');
  });

  it('should serialize field with @updatedAt attribute', () => {
    const field: PrismaFieldOutput = {
      name: 'updatedAt',
      type: 'DateTime',
      isOptional: false,
      isArray: false,
      attributes: ['@updatedAt'],
    };
    expect(serializePrismaField(field)).toBe('updatedAt DateTime @updatedAt');
  });
});

// =============================================================================
// Model Serialization Tests
// =============================================================================

describe('serializePrismaModel()', () => {
  it('should serialize simple model', () => {
    const model: PrismaModelOutput = {
      name: 'User',
      fields: [
        { name: 'id', type: 'String', isOptional: false, isArray: false, attributes: ['@id'] },
        { name: 'name', type: 'String', isOptional: false, isArray: false, attributes: [] },
      ],
    };

    const result = serializePrismaModel(model);
    expect(result).toContain('model User {');
    expect(result).toContain('id String @id');
    expect(result).toContain('name String');
    expect(result).toContain('}');
  });

  it('should serialize model with block attributes', () => {
    const model: PrismaModelOutput = {
      name: 'User',
      fields: [
        { name: 'id', type: 'String', isOptional: false, isArray: false, attributes: ['@id'] },
        { name: 'email', type: 'String', isOptional: false, isArray: false, attributes: [] },
        { name: 'name', type: 'String', isOptional: false, isArray: false, attributes: [] },
      ],
      blockAttributes: ['@@unique([email, name])', '@@index([email])'],
    };

    const result = serializePrismaModel(model);
    expect(result).toContain('@@unique([email, name])');
    expect(result).toContain('@@index([email])');
  });
});

// =============================================================================
// Enum Serialization Tests
// =============================================================================

describe('serializePrismaEnum()', () => {
  it('should serialize enum', () => {
    const prismaEnum: PrismaEnumOutput = {
      name: 'Role',
      values: ['USER', 'ADMIN', 'MODERATOR'],
    };

    const result = serializePrismaEnum(prismaEnum);
    expect(result).toContain('enum Role {');
    expect(result).toContain('USER');
    expect(result).toContain('ADMIN');
    expect(result).toContain('MODERATOR');
    expect(result).toContain('}');
  });
});

// =============================================================================
// schemaToPrismaModel() Tests
// =============================================================================

describe('schemaToPrismaModel()', () => {
  it('should convert simple schema to Prisma model', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema);

    expect(model.name).toBe('User');
    expect(model.fields.length).toBeGreaterThan(0);
  });

  it('should add primary key to id field', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema);

    const idField = model.fields.find(f => f.name === 'id');
    expect(idField?.attributes).toContain('@id');
  });

  it('should add @default(uuid()) to uuid id field', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema);

    const idField = model.fields.find(f => f.name === 'id');
    expect(idField?.attributes.some(a => a.includes('@default(uuid())'))).toBe(true);
  });

  it('should add @unique to unique fields', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema);

    const emailField = model.fields.find(f => f.name === 'email');
    expect(emailField?.attributes).toContain('@unique');
  });

  it('should mark optional fields as optional', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema);

    const ageField = model.fields.find(f => f.name === 'age');
    expect(ageField?.isOptional).toBe(true);
  });

  it('should handle timestamp fields with automatic defaults', () => {
    const schema = createTimestampSchema();
    const model = schemaToPrismaModel(schema);

    const createdAtField = model.fields.find(f => f.name === 'createdAt');
    const updatedAtField = model.fields.find(f => f.name === 'updatedAt');

    expect(createdAtField?.attributes.some(a => a.includes('@default(now())'))).toBe(true);
    expect(updatedAtField?.attributes).toContain('@updatedAt');
  });

  it('should skip system fields by default', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema);

    const fieldNames = model.fields.map(f => f.name);
    expect(fieldNames).not.toContain('$id');
    expect(fieldNames).not.toContain('$type');
  });

  it('should include system fields when requested', () => {
    const schema = createSimpleSchema();
    const model = schemaToPrismaModel(schema, { includeSystemFields: true });

    const fieldNames = model.fields.map(f => f.name);
    // The schema should have an id field added if none exists
    expect(fieldNames).toContain('id');
  });

  it('should add default id field if none exists', () => {
    const schema = parseSchema({
      $type: 'NoId',
      name: 'string',
    });
    const model = schemaToPrismaModel(schema);

    const idField = model.fields.find(f => f.name === 'id');
    expect(idField).toBeDefined();
    expect(idField?.attributes).toContain('@id');
  });
});

// =============================================================================
// transformToPrisma() Tests
// =============================================================================

describe('transformToPrisma()', () => {
  it('should transform schema to Prisma model string', () => {
    const schema = createSimpleSchema();
    const result = transformToPrisma(schema);

    expect(result).toContain('model User {');
    expect(result).toContain('id String');
    expect(result).toContain('@id');
    expect(result).toContain('}');
  });

  it('should include all fields', () => {
    const schema = createSimpleSchema();
    const result = transformToPrisma(schema);

    expect(result).toContain('email');
    expect(result).toContain('name');
    expect(result).toContain('age');
  });

  it('should include type information', () => {
    const schema = createSimpleSchema();
    const result = transformToPrisma(schema);

    expect(result).toContain('String');
    expect(result).toContain('Int');
  });
});

// =============================================================================
// generatePrismaSchema() Tests
// =============================================================================

describe('generatePrismaSchema()', () => {
  it('should generate complete schema with datasource and generator', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchema([schema]);

    expect(result).toContain('datasource db {');
    expect(result).toContain('generator client {');
    expect(result).toContain('model User {');
  });

  it('should use default postgresql provider', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchema([schema]);

    expect(result).toContain('provider = "postgresql"');
  });

  it('should use custom provider', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchema([schema], { provider: 'mysql' });

    expect(result).toContain('provider = "mysql"');
  });

  it('should handle multiple schemas', () => {
    const userSchema = createSimpleSchema();
    const typedSchema = createAllTypesSchema();

    const result = generatePrismaSchema([userSchema, typedSchema]);

    expect(result).toContain('model User {');
    expect(result).toContain('model AllTypes {');
  });

  it('should end with newline', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchema([schema]);

    expect(result.endsWith('\n')).toBe(true);
  });
});

// =============================================================================
// generatePrismaSchemaOutput() Tests
// =============================================================================

describe('generatePrismaSchemaOutput()', () => {
  it('should return structured output with schema string', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchemaOutput([schema]);

    expect(result.schema).toBeDefined();
    expect(typeof result.schema).toBe('string');
    expect(result.schema).toContain('model User {');
  });

  it('should return models array', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchemaOutput([schema]);

    expect(result.models).toHaveLength(1);
    expect(result.models[0]?.name).toBe('User');
  });

  it('should return empty enums array', () => {
    const schema = createSimpleSchema();
    const result = generatePrismaSchemaOutput([schema]);

    expect(result.enums).toHaveLength(0);
  });

  it('should handle multiple schemas', () => {
    const userSchema = createSimpleSchema();
    const typedSchema = createAllTypesSchema();

    const result = generatePrismaSchemaOutput([userSchema, typedSchema]);

    expect(result.models).toHaveLength(2);
  });
});

// =============================================================================
// PrismaAdapter Tests
// =============================================================================

describe('PrismaAdapter', () => {
  let adapter: PrismaAdapter;

  beforeEach(() => {
    adapter = new PrismaAdapter();
  });

  describe('properties', () => {
    it('should have name "prisma"', () => {
      expect(adapter.name).toBe('prisma');
    });

    it('should have version "0.1.0"', () => {
      expect(adapter.version).toBe('0.1.0');
    });
  });

  describe('transform()', () => {
    it('should transform schema to PrismaModelOutput', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema);

      expect(result.name).toBe('User');
      expect(result.fields).toBeDefined();
      expect(Array.isArray(result.fields)).toBe(true);
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const result = adapter.transform(schema, { includeSystemFields: true });

      expect(result).toBeDefined();
    });
  });

  describe('serialize()', () => {
    it('should serialize PrismaModelOutput to string', () => {
      const schema = createSimpleSchema();
      const model = adapter.transform(schema);
      const result = adapter.serialize(model);

      expect(typeof result).toBe('string');
      expect(result).toContain('model User {');
    });
  });

  describe('generateSchema()', () => {
    it('should generate complete schema from multiple IceType schemas', () => {
      const userSchema = createSimpleSchema();
      const result = adapter.generateSchema([userSchema]);

      expect(result).toContain('datasource db {');
      expect(result).toContain('generator client {');
      expect(result).toContain('model User {');
    });

    it('should accept options', () => {
      const schema = createSimpleSchema();
      const result = adapter.generateSchema([schema], { provider: 'sqlite' });

      expect(result).toContain('provider = "sqlite"');
    });
  });
});

// =============================================================================
// createPrismaAdapter() Factory Tests
// =============================================================================

describe('createPrismaAdapter()', () => {
  it('should create a new PrismaAdapter instance', () => {
    const adapter = createPrismaAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(PrismaAdapter);
  });

  it('should create independent adapter instances', () => {
    const adapter1 = createPrismaAdapter();
    const adapter2 = createPrismaAdapter();

    expect(adapter1).not.toBe(adapter2);
  });

  it('should create adapter with correct interface methods', () => {
    const adapter = createPrismaAdapter();

    expect(typeof adapter.transform).toBe('function');
    expect(typeof adapter.serialize).toBe('function');
    expect(typeof adapter.generateSchema).toBe('function');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.version).toBe('string');
  });
});

// =============================================================================
// All Types Mapping Tests
// =============================================================================

describe('All Types Mapping', () => {
  it('should map all IceType types correctly', () => {
    const schema = createAllTypesSchema();
    const model = schemaToPrismaModel(schema);

    const findField = (name: string) => model.fields.find(f => f.name === name);

    expect(findField('stringField')?.type).toBe('String');
    expect(findField('textField')?.type).toBe('String');
    expect(findField('intField')?.type).toBe('Int');
    expect(findField('longField')?.type).toBe('BigInt');
    expect(findField('bigintField')?.type).toBe('BigInt');
    expect(findField('floatField')?.type).toBe('Float');
    expect(findField('doubleField')?.type).toBe('Float');
    expect(findField('boolField')?.type).toBe('Boolean');
    expect(findField('booleanField')?.type).toBe('Boolean');
    expect(findField('uuidField')?.type).toBe('String');
    expect(findField('timestampField')?.type).toBe('DateTime');
    expect(findField('timestamptzField')?.type).toBe('DateTime');
    expect(findField('dateField')?.type).toBe('DateTime');
    expect(findField('timeField')?.type).toBe('DateTime');
    expect(findField('jsonField')?.type).toBe('Json');
    expect(findField('binaryField')?.type).toBe('Bytes');
    expect(findField('decimalField')?.type).toBe('Decimal');
  });
});

// =============================================================================
// Array Types Tests
// =============================================================================

describe('Array Types', () => {
  it('should handle array fields', () => {
    const schema = createArraySchema();
    const model = schemaToPrismaModel(schema);

    const tagsField = model.fields.find(f => f.name === 'tags');
    const scoresField = model.fields.find(f => f.name === 'scores');

    expect(tagsField?.isArray).toBe(true);
    expect(scoresField?.isArray).toBe(true);
  });

  it('should serialize array types correctly', () => {
    const schema = createArraySchema();
    const result = transformToPrisma(schema);

    expect(result).toContain('String[]');
    expect(result).toContain('Int[]');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration Tests', () => {
  it('should produce valid Prisma schema for User model', () => {
    const schema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      email: 'string#',
      name: 'string',
      age: 'int?',
      createdAt: 'timestamp',
      updatedAt: 'timestamp',
    });

    const result = generatePrismaSchema([schema], { provider: 'postgresql' });

    // Validate structure
    expect(result).toContain('datasource db {');
    expect(result).toContain('generator client {');
    expect(result).toContain('model User {');

    // Validate fields
    expect(result).toContain('id String @id @default(uuid())');
    expect(result).toContain('email String @unique');
    expect(result).toContain('name String');
    expect(result).toContain('age Int?');
    expect(result).toContain('createdAt DateTime @default(now())');
    expect(result).toContain('updatedAt DateTime @updatedAt');
  });

  it('should handle complex schema with multiple models', () => {
    const userSchema = parseSchema({
      $type: 'User',
      id: 'uuid!',
      email: 'string#',
      name: 'string',
    });

    const postSchema = parseSchema({
      $type: 'Post',
      id: 'uuid!',
      title: 'string!',
      content: 'text?',
      published: 'boolean',
      authorId: 'string!',
      createdAt: 'timestamp',
    });

    const result = generatePrismaSchema([userSchema, postSchema]);

    expect(result).toContain('model User {');
    expect(result).toContain('model Post {');
    expect(result).toContain('title String');
    expect(result).toContain('content String?');
    expect(result).toContain('published Boolean');
    expect(result).toContain('authorId String');
  });

  it('should work end-to-end with PrismaAdapter', () => {
    const adapter = createPrismaAdapter();
    const schema = createSimpleSchema();

    // Transform
    const model = adapter.transform(schema);
    expect(model.name).toBe('User');

    // Serialize
    const serialized = adapter.serialize(model);
    expect(serialized).toContain('model User {');

    // Generate complete schema
    const fullSchema = adapter.generateSchema([schema], {
      provider: 'mysql',
      previewFeatures: ['fullTextSearch'],
    });

    expect(fullSchema).toContain('provider = "mysql"');
    expect(fullSchema).toContain('previewFeatures = ["fullTextSearch"]');
    expect(fullSchema).toContain('model User {');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('should handle schema with no user fields', () => {
    const schema = parseSchema({
      $type: 'EmptyEntity',
    });

    const model = schemaToPrismaModel(schema);

    // Should still have an id field
    expect(model.fields.length).toBeGreaterThan(0);
    const idField = model.fields.find(f => f.name === 'id');
    expect(idField).toBeDefined();
  });

  it('should handle schema with special characters in name', () => {
    const schema = parseSchema({
      $type: 'MySpecialEntity',
      id: 'uuid!',
    });

    const result = transformToPrisma(schema);
    expect(result).toContain('model MySpecialEntity {');
  });

  it('should handle reserved field names', () => {
    const schema = parseSchema({
      $type: 'Reserved',
      id: 'uuid!',
      select: 'string',
      from: 'string',
    });

    const model = schemaToPrismaModel(schema);
    const fieldNames = model.fields.map(f => f.name);

    expect(fieldNames).toContain('select');
    expect(fieldNames).toContain('from');
  });
});
