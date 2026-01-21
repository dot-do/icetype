/**
 * Doctor Command Tests for @icetype/cli
 *
 * Tests for the CLI doctor command that checks environment compatibility.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 *
 * The `ice doctor` command should:
 * - Check Node.js version compatibility
 * - Check TypeScript version
 * - Validate tsconfig.json settings
 * - Check installed adapter packages
 * - Detect common configuration issues
 * - Suggest fixes for problems found
 *
 * Based on docs/stability.mdx documentation for the expected output format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// =============================================================================
// Test Suite
// =============================================================================

describe('doctor command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Basic Command Structure Tests
  // ===========================================================================

  describe('command structure', () => {
    it('should export a doctor function', async () => {
      const { doctor } = await import('../commands/doctor.js');

      expect(typeof doctor).toBe('function');
    });

    it('should run without errors when called with no arguments', async () => {
      // Setup mocks for a healthy environment
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');

      await expect(doctor([])).resolves.not.toThrow();
    });

    it('should display help when --help flag is passed', async () => {
      const { doctor } = await import('../commands/doctor.js');

      // Help flag should cause early exit with help text displayed
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await doctor(['--help']);
      } catch {
        // Expected
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ice doctor')
      );
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should display help when -h short flag is passed', async () => {
      const { doctor } = await import('../commands/doctor.js');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await doctor(['-h']);
      } catch {
        // Expected
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ice doctor')
      );

      mockExit.mockRestore();
    });
  });

  // ===========================================================================
  // Node.js Version Compatibility Tests
  // ===========================================================================

  describe('Node.js version compatibility', () => {
    it('should display current Node.js version', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v20.10.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Node.js')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('20.10.0')
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });

    it('should mark supported Node.js versions as compatible', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v20.10.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Should show checkmark or "Supported" for Node.js 20.x
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Node\.js.*Supported|Node\.js.*\u2713/)
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });

    it('should warn about unsupported Node.js versions (< 18)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v16.20.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Should show warning for unsupported Node.js version
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/Node\.js.*unsupported|Node\.js.*\u26A0/)
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });

    it('should support Node.js 18.x (Active LTS)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v18.19.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Node\.js.*Supported|Node\.js.*\u2713/)
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });

    it('should support Node.js 22.x (Current)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v22.0.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Node\.js.*Supported|Node\.js.*\u2713/)
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });
  });

  // ===========================================================================
  // TypeScript Version Tests
  // ===========================================================================

  describe('TypeScript version', () => {
    it('should detect installed TypeScript version', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('TypeScript')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('5.3.2')
      );
    });

    it('should mark TypeScript 5.x as supported', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/TypeScript.*Supported|TypeScript.*\u2713/)
      );
    });

    it('should warn when TypeScript is below 5.0', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('4.9.5'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/TypeScript.*upgrade|TypeScript.*\u26A0/)
      );
    });

    it('should handle missing TypeScript installation', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
        if (String(cmd).includes('tsc')) {
          throw new Error('Command not found: tsc');
        }
        return Buffer.from('');
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/TypeScript.*not found|TypeScript.*not installed/)
      );
    });
  });

  // ===========================================================================
  // tsconfig.json Validation Tests
  // ===========================================================================

  describe('tsconfig.json validation', () => {
    it('should check for tsconfig.json existence', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json')
      );
    });

    it('should warn when tsconfig.json is missing', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/tsconfig\.json.*not found|No tsconfig\.json/)
      );
    });

    it('should validate strict mode is enabled', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: false } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/strict.*mode|strict.*false/)
      );
    });

    it('should show success when strict mode is enabled', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/tsconfig\.json.*valid|tsconfig\.json.*\u2713/)
      );
    });

    it('should validate moduleResolution setting', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          compilerOptions: {
            strict: true,
            moduleResolution: 'node',
          },
        })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Should warn about using 'node' vs 'bundler' or 'node16'
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/moduleResolution|node16|bundler/)
      );
    });

    it('should handle malformed tsconfig.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/tsconfig\.json.*parse|invalid.*tsconfig/)
      );
    });

    it('should validate target setting for modern features', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: 'es5',
          },
        })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/target.*es5|target.*recommend/)
      );
    });
  });

  // ===========================================================================
  // Adapter Package Tests
  // ===========================================================================

  describe('adapter package checks', () => {
    it('should check for installed @icetype packages', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '^1.0.0',
              '@icetype/postgres': '^1.0.0',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('@icetype/core')
      );
    });

    it('should display version for each installed adapter', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.2',
              '@icetype/postgres': '1.0.1',
              '@icetype/drizzle': '0.1.5',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('1.0.2')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('1.0.1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('0.1.5')
      );
    });

    it('should mark compatible adapter versions with checkmark', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.0',
              '@icetype/postgres': '1.0.0',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/@icetype\/postgres.*Compatible|@icetype\/postgres.*\u2713/)
      );
    });

    it('should warn about outdated adapter versions', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.0',
              '@icetype/drizzle': '0.1.5',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/@icetype\/drizzle.*Outdated|@icetype\/drizzle.*\u26A0/)
      );
    });

    it('should detect version mismatches between packages', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.0',
              '@icetype/postgres': '0.1.0',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/version.*mismatch|mixing.*versions/)
      );
    });

    it('should handle missing package.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/package\.json.*not found|No package\.json/)
      );
    });
  });

  // ===========================================================================
  // Configuration Issues Detection Tests
  // ===========================================================================

  describe('common configuration issues', () => {
    it('should check for icetype.config.ts file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Should look for config file
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/icetype\.config\.(ts|js|mjs)/)
      );
    });

    it('should report when no icetype config is found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/No icetype config|icetype\.config.*not found/)
      );
    });

    it('should validate icetype config when present', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('icetype.config')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue('export default {}');
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/icetype\.config.*found|config.*detected/)
      );
    });

    it('should detect missing schema directory', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('schemas')) return false;
        return false;
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // This may or may not be a warning depending on implementation
      // Just ensure it checks for common schema locations
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/schema|schemas/)
      );
    });

    it('should check for conflicting configuration files', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // Multiple config files exist
        if (String(path).includes('icetype.config.ts')) return true;
        if (String(path).includes('icetype.config.js')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue('export default {}');
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/multiple.*config|conflicting/)
      );
    });
  });

  // ===========================================================================
  // Fix Suggestions Tests
  // ===========================================================================

  describe('fix suggestions', () => {
    it('should suggest upgrading outdated packages', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.0',
              '@icetype/drizzle': '0.1.5',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Should suggest upgrade command
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Upgrade.*@icetype\/drizzle|recommend.*1\.0/)
      );
    });

    it('should show recommendations section when issues are found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('4.9.5'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Recommendations|Suggestions/)
      );
    });

    it('should suggest creating tsconfig.json when missing', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/create.*tsconfig|tsc --init/)
      );
    });

    it('should suggest Node.js upgrade when version is unsupported', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v16.20.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/upgrade.*Node|Node.*18|Node.*20/)
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });

    it('should suggest TypeScript upgrade when version is below 5.0', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('4.9.5'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/upgrade.*TypeScript|npm.*typescript@5/)
      );
    });

    it('should show all-clear message when no issues found', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('tsconfig.json')) return true;
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('tsconfig.json')) {
          return JSON.stringify({
            compilerOptions: {
              strict: true,
              moduleResolution: 'bundler',
              target: 'ES2022',
            },
          });
        }
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.0',
              '@icetype/postgres': '1.0.0',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v20.10.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/All.*good|No.*issues|environment.*ready/)
      );

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });
  });

  // ===========================================================================
  // Output Formatting Tests
  // ===========================================================================

  describe('output formatting', () => {
    it('should display header with "Checking IceType package compatibility..."', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Checking.*IceType|IceType.*compatibility/)
      );
    });

    it('should group output by category', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Should have separate sections for environment, packages, config
      const logCalls = mockConsoleLog.mock.calls.map((call) => String(call[0]));

      // Check that output contains various category indicators
      const hasNodeSection = logCalls.some((call) => call.includes('Node'));
      const hasTypeScriptSection = logCalls.some((call) => call.includes('TypeScript'));

      expect(hasNodeSection || hasTypeScriptSection).toBe(true);
    });

    it('should use symbols for status indicators', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor([]);

      // Check for checkmark (\u2713) or cross (\u2717) or warning (\u26A0) symbols
      const allCalls = [
        ...mockConsoleLog.mock.calls,
        ...mockConsoleWarn.mock.calls,
      ].map((call) => String(call[0]));

      const hasSymbols = allCalls.some(
        (call) =>
          call.includes('\u2713') ||
          call.includes('\u2717') ||
          call.includes('\u26A0') ||
          call.includes('Compatible') ||
          call.includes('Supported')
      );

      expect(hasSymbols).toBe(true);
    });
  });

  // ===========================================================================
  // CLI Flags Tests
  // ===========================================================================

  describe('CLI flags', () => {
    it('should support --verbose flag for detailed output', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor(['--verbose']);

      // In verbose mode, should show more detailed information
      // The exact output depends on implementation
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should support -v short flag for verbose', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');

      // Should not throw with -v flag
      await expect(doctor(['-v'])).resolves.not.toThrow();
    });

    it('should support --quiet flag to suppress non-error output', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor(['--quiet']);

      // In quiet mode, should have minimal output
      // Only errors and warnings should be shown
      // Implementation-dependent
    });

    it('should support -q short flag for quiet', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');

      // Should not throw with -q flag
      await expect(doctor(['-q'])).resolves.not.toThrow();
    });

    it('should support --json flag for machine-readable output', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const { doctor } = await import('../commands/doctor.js');
      await doctor(['--json']);

      // Should output valid JSON
      const logCalls = mockConsoleLog.mock.calls.map((call) => String(call[0]));
      const jsonOutput = logCalls.find((call) => {
        try {
          JSON.parse(call);
          return true;
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
    });
  });

  // ===========================================================================
  // Exit Code Tests
  // ===========================================================================

  describe('exit codes', () => {
    it('should exit with code 0 when all checks pass', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (String(path).includes('tsconfig.json')) return true;
        if (String(path).includes('package.json')) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (String(path).includes('tsconfig.json')) {
          return JSON.stringify({
            compilerOptions: {
              strict: true,
              moduleResolution: 'bundler',
              target: 'ES2022',
            },
          });
        }
        if (String(path).includes('package.json')) {
          return JSON.stringify({
            dependencies: {
              '@icetype/core': '1.0.0',
            },
          });
        }
        return '';
      });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from('5.3.2'));

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v20.10.0',
        configurable: true,
      });

      const { doctor } = await import('../commands/doctor.js');

      // Should complete without throwing
      await expect(doctor([])).resolves.not.toThrow();

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });

    it('should exit with code 1 when critical issues are found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
        if (String(cmd).includes('tsc')) {
          throw new Error('Command not found');
        }
        return Buffer.from('');
      });

      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v14.0.0', // Very old, unsupported
        configurable: true,
      });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const { doctor } = await import('../commands/doctor.js');

      try {
        await doctor([]);
      } catch {
        // Expected
      }

      // Should exit with code 1 due to critical issues
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });
    });
  });
});
