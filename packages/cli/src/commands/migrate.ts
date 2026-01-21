/**
 * ice migrate command group
 *
 * Commands for generating and managing database migrations:
 * - ice migrate generate --schema <path> --from <version> --to <version>
 * - ice migrate diff --old <path> --new <path>
 * - ice migrate plan --schema <path>
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  diffSchemasLegacy as diffSchemas,
  generateMigrationPlan,
  type SqlDialect,
} from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';
import { generateHelpText, hasHelpFlag, type HelpCommand } from '../utils/help.js';
import { createLogger, LogLevel } from '../utils/logger.js';
import {
  requireOption,
  validateOptionValue,
  checkSchemaLoadErrors,
  checkSchemasExist,
} from '../utils/cli-error.js';

// =============================================================================
// Types and Constants
// =============================================================================

const SUPPORTED_DIALECTS = ['postgres', 'clickhouse', 'duckdb'] as const;

const SUPPORTED_FORMATS = ['sql', 'json'] as const;

// =============================================================================
// Help Definitions
// =============================================================================

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

const MIGRATE_GENERATE_HELP: HelpCommand = {
  name: 'migrate generate',
  description: 'Generate migration SQL from schema changes',
  usage: 'ice migrate generate --schema <file> --from <version> --to <version> [--dialect <dialect>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'from', description: 'Source schema version', required: true },
    { name: 'to', description: 'Target schema version', required: true },
    { name: 'dialect', short: 'd', description: 'SQL dialect', defaultValue: 'postgres' },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'format', short: 'f', description: 'Output format (sql, json)', defaultValue: 'sql' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice migrate generate --schema ./schema.ts --from 1 --to 2',
    'ice migrate generate -s ./schema.ts --from 1 --to 2 --dialect mysql -o ./migration.sql',
    'ice migrate generate -s ./schema.ts --from 1 --to 2 --format json',
  ],
};

const MIGRATE_DIFF_HELP: HelpCommand = {
  name: 'migrate diff',
  description: 'Compare two schemas and show differences',
  usage: 'ice migrate diff --old <file> --new <file> [--dialect <dialect>]',
  options: [
    { name: 'old', description: 'Path to the old/source schema file', required: true },
    { name: 'new', description: 'Path to the new/target schema file', required: true },
    { name: 'dialect', short: 'd', description: 'SQL dialect', defaultValue: 'postgres' },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'format', short: 'f', description: 'Output format (sql, json)', defaultValue: 'sql' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice migrate diff --old ./schema-v1.ts --new ./schema-v2.ts',
    'ice migrate diff --old ./v1.ts --new ./v2.ts --dialect mysql --output ./diff.sql',
    'ice migrate diff --old ./v1.ts --new ./v2.ts --format json',
  ],
};

const MIGRATE_PLAN_HELP: HelpCommand = {
  name: 'migrate plan',
  description: 'Show migration plan without executing',
  usage: 'ice migrate plan --schema <file> [--dialect <dialect>]',
  options: [
    { name: 'schema', short: 's', description: 'Path to the schema file', required: true },
    { name: 'dialect', short: 'd', description: 'SQL dialect', defaultValue: 'postgres' },
    { name: 'output', short: 'o', description: 'Output file path (default: stdout)' },
    { name: 'format', short: 'f', description: 'Output format (sql, json)', defaultValue: 'sql' },
    { name: 'quiet', short: 'q', description: 'Suppress informational output' },
    { name: 'verbose', short: 'v', description: 'Show detailed output' },
  ],
  examples: [
    'ice migrate plan --schema ./schema.ts',
    'ice migrate plan -s ./schema.ts --dialect sqlite',
    'ice migrate plan -s ./schema.ts --format json -o ./plan.json',
  ],
};

// =============================================================================
// Subcommand Implementations
// =============================================================================

/**
 * ice migrate generate command
 *
 * Generate migration SQL from schema changes between versions.
 */
export async function migrateGenerate(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(MIGRATE_GENERATE_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      from: { type: 'string' },
      to: { type: 'string' },
      dialect: { type: 'string', short: 'd', default: 'postgres' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f', default: 'sql' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options
  requireOption(
    values.schema,
    'schema',
    'migrate generate',
    'ice migrate generate --schema ./schema.ts --from 1 --to 2'
  );
  requireOption(
    values.from,
    'from',
    'migrate generate',
    'ice migrate generate --schema ./schema.ts --from 1 --to 2'
  );
  requireOption(
    values.to,
    'to',
    'migrate generate',
    'ice migrate generate --schema ./schema.ts --from 1 --to 2'
  );

  const dialect = values.dialect as string;
  validateOptionValue(dialect, 'dialect', SUPPORTED_DIALECTS);

  const format = values.format as string;
  validateOptionValue(format, 'format', SUPPORTED_FORMATS);

  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const quiet = values.quiet === true;
  const verbose = values.verbose === true;

  // Create logger based on verbosity
  const logLevel = verbose ? LogLevel.DEBUG : quiet ? LogLevel.ERROR : LogLevel.INFO;
  const logger = createLogger({ level: logLevel, quiet });

  logger.info(`Generating migration from version ${values.from} to ${values.to}`);
  logger.debug('Options:', {
    schema: schemaPath,
    from: values.from,
    to: values.to,
    dialect,
    format,
    output: outputPath || '(stdout)',
  });

  // Load schemas from the file
  logger.debug('Loading schema file', { path: schemaPath });
  const loadResult = await loadSchemaFile(schemaPath);
  checkSchemaLoadErrors(loadResult.errors, schemaPath);
  checkSchemasExist(loadResult.schemas, schemaPath);

  logger.info(`Found ${loadResult.schemas.length} schema(s)`);

  // For now, generate a migration plan for each schema
  // In a full implementation, this would look at version history
  const output: string[] = [];
  const jsonOutput: Array<{ schema: string; operations: unknown[] }> = [];

  output.push(`-- IceType Migration`);
  output.push(`-- From version: ${values.from}`);
  output.push(`-- To version: ${values.to}`);
  output.push(`-- Dialect: ${dialect}`);
  output.push(`-- Date: ${new Date().toISOString()}`);
  output.push(``);

  for (const { name } of loadResult.schemas) {
    output.push(`-- ================================================`);
    output.push(`-- Schema: ${name}`);
    output.push(`-- ================================================`);
    output.push(``);

    // Without version history, we generate an empty migration placeholder
    // A real implementation would compare schema at version 'from' vs 'to'
    output.push(`-- Migration statements would be generated here`);
    output.push(`-- based on schema version history.`);
    output.push(``);

    jsonOutput.push({
      schema: name,
      operations: [],
    });
  }

  // Output based on format
  if (format === 'json') {
    const jsonContent = JSON.stringify(
      {
        fromVersion: values.from,
        toVersion: values.to,
        dialect,
        generatedAt: new Date().toISOString(),
        schemas: jsonOutput,
      },
      null,
      2
    );

    if (outputPath) {
      writeFileSync(outputPath, jsonContent);
      logger.success(`Migration JSON written to: ${outputPath}`);
    } else {
      console.log(jsonContent);
    }
  } else {
    const sqlContent = output.join('\n');

    if (outputPath) {
      writeFileSync(outputPath, sqlContent);
      logger.success(`Migration SQL written to: ${outputPath}`);
    } else {
      console.log(sqlContent);
    }
  }
}

/**
 * ice migrate diff command
 *
 * Compare two schema files and generate migration SQL.
 */
export async function migrateDiff(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(MIGRATE_DIFF_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      old: { type: 'string' },
      new: { type: 'string' },
      dialect: { type: 'string', short: 'd', default: 'postgres' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f', default: 'sql' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options
  requireOption(
    values.old,
    'old',
    'migrate diff',
    'ice migrate diff --old ./schema-v1.ts --new ./schema-v2.ts'
  );
  requireOption(
    values.new,
    'new',
    'migrate diff',
    'ice migrate diff --old ./schema-v1.ts --new ./schema-v2.ts'
  );

  const dialect = values.dialect as string;
  validateOptionValue(dialect, 'dialect', SUPPORTED_DIALECTS);

  const format = values.format as string;
  validateOptionValue(format, 'format', SUPPORTED_FORMATS);

  const oldPath = values.old;
  const newPath = values.new;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const quiet = values.quiet === true;
  const verbose = values.verbose === true;

  // Create logger based on verbosity
  const logLevel = verbose ? LogLevel.DEBUG : quiet ? LogLevel.ERROR : LogLevel.INFO;
  const logger = createLogger({ level: logLevel, quiet });

  logger.info(`Comparing schemas:`);
  logger.info(`  Old: ${oldPath}`);
  logger.info(`  New: ${newPath}`);
  logger.info(`  Dialect: ${dialect}`);

  // Load old schema
  logger.debug('Loading old schema file', { path: oldPath });
  const oldResult = await loadSchemaFile(oldPath);
  checkSchemaLoadErrors(oldResult.errors, oldPath);
  checkSchemasExist(oldResult.schemas, oldPath);

  // Load new schema
  logger.debug('Loading new schema file', { path: newPath });
  const newResult = await loadSchemaFile(newPath);
  checkSchemaLoadErrors(newResult.errors, newPath);
  checkSchemasExist(newResult.schemas, newPath);

  // Generate diffs and migrations for each schema
  const output: string[] = [];
  const jsonOutput: Array<{
    schema: string;
    hasChanges: boolean;
    addedFields: string[];
    removedFields: string[];
    modifiedFields: string[];
    upStatements: string[];
    downStatements: string[];
  }> = [];

  output.push(`-- IceType Schema Diff`);
  output.push(`-- Old: ${oldPath}`);
  output.push(`-- New: ${newPath}`);
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

      jsonOutput.push({
        schema: newSchema.name,
        hasChanges: true,
        addedFields: Array.from(newSchema.fields.keys()),
        removedFields: [],
        modifiedFields: [],
        upStatements: [`-- CREATE TABLE ${newSchema.name}`],
        downStatements: [`-- DROP TABLE ${newSchema.name}`],
      });
      continue;
    }

    const schemaDiff = diffSchemas(oldSchemaInfo.schema, newSchema);

    if (!schemaDiff.hasChanges) {
      output.push(`-- Schema ${newSchema.name}: No changes`);
      output.push(``);

      jsonOutput.push({
        schema: newSchema.name,
        hasChanges: false,
        addedFields: [],
        removedFields: [],
        modifiedFields: [],
        upStatements: [],
        downStatements: [],
      });
      continue;
    }

    hasAnyChanges = true;

    // Generate migration plan using core's function
    const plan = generateMigrationPlan(schemaDiff, { dialect: dialect as SqlDialect });

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

    // UP migration
    output.push(`-- UP Migration`);
    if (plan.up) {
      output.push(plan.up);
    } else {
      output.push(`-- (no SQL changes)`);
    }
    output.push(``);

    // DOWN migration
    output.push(`-- DOWN Migration (rollback)`);
    if (plan.down) {
      output.push(plan.down);
    } else {
      output.push(`-- (no SQL changes)`);
    }
    output.push(``);

    jsonOutput.push({
      schema: newSchema.name,
      hasChanges: true,
      addedFields: schemaDiff.addedFields.map((f) => f.name),
      removedFields: schemaDiff.removedFields.map((f) => f.name),
      modifiedFields: schemaDiff.modifiedFields.map((f) => f.name),
      upStatements: plan.up ? [plan.up] : [],
      downStatements: plan.down ? [plan.down] : [],
    });
  }

  // Check for removed schemas
  for (const oldSchemaInfo of oldResult.schemas) {
    const stillExists = newResult.schemas.some((s) => s.schema.name === oldSchemaInfo.schema.name);
    if (!stillExists) {
      output.push(`-- Schema ${oldSchemaInfo.schema.name}: REMOVED (not in new schema)`);
      output.push(`-- WARNING: This schema was removed. Consider adding DROP TABLE or archiving.`);
      output.push(``);
      hasAnyChanges = true;

      jsonOutput.push({
        schema: oldSchemaInfo.schema.name,
        hasChanges: true,
        addedFields: [],
        removedFields: Array.from(oldSchemaInfo.schema.fields.keys()),
        modifiedFields: [],
        upStatements: [`-- DROP TABLE ${oldSchemaInfo.schema.name}`],
        downStatements: [`-- Recreate ${oldSchemaInfo.schema.name}`],
      });
    }
  }

  // Output based on format
  if (format === 'json') {
    const jsonContent = JSON.stringify(
      {
        oldSchema: oldPath,
        newSchema: newPath,
        dialect,
        generatedAt: new Date().toISOString(),
        hasChanges: hasAnyChanges,
        schemas: jsonOutput,
      },
      null,
      2
    );

    if (outputPath) {
      writeFileSync(outputPath, jsonContent);
      logger.success(`Diff JSON written to: ${outputPath}`);
    } else {
      console.log(jsonContent);
    }
  } else {
    const sqlContent = output.join('\n');

    if (outputPath) {
      writeFileSync(outputPath, sqlContent);
      logger.success(`Diff SQL written to: ${outputPath}`);
    } else {
      console.log(sqlContent);
    }
  }

  if (!hasAnyChanges) {
    logger.info('No schema changes detected.');
  } else {
    logger.info('Schema changes detected. Review the migration output above.');
  }
}

/**
 * ice migrate plan command
 *
 * Show migration plan without executing.
 */
export async function migratePlan(args: string[]): Promise<void> {
  // Check for help flag first
  if (hasHelpFlag(args)) {
    console.log(generateHelpText(MIGRATE_PLAN_HELP));
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      dialect: { type: 'string', short: 'd', default: 'postgres' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f', default: 'sql' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options
  requireOption(
    values.schema,
    'schema',
    'migrate plan',
    'ice migrate plan --schema ./schema.ts'
  );

  const dialect = values.dialect as string;
  validateOptionValue(dialect, 'dialect', SUPPORTED_DIALECTS);

  const format = values.format as string;
  validateOptionValue(format, 'format', SUPPORTED_FORMATS);

  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const quiet = values.quiet === true;
  const verbose = values.verbose === true;

  // Create logger based on verbosity
  const logLevel = verbose ? LogLevel.DEBUG : quiet ? LogLevel.ERROR : LogLevel.INFO;
  const logger = createLogger({ level: logLevel, quiet });

  logger.info(`Generating migration plan for: ${schemaPath}`);
  logger.info(`Dialect: ${dialect}`);

  // Load schemas from the file
  logger.debug('Loading schema file', { path: schemaPath });
  const loadResult = await loadSchemaFile(schemaPath);
  checkSchemaLoadErrors(loadResult.errors, schemaPath);
  checkSchemasExist(loadResult.schemas, schemaPath);

  logger.info(`Found ${loadResult.schemas.length} schema(s)`);

  // Generate plan output
  const output: string[] = [];
  const jsonOutput: Array<{
    schema: string;
    tableName: string;
    fields: Array<{ name: string; type: string; nullable: boolean; indexed: boolean }>;
    createStatement: string;
  }> = [];

  output.push(`-- IceType Migration Plan`);
  output.push(`-- Schema: ${schemaPath}`);
  output.push(`-- Dialect: ${dialect}`);
  output.push(`-- Date: ${new Date().toISOString()}`);
  output.push(``);
  output.push(`-- This plan shows what would be created for each schema.`);
  output.push(`-- No database operations are performed.`);
  output.push(``);

  for (const { name, schema } of loadResult.schemas) {
    output.push(`-- ================================================`);
    output.push(`-- Schema: ${name}`);
    output.push(`-- ================================================`);
    output.push(``);

    // List fields
    output.push(`-- Fields:`);
    const fieldEntries: Array<{
      name: string;
      type: string;
      nullable: boolean;
      indexed: boolean;
    }> = [];

    for (const [fieldName, field] of schema.fields) {
      if (fieldName.startsWith('$')) continue;

      const nullable = field.isOptional || field.modifier === '?';
      const indexed = field.isIndexed || field.modifier === '#';
      const unique = field.isUnique || field.modifier === '!';

      const flags = [];
      if (!nullable) flags.push('NOT NULL');
      if (unique) flags.push('UNIQUE');
      if (indexed) flags.push('INDEXED');

      output.push(`--   ${fieldName}: ${field.type} ${flags.join(' ')}`);
      fieldEntries.push({
        name: fieldName,
        type: field.type,
        nullable,
        indexed,
      });
    }
    output.push(``);

    // Show CREATE TABLE statement that would be generated
    output.push(`-- CREATE TABLE statement:`);
    const createStmt = `CREATE TABLE ${name} (\n  -- columns would be defined here based on dialect\n);`;
    output.push(createStmt);
    output.push(``);

    jsonOutput.push({
      schema: name,
      tableName: name,
      fields: fieldEntries,
      createStatement: createStmt,
    });
  }

  // Output based on format
  if (format === 'json') {
    const jsonContent = JSON.stringify(
      {
        schemaPath,
        dialect,
        generatedAt: new Date().toISOString(),
        schemas: jsonOutput,
      },
      null,
      2
    );

    if (outputPath) {
      writeFileSync(outputPath, jsonContent);
      logger.success(`Migration plan JSON written to: ${outputPath}`);
    } else {
      console.log(jsonContent);
    }
  } else {
    const sqlContent = output.join('\n');

    if (outputPath) {
      writeFileSync(outputPath, sqlContent);
      logger.success(`Migration plan written to: ${outputPath}`);
    } else {
      console.log(sqlContent);
    }
  }
}

// =============================================================================
// Main Command Router
// =============================================================================

/**
 * Main entry point for the migrate command group.
 *
 * Routes to the appropriate subcommand based on the first argument.
 */
export async function migrate(args: string[]): Promise<void> {
  // Check for help at the top level
  if (args.length === 0 || hasHelpFlag(args)) {
    if (args.length === 0 || (args[0] !== 'generate' && args[0] !== 'diff' && args[0] !== 'plan')) {
      console.log(generateHelpText(MIGRATE_HELP));
      process.exit(0);
    }
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'generate':
      await migrateGenerate(subArgs);
      break;

    case 'diff':
      await migrateDiff(subArgs);
      break;

    case 'plan':
      await migratePlan(subArgs);
      break;

    default:
      console.error(`Unknown migrate subcommand: ${subcommand}`);
      console.log('Available: ice migrate generate, ice migrate diff, ice migrate plan');
      process.exit(1);
  }
}
