/**
 * Generation Performance Benchmarks (vitest bench mode)
 *
 * Run with: pnpm --filter @icetype/benchmarks bench
 *
 * These benchmarks measure the actual performance of IceType generation operations.
 * For target-based tests, see generation.test.ts
 *
 * @packageDocumentation
 */

import { describe, bench } from 'vitest';
import { parseSchema, diffSchemas, type IceTypeSchema, type SchemaDefinition } from '@icetype/core';
import { PostgresAdapter } from '@icetype/postgres';
import { MySQLAdapter } from '@icetype/mysql';
import { SQLiteAdapter } from '@icetype/sqlite';

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
// Vitest Benchmarks
// =============================================================================

describe('Generation Benchmarks', () => {
  const schema20 = parseSchema(generateSchema('Bench20', 20));
  const schema50 = parseSchema(generateSchema('Bench50', 50));
  const schema100 = parseSchema(generateSchema('Bench100', 100));

  bench('PostgreSQL DDL (20 fields)', () => {
    const ddl = postgresAdapter.transform(schema20);
    postgresAdapter.serialize(ddl);
  });

  bench('PostgreSQL DDL (50 fields)', () => {
    const ddl = postgresAdapter.transform(schema50);
    postgresAdapter.serialize(ddl);
  });

  bench('PostgreSQL DDL (100 fields)', () => {
    const ddl = postgresAdapter.transform(schema100);
    postgresAdapter.serialize(ddl);
  });

  bench('MySQL DDL (20 fields)', () => {
    const ddl = mysqlAdapter.transform(schema20);
    mysqlAdapter.serialize(ddl);
  });

  bench('SQLite DDL (20 fields)', () => {
    const ddl = sqliteAdapter.transform(schema20);
    sqliteAdapter.serialize(ddl);
  });
});

describe('Diff Benchmarks', () => {
  const original20 = generateSchema('Diff20', 20);
  const modified20 = generateModifiedSchema(original20, 5, 3, 4);
  const oldSchema20 = parseSchema(original20);
  const newSchema20 = parseSchema(modified20);

  const original100 = generateSchema('Diff100', 100);
  const modified100 = generateModifiedSchema(original100, 20, 15, 20);
  const oldSchema100 = parseSchema(original100);
  const newSchema100 = parseSchema(modified100);

  bench('diffSchemas (20 fields)', () => {
    diffSchemas(oldSchema20, newSchema20);
  });

  bench('diffSchemas (100 fields)', () => {
    diffSchemas(oldSchema100, newSchema100);
  });
});

describe('Batch Benchmarks', () => {
  const schemas100 = parseSchemas(100, 20);

  bench('batch PostgreSQL DDL (100 schemas)', () => {
    for (const schema of schemas100) {
      const ddl = postgresAdapter.transform(schema);
      postgresAdapter.serialize(ddl);
    }
  });

  bench('batch MySQL DDL (100 schemas)', () => {
    for (const schema of schemas100) {
      const ddl = mysqlAdapter.transform(schema);
      mysqlAdapter.serialize(ddl);
    }
  });

  bench('batch SQLite DDL (100 schemas)', () => {
    for (const schema of schemas100) {
      const ddl = sqliteAdapter.transform(schema);
      sqliteAdapter.serialize(ddl);
    }
  });
});
