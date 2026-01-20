import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(tmpdir(), `icetype-e2e-${Date.now()}`);
const CLI_PATH = join(__dirname, '../../dist/cli.js');
// Use absolute path to @icetype/core for E2E tests to avoid module resolution issues
const CORE_PATH = resolve(__dirname, '../../../core/dist/index.js');

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
 * Create a valid IceType schema JavaScript file content.
 * This creates an ESM file that exports an IceTypeSchema object
 * using the parseSchema function from @icetype/core.
 * Uses absolute path to core for module resolution in temp directories.
 */
function createSchemaFileContent(schemaName: string = 'User'): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const ${schemaName}Schema = parseSchema({
  $type: '${schemaName}',
  id: 'uuid!',
  name: 'string',
  email: 'string#',
  age: 'int?',
  createdAt: 'timestamp',
});
`;
}

/**
 * Create a second valid schema file content for diff tests.
 * Uses absolute path to core for module resolution in temp directories.
 */
function createSchemaFileContentV2(schemaName: string = 'User'): string {
  return `import { parseSchema } from '${CORE_PATH}';

export const ${schemaName}Schema = parseSchema({
  $type: '${schemaName}',
  id: 'uuid!',
  name: 'string',
  email: 'string#',
  age: 'int?',
  createdAt: 'timestamp',
  updatedAt: 'timestamp?',
  status: 'string = "active"',
});
`;
}

describe('CLI E2E Tests', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('ice --help', () => {
    it('should display help with available commands', () => {
      const result = runCli('--help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('ice');
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('validate');
    });
  });

  describe('ice --version', () => {
    it('should display version number', () => {
      const result = runCli('--version');
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('ice validate', () => {
    it('should exit with error when schema file not found', () => {
      const result = runCli('validate --schema nonexistent.json');
      expect(result.code).not.toBe(0);
    });

    it('should validate and report errors for invalid JSON', () => {
      const schemaPath = join(TEST_DIR, 'invalid.json');
      writeFileSync(schemaPath, '{ invalid json }');
      const result = runCli(`validate --schema ${schemaPath}`);
      expect(result.code).not.toBe(0);
    });
  });

  describe('ice clickhouse export', () => {
    it('should error when --schema is missing', () => {
      const result = runCli('clickhouse export');
      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toContain('schema');
    });
  });

  describe('ice duckdb export', () => {
    it('should error when --schema is missing', () => {
      const result = runCli('duckdb export');
      expect(result.code).not.toBe(0);
    });
  });

  describe('ice postgres export', () => {
    it('should error when --schema is missing', () => {
      const result = runCli('postgres export');
      expect(result.code).not.toBe(0);
    });
  });

  describe('ice iceberg export', () => {
    it('should error when --schema is missing', () => {
      const result = runCli('iceberg export');
      expect(result.code).not.toBe(0);
    });
  });


  // ============================================================================
  // Successful Workflow Tests (with real file I/O)
  // ============================================================================

  describe('Successful Workflows', () => {
    const WORKFLOW_DIR = join(TEST_DIR, 'workflow-tests');

    beforeEach(() => {
      mkdirSync(WORKFLOW_DIR, { recursive: true });
    });

    afterEach(() => {
      rmSync(WORKFLOW_DIR, { recursive: true, force: true });
    });

    describe('ice validate - successful schema validation', () => {
      it('should validate a correct schema file and report success', () => {
        const schemaPath = join(WORKFLOW_DIR, 'valid-schema.mjs');
        writeFileSync(schemaPath, createSchemaFileContent('User'));

        const result = runCli(`validate --schema ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('UserSchema is valid');
        expect(result.stdout).toContain('All schemas are valid');
      });

      it('should validate schema with short flag -s', () => {
        const schemaPath = join(WORKFLOW_DIR, 'short-flag-schema.mjs');
        writeFileSync(schemaPath, createSchemaFileContent('Product'));

        const result = runCli(`validate -s ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('ProductSchema is valid');
      });

      it('should validate schema with multiple exports', () => {
        const schemaPath = join(WORKFLOW_DIR, 'multi-schema.mjs');
        // Use absolute path to core for module resolution
        const multiSchemaContent = `import { parseSchema } from '${CORE_PATH}';

export const UserSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string',
  email: 'string#',
});

export const PostSchema = parseSchema({
  $type: 'Post',
  id: 'uuid!',
  title: 'string',
  content: 'text',
  authorId: 'uuid',
});
`;
        writeFileSync(schemaPath, multiSchemaContent);

        const result = runCli(`validate --schema ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Found 2 schema(s)');
        expect(result.stdout).toContain('UserSchema is valid');
        expect(result.stdout).toContain('PostSchema is valid');
        expect(result.stdout).toContain('All schemas are valid');
      });

      it('should work with quiet flag', () => {
        const schemaPath = join(WORKFLOW_DIR, 'quiet-schema.mjs');
        writeFileSync(schemaPath, createSchemaFileContent('Order'));

        const result = runCli(`validate --schema ${schemaPath} --quiet`);

        expect(result.code).toBe(0);
        // Quiet mode should suppress most output
      });
    });

    describe('ice generate - successful TypeScript generation', () => {
      it('should generate TypeScript types from schema', () => {
        const schemaPath = join(WORKFLOW_DIR, 'generate-schema.mjs');
        const outputPath = join(WORKFLOW_DIR, 'generated-types.ts');
        writeFileSync(schemaPath, createSchemaFileContent('Customer'));

        const result = runCli(`generate --schema ${schemaPath} --output ${outputPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Generated types');
        expect(existsSync(outputPath)).toBe(true);

        // Verify the generated content
        const generatedContent = readFileSync(outputPath, 'utf-8');
        expect(generatedContent).toContain('export interface Customer');
        expect(generatedContent).toContain('export interface CustomerInput');
        expect(generatedContent).toContain('$id: string');
        expect(generatedContent).toContain('$type:');
        expect(generatedContent).toContain('name');
        expect(generatedContent).toContain('email');
        expect(generatedContent).toContain('@generated');
      });

      it('should generate types with short flags', () => {
        const schemaPath = join(WORKFLOW_DIR, 'generate-short.mjs');
        const outputPath = join(WORKFLOW_DIR, 'generated-short.ts');
        writeFileSync(schemaPath, createSchemaFileContent('Invoice'));

        const result = runCli(`generate -s ${schemaPath} -o ${outputPath}`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const generatedContent = readFileSync(outputPath, 'utf-8');
        expect(generatedContent).toContain('export interface Invoice');
      });

      it('should use default output path when not specified', () => {
        const schemaPath = join(WORKFLOW_DIR, 'default-output.mjs');
        const expectedOutputPath = join(WORKFLOW_DIR, 'default-output.generated.ts');
        writeFileSync(schemaPath, createSchemaFileContent('Account'));

        const result = runCli(`generate --schema ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(existsSync(expectedOutputPath)).toBe(true);

        const generatedContent = readFileSync(expectedOutputPath, 'utf-8');
        expect(generatedContent).toContain('export interface Account');
      });
    });

    describe('ice iceberg export - successful Iceberg metadata export', () => {
      it('should export Iceberg metadata from schema', () => {
        const schemaPath = join(WORKFLOW_DIR, 'iceberg-schema.mjs');
        const outputPath = join(WORKFLOW_DIR, 'iceberg-metadata.json');
        writeFileSync(schemaPath, createSchemaFileContent('Event'));

        const result = runCli(`iceberg export --schema ${schemaPath} --output ${outputPath} --location s3://test-bucket/events`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Exported Iceberg metadata');
        expect(existsSync(outputPath)).toBe(true);

        // Verify the generated Iceberg metadata
        const metadata = JSON.parse(readFileSync(outputPath, 'utf-8'));
        expect(metadata).toHaveProperty('formatVersion');
        expect(metadata).toHaveProperty('schemas');
        expect(metadata).toHaveProperty('tableUuid');
        expect(metadata.location).toBe('s3://test-bucket/events');
      });

      it('should export Iceberg metadata with short flags', () => {
        const schemaPath = join(WORKFLOW_DIR, 'iceberg-short.mjs');
        const outputPath = join(WORKFLOW_DIR, 'iceberg-short.json');
        writeFileSync(schemaPath, createSchemaFileContent('Metric'));

        const result = runCli(`iceberg export -s ${schemaPath} -o ${outputPath} -l s3://metrics-bucket/metrics`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);
      });
    });

    describe('ice clickhouse export - successful ClickHouse DDL export', () => {
      it('should export ClickHouse DDL from schema', () => {
        const schemaPath = join(WORKFLOW_DIR, 'clickhouse-schema.mjs');
        const outputPath = join(WORKFLOW_DIR, 'clickhouse-tables.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Transaction'));

        const result = runCli(`clickhouse export --schema ${schemaPath} --output ${outputPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Exported ClickHouse DDL');
        expect(existsSync(outputPath)).toBe(true);

        // Verify the generated DDL (table names are lowercase in ClickHouse)
        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('CREATE TABLE');
        expect(ddl.toLowerCase()).toContain('transaction');
        expect(ddl).toContain('MergeTree');
      });

      it('should export ClickHouse DDL with custom engine', () => {
        const schemaPath = join(WORKFLOW_DIR, 'clickhouse-engine.mjs');
        const outputPath = join(WORKFLOW_DIR, 'clickhouse-engine.sql');
        writeFileSync(schemaPath, createSchemaFileContent('LogEntry'));

        const result = runCli(`clickhouse export --schema ${schemaPath} --output ${outputPath} --engine ReplacingMergeTree`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('ReplacingMergeTree');
      });

      it('should export ClickHouse DDL with database prefix', () => {
        const schemaPath = join(WORKFLOW_DIR, 'clickhouse-db.mjs');
        const outputPath = join(WORKFLOW_DIR, 'clickhouse-db.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Analytics'));

        const result = runCli(`clickhouse export --schema ${schemaPath} --output ${outputPath} --database analytics_db`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('analytics_db');
      });

      it('should output to stdout when no output specified', () => {
        const schemaPath = join(WORKFLOW_DIR, 'clickhouse-stdout.mjs');
        writeFileSync(schemaPath, createSchemaFileContent('AuditLog'));

        const result = runCli(`clickhouse export --schema ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('CREATE TABLE');
        // Table names are lowercase in ClickHouse DDL
        expect(result.stdout.toLowerCase()).toContain('audit_log');
      });
    });

    describe('ice duckdb export - successful DuckDB DDL export', () => {
      it('should export DuckDB DDL from schema', () => {
        const schemaPath = join(WORKFLOW_DIR, 'duckdb-schema.mjs');
        const outputPath = join(WORKFLOW_DIR, 'duckdb-tables.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Report'));

        const result = runCli(`duckdb export --schema ${schemaPath} --output ${outputPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Exported DuckDB DDL');
        expect(existsSync(outputPath)).toBe(true);

        // Verify the generated DDL
        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('CREATE TABLE');
        expect(ddl).toContain('Report');
      });

      it('should export DuckDB DDL with schema name', () => {
        const schemaPath = join(WORKFLOW_DIR, 'duckdb-schema-name.mjs');
        const outputPath = join(WORKFLOW_DIR, 'duckdb-schema-name.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Dashboard'));

        const result = runCli(`duckdb export --schema ${schemaPath} --output ${outputPath} --schema-name analytics`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('analytics');
      });

      it('should export DuckDB DDL with if-not-exists', () => {
        const schemaPath = join(WORKFLOW_DIR, 'duckdb-if-not-exists.mjs');
        const outputPath = join(WORKFLOW_DIR, 'duckdb-if-not-exists.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Cache'));

        const result = runCli(`duckdb export --schema ${schemaPath} --output ${outputPath} --if-not-exists`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('IF NOT EXISTS');
      });

      it('should output to stdout when no output specified', () => {
        const schemaPath = join(WORKFLOW_DIR, 'duckdb-stdout.mjs');
        writeFileSync(schemaPath, createSchemaFileContent('Summary'));

        const result = runCli(`duckdb export --schema ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('CREATE TABLE');
        expect(result.stdout).toContain('Summary');
      });
    });

    describe('ice postgres export - successful PostgreSQL DDL export', () => {
      it('should export PostgreSQL DDL from schema', () => {
        const schemaPath = join(WORKFLOW_DIR, 'postgres-schema.mjs');
        const outputPath = join(WORKFLOW_DIR, 'postgres-tables.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Profile'));

        const result = runCli(`postgres export --schema ${schemaPath} --output ${outputPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Exported PostgreSQL DDL');
        expect(existsSync(outputPath)).toBe(true);

        // Verify the generated DDL
        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('CREATE TABLE');
        expect(ddl).toContain('Profile');
      });

      it('should export PostgreSQL DDL with schema name', () => {
        const schemaPath = join(WORKFLOW_DIR, 'postgres-schema-name.mjs');
        const outputPath = join(WORKFLOW_DIR, 'postgres-schema-name.sql');
        writeFileSync(schemaPath, createSchemaFileContent('Session'));

        const result = runCli(`postgres export --schema ${schemaPath} --output ${outputPath} --schemaName public`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const ddl = readFileSync(outputPath, 'utf-8');
        expect(ddl).toContain('"public"');
      });

      it('should output to stdout when no output specified', () => {
        const schemaPath = join(WORKFLOW_DIR, 'postgres-stdout.mjs');
        writeFileSync(schemaPath, createSchemaFileContent('Token'));

        const result = runCli(`postgres export --schema ${schemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('CREATE TABLE');
        expect(result.stdout).toContain('Token');
      });
    });

    describe('ice diff - successful schema comparison', () => {
      it('should diff two schema files and generate migration SQL', () => {
        const oldSchemaPath = join(WORKFLOW_DIR, 'old-schema.mjs');
        const newSchemaPath = join(WORKFLOW_DIR, 'new-schema.mjs');
        const outputPath = join(WORKFLOW_DIR, 'migration.sql');

        writeFileSync(oldSchemaPath, createSchemaFileContent('User'));
        writeFileSync(newSchemaPath, createSchemaFileContentV2('User'));

        const result = runCli(`diff --old ${oldSchemaPath} --new ${newSchemaPath} --output ${outputPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Comparing schemas');
        expect(result.stdout).toContain('Migration written to');
        expect(existsSync(outputPath)).toBe(true);

        // Verify the generated migration
        const migration = readFileSync(outputPath, 'utf-8');
        expect(migration).toContain('IceType Migration');
        // Should detect added fields
        expect(migration).toContain('User');
      });

      it('should diff with different SQL dialect', () => {
        const oldSchemaPath = join(WORKFLOW_DIR, 'old-dialect.mjs');
        const newSchemaPath = join(WORKFLOW_DIR, 'new-dialect.mjs');
        const outputPath = join(WORKFLOW_DIR, 'migration-clickhouse.sql');

        writeFileSync(oldSchemaPath, createSchemaFileContent('Event'));
        writeFileSync(newSchemaPath, createSchemaFileContentV2('Event'));

        const result = runCli(`diff --old ${oldSchemaPath} --new ${newSchemaPath} --dialect clickhouse --output ${outputPath}`);

        expect(result.code).toBe(0);
        expect(existsSync(outputPath)).toBe(true);

        const migration = readFileSync(outputPath, 'utf-8');
        expect(migration).toContain('Dialect: clickhouse');
      });

      it('should output migration to stdout when no output specified', () => {
        const oldSchemaPath = join(WORKFLOW_DIR, 'old-stdout.mjs');
        const newSchemaPath = join(WORKFLOW_DIR, 'new-stdout.mjs');

        writeFileSync(oldSchemaPath, createSchemaFileContent('Config'));
        writeFileSync(newSchemaPath, createSchemaFileContentV2('Config'));

        const result = runCli(`diff --old ${oldSchemaPath} --new ${newSchemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('IceType Migration');
        expect(result.stdout).toContain('Config');
      });

      it('should report no changes when schemas are identical', () => {
        const oldSchemaPath = join(WORKFLOW_DIR, 'same-old.mjs');
        const newSchemaPath = join(WORKFLOW_DIR, 'same-new.mjs');

        writeFileSync(oldSchemaPath, createSchemaFileContent('Identical'));
        writeFileSync(newSchemaPath, createSchemaFileContent('Identical'));

        const result = runCli(`diff --old ${oldSchemaPath} --new ${newSchemaPath}`);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('No schema changes detected');
      });
    });
  });

  // ============================================================================
  // Subcommand --help Tests
  // ============================================================================

  describe('ice generate --help', () => {
    it('should display usage information for generate command', () => {
      const result = runCli('generate --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('--schema');
      expect(result.stdout).toContain('--output');
    });

    it('should display short flags', () => {
      const result = runCli('generate -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('generate');
    });
  });

  describe('ice validate --help', () => {
    it('should display usage information for validate command', () => {
      const result = runCli('validate --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('validate');
      expect(result.stdout).toContain('--schema');
    });

    it('should display short flags', () => {
      const result = runCli('validate -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('validate');
    });
  });

  describe('ice diff --help', () => {
    it('should display usage information for diff command', () => {
      const result = runCli('diff --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('diff');
      expect(result.stdout).toContain('--old');
      expect(result.stdout).toContain('--new');
      expect(result.stdout).toContain('--dialect');
    });

    it('should display short flags', () => {
      const result = runCli('diff -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('diff');
    });
  });

  describe('ice clickhouse --help', () => {
    it('should display usage information for clickhouse command', () => {
      const result = runCli('clickhouse --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('clickhouse');
      expect(result.stdout).toContain('export');
    });

    it('should display short flags', () => {
      const result = runCli('clickhouse -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('clickhouse');
    });
  });

  describe('ice clickhouse export --help', () => {
    it('should display usage information for clickhouse export subcommand', () => {
      const result = runCli('clickhouse export --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('clickhouse');
      expect(result.stdout).toContain('export');
      expect(result.stdout).toContain('--schema');
      expect(result.stdout).toContain('--engine');
    });

    it('should display short flags', () => {
      const result = runCli('clickhouse export -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('clickhouse');
    });
  });

  describe('ice duckdb --help', () => {
    it('should display usage information for duckdb command', () => {
      const result = runCli('duckdb --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('duckdb');
      expect(result.stdout).toContain('export');
    });

    it('should display short flags', () => {
      const result = runCli('duckdb -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('duckdb');
    });
  });

  describe('ice duckdb export --help', () => {
    it('should display usage information for duckdb export subcommand', () => {
      const result = runCli('duckdb export --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('duckdb');
      expect(result.stdout).toContain('export');
      expect(result.stdout).toContain('--schema');
    });

    it('should display short flags', () => {
      const result = runCli('duckdb export -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('duckdb');
    });
  });

  describe('ice iceberg --help', () => {
    it('should display usage information for iceberg command', () => {
      const result = runCli('iceberg --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('iceberg');
      expect(result.stdout).toContain('export');
    });

    it('should display short flags', () => {
      const result = runCli('iceberg -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('iceberg');
    });
  });

  describe('ice iceberg export --help', () => {
    it('should display usage information for iceberg export subcommand', () => {
      const result = runCli('iceberg export --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('iceberg');
      expect(result.stdout).toContain('export');
      expect(result.stdout).toContain('--schema');
      expect(result.stdout).toContain('--location');
    });

    it('should display short flags', () => {
      const result = runCli('iceberg export -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('iceberg');
    });
  });

  describe('ice postgres --help', () => {
    it('should display usage information for postgres command', () => {
      const result = runCli('postgres --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('postgres');
      expect(result.stdout).toContain('export');
    });

    it('should display short flags', () => {
      const result = runCli('postgres -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('postgres');
    });
  });

  describe('ice postgres export --help', () => {
    it('should display usage information for postgres export subcommand', () => {
      const result = runCli('postgres export --help');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('postgres');
      expect(result.stdout).toContain('export');
      expect(result.stdout).toContain('--schema');
      expect(result.stdout).toContain('--schemaName');
    });

    it('should display short flags', () => {
      const result = runCli('postgres export -h');
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('postgres');
    });
  });
});
