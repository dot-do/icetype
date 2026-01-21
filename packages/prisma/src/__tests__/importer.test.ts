/**
 * Tests for Prisma schema importer
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  parsePrismaSchema,
  parsePrismaSchemaToAst,
  convertPrismaModel,
} from '../importer.js';
import {
  PRISMA_TO_ICETYPE_MAP,
  PRISMA_TYPE_MAPPINGS,
} from '../types.js';
// Types are used in test assertions but not explicitly imported
// to avoid unused import warnings

// =============================================================================
// Test Fixtures
// =============================================================================

const SIMPLE_USER_MODEL = `
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String
}
`;

const USER_WITH_OPTIONAL_FIELDS = `
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?
  bio       String?
  age       Int?
}
`;

const USER_WITH_RELATIONS = `
model User {
  id    String @id @default(uuid())
  email String @unique
  posts Post[]
}

model Post {
  id       String @id @default(uuid())
  title    String
  content  String?
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}
`;

const ALL_SCALAR_TYPES = `
model TypeTest {
  id        String   @id @default(uuid())
  string    String
  int       Int
  bigInt    BigInt
  float     Float
  decimal   Decimal
  boolean   Boolean
  dateTime  DateTime
  json      Json
  bytes     Bytes
}
`;

const MODEL_WITH_DEFAULTS = `
model Post {
  id        String   @id @default(uuid())
  title     String
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  viewCount Int      @default(0)
  status    String   @default("draft")
}
`;

const MODEL_WITH_AUTOINCREMENT = `
model Counter {
  id    Int    @id @default(autoincrement())
  name  String
  value Int    @default(0)
}
`;

const MODEL_WITH_ENUMS = `
enum Role {
  USER
  ADMIN
  MODERATOR
}

enum Status {
  ACTIVE
  INACTIVE
  PENDING
}

model User {
  id     String @id @default(uuid())
  email  String @unique
  role   Role   @default(USER)
  status Status
}
`;

const COMPLEX_RELATIONS = `
model User {
  id       String    @id @default(uuid())
  email    String    @unique
  posts    Post[]
  comments Comment[]
  profile  Profile?
}

model Profile {
  id     String @id @default(uuid())
  bio    String
  user   User   @relation(fields: [userId], references: [id])
  userId String @unique
}

model Post {
  id       String    @id @default(uuid())
  title    String
  author   User      @relation(fields: [authorId], references: [id])
  authorId String
  comments Comment[]
}

model Comment {
  id       String @id @default(uuid())
  text     String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
  post     Post   @relation(fields: [postId], references: [id])
  postId   String
}
`;

const MODEL_WITH_MULTIPLE_UNIQUE = `
model Account {
  id        String @id @default(uuid())
  email     String @unique
  username  String @unique
  phone     String @unique
  name      String
}
`;

const MODEL_WITH_CUID = `
model Item {
  id   String @id @default(cuid())
  name String
}
`;

const EMPTY_MODEL = `
model Empty {
}
`;

const MODEL_WITH_COMMENTS = `
model User {
  // This is a comment
  id    String @id @default(uuid())
  // Email field
  email String @unique
  name  String // inline comment
}
`;

const MULTIPLE_MODELS = `
model User {
  id   String @id @default(uuid())
  name String
}

model Product {
  id    String @id @default(uuid())
  title String
  price Float
}

model Order {
  id     String @id @default(uuid())
  total  Float
  status String
}
`;

// =============================================================================
// Type Mappings Tests
// =============================================================================

describe('PRISMA_TYPE_MAPPINGS', () => {
  it('should have all Prisma scalar types mapped', () => {
    expect(PRISMA_TYPE_MAPPINGS.length).toBe(9);
  });

  it('should map String to string', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'String');
    expect(mapping?.icetype).toBe('string');
  });

  it('should map Int to int', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'Int');
    expect(mapping?.icetype).toBe('int');
  });

  it('should map BigInt to bigint', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'BigInt');
    expect(mapping?.icetype).toBe('bigint');
  });

  it('should map Float to float', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'Float');
    expect(mapping?.icetype).toBe('float');
  });

  it('should map Decimal to double', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'Decimal');
    expect(mapping?.icetype).toBe('double');
  });

  it('should map Boolean to bool', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'Boolean');
    expect(mapping?.icetype).toBe('bool');
  });

  it('should map DateTime to timestamp', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'DateTime');
    expect(mapping?.icetype).toBe('timestamp');
  });

  it('should map Json to json', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'Json');
    expect(mapping?.icetype).toBe('json');
  });

  it('should map Bytes to binary', () => {
    const mapping = PRISMA_TYPE_MAPPINGS.find(m => m.prisma === 'Bytes');
    expect(mapping?.icetype).toBe('binary');
  });
});

describe('PRISMA_TO_ICETYPE_MAP', () => {
  it('should be a lookup map with all scalar types', () => {
    expect(Object.keys(PRISMA_TO_ICETYPE_MAP).length).toBe(9);
  });

  it('should provide quick access to type mappings', () => {
    expect(PRISMA_TO_ICETYPE_MAP['String']).toBe('string');
    expect(PRISMA_TO_ICETYPE_MAP['Int']).toBe('int');
    expect(PRISMA_TO_ICETYPE_MAP['Boolean']).toBe('bool');
  });
});

// =============================================================================
// parsePrismaSchemaToAst Tests
// =============================================================================

describe('parsePrismaSchemaToAst', () => {
  describe('model parsing', () => {
    it('should parse a simple model', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      expect(result.models.length).toBe(1);
      expect(result.models[0]!.name).toBe('User');
    });

    it('should parse all fields in a model', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      const user = result.models[0]!;
      expect(user.fields.length).toBe(3);
    });

    it('should parse field names correctly', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      const user = result.models[0]!;
      const fieldNames = user.fields.map(f => f.name);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('name');
    });

    it('should parse field types correctly', () => {
      const result = parsePrismaSchemaToAst(ALL_SCALAR_TYPES);
      const model = result.models[0]!;

      const getFieldType = (name: string) => model.fields.find(f => f.name === name)?.type;

      expect(getFieldType('string')).toBe('String');
      expect(getFieldType('int')).toBe('Int');
      expect(getFieldType('bigInt')).toBe('BigInt');
      expect(getFieldType('float')).toBe('Float');
      expect(getFieldType('decimal')).toBe('Decimal');
      expect(getFieldType('boolean')).toBe('Boolean');
      expect(getFieldType('dateTime')).toBe('DateTime');
      expect(getFieldType('json')).toBe('Json');
      expect(getFieldType('bytes')).toBe('Bytes');
    });

    it('should parse optional fields', () => {
      const result = parsePrismaSchemaToAst(USER_WITH_OPTIONAL_FIELDS);
      const user = result.models[0]!;

      const nameField = user.fields.find(f => f.name === 'name');
      const bioField = user.fields.find(f => f.name === 'bio');
      const emailField = user.fields.find(f => f.name === 'email');

      expect(nameField?.isOptional).toBe(true);
      expect(bioField?.isOptional).toBe(true);
      expect(emailField?.isOptional).toBe(false);
    });

    it('should parse array fields', () => {
      const result = parsePrismaSchemaToAst(USER_WITH_RELATIONS);
      const user = result.models.find(m => m.name === 'User')!;

      const postsField = user.fields.find(f => f.name === 'posts');
      expect(postsField?.isArray).toBe(true);
      expect(postsField?.type).toBe('Post');
    });

    it('should parse multiple models', () => {
      const result = parsePrismaSchemaToAst(MULTIPLE_MODELS);
      expect(result.models.length).toBe(3);
      expect(result.models.map(m => m.name)).toEqual(['User', 'Product', 'Order']);
    });

    it('should skip comments in model body', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_COMMENTS);
      const user = result.models[0]!;
      expect(user.fields.length).toBe(3);
    });

    it('should handle empty models', () => {
      const result = parsePrismaSchemaToAst(EMPTY_MODEL);
      expect(result.models.length).toBe(1);
      expect(result.models[0]!.fields.length).toBe(0);
    });
  });

  describe('attribute parsing', () => {
    it('should parse @id attribute', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      const user = result.models[0]!;
      const idField = user.fields.find(f => f.name === 'id')!;

      expect(idField.attributes.some(a => a.name === 'id')).toBe(true);
    });

    it('should parse @unique attribute', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      const user = result.models[0]!;
      const emailField = user.fields.find(f => f.name === 'email')!;

      expect(emailField.attributes.some(a => a.name === 'unique')).toBe(true);
    });

    it('should parse @default with uuid()', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      const user = result.models[0]!;
      const idField = user.fields.find(f => f.name === 'id')!;

      const defaultAttr = idField.attributes.find(a => a.name === 'default');
      expect(defaultAttr).toBeDefined();
      expect(defaultAttr?.args).toContain('uuid()');
    });

    it('should parse @default with now()', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_DEFAULTS);
      const post = result.models[0]!;
      const createdAtField = post.fields.find(f => f.name === 'createdAt')!;

      const defaultAttr = createdAtField.attributes.find(a => a.name === 'default');
      expect(defaultAttr?.args).toContain('now()');
    });

    it('should parse @default with boolean', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_DEFAULTS);
      const post = result.models[0]!;
      const publishedField = post.fields.find(f => f.name === 'published')!;

      const defaultAttr = publishedField.attributes.find(a => a.name === 'default');
      expect(defaultAttr?.args).toContain('false');
    });

    it('should parse @default with number', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_DEFAULTS);
      const post = result.models[0]!;
      const viewCountField = post.fields.find(f => f.name === 'viewCount')!;

      const defaultAttr = viewCountField.attributes.find(a => a.name === 'default');
      expect(defaultAttr?.args).toContain('0');
    });

    it('should parse @default with string', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_DEFAULTS);
      const post = result.models[0]!;
      const statusField = post.fields.find(f => f.name === 'status')!;

      const defaultAttr = statusField.attributes.find(a => a.name === 'default');
      expect(defaultAttr?.args).toContain('"draft"');
    });

    it('should parse @default with autoincrement()', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_AUTOINCREMENT);
      const counter = result.models[0]!;
      const idField = counter.fields.find(f => f.name === 'id')!;

      const defaultAttr = idField.attributes.find(a => a.name === 'default');
      expect(defaultAttr?.args).toContain('autoincrement()');
    });

    it('should parse @default with cuid()', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_CUID);
      const item = result.models[0]!;
      const idField = item.fields.find(f => f.name === 'id')!;

      const defaultAttr = idField.attributes.find(a => a.name === 'default');
      expect(defaultAttr?.args).toContain('cuid()');
    });

    it('should parse @relation attribute', () => {
      const result = parsePrismaSchemaToAst(USER_WITH_RELATIONS);
      const post = result.models.find(m => m.name === 'Post')!;
      const authorField = post.fields.find(f => f.name === 'author')!;

      expect(authorField.attributes.some(a => a.name === 'relation')).toBe(true);
    });

    it('should parse multiple attributes on same field', () => {
      const result = parsePrismaSchemaToAst(SIMPLE_USER_MODEL);
      const user = result.models[0]!;
      const idField = user.fields.find(f => f.name === 'id')!;

      expect(idField.attributes.length).toBe(2); // @id and @default
    });
  });

  describe('enum parsing', () => {
    it('should parse enums', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_ENUMS);
      expect(result.enums.length).toBe(2);
    });

    it('should parse enum names', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_ENUMS);
      const enumNames = result.enums.map(e => e.name);
      expect(enumNames).toContain('Role');
      expect(enumNames).toContain('Status');
    });

    it('should parse enum values', () => {
      const result = parsePrismaSchemaToAst(MODEL_WITH_ENUMS);
      const roleEnum = result.enums.find(e => e.name === 'Role')!;
      expect(roleEnum.values).toEqual(['USER', 'ADMIN', 'MODERATOR']);
    });
  });
});

// =============================================================================
// parsePrismaSchema Tests
// =============================================================================

describe('parsePrismaSchema', () => {
  describe('basic conversion', () => {
    it('should convert a simple model to IceType', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
      expect(schemas.length).toBe(1);
      expect(schemas[0]!.$type).toBe('User');
    });

    it('should include all fields in output', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
      const user = schemas[0]!;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
    });

    it('should convert multiple models', () => {
      const schemas = parsePrismaSchema(MULTIPLE_MODELS);
      expect(schemas.length).toBe(3);
      expect(schemas.map(s => s.$type)).toEqual(['User', 'Product', 'Order']);
    });
  });

  describe('type conversion', () => {
    it('should convert String to string', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['string']).toMatch(/^string/);
    });

    it('should convert Int to int', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['int']).toMatch(/^int/);
    });

    it('should convert BigInt to bigint', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['bigInt']).toMatch(/^bigint/);
    });

    it('should convert Float to float', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['float']).toMatch(/^float/);
    });

    it('should convert Decimal to double', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['decimal']).toMatch(/^double/);
    });

    it('should convert Boolean to bool', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['boolean']).toMatch(/^bool/);
    });

    it('should convert DateTime to timestamp', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['dateTime']).toMatch(/^timestamp/);
    });

    it('should convert Json to json', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['json']).toMatch(/^json/);
    });

    it('should convert Bytes to binary', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES);
      const model = schemas[0]!;
      expect(model['bytes']).toMatch(/^binary/);
    });
  });

  describe('modifier conversion', () => {
    it('should add ! modifier for required fields', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
      const user = schemas[0]!;
      expect(user['name']).toMatch(/!(?!#)/); // Has ! but not followed by #
    });

    it('should add ? modifier for optional fields', () => {
      const schemas = parsePrismaSchema(USER_WITH_OPTIONAL_FIELDS);
      const user = schemas[0]!;
      expect(user['name']).toMatch(/\?/);
      expect(user['bio']).toMatch(/\?/);
      expect(user['age']).toMatch(/\?/);
    });

    it('should add # modifier for @unique fields', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
      const user = schemas[0]!;
      expect(user['email']).toMatch(/#/);
    });

    it('should add !# for @id fields', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
      const user = schemas[0]!;
      expect(user['id']).toMatch(/!#/);
    });

    it('should handle multiple @unique fields', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_MULTIPLE_UNIQUE);
      const account = schemas[0]!;
      expect(account['email']).toMatch(/#/);
      expect(account['username']).toMatch(/#/);
      expect(account['phone']).toMatch(/#/);
    });
  });

  describe('default value conversion', () => {
    it('should convert uuid() default', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
      const user = schemas[0]!;
      expect(user['id']).toMatch(/= uuid\(\)/);
    });

    it('should convert now() default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_DEFAULTS);
      const post = schemas[0]!;
      expect(post['createdAt']).toMatch(/= now\(\)/);
    });

    it('should convert boolean default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_DEFAULTS);
      const post = schemas[0]!;
      expect(post['published']).toMatch(/= false/);
    });

    it('should convert number default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_DEFAULTS);
      const post = schemas[0]!;
      expect(post['viewCount']).toMatch(/= 0/);
    });

    it('should convert string default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_DEFAULTS);
      const post = schemas[0]!;
      expect(post['status']).toMatch(/= "draft"/);
    });

    it('should convert autoincrement() default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_AUTOINCREMENT);
      const counter = schemas[0]!;
      expect(counter['id']).toMatch(/= autoincrement\(\)/);
    });

    it('should convert cuid() default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_CUID);
      const item = schemas[0]!;
      expect(item['id']).toMatch(/= cuid\(\)/);
    });
  });

  describe('relation conversion', () => {
    it('should convert array relations to [Type]', () => {
      const schemas = parsePrismaSchema(USER_WITH_RELATIONS);
      const user = schemas.find(s => s.$type === 'User')!;
      expect(user['posts']).toBe('[Post]');
    });

    it('should convert required single relations to Type!', () => {
      const schemas = parsePrismaSchema(USER_WITH_RELATIONS);
      const post = schemas.find(s => s.$type === 'Post')!;
      expect(post['author']).toBe('User!');
    });

    it('should convert optional single relations to Type?', () => {
      const schemas = parsePrismaSchema(COMPLEX_RELATIONS);
      const user = schemas.find(s => s.$type === 'User')!;
      expect(user['profile']).toBe('Profile?');
    });

    it('should include relation foreign key fields', () => {
      const schemas = parsePrismaSchema(USER_WITH_RELATIONS);
      const post = schemas.find(s => s.$type === 'Post')!;
      expect(post).toHaveProperty('authorId');
    });

    it('should handle complex multi-model relations', () => {
      const schemas = parsePrismaSchema(COMPLEX_RELATIONS);
      expect(schemas.length).toBe(4);

      const comment = schemas.find(s => s.$type === 'Comment')!;
      expect(comment['author']).toBe('User!');
      expect(comment['post']).toBe('Post!');
    });
  });

  describe('options', () => {
    it('should exclude relations when includeRelations is false', () => {
      const schemas = parsePrismaSchema(USER_WITH_RELATIONS, { includeRelations: false });
      const user = schemas.find(s => s.$type === 'User')!;
      expect(user).not.toHaveProperty('posts');
    });

    it('should still include foreign key fields when includeRelations is false', () => {
      const schemas = parsePrismaSchema(USER_WITH_RELATIONS, { includeRelations: false });
      const post = schemas.find(s => s.$type === 'Post')!;
      expect(post).toHaveProperty('authorId');
    });

    it('should not add # for unique when convertUniqueToIndexed is false', () => {
      const schemas = parsePrismaSchema(SIMPLE_USER_MODEL, { convertUniqueToIndexed: false });
      const user = schemas[0]!;
      expect(user['email']).not.toMatch(/#/);
    });

    it('should use custom type mappings', () => {
      const schemas = parsePrismaSchema(ALL_SCALAR_TYPES, {
        customTypeMappings: { String: 'text' },
      });
      const model = schemas[0]!;
      expect(model['string']).toMatch(/^text/);
    });
  });

  describe('enum handling', () => {
    it('should convert enum fields with enum<Type> syntax', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_ENUMS);
      const user = schemas[0]!;
      expect(user['role']).toMatch(/enum<Role>/);
      expect(user['status']).toMatch(/enum<Status>/);
    });

    it('should include default value for enum with default', () => {
      const schemas = parsePrismaSchema(MODEL_WITH_ENUMS);
      const user = schemas[0]!;
      expect(user['role']).toMatch(/= USER/);
    });
  });
});

// =============================================================================
// convertPrismaModel Tests
// =============================================================================

describe('convertPrismaModel', () => {
  it('should convert a single model string', () => {
    const schema = convertPrismaModel(`
      model User {
        id   String @id @default(uuid())
        name String
      }
    `);

    expect(schema).not.toBeNull();
    expect(schema!.$type).toBe('User');
    expect(schema!['id']).toMatch(/string!#/);
  });

  it('should return null for empty input', () => {
    const schema = convertPrismaModel('');
    expect(schema).toBeNull();
  });

  it('should return null for invalid input', () => {
    const schema = convertPrismaModel('not a valid prisma model');
    expect(schema).toBeNull();
  });

  it('should accept options', () => {
    const schema = convertPrismaModel(
      `
      model User {
        id    String @id @default(uuid())
        email String @unique
      }
    `,
      { convertUniqueToIndexed: false }
    );

    expect(schema).not.toBeNull();
    expect(schema!['email']).not.toMatch(/#/);
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('Edge cases', () => {
  it('should handle empty schema', () => {
    const schemas = parsePrismaSchema('');
    expect(schemas).toEqual([]);
  });

  it('should handle schema with only datasource and generator', () => {
    const schemas = parsePrismaSchema(`
      datasource db {
        provider = "postgresql"
        url      = env("DATABASE_URL")
      }

      generator client {
        provider = "prisma-client-js"
      }
    `);
    expect(schemas).toEqual([]);
  });

  it('should handle schema with whitespace and newlines', () => {
    const schemas = parsePrismaSchema(`


      model   User   {

        id     String    @id   @default(uuid())

        name   String

      }


    `);
    expect(schemas.length).toBe(1);
    expect(schemas[0]!.$type).toBe('User');
  });

  it('should handle model names with numbers', () => {
    const schemas = parsePrismaSchema(`
      model User2 {
        id String @id @default(uuid())
      }
    `);
    expect(schemas[0]!.$type).toBe('User2');
  });

  it('should handle field names with underscores', () => {
    const schemas = parsePrismaSchema(`
      model User {
        id          String @id @default(uuid())
        first_name  String
        last_name   String
      }
    `);
    const user = schemas[0]!;
    expect(user).toHaveProperty('first_name');
    expect(user).toHaveProperty('last_name');
  });

  it('should handle block attributes (@@)', () => {
    // Block attributes are skipped but should not cause errors
    const schemas = parsePrismaSchema(`
      model User {
        id    String @id @default(uuid())
        email String
        name  String

        @@unique([email, name])
        @@index([name])
      }
    `);
    expect(schemas.length).toBe(1);
    expect(schemas[0]!.fields).toBeUndefined(); // No $fields, just direct properties
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration tests', () => {
  it('should produce valid IceType schema structure', () => {
    const schemas = parsePrismaSchema(SIMPLE_USER_MODEL);
    const user = schemas[0]!;

    // Check structure
    expect(typeof user.$type).toBe('string');
    expect(typeof user['id']).toBe('string');
    expect(typeof user['email']).toBe('string');
    expect(typeof user['name']).toBe('string');
  });

  it('should handle a realistic e-commerce schema', () => {
    const ecommerceSchema = `
      model User {
        id        String   @id @default(uuid())
        email     String   @unique
        name      String
        orders    Order[]
        reviews   Review[]
        createdAt DateTime @default(now())
      }

      model Product {
        id          String   @id @default(uuid())
        name        String
        description String?
        price       Float
        inventory   Int      @default(0)
        category    Category @relation(fields: [categoryId], references: [id])
        categoryId  String
        reviews     Review[]
        orderItems  OrderItem[]
      }

      model Category {
        id       String    @id @default(uuid())
        name     String    @unique
        products Product[]
      }

      model Order {
        id        String      @id @default(uuid())
        user      User        @relation(fields: [userId], references: [id])
        userId    String
        items     OrderItem[]
        total     Float
        status    String      @default("pending")
        createdAt DateTime    @default(now())
      }

      model OrderItem {
        id        String  @id @default(uuid())
        order     Order   @relation(fields: [orderId], references: [id])
        orderId   String
        product   Product @relation(fields: [productId], references: [id])
        productId String
        quantity  Int
        price     Float
      }

      model Review {
        id        String   @id @default(uuid())
        user      User     @relation(fields: [userId], references: [id])
        userId    String
        product   Product  @relation(fields: [productId], references: [id])
        productId String
        rating    Int
        comment   String?
        createdAt DateTime @default(now())
      }
    `;

    const schemas = parsePrismaSchema(ecommerceSchema);

    expect(schemas.length).toBe(6);
    expect(schemas.map(s => s.$type).sort()).toEqual([
      'Category',
      'Order',
      'OrderItem',
      'Product',
      'Review',
      'User',
    ]);

    // Verify some specific conversions
    const user = schemas.find(s => s.$type === 'User')!;
    expect(user['email']).toMatch(/string!#/);
    expect(user['orders']).toBe('[Order]');
    expect(user['createdAt']).toMatch(/timestamp.*= now\(\)/);

    const product = schemas.find(s => s.$type === 'Product')!;
    expect(product['description']).toMatch(/\?/);
    expect(product['inventory']).toMatch(/= 0/);
  });
});
