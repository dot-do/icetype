/**
 * CI Workflow Verification Tests (RED Phase)
 *
 * These tests verify that the CI/CD workflow is properly configured.
 * Part of TDD RED phase for issue icetype-1kz.4.
 *
 * Expected to FAIL until icetype-1kz.5 (GREEN phase) is implemented.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Find repository root (where .github directory lives)
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(resolve(dir, '.github'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  throw new Error('Could not find repository root');
}

const REPO_ROOT = findRepoRoot(process.cwd());
const WORKFLOWS_DIR = resolve(REPO_ROOT, '.github', 'workflows');
const TESTS_WORKFLOW = resolve(WORKFLOWS_DIR, 'tests.yml');

/**
 * Simple YAML content checker using regex patterns.
 * We avoid importing yaml package to keep test dependencies minimal.
 */
function checkWorkflowContent(content: string, pattern: RegExp): boolean {
  return pattern.test(content);
}

describe('CI Test Workflow', () => {
  describe('Workflow File Existence', () => {
    it('should have a tests.yml workflow file', () => {
      expect(
        existsSync(TESTS_WORKFLOW),
        `Expected ${TESTS_WORKFLOW} to exist. ` +
          'Create the workflow file to pass this test (GREEN phase).'
      ).toBe(true);
    });
  });

  describe('Workflow Configuration', () => {
    // These tests will be skipped if the file doesn't exist
    const workflowExists = existsSync(TESTS_WORKFLOW);

    it.skipIf(!workflowExists)('should have valid YAML with name field', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /^name:\s*Tests?/m)).toBe(true);
    });

    it.skipIf(!workflowExists)('should have a test job', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /^\s+test:/m)).toBe(true);
    });

    it.skipIf(!workflowExists)('should have a typecheck job', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /^\s+typecheck:/m)).toBe(true);
    });

    it.skipIf(!workflowExists)('should have a coverage job', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /^\s+coverage:/m)).toBe(true);
    });

    it.skipIf(!workflowExists)('should have an integration job', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /^\s+integration:/m)).toBe(true);
    });
  });

  describe('Test Matrix Requirements', () => {
    const workflowExists = existsSync(TESTS_WORKFLOW);

    it.skipIf(!workflowExists)('should test Node.js 18, 20, and 22', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      // Check for node matrix with versions 18, 20, 22
      expect(checkWorkflowContent(content, /node:\s*\[.*18.*20.*22.*\]/)).toBe(true);
    });

    it.skipIf(!workflowExists)('should test on ubuntu, macos, and windows', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      // Check for os matrix with all three platforms
      expect(checkWorkflowContent(content, /os:\s*\[.*ubuntu-latest.*\]/)).toBe(true);
      expect(checkWorkflowContent(content, /os:\s*\[.*macos-latest.*\]/)).toBe(true);
      expect(checkWorkflowContent(content, /os:\s*\[.*windows-latest.*\]/)).toBe(true);
    });
  });

  describe('Trigger Configuration', () => {
    const workflowExists = existsSync(TESTS_WORKFLOW);

    it.skipIf(!workflowExists)('should trigger on push to main', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /push:\s*\n\s+branches:.*main/)).toBe(true);
    });

    it.skipIf(!workflowExists)('should trigger on pull requests to main', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      expect(checkWorkflowContent(content, /pull_request:\s*\n\s+branches:.*main/)).toBe(true);
    });
  });

  describe('Integration Test Configuration', () => {
    const workflowExists = existsSync(TESTS_WORKFLOW);

    it.skipIf(!workflowExists)('should have timeout for integration tests', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      // Look for timeout-minutes in the integration job section
      expect(checkWorkflowContent(content, /integration:[\s\S]*?timeout-minutes:\s*\d+/)).toBe(
        true
      );
    });

    it.skipIf(!workflowExists)('should run integration tests on ubuntu (Docker required)', () => {
      const content = readFileSync(TESTS_WORKFLOW, 'utf-8');
      // Look for runs-on: ubuntu-latest in integration job
      expect(checkWorkflowContent(content, /integration:[\s\S]*?runs-on:\s*ubuntu-latest/)).toBe(
        true
      );
    });
  });
});
