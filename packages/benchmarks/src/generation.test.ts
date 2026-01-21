/**
 * Generation Performance Target Tests
 *
 * RED phase: Define performance targets for IceType code generation operations.
 * These tests assert that generation meets the target performance metrics.
 *
 * Performance Targets:
 * - PostgreSQL DDL generation: < 5ms per schema
 * - MySQL DDL generation: < 5ms per schema
 * - SQLite DDL generation: < 5ms per schema
 * - Schema diff computation: < 10ms for schemas up to 100 fields
 * - Batch generation (100 schemas): < 500ms
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema, diffSchemas, type IceTypeSchema, type SchemaDefinition } from '@icetype/core';
import { PostgresAdapter } from '@icetype/postgres';
import { MySQLAdapter } from '@icetype/mysql';
import { SQLiteAdapter } from '@icetype/sqlite';
import { GENERATION_TARGETS, DIFF_TARGETS } from './targets.js';

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a schema definition with a variety of field types
 */
function generateSchema(entityName: string, fieldCount: number): SchemaDefinition {
  const schema: SchemaDefinition = {
    $type: entityName,
    $partitionBy: ['id'],
  };

  for (let i = 0; i < fieldCount; i++) {
    const type = i % 10;
    switch (type) {
      case 0:
        schema[`field${i}`] = 'uuid!';
        break;
      case 1:
        schema[`field${i}`] = 'string#';
        break;
      case 2:
        schema[`field${i}`] = 'text?';
        break;
      case 3:
        schema[`field${i}`] = 'int';
        break;
      case 4:
        schema[`field${i}`] = 'decimal(10,2)';
        break;
      case 5:
        schema[`field${i}`] = 'varchar(255)!';
        break;
      case 6:
        schema[`field${i}`] = 'timestamp = now()';
        break;
      case 7:
        schema[`field${i}`] = 'json?';
        break;
      case 8:
        schema[`field${i}`] = 'boolean = false';
        break;
      case 9:
        schema[`field${i}`] = 'float';
        break;
    }
  }

  return schema;
}

/**
 * Generate a modified schema for diff testing
 */
function generateModifiedSchema(
  original: SchemaDefinition,
  addFields: number,
  removeFields: number,
  changeFields: number
): SchemaDefinition {
  const modified: SchemaDefinition = { ...original };

  // Get field names (excluding directives)
  const fieldNames = Object.keys(original).filter((k) => !k.startsWith('$'));

  // Remove fields
  for (let i = 0; i < Math.min(removeFields, fieldNames.length); i++) {
    delete modified[fieldNames[i]!];
  }

  // Change fields
  for (let i = 0; i < Math.min(changeFields, fieldNames.length - removeFields); i++) {
    const fieldName = fieldNames[removeFields + i];
    if (fieldName) {
      // Change type
      modified[fieldName] = 'text?';
    }
  }

  // Add new fields
  for (let i = 0; i < addFields; i++) {
    modified[`newField${i}`] = 'string';
  }

  return modified;
}

/**
 * Parse multiple schemas
 */
function parseSchemas(count: number, fieldsPerSchema: number): IceTypeSchema[] {
  const schemas: IceTypeSchema[] = [];
  for (let i = 0; i < count; i++) {
    schemas.push(parseSchema(generateSchema(`Entity${i}`, fieldsPerSchema)));
  }
  return schemas;
}

// =============================================================================
// Adapter Instances
// =============================================================================

const postgresAdapter = new PostgresAdapter();
const mysqlAdapter = new MySQLAdapter();
const sqliteAdapter = new SQLiteAdapter();

// =============================================================================
// Performance Target Tests (RED phase)
// =============================================================================

describe('SQL Generation Performance Targets', () => {
  describe('PostgreSQL DDL Generation', () => {
    it(`should generate DDL for 20-field schema in < ${GENERATION_TARGETS.ddl20Fields}ms`, () => {
      const schema = parseSchema(generateSchema('TestEntity', 20));
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const ddl = postgresAdapter.transform(schema);
        postgresAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(GENERATION_TARGETS.ddl20Fields);
    });

    it(`should generate DDL for 100-field schema in < ${GENERATION_TARGETS.ddl100Fields}ms`, () => {
      const schema = parseSchema(generateSchema('LargeEntity', 100));
      const iterations = 50;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const ddl = postgresAdapter.transform(schema);
        postgresAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(GENERATION_TARGETS.ddl100Fields);
    });

    it(`should generate DDL for 100 schemas in < ${GENERATION_TARGETS.batch100Schemas}ms`, () => {
      const schemas = parseSchemas(100, 20);

      const start = performance.now();
      for (const schema of schemas) {
        const ddl = postgresAdapter.transform(schema);
        postgresAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(GENERATION_TARGETS.batch100Schemas);
    });
  });

  describe('MySQL DDL Generation', () => {
    it(`should generate DDL for 20-field schema in < ${GENERATION_TARGETS.ddl20Fields}ms`, () => {
      const schema = parseSchema(generateSchema('TestEntity', 20));
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const ddl = mysqlAdapter.transform(schema);
        mysqlAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(GENERATION_TARGETS.ddl20Fields);
    });

    it(`should generate DDL for 100 schemas in < ${GENERATION_TARGETS.batch100Schemas}ms`, () => {
      const schemas = parseSchemas(100, 20);

      const start = performance.now();
      for (const schema of schemas) {
        const ddl = mysqlAdapter.transform(schema);
        mysqlAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(GENERATION_TARGETS.batch100Schemas);
    });
  });

  describe('SQLite DDL Generation', () => {
    it(`should generate DDL for 20-field schema in < ${GENERATION_TARGETS.ddl20Fields}ms`, () => {
      const schema = parseSchema(generateSchema('TestEntity', 20));
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const ddl = sqliteAdapter.transform(schema);
        sqliteAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(GENERATION_TARGETS.ddl20Fields);
    });

    it(`should generate DDL for 100 schemas in < ${GENERATION_TARGETS.batch100Schemas}ms`, () => {
      const schemas = parseSchemas(100, 20);

      const start = performance.now();
      for (const schema of schemas) {
        const ddl = sqliteAdapter.transform(schema);
        sqliteAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(GENERATION_TARGETS.batch100Schemas);
    });
  });
});

describe('Diff Computation Performance Targets', () => {
  describe('Schema Diff', () => {
    it(`should compute diff for 20-field schemas in < ${DIFF_TARGETS.diff20Fields}ms`, () => {
      const original = generateSchema('TestEntity', 20);
      const modified = generateModifiedSchema(original, 5, 3, 4);

      const oldSchema = parseSchema(original);
      const newSchema = parseSchema(modified);

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        diffSchemas(oldSchema, newSchema);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(DIFF_TARGETS.diff20Fields);
    });

    it(`should compute diff for 100-field schemas in < ${DIFF_TARGETS.diff100Fields}ms`, () => {
      const original = generateSchema('LargeEntity', 100);
      const modified = generateModifiedSchema(original, 20, 15, 20);

      const oldSchema = parseSchema(original);
      const newSchema = parseSchema(modified);

      const iterations = 50;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        diffSchemas(oldSchema, newSchema);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(DIFF_TARGETS.diff100Fields);
    });

    it(`should compute diff for 100 schema pairs in < ${DIFF_TARGETS.batch100Pairs}ms`, () => {
      const schemaPairs: Array<{ old: IceTypeSchema; new: IceTypeSchema }> = [];
      for (let i = 0; i < 100; i++) {
        const original = generateSchema(`Entity${i}`, 20);
        const modified = generateModifiedSchema(original, 3, 2, 3);
        schemaPairs.push({
          old: parseSchema(original),
          new: parseSchema(modified),
        });
      }

      const start = performance.now();
      for (const pair of schemaPairs) {
        diffSchemas(pair.old, pair.new);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(DIFF_TARGETS.batch100Pairs);
    });
  });

  describe('Diff with Many Changes', () => {
    it(`should handle schema with 50% fields changed in < ${DIFF_TARGETS.highChurn100Fields}ms`, () => {
      const original = generateSchema('HighChurn', 100);
      const modified = generateModifiedSchema(original, 25, 25, 25);

      const oldSchema = parseSchema(original);
      const newSchema = parseSchema(modified);

      const iterations = 50;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        diffSchemas(oldSchema, newSchema);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(DIFF_TARGETS.highChurn100Fields);
    });
  });
});

describe('Combined Operations Performance Targets', () => {
  describe('Parse + Generate Pipeline', () => {
    it(`should parse and generate PostgreSQL DDL in < ${GENERATION_TARGETS.fullPipeline30Fields}ms total`, () => {
      const schemaDef = generateSchema('TestEntity', 30);
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const schema = parseSchema(schemaDef);
        const ddl = postgresAdapter.transform(schema);
        postgresAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(GENERATION_TARGETS.fullPipeline30Fields);
    });

    it(`should handle 100 schemas through full pipeline in < ${GENERATION_TARGETS.fullPipeline100Schemas}ms`, () => {
      const schemaDefs = Array.from({ length: 100 }, (_, i) => generateSchema(`Entity${i}`, 20));

      const start = performance.now();
      for (const schemaDef of schemaDefs) {
        const schema = parseSchema(schemaDef);
        const ddl = postgresAdapter.transform(schema);
        postgresAdapter.serialize(ddl);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(GENERATION_TARGETS.fullPipeline100Schemas);
    });
  });

  describe('Multi-dialect Generation', () => {
    it(`should generate DDL for all 3 dialects in < ${GENERATION_TARGETS.threeDialects30Fields}ms`, () => {
      const schema = parseSchema(generateSchema('TestEntity', 30));
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        // PostgreSQL
        const pgDDL = postgresAdapter.transform(schema);
        postgresAdapter.serialize(pgDDL);

        // MySQL
        const mysqlDDL = mysqlAdapter.transform(schema);
        mysqlAdapter.serialize(mysqlDDL);

        // SQLite
        const sqliteDDL = sqliteAdapter.transform(schema);
        sqliteAdapter.serialize(sqliteDDL);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(GENERATION_TARGETS.threeDialects30Fields);
    });
  });
});
