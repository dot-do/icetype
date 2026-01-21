# @icetype/iceberg

IceType to Apache Iceberg metadata and Parquet schema generation. This package transforms IceType schemas into Iceberg table metadata and Parquet schemas for data lake applications.

## Installation

```bash
npm install @icetype/iceberg
# or
pnpm add @icetype/iceberg
```

## Usage

```typescript
import { parseSchema } from '@icetype/core';
import {
  generateIcebergMetadata,
  generateParquetSchema,
  IcebergAdapter,
} from '@icetype/iceberg';

// Parse an IceType schema
const schema = parseSchema({
  $type: 'User',
  $partitionBy: ['tenantId'],
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  tenantId: 'string!',
  createdAt: 'timestamp!',
});

// Generate Iceberg table metadata
const icebergMetadata = generateIcebergMetadata(
  schema,
  's3://my-bucket/tables/users'
);

// Generate Parquet schema
const parquetSchema = generateParquetSchema(schema);

// Use the adapter for full control
const adapter = new IcebergAdapter();
const metadata = adapter.transform(schema, {
  location: 's3://my-bucket/tables/users',
  properties: {
    'write.format.default': 'parquet',
  },
});
```

## API

### Iceberg Functions

| Export | Description |
|--------|-------------|
| `generateIcebergMetadata(schema, location)` | Generate Iceberg table metadata |
| `createIcebergMetadataGenerator()` | Create a metadata generator instance |
| `IcebergMetadataGenerator` | Class for Iceberg metadata generation |
| `IcebergAdapter` | Adapter class for registry integration |
| `createIcebergAdapter()` | Factory function for adapter |

### Parquet Functions

| Export | Description |
|--------|-------------|
| `generateParquetSchema(schema)` | Generate Parquet schema from IceType |
| `generateParquetSchemaString(schema)` | Generate Parquet schema as JSON string |
| `createParquetSchemaGenerator()` | Create a Parquet schema generator |
| `ParquetSchemaGenerator` | Class for Parquet schema generation |
| `ParquetAdapter` | Adapter class for Parquet generation |
| `documentToParquetRow(doc, schema)` | Convert a document to Parquet row format |

### Migration Functions

| Export | Description |
|--------|-------------|
| `generateIcebergSchemaUpdate(diff)` | Generate Iceberg schema evolution operations |
| `IcebergMigrationGenerator` | Class for schema evolution |
| `createIcebergMigrationGenerator()` | Factory function for migration generator |

### Types

| Type | Description |
|------|-------------|
| `IcebergTableMetadata` | Full Iceberg table metadata structure |
| `IcebergSchema` | Iceberg schema definition |
| `IcebergPartitionSpec` | Partition specification |
| `IcebergSortOrder` | Sort order specification |
| `ParquetSchema` | Parquet schema definition |
| `ParquetField` | Parquet field definition |

## Examples

### Basic Iceberg Metadata Generation

```typescript
import { parseSchema } from '@icetype/core';
import { generateIcebergMetadata } from '@icetype/iceberg';

const schema = parseSchema({
  $type: 'Event',
  $partitionBy: ['eventDate'],
  id: 'uuid!',
  eventType: 'string!',
  eventDate: 'date!',
  payload: 'json',
});

const metadata = generateIcebergMetadata(
  schema,
  's3://data-lake/events'
);

console.log(JSON.stringify(metadata, null, 2));
// {
//   "format-version": 2,
//   "table-uuid": "...",
//   "location": "s3://data-lake/events",
//   "schema": { ... },
//   "partition-spec": [ { "field-id": 1000, "name": "eventDate", ... } ],
//   ...
// }
```

### Parquet Schema Generation

```typescript
import { parseSchema } from '@icetype/core';
import { generateParquetSchema, generateParquetSchemaString } from '@icetype/iceberg';

const schema = parseSchema({
  $type: 'Product',
  id: 'uuid!',
  name: 'string!',
  price: 'decimal(10,2)!',
  tags: 'string[]',
  metadata: 'json?',
});

// Get schema object
const parquetSchema = generateParquetSchema(schema);

// Get as JSON string
const schemaJson = generateParquetSchemaString(schema);
```

### Using the Adapter with Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { IcebergAdapter, ParquetAdapter } from '@icetype/iceberg';

const registry = createAdapterRegistry();
registry.register(new IcebergAdapter());
registry.register(new ParquetAdapter());

// Use Iceberg adapter
const icebergAdapter = registry.get('iceberg');
const metadata = icebergAdapter?.transform(schema, {
  location: 's3://bucket/tables/users',
});
const json = icebergAdapter?.serialize(metadata);

// Use Parquet adapter
const parquetAdapter = registry.get('parquet');
const parquetSchema = parquetAdapter?.transform(schema);
```

### Schema Evolution

```typescript
import { diffSchemas, parseSchema } from '@icetype/core';
import { generateIcebergSchemaUpdate } from '@icetype/iceberg';

const oldSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string!',
});

const newSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string!',
  email: 'string!',
  createdAt: 'timestamp!',
});

const diff = diffSchemas(oldSchema, newSchema);
const schemaUpdate = generateIcebergSchemaUpdate(diff);

console.log(schemaUpdate.operations);
// [
//   { type: 'add-column', name: 'email', type: 'string', required: true },
//   { type: 'add-column', name: 'createdAt', type: 'timestamptz', required: true }
// ]
```

### Projection Schema Generation

```typescript
import { parseSchema } from '@icetype/core';
import { generateProjectionSchema } from '@icetype/iceberg';

// Define a schema with projection
const schema = parseSchema({
  $type: 'UserAnalytics',
  $projection: {
    source: 'User',
    fields: ['id', 'email', 'createdAt'],
  },
  id: 'uuid!',
  email: 'string!',
  createdAt: 'timestamp!',
  totalOrders: 'int!',  // Computed field
});

const projection = generateProjectionSchema(schema);
```

### Convert Documents to Parquet Rows

```typescript
import { documentToParquetRow } from '@icetype/iceberg';

const doc = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  age: 30,
  tags: ['developer', 'typescript'],
};

const row = documentToParquetRow(doc, schema);
// Converts to Parquet-compatible format with proper type handling
```

## Type Mappings

| IceType | Iceberg Type | Parquet Type |
|---------|-------------|--------------|
| `string` | `string` | `BYTE_ARRAY` (UTF8) |
| `int` | `int` | `INT32` |
| `long` | `long` | `INT64` |
| `float` | `float` | `FLOAT` |
| `double` | `double` | `DOUBLE` |
| `boolean` | `boolean` | `BOOLEAN` |
| `uuid` | `uuid` | `FIXED_LEN_BYTE_ARRAY[16]` |
| `timestamp` | `timestamptz` | `INT64` (TIMESTAMP_MICROS) |
| `date` | `date` | `INT32` (DATE) |
| `binary` | `binary` | `BYTE_ARRAY` |
| `decimal(p,s)` | `decimal(p,s)` | `FIXED_LEN_BYTE_ARRAY` |
| `json` | `string` | `BYTE_ARRAY` (JSON) |

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/iceberg).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`icetype`](../icetype) - Main entry point

## License

MIT
