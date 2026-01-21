/**
 * Schema Validation Example
 *
 * This file demonstrates how to parse and validate IceType schemas.
 * The validation process checks for:
 * - Valid type names
 * - Correct modifier usage
 * - Valid relation definitions
 * - Proper directive configuration
 */

import { parseSchema, validateSchema, type IndexDirective, type SchemaDefinition } from '@icetype/core';
import { UserSchema, PostSchema, CommentSchema } from './schema.js';

/**
 * Parse and validate a single schema
 */
function validateSingleSchema(schemaDefinition: SchemaDefinition, name: string): boolean {
  console.log(`\n--- Validating ${name} Schema ---\n`);

  try {
    // Parse the schema definition into an IceTypeSchema
    const schema = parseSchema(schemaDefinition);

    console.log(`Schema name: ${schema.name}`);
    console.log(`Version: ${schema.version}`);
    console.log(`Fields: ${schema.fields.size}`);
    console.log(`Relations: ${schema.relations.size}`);

    // Print field details
    console.log('\nFields:');
    for (const [fieldName, field] of schema.fields) {
      const modifiers = [];
      if (field.isOptional) modifiers.push('optional');
      if (field.isUnique) modifiers.push('unique');
      if (field.isIndexed) modifiers.push('indexed');
      if (field.isArray) modifiers.push('array');
      if (field.defaultValue !== undefined) modifiers.push(`default=${JSON.stringify(field.defaultValue)}`);

      const modStr = modifiers.length > 0 ? ` (${modifiers.join(', ')})` : '';
      console.log(`  - ${fieldName}: ${field.type}${modStr}`);
    }

    // Print directives
    if (schema.directives.partitionBy?.length) {
      console.log(`\nPartition by: ${schema.directives.partitionBy.join(', ')}`);
    }
    if (schema.directives.index?.length) {
      console.log(`Indexes: ${schema.directives.index.map((idx: IndexDirective) => idx.fields.join(', ')).join('; ')}`);
    }
    if (schema.directives.fts?.length) {
      console.log(`Full-text search: ${schema.directives.fts.join(', ')}`);
    }

    // Validate the parsed schema
    const result = validateSchema(schema);

    if (result.valid) {
      console.log('\nValidation: PASSED');
    } else {
      console.log('\nValidation: FAILED');
      for (const error of result.errors) {
        console.log(`  Error [${error.code}] at ${error.path}: ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const warning of result.warnings) {
        console.log(`  Warning [${warning.code}] at ${warning.path}: ${warning.message}`);
      }
    }

    return result.valid;
  } catch (error) {
    console.error(`\nParse error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main validation runner
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType Schema Validation Example');
  console.log('='.repeat(60));

  const schemas = [
    { definition: UserSchema, name: 'User' },
    { definition: PostSchema, name: 'Post' },
    { definition: CommentSchema, name: 'Comment' },
  ];

  let allValid = true;

  for (const { definition, name } of schemas) {
    const isValid = validateSingleSchema(definition, name);
    if (!isValid) {
      allValid = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allValid) {
    console.log('All schemas validated successfully!');
  } else {
    console.log('Some schemas failed validation.');
    process.exit(1);
  }
  console.log('='.repeat(60));
}

main();
