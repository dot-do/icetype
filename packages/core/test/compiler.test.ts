/**
 * Compiler Tests
 *
 * Tests for the GraphDL-based compiler entry point.
 * Following TDD: write failing tests first, then implement.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '@graphdl/core';
import {
  compile,
  compileEntity,
  graphToIceType,
  entityToIceType,
  GRAPHDL_TYPE_ALIASES,
} from '../src/compiler.js';

describe('Compiler', () => {
  describe('GRAPHDL_TYPE_ALIASES', () => {
    it('should have datetime -> timestamp alias', () => {
      expect(GRAPHDL_TYPE_ALIASES.datetime).toBe('timestamp');
    });

    it('should have markdown -> text alias', () => {
      expect(GRAPHDL_TYPE_ALIASES.markdown).toBe('text');
    });
  });

  describe('graphToIceType', () => {
    it('should convert a simple ParsedGraph to IceTypeSchema', () => {
      const graph = Graph({
        User: {
          $type: 'https://schema.org/Person',
          name: 'string',
          email: 'string!',
          age: 'int?',
        },
      });

      const schemas = graphToIceType(graph);

      expect(schemas.size).toBe(1);
      const userSchema = schemas.get('User');
      expect(userSchema).toBeDefined();
      expect(userSchema!.name).toBe('User');
      expect(userSchema!.fields.has('name')).toBe(true);
      expect(userSchema!.fields.has('email')).toBe(true);
      expect(userSchema!.fields.has('age')).toBe(true);
    });

    it('should handle multiple entities', () => {
      const graph = Graph({
        User: {
          name: 'string',
        },
        Post: {
          title: 'string',
          content: 'markdown',
        },
      });

      const schemas = graphToIceType(graph);

      expect(schemas.size).toBe(2);
      expect(schemas.has('User')).toBe(true);
      expect(schemas.has('Post')).toBe(true);
    });

    it('should convert GraphDL type aliases', () => {
      const graph = Graph({
        Event: {
          name: 'string',
          occurredAt: 'datetime',
          description: 'markdown',
        },
      });

      const schemas = graphToIceType(graph);
      const eventSchema = schemas.get('Event')!;

      // datetime should be converted to timestamp
      const occurredAtField = eventSchema.fields.get('occurredAt');
      expect(occurredAtField?.type).toBe('timestamp');

      // markdown should be converted to text
      const descriptionField = eventSchema.fields.get('description');
      expect(descriptionField?.type).toBe('text');
    });

    it('should preserve directives from ParsedEntity', () => {
      const graph = Graph({
        User: {
          $type: 'https://schema.org/Person',
          $partitionBy: ['tenantId'],
          $index: [['email'], ['createdAt']],
          $fts: ['bio'],
          name: 'string',
          email: 'string!',
          tenantId: 'string',
          bio: 'text',
        },
      });

      const schemas = graphToIceType(graph);
      const userSchema = schemas.get('User')!;

      expect(userSchema.directives.partitionBy).toEqual(['tenantId']);
      expect(userSchema.directives.index).toHaveLength(2);
      expect(userSchema.directives.fts).toEqual(['bio']);
    });

    it('should handle field modifiers correctly', () => {
      const graph = Graph({
        User: {
          id: 'uuid!',
          email: 'string#',
          nickname: 'string?',
          tags: 'string[]',
        },
      });

      const schemas = graphToIceType(graph);
      const userSchema = schemas.get('User')!;

      const idField = userSchema.fields.get('id')!;
      expect(idField.modifier).toBe('!');
      expect(idField.isUnique).toBe(true);

      const emailField = userSchema.fields.get('email')!;
      expect(emailField.modifier).toBe('#');
      expect(emailField.isIndexed).toBe(true);

      const nicknameField = userSchema.fields.get('nickname')!;
      expect(nicknameField.modifier).toBe('?');
      expect(nicknameField.isOptional).toBe(true);

      const tagsField = userSchema.fields.get('tags')!;
      expect(tagsField.isArray).toBe(true);
    });

    it('should handle relations', () => {
      const graph = Graph({
        User: {
          name: 'string',
          posts: '<-Post.author[]',
        },
        Post: {
          title: 'string',
          author: '->User',
        },
      });

      const schemas = graphToIceType(graph);
      const userSchema = schemas.get('User')!;
      const postSchema = schemas.get('Post')!;

      // Check User.posts relation
      const postsField = userSchema.fields.get('posts')!;
      expect(postsField.relation).toBeDefined();
      expect(postsField.relation?.operator).toBe('<-');
      expect(postsField.relation?.targetType).toBe('Post');

      // Check Post.author relation
      const authorField = postSchema.fields.get('author')!;
      expect(authorField.relation).toBeDefined();
      expect(authorField.relation?.operator).toBe('->');
      expect(authorField.relation?.targetType).toBe('User');
    });
  });

  describe('entityToIceType', () => {
    it('should convert a single ParsedEntity to IceTypeSchema', () => {
      const graph = Graph({
        User: {
          name: 'string',
          email: 'string!',
        },
      });

      const userEntity = graph.entities.get('User')!;
      const schema = entityToIceType(userEntity);

      expect(schema.name).toBe('User');
      expect(schema.fields.has('name')).toBe(true);
      expect(schema.fields.has('email')).toBe(true);
    });
  });

  describe('compile', () => {
    it('should compile a ParsedGraph to iceberg format', () => {
      const graph = Graph({
        User: {
          $partitionBy: ['tenantId'],
          name: 'string',
          tenantId: 'string',
        },
      });

      const result = compile(graph, 'iceberg', {
        location: 's3://bucket/tables/users',
      });

      expect(result).toBeDefined();
      expect(result.target).toBe('iceberg');
      expect(result.schemas.size).toBe(1);
    });

    it('should compile to parquet format', () => {
      const graph = Graph({
        Event: {
          name: 'string',
          timestamp: 'datetime',
        },
      });

      const result = compile(graph, 'parquet');

      expect(result).toBeDefined();
      expect(result.target).toBe('parquet');
    });

    it('should compile to clickhouse format', () => {
      const graph = Graph({
        Log: {
          message: 'string',
          level: 'string',
        },
      });

      const result = compile(graph, 'clickhouse');

      expect(result).toBeDefined();
      expect(result.target).toBe('clickhouse');
    });

    it('should compile to duckdb format', () => {
      const graph = Graph({
        Analytics: {
          event: 'string',
          count: 'int',
        },
      });

      const result = compile(graph, 'duckdb');

      expect(result).toBeDefined();
      expect(result.target).toBe('duckdb');
    });

    it('should compile to postgres format', () => {
      const graph = Graph({
        User: {
          name: 'string',
          email: 'string!',
        },
      });

      const result = compile(graph, 'postgres');

      expect(result).toBeDefined();
      expect(result.target).toBe('postgres');
    });

    it('should return IceTypeSchemas in the result', () => {
      const graph = Graph({
        User: { name: 'string' },
        Post: { title: 'string' },
      });

      const result = compile(graph, 'iceberg', {
        location: 's3://bucket/tables',
      });

      expect(result.schemas.size).toBe(2);
      expect(result.schemas.has('User')).toBe(true);
      expect(result.schemas.has('Post')).toBe(true);
    });
  });

  describe('compileEntity', () => {
    it('should compile a single ParsedEntity', () => {
      const graph = Graph({
        User: {
          name: 'string',
          email: 'string!',
        },
      });

      const userEntity = graph.entities.get('User')!;
      const result = compileEntity(userEntity, 'postgres');

      expect(result).toBeDefined();
      expect(result.target).toBe('postgres');
      expect(result.schema.name).toBe('User');
    });

    it('should compile entity to iceberg format', () => {
      const graph = Graph({
        Event: {
          $partitionBy: ['date'],
          name: 'string',
          date: 'date',
        },
      });

      const eventEntity = graph.entities.get('Event')!;
      const result = compileEntity(eventEntity, 'iceberg', {
        location: 's3://bucket/events',
      });

      expect(result).toBeDefined();
      expect(result.target).toBe('iceberg');
    });
  });

  describe('type conversion edge cases', () => {
    it('should handle numeric types from GraphDL', () => {
      const graph = Graph({
        Metrics: {
          intValue: 'int',
          floatValue: 'float',
          doubleValue: 'double',
          decimalValue: 'decimal',
        },
      });

      const schemas = graphToIceType(graph);
      const metricsSchema = schemas.get('Metrics')!;

      expect(metricsSchema.fields.get('intValue')?.type).toBe('int');
      expect(metricsSchema.fields.get('floatValue')?.type).toBe('float');
      expect(metricsSchema.fields.get('doubleValue')?.type).toBe('double');
      expect(metricsSchema.fields.get('decimalValue')?.type).toBe('decimal');
    });

    it('should handle empty graph', () => {
      const graph = Graph({});
      const schemas = graphToIceType(graph);
      expect(schemas.size).toBe(0);
    });

    it('should handle entity with no fields', () => {
      const graph = Graph({
        Empty: {},
      });

      const schemas = graphToIceType(graph);
      const emptySchema = schemas.get('Empty')!;
      expect(emptySchema.fields.size).toBe(0);
    });
  });
});
