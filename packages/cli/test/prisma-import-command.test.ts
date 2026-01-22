/**
 * Prisma Import Command Tests for @icetype/cli
 *
 * Tests for the ice prisma import command using TDD approach.
 * Uses mocked file system operations and parsePrismaFile.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import type { IceTypeSchemaDefinition } from '@icetype/prisma';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sample Prisma schema for testing
 */
const SAMPLE_PRISMA_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
`;

/**
 * Simple Prisma schema with only one model
 */
const SIMPLE_PRISMA_SCHEMA = `
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String
}
`;

/**
 * Create sample IceType schema definitions for testing formatters
 */
function createSampleSchemas(): IceTypeSchemaDefinition[] {
  return [
    {
      $type: 'User',
      id: 'uuid!# = uuid()',
      email: 'string!#',
      name: 'string?',
      posts: '[Post]',
    },
    {
      $type: 'Post',
      id: 'uuid!# = uuid()',
      title: 'string!',
      content: 'string?',
      published: 'bool! = false',
      author: 'User!',
      authorId: 'string!',
    },
  ];
}

// =============================================================================
// Prisma Import Command Tests
// =============================================================================

describe('ice prisma import command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Test Helper Functions - formatAsTypeScript
  // ===========================================================================

  describe('formatAsTypeScript', () => {
    it('should generate valid TypeScript code with import statement', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsTypeScript(schemas);

      expect(output).toContain("import { DB } from '@icetype/core';");
      expect(output).toContain('export const db = DB({');
    });

    it('should include all schema names in the output', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsTypeScript(schemas);

      expect(output).toContain('User: {');
      expect(output).toContain('Post: {');
    });

    it('should include field definitions for each schema', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsTypeScript(schemas);

      expect(output).toContain("id: 'uuid!# = uuid()'");
      expect(output).toContain("email: 'string!#'");
      expect(output).toContain("name: 'string?'");
    });

    it('should export individual schema types', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsTypeScript(schemas);

      expect(output).toContain('export const UserSchema = db.User;');
      expect(output).toContain('export const PostSchema = db.Post;');
    });

    it('should include header comment', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsTypeScript(schemas);

      expect(output).toContain('IceType Schema Definitions');
      expect(output).toContain('Generated from Prisma schema');
    });

    it('should handle empty schemas array', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const output = _testHelpers.formatAsTypeScript([]);

      expect(output).toContain('export const db = DB({');
      expect(output).toContain('});');
    });

    it('should escape single quotes in field values', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas: IceTypeSchemaDefinition[] = [
        {
          $type: 'Test',
          value: "string! = 'default'",
        },
      ];

      const output = _testHelpers.formatAsTypeScript(schemas);

      expect(output).toContain("value: 'string! = \\'default\\''");
    });
  });

  // ===========================================================================
  // Test Helper Functions - formatAsJson
  // ===========================================================================

  describe('formatAsJson', () => {
    it('should generate valid JSON output', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsJson(schemas);
      const parsed = JSON.parse(output);

      expect(parsed).toBeInstanceOf(Array);
      expect(parsed.length).toBe(2);
    });

    it('should include all schema properties in JSON', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsJson(schemas);
      const parsed = JSON.parse(output);

      expect(parsed[0].$type).toBe('User');
      expect(parsed[0].id).toBe('uuid!# = uuid()');
      expect(parsed[1].$type).toBe('Post');
    });

    it('should pretty-print JSON with indentation', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatAsJson(schemas);

      // Check for indentation (2 spaces)
      expect(output).toContain('  "$type"');
      expect(output).toContain('  "id"');
    });

    it('should handle empty schemas array', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const output = _testHelpers.formatAsJson([]);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual([]);
    });
  });

  // ===========================================================================
  // Test Helper Functions - formatSchemas
  // ===========================================================================

  describe('formatSchemas', () => {
    it('should format as TypeScript when format is ts', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatSchemas(schemas, 'ts');

      expect(output).toContain("import { DB } from '@icetype/core';");
    });

    it('should format as JSON when format is json', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      const output = _testHelpers.formatSchemas(schemas, 'json');

      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should throw InvalidOptionError for invalid format', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');
      const schemas = createSampleSchemas();

      expect(() => {
        // @ts-expect-error - Testing invalid format
        _testHelpers.formatSchemas(schemas, 'yaml');
      }).toThrow('Unexpected value');
    });
  });

  // ===========================================================================
  // Test Helper Functions - parseCliArgs
  // ===========================================================================

  describe('parseCliArgs', () => {
    it('should parse --input option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['--input', './schema.prisma']);

      expect(result.input).toBe('./schema.prisma');
    });

    it('should parse -i shorthand for input', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', './schema.prisma']);

      expect(result.input).toBe('./schema.prisma');
    });

    it('should parse --output option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '--output', './out.ts']);

      expect(result.output).toBe('./out.ts');
    });

    it('should parse -o shorthand for output', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '-o', './out.ts']);

      expect(result.output).toBe('./out.ts');
    });

    it('should parse --format option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '--format', 'json']);

      expect(result.format).toBe('json');
    });

    it('should parse -f shorthand for format', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '-f', 'ts']);

      expect(result.format).toBe('ts');
    });

    it('should parse --quiet option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '--quiet']);

      expect(result.quiet).toBe(true);
    });

    it('should parse -q shorthand for quiet', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '-q']);

      expect(result.quiet).toBe(true);
    });

    it('should parse --verbose option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '--verbose']);

      expect(result.verbose).toBe(true);
    });

    it('should parse -v shorthand for verbose', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '-v']);

      expect(result.verbose).toBe(true);
    });

    it('should parse --no-relations option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '--no-relations']);

      expect(result.noRelations).toBe(true);
    });

    it('should parse --no-unique-to-indexed option', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma', '--no-unique-to-indexed']);

      expect(result.noUniqueToIndexed).toBe(true);
    });

    it('should default boolean options to false', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs(['-i', 'in.prisma']);

      expect(result.quiet).toBe(false);
      expect(result.verbose).toBe(false);
      expect(result.noRelations).toBe(false);
      expect(result.noUniqueToIndexed).toBe(false);
    });

    it('should handle combined options', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      const result = _testHelpers.parseCliArgs([
        '-i',
        'schema.prisma',
        '-o',
        'output.ts',
        '-f',
        'ts',
        '-q',
        '--no-relations',
      ]);

      expect(result.input).toBe('schema.prisma');
      expect(result.output).toBe('output.ts');
      expect(result.format).toBe('ts');
      expect(result.quiet).toBe(true);
      expect(result.noRelations).toBe(true);
    });
  });

  // ===========================================================================
  // Main Command Tests - prismaImport
  // ===========================================================================

  describe('prismaImport', () => {
    it('should error when --input is missing', async () => {
      const { prismaImport } = await import('../commands/prisma-import.js');

      await expect(prismaImport([])).rejects.toThrow('--input is required');
    });

    it('should parse Prisma schema and output to stdout', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(SIMPLE_PRISMA_SCHEMA);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '-q']);

      // Check that console.log was called with output
      const calls = mockConsoleLog.mock.calls;
      const outputCall = calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'string' && arg.includes('DB(');
      });

      expect(outputCall).toBeDefined();
    });

    it('should write to output file when --output is specified', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(SIMPLE_PRISMA_SCHEMA);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '-o', './output.ts', '-q']);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [path, content] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
      expect(path).toBe('./output.ts');
      expect(content).toContain('DB(');
    });

    it('should generate JSON output when --format json is specified', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(SIMPLE_PRISMA_SCHEMA);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '-f', 'json', '-q']);

      const calls = mockConsoleLog.mock.calls;
      const outputCall = calls.find((call) => {
        const arg = call[0];
        if (typeof arg !== 'string') return false;
        try {
          JSON.parse(arg);
          return true;
        } catch {
          return false;
        }
      });

      expect(outputCall).toBeDefined();
    });

    it('should throw error for non-existent input file', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('ENOENT: no such file'));

      const { prismaImport } = await import('../commands/prisma-import.js');

      await expect(prismaImport(['-i', './nonexistent.prisma', '-q'])).rejects.toThrow(
        'Failed to parse Prisma schema'
      );
    });

    it('should throw error for invalid format option', async () => {
      const { prismaImport } = await import('../commands/prisma-import.js');

      await expect(prismaImport(['-i', './schema.prisma', '-f', 'yaml', '-q'])).rejects.toThrow(
        'Invalid value'
      );
    });

    it('should exclude relations when --no-relations is specified', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(SAMPLE_PRISMA_SCHEMA);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '--no-relations', '-q']);

      const calls = mockConsoleLog.mock.calls;
      const outputCall = calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'string' && arg.includes('User:');
      });

      expect(outputCall).toBeDefined();
      const output = outputCall![0] as string;
      // Relations like posts: '[Post]' should not be present
      expect(output).not.toContain("posts: '[Post]'");
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(SIMPLE_PRISMA_SCHEMA);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { prismaImport } = await import('../commands/prisma-import.js');

      await expect(
        prismaImport(['-i', './schema.prisma', '-o', '/root/output.ts', '-q'])
      ).rejects.toThrow('Failed to write output file');
    });

    it('should show help text when --help is passed', async () => {
      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {
          throw new Error('process.exit called');
        }) as never);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await expect(prismaImport(['--help'])).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(0);
      const helpOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(helpOutput).toContain('prisma import');
      expect(helpOutput).toContain('--input');

      mockExit.mockRestore();
    });

    it('should show help text when -h is passed', async () => {
      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {
          throw new Error('process.exit called');
        }) as never);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await expect(prismaImport(['-h'])).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should work with complex Prisma schema with multiple models', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(SAMPLE_PRISMA_SCHEMA);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '-q']);

      const calls = mockConsoleLog.mock.calls;
      const outputCall = calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'string' && arg.includes('User:') && arg.includes('Post:');
      });

      expect(outputCall).toBeDefined();
    });

    it('should handle Prisma schema with enums', async () => {
      const schemaWithEnum = `
enum Role {
  USER
  ADMIN
}

model User {
  id   String @id @default(uuid())
  role Role   @default(USER)
}
`;
      vi.mocked(fsPromises.readFile).mockResolvedValue(schemaWithEnum);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '-q']);

      // Should complete without error
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle Prisma schema with DateTime fields', async () => {
      const schemaWithDateTime = `
model Event {
  id        String   @id @default(uuid())
  startTime DateTime
  endTime   DateTime?
}
`;
      vi.mocked(fsPromises.readFile).mockResolvedValue(schemaWithDateTime);
      mockConsoleLog.mockClear();

      const { prismaImport } = await import('../commands/prisma-import.js');

      await prismaImport(['-i', './schema.prisma', '-q']);

      const calls = mockConsoleLog.mock.calls;
      const outputCall = calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'string' && arg.includes('Event:');
      });

      expect(outputCall).toBeDefined();
      // DateTime should be converted to timestamp
      const output = outputCall![0] as string;
      expect(output).toContain('timestamp');
    });
  });

  // ===========================================================================
  // VALID_FORMATS constant test
  // ===========================================================================

  describe('VALID_FORMATS', () => {
    it('should include ts and json formats', async () => {
      const { _testHelpers } = await import('../commands/prisma-import.js');

      expect(_testHelpers.VALID_FORMATS).toContain('ts');
      expect(_testHelpers.VALID_FORMATS).toContain('json');
      expect(_testHelpers.VALID_FORMATS.length).toBe(2);
    });
  });
});
