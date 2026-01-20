import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), `icetype-e2e-${Date.now()}`);
const CLI_PATH = join(__dirname, '../../dist/cli.js');

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
});
