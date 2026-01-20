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
import { isIceTypeError, getErrorMessage } from '@icetype/core';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';
import { validate } from './commands/validate.js';
import { clickhouseExport } from './commands/clickhouse.js';
import { duckdbExport } from './commands/duckdb.js';
import { icebergExport } from './commands/iceberg.js';
import { postgresExport } from './commands/postgres.js';
import { diff } from './commands/diff.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
const VERSION = pkg.version;

const HELP = `
IceType CLI v${VERSION}

Usage: ice <command> [options]

Commands:
  init               Initialize an IceType project
  generate           Generate TypeScript types from schema
  validate           Validate schema syntax
  diff               Compare schemas and generate migration SQL
  clickhouse export  Export to ClickHouse DDL format
  duckdb export      Export to DuckDB DDL format
  iceberg export     Export to Iceberg metadata format
  postgres export    Export to PostgreSQL DDL format

Options:
  -h, --help        Show this help message
  -v, --version     Show version number

Examples:
  ice init
  ice generate --schema ./schema.ts --output ./types.ts
  ice generate --schema ./schema.ts --output ./types.ts --watch
  ice validate --schema ./schema.ts
  ice diff --old ./schema-v1.ts --new ./schema-v2.ts --dialect postgres
  ice clickhouse export --schema ./schema.ts --output ./tables.sql
  ice duckdb export --schema ./schema.ts --output ./tables.sql
  ice iceberg export --schema ./schema.ts --output ./metadata.json
  ice postgres export --schema ./schema.ts --output ./create-tables.sql
`;

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
        if (commandArgs[0] === 'export') {
          await clickhouseExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown clickhouse subcommand: ${commandArgs[0]}`);
          console.log('Available: ice clickhouse export');
          process.exit(1);
        }
        break;

      case 'duckdb':
        if (commandArgs[0] === 'export') {
          await duckdbExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown duckdb subcommand: ${commandArgs[0]}`);
          console.log('Available: ice duckdb export');
          process.exit(1);
        }
        break;

      case 'iceberg':
        if (commandArgs[0] === 'export') {
          await icebergExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown iceberg subcommand: ${commandArgs[0]}`);
          console.log('Available: ice iceberg export');
          process.exit(1);
        }
        break;

      case 'postgres':
        if (commandArgs[0] === 'export') {
          await postgresExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown postgres subcommand: ${commandArgs[0]}`);
          console.log('Available: ice postgres export');
          process.exit(1);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    // Use IceType's standardized error formatting
    if (isIceTypeError(error)) {
      console.error(getErrorMessage(error));
    } else {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

main();
