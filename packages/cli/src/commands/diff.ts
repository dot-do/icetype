/**
 * ice diff command
 *
 * Compares two IceType schemas and generates migration SQL.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { diffSchemas, generateMigrationPlan, type SqlDialect } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';

const SUPPORTED_DIALECTS: SqlDialect[] = ['postgres', 'clickhouse', 'duckdb'];

export async function diff(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      old: { type: 'string' },
      new: { type: 'string' },
      dialect: { type: 'string', short: 'd', default: 'postgres' },
      output: { type: 'string', short: 'o' },
    },
  });

  if (!values.old) {
    console.error('Error: --old is required');
    console.log('Usage: ice diff --old ./schema-v1.ts --new ./schema-v2.ts --dialect postgres');
    process.exit(1);
  }

  if (!values.new) {
    console.error('Error: --new is required');
    console.log('Usage: ice diff --old ./schema-v1.ts --new ./schema-v2.ts --dialect postgres');
    process.exit(1);
  }

  const dialect = values.dialect as SqlDialect;
  if (!SUPPORTED_DIALECTS.includes(dialect)) {
    console.error(`Error: Unsupported dialect '${dialect}'`);
    console.log(`Supported dialects: ${SUPPORTED_DIALECTS.join(', ')}`);
    process.exit(1);
  }

  console.log(`Comparing schemas:`);
  console.log(`  Old: ${values.old}`);
  console.log(`  New: ${values.new}`);
  console.log(`  Dialect: ${dialect}`);

  try {
    // Load old schema
    const oldResult = await loadSchemaFile(values.old);
    if (oldResult.errors.length > 0) {
      console.error('Errors loading old schema:');
      for (const error of oldResult.errors) {
        console.error(`  ${error}`);
      }
      process.exit(1);
    }

    if (oldResult.schemas.length === 0) {
      console.error('No schemas found in old schema file');
      process.exit(1);
    }

    // Load new schema
    const newResult = await loadSchemaFile(values.new);
    if (newResult.errors.length > 0) {
      console.error('Errors loading new schema:');
      for (const error of newResult.errors) {
        console.error(`  ${error}`);
      }
      process.exit(1);
    }

    if (newResult.schemas.length === 0) {
      console.error('No schemas found in new schema file');
      process.exit(1);
    }

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
  } catch (error) {
    console.error('Error comparing schemas:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
