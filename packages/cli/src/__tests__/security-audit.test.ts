/**
 * Security Audit Tests for @icetype/cli
 *
 * RED Phase TDD - These tests document known security vulnerabilities
 * and will fail until dependencies are updated.
 *
 * Current vulnerability status (as of 2025-01-21):
 * - 1 critical: Next.js RCE in React flight protocol (CVE-2025-55182)
 * - 1 high: Next.js DoS with Server Components (GHSA-mwv6-3258-q52c)
 * - 2 moderate: esbuild CORS issue, Next.js source code exposure
 * - 1 low: undici decompression chain issue
 *
 * Affected packages:
 * - next@16.0.0 in apps/docs (via fumadocs) - needs >=16.0.9
 * - esbuild@0.21.5 via vite (dev dependency) - needs >=0.25.0
 * - undici@5.29.0 via testcontainers - needs >=6.23.0
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Get the monorepo root by finding the root package.json
function findMonorepoRoot(): string {
  // Start from current file's directory
  const fileUrl = new URL(import.meta.url);
  let currentDir = path.dirname(fileUrl.pathname);

  // Walk up until we find a pnpm-workspace.yaml or hit the filesystem root
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback: try common relative path from test file
  const fileDir = path.dirname(fileUrl.pathname);
  return path.resolve(fileDir, '../../../../..');
}

const MONOREPO_ROOT = findMonorepoRoot();

interface AuditAdvisory {
  id: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  module_name: string;
  vulnerable_versions: string;
  patched_versions: string;
  title: string;
  findings: Array<{
    version: string;
    paths: string[];
  }>;
}

interface AuditResult {
  advisories: Record<string, AuditAdvisory>;
  metadata?: {
    vulnerabilities: {
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
  };
}

/**
 * Runs pnpm audit and returns parsed JSON result
 */
function runAudit(): AuditResult {
  try {
    const result = execSync('pnpm audit --json', {
      cwd: MONOREPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result);
  } catch (error: unknown) {
    // pnpm audit exits with non-zero when vulnerabilities exist
    // We need to parse stdout from the error
    const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number };
    const stdout = execError.stdout?.toString() || '';
    if (stdout) {
      try {
        return JSON.parse(stdout);
      } catch {
        // If stdout isn't valid JSON, rethrow
        throw new Error(`Failed to parse audit output: ${stdout.slice(0, 200)}`);
      }
    }
    throw new Error(`pnpm audit failed with no output. Status: ${execError.status}`);
  }
}

/**
 * Check if a path indicates a production dependency
 * Production deps are in "dependencies", dev deps are in "devDependencies"
 */
function isProductionDependency(depPath: string): boolean {
  // Dev-only packages/paths
  const devOnlyPatterns = [
    /^vitest/,
    /^@vitest/,
    /^@types\//,
    /> vitest@/,
    /> vite@/,
    /> @vitest\//,
    /> vite-node@/,
    /> @vitejs\//,
    /^\..*> @vitest/,
    /^\..*> vitest/,
    /testcontainers/,
  ];

  return !devOnlyPatterns.some((pattern) => pattern.test(depPath));
}

/**
 * Filter advisories to only production dependencies
 */
function getProductionVulnerabilities(audit: AuditResult): AuditAdvisory[] {
  const prodVulns: AuditAdvisory[] = [];

  // Handle case where no advisories exist
  if (!audit.advisories) {
    return prodVulns;
  }

  for (const advisory of Object.values(audit.advisories)) {
    const prodPaths = advisory.findings.flatMap((f) => f.paths.filter(isProductionDependency));

    if (prodPaths.length > 0) {
      prodVulns.push({
        ...advisory,
        findings: advisory.findings.map((f) => ({
          ...f,
          paths: f.paths.filter(isProductionDependency),
        })),
      });
    }
  }

  return prodVulns;
}

describe('Security Audit', () => {
  describe('No high/critical vulnerabilities in production dependencies', () => {
    it('should have no CRITICAL vulnerabilities in production dependencies', () => {
      const audit = runAudit();
      const prodVulns = getProductionVulnerabilities(audit);
      const criticalVulns = prodVulns.filter((a) => a.severity === 'critical');

      // Document current state
      if (criticalVulns.length > 0) {
        console.log('\n=== CRITICAL VULNERABILITIES IN PRODUCTION DEPS ===');
        criticalVulns.forEach((v) => {
          console.log(`  - ${v.module_name}: ${v.title}`);
          console.log(`    Vulnerable: ${v.vulnerable_versions}`);
          console.log(`    Patched: ${v.patched_versions}`);
          v.findings.forEach((f) => {
            f.paths.forEach((p) => console.log(`    Path: ${p}`));
          });
        });
      }

      // This test will FAIL until next.js is updated in apps/docs
      // Current status: next@16.0.0 needs >=16.0.7 (RCE vulnerability)
      expect(criticalVulns).toHaveLength(0);
    });

    it('should have no HIGH vulnerabilities in production dependencies', () => {
      const audit = runAudit();
      const prodVulns = getProductionVulnerabilities(audit);
      const highVulns = prodVulns.filter((a) => a.severity === 'high');

      // Document current state
      if (highVulns.length > 0) {
        console.log('\n=== HIGH VULNERABILITIES IN PRODUCTION DEPS ===');
        highVulns.forEach((v) => {
          console.log(`  - ${v.module_name}: ${v.title}`);
          console.log(`    Vulnerable: ${v.vulnerable_versions}`);
          console.log(`    Patched: ${v.patched_versions}`);
          v.findings.forEach((f) => {
            f.paths.forEach((p) => console.log(`    Path: ${p}`));
          });
        });
      }

      // This test will FAIL until next.js is updated in apps/docs
      // Current status: next@16.0.0 needs >=16.0.9 (DoS vulnerability)
      expect(highVulns).toHaveLength(0);
    });
  });

  describe('Documentation site dependencies', () => {
    it('should have next.js version >= 16.0.9 (patched for all known vulns)', () => {
      const docsPackageJson = path.join(MONOREPO_ROOT, 'apps/docs/package.json');

      if (!fs.existsSync(docsPackageJson)) {
        // Skip if docs package doesn't exist
        return;
      }

      const pkg = JSON.parse(fs.readFileSync(docsPackageJson, 'utf-8'));
      const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next;

      expect(nextVersion).toBeDefined();

      // Parse version (handle ranges like ^16.0.0)
      const versionMatch = nextVersion.match(/\d+\.\d+\.\d+/);
      expect(versionMatch).not.toBeNull();

      const [major, minor, patch] = versionMatch![0].split('.').map(Number);

      // Need at least 16.0.9 to fix all vulnerabilities
      // - 16.0.7: RCE fix (GHSA-9qr9-h5gf-34mp)
      // - 16.0.9: DoS + source exposure fix (GHSA-mwv6-3258-q52c, GHSA-w37m-7fhw-fmv9)
      const isPatched = major > 16 || (major === 16 && (minor > 0 || patch >= 9));

      // This test will FAIL until next.js is updated
      // Current: 16.0.0, Required: >=16.0.9
      expect(isPatched).toBe(true);
    });

    it('should have fumadocs-core version compatible with patched next.js', () => {
      const docsPackageJson = path.join(MONOREPO_ROOT, 'apps/docs/package.json');

      if (!fs.existsSync(docsPackageJson)) {
        return;
      }

      const pkg = JSON.parse(fs.readFileSync(docsPackageJson, 'utf-8'));
      const fumadocsVersion = pkg.dependencies?.['fumadocs-core'];

      expect(fumadocsVersion).toBeDefined();

      // Parse version
      const versionMatch = fumadocsVersion.match(/\d+\.\d+\.\d+/);
      expect(versionMatch).not.toBeNull();

      const [major, minor] = versionMatch![0].split('.').map(Number);

      // fumadocs-core 16.0.3 pins next@16.0.0 which is vulnerable
      // Need a newer version that supports next@>=16.0.9
      // This test documents that fumadocs needs updating
      const needsUpdate = major === 16 && minor === 0;

      // This test will FAIL until fumadocs is updated to support patched next.js
      // Current: 16.0.3 (pins vulnerable next@16.0.0)
      expect(needsUpdate).toBe(false);
    });
  });

  describe('Dev dependencies should not leak to production', () => {
    it('should have vitest only in devDependencies', () => {
      const packagesToCheck = [
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/adapters/package.json',
        'packages/icetype/package.json',
      ];

      for (const pkgPath of packagesToCheck) {
        const fullPath = path.join(MONOREPO_ROOT, pkgPath);
        if (!fs.existsSync(fullPath)) continue;

        const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

        // vitest should NOT be in production dependencies
        expect(pkg.dependencies?.vitest).toBeUndefined();
        expect(pkg.dependencies?.['@vitest/coverage-v8']).toBeUndefined();

        // It's OK for vitest to be in devDependencies
        // (just documenting the expected state)
      }
    });

    it('should have vite-related packages only in devDependencies', () => {
      const packagesToCheck = [
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/adapters/package.json',
        'packages/icetype/package.json',
      ];

      for (const pkgPath of packagesToCheck) {
        const fullPath = path.join(MONOREPO_ROOT, pkgPath);
        if (!fs.existsSync(fullPath)) continue;

        const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

        // vite-related packages should NOT be in production dependencies
        expect(pkg.dependencies?.vite).toBeUndefined();
        expect(pkg.dependencies?.['vite-node']).toBeUndefined();
        expect(pkg.dependencies?.['@vitejs/plugin-react']).toBeUndefined();
      }
    });

    it('should not have esbuild as a direct production dependency', () => {
      const packagesToCheck = [
        'packages/cli/package.json',
        'packages/core/package.json',
        'packages/adapters/package.json',
        'packages/icetype/package.json',
      ];

      for (const pkgPath of packagesToCheck) {
        const fullPath = path.join(MONOREPO_ROOT, pkgPath);
        if (!fs.existsSync(fullPath)) continue;

        const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

        // esbuild should NOT be a direct production dependency
        // (it's OK as a transitive dev dependency via vite/vitest)
        expect(pkg.dependencies?.esbuild).toBeUndefined();
      }
    });
  });

  describe('Vulnerability documentation', () => {
    it('should document current vulnerability count', () => {
      const audit = runAudit();

      // Count vulnerabilities by severity
      const counts = { low: 0, moderate: 0, high: 0, critical: 0 };
      if (audit.advisories) {
        for (const advisory of Object.values(audit.advisories)) {
          counts[advisory.severity]++;
        }
      }

      console.log('\n=== CURRENT VULNERABILITY STATUS ===');
      console.log(`  Critical: ${counts.critical}`);
      console.log(`  High: ${counts.high}`);
      console.log(`  Moderate: ${counts.moderate}`);
      console.log(`  Low: ${counts.low}`);
      console.log(`  Total: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);

      // Document affected packages
      console.log('\n=== AFFECTED PACKAGES ===');
      if (audit.advisories) {
        for (const advisory of Object.values(audit.advisories)) {
          console.log(`\n  [${advisory.severity.toUpperCase()}] ${advisory.module_name}`);
          console.log(`    Title: ${advisory.title}`);
          console.log(`    Vulnerable: ${advisory.vulnerable_versions}`);
          console.log(`    Fix: ${advisory.patched_versions}`);
        }
      } else {
        console.log('  No advisories found (audit.advisories is null/undefined)');
      }

      // This test always passes - it's just for documentation
      // When vulnerabilities are fixed, the output will show the improvement
      expect(true).toBe(true);
    });
  });
});

describe('Security Audit - Summary', () => {
  /**
   * This test provides a summary of what needs to be fixed.
   * It will FAIL until all issues are resolved.
   */
  it('should pass security audit with no high/critical vulnerabilities', () => {
    const audit = runAudit();

    // Count high and critical vulnerabilities
    let highCriticalCount = 0;
    const issues: string[] = [];

    if (audit.advisories) {
      for (const advisory of Object.values(audit.advisories)) {
        if (advisory.severity === 'high' || advisory.severity === 'critical') {
          highCriticalCount++;
          issues.push(`[${advisory.severity.toUpperCase()}] ${advisory.module_name}: ${advisory.title}`);
        }
      }
    }

    if (issues.length > 0) {
      console.log('\n=== SECURITY ISSUES TO FIX ===');
      issues.forEach((issue) => console.log(`  - ${issue}`));
      console.log('\n=== REMEDIATION ===');
      console.log('  1. Update apps/docs/package.json:');
      console.log('     - next: "16.0.0" -> "^16.0.9"');
      console.log('     - Update fumadocs-* packages to versions supporting next@16.0.9');
      console.log('  2. Run: pnpm install');
      console.log('  3. Re-run this test to verify fixes');
    }

    // This test will FAIL until next.js vulnerabilities are fixed
    // Current status:
    // - 1 critical (next.js RCE)
    // - 1 high (next.js DoS)
    expect(highCriticalCount).toBe(0);
  });
});
