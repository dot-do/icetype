/**
 * ice validate command
 *
 * Validates IceType schema syntax.
 */

import { parseArgs } from 'node:util';
import { validateSchema } from '@icetype/core';
import { loadSchemaFile } from '../utils/schema-loader.js';

export async function validate(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
    },
  });

  if (!values.schema) {
    console.error('Error: --schema is required');
    console.log('Usage: ice validate --schema ./schema.ts');
    process.exit(1);
  }

  // values.schema is guaranteed to be string after the check above
  const schemaPath = values.schema;
  console.log(`Validating schema: ${schemaPath}`);

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

    console.log(`Found ${loadResult.schemas.length} schema(s)\n`);

    let hasErrors = false;

    // Validate each schema
    for (const { name, schema } of loadResult.schemas) {
      console.log(`Validating: ${name}`);
      const result = validateSchema(schema);

      if (result.valid) {
        console.log(`  [OK] ${name} is valid`);

        if (result.warnings.length > 0) {
          console.log('  Warnings:');
          for (const warning of result.warnings) {
            console.log(`    - [${warning.code}] ${warning.path}: ${warning.message}`);
          }
        }
      } else {
        hasErrors = true;
        console.error(`  [FAIL] ${name} validation failed:`);

        for (const error of result.errors) {
          console.error(`    - [${error.code}] ${error.path}: ${error.message}`);
        }

        if (result.warnings.length > 0) {
          console.log('  Warnings:');
          for (const warning of result.warnings) {
            console.log(`    - [${warning.code}] ${warning.path}: ${warning.message}`);
          }
        }
      }
      console.log('');
    }

    if (hasErrors) {
      process.exit(1);
    }

    console.log('All schemas are valid');
  } catch (error) {
    console.error('Error loading schema:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
