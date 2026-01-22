/**
 * Init Command Tests for @icetype/cli
 *
 * Tests for the CLI init command that initializes an IceType project.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 *
 * Coverage targets:
 * - Test project initialization creates expected files
 * - Test --template flag with different templates
 * - Test initialization in existing directory
 * - Test initialization in new directory
 * - Test error handling for permission issues
 * - Test --force flag to overwrite existing files
 * - Test config file generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// =============================================================================
// Init Command Tests
// =============================================================================

describe('init command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Schema File Creation Tests
  // ===========================================================================

  describe('schema file creation', () => {
    it('should create schema.ts file in current directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(callArgs?.[0])).toContain('schema.ts');
    });

    it('should create schema.ts file in specified directory with --dir flag', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'myproject']);

      expect(fs.mkdirSync).toHaveBeenCalled();
      const mkdirArgs = vi.mocked(fs.mkdirSync).mock.calls[0];
      expect(mkdirArgs?.[0]).toBe('myproject');
    });

    it('should support -d short flag for directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['-d', 'mydir']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('mydir', { recursive: true });
    });

    it('should not overwrite existing schema.ts without --force', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });

    it('should overwrite existing schema.ts with --force flag', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init(['--force']);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should overwrite existing schema.ts with -f short flag', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init(['-f']);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Template Content Tests
  // ===========================================================================

  describe('template content', () => {
    it('should include IceType schema template content', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = callArgs?.[1];

      expect(typeof content).toBe('string');
      if (typeof content === 'string') {
        expect(content).toContain('@icetype/core');
        expect(content).toContain('parseSchema');
        expect(content).toContain('$type');
      }
    });

    it('should include field modifier documentation in template', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      // Check for field modifier documentation
      expect(content).toContain('!'); // required/unique
      expect(content).toContain('#'); // indexed
      expect(content).toContain('?'); // optional
    });

    it('should include relation operator documentation in template', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      // Check for relation operators
      expect(content).toContain('->'); // forward relation
      expect(content).toContain('<-'); // backward relation
    });

    it('should include example schemas in template', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      // Check for example schemas
      expect(content).toContain('User');
      expect(content).toContain('Post');
      expect(content).toContain('Organization');
    });

    it('should include Tag schema example', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      expect(content).toContain('Tag');
    });

    it('should include documentation link in template', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      expect(content).toContain('icetype.dev');
    });

    it('should include $partitionBy directive in example schemas', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      expect(content).toContain('$partitionBy');
    });

    it('should include $index directive in example schemas', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      expect(content).toContain('$index');
    });

    it('should include $fts full-text search directive in example schemas', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      expect(content).toContain('$fts');
    });

    it('should include fuzzy relation operator in template documentation', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      // Check for fuzzy operators
      expect(content).toContain('~>'); // fuzzy forward
    });

    it('should include uuid field type in examples', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      expect(content).toContain('uuid!');
    });

    it('should include default value examples in template', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const content = String(callArgs?.[1]);

      // Should have default value examples
      expect(content).toContain('= "');
    });
  });

  // ===========================================================================
  // Directory Creation Tests
  // ===========================================================================

  describe('directory creation', () => {
    it('should create directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'newdir']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('newdir', { recursive: true });
    });

    it('should create nested directories recursively', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'path/to/nested/project']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('path/to/nested/project', { recursive: true });
    });

    it('should not create directory when dir is current directory (.)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should print directory creation message', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'newdir']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Created directory')
      );
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should handle directory creation permission error', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const { init } = await import('../commands/init.js');

      try {
        await init(['--dir', '/root/protected']);
      } catch {
        // Expected - process.exit throws
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create directory')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle file write permission error', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const { init } = await import('../commands/init.js');

      try {
        await init([]);
      } catch {
        // Expected - process.exit throws
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write schema file')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should display helpful message for write permission errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const { init } = await import('../commands/init.js');

      try {
        await init([]);
      } catch {
        // Expected - process.exit throws
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('write permissions')
      );

      mockExit.mockRestore();
    });

    it('should handle non-Error exceptions gracefully on directory creation', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw 'string error'; // Non-Error exception
      });

      const { init } = await import('../commands/init.js');

      try {
        await init(['--dir', 'somedir']);
      } catch {
        // Expected - process.exit throws
      }

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle non-Error exceptions gracefully on file write', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw 'string error'; // Non-Error exception
      });

      const { init } = await import('../commands/init.js');

      try {
        await init([]);
      } catch {
        // Expected - process.exit throws
      }

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should include error message in console output for directory errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('EPERM: operation not permitted');
      });

      const { init } = await import('../commands/init.js');

      try {
        await init(['--dir', 'forbidden']);
      } catch {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('EPERM')
      );

      mockExit.mockRestore();
    });

    it('should include error message in console output for write errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      const { init } = await import('../commands/init.js');

      try {
        await init([]);
      } catch {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('ENOSPC')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Output Message Tests
  // ===========================================================================

  describe('output messages', () => {
    it('should print success message after creating file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Created schema file')
      );
    });

    it('should print next steps instructions', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Next steps')
      );
    });

    it('should print ice generate suggestion', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ice generate')
      );
    });

    it('should print ice validate suggestion', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ice validate')
      );
    });

    it('should suggest using --force when file exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('--force')
      );
    });

    it('should print project initialized message', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });

    it('should print documentation URL', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('icetype.dev')
      );
    });
  });

  // ===========================================================================
  // Initialization in Existing Directory Tests
  // ===========================================================================

  describe('initialization in existing directory', () => {
    it('should work when directory already exists and schema does not', async () => {
      // Directory exists check returns true, schema.ts check returns false
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true)  // Directory check
        .mockReturnValueOnce(false); // Schema file check
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'existing-dir']);

      // mkdirSync should not be called for existing directory
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should create schema.ts in existing directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      // mkdirSync should not be called when using current directory
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle existing directory with existing schema.ts correctly', async () => {
      // Both directory and schema.ts exist
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { init } = await import('../commands/init.js');

      await init([]);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });
  });

  // ===========================================================================
  // Combined Flags Tests
  // ===========================================================================

  describe('combined flags', () => {
    it('should work with both --dir and --force flags', async () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)  // Directory doesn't exist
        .mockReturnValueOnce(true);  // Schema file exists (but we're using --force)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'newproject', '--force']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('newproject', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should work with short flags -d and -f', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['-d', 'shortflags', '-f']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('shortflags', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should work with mixed long and short flags', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'mixedflags', '-f']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('mixedflags', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should work with short -d and long --force flags', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['-d', 'reversemixed', '--force']);

      expect(fs.mkdirSync).toHaveBeenCalledWith('reversemixed', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Schema File Path Tests
  // ===========================================================================

  describe('schema file path', () => {
    it('should create schema.ts at root when no directory specified', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(callArgs?.[0])).toMatch(/schema\.ts$/);
    });

    it('should create schema.ts inside specified directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const { init } = await import('../commands/init.js');

      await init(['--dir', 'myproject']);

      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writePath = String(callArgs?.[0]);
      expect(writePath).toContain('myproject');
      expect(writePath).toContain('schema.ts');
    });
  });

  // ===========================================================================
  // Default Values Tests
  // ===========================================================================

  describe('default values', () => {
    it('should use current directory as default when --dir not specified', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const { init } = await import('../commands/init.js');

      await init([]);

      // Should write to ./schema.ts not create a directory
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      const callArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(String(callArgs?.[0])).toBe('schema.ts');
    });

    it('should default --force to false', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { init } = await import('../commands/init.js');

      await init([]);

      // Without --force, should not write when file exists
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
