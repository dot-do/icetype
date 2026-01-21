/**
 * Parser Performance Target Tests
 *
 * RED phase: Define performance targets for IceType parsing operations.
 * These tests assert that parsing meets the target performance metrics.
 *
 * Performance Targets:
 * - Single schema parsing: < 1ms
 * - 100 entities: < 100ms total (< 1ms/entity)
 * - 1000 entities: < 1000ms total (< 1ms/entity)
 * - Memory usage: < 10KB per entity for large schemas
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema, tokenize } from '@icetype/core';
import type { SchemaDefinition } from '@icetype/core';
import { PARSER_TARGETS, MEMORY_TARGETS } from './targets.js';

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
// Performance Target Tests (RED phase - these define our targets)
// =============================================================================

describe('Parser Performance Targets', () => {
  describe('Single Schema Parsing', () => {
    it(`should parse a simple 10-field schema in < ${PARSER_TARGETS.simpleSchema10Fields}ms`, () => {
      const schema = generateSimpleSchema('TestEntity', 10);
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseSchema(schema);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(PARSER_TARGETS.simpleSchema10Fields);
    });

    it(`should parse a complex 50-field schema in < ${PARSER_TARGETS.complexSchema50Fields}ms`, () => {
      const schema = generateComplexSchema('ComplexEntity', 50);
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseSchema(schema);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(PARSER_TARGETS.complexSchema50Fields);
    });
  });

  describe('Large Schema Performance', () => {
    it(`should parse 100 entities in < ${PARSER_TARGETS.batch100Entities}ms (< ${PARSER_TARGETS.perEntityAverage}ms/entity average)`, () => {
      const schemas = generateMultiEntitySchemas(100, 20);

      const start = performance.now();
      for (const schema of schemas) {
        parseSchema(schema);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(PARSER_TARGETS.batch100Entities);
      expect(elapsed / schemas.length).toBeLessThan(PARSER_TARGETS.perEntityAverage);
    });

    it(`should parse 1000 entities in < ${PARSER_TARGETS.batch1000Entities}ms (< ${PARSER_TARGETS.perEntityAverage}ms/entity average)`, () => {
      const schemas = generateMultiEntitySchemas(1000, 20);

      const start = performance.now();
      for (const schema of schemas) {
        parseSchema(schema);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(PARSER_TARGETS.batch1000Entities);
      expect(elapsed / schemas.length).toBeLessThan(PARSER_TARGETS.perEntityAverage);
    });
  });

  describe('Tokenizer Performance', () => {
    it(`should tokenize a 1000-character schema definition in < ${PARSER_TARGETS.tokenize1000Chars}ms`, () => {
      // Generate a long schema definition string
      let input = '{ $type: "TestEntity", ';
      for (let i = 0; i < 60; i++) {
        input += `field${i}: "string!", `;
      }
      input += '}';

      expect(input.length).toBeGreaterThan(1000);

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        tokenize(input);
      }
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(PARSER_TARGETS.tokenize1000Chars);
    });
  });

  describe('Memory Usage Targets', () => {
    it(`should use < ${MEMORY_TARGETS.perEntity / 1024}KB per entity for 100 entity schema`, () => {
      // Note: This is an approximation using JSON serialization
      // Real memory usage would need to be measured with process.memoryUsage()
      const schemas = generateMultiEntitySchemas(100, 20);
      const parsedSchemas = schemas.map(parseSchema);

      // Estimate memory by serializing to JSON
      const serialized = JSON.stringify(
        parsedSchemas.map((s) => ({
          name: s.name,
          fields: Array.from(s.fields.entries()),
          relations: Array.from(s.relations.entries()),
          directives: s.directives,
        }))
      );

      const bytesPerEntity = serialized.length / schemas.length;

      // Target: < 10KB per entity
      expect(bytesPerEntity).toBeLessThan(MEMORY_TARGETS.perEntity);
    });

    it(`should maintain linear memory growth with entity count (within ${MEMORY_TARGETS.linearGrowthTolerance}% tolerance)`, () => {
      const smallSchemas = generateMultiEntitySchemas(10, 20);
      const largeSchemas = generateMultiEntitySchemas(100, 20);

      const smallParsed = smallSchemas.map(parseSchema);
      const largeParsed = largeSchemas.map(parseSchema);

      const smallSize = JSON.stringify(
        smallParsed.map((s) => ({
          name: s.name,
          fields: Array.from(s.fields.entries()),
          relations: Array.from(s.relations.entries()),
        }))
      ).length;

      const largeSize = JSON.stringify(
        largeParsed.map((s) => ({
          name: s.name,
          fields: Array.from(s.fields.entries()),
          relations: Array.from(s.relations.entries()),
        }))
      ).length;

      // Memory should scale roughly linearly
      const expectedRatio = largeSchemas.length / smallSchemas.length; // 10x
      const actualRatio = largeSize / smallSize;
      const tolerance = MEMORY_TARGETS.linearGrowthTolerance / 100;

      expect(actualRatio).toBeGreaterThan(expectedRatio * (1 - tolerance));
      expect(actualRatio).toBeLessThan(expectedRatio * (1 + tolerance));
    });
  });
});
