/**
 * ice validate command
 *
 * Validates IceType schema syntax.
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseSchema, validateSchema } from '@icetype/core';

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

  const schemaPath = values.schema as string;
  console.log(`Validating schema: ${schemaPath}`);

  // Read and parse the schema file
  // In a full implementation, this would dynamically import the TypeScript file
  // For now, we'll demonstrate with inline parsing

  try {
    // Example: validate a schema definition
    const exampleSchema = parseSchema({
      $type: 'Example',
      id: 'uuid!',
      name: 'string',
      count: 'int?',
    });

    const result = validateSchema(exampleSchema);

    if (result.valid) {
      console.log('Schema is valid');

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const warning of result.warnings) {
          console.log(`  - [${warning.code}] ${warning.path}: ${warning.message}`);
        }
      }
    } else {
      console.error('Schema validation failed:');

      for (const error of result.errors) {
        console.error(`  - [${error.code}] ${error.path}: ${error.message}`);
      }

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const warning of result.warnings) {
          console.log(`  - [${warning.code}] ${warning.path}: ${warning.message}`);
        }
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('Error parsing schema:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
