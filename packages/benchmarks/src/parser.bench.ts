/**
 * Parser Performance Benchmarks (vitest bench mode)
 *
 * Run with: pnpm --filter @icetype/benchmarks bench
 *
 * These benchmarks measure the actual performance of IceType parsing operations.
 * For target-based tests, see parser.test.ts
 *
 * @packageDocumentation
 */

import { describe, bench } from 'vitest';
import { parseSchema, tokenize } from '@icetype/core';
import type { SchemaDefinition } from '@icetype/core';

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a simple schema definition with n fields
 */
function generateSimpleSchema(entityName: string, fieldCount: number): SchemaDefinition {
  const schema: SchemaDefinition = {
    $type: entityName,
  };

  for (let i = 0; i < fieldCount; i++) {
    const fieldTypes = ['string', 'int', 'float', 'boolean', 'uuid', 'timestamp'];
    const modifiers = ['', '!', '?', '#'];
    const type = fieldTypes[i % fieldTypes.length];
    const modifier = modifiers[i % modifiers.length];
    schema[`field${i}`] = `${type}${modifier}`;
  }

  return schema;
}

/**
 * Generate a complex schema with relations, arrays, and directives
 */
function generateComplexSchema(entityName: string, fieldCount: number): SchemaDefinition {
  const schema: SchemaDefinition = {
    $type: entityName,
    $partitionBy: ['id'],
    $index: [['createdAt'], ['updatedAt']],
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
        schema[`field${i}`] = 'int[]';
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
        schema[`field${i}`] = `-> Entity${i % 5}`;
        break;
      case 9:
        schema[`field${i}`] = `<- Entity${i % 5}.field${i}[]`;
        break;
    }
  }

  return schema;
}

/**
 * Generate multiple entity schemas for large schema tests
 */
function generateMultiEntitySchemas(entityCount: number, fieldsPerEntity: number): SchemaDefinition[] {
  const schemas: SchemaDefinition[] = [];
  for (let i = 0; i < entityCount; i++) {
    schemas.push(generateComplexSchema(`Entity${i}`, fieldsPerEntity));
  }
  return schemas;
}

// =============================================================================
// Vitest Benchmarks
// =============================================================================

describe('Parser Benchmarks', () => {
  const simpleSchema10 = generateSimpleSchema('Simple10', 10);
  const simpleSchema50 = generateSimpleSchema('Simple50', 50);
  const complexSchema20 = generateComplexSchema('Complex20', 20);
  const complexSchema50 = generateComplexSchema('Complex50', 50);

  bench('parse simple schema (10 fields)', () => {
    parseSchema(simpleSchema10);
  });

  bench('parse simple schema (50 fields)', () => {
    parseSchema(simpleSchema50);
  });

  bench('parse complex schema (20 fields)', () => {
    parseSchema(complexSchema20);
  });

  bench('parse complex schema (50 fields)', () => {
    parseSchema(complexSchema50);
  });

  bench('tokenize schema definition', () => {
    tokenize('{ $type: "User", id: "uuid!", name: "string", email: "string#" }');
  });
});

describe('Large Schema Benchmarks', () => {
  const schemas100 = generateMultiEntitySchemas(100, 20);
  const schemas1000 = generateMultiEntitySchemas(1000, 10);

  bench('parse 100 entities (20 fields each)', () => {
    for (const schema of schemas100) {
      parseSchema(schema);
    }
  });

  bench('parse 1000 entities (10 fields each)', () => {
    for (const schema of schemas1000) {
      parseSchema(schema);
    }
  });
});
