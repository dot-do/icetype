/**
 * Path Sanitization Tests for @icetype/cli
 *
 * Tests to ensure CLI commands properly sanitize file paths to prevent:
 * - Path traversal attacks (../)
 * - Absolute paths outside project directory
 * - Symbolic links to sensitive files
 * - Invalid file extensions
 * - Output path injection
 *
 * TDD RED Phase: These tests document expected security behavior.
 * All tests should FAIL initially since sanitization is not yet implemented.
 *
 * @see icetype-1kz.7
 */

// IMPORTANT: Enable strict path security validation for these tests
// This overrides the vitest.config.ts setting that disables it for other tests
process.env.ICETYPE_SKIP_PATH_SECURITY = '';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IceTypeSchema, FieldDefinition } from '@icetype/core';

// =============================================================================
// Test Setup
// =============================================================================

// Mock console to suppress output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

/**
 * Create a valid IceTypeSchema for testing
 */
function createValidSchema(name: string = 'TestEntity'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// Path Traversal Attack Prevention Tests
// =============================================================================

describe('path traversal attack prevention', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate command', () => {
    it('should reject schema paths containing .. traversal', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Attempting to read from parent directories should be rejected
      await expect(
        generate(['--schema', '../../../etc/passwd', '-q'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });

    it('should reject schema paths with encoded .. traversal (%2e%2e)', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // URL-encoded traversal should also be rejected
      await expect(
        generate(['--schema', '%2e%2e/%2e%2e/etc/passwd', '-q'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });

    it('should reject output paths containing .. traversal', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Attempting to write outside project should be rejected
      await expect(
        generate(['--schema', './schema.ts', '--output', '../../malicious.ts', '-q'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });

    it('should reject paths with mixed separators and traversal (foo\\..\\bar)', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Windows-style path traversal should also be rejected
      await expect(
        generate(['--schema', 'foo\\..\\..\\etc\\passwd', '-q'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });
  });

  describe('init command', () => {
    it('should reject directory paths containing .. traversal', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(false),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
        };
      });

      const { init } = await import('../commands/init.js');

      // Attempting to create directories outside project should be rejected
      await expect(
        init(['--dir', '../../../tmp/malicious'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });
  });

  describe('validate command', () => {
    it('should reject schema paths containing .. traversal', async () => {
      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      const { validate } = await import('../commands/validate.js');

      await expect(
        validate(['--schema', '../../sensitive/schema.ts', '-q'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });
  });

  describe('migrate command', () => {
    it('should reject schema paths containing .. traversal', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(true),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
          readdirSync: vi.fn().mockReturnValue([]),
          readFileSync: vi.fn().mockReturnValue(''),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      const { migrate } = await import('../commands/migrate.js');

      await expect(
        migrate(['generate', '--schema', '../../../etc/shadow', '--dialect', 'postgres'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });

    it('should reject output directory paths containing .. traversal', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(true),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
          readdirSync: vi.fn().mockReturnValue([]),
          readFileSync: vi.fn().mockReturnValue(''),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      const { migrate } = await import('../commands/migrate.js');

      await expect(
        migrate(['generate', '--schema', './schema.ts', '--output', '../../../tmp/migrations', '--dialect', 'postgres'])
      ).rejects.toThrow(/path traversal|invalid path|security/i);
    });
  });
});

// =============================================================================
// Absolute Path Outside Project Tests
// =============================================================================

describe('absolute path outside project prevention', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate command', () => {
    it('should reject absolute schema paths outside project directory', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Absolute paths to sensitive system files should be rejected
      await expect(
        generate(['--schema', '/etc/passwd', '-q'])
      ).rejects.toThrow(/outside project|invalid path|security|absolute/i);
    });

    it('should reject absolute output paths outside project directory', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Writing to absolute paths outside project should be rejected
      await expect(
        generate(['--schema', './schema.ts', '--output', '/tmp/malicious.ts', '-q'])
      ).rejects.toThrow(/outside project|invalid path|security|absolute/i);
    });

    it('should allow absolute paths within project directory', async () => {
      const projectRoot = process.cwd();
      const schemaPath = path.join(projectRoot, 'schema.ts');
      const outputPath = path.join(projectRoot, 'types.generated.ts');

      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // This should succeed - absolute paths within project are fine
      await generate(['--schema', schemaPath, '--output', outputPath, '-q']);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('init command', () => {
    it('should reject absolute directory paths outside project', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(false),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
        };
      });

      const { init } = await import('../commands/init.js');

      await expect(
        init(['--dir', '/tmp/malicious-project'])
      ).rejects.toThrow(/outside project|invalid path|security|absolute/i);
    });
  });
});

// =============================================================================
// Symbolic Link Security Tests
// =============================================================================

describe('symbolic link security', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate command', () => {
    it('should reject schema paths that are symlinks to sensitive files', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
          lstatSync: vi.fn().mockReturnValue({
            isSymbolicLink: () => true,
          }),
          realpathSync: vi.fn().mockReturnValue('/etc/passwd'),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Symlinks pointing outside project should be rejected
      await expect(
        generate(['--schema', './malicious-symlink.ts', '-q'])
      ).rejects.toThrow(/symlink|symbolic link|security|outside project/i);
    });

    it('should reject output paths that would follow symlinks outside project', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
          lstatSync: vi.fn().mockImplementation((filePath: string) => {
            if (filePath.includes('output')) {
              return { isSymbolicLink: () => true };
            }
            return { isSymbolicLink: () => false };
          }),
          realpathSync: vi.fn().mockImplementation((filePath: string) => {
            if (filePath.includes('output')) {
              return '/tmp/external/types.ts';
            }
            return filePath;
          }),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await expect(
        generate(['--schema', './schema.ts', '--output', './output-symlink.ts', '-q'])
      ).rejects.toThrow(/symlink|symbolic link|security|outside project/i);
    });

    it('should allow symlinks that resolve within project directory', async () => {
      const projectRoot = process.cwd();
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
          lstatSync: vi.fn().mockReturnValue({
            isSymbolicLink: () => true,
          }),
          realpathSync: vi.fn().mockReturnValue(path.join(projectRoot, 'actual-schema.ts')),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Symlinks within project should be allowed
      await generate(['--schema', './schema-symlink.ts', '-q']);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('init command', () => {
    it('should reject directory paths that are symlinks to sensitive locations', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(true),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
          lstatSync: vi.fn().mockReturnValue({
            isSymbolicLink: () => true,
          }),
          realpathSync: vi.fn().mockReturnValue('/etc'),
        };
      });

      const { init } = await import('../commands/init.js');

      await expect(
        init(['--dir', './symlink-to-etc'])
      ).rejects.toThrow(/symlink|symbolic link|security|outside project/i);
    });
  });
});

// =============================================================================
// File Extension Validation Tests
// =============================================================================

describe('file extension validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate command', () => {
    it('should reject schema files with invalid extensions', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Executable or script files should be rejected
      await expect(
        generate(['--schema', './malicious.sh', '-q'])
      ).rejects.toThrow(/invalid.*extension|unsupported.*file|security/i);
    });

    it('should reject output files with non-TypeScript extensions', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Output should only be .ts, .js, or .d.ts files
      await expect(
        generate(['--schema', './schema.ts', '--output', './types.exe', '-q'])
      ).rejects.toThrow(/invalid.*extension|unsupported.*file|security/i);
    });

    it('should reject schema files with double extensions (schema.ts.exe)', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await expect(
        generate(['--schema', './schema.ts.exe', '-q'])
      ).rejects.toThrow(/invalid.*extension|unsupported.*file|security/i);
    });

    it('should allow valid schema extensions (.ts, .js, .mjs, .json)', async () => {
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Valid extensions should work
      await generate(['--schema', './schema.ts', '-q']);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should allow valid output extensions (.ts, .d.ts)', async () => {
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: mockWriteFileSync,
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await generate(['--schema', './schema.ts', '--output', './types.d.ts', '-q']);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('migrate command', () => {
    it('should reject invalid extensions for migration output files', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(true),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
          readdirSync: vi.fn().mockReturnValue([]),
          readFileSync: vi.fn().mockReturnValue(''),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      const { migrate } = await import('../commands/migrate.js');

      // Migration files should only be .sql or valid formats
      await expect(
        migrate(['generate', '--schema', './schema.ts', '--output', './migrations.php', '--dialect', 'postgres'])
      ).rejects.toThrow(/invalid.*extension|unsupported.*file|format/i);
    });
  });
});

// =============================================================================
// Output Path Sanitization Tests
// =============================================================================

describe('output path sanitization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate command', () => {
    it('should reject output paths with null bytes', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Null byte injection should be rejected
      await expect(
        generate(['--schema', './schema.ts', '--output', './types\x00.ts', '-q'])
      ).rejects.toThrow(/null byte|invalid.*character|security/i);
    });

    it('should reject output paths with special shell characters', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Shell injection characters should be rejected or sanitized
      await expect(
        generate(['--schema', './schema.ts', '--output', './types;rm -rf /.ts', '-q'])
      ).rejects.toThrow(/invalid.*character|security|shell/i);
    });

    it('should reject output paths with pipe characters', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await expect(
        generate(['--schema', './schema.ts', '--output', './types|cat /etc/passwd.ts', '-q'])
      ).rejects.toThrow(/invalid.*character|security|pipe/i);
    });

    it('should reject schema paths with command substitution', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      // Command substitution should be rejected
      await expect(
        generate(['--schema', '$(cat /etc/passwd)', '-q'])
      ).rejects.toThrow(/invalid.*character|security|command/i);
    });

    it('should reject paths with backtick command execution', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          writeFileSync: vi.fn(),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      vi.doMock('../utils/watcher.js', () => ({
        watchGenerate: vi.fn(),
      }));

      const { generate } = await import('../commands/generate.js');

      await expect(
        generate(['--schema', '`whoami`.ts', '-q'])
      ).rejects.toThrow(/invalid.*character|security|command/i);
    });
  });

  describe('init command', () => {
    it('should reject directory names with special characters', async () => {
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          existsSync: vi.fn().mockReturnValue(false),
          writeFileSync: vi.fn(),
          mkdirSync: vi.fn(),
        };
      });

      const { init } = await import('../commands/init.js');

      await expect(
        init(['--dir', 'project;rm -rf /'])
      ).rejects.toThrow(/invalid.*character|security|shell/i);
    });
  });
});

// =============================================================================
// Edge Cases and Additional Security Tests
// =============================================================================

describe('additional path security edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should reject paths longer than reasonable limits', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: createValidSchema('User') }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    // Very long paths should be rejected
    const longPath = './' + 'a'.repeat(10000) + '.ts';
    await expect(
      generate(['--schema', longPath, '-q'])
    ).rejects.toThrow(/path.*too long|invalid path|length/i);
  });

  it('should reject paths with only dots', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: createValidSchema('User') }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    // Paths like "..." or "...." should be rejected
    await expect(
      generate(['--schema', '...', '-q'])
    ).rejects.toThrow(/invalid path|traversal|security/i);
  });

  it('should reject empty paths', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: createValidSchema('User') }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    // Empty paths should be rejected
    await expect(
      generate(['--schema', '', '-q'])
    ).rejects.toThrow(/empty|required|invalid/i);
  });

  it('should reject paths that normalize to parent directory', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: createValidSchema('User') }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    // Paths that normalize outside project should be rejected
    await expect(
      generate(['--schema', './foo/bar/../../../../../../etc/passwd', '-q'])
    ).rejects.toThrow(/path traversal|outside project|security/i);
  });

  it('should handle Unicode path traversal attempts', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: createValidSchema('User') }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    // Unicode variants of .. should be rejected
    // Full-width period: \uFF0E
    await expect(
      generate(['--schema', '\uFF0E\uFF0E/\uFF0E\uFF0E/etc/passwd', '-q'])
    ).rejects.toThrow(/path traversal|invalid|security/i);
  });

  it('should reject Windows UNC paths', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        writeFileSync: vi.fn(),
      };
    });

    vi.doMock('../utils/schema-loader.js', () => ({
      loadSchemaFile: vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: createValidSchema('User') }],
        errors: [],
      }),
    }));

    vi.doMock('../utils/watcher.js', () => ({
      watchGenerate: vi.fn(),
    }));

    const { generate } = await import('../commands/generate.js');

    // UNC paths should be rejected
    await expect(
      generate(['--schema', '\\\\server\\share\\schema.ts', '-q'])
    ).rejects.toThrow(/UNC|network|invalid|security/i);
  });
});

// =============================================================================
// Integration: Path Sanitization Utility Function Tests
// =============================================================================

describe('path sanitization utility functions (to be implemented)', () => {
  /**
   * These tests document the expected API for path sanitization utilities
   * that should be created in packages/cli/src/utils/path-sanitizer.ts
   */

  it('should export a sanitizePath function', async () => {
    // This import will fail until the utility is implemented
    const pathSanitizer = await import('../utils/path-sanitizer.js').catch(() => null);

    expect(pathSanitizer).not.toBeNull();
    expect(typeof pathSanitizer?.sanitizePath).toBe('function');
  });

  it('should export a validateSchemaPath function', async () => {
    const pathSanitizer = await import('../utils/path-sanitizer.js').catch(() => null);

    expect(pathSanitizer).not.toBeNull();
    expect(typeof pathSanitizer?.validateSchemaPath).toBe('function');
  });

  it('should export a validateOutputPath function', async () => {
    const pathSanitizer = await import('../utils/path-sanitizer.js').catch(() => null);

    expect(pathSanitizer).not.toBeNull();
    expect(typeof pathSanitizer?.validateOutputPath).toBe('function');
  });

  it('should export a isWithinProjectDirectory function', async () => {
    const pathSanitizer = await import('../utils/path-sanitizer.js').catch(() => null);

    expect(pathSanitizer).not.toBeNull();
    expect(typeof pathSanitizer?.isWithinProjectDirectory).toBe('function');
  });

  it('should export a checkSymlinkSafety function', async () => {
    const pathSanitizer = await import('../utils/path-sanitizer.js').catch(() => null);

    expect(pathSanitizer).not.toBeNull();
    expect(typeof pathSanitizer?.checkSymlinkSafety).toBe('function');
  });
});
