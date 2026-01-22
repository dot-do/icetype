/**
 * Tests for type mapping edge cases in Iceberg/Parquet conversion
 *
 * Covers:
 * - Array types -> LIST
 * - Nested types
 * - Decimal with precision/scale
 * - Relation fields
 * - Unknown types
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '@icetype/core';
import { generateIcebergMetadata } from '../src/metadata.js';
import { generateParquetSchema, generateParquetSchemaString } from '../src/parquet.js';

// =============================================================================
// Array Types -> LIST Tests
// =============================================================================

describe('Array types -> LIST', () => {
  describe('Iceberg LIST type', () => {
    it('should convert string[] to LIST with string element', () => {
      const schema = parseSchema({
        $type: 'Document',
        tags: 'string[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/docs');
      const icebergSchema = metadata.schemas[0]!;

      const tagsField = icebergSchema.fields.find(f => f.name === 'tags');
      expect(tagsField?.type.type).toBe('list');
      expect(tagsField?.type.elementType?.type).toBe('string');
    });

    it('should convert int[] to LIST with int element', () => {
      const schema = parseSchema({
        $type: 'Stats',
        values: 'int[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/stats');
      const icebergSchema = metadata.schemas[0]!;

      const valuesField = icebergSchema.fields.find(f => f.name === 'values');
      expect(valuesField?.type.type).toBe('list');
      expect(valuesField?.type.elementType?.type).toBe('int');
    });

    it('should convert long[] to LIST with long element', () => {
      const schema = parseSchema({
        $type: 'Metrics',
        timestamps: 'long[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/metrics');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'timestamps');
      expect(field?.type.type).toBe('list');
      expect(field?.type.elementType?.type).toBe('long');
    });

    it('should convert double[] to LIST with double element', () => {
      const schema = parseSchema({
        $type: 'Scores',
        ratings: 'double[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/scores');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'ratings');
      expect(field?.type.type).toBe('list');
      expect(field?.type.elementType?.type).toBe('double');
    });

    it('should convert boolean[] to LIST with boolean element', () => {
      const schema = parseSchema({
        $type: 'Flags',
        flags: 'boolean[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/flags');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'flags');
      expect(field?.type.type).toBe('list');
      expect(field?.type.elementType?.type).toBe('boolean');
    });

    it('should convert uuid[] to LIST with uuid element', () => {
      const schema = parseSchema({
        $type: 'References',
        refs: 'uuid[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/refs');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'refs');
      expect(field?.type.type).toBe('list');
      expect(field?.type.elementType?.type).toBe('uuid');
    });

    it('should convert timestamp[] to LIST with timestamp element', () => {
      const schema = parseSchema({
        $type: 'Timeline',
        events: 'timestamp[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/timeline');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'events');
      expect(field?.type.type).toBe('list');
      expect(field?.type.elementType?.type).toBe('timestamp');
    });
  });

  describe('Parquet LIST type', () => {
    it('should produce correct Parquet LIST structure for arrays', () => {
      const schema = parseSchema({
        $type: 'Document',
        tags: 'string[]',
      });
      const parquetSchema = generateParquetSchema(schema);

      const tagsField = parquetSchema.fields.find(f => f.name === 'tags');
      expect(tagsField?.convertedType).toBe('LIST');
      expect(tagsField?.logicalType?.type).toBe('LIST');
    });

    it('should have proper nested structure: group -> list (REPEATED) -> element', () => {
      const schema = parseSchema({
        $type: 'Document',
        tags: 'string[]',
      });
      const parquetSchema = generateParquetSchema(schema);

      const tagsField = parquetSchema.fields.find(f => f.name === 'tags');
      expect(tagsField?.children).toBeDefined();
      expect(tagsField?.children?.length).toBe(1);

      const listGroup = tagsField?.children?.[0];
      expect(listGroup?.name).toBe('list');
      expect(listGroup?.repetition).toBe('REPEATED');

      const element = listGroup?.children?.[0];
      expect(element?.name).toBe('element');
      expect(element?.repetition).toBe('OPTIONAL');
    });

    it('should show LIST in schema string output', () => {
      const schema = parseSchema({
        $type: 'Document',
        tags: 'string[]',
      });
      const schemaString = generateParquetSchemaString(schema);

      expect(schemaString).toContain('group tags (LIST)');
      expect(schemaString).toContain('REPEATED group list');
    });
  });
});

// =============================================================================
// Decimal Type with Precision/Scale Tests
// =============================================================================

describe('Decimal with precision/scale', () => {
  describe('Iceberg decimal type', () => {
    it('should map decimal to Iceberg decimal with default precision/scale', () => {
      const schema = parseSchema({
        $type: 'Account',
        balance: 'decimal',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/accounts');
      const icebergSchema = metadata.schemas[0]!;

      const balanceField = icebergSchema.fields.find(f => f.name === 'balance');
      expect(balanceField?.type.type).toBe('decimal');
      expect(balanceField?.type.precision).toBe(38);
      expect(balanceField?.type.scale).toBe(9);
    });
  });

  describe('Parquet decimal type', () => {
    it('should map decimal to BYTE_ARRAY with DECIMAL converted type', () => {
      const schema = parseSchema({
        $type: 'Account',
        balance: 'decimal',
      });
      const parquetSchema = generateParquetSchema(schema);

      const balanceField = parquetSchema.fields.find(f => f.name === 'balance');
      expect(balanceField?.type).toBe('BYTE_ARRAY');
      expect(balanceField?.convertedType).toBe('DECIMAL');
    });

    it('should include precision and scale in Parquet decimal', () => {
      const schema = parseSchema({
        $type: 'Account',
        balance: 'decimal',
      });
      const parquetSchema = generateParquetSchema(schema);

      const balanceField = parquetSchema.fields.find(f => f.name === 'balance');
      expect(balanceField?.precision).toBe(38);
      expect(balanceField?.scale).toBe(9);
    });

    it('should include logical type with precision/scale', () => {
      const schema = parseSchema({
        $type: 'Account',
        balance: 'decimal',
      });
      const parquetSchema = generateParquetSchema(schema);

      const balanceField = parquetSchema.fields.find(f => f.name === 'balance');
      expect(balanceField?.logicalType?.type).toBe('DECIMAL');
      expect(balanceField?.logicalType?.precision).toBe(38);
      expect(balanceField?.logicalType?.scale).toBe(9);
    });

    it('should show DECIMAL in schema string', () => {
      const schema = parseSchema({
        $type: 'Account',
        balance: 'decimal',
      });
      const schemaString = generateParquetSchemaString(schema);

      expect(schemaString).toContain('balance');
      expect(schemaString).toContain('(DECIMAL)');
    });
  });
});

// =============================================================================
// Relation Fields Tests
// =============================================================================

describe('Relation fields', () => {
  describe('Forward relations (->) as string references', () => {
    it('should convert forward relation to string in Iceberg', () => {
      const schema = parseSchema({
        $type: 'Order',
        customer: '-> Customer',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/orders');
      const icebergSchema = metadata.schemas[0]!;

      const customerField = icebergSchema.fields.find(f => f.name === 'customer');
      expect(customerField?.type.type).toBe('string');
    });

    it('should convert forward relation to BYTE_ARRAY UTF8 in Parquet', () => {
      const schema = parseSchema({
        $type: 'Order',
        customer: '-> Customer',
      });
      const parquetSchema = generateParquetSchema(schema);

      const customerField = parquetSchema.fields.find(f => f.name === 'customer');
      expect(customerField?.type).toBe('BYTE_ARRAY');
      expect(customerField?.convertedType).toBe('UTF8');
    });
  });

  describe('Array relations (->[] or []) as LIST of strings', () => {
    it('should convert array relation to LIST of strings in Iceberg', () => {
      const schema = parseSchema({
        $type: 'User',
        posts: '<- Post.author[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/users');
      const icebergSchema = metadata.schemas[0]!;

      const postsField = icebergSchema.fields.find(f => f.name === 'posts');
      expect(postsField?.type.type).toBe('list');
      expect(postsField?.type.elementType?.type).toBe('string');
    });

    it('should convert array relation to LIST in Parquet', () => {
      const schema = parseSchema({
        $type: 'User',
        posts: '<- Post.author[]',
      });
      const parquetSchema = generateParquetSchema(schema);

      const postsField = parquetSchema.fields.find(f => f.name === 'posts');
      expect(postsField?.convertedType).toBe('LIST');

      const element = postsField?.children?.[0]?.children?.[0];
      expect(element?.type).toBe('BYTE_ARRAY');
      expect(element?.convertedType).toBe('UTF8');
    });
  });

  describe('Backward relations (<-)', () => {
    it('should handle backward relations as strings', () => {
      const schema = parseSchema({
        $type: 'Comment',
        post: '<- Post',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/comments');
      const icebergSchema = metadata.schemas[0]!;

      const postField = icebergSchema.fields.find(f => f.name === 'post');
      expect(postField?.type.type).toBe('string');
    });
  });

  describe('Fuzzy relations (~>)', () => {
    it('should handle fuzzy forward relations as strings', () => {
      const schema = parseSchema({
        $type: 'Article',
        similarArticles: '~> Article[]',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/articles');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'similarArticles');
      expect(field?.type.type).toBe('list');
      expect(field?.type.elementType?.type).toBe('string');
    });
  });
});

// =============================================================================
// Unknown/Custom Types Tests
// =============================================================================

describe('Unknown/Custom types', () => {
  it('should default unknown types to string in Iceberg', () => {
    const schema = parseSchema({
      $type: 'Custom',
      customField: 'CustomType',
    });
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/custom');
    const icebergSchema = metadata.schemas[0]!;

    const customField = icebergSchema.fields.find(f => f.name === 'customField');
    expect(customField?.type.type).toBe('string');
  });

  it('should default unknown types to BYTE_ARRAY UTF8 in Parquet', () => {
    const schema = parseSchema({
      $type: 'Custom',
      customField: 'CustomType',
    });
    const parquetSchema = generateParquetSchema(schema);

    const customField = parquetSchema.fields.find(f => f.name === 'customField');
    expect(customField?.type).toBe('BYTE_ARRAY');
    expect(customField?.convertedType).toBe('UTF8');
    expect(customField?.logicalType?.type).toBe('STRING');
  });
});

// =============================================================================
// Type Alias Tests (bool -> boolean, bigint -> long, etc.)
// =============================================================================

describe('Type aliases', () => {
  it('should handle bool as boolean', () => {
    const schema = parseSchema({
      $type: 'Flags',
      active: 'bool',
    });
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/flags');
    const icebergSchema = metadata.schemas[0]!;

    const field = icebergSchema.fields.find(f => f.name === 'active');
    expect(field?.type.type).toBe('boolean');
  });

  it('should handle bigint as long', () => {
    const schema = parseSchema({
      $type: 'Counter',
      count: 'bigint',
    });
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/counters');
    const icebergSchema = metadata.schemas[0]!;

    const field = icebergSchema.fields.find(f => f.name === 'count');
    expect(field?.type.type).toBe('long');
  });

  it('should handle text as string', () => {
    const schema = parseSchema({
      $type: 'Article',
      content: 'text',
    });
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/articles');
    const icebergSchema = metadata.schemas[0]!;

    const field = icebergSchema.fields.find(f => f.name === 'content');
    expect(field?.type.type).toBe('string');
  });
});

// =============================================================================
// Time-related Type Tests
// =============================================================================

describe('Time-related types', () => {
  describe('timestamp vs timestamptz', () => {
    it('should handle timestamp (local time)', () => {
      const schema = parseSchema({
        $type: 'Event',
        localTime: 'timestamp',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/events');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'localTime');
      expect(field?.type.type).toBe('timestamp');
    });

    it('should handle timestamptz (UTC time)', () => {
      const schema = parseSchema({
        $type: 'Event',
        utcTime: 'timestamptz',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/events');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'utcTime');
      expect(field?.type.type).toBe('timestamptz');
    });

    it('should set isAdjustedToUTC correctly in Parquet for timestamp', () => {
      const schema = parseSchema({
        $type: 'Event',
        localTime: 'timestamp',
      });
      const parquetSchema = generateParquetSchema(schema);

      const field = parquetSchema.fields.find(f => f.name === 'localTime');
      expect(field?.logicalType?.isAdjustedToUTC).toBe(false);
    });

    it('should set isAdjustedToUTC correctly in Parquet for timestamptz', () => {
      const schema = parseSchema({
        $type: 'Event',
        utcTime: 'timestamptz',
      });
      const parquetSchema = generateParquetSchema(schema);

      const field = parquetSchema.fields.find(f => f.name === 'utcTime');
      expect(field?.logicalType?.isAdjustedToUTC).toBe(true);
    });
  });

  describe('date type', () => {
    it('should handle date in Iceberg', () => {
      const schema = parseSchema({
        $type: 'Record',
        recordDate: 'date',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/records');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'recordDate');
      expect(field?.type.type).toBe('date');
    });

    it('should handle date as INT32 DATE in Parquet', () => {
      const schema = parseSchema({
        $type: 'Record',
        recordDate: 'date',
      });
      const parquetSchema = generateParquetSchema(schema);

      const field = parquetSchema.fields.find(f => f.name === 'recordDate');
      expect(field?.type).toBe('INT32');
      expect(field?.convertedType).toBe('DATE');
    });
  });

  describe('time type', () => {
    it('should handle time in Iceberg', () => {
      const schema = parseSchema({
        $type: 'Schedule',
        startTime: 'time',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/schedules');
      const icebergSchema = metadata.schemas[0]!;

      const field = icebergSchema.fields.find(f => f.name === 'startTime');
      expect(field?.type.type).toBe('time');
    });

    it('should handle time as INT32 TIME_MILLIS in Parquet', () => {
      const schema = parseSchema({
        $type: 'Schedule',
        startTime: 'time',
      });
      const parquetSchema = generateParquetSchema(schema);

      const field = parquetSchema.fields.find(f => f.name === 'startTime');
      expect(field?.type).toBe('INT32');
      expect(field?.convertedType).toBe('TIME_MILLIS');
    });
  });
});

// =============================================================================
// Binary Type Tests
// =============================================================================

describe('Binary type', () => {
  it('should handle binary in Iceberg', () => {
    const schema = parseSchema({
      $type: 'Blob',
      data: 'binary',
    });
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/blobs');
    const icebergSchema = metadata.schemas[0]!;

    const field = icebergSchema.fields.find(f => f.name === 'data');
    expect(field?.type.type).toBe('binary');
  });

  it('should handle binary as BYTE_ARRAY (no converted type) in Parquet', () => {
    const schema = parseSchema({
      $type: 'Blob',
      data: 'binary',
    });
    const parquetSchema = generateParquetSchema(schema);

    const field = parquetSchema.fields.find(f => f.name === 'data');
    expect(field?.type).toBe('BYTE_ARRAY');
    expect(field?.convertedType).toBeUndefined();
  });
});

// =============================================================================
// JSON Type Tests
// =============================================================================

describe('JSON type', () => {
  it('should handle json as string in Iceberg', () => {
    const schema = parseSchema({
      $type: 'Config',
      settings: 'json',
    });
    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/configs');
    const icebergSchema = metadata.schemas[0]!;

    const field = icebergSchema.fields.find(f => f.name === 'settings');
    expect(field?.type.type).toBe('string');
  });

  it('should handle json as BYTE_ARRAY JSON in Parquet', () => {
    const schema = parseSchema({
      $type: 'Config',
      settings: 'json',
    });
    const parquetSchema = generateParquetSchema(schema);

    const field = parquetSchema.fields.find(f => f.name === 'settings');
    expect(field?.type).toBe('BYTE_ARRAY');
    expect(field?.convertedType).toBe('JSON');
    expect(field?.logicalType?.type).toBe('JSON');
  });
});

// =============================================================================
// Required/Optional Modifier Tests
// =============================================================================

describe('Required/Optional modifiers', () => {
  describe('Iceberg required field', () => {
    it('should mark ! fields as required', () => {
      const schema = parseSchema({
        $type: 'Entity',
        id: 'uuid!',
        name: 'string!',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/entities');
      const icebergSchema = metadata.schemas[0]!;

      const idField = icebergSchema.fields.find(f => f.name === 'id');
      const nameField = icebergSchema.fields.find(f => f.name === 'name');

      expect(idField?.required).toBe(true);
      expect(nameField?.required).toBe(true);
    });

    it('should mark ? fields as optional (required=false)', () => {
      const schema = parseSchema({
        $type: 'Entity',
        nickname: 'string?',
      });
      const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/entities');
      const icebergSchema = metadata.schemas[0]!;

      const nicknameField = icebergSchema.fields.find(f => f.name === 'nickname');
      expect(nicknameField?.required).toBe(false);
    });
  });

  describe('Parquet repetition', () => {
    it('should use REQUIRED for ! fields', () => {
      const schema = parseSchema({
        $type: 'Entity',
        id: 'uuid!',
      });
      const parquetSchema = generateParquetSchema(schema);

      const idField = parquetSchema.fields.find(f => f.name === 'id');
      expect(idField?.repetition).toBe('REQUIRED');
    });

    it('should use OPTIONAL for ? fields', () => {
      const schema = parseSchema({
        $type: 'Entity',
        nickname: 'string?',
      });
      const parquetSchema = generateParquetSchema(schema);

      const nicknameField = parquetSchema.fields.find(f => f.name === 'nickname');
      expect(nicknameField?.repetition).toBe('OPTIONAL');
    });
  });
});

// =============================================================================
// Complex Schema Tests
// =============================================================================

describe('Complex schemas', () => {
  it('should handle schema with multiple field types', () => {
    const schema = parseSchema({
      $type: 'ComplexEntity',
      id: 'uuid!',
      name: 'string!',
      description: 'text?',
      count: 'int',
      amount: 'double',
      isActive: 'boolean',
      tags: 'string[]',
      scores: 'int[]',
      createdAt: 'timestamp',
      metadata: 'json',
      owner: '-> User',
    });

    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/complex');
    const icebergSchema = metadata.schemas[0]!;
    const parquetSchema = generateParquetSchema(schema);

    // Verify all fields exist
    const icebergFieldNames = icebergSchema.fields.map(f => f.name);
    expect(icebergFieldNames).toContain('id');
    expect(icebergFieldNames).toContain('name');
    expect(icebergFieldNames).toContain('description');
    expect(icebergFieldNames).toContain('count');
    expect(icebergFieldNames).toContain('amount');
    expect(icebergFieldNames).toContain('isActive');
    expect(icebergFieldNames).toContain('tags');
    expect(icebergFieldNames).toContain('scores');
    expect(icebergFieldNames).toContain('createdAt');
    expect(icebergFieldNames).toContain('metadata');
    expect(icebergFieldNames).toContain('owner');

    const parquetFieldNames = parquetSchema.fields.map(f => f.name);
    expect(parquetFieldNames).toContain('id');
    expect(parquetFieldNames).toContain('tags');
    expect(parquetFieldNames).toContain('owner');
  });

  it('should handle schema with partition directives', () => {
    const schema = parseSchema({
      $type: 'PartitionedEntity',
      $partitionBy: ['tenantId', 'createdAt'],
      tenantId: 'string!',
      id: 'uuid!',
      data: 'string',
      createdAt: 'timestamp',
    });

    const metadata = generateIcebergMetadata(schema, 's3://bucket/tables/partitioned');

    expect(metadata.partitionSpecs.length).toBe(1);
    expect(metadata.partitionSpecs[0]!.fields.length).toBe(2);

    const partitionNames = metadata.partitionSpecs[0]!.fields.map(f => f.name);
    expect(partitionNames).toContain('tenantId');
    expect(partitionNames).toContain('createdAt');
  });
});
