/**
 * README Requirements Tests for IceType Packages
 *
 * This test file validates that all packages have proper README files
 * with required sections. This is a RED phase TDD test - the requirements
 * are defined here, and implementations will follow.
 *
 * =============================================================================
 * PACKAGES REQUIRING README FILES
 * =============================================================================
 *
 * The following packages need README.md files created:
 *
 * PUBLIC PACKAGES (require full README with all sections):
 * - cli           (@icetype/cli)         - CLI tools
 * - clickhouse    (@icetype/clickhouse)  - ClickHouse adapter
 * - core          (@icetype/core)        - Parser, types, validation
 * - create-icetype (create-icetype)      - Project scaffolding
 * - drizzle       (@icetype/drizzle)     - Drizzle ORM adapter
 * - duckdb        (@icetype/duckdb)      - DuckDB adapter
 * - iceberg       (@icetype/iceberg)     - Iceberg metadata generation
 * - icetype       (icetype)              - Main entry point
 * - migrations    (@icetype/migrations)  - Migration generation/running
 * - mysql         (@icetype/mysql)       - MySQL adapter
 * - postgres      (@icetype/postgres)    - PostgreSQL adapter
 * - prisma        (@icetype/prisma)      - Prisma adapter
 * - sql-common    (@icetype/sql-common)  - Shared SQL utilities
 * - sqlite        (@icetype/sqlite)      - SQLite adapter
 *
 * EXISTING README NEEDS UPDATES:
 * - adapters      (@icetype/adapters)    - Missing: ## Usage, ## Examples
 *
 * INTERNAL PACKAGES (minimal README acceptable):
 * - benchmarks       - Performance benchmarks (has README)
 * - integration-tests - Integration test suite
 * - playground       - Development playground
 * - test-utils       - Testing utilities
 *
 * =============================================================================
 * REQUIRED SECTIONS FOR EACH README
 * =============================================================================
 *
 * 1. ## Installation - How to install the package
 * 2. ## Usage - Basic usage examples
 * 3. ## API - API reference documentation
 * 4. ## Examples - Code examples
 * 5. Documentation link - Link to icetype.dev or related packages
 *
 * See packages/README.template.md for the standard template.
 *
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to packages directory (from packages/core/src/__tests__ -> packages/)
const packagesDir = join(__dirname, '..', '..', '..');

// Required sections that must be present in each README
const REQUIRED_SECTIONS = [
  { name: 'Installation', pattern: /^##\s+Installation/im },
  { name: 'Usage', pattern: /^##\s+Usage/im },
  { name: 'API', pattern: /^##\s+API/im },
  { name: 'Examples', pattern: /^##\s+Examples?/im },
];

// Required link to main documentation
const DOCS_LINK_PATTERN = /https?:\/\/icetype\.dev|\.\.\/|@icetype\//i;

// Internal packages that don't need full READMEs (test utilities, internal tools)
const INTERNAL_PACKAGES = [
  'benchmarks',
  'integration-tests',
  'playground',
  'test-utils',
];

// Get all package directories
function getPackageDirectories(): string[] {
  const entries = readdirSync(packagesDir);
  return entries.filter((entry) => {
    const fullPath = join(packagesDir, entry);
    return (
      statSync(fullPath).isDirectory() &&
      existsSync(join(fullPath, 'package.json')) &&
      !entry.startsWith('.') &&
      entry !== 'node_modules'
    );
  });
}

// Check if a package is internal/test-only
function isInternalPackage(packageName: string): boolean {
  return INTERNAL_PACKAGES.includes(packageName);
}

// Read and validate a README file
function validateReadme(packageDir: string): {
  exists: boolean;
  sections: { name: string; found: boolean }[];
  hasDocsLink: boolean;
  content: string | null;
} {
  const readmePath = join(packagesDir, packageDir, 'README.md');

  if (!existsSync(readmePath)) {
    return {
      exists: false,
      sections: REQUIRED_SECTIONS.map((s) => ({ name: s.name, found: false })),
      hasDocsLink: false,
      content: null,
    };
  }

  const content = readFileSync(readmePath, 'utf-8');

  const sections = REQUIRED_SECTIONS.map((section) => ({
    name: section.name,
    found: section.pattern.test(content),
  }));

  const hasDocsLink = DOCS_LINK_PATTERN.test(content);

  return {
    exists: true,
    sections,
    hasDocsLink,
    content,
  };
}

describe('Package README Requirements', () => {
  const packages = getPackageDirectories();

  describe('README existence', () => {
    it('should find packages directory', () => {
      expect(existsSync(packagesDir)).toBe(true);
    });

    it('should have packages to validate', () => {
      expect(packages.length).toBeGreaterThan(0);
    });

    // Test each non-internal package has a README
    packages
      .filter((pkg) => !isInternalPackage(pkg))
      .forEach((packageName) => {
        it(`package "${packageName}" should have README.md`, () => {
          const readmePath = join(packagesDir, packageName, 'README.md');
          expect(
            existsSync(readmePath),
            `Missing README.md in packages/${packageName}/`
          ).toBe(true);
        });
      });
  });

  describe('README required sections', () => {
    packages
      .filter((pkg) => !isInternalPackage(pkg))
      .forEach((packageName) => {
        describe(`package "${packageName}"`, () => {
          const validation = validateReadme(packageName);

          if (!validation.exists) {
            it.skip('README.md does not exist - skipping section checks', () => {
              // Skip if no README
            });
            return;
          }

          REQUIRED_SECTIONS.forEach((section) => {
            it(`should have "${section.name}" section`, () => {
              const sectionResult = validation.sections.find(
                (s) => s.name === section.name
              );
              expect(
                sectionResult?.found,
                `Missing "## ${section.name}" section in packages/${packageName}/README.md`
              ).toBe(true);
            });
          });

          it('should link to main documentation', () => {
            expect(
              validation.hasDocsLink,
              `Missing link to main docs (icetype.dev or relative package links) in packages/${packageName}/README.md`
            ).toBe(true);
          });
        });
      });
  });

  describe('README content quality', () => {
    packages
      .filter((pkg) => !isInternalPackage(pkg))
      .forEach((packageName) => {
        const validation = validateReadme(packageName);

        if (!validation.exists || !validation.content) {
          return;
        }

        it(`package "${packageName}" README should have code examples`, () => {
          const hasCodeBlock = /```(?:typescript|ts|javascript|js|bash)?\n[\s\S]*?```/m.test(
            validation.content!
          );
          expect(
            hasCodeBlock,
            `Missing code examples in packages/${packageName}/README.md`
          ).toBe(true);
        });

        it(`package "${packageName}" README should have package title`, () => {
          const hasTitle = /^#\s+.+/m.test(validation.content!);
          expect(
            hasTitle,
            `Missing title (# PackageName) in packages/${packageName}/README.md`
          ).toBe(true);
        });

        it(`package "${packageName}" README should be at least 500 characters`, () => {
          expect(
            validation.content!.length,
            `README in packages/${packageName}/ is too short (${validation.content!.length} chars)`
          ).toBeGreaterThanOrEqual(500);
        });
      });
  });
});

// Export for programmatic use
export {
  REQUIRED_SECTIONS,
  INTERNAL_PACKAGES,
  getPackageDirectories,
  validateReadme,
  isInternalPackage,
};
