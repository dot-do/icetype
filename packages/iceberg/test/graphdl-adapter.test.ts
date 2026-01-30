/**
 * GraphDL Adapter Tests
 *
 * Tests for Iceberg adapter with GraphDL ParsedGraph input.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '@graphdl/core';
import {
  compileGraphToIceberg,
  compileEntityToIceberg,
} from '../src/graphdl-adapter.js';

describe('GraphDL Iceberg Adapter', () => {
  describe('compileGraphToIceberg', () => {
    it('should compile a ParsedGraph to Iceberg metadata', () => {
      const graph = Graph({
        User: {
          $partitionBy: ['tenantId'],
          id: 'uuid!',
          name: 'string',
          email: 'string#',
          tenantId: 'string',
        },
      });

      const result = compileGraphToIceberg(graph, {
        baseLocation: 's3://bucket/tables',
      });

      expect(result).toBeDefined();
      expect(result.size).toBe(1);
      expect(result.has('User')).toBe(true);

      const userMetadata = result.get('User')!;
      expect(userMetadata.location).toBe('s3://bucket/tables/User');
      expect(userMetadata.formatVersion).toBe(2);
    });

    it('should handle multiple entities', () => {
      const graph = Graph({
        User: {
          id: 'uuid!',
          name: 'string',
        },
        Post: {
          id: 'uuid!',
          title: 'string',
        },
      });

      const result = compileGraphToIceberg(graph, {
        baseLocation: 's3://bucket/tables',
      });

      expect(result.size).toBe(2);
      expect(result.has('User')).toBe(true);
      expect(result.has('Post')).toBe(true);

      expect(result.get('User')!.location).toBe('s3://bucket/tables/User');
      expect(result.get('Post')!.location).toBe('s3://bucket/tables/Post');
    });

    it('should apply partition spec from directives', () => {
      const graph = Graph({
        Event: {
          $partitionBy: ['date', 'eventType'],
          id: 'uuid!',
          date: 'date',
          eventType: 'string',
          payload: 'json',
        },
      });

      const result = compileGraphToIceberg(graph, {
        baseLocation: 's3://bucket/events',
      });

      const eventMetadata = result.get('Event')!;
      const partitionSpec = eventMetadata.partitionSpecs[0];

      // Should have partition fields for date and eventType
      expect(partitionSpec.fields.length).toBeGreaterThanOrEqual(1);
    });

    it('should use custom location per entity if provided', () => {
      const graph = Graph({
        User: {
          id: 'uuid!',
          name: 'string',
        },
      });

      const result = compileGraphToIceberg(graph, {
        baseLocation: 's3://bucket/default',
        locations: {
          User: 's3://bucket/custom/users',
        },
      });

      const userMetadata = result.get('User')!;
      expect(userMetadata.location).toBe('s3://bucket/custom/users');
    });

    it('should pass through custom properties', () => {
      const graph = Graph({
        Data: {
          id: 'uuid!',
          value: 'string',
        },
      });

      const result = compileGraphToIceberg(graph, {
        baseLocation: 's3://bucket/data',
        properties: {
          'write.parquet.compression-codec': 'zstd',
          'custom.property': 'value',
        },
      });

      const metadata = result.get('Data')!;
      expect(metadata.properties['write.parquet.compression-codec']).toBe('zstd');
      expect(metadata.properties['custom.property']).toBe('value');
    });

    it('should handle GraphDL type aliases (datetime, markdown)', () => {
      const graph = Graph({
        Article: {
          id: 'uuid!',
          title: 'string',
          content: 'markdown',
          publishedAt: 'datetime',
        },
      });

      const result = compileGraphToIceberg(graph, {
        baseLocation: 's3://bucket/articles',
      });

      const metadata = result.get('Article')!;
      const schema = metadata.schemas[0];

      // markdown should be converted to string in Iceberg
      const contentField = schema.fields.find((f) => f.name === 'content');
      expect(contentField?.type.type).toBe('string');

      // datetime should be converted to timestamp
      const publishedAtField = schema.fields.find((f) => f.name === 'publishedAt');
      expect(publishedAtField?.type.type).toBe('timestamp');
    });
  });

  describe('compileEntityToIceberg', () => {
    it('should compile a single ParsedEntity', () => {
      const graph = Graph({
        User: {
          id: 'uuid!',
          name: 'string',
        },
      });

      const userEntity = graph.entities.get('User')!;
      const metadata = compileEntityToIceberg(userEntity, {
        location: 's3://bucket/users',
      });

      expect(metadata).toBeDefined();
      expect(metadata.location).toBe('s3://bucket/users');
    });

    it('should throw if location is not provided', () => {
      const graph = Graph({
        User: {
          id: 'uuid!',
        },
      });

      const userEntity = graph.entities.get('User')!;

      expect(() => compileEntityToIceberg(userEntity, {} as never)).toThrow();
    });

    it('should handle all IceType primitive types', () => {
      const graph = Graph({
        AllTypes: {
          strField: 'string',
          intField: 'int',
          longField: 'long',
          floatField: 'float',
          doubleField: 'double',
          boolField: 'boolean',
          uuidField: 'uuid',
          dateField: 'date',
          timestampField: 'timestamp',
          jsonField: 'json',
        },
      });

      const entity = graph.entities.get('AllTypes')!;
      const metadata = compileEntityToIceberg(entity, {
        location: 's3://bucket/all-types',
      });

      expect(metadata).toBeDefined();
      const schema = metadata.schemas[0];

      // Verify types are mapped correctly
      const strField = schema.fields.find((f) => f.name === 'strField');
      expect(strField?.type.type).toBe('string');

      const intField = schema.fields.find((f) => f.name === 'intField');
      expect(intField?.type.type).toBe('int');

      const boolField = schema.fields.find((f) => f.name === 'boolField');
      expect(boolField?.type.type).toBe('boolean');

      const uuidField = schema.fields.find((f) => f.name === 'uuidField');
      expect(uuidField?.type.type).toBe('uuid');
    });

    it('should handle array types', () => {
      const graph = Graph({
        Tags: {
          id: 'uuid!',
          values: 'string[]',
        },
      });

      const entity = graph.entities.get('Tags')!;
      const metadata = compileEntityToIceberg(entity, {
        location: 's3://bucket/tags',
      });

      const schema = metadata.schemas[0];
      const valuesField = schema.fields.find((f) => f.name === 'values');
      expect(valuesField?.type.type).toBe('list');
    });

    it('should handle optional fields', () => {
      const graph = Graph({
        Profile: {
          id: 'uuid!',
          bio: 'string?',
          avatar: 'string?',
        },
      });

      const entity = graph.entities.get('Profile')!;
      const metadata = compileEntityToIceberg(entity, {
        location: 's3://bucket/profiles',
      });

      const schema = metadata.schemas[0];
      const bioField = schema.fields.find((f) => f.name === 'bio');
      expect(bioField?.required).toBe(false);
    });
  });
});
