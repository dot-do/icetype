/**
 * TypeScript Code Generation Example
 *
 * This file demonstrates how to generate TypeScript interfaces from
 * IceType schemas using the CLI library programmatically.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { parseSchema, type SchemaDefinition } from '@icetype/core';
import { generateTypeScriptInterface } from '@icetype/cli';
import {
  UserSchema,
  OrganizationSchema,
  PostSchema,
  CommentSchema,
  CategorySchema,
} from './schema.js';

// Configuration
const OUTPUT_DIR = './generated';

/**
 * Generate the complete TypeScript file header
 */
function generateHeader(): string {
  return `/**
 * IceType Generated Types
 *
 * This file was auto-generated from IceType schema definitions.
 * Do not edit manually - changes will be overwritten.
 *
 * Generated at: ${new Date().toISOString()}
 *
 * @generated
 */

`;
}

/**
 * Generate utility types used by the generated interfaces
 */
function generateUtilityTypes(): string {
  return `// =============================================================================
// Utility Types
// =============================================================================

/**
 * Base document type that all entities extend.
 * Contains system-managed fields.
 */
export interface BaseDocument {
  /** Unique document identifier */
  $id: string;
  /** Document type/collection name */
  $type: string;
  /** Document version for optimistic concurrency */
  $version: number;
  /** Creation timestamp (Unix epoch milliseconds) */
  $createdAt: number;
  /** Last update timestamp (Unix epoch milliseconds) */
  $updatedAt: number;
}

/**
 * Helper type to make all properties optional for updates
 */
export type PartialUpdate<T> = Partial<Omit<T, '$id' | '$type' | '$version' | '$createdAt' | '$updatedAt'>>;

/**
 * Helper type for creating new documents (excludes system fields)
 */
export type CreateInput<T> = Omit<T, '$id' | '$type' | '$version' | '$createdAt' | '$updatedAt'>;

`;
}

/**
 * Generate TypeScript interfaces for a schema
 */
function generateSchemaTypes(schemaDefinition: SchemaDefinition): string {
  const schema = parseSchema(schemaDefinition);
  return generateTypeScriptInterface(schema);
}

/**
 * Main generator
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType TypeScript Code Generation');
  console.log('='.repeat(60));

  // Create output directory
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }

  const schemaList = [
    { definition: UserSchema, name: 'User' },
    { definition: OrganizationSchema, name: 'Organization' },
    { definition: PostSchema, name: 'Post' },
    { definition: CommentSchema, name: 'Comment' },
    { definition: CategorySchema, name: 'Category' },
  ];

  // Build the complete types file
  const lines: string[] = [];

  // Add header
  lines.push(generateHeader());

  // Add utility types
  lines.push(generateUtilityTypes());

  // Add separator
  lines.push('// =============================================================================');
  lines.push('// Entity Types');
  lines.push('// =============================================================================');
  lines.push('');

  // Generate each schema's types
  for (const { definition, name } of schemaList) {
    console.log(`Generating types for: ${name}`);

    const schemaTypes = generateSchemaTypes(definition);
    lines.push(schemaTypes);
    lines.push('');
  }

  // Add type registry
  lines.push('// =============================================================================');
  lines.push('// Type Registry');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('/**');
  lines.push(' * Map of all entity types by name.');
  lines.push(' * Useful for generic operations.');
  lines.push(' */');
  lines.push('export interface EntityTypeMap {');
  for (const { name } of schemaList) {
    lines.push(`  ${name}: ${name};`);
  }
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Map of all input types by entity name.');
  lines.push(' */');
  lines.push('export interface InputTypeMap {');
  for (const { name } of schemaList) {
    lines.push(`  ${name}: ${name}Input;`);
  }
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Union of all entity type names.');
  lines.push(' */');
  lines.push(`export type EntityTypeName = ${schemaList.map(s => `'${s.name}'`).join(' | ')};`);
  lines.push('');
  lines.push('/**');
  lines.push(' * Union of all entity types.');
  lines.push(' */');
  lines.push(`export type AnyEntity = ${schemaList.map(s => s.name).join(' | ')};`);
  lines.push('');

  // Write the complete file
  const content = lines.join('\n');
  const outputPath = `${OUTPUT_DIR}/types.ts`;
  writeFileSync(outputPath, content);

  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete');
  console.log('='.repeat(60));
  console.log(`Output file: ${outputPath}`);
  console.log(`Schemas generated: ${schemaList.length}`);
  console.log('='.repeat(60));

  // Print usage example
  console.log('\nUsage example:');
  console.log('```typescript');
  console.log("import type { User, UserInput, EntityTypeMap } from './generated/types';");
  console.log('');
  console.log('// Create a new user');
  console.log('const newUser: UserInput = {');
  console.log("  email: 'user@example.com',");
  console.log("  name: 'John Doe',");
  console.log("  organizationId: 'org_123',");
  console.log('};');
  console.log('');
  console.log('// Type-safe entity access');
  console.log('function getEntity<T extends keyof EntityTypeMap>(');
  console.log('  type: T,');
  console.log('  id: string');
  console.log('): Promise<EntityTypeMap[T]> {');
  console.log('  // Implementation');
  console.log('}');
  console.log('```');
}

main();
