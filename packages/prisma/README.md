# @icetype/prisma

Prisma adapter for IceType schema transformations. This package provides bidirectional conversion between IceType schemas and Prisma schema files (.prisma), enabling migration from existing Prisma projects to IceType and exporting IceType schemas to Prisma format.

## Installation

```bash
npm install @icetype/prisma
# or
pnpm add @icetype/prisma
```

## Usage

### Import Prisma to IceType

```typescript
import { parsePrismaSchema, parsePrismaFile } from '@icetype/prisma';

// Parse a Prisma schema string
const schemas = parsePrismaSchema(`
  model User {
    id    String @id @default(uuid())
    email String @unique
    name  String?
    posts Post[]
  }

  model Post {
    id       String @id @default(uuid())
    title    String
    content  String?
    author   User   @relation(fields: [authorId], references: [id])
    authorId String
  }
`);

console.log(schemas);
// [
//   { $type: 'User', id: 'uuid!#', email: 'string!#', name: 'string?', posts: '[Post]' },
//   { $type: 'Post', id: 'uuid!#', title: 'string!', content: 'string?', author: 'User!', authorId: 'string!' }
// ]

// Parse from file
const fileSchemas = await parsePrismaFile('./prisma/schema.prisma');
```

### Export IceType to Prisma

```typescript
import { parseSchema } from '@icetype/core';
import { PrismaAdapter, transformToPrisma, generatePrismaSchema } from '@icetype/prisma';

const schema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string!#',
  name: 'string?',
  createdAt: 'timestamp!',
});

// Option 1: Use the adapter directly
const adapter = new PrismaAdapter();
const prismaOutput = adapter.transform(schema, {
  provider: 'postgresql',
});
const prismaCode = adapter.serialize(prismaOutput);

// Option 2: Use the convenience function
const prismaCode2 = generatePrismaSchema(schema, {
  provider: 'postgresql',
  includeGenerator: true,
});

console.log(prismaCode2);
// generator client {
//   provider = "prisma-client-js"
// }
//
// datasource db {
//   provider = "postgresql"
//   url      = env("DATABASE_URL")
// }
//
// model User {
//   id        String   @id @default(uuid())
//   email     String   @unique
//   name      String?
//   createdAt DateTime
// }
```

## API

### Import Functions (Prisma to IceType)

| Export | Description |
|--------|-------------|
| `parsePrismaSchema(code)` | Parse Prisma schema string to IceType schemas |
| `parsePrismaFile(path)` | Parse Prisma file to IceType schemas |
| `parsePrismaSchemaToAst(code)` | Parse to internal AST |
| `convertPrismaModel(model)` | Convert single Prisma model |

### Export Functions (IceType to Prisma)

| Export | Description |
|--------|-------------|
| `transformToPrisma(schema, options)` | Transform schema to Prisma output |
| `generatePrismaSchema(schema, options)` | Generate Prisma schema string |
| `generatePrismaSchemaOutput(schemas, options)` | Generate from multiple schemas |
| `schemaToPrismaModel(schema)` | Convert single schema to model |
| `fieldToPrismaField(field)` | Convert field to Prisma field |
| `mapIceTypeToPrisma(type)` | Map IceType to Prisma type |

### Serialization Functions

| Export | Description |
|--------|-------------|
| `serializePrismaField(field)` | Serialize field to string |
| `serializePrismaModel(model)` | Serialize model to string |
| `serializePrismaEnum(enum)` | Serialize enum to string |
| `generateDatasourceBlock(options)` | Generate datasource block |
| `generateGeneratorBlock(options)` | Generate generator block |
| `formatPrismaDefault(value, type)` | Format default value |
| `getDefaultGenerator(type)` | Get default generator for type |

### Adapter

| Export | Description |
|--------|-------------|
| `PrismaAdapter` | Adapter class for Prisma operations |
| `createPrismaAdapter()` | Factory function to create adapter |

### Types

| Type | Description |
|------|-------------|
| `PrismaScalarType` | Prisma scalar types |
| `PrismaAttribute` | Prisma field attribute (@id, @unique, etc.) |
| `PrismaField` | Prisma field definition |
| `PrismaModel` | Prisma model definition |
| `PrismaEnum` | Prisma enum definition |
| `ParsedPrismaSchema` | Result of parsing a Prisma schema |
| `PrismaImportOptions` | Options for importing |
| `PrismaExportOptions` | Options for exporting |
| `PrismaProvider` | Database provider type |
| `PrismaDatasource` | Datasource configuration |
| `PrismaGenerator` | Generator configuration |
| `PrismaSchemaOutput` | Complete schema output |
| `PrismaModelOutput` | Model output structure |
| `PrismaFieldOutput` | Field output structure |
| `PrismaEnumOutput` | Enum output structure |

### Constants

| Export | Description |
|--------|-------------|
| `PRISMA_TYPE_MAPPINGS` | Type mappings configuration |
| `PRISMA_TO_ICETYPE_MAP` | Prisma to IceType type map |
| `ICETYPE_TO_PRISMA_MAPPINGS` | IceType to Prisma mappings |
| `ICETYPE_TO_PRISMA_MAP` | IceType to Prisma type map |
| `ICETYPE_DEFAULT_GENERATORS` | Default generators for types |

## Examples

### Basic Import

```typescript
import { parsePrismaSchema } from '@icetype/prisma';

const schemas = parsePrismaSchema(`
  model Product {
    id          String   @id @default(cuid())
    name        String
    description String?
    price       Decimal
    stock       Int      @default(0)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    categories  Category[]
  }

  model Category {
    id       String    @id @default(cuid())
    name     String    @unique
    products Product[]
  }
`);

// Result:
// [
//   {
//     $type: 'Product',
//     id: 'string!',
//     name: 'string!',
//     description: 'string?',
//     price: 'decimal!',
//     stock: 'int! = 0',
//     createdAt: 'timestamp!',
//     updatedAt: 'timestamp!',
//     categories: '[Category]'
//   },
//   {
//     $type: 'Category',
//     id: 'string!',
//     name: 'string!#',
//     products: '[Product]'
//   }
// ]
```

### Export with Relations

```typescript
import { parseSchema } from '@icetype/core';
import { generatePrismaSchema } from '@icetype/prisma';

const userSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string!#',
  name: 'string?',
  posts: '[Post] -> author',
});

const postSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string!',
  content: 'text?',
  author: 'User! <- posts',
  authorId: 'uuid!',
});

const prismaCode = generatePrismaSchema([userSchema, postSchema], {
  provider: 'postgresql',
});

console.log(prismaCode);
// model User {
//   id    String  @id @default(uuid())
//   email String  @unique
//   name  String?
//   posts Post[]
// }
//
// model Post {
//   id       String  @id @default(uuid())
//   title    String
//   content  String?
//   author   User    @relation(fields: [authorId], references: [id])
//   authorId String
// }
```

### Export with Custom Datasource

```typescript
import { generatePrismaSchema } from '@icetype/prisma';

const prismaCode = generatePrismaSchema(schema, {
  provider: 'mysql',
  datasource: {
    url: 'env("DATABASE_URL")',
    shadowDatabaseUrl: 'env("SHADOW_DATABASE_URL")',
  },
  generators: [
    {
      name: 'client',
      provider: 'prisma-client-js',
      output: '../generated/client',
    },
  ],
});
```

### Using with Adapter Registry

```typescript
import { createAdapterRegistry } from '@icetype/adapters';
import { PrismaAdapter } from '@icetype/prisma';

const registry = createAdapterRegistry();
registry.register(new PrismaAdapter());

const adapter = registry.get('prisma');
const output = adapter?.transform(schema, { provider: 'postgresql' });
const code = adapter?.serialize(output);
```

### Handling Enums

```typescript
import { parsePrismaSchema } from '@icetype/prisma';

const schemas = parsePrismaSchema(`
  enum Role {
    USER
    ADMIN
    MODERATOR
  }

  model User {
    id   String @id
    role Role   @default(USER)
  }
`);

// Enums are parsed as string fields with constraints
```

## Type Mappings

### Prisma to IceType

| Prisma Type | IceType |
|-------------|---------|
| `String` | `string` |
| `Int` | `int` |
| `BigInt` | `bigint` |
| `Float` | `float` |
| `Decimal` | `decimal` |
| `Boolean` | `boolean` |
| `DateTime` | `timestamp` |
| `Json` | `json` |
| `Bytes` | `binary` |

### IceType to Prisma

| IceType | Prisma Type |
|---------|-------------|
| `string` | `String` |
| `text` | `String` |
| `int` | `Int` |
| `long` | `BigInt` |
| `bigint` | `BigInt` |
| `float` | `Float` |
| `double` | `Float` |
| `decimal` | `Decimal` |
| `boolean` | `Boolean` |
| `uuid` | `String` (with @default(uuid())) |
| `timestamp` | `DateTime` |
| `date` | `DateTime` |
| `json` | `Json` |
| `binary` | `Bytes` |

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/prisma).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/adapters`](../adapters) - Adapter abstraction layer
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter
- [`@icetype/postgres`](../postgres) - PostgreSQL DDL adapter
- [`@icetype/mysql`](../mysql) - MySQL DDL adapter

## License

MIT
