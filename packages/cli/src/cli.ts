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

import { parseArgs } from 'node:util';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';
import { validate } from './commands/validate.js';
import { icebergExport } from './commands/iceberg.js';

const VERSION = '0.1.0';

const HELP = `
IceType CLI v${VERSION}

Usage: ice <command> [options]

Commands:
  init              Initialize an IceType project
  generate          Generate TypeScript types from schema
  validate          Validate schema syntax
  iceberg export    Export to Iceberg metadata format

Options:
  -h, --help        Show this help message
  -v, --version     Show version number

Examples:
  ice init
  ice generate --schema ./schema.ts --output ./types.ts
  ice validate --schema ./schema.ts
  ice iceberg export --schema ./schema.ts --output ./metadata.json
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

      case 'iceberg':
        if (commandArgs[0] === 'export') {
          await icebergExport(commandArgs.slice(1));
        } else {
          console.error(`Unknown iceberg subcommand: ${commandArgs[0]}`);
          console.log('Available: ice iceberg export');
          process.exit(1);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
