/**
 * ice postgres export command
 *
 * Exports IceType schema to PostgreSQL DDL (Data Definition Language).
 * Generates CREATE TABLE statements with appropriate PostgreSQL types,
 * NOT NULL constraints, UNIQUE constraints, and indexes.
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getPostgresType } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';
import type { IceTypeSchema } from '@icetype/core';

/**
 * Options for PostgreSQL DDL generation
 */
export interface PostgresDDLOptions {
  /** PostgreSQL schema name (e.g., 'public', 'app') */
  schemaName?: string;
}

/**
 * Generate PostgreSQL DDL for a single IceType schema.
 *
 * @param schema - The IceType schema to convert
 * @param options - Optional DDL generation options
 * @returns PostgreSQL DDL string (CREATE TABLE + CREATE INDEX statements)
 *
 * @example
 * ```typescript
 * const ddl = generatePostgresDDL(userSchema, { schemaName: 'public' });
 * // CREATE TABLE public.User (
 * //   id UUID NOT NULL UNIQUE,
 * //   name TEXT NOT NULL,
 * //   email TEXT NOT NULL
 * // );
 * // CREATE INDEX idx_User_email ON public.User (email);
 * ```
 */
export function generatePostgresDDL(
  schema: IceTypeSchema,
  options?: PostgresDDLOptions
): string {
  const schemaName = options?.schemaName;
  const tableName = schemaName ? `${schemaName}.${schema.name}` : schema.name;

  const columns: string[] = [];
  const indexes: string[] = [];

  // Process all fields
  for (const [fieldName, field] of schema.fields) {
    // Skip system fields starting with $
    if (fieldName.startsWith('$')) continue;

    const pgType = getPostgresType(field.type);
    const constraints: string[] = [];

    // NOT NULL for required fields (! modifier or non-optional)
    if (field.modifier === '!' || (!field.isOptional && field.modifier !== '?')) {
      constraints.push('NOT NULL');
    }

    // UNIQUE constraint
    if (field.isUnique || field.modifier === '!') {
      constraints.push('UNIQUE');
    }

    const constraintStr = constraints.length > 0 ? ' ' + constraints.join(' ') : '';
    columns.push(`  ${fieldName} ${pgType}${constraintStr}`);

    // Create index for indexed fields
    if (field.isIndexed || field.modifier === '#') {
      indexes.push(
        `CREATE INDEX idx_${schema.name}_${fieldName} ON ${tableName} (${fieldName});`
      );
    }
  }

  // Build CREATE TABLE statement
  let ddl = `CREATE TABLE ${tableName} (\n${columns.join(',\n')}\n);`;

  // Add indexes if any
  if (indexes.length > 0) {
    ddl += '\n\n' + indexes.join('\n');
  }

  return ddl;
}

/**
 * Generate PostgreSQL DDL for multiple IceType schemas.
 *
 * @param schemas - Array of IceType schemas to convert
 * @param options - Optional DDL generation options
 * @returns Combined PostgreSQL DDL string for all schemas
 *
 * @example
 * ```typescript
 * const ddl = generatePostgresDDLForAllSchemas([userSchema, postSchema], { schemaName: 'app' });
 * ```
 */
export function generatePostgresDDLForAllSchemas(
  schemas: IceTypeSchema[],
  options?: PostgresDDLOptions
): string {
  if (schemas.length === 0) {
    return '';
  }

  const ddlStatements = schemas.map((schema) => generatePostgresDDL(schema, options));
  return ddlStatements.join('\n\n');
}

/**
 * CLI command handler for `ice postgres export`
 *
 * @param args - Command line arguments
 *
 * Usage:
 * ```bash
 * ice postgres export --schema ./schema.ts --output ./create-tables.sql
 * ice postgres export -s ./schema.ts --schema-name public
 * ice postgres export -s ./schema.ts  # outputs to stdout
 * ```
 */
export async function postgresExport(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      schemaName: { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      verbose: { type: 'boolean', short: 'v' },
    },
  });

  // Validate required options
  if (!values.schema) {
    console.error('Error: --schema is required');
    console.log(
      'Usage: ice postgres export --schema ./schema.ts --output ./create-tables.sql --schema-name public'
    );
    process.exit(1);
  }

  const schemaPath = values.schema;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;
  const schemaName = typeof values.schemaName === 'string' ? values.schemaName : undefined;
  const quiet = values.quiet === true;

  if (!quiet) {
    console.log(`Exporting PostgreSQL DDL from: ${schemaPath}`);
  }

  try {
    // Load schemas from the file
    const loadResult = await loadSchemaFile(schemaPath);

    // Check for loading errors
    if (loadResult.errors.length > 0) {
      for (const error of loadResult.errors) {
        console.error(error);
      }
      process.exit(1);
    }

    if (loadResult.schemas.length === 0) {
      console.error('No schemas found in the file');
      process.exit(1);
    }

    if (!quiet) {
      console.log(`Found ${loadResult.schemas.length} schema(s)`);
    }

    // Generate DDL for all schemas
    const schemas = loadResult.schemas.map((s) => s.schema);
    const ddl = generatePostgresDDLForAllSchemas(schemas, { schemaName });

    // Output DDL
    if (outputPath) {
      try {
        writeFileSync(outputPath, ddl);
        if (!quiet) {
          console.log(`Exported PostgreSQL DDL: ${outputPath}`);
          console.log(`Generated ${loadResult.schemas.length} table(s)`);
        }
      } catch (writeError) {
        const message = writeError instanceof Error ? writeError.message : String(writeError);
        console.error(`Error: Failed to write output file '${outputPath}': ${message}`);
        console.error('Check that the directory exists and you have write permissions.');
        process.exit(1);
      }
    } else {
      // Output to stdout
      console.log(ddl);
    }
  } catch (error) {
    console.error(
      'Error exporting PostgreSQL DDL:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
