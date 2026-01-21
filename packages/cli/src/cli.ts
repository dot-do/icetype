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
import { initializeAdapterRegistry } from './utils/adapter-registry.js';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';
import { validate } from './commands/validate.js';
import { clickhouseExport } from './commands/clickhouse.js';
import { duckdbExport } from './commands/duckdb.js';
import { icebergExport } from './commands/iceberg.js';
import { postgresExport } from './commands/postgres.js';
import { prismaExport } from './commands/prisma.js';
import { prismaImport } from './commands/prisma-import.js';
import { drizzleImport } from './commands/drizzle-import.js';
import { diff } from './commands/diff.js';
import { migrate } from './commands/migrate.js';
import { project } from './commands/project.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from './utils/help.js';
import { formatCliError } from './utils/cli-error.js';

// Initialize the global adapter registry at CLI startup
// This registers all supported adapters (postgres, duckdb, clickhouse, iceberg)
initializeAdapterRegistry();

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
  description: 'Generate and manage database migrations',
  usage: 'ice migrate <subcommand> [options]',
  options: [],
  subcommands: [
    { name: 'generate', description: 'Generate migration from schema diff' },
    { name: 'diff', description: 'Show diff between two schemas' },
    { name: 'plan', description: 'Show migration plan without executing' },
  ],
  examples: [
    'ice migrate generate --schema ./schema.ts --from 1 --to 2 --dialect postgres',
    'ice migrate diff --old ./schema-v1.ts --new ./schema-v2.ts',
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

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(HELP);
    process.exit(0);
  }

  if (args[0] === '-v' || args[0] === '--version') {
    console.log(VERSION);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'init':
        await init(commandArgs);
        break;

      case 'generate':
        await generate(commandArgs);
        break;

      case 'validate':
        await validate(commandArgs);
        break;

      case 'diff':
        await diff(commandArgs);
        break;

      case 'clickhouse':
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(CLICKHOUSE_HELP));
          process.exit(0);
        } else if (commandArgs[0] === 'export') {
          await clickhouseExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown clickhouse subcommand: ${commandArgs[0]}`);
          console.log('Available: ice clickhouse export');
          process.exit(1);
        }
        break;

      case 'duckdb':
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(DUCKDB_HELP));
          process.exit(0);
        } else if (commandArgs[0] === 'export') {
          await duckdbExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown duckdb subcommand: ${commandArgs[0]}`);
          console.log('Available: ice duckdb export');
          process.exit(1);
        }
        break;

      case 'iceberg':
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(ICEBERG_HELP));
          process.exit(0);
        } else if (commandArgs[0] === 'export') {
          await icebergExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown iceberg subcommand: ${commandArgs[0]}`);
          console.log('Available: ice iceberg export');
          process.exit(1);
        }
        break;

      case 'postgres':
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'export') {
          console.log(generateHelpText(POSTGRES_HELP));
          process.exit(0);
        } else if (commandArgs[0] === 'export') {
          await postgresExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown postgres subcommand: ${commandArgs[0]}`);
          console.log('Available: ice postgres export');
          process.exit(1);
        }
        break;

      case 'prisma':
        if (
          hasHelpFlag(commandArgs) &&
          commandArgs[0] !== 'export' &&
          commandArgs[0] !== 'import'
        ) {
          console.log(generateHelpText(PRISMA_HELP));
          process.exit(0);
        } else if (commandArgs[0] === 'export') {
          await prismaExport(commandArgs.slice(1));
        } else if (commandArgs[0] === 'import') {
          await prismaImport(commandArgs.slice(1));
        } else {
          console.error(`Unknown prisma subcommand: ${commandArgs[0]}`);
          console.log('Available: ice prisma export, ice prisma import');
          process.exit(1);
        }
        break;

      case 'drizzle':
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'import') {
          console.log(generateHelpText(DRIZZLE_HELP));
          process.exit(0);
        } else if (commandArgs[0] === 'import') {
          await drizzleImport(commandArgs.slice(1));
        } else {
          console.error(`Unknown drizzle subcommand: ${commandArgs[0]}`);
          console.log('Available: ice drizzle import');
          process.exit(1);
        }
        break;

      case 'migrate':
        if (
          hasHelpFlag(commandArgs) &&
          commandArgs[0] !== 'generate' &&
          commandArgs[0] !== 'diff' &&
          commandArgs[0] !== 'plan'
        ) {
          console.log(generateHelpText(MIGRATE_HELP));
          process.exit(0);
        } else {
          await migrate(commandArgs);
        }
        break;

      case 'project':
        if (hasHelpFlag(commandArgs) && commandArgs[0] !== 'generate') {
          console.log(generateHelpText(PROJECT_HELP));
          process.exit(0);
        } else {
          await project(commandArgs);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    // Use centralized error formatting for all error types
    // This ensures consistent formatting across all commands
    console.error(formatCliError(error));
    process.exit(1);
  }
}

main();
