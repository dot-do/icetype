/**
 * Full Workflow E2E Tests (RED Phase)
 *
 * These tests verify the complete IceType pipeline from schema definition
 * through to migration execution. This file implements failing tests
 * as part of TDD RED phase for issue icetype-syl.4.
 *
 * Pipeline workflows tested:
 * 1. Schema file -> parse -> validate -> generate types
 * 2. Schema file -> parse -> generate SQL -> execute DDL
 * 3. Schema v1 -> Schema v2 -> diff -> migration
 * 4. Error handling throughout pipeline
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(tmpdir(), `icetype-full-workflow-${Date.now()}`);
const CLI_PATH = join(__dirname, '../../dist/cli.js');
const CORE_PATH = resolve(__dirname, '../../../core/dist/index.js');

/**
 * Run CLI command and capture output
 */
function runCli(args: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', code: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      code: error.status || 1
    };
  }
}

/**
 * Create a basic User schema file
 */
function createUserSchemaV1(): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  createdAt: 'timestamp = now()',
});
`;
}

/**
 * Create an evolved User schema v2 with additional fields
 */
function createUserSchemaV2(): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string',
  age: 'int?',
  status: 'string = "active"',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
});
`;
}

/**
 * Create a schema with relations
 */
function createBlogSchemas(): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  email: 'string#',
  name: 'string!',
});

export const PostSchema = parseSchema({
  $type: 'Post',
  $fts: ['title', 'content'],
  id: 'uuid!',
  title: 'string!',
  content: 'text',
  authorId: 'uuid!',
  publishedAt: 'timestamp?',
});

export const CommentSchema = parseSchema({
  $type: 'Comment',
  id: 'uuid!',
  postId: 'uuid!',
  authorId: 'uuid!',
  content: 'text!',
  createdAt: 'timestamp = now()',
});
`;
}

/**
 * Create an invalid schema for error testing
 */
function createInvalidSchema(): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const BrokenSchema = parseSchema({
  $type: 'Broken',
  id: 'uuid!',
  badField: 'unknownType!',  // Invalid type
  anotherBad: '!string',     // Invalid modifier position
});
`;
}

/**
 * Create a schema with complex types
 */
function createComplexSchema(): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const ProductSchema = parseSchema({
  $type: 'Product',
  $partitionBy: ['categoryId'],
  $index: [['sku'], ['name']],
  $fts: ['name', 'description'],

  id: 'uuid!',
  categoryId: 'uuid!',
  sku: 'string#',
  name: 'string!',
  description: 'text?',
  price: 'decimal(10,2)!',
  compareAtPrice: 'decimal(10,2)?',
  inventory: 'int = 0',
  weight: 'float?',
  isActive: 'boolean = true',
  tags: 'string[]',
  metadata: 'json?',
  createdAt: 'timestamp = now()',
  updatedAt: 'timestamp?',
});
`;
}

describe('Full Workflow E2E Tests', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  // ==========================================================================
  // PIPELINE 1: Schema file -> parse -> validate -> generate types
  // ==========================================================================

  describe('Pipeline 1: Schema -> Parse -> Validate -> Generate Types', () => {
    const PIPELINE_DIR = join(TEST_DIR, 'pipeline1');

    beforeEach(() => {
      mkdirSync(PIPELINE_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(PIPELINE_DIR, { recursive: true, force: true });
    });

    it('should complete full type generation pipeline for simple schema', () => {
      // Arrange: Create schema file
      const schemaPath = join(PIPELINE_DIR, 'user-schema.mjs');
      const typesPath = join(PIPELINE_DIR, 'user-types.ts');
      writeFileSync(schemaPath, createUserSchemaV1());

      // Act: Run validate then generate
      const validateResult = runCli(`validate --schema ${schemaPath}`);
      const generateResult = runCli(`generate --schema ${schemaPath} --output ${typesPath}`);

      // Assert: Both commands succeed
      expect(validateResult.code).toBe(0);
      expect(validateResult.stdout).toContain('is valid');

      expect(generateResult.code).toBe(0);
      expect(existsSync(typesPath)).toBe(true);

      // Assert: Generated types contain expected content
      const generatedContent = readFileSync(typesPath, 'utf-8');
      expect(generatedContent).toContain('export interface User');
      expect(generatedContent).toContain('export interface UserInput');
      expect(generatedContent).toContain('$id: string');
      expect(generatedContent).toContain('$type:');
      expect(generatedContent).toContain('email');
      expect(generatedContent).toContain('name');
      expect(generatedContent).toContain('createdAt');
    });

    it('should generate types for multiple schemas in single file', () => {
      // Arrange: Create schema file with multiple schemas
      const schemaPath = join(PIPELINE_DIR, 'blog-schemas.mjs');
      const typesPath = join(PIPELINE_DIR, 'blog-types.ts');
      writeFileSync(schemaPath, createBlogSchemas());

      // Act
      const validateResult = runCli(`validate --schema ${schemaPath}`);
      const generateResult = runCli(`generate --schema ${schemaPath} --output ${typesPath}`);

      // Assert: Validation finds all schemas
      expect(validateResult.code).toBe(0);
      expect(validateResult.stdout).toContain('3 schema(s)');

      // Assert: Generation succeeds and includes all schemas
      expect(generateResult.code).toBe(0);
      const generatedContent = readFileSync(typesPath, 'utf-8');
      expect(generatedContent).toContain('export interface User');
      expect(generatedContent).toContain('export interface Post');
      expect(generatedContent).toContain('export interface Comment');
      expect(generatedContent).toContain('export interface UserInput');
      expect(generatedContent).toContain('export interface PostInput');
      expect(generatedContent).toContain('export interface CommentInput');
    });

    it('should handle complex schema with all field types', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'product-schema.mjs');
      const typesPath = join(PIPELINE_DIR, 'product-types.ts');
      writeFileSync(schemaPath, createComplexSchema());

      // Act
      const validateResult = runCli(`validate --schema ${schemaPath}`);
      const generateResult = runCli(`generate --schema ${schemaPath} --output ${typesPath}`);

      // Assert
      expect(validateResult.code).toBe(0);
      expect(generateResult.code).toBe(0);

      const content = readFileSync(typesPath, 'utf-8');
      // Check various type mappings
      expect(content).toContain('sku');
      expect(content).toContain('price');
      expect(content).toContain('inventory');
      expect(content).toContain('weight');
      expect(content).toContain('isActive');
      expect(content).toContain('tags');
      expect(content).toContain('metadata');
    });

    it('should support nullable-style option in type generation', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'nullable-schema.mjs');
      writeFileSync(schemaPath, createUserSchemaV1());

      // Test 'strict' nullable style
      const strictTypesPath = join(PIPELINE_DIR, 'types-strict.ts');
      const strictResult = runCli(`generate --schema ${schemaPath} --output ${strictTypesPath} --nullable-style strict`);
      expect(strictResult.code).toBe(0);
      const strictContent = readFileSync(strictTypesPath, 'utf-8');
      expect(strictContent).toMatch(/\| null[^|]/); // Contains ' | null' but not ' | null | undefined'

      // Test 'optional' nullable style
      const optionalTypesPath = join(PIPELINE_DIR, 'types-optional.ts');
      const optionalResult = runCli(`generate --schema ${schemaPath} --output ${optionalTypesPath} --nullable-style optional`);
      expect(optionalResult.code).toBe(0);
      const optionalContent = readFileSync(optionalTypesPath, 'utf-8');
      expect(optionalContent).toContain(' | undefined');

      // Test 'union' nullable style (default)
      const unionTypesPath = join(PIPELINE_DIR, 'types-union.ts');
      const unionResult = runCli(`generate --schema ${schemaPath} --output ${unionTypesPath} --nullable-style union`);
      expect(unionResult.code).toBe(0);
      const unionContent = readFileSync(unionTypesPath, 'utf-8');
      expect(unionContent).toContain(' | null | undefined');
    });
  });

  // ==========================================================================
  // PIPELINE 2: Schema file -> parse -> generate SQL -> DDL output
  // ==========================================================================

  describe('Pipeline 2: Schema -> Parse -> Generate SQL DDL', () => {
    const PIPELINE_DIR = join(TEST_DIR, 'pipeline2');

    beforeEach(() => {
      mkdirSync(PIPELINE_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(PIPELINE_DIR, { recursive: true, force: true });
    });

    it('should generate PostgreSQL DDL from schema', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'user-schema.mjs');
      const ddlPath = join(PIPELINE_DIR, 'user.sql');
      writeFileSync(schemaPath, createUserSchemaV1());

      // Act
      const result = runCli(`postgres export --schema ${schemaPath} --output ${ddlPath}`);

      // Assert
      expect(result.code).toBe(0);
      expect(existsSync(ddlPath)).toBe(true);

      const ddl = readFileSync(ddlPath, 'utf-8');
      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('User');
      expect(ddl).toContain('id');
      expect(ddl).toContain('email');
      expect(ddl).toContain('UUID');
    });

    it('should generate ClickHouse DDL from schema', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'product-schema.mjs');
      const ddlPath = join(PIPELINE_DIR, 'product.sql');
      writeFileSync(schemaPath, createComplexSchema());

      // Act
      const result = runCli(`clickhouse export --schema ${schemaPath} --output ${ddlPath}`);

      // Assert
      expect(result.code).toBe(0);
      expect(existsSync(ddlPath)).toBe(true);

      const ddl = readFileSync(ddlPath, 'utf-8');
      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('MergeTree');
    });

    it('should generate DuckDB DDL from schema', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'blog-schema.mjs');
      const ddlPath = join(PIPELINE_DIR, 'blog.sql');
      writeFileSync(schemaPath, createBlogSchemas());

      // Act
      const result = runCli(`duckdb export --schema ${schemaPath} --output ${ddlPath}`);

      // Assert
      expect(result.code).toBe(0);
      expect(existsSync(ddlPath)).toBe(true);

      const ddl = readFileSync(ddlPath, 'utf-8');
      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('User');
      expect(ddl).toContain('Post');
      expect(ddl).toContain('Comment');
    });

    it('should generate Iceberg metadata from schema', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'event-schema.mjs');
      const metadataPath = join(PIPELINE_DIR, 'iceberg-metadata.json');
      writeFileSync(schemaPath, createComplexSchema());

      // Act
      const result = runCli(`iceberg export --schema ${schemaPath} --output ${metadataPath} --location s3://test-bucket/products`);

      // Assert
      expect(result.code).toBe(0);
      expect(existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      expect(metadata).toHaveProperty('formatVersion');
      expect(metadata).toHaveProperty('schemas');
      expect(metadata).toHaveProperty('tableUuid');
      expect(metadata.location).toBe('s3://test-bucket/products');
    });

    it('should validate and then generate DDL in sequence', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'sequence-schema.mjs');
      const ddlPath = join(PIPELINE_DIR, 'sequence.sql');
      writeFileSync(schemaPath, createUserSchemaV1());

      // Act: First validate
      const validateResult = runCli(`validate --schema ${schemaPath}`);
      expect(validateResult.code).toBe(0);

      // Act: Then generate DDL for multiple dialects
      const postgresResult = runCli(`postgres export --schema ${schemaPath} --output ${ddlPath.replace('.sql', '-postgres.sql')}`);
      const duckdbResult = runCli(`duckdb export --schema ${schemaPath} --output ${ddlPath.replace('.sql', '-duckdb.sql')}`);
      const clickhouseResult = runCli(`clickhouse export --schema ${schemaPath} --output ${ddlPath.replace('.sql', '-clickhouse.sql')}`);

      // Assert: All succeed
      expect(postgresResult.code).toBe(0);
      expect(duckdbResult.code).toBe(0);
      expect(clickhouseResult.code).toBe(0);

      // Assert: Files exist
      expect(existsSync(ddlPath.replace('.sql', '-postgres.sql'))).toBe(true);
      expect(existsSync(ddlPath.replace('.sql', '-duckdb.sql'))).toBe(true);
      expect(existsSync(ddlPath.replace('.sql', '-clickhouse.sql'))).toBe(true);
    });
  });

  // ==========================================================================
  // PIPELINE 3: Schema v1 -> Schema v2 -> diff -> migration
  // ==========================================================================

  describe('Pipeline 3: Schema Evolution -> Diff -> Migration', () => {
    const PIPELINE_DIR = join(TEST_DIR, 'pipeline3');

    beforeEach(() => {
      mkdirSync(PIPELINE_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(PIPELINE_DIR, { recursive: true, force: true });
    });

    it('should detect added fields when comparing schema versions', () => {
      // Arrange: Create v1 and v2 schemas
      const schemaV1Path = join(PIPELINE_DIR, 'user-v1.mjs');
      const schemaV2Path = join(PIPELINE_DIR, 'user-v2.mjs');
      const migrationPath = join(PIPELINE_DIR, 'migration.sql');

      writeFileSync(schemaV1Path, createUserSchemaV1());
      writeFileSync(schemaV2Path, createUserSchemaV2());

      // Act: Run diff command
      const diffResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --output ${migrationPath}`);

      // Assert: Diff succeeds
      expect(diffResult.code).toBe(0);
      expect(diffResult.stdout).toContain('Comparing schemas');

      // Assert: Migration file exists and contains expected changes
      expect(existsSync(migrationPath)).toBe(true);
      const migration = readFileSync(migrationPath, 'utf-8');
      expect(migration).toContain('User');
      // Should detect age and status as new fields
      expect(migration.toLowerCase()).toMatch(/age|status|updatedat/i);
    });

    it('should generate dialect-specific migration SQL', () => {
      // Arrange
      const schemaV1Path = join(PIPELINE_DIR, 'schema-v1.mjs');
      const schemaV2Path = join(PIPELINE_DIR, 'schema-v2.mjs');

      writeFileSync(schemaV1Path, createUserSchemaV1());
      writeFileSync(schemaV2Path, createUserSchemaV2());

      // Act: Generate migrations for different dialects
      const postgresPath = join(PIPELINE_DIR, 'migration-postgres.sql');
      const clickhousePath = join(PIPELINE_DIR, 'migration-clickhouse.sql');
      const duckdbPath = join(PIPELINE_DIR, 'migration-duckdb.sql');

      const postgresResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --dialect postgres --output ${postgresPath}`);
      const clickhouseResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --dialect clickhouse --output ${clickhousePath}`);
      const duckdbResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --dialect duckdb --output ${duckdbPath}`);

      // Assert
      expect(postgresResult.code).toBe(0);
      expect(clickhouseResult.code).toBe(0);
      expect(duckdbResult.code).toBe(0);

      // Each file should have dialect-specific syntax
      const postgresMigration = readFileSync(postgresPath, 'utf-8');
      expect(postgresMigration).toContain('Dialect: postgres');

      const clickhouseMigration = readFileSync(clickhousePath, 'utf-8');
      expect(clickhouseMigration).toContain('Dialect: clickhouse');

      const duckdbMigration = readFileSync(duckdbPath, 'utf-8');
      expect(duckdbMigration).toContain('Dialect: duckdb');
    });

    it('should report no changes when schemas are identical', () => {
      // Arrange
      const schemaV1Path = join(PIPELINE_DIR, 'identical-v1.mjs');
      const schemaV2Path = join(PIPELINE_DIR, 'identical-v2.mjs');

      // Create identical schemas
      writeFileSync(schemaV1Path, createUserSchemaV1());
      writeFileSync(schemaV2Path, createUserSchemaV1());

      // Act
      const diffResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path}`);

      // Assert
      expect(diffResult.code).toBe(0);
      expect(diffResult.stdout).toContain('No schema changes detected');
    });

    it('should handle schema with removed fields', () => {
      // Arrange: v2 has more fields, so v2 -> v1 means fields removed
      const schemaV1Path = join(PIPELINE_DIR, 'remove-old.mjs');
      const schemaV2Path = join(PIPELINE_DIR, 'remove-new.mjs');

      // Swap: use v2 as old (more fields) and v1 as new (fewer fields)
      writeFileSync(schemaV1Path, createUserSchemaV2()); // Old has more fields
      writeFileSync(schemaV2Path, createUserSchemaV1()); // New has fewer fields

      // Act
      const diffResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path}`);

      // Assert: Should detect breaking change
      expect(diffResult.code).toBe(0);
      // Migration should indicate field removal (breaking change)
      expect(diffResult.stdout.toLowerCase()).toMatch(/removed|drop|breaking/i);
    });

    it('should complete full evolution workflow: validate v1, validate v2, diff, migrate', () => {
      // Arrange
      const schemaV1Path = join(PIPELINE_DIR, 'full-workflow-v1.mjs');
      const schemaV2Path = join(PIPELINE_DIR, 'full-workflow-v2.mjs');
      const migrationPath = join(PIPELINE_DIR, 'full-workflow-migration.sql');

      writeFileSync(schemaV1Path, createUserSchemaV1());
      writeFileSync(schemaV2Path, createUserSchemaV2());

      // Act: Full workflow
      // Step 1: Validate v1
      const validateV1 = runCli(`validate --schema ${schemaV1Path}`);
      expect(validateV1.code).toBe(0);

      // Step 2: Validate v2
      const validateV2 = runCli(`validate --schema ${schemaV2Path}`);
      expect(validateV2.code).toBe(0);

      // Step 3: Diff
      const diffResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --dialect postgres --output ${migrationPath}`);
      expect(diffResult.code).toBe(0);

      // Step 4: Verify migration content
      expect(existsSync(migrationPath)).toBe(true);
      const migration = readFileSync(migrationPath, 'utf-8');
      expect(migration).toContain('IceType Migration');
    });
  });

  // ==========================================================================
  // PIPELINE 4: Error Handling Throughout Pipeline
  // ==========================================================================

  describe('Pipeline 4: Error Handling', () => {
    const PIPELINE_DIR = join(TEST_DIR, 'pipeline4');

    beforeEach(() => {
      mkdirSync(PIPELINE_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(PIPELINE_DIR, { recursive: true, force: true });
    });

    it('should fail validation for schema with invalid type', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'invalid-type.mjs');
      writeFileSync(schemaPath, createInvalidSchema());

      // Act
      const result = runCli(`validate --schema ${schemaPath}`);

      // Assert: Should fail with meaningful error
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/invalid|error|unknown/i);
    });

    it('should fail gracefully when schema file does not exist', () => {
      // Act
      const result = runCli(`validate --schema /nonexistent/path/schema.mjs`);

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/not found|does not exist|no such file/i);
    });

    it('should fail gracefully when schema file has syntax error', () => {
      // Arrange: Create a file with JavaScript syntax error
      const schemaPath = join(PIPELINE_DIR, 'syntax-error.mjs');
      writeFileSync(schemaPath, `
        export const BrokenSchema = {
          // Missing closing brace
          $type: 'Broken'
      `);

      // Act
      const result = runCli(`validate --schema ${schemaPath}`);

      // Assert: Should fail with syntax-related error
      expect(result.code).not.toBe(0);
    });

    it('should fail generate when schema validation fails', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'invalid-for-generate.mjs');
      const outputPath = join(PIPELINE_DIR, 'types.ts');

      // Create schema that will fail to load
      writeFileSync(schemaPath, 'this is not valid javascript at all!!!');

      // Act
      const result = runCli(`generate --schema ${schemaPath} --output ${outputPath}`);

      // Assert
      expect(result.code).not.toBe(0);
      expect(existsSync(outputPath)).toBe(false);
    });

    it('should fail diff when old schema does not exist', () => {
      // Arrange
      const schemaV2Path = join(PIPELINE_DIR, 'only-v2.mjs');
      writeFileSync(schemaV2Path, createUserSchemaV2());

      // Act
      const result = runCli(`diff --old /nonexistent/v1.mjs --new ${schemaV2Path}`);

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/not found|does not exist|no such file/i);
    });

    it('should fail diff when new schema does not exist', () => {
      // Arrange
      const schemaV1Path = join(PIPELINE_DIR, 'only-v1.mjs');
      writeFileSync(schemaV1Path, createUserSchemaV1());

      // Act
      const result = runCli(`diff --old ${schemaV1Path} --new /nonexistent/v2.mjs`);

      // Assert
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/not found|does not exist|no such file/i);
    });

    it('should handle output directory that does not exist', () => {
      // Arrange
      const schemaPath = join(PIPELINE_DIR, 'schema-for-output.mjs');
      const nonexistentDir = join(PIPELINE_DIR, 'nonexistent', 'deep', 'path');
      const outputPath = join(nonexistentDir, 'types.ts');

      writeFileSync(schemaPath, createUserSchemaV1());

      // Act: Try to generate to nonexistent directory
      const result = runCli(`generate --schema ${schemaPath} --output ${outputPath}`);

      // Assert: Should fail (cannot write to nonexistent directory)
      expect(result.code).not.toBe(0);
    });

    it('should provide helpful error message for missing required options', () => {
      // Act: Run commands without required options
      const validateResult = runCli('validate');
      const generateResult = runCli('generate');
      const diffResult = runCli('diff --old /some/path');

      // Assert: All should fail with helpful messages
      expect(validateResult.code).not.toBe(0);
      expect(validateResult.stderr + validateResult.stdout).toMatch(/schema|required/i);

      expect(generateResult.code).not.toBe(0);
      expect(generateResult.stderr + generateResult.stdout).toMatch(/schema|required/i);

      expect(diffResult.code).not.toBe(0);
      expect(diffResult.stderr + diffResult.stdout).toMatch(/new|required/i);
    });

    it('should handle invalid dialect gracefully', () => {
      // Arrange
      const schemaV1Path = join(PIPELINE_DIR, 'dialect-v1.mjs');
      const schemaV2Path = join(PIPELINE_DIR, 'dialect-v2.mjs');

      writeFileSync(schemaV1Path, createUserSchemaV1());
      writeFileSync(schemaV2Path, createUserSchemaV2());

      // Act: Use invalid dialect
      const result = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --dialect invalid_dialect`);

      // Assert: Should fail with dialect error
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/dialect|invalid|unsupported/i);
    });
  });

  // ==========================================================================
  // Integration: Complete End-to-End Workflow
  // ==========================================================================

  describe('Integration: Complete End-to-End Workflow', () => {
    const INTEGRATION_DIR = join(TEST_DIR, 'integration');

    beforeEach(() => {
      mkdirSync(INTEGRATION_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(INTEGRATION_DIR, { recursive: true, force: true });
    });

    it('should complete full development workflow: create -> validate -> generate types -> export SQL -> evolve -> diff', async () => {
      // Step 1: Create initial schema
      const schemaV1Path = join(INTEGRATION_DIR, 'schema-v1.mjs');
      writeFileSync(schemaV1Path, createUserSchemaV1());

      // Step 2: Validate initial schema
      const validateV1 = runCli(`validate --schema ${schemaV1Path}`);
      expect(validateV1.code).toBe(0);
      expect(validateV1.stdout).toContain('is valid');

      // Step 3: Generate TypeScript types
      const typesPath = join(INTEGRATION_DIR, 'types.ts');
      const generateTypes = runCli(`generate --schema ${schemaV1Path} --output ${typesPath}`);
      expect(generateTypes.code).toBe(0);
      expect(existsSync(typesPath)).toBe(true);

      // Step 4: Export SQL DDL
      const ddlPath = join(INTEGRATION_DIR, 'init.sql');
      const exportDdl = runCli(`postgres export --schema ${schemaV1Path} --output ${ddlPath}`);
      expect(exportDdl.code).toBe(0);
      expect(existsSync(ddlPath)).toBe(true);

      // Step 5: Create evolved schema (v2)
      const schemaV2Path = join(INTEGRATION_DIR, 'schema-v2.mjs');
      writeFileSync(schemaV2Path, createUserSchemaV2());

      // Step 6: Validate evolved schema
      const validateV2 = runCli(`validate --schema ${schemaV2Path}`);
      expect(validateV2.code).toBe(0);

      // Step 7: Generate migration diff
      const migrationPath = join(INTEGRATION_DIR, 'migration-001.sql');
      const diffResult = runCli(`diff --old ${schemaV1Path} --new ${schemaV2Path} --dialect postgres --output ${migrationPath}`);
      expect(diffResult.code).toBe(0);
      expect(existsSync(migrationPath)).toBe(true);

      // Step 8: Regenerate types for v2
      const typesV2Path = join(INTEGRATION_DIR, 'types-v2.ts');
      const generateTypesV2 = runCli(`generate --schema ${schemaV2Path} --output ${typesV2Path}`);
      expect(generateTypesV2.code).toBe(0);

      // Verify final types include new fields
      const v2TypesContent = readFileSync(typesV2Path, 'utf-8');
      expect(v2TypesContent).toContain('age');
      expect(v2TypesContent).toContain('status');
      expect(v2TypesContent).toContain('updatedAt');
    });

    it('should handle multi-schema application workflow', () => {
      // Create a comprehensive schema file
      const schemaPath = join(INTEGRATION_DIR, 'app-schemas.mjs');
      writeFileSync(schemaPath, createBlogSchemas());

      // Validate
      const validateResult = runCli(`validate --schema ${schemaPath}`);
      expect(validateResult.code).toBe(0);
      expect(validateResult.stdout).toContain('3 schema(s)');

      // Generate types
      const typesPath = join(INTEGRATION_DIR, 'app-types.ts');
      const generateResult = runCli(`generate --schema ${schemaPath} --output ${typesPath}`);
      expect(generateResult.code).toBe(0);

      // Export DDL for multiple dialects
      const postgresDdl = join(INTEGRATION_DIR, 'app-postgres.sql');
      const duckdbDdl = join(INTEGRATION_DIR, 'app-duckdb.sql');
      const icebergMeta = join(INTEGRATION_DIR, 'app-iceberg.json');

      const pgResult = runCli(`postgres export --schema ${schemaPath} --output ${postgresDdl}`);
      const duckResult = runCli(`duckdb export --schema ${schemaPath} --output ${duckdbDdl}`);
      const iceResult = runCli(`iceberg export --schema ${schemaPath} --output ${icebergMeta} --location s3://bucket/app`);

      expect(pgResult.code).toBe(0);
      expect(duckResult.code).toBe(0);
      expect(iceResult.code).toBe(0);

      // Verify all outputs exist
      expect(existsSync(typesPath)).toBe(true);
      expect(existsSync(postgresDdl)).toBe(true);
      expect(existsSync(duckdbDdl)).toBe(true);
      expect(existsSync(icebergMeta)).toBe(true);

      // Verify types contain all schemas
      const types = readFileSync(typesPath, 'utf-8');
      expect(types).toContain('interface User');
      expect(types).toContain('interface Post');
      expect(types).toContain('interface Comment');
    });
  });
});
