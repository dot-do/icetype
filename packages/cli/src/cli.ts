#!/usr/bin/env node
/**
 * IceType CLI
 *
 * Commands:
 * - ice init            Initialize an IceType project
 * - ice generate        Generate TypeScript types from schema
 * - ice validate        Validate schema syntax
 * - ice iceberg export  Export to Iceberg metadata format
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';
import { generateHelpText, hasHelpFlag, type HelpCommand } from './utils/help.js';
import { formatCliError, CliExitError } from './utils/cli-error.js';

// Adapter registry is initialized lazily when an adapter command is invoked
async function ensureAdapterRegistry(): Promise<void> {
  const { initializeAdapterRegistry } = await import('./utils/adapter-registry.js');
  initializeAdapterRegistry();
}

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
const VERSION = pkg.version;

const HELP = `
IceType CLI v${VERSION}

Usage: ice <command> [options]

Schema files can be TypeScript (.ts), JavaScript (.js, .mjs), or JSON (.json).
TypeScript files are transpiled on-the-fly - no tsx or pre-compilation required.

Commands:
  init               Initialize an IceType project
  generate           Generate TypeScript types from schema
  validate           Validate schema syntax
  doctor             Check environment compatibility
  diff               Compare schemas and generate migration SQL
  migrate            Generate and manage database migrations
  project generate   Generate OLAP schemas from projection definitions
  clickhouse export  Export to ClickHouse DDL format
  duckdb export      Export to DuckDB DDL format
  iceberg export     Export to Iceberg metadata format
  postgres export    Export to PostgreSQL DDL format
  prisma export      Export to Prisma schema format
  prisma import      Import Prisma schema and convert to IceType
  drizzle import     Import Drizzle schema and convert to IceType

Options:
  -h, --help        Show this help message
  -v, --version     Show version number

Examples:
  ice init
  ice generate --schema ./schema.ts --output ./types.ts
  ice generate --schema ./schema.ts --output ./types.ts --watch
  ice validate --schema ./schema.ts
  ice diff --old ./schema-v1.ts --new ./schema-v2.ts --dialect postgres
  ice migrate generate --schema ./schema.ts --from 1 --to 2 --dialect postgres
  ice migrate diff --old ./schema-v1.ts --new ./schema-v2.ts
  ice migrate plan --schema ./schema.ts
  ice project generate --schema ./schema.ts --output ./olap-schema.json
  ice clickhouse export --schema ./schema.ts --output ./tables.sql
  ice duckdb export --schema ./schema.ts --output ./tables.sql
  ice iceberg export --schema ./schema.ts --output ./metadata.json
  ice postgres export --schema ./schema.ts --output ./create-tables.sql
  ice prisma export --schema ./schema.ts --output ./schema.prisma
  ice prisma import --input ./schema.prisma --output ./icetype-schema.ts
  ice drizzle import --input ./drizzle-schema.ts --output ./icetype-schema.ts
`;

// Parent command help definitions
const CLICKHOUSE_HELP: HelpCommand = {
  name: 'clickhouse',
  description: 'ClickHouse schema operations',
  usage: 'ice clickhouse <subcommand> [options]',
  options: [],
  subcommands: [{ name: 'export', description: 'Export to ClickHouse DDL format' }],
  examples: [
    'ice clickhouse export --schema ./schema.ts --output ./tables.sql',
    'ice clickhouse export -s ./schema.ts --engine ReplacingMergeTree',
  ],
};

const DUCKDB_HELP: HelpCommand = {
  name: 'duckdb',
  description: 'DuckDB schema operations',
  usage: 'ice duckdb <subcommand> [options]',
  options: [],
  subcommands: [{ name: 'export', description: 'Export to DuckDB DDL format' }],
  examples: [
    'ice duckdb export --schema ./schema.ts --output ./tables.sql',
    'ice duckdb export -s ./schema.ts --schema-name analytics',
  ],
};

const ICEBERG_HELP: HelpCommand = {
  name: 'iceberg',
  description: 'Apache Iceberg schema operations',
  usage: 'ice iceberg <subcommand> [options]',
  options: [],
  subcommands: [{ name: 'export', description: 'Export to Iceberg metadata format' }],
  examples: [
    'ice iceberg export --schema ./schema.ts --output ./metadata.json',
    'ice iceberg export -s ./schema.ts --location s3://bucket/table',
  ],
};

const POSTGRES_HELP: HelpCommand = {
  name: 'postgres',
  description: 'PostgreSQL schema operations',
  usage: 'ice postgres <subcommand> [options]',
  options: [],
  subcommands: [{ name: 'export', description: 'Export to PostgreSQL DDL format' }],
  examples: [
    'ice postgres export --schema ./schema.ts --output ./create-tables.sql',
    'ice postgres export -s ./schema.ts --schemaName public',
  ],
};

const PRISMA_HELP: HelpCommand = {
  name: 'prisma',
  description: 'Prisma schema operations',
  usage: 'ice prisma <subcommand> [options]',
  options: [],
  subcommands: [
    { name: 'export', description: 'Export to Prisma schema format' },
    { name: 'import', description: 'Import Prisma schema and convert to IceType' },
  ],
  examples: [
    'ice prisma export --schema ./schema.ts --output ./schema.prisma',
    'ice prisma export -s ./schema.ts --provider mysql',
    'ice prisma import --input ./schema.prisma --output ./icetype-schema.ts',
    'ice prisma import -i ./schema.prisma -f json',
  ],
};

const DRIZZLE_HELP: HelpCommand = {
  name: 'drizzle',
  description: 'Drizzle ORM schema operations',
  usage: 'ice drizzle <subcommand> [options]',
  options: [],
  subcommands: [
    { name: 'import', description: 'Import Drizzle schema and convert to IceType' },
  ],
  examples: [
    'ice drizzle import --input ./drizzle-schema.ts --output ./icetype-schema.ts',
    'ice drizzle import -i ./schema.ts -f json',
    'ice drizzle import -i ./schema.ts --verbose',
  ],
};

const MIGRATE_HELP: HelpCommand = {
  name: 'migrate',
  description: `Generate and manage database migrations from IceType schemas.

Supported dialects: postgres, clickhouse, duckdb

Common workflow:
  1. Edit your schema.ts file
  2. Run 'ice migrate dev' to detect changes
  3. Review the generated migration
  4. Apply with --yes or manually execute the SQL`,
  usage: 'ice migrate <subcommand> [options]',
  options: [],
  subcommands: [
    { name: 'dev', description: 'Interactive development workflow - detect changes, generate & apply migrations' },
    { name: 'generate', description: 'Generate migration from schema version diff' },
    { name: 'diff', description: 'Compare two schema files and show differences' },
    { name: 'plan', description: 'Show what SQL would be generated (preview mode)' },
  ],
  examples: [
    '# Most common: develop with automatic change detection',
    'ice migrate dev --schema ./schema.ts --dialect postgres',
    '',
    '# Preview changes without applying',
    'ice migrate dev --schema ./schema.ts --dialect postgres --dry-run',
    '',
    '# Compare two schema versions',
    'ice migrate diff --old ./schema-v1.ts --new ./schema-v2.ts',
    '',
    '# Generate migration between versions',
    'ice migrate generate --schema ./schema.ts --from 1 --to 2 --dialect postgres',
    'ice migrate plan --schema ./schema.ts --dialect postgres',
  ],
};

const PROJECT_HELP: HelpCommand = {
  name: 'project',
  description: 'OLAP projection schema operations',
  usage: 'ice project <subcommand> [options]',
  options: [],
  subcommands: [
    { name: 'generate', description: 'Generate OLAP schemas from projection definitions' },
  ],
  examples: [
    'ice project generate --schema ./schema.ts --output ./olap-schema.json',
    'ice project generate -s ./schema.ts -f parquet',
    'ice project generate --schema ./schema.ts --projection OrdersFlat',
  ],
};

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(HELP);
    return 0;
  }

  if (args[0] === '-v' || args[0] === '--version') {
    console.log(VERSION);
    return 0;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'init': {
        const { init } = await import('./commands/init.js');
        await init(commandArgs);
        break;
      }

      case 'generate': {
        const { generate } = await import('./commands/generate.js');
        await generate(commandArgs);
        break;
      }

      case 'validate': {
        const { validate } = await import('./commands/validate.js');
        await validate(commandArgs);
        break;
      }

      case 'diff': {
        const { diff } = await import('./commands/diff.js');
        await diff(commandArgs);
        break;
      }

      case 'doctor': {
        const { doctor } = await import('./commands/doctor.js');
        await doctor(commandArgs);
        break;
      }

      case 'clickhouse':
        await ensureAdapterRegistry();
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(CLICKHOUSE_HELP));
        } else if (commandArgs[0] === 'export') {
          const { clickhouseExport } = await import('./commands/clickhouse.js');
          await clickhouseExport(commandArgs.slice(1));
        } else {
          throw new Error(
            `Unknown clickhouse subcommand: ${commandArgs[0]}\n` +
            'Available: ice clickhouse export'
          );
        }
        break;

      case 'duckdb':
        await ensureAdapterRegistry();
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(DUCKDB_HELP));
        } else if (commandArgs[0] === 'export') {
          const { duckdbExport } = await import('./commands/duckdb.js');
          await duckdbExport(commandArgs.slice(1));
        } else {
          throw new Error(
            `Unknown duckdb subcommand: ${commandArgs[0]}\n` +
            'Available: ice duckdb export'
          );
        }
        break;

      case 'iceberg':
        await ensureAdapterRegistry();
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(ICEBERG_HELP));
        } else if (commandArgs[0] === 'export') {
          const { icebergExport } = await import('./commands/iceberg.js');
          await icebergExport(commandArgs.slice(1));
        } else {
          throw new Error(
            `Unknown iceberg subcommand: ${commandArgs[0]}\n` +
            'Available: ice iceberg export'
          );
        }
        break;

      case 'postgres':
        await ensureAdapterRegistry();
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(POSTGRES_HELP));
        } else if (commandArgs[0] === 'export') {
          const { postgresExport } = await import('./commands/postgres.js');
          await postgresExport(commandArgs.slice(1));
        } else {
          throw new Error(
            `Unknown postgres subcommand: ${commandArgs[0]}\n` +
            'Available: ice postgres export'
          );
        }
        break;

      case 'prisma':
        await ensureAdapterRegistry();
        if (
          hasHelpFlag(commandArgs) &&
          commandArgs[0] !== 'export' &&
          commandArgs[0] !== 'import'
        ) {
          console.log(generateHelpText(PRISMA_HELP));
        } else if (commandArgs[0] === 'export') {
          const { prismaExport } = await import('./commands/prisma.js');
          await prismaExport(commandArgs.slice(1));
        } else if (commandArgs[0] === 'import') {
          const { prismaImport } = await import('./commands/prisma-import.js');
          await prismaImport(commandArgs.slice(1));
        } else {
          throw new Error(
            `Unknown prisma subcommand: ${commandArgs[0]}\n` +
            'Available: ice prisma export, ice prisma import'
          );
        }
        break;

      case 'drizzle':
        await ensureAdapterRegistry();
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'import') {
          console.log(generateHelpText(DRIZZLE_HELP));
        } else if (commandArgs[0] === 'import') {
          const { drizzleImport } = await import('./commands/drizzle-import.js');
          await drizzleImport(commandArgs.slice(1));
        } else {
          throw new Error(
            `Unknown drizzle subcommand: ${commandArgs[0]}\n` +
            'Available: ice drizzle import'
          );
        }
        break;

      case 'migrate': {
        await ensureAdapterRegistry();
        if (
          hasHelpFlag(commandArgs) &&
          commandArgs[0] !== 'dev' &&
          commandArgs[0] !== 'generate' &&
          commandArgs[0] !== 'diff' &&
          commandArgs[0] !== 'plan'
        ) {
          console.log(generateHelpText(MIGRATE_HELP));
        } else {
          const { migrate } = await import('./commands/migrate.js');
          await migrate(commandArgs);
        }
        break;
      }

      case 'project': {
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'generate') {
          console.log(generateHelpText(PROJECT_HELP));
        } else {
          const { project } = await import('./commands/project.js');
          await project(commandArgs);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        return 1;
    }
  } catch (error) {
    // Handle CliExitError specially - it has an exit code
    if (error instanceof CliExitError) {
      // CliExitError is used for non-error exits (like doctor finding issues)
      // The message has already been displayed by the command
      return error.exitCode;
    }
    // Use centralized error formatting for all other error types
    // This ensures consistent formatting across all commands
    console.error(formatCliError(error));
    return 1;
  }

  return 0;
}

// Run main and handle process exit in one place
main().then((exitCode) => {
  process.exit(exitCode);
}).catch((error) => {
  // This should never happen since main() catches all errors,
  // but just in case, handle unexpected errors
  console.error('Unexpected error:', error);
  process.exit(1);
});
