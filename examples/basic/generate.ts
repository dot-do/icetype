/**
 * TypeScript Generation Example
 *
 * This file demonstrates how to parse IceType schemas and generate
 * TypeScript interfaces from them programmatically.
 *
 * Run with: npx tsx generate.ts
 */

import { parseSchema, validateSchema, type IceTypeSchema, type FieldDefinition } from '@icetype/core';
import { schemas } from './schema.js';

/**
 * Convert IceType field to TypeScript type
 */
function fieldToTypeScript(field: FieldDefinition): string {
  if (field.relation) {
    // Relations become string IDs or arrays of string IDs
    return field.isArray ? 'string[]' : 'string';
  }

  let baseType: string;

  switch (field.type.toLowerCase()) {
    case 'string':
    case 'text':
    case 'uuid':
      baseType = 'string';
      break;
    case 'int':
    case 'long':
    case 'bigint':
    case 'float':
    case 'double':
    case 'decimal':
      baseType = 'number';
      break;
    case 'bool':
    case 'boolean':
      baseType = 'boolean';
      break;
    case 'timestamp':
    case 'timestamptz':
    case 'date':
    case 'time':
      baseType = 'number'; // Epoch milliseconds
      break;
    case 'json':
      baseType = 'unknown';
      break;
    case 'binary':
      baseType = 'Uint8Array';
      break;
    default:
      baseType = 'unknown';
  }

  return field.isArray ? `${baseType}[]` : baseType;
}

/**
 * Generate a TypeScript interface from an IceType schema
 */
function generateInterface(schema: IceTypeSchema): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Generated from IceType schema: ${schema.name}`);
  lines.push(` */`);
  lines.push(`export interface ${schema.name} {`);

  // System fields (added by the database layer)
  lines.push(`  /** Unique document identifier */`);
  lines.push(`  $id: string;`);
  lines.push(`  /** Document type */`);
  lines.push(`  $type: '${schema.name}';`);
  lines.push(`  /** Document version */`);
  lines.push(`  $version: number;`);
  lines.push(`  /** Creation timestamp (epoch ms) */`);
  lines.push(`  $createdAt: number;`);
  lines.push(`  /** Last update timestamp (epoch ms) */`);
  lines.push(`  $updatedAt: number;`);

  // User-defined fields
  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScript(field);
    const optional = field.isOptional ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  // Generate input type (without system fields)
  lines.push(``);
  lines.push(`/** Input type for creating ${schema.name} */`);
  lines.push(`export interface ${schema.name}Input {`);

  for (const [fieldName, field] of schema.fields) {
    if (fieldName.startsWith('$')) continue;

    const tsType = fieldToTypeScript(field);
    const optional = field.isOptional || field.defaultValue !== undefined ? '?' : '';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Main function - parse schemas and generate TypeScript
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType TypeScript Generation Example');
  console.log('='.repeat(60));

  console.log('\n--- Generated TypeScript Interfaces ---\n');

  // Generate header
  console.log(`/**
 * IceType Generated Types
 *
 * This file was auto-generated from IceType schema definitions.
 * Do not edit manually.
 *
 * @generated
 */
`);

  // Parse and generate each schema
  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`// Processing ${name} schema...`);

    // Parse the schema
    const schema = parseSchema(definition);

    // Validate it
    const validation = validateSchema(schema);
    if (!validation.valid) {
      console.error(`Schema ${name} has errors:`);
      for (const error of validation.errors) {
        console.error(`  - ${error.path}: ${error.message}`);
      }
      continue;
    }

    // Generate the interface
    const tsInterface = generateInterface(schema);
    console.log('\n' + tsInterface + '\n');
  }

  console.log('='.repeat(60));
  console.log('Generation complete!');
  console.log('='.repeat(60));

  // Print usage example
  console.log(`
Usage example:

import type { User, UserInput, Post, PostInput } from './generated-types';

// Create a new user
const newUser: UserInput = {
  email: 'user@example.com',
  name: 'John Doe',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Type-safe user object
const user: User = {
  $id: 'user_123',
  $type: 'User',
  $version: 1,
  $createdAt: Date.now(),
  $updatedAt: Date.now(),
  ...newUser,
  id: 'uuid-here',
};
`);
}

main();
