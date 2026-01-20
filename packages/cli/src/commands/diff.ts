/**
 * ice diff command
 *
 * Compares two IceType schemas and generates migration SQL.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { diffSchemas, generateMigrationPlan, type SqlDialect } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import {
  requireOption,
  validateOptionValue,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

const SUPPORTED_DIALECTS: SqlDialect[] = ['postgres', 'clickhouse', 'duckdb'];

const DIFF_HELP: HelpCommand = {
  name: 'diff',
  description: 'Compare schemas and generate migration SQL',
  usage: 'ice diff --old <file> --new <file> [--dialect <dialect>] [--output <file>]',
  options: [
    { name: 'old', description: 'Path to the old/source schema file', required: true },
    { name: 'new', description: 'Path to the new/target schema file', required: true },
    { name: 'dialect', short: 'd', description: 'SQL dialect', defaultValue: 'postgres' },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
  ],
  examples: [
    'ice diff --old ./schema-v1.ts --new ./schema-v2.ts',
    'ice diff --old ./old.ts --new ./new.ts --dialect clickhouse --output ./migration.sql',
  ],
};

export async function diff(args: string[]) {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(DIFF_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      old: { type: 'string' },
      new: { type: 'string' },
      dialect: { type: 'string', short: 'd', default: 'postgres' },
      output: { type: 'string', short: 'o' },
    },
  });

  // Validate required options - throws if missing
  requireOption(
    values.old,
    'old',
    'diff',
    'ice diff --old ./schema-v1.ts --new ./schema-v2.ts --dialect postgres'
  );
  requireOption(
    values.new,
    'new',
    'diff',
    'ice diff --old ./schema-v1.ts --new ./schema-v2.ts --dialect postgres'
  );

  // Validate dialect option
  const dialect = values.dialect as string;
  validateOptionValue(dialect, 'dialect', SUPPORTED_DIALECTS);

  console.log(`Comparing schemas:`);
  console.log(`  Old: ${values.old}`);
  console.log(`  New: ${values.new}`);
  console.log(`  Dialect: ${dialect}`);

  // Load old schema - throws on errors
  const oldResult = await loadSchemaFile(values.old);
  checkSchemaLoadErrors(oldResult.errors, values.old);
  checkSchemasExist(oldResult.schemas, values.old);

  // Load new schema - throws on errors
  const newResult = await loadSchemaFile(values.new);
  checkSchemaLoadErrors(newResult.errors, values.new);
  checkSchemasExist(newResult.schemas, values.new);

  // Generate diffs and migrations for each schema
  const output: string[] = [];
  output.push(`-- IceType Migration`);
  output.push(`-- Generated from: ${values.old} -> ${values.new}`);
  output.push(`-- Dialect: ${dialect}`);
  output.push(`-- Date: ${new Date().toISOString()}`);
  output.push(``);

  let hasAnyChanges = false;

  // Match schemas by name
  for (const newSchemaInfo of newResult.schemas) {
    const newSchema = newSchemaInfo.schema;
    const oldSchemaInfo = oldResult.schemas.find((s) => s.schema.name === newSchema.name);

    if (!oldSchemaInfo) {
      output.push(`-- Schema ${newSchema.name}: NEW TABLE (not in old schema)`);
      output.push(`-- TODO: Generate CREATE TABLE statement`);
      output.push(``);
      hasAnyChanges = true;
      continue;
    }

    const schemaDiff = diffSchemas(oldSchemaInfo.schema, newSchema);

    if (!schemaDiff.hasChanges) {
      output.push(`-- Schema ${newSchema.name}: No changes`);
      output.push(``);
      continue;
    }

    hasAnyChanges = true;
    const plan = generateMigrationPlan(schemaDiff, { dialect });

    output.push(`-- ================================================`);
    output.push(`-- Schema: ${newSchema.name}`);
    output.push(`-- ================================================`);
    output.push(``);

    // Summary of changes
    if (schemaDiff.addedFields.length > 0) {
      output.push(`-- Added fields: ${schemaDiff.addedFields.map((f) => f.name).join(', ')}`);
    }
    if (schemaDiff.removedFields.length > 0) {
      output.push(`-- Removed fields: ${schemaDiff.removedFields.map((f) => f.name).join(', ')}`);
    }
    if (schemaDiff.modifiedFields.length > 0) {
      output.push(
        `-- Modified fields: ${schemaDiff.modifiedFields.map((f) => `${f.name} (${f.changes.join(', ')})`).join(', ')}`
      );
    }
    output.push(``);

    // Up migration
    output.push(`-- UP Migration`);
    if (plan.up) {
      output.push(plan.up);
    } else {
      output.push(`-- (no SQL changes)`);
    }
    output.push(``);

    // Down migration
    output.push(`-- DOWN Migration (rollback)`);
    if (plan.down) {
      output.push(plan.down);
    } else {
      output.push(`-- (no SQL changes)`);
    }
    output.push(``);
  }

  // Check for removed schemas
  for (const oldSchemaInfo of oldResult.schemas) {
    const stillExists = newResult.schemas.some((s) => s.schema.name === oldSchemaInfo.schema.name);
    if (!stillExists) {
      output.push(`-- Schema ${oldSchemaInfo.schema.name}: REMOVED (not in new schema)`);
      output.push(`-- WARNING: This schema was removed. Consider adding DROP TABLE or archiving.`);
      output.push(``);
      hasAnyChanges = true;
    }
  }

  const outputContent = output.join('\n');

  if (values.output) {
    writeFileSync(values.output, outputContent);
    console.log(`\nMigration written to: ${values.output}`);
  } else {
    console.log('\n' + outputContent);
  }

  if (!hasAnyChanges) {
    console.log('\nNo schema changes detected.');
  } else {
    console.log('\nSchema changes detected. Review the migration SQL above.');
  }
}
