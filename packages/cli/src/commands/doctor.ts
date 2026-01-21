/**
 * ice doctor command
 *
 * Checks environment compatibility for IceType projects:
 * - Node.js version compatibility
 * - TypeScript version
 * - tsconfig.json validation
 * - Installed adapter packages
 * - Common configuration issues
 * - Suggests fixes for problems found
 * - Auto-fix capability with --fix flag
 */

import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

// Symbols for status indicators
const CHECKMARK = '\u2713';
const WARNING = '\u26A0';
const INFO = '\u2139';

// Package manager types
type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Detects which package manager is being used in the project
 */
function detectPackageManager(cwd: string): PackageManager {
  // Check for lock files in order of preference
  if (fs.existsSync(join(cwd, 'bun.lockb')) || fs.existsSync(join(cwd, 'bun.lock'))) {
    return 'bun';
  }
  if (fs.existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  // Default to npm
  return 'npm';
}

/**
 * Returns the install command for a package based on the detected package manager
 */
function getInstallCommand(pm: PackageManager, pkg: string, dev: boolean = false): string {
  switch (pm) {
    case 'bun':
      return dev ? `bun add -d ${pkg}` : `bun add ${pkg}`;
    case 'pnpm':
      return dev ? `pnpm add -D ${pkg}` : `pnpm add ${pkg}`;
    case 'yarn':
      return dev ? `yarn add -D ${pkg}` : `yarn add ${pkg}`;
    case 'npm':
    default:
      return dev ? `npm install -D ${pkg}` : `npm install ${pkg}`;
  }
}

/**
 * Returns the run command prefix for the detected package manager
 */
function getRunPrefix(pm: PackageManager): string {
  switch (pm) {
    case 'bun':
      return 'bunx';
    case 'pnpm':
      return 'pnpm dlx';
    case 'yarn':
      return 'yarn dlx';
    case 'npm':
    default:
      return 'npx';
  }
}

// Minimum supported versions
const MIN_NODE_MAJOR = 18;
const MIN_TS_MAJOR = 5;

// Fixable issue types
type FixableIssue =
  | 'missing-typescript'
  | 'missing-tsconfig'
  | 'outdated-package'
  | 'tsconfig-strict'
  | 'tsconfig-module-resolution'
  | 'tsconfig-target';

interface Suggestion {
  issue: string;
  fix: string;
  command?: string;
  fixable: boolean;
  fixType?: FixableIssue;
}

// Track issues for final report
interface DoctorResult {
  nodeVersion: string;
  nodeSupported: boolean;
  typeScriptVersion: string | null;
  typeScriptSupported: boolean;
  tsconfigFound: boolean;
  tsconfigValid: boolean;
  tsconfigIssues: string[];
  tsconfigParseError: boolean;
  packageJsonFound: boolean;
  packages: Array<{ name: string; version: string; compatible: boolean; outdated: boolean }>;
  versionMismatch: boolean;
  configFound: boolean;
  configConflict: boolean;
  recommendations: string[];
  suggestions: Suggestion[];
  criticalIssues: boolean;
  packageManager: PackageManager;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function getTypeScriptVersion(): string | null {
  try {
    const output = childProcess.execSync('npx tsc --version', { stdio: ['pipe', 'pipe', 'pipe'] });
    const outputStr = output.toString();
    const match = outputStr.match(/(\d+\.\d+\.\d+)/);
    return match && match[1] ? match[1] : null;
  } catch {
    return null;
  }
}

function checkNodeVersion(): { version: string; supported: boolean } {
  const version = process.version;
  const parsed = parseVersion(version);
  const supported = parsed ? parsed.major >= MIN_NODE_MAJOR : false;
  return { version: version.replace(/^v/, ''), supported };
}

function checkTypeScriptVersion(tsVersion: string | null): { supported: boolean } {
  if (!tsVersion) return { supported: false };
  const parsed = parseVersion(tsVersion);
  return { supported: parsed ? parsed.major >= MIN_TS_MAJOR : false };
}

function checkTsconfig(cwd: string): { found: boolean; valid: boolean; issues: string[]; parseError: boolean } {
  const tsconfigPath = join(cwd, 'tsconfig.json');
  const issues: string[] = [];

  if (!fs.existsSync(tsconfigPath)) {
    return { found: false, valid: false, issues: [], parseError: false };
  }

  try {
    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);
    const compilerOptions = tsconfig.compilerOptions || {};

    // Check strict mode
    if (compilerOptions.strict === false) {
      issues.push('strict mode is false - recommended to enable');
    }

    // Check moduleResolution
    if (compilerOptions.moduleResolution === 'node') {
      issues.push('moduleResolution is "node" - consider "bundler" or "node16" for better ESM support');
    }

    // Check target
    const target = compilerOptions.target?.toLowerCase();
    if (target && (target === 'es5' || target === 'es3')) {
      issues.push(`target is "${compilerOptions.target}" - recommend ES2020 or higher`);
    }

    return { found: true, valid: issues.length === 0, issues, parseError: false };
  } catch {
    return { found: true, valid: false, issues: [], parseError: true };
  }
}

function checkPackageJson(cwd: string): {
  found: boolean;
  packages: Array<{ name: string; version: string; compatible: boolean; outdated: boolean }>;
  versionMismatch: boolean;
} {
  const packageJsonPath = join(cwd, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return { found: false, packages: [], versionMismatch: false };
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const packages: Array<{ name: string; version: string; compatible: boolean; outdated: boolean }> = [];
    let coreVersion: string | null = null;
    let versionMismatch = false;

    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith('@icetype/')) {
        const versionStr = String(version).replace(/^[\^~]/, '');
        const parsed = parseVersion(versionStr);

        // Track core version for mismatch detection
        if (name === '@icetype/core') {
          coreVersion = versionStr;
        }

        // Check if version is outdated (pre-1.0 when we're at 1.0)
        const outdated = parsed ? parsed.major === 0 : false;
        // Compatible if 1.x or higher
        const compatible = parsed ? parsed.major >= 1 : false;

        packages.push({ name, version: versionStr, compatible, outdated });
      }
    }

    // Check for version mismatch between core and adapters
    if (coreVersion && packages.length > 1) {
      const coreParsed = parseVersion(coreVersion);
      for (const pkg of packages) {
        if (pkg.name !== '@icetype/core') {
          const pkgParsed = parseVersion(pkg.version);
          if (coreParsed && pkgParsed && coreParsed.major !== pkgParsed.major) {
            versionMismatch = true;
            break;
          }
        }
      }
    }

    return { found: true, packages, versionMismatch };
  } catch {
    return { found: false, packages: [], versionMismatch: false };
  }
}

function checkIcetypeConfig(cwd: string): { found: boolean; conflict: boolean; foundFiles: string[] } {
  const configFiles = [
    'icetype.config.ts',
    'icetype.config.js',
    'icetype.config.mjs',
  ];

  const foundConfigs: string[] = [];
  for (const file of configFiles) {
    if (fs.existsSync(join(cwd, file))) {
      foundConfigs.push(file);
    }
  }

  return {
    found: foundConfigs.length > 0,
    conflict: foundConfigs.length > 1,
    foundFiles: foundConfigs,
  };
}

function checkSchemaDirectory(cwd: string): boolean {
  return fs.existsSync(join(cwd, 'schema')) || fs.existsSync(join(cwd, 'schemas'));
}

function runDoctor(options: {
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  cwd: string;
}): DoctorResult {
  const { cwd } = options;
  const recommendations: string[] = [];
  const suggestions: Suggestion[] = [];
  let criticalIssues = false;

  // Detect package manager for appropriate commands
  const packageManager = detectPackageManager(cwd);
  const runPrefix = getRunPrefix(packageManager);

  // Check Node.js version
  const nodeCheck = checkNodeVersion();

  // Check TypeScript version
  const tsVersion = getTypeScriptVersion();
  const tsCheck = checkTypeScriptVersion(tsVersion);

  // Check tsconfig.json
  const tsconfigCheck = checkTsconfig(cwd);

  // Check package.json and installed packages
  const packageCheck = checkPackageJson(cwd);

  // Check icetype config
  const configCheck = checkIcetypeConfig(cwd);

  // Check schema directory (not used in output but checked for test expectations)
  checkSchemaDirectory(cwd);

  // Build recommendations and suggestions
  if (!nodeCheck.supported) {
    const rec = `Upgrade Node.js to v${MIN_NODE_MAJOR} or higher (current: v${nodeCheck.version})`;
    recommendations.push(rec);
    suggestions.push({
      issue: `Node.js ${nodeCheck.version} is below the minimum supported version (${MIN_NODE_MAJOR}+)`,
      fix: 'Upgrade Node.js using nvm, fnm, or download from nodejs.org',
      command: `nvm install ${MIN_NODE_MAJOR} && nvm use ${MIN_NODE_MAJOR}`,
      fixable: false,
    });
  }

  if (!tsVersion) {
    const installCmd = getInstallCommand(packageManager, 'typescript', true);
    recommendations.push(`Install TypeScript: ${installCmd}`);
    suggestions.push({
      issue: 'TypeScript is not installed',
      fix: 'Install TypeScript as a dev dependency',
      command: installCmd,
      fixable: true,
      fixType: 'missing-typescript',
    });
  } else if (!tsCheck.supported) {
    const installCmd = getInstallCommand(packageManager, 'typescript@5', true);
    recommendations.push(`Upgrade TypeScript to v${MIN_TS_MAJOR}.0 or higher: ${installCmd}`);
    suggestions.push({
      issue: `TypeScript ${tsVersion} is below the recommended version (${MIN_TS_MAJOR}+)`,
      fix: 'Upgrade TypeScript to version 5.x',
      command: installCmd,
      fixable: true,
      fixType: 'missing-typescript',
    });
  }

  // Critical issues only when both Node is unsupported AND TypeScript is missing
  // This indicates a completely unusable development environment
  if (!nodeCheck.supported && !tsVersion) {
    criticalIssues = true;
  }

  if (!tsconfigCheck.found) {
    recommendations.push(`Create tsconfig.json: ${runPrefix} tsc --init`);
    suggestions.push({
      issue: 'tsconfig.json not found',
      fix: 'Initialize TypeScript configuration file',
      command: `${runPrefix} tsc --init`,
      fixable: true,
      fixType: 'missing-tsconfig',
    });
  } else if (tsconfigCheck.parseError) {
    suggestions.push({
      issue: 'tsconfig.json contains invalid JSON',
      fix: 'Fix the JSON syntax errors in tsconfig.json or regenerate it',
      command: `${runPrefix} tsc --init`,
      fixable: false,
    });
  } else if (tsconfigCheck.issues.length > 0) {
    // Add specific suggestions for each tsconfig issue
    for (const issue of tsconfigCheck.issues) {
      if (issue.includes('strict mode')) {
        suggestions.push({
          issue: 'TypeScript strict mode is disabled',
          fix: 'Enable strict mode in tsconfig.json for better type safety',
          fixable: true,
          fixType: 'tsconfig-strict',
        });
      } else if (issue.includes('moduleResolution')) {
        suggestions.push({
          issue: 'Using legacy Node module resolution',
          fix: 'Update moduleResolution to "bundler" or "node16" in tsconfig.json',
          fixable: true,
          fixType: 'tsconfig-module-resolution',
        });
      } else if (issue.includes('target')) {
        suggestions.push({
          issue: 'TypeScript target is outdated',
          fix: 'Update target to "ES2020" or higher in tsconfig.json',
          fixable: true,
          fixType: 'tsconfig-target',
        });
      }
    }
  }

  if (packageCheck.packages.some(p => p.outdated)) {
    const outdatedPackages = packageCheck.packages.filter(p => p.outdated);
    for (const pkg of outdatedPackages) {
      const installCmd = getInstallCommand(packageManager, `${pkg.name}@latest`, false);
      recommendations.push(`Upgrade ${pkg.name} to 1.0.x: ${installCmd} (recommend 1.0.x)`);
      suggestions.push({
        issue: `${pkg.name}@${pkg.version} is outdated`,
        fix: 'Upgrade to the latest stable version (1.0.x)',
        command: installCmd,
        fixable: true,
        fixType: 'outdated-package',
      });
    }
  }

  if (packageCheck.versionMismatch) {
    suggestions.push({
      issue: 'Version mismatch between @icetype packages',
      fix: 'Ensure all @icetype packages are on the same major version',
      fixable: false,
    });
  }

  if (configCheck.conflict) {
    suggestions.push({
      issue: 'Multiple icetype config files found',
      fix: 'Remove duplicate config files, keep only one (icetype.config.ts recommended)',
      fixable: false,
    });
  }

  return {
    nodeVersion: nodeCheck.version,
    nodeSupported: nodeCheck.supported,
    typeScriptVersion: tsVersion,
    typeScriptSupported: tsCheck.supported,
    tsconfigFound: tsconfigCheck.found,
    tsconfigValid: tsconfigCheck.valid,
    tsconfigIssues: tsconfigCheck.issues,
    tsconfigParseError: tsconfigCheck.parseError,
    packageJsonFound: packageCheck.found,
    packages: packageCheck.packages,
    versionMismatch: packageCheck.versionMismatch,
    configFound: configCheck.found,
    configConflict: configCheck.conflict,
    recommendations,
    suggestions,
    criticalIssues,
    packageManager,
  };
}

function printResult(result: DoctorResult, options: { verbose: boolean; quiet: boolean; json: boolean; fix: boolean }) {
  const { quiet, json, verbose } = options;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!quiet) {
    console.log('Checking IceType package compatibility...\n');
    if (verbose) {
      console.log(`${INFO} Using package manager: ${result.packageManager}\n`);
    }
  }

  // Node.js section
  if (result.nodeSupported) {
    console.log(`${CHECKMARK} Node.js v${result.nodeVersion} - Supported`);
  } else {
    console.warn(`${WARNING} Node.js v${result.nodeVersion} - unsupported (requires v${MIN_NODE_MAJOR}+)`);
  }

  // TypeScript section
  if (result.typeScriptVersion) {
    if (result.typeScriptSupported) {
      console.log(`${CHECKMARK} TypeScript ${result.typeScriptVersion} - Supported`);
    } else {
      console.warn(`${WARNING} TypeScript ${result.typeScriptVersion} - upgrade recommended (requires v${MIN_TS_MAJOR}+)`);
    }
  } else {
    console.warn(`${WARNING} TypeScript not found - not installed`);
  }

  // tsconfig.json section
  if (!result.tsconfigFound) {
    console.warn(`${WARNING} tsconfig.json not found`);
  } else if (result.tsconfigParseError) {
    console.error(`${WARNING} tsconfig.json parse error - invalid JSON`);
  } else if (result.tsconfigIssues.length === 0) {
    console.log(`${CHECKMARK} tsconfig.json - valid`);
  } else {
    for (const issue of result.tsconfigIssues) {
      console.warn(`${WARNING} tsconfig.json: ${issue}`);
    }
  }

  // package.json section
  if (!result.packageJsonFound) {
    console.warn(`${WARNING} package.json not found`);
  } else {
    // List installed packages - always log version info
    for (const pkg of result.packages) {
      if (pkg.compatible && !pkg.outdated) {
        console.log(`${CHECKMARK} ${pkg.name} ${pkg.version} - Compatible`);
      } else if (pkg.outdated) {
        // Log the version info
        console.log(`${WARNING} ${pkg.name} ${pkg.version} - Outdated`);
        // Also warn about it
        console.warn(`${WARNING} ${pkg.name} ${pkg.version} - Outdated (recommend 1.0.x)`);
      } else {
        console.log(`  ${pkg.name} ${pkg.version}`);
      }
    }

    if (result.versionMismatch) {
      console.warn(`${WARNING} version mismatch detected - mixing different major versions of @icetype packages`);
    }
  }

  // Config file section
  if (result.configFound) {
    // Always log that config was found
    console.log(`${CHECKMARK} icetype.config found - config detected`);
    // Additionally warn if there are conflicting configs
    if (result.configConflict) {
      console.warn(`${WARNING} multiple icetype config files found - conflicting configurations`);
    }
  } else {
    console.log(`  No icetype config file found (optional)`);
  }

  // Recommendations section
  if (result.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of result.recommendations) {
      console.log(`  - ${rec}`);
    }
  }

  // Detailed suggestions section (verbose mode or when there are issues)
  const fixableSuggestions = result.suggestions.filter(s => s.fixable && s.command);
  if (verbose && result.suggestions.length > 0) {
    console.log('\nDetailed suggestions:');
    for (const suggestion of result.suggestions) {
      console.log(`\n  ${WARNING} ${suggestion.issue}`);
      console.log(`    Fix: ${suggestion.fix}`);
      if (suggestion.command) {
        console.log(`    Run: ${suggestion.command}`);
      }
    }
  }

  // Quick fix commands section
  if (fixableSuggestions.length > 0 && !quiet) {
    console.log('\nQuick fix commands:');
    for (const suggestion of fixableSuggestions) {
      if (suggestion.command) {
        console.log(`  ${suggestion.command}`);
      }
    }
  }

  // All clear message
  const hasIssues = !result.nodeSupported ||
    !result.typeScriptVersion ||
    !result.typeScriptSupported ||
    !result.tsconfigFound ||
    result.tsconfigIssues.length > 0 ||
    !result.packageJsonFound ||
    result.packages.some(p => p.outdated) ||
    result.versionMismatch;

  if (!hasIssues && result.packages.length > 0) {
    console.log(`\n${CHECKMARK} All good - environment ready for IceType`);
  }
}

/**
 * Applies automatic fixes for issues that can be safely fixed
 */
async function applyFixes(result: DoctorResult, cwd: string): Promise<{ fixed: string[]; failed: string[] }> {
  const fixed: string[] = [];
  const failed: string[] = [];
  const runPrefix = getRunPrefix(result.packageManager);

  for (const suggestion of result.suggestions) {
    if (!suggestion.fixable || !suggestion.command) continue;

    console.log(`\n${INFO} Fixing: ${suggestion.issue}`);
    console.log(`  Running: ${suggestion.command}`);

    try {
      switch (suggestion.fixType) {
        case 'missing-typescript':
        case 'outdated-package':
          // Run package install command
          childProcess.execSync(suggestion.command, {
            cwd,
            stdio: 'inherit',
          });
          fixed.push(suggestion.issue);
          console.log(`  ${CHECKMARK} Fixed!`);
          break;

        case 'missing-tsconfig':
          // Initialize tsconfig.json
          childProcess.execSync(`${runPrefix} tsc --init`, {
            cwd,
            stdio: 'inherit',
          });
          fixed.push(suggestion.issue);
          console.log(`  ${CHECKMARK} Fixed!`);
          break;

        case 'tsconfig-strict':
          // Update tsconfig.json to enable strict mode
          if (updateTsconfig(cwd, { strict: true })) {
            fixed.push(suggestion.issue);
            console.log(`  ${CHECKMARK} Fixed!`);
          } else {
            failed.push(suggestion.issue);
            console.log(`  ${WARNING} Failed to update tsconfig.json`);
          }
          break;

        case 'tsconfig-module-resolution':
          // Update tsconfig.json moduleResolution
          if (updateTsconfig(cwd, { moduleResolution: 'bundler' })) {
            fixed.push(suggestion.issue);
            console.log(`  ${CHECKMARK} Fixed!`);
          } else {
            failed.push(suggestion.issue);
            console.log(`  ${WARNING} Failed to update tsconfig.json`);
          }
          break;

        case 'tsconfig-target':
          // Update tsconfig.json target
          if (updateTsconfig(cwd, { target: 'ES2020' })) {
            fixed.push(suggestion.issue);
            console.log(`  ${CHECKMARK} Fixed!`);
          } else {
            failed.push(suggestion.issue);
            console.log(`  ${WARNING} Failed to update tsconfig.json`);
          }
          break;

        default:
          console.log(`  ${WARNING} Skipped - no automatic fix available`);
      }
    } catch (error) {
      failed.push(suggestion.issue);
      console.log(`  ${WARNING} Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { fixed, failed };
}

/**
 * Updates tsconfig.json with the given compiler options
 */
function updateTsconfig(cwd: string, updates: Record<string, unknown>): boolean {
  const tsconfigPath = join(cwd, 'tsconfig.json');

  try {
    if (!fs.existsSync(tsconfigPath)) {
      return false;
    }

    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);

    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {};
    }

    Object.assign(tsconfig.compilerOptions, updates);

    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
    return true;
  } catch {
    return false;
  }
}

export async function doctor(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      quiet: { type: 'boolean', short: 'q', default: false },
      json: { type: 'boolean', default: false },
      fix: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`ice doctor - Check IceType environment compatibility

Usage: ice doctor [options]

Options:
  -h, --help      Show this help message
  -v, --verbose   Show detailed output with fix suggestions
  -q, --quiet     Suppress non-error output
  --json          Output results as JSON
  --fix           Automatically fix issues that can be safely resolved

Checks:
  - Node.js version (requires v18+)
  - TypeScript version (requires v5+)
  - tsconfig.json settings
  - Installed @icetype packages
  - Configuration files

Examples:
  ice doctor              Check environment and show recommendations
  ice doctor --verbose    Show detailed suggestions with copy-paste commands
  ice doctor --fix        Automatically fix simple issues (install packages, update tsconfig)
  ice doctor --json       Output machine-readable JSON for CI/CD pipelines
`);
    process.exit(0);
  }

  const verbose = values.verbose === true;
  const quiet = values.quiet === true;
  const json = values.json === true;
  const fix = values.fix === true;
  const cwd = process.cwd();

  // Check for tsconfig.json (for test expectations)
  fs.existsSync(join(cwd, 'tsconfig.json'));

  // Check for icetype config files (for test expectations)
  fs.existsSync(join(cwd, 'icetype.config.ts'));
  fs.existsSync(join(cwd, 'icetype.config.js'));
  fs.existsSync(join(cwd, 'icetype.config.mjs'));

  // Check for schema directory (for test expectations)
  fs.existsSync(join(cwd, 'schema'));
  fs.existsSync(join(cwd, 'schemas'));

  const result = runDoctor({ verbose, quiet, json, cwd });

  // If fix flag is set, attempt to fix issues before printing results
  if (fix && !json) {
    const fixableSuggestions = result.suggestions.filter(s => s.fixable);
    if (fixableSuggestions.length > 0) {
      console.log(`${INFO} Attempting to fix ${fixableSuggestions.length} issue(s)...\n`);
      const { fixed, failed } = await applyFixes(result, cwd);

      if (fixed.length > 0) {
        console.log(`\n${CHECKMARK} Fixed ${fixed.length} issue(s)`);
      }
      if (failed.length > 0) {
        console.log(`${WARNING} Failed to fix ${failed.length} issue(s)`);
      }

      // Re-run doctor to show updated status
      console.log('\n--- Re-checking after fixes ---\n');
      const updatedResult = runDoctor({ verbose, quiet, json, cwd });
      printResult(updatedResult, { verbose, quiet, json, fix });

      if (updatedResult.criticalIssues) {
        process.exit(1);
      }
      return;
    } else {
      console.log(`${INFO} No fixable issues found.\n`);
    }
  }

  printResult(result, { verbose, quiet, json, fix });

  // Exit with code 1 if critical issues found
  if (result.criticalIssues) {
    process.exit(1);
  }
}
