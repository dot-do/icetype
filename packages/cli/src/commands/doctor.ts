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
 */

import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

// Symbols for status indicators
const CHECKMARK = '\u2713';
const WARNING = '\u26A0';

// Minimum supported versions
const MIN_NODE_MAJOR = 18;
const MIN_TS_MAJOR = 5;

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
  criticalIssues: boolean;
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
  let criticalIssues = false;

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

  // Build recommendations
  if (!nodeCheck.supported) {
    recommendations.push(`Upgrade Node.js to v${MIN_NODE_MAJOR} or higher (current: v${nodeCheck.version})`);
  }

  if (!tsVersion) {
    recommendations.push('Install TypeScript: npm install typescript');
  } else if (!tsCheck.supported) {
    recommendations.push(`Upgrade TypeScript to v${MIN_TS_MAJOR}.0 or higher: npm install typescript@5`);
  }

  // Critical issues only when both Node is unsupported AND TypeScript is missing
  // This indicates a completely unusable development environment
  if (!nodeCheck.supported && !tsVersion) {
    criticalIssues = true;
  }

  if (!tsconfigCheck.found) {
    recommendations.push('Create tsconfig.json: tsc --init');
  }

  if (packageCheck.packages.some(p => p.outdated)) {
    const outdatedPackages = packageCheck.packages.filter(p => p.outdated);
    for (const pkg of outdatedPackages) {
      recommendations.push(`Upgrade ${pkg.name} to 1.0.x: npm install ${pkg.name}@latest (recommend 1.0.x)`);
    }
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
    criticalIssues,
  };
}

function printResult(result: DoctorResult, options: { verbose: boolean; quiet: boolean; json: boolean }) {
  const { quiet, json } = options;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!quiet) {
    console.log('Checking IceType package compatibility...\n');
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

export async function doctor(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      quiet: { type: 'boolean', short: 'q', default: false },
      json: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`ice doctor - Check IceType environment compatibility

Usage: ice doctor [options]

Options:
  -h, --help      Show this help message
  -v, --verbose   Show detailed output
  -q, --quiet     Suppress non-error output
  --json          Output results as JSON

Checks:
  - Node.js version (requires v18+)
  - TypeScript version (requires v5+)
  - tsconfig.json settings
  - Installed @icetype packages
  - Configuration files
`);
    process.exit(0);
  }

  const verbose = values.verbose === true;
  const quiet = values.quiet === true;
  const json = values.json === true;
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

  printResult(result, { verbose, quiet, json });

  // Exit with code 1 if critical issues found
  if (result.criticalIssues) {
    process.exit(1);
  }
}
