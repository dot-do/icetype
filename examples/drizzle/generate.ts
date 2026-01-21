/**
 * Drizzle Schema Generation Example
 *
 * This file demonstrates how to generate Drizzle ORM schemas from
 * IceType schema definitions using the @icetype/drizzle adapter.
 *
 * Usage:
 *   pnpm generate
 *
 * Output:
 *   ./generated/schema.ts - Drizzle schema for PostgreSQL
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { DrizzleAdapter, transformSchemasToDrizzle } from '@icetype/drizzle';
import { User, Post, Comment, Category, schemas } from './icetype-schema.js';

// Configuration
const OUTPUT_DIR = './generated';
const OUTPUT_FILE = 'schema.ts';

/**
 * Generate Drizzle schema for a single IceType schema
 */
function generateSingleSchema() {
  console.log('\n--- Single Schema Generation ---\n');

  const adapter = new DrizzleAdapter();

  // Transform User schema to Drizzle
  const drizzleSchema = adapter.transform(User, { dialect: 'pg' });

  console.log('Transformed User schema:');
  console.log('  Tables:', drizzleSchema.tables.map(t => t.tableName).join(', '));
  console.log('  Columns:', drizzleSchema.tables[0]?.columns.map(c => c.name).join(', '));

  // Generate the code
  const code = adapter.serialize(drizzleSchema);
  console.log('\nGenerated Drizzle code for User:');
  console.log('─'.repeat(50));
  console.log(code);
  console.log('─'.repeat(50));
}

/**
 * Generate Drizzle schema for multiple IceType schemas
 */
function generateMultipleSchemas() {
  console.log('\n--- Multiple Schemas Generation ---\n');

  // Use the convenience function to transform all schemas at once
  const code = transformSchemasToDrizzle(schemas, { dialect: 'pg' });

  // Create output directory
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Write the output file
  const outputPath = `${OUTPUT_DIR}/${OUTPUT_FILE}`;
  writeFileSync(outputPath, code);

  console.log(`Generated Drizzle schema file: ${outputPath}`);
  console.log('\nGenerated code:');
  console.log('─'.repeat(60));
  console.log(code);
  console.log('─'.repeat(60));
}

/**
 * Demonstrate different dialect support
 */
function demonstrateDialects() {
  console.log('\n--- Dialect Comparison ---\n');

  const adapter = new DrizzleAdapter();

  const dialects = ['pg', 'mysql', 'sqlite'] as const;

  for (const dialect of dialects) {
    console.log(`\n${dialect.toUpperCase()} Dialect:`);
    console.log('─'.repeat(40));

    const schema = adapter.transform(User, { dialect });
    const code = adapter.serialize(schema);

    // Show just the import and first few lines
    const lines = code.split('\n');
    const preview = lines.slice(0, 15).join('\n');
    console.log(preview);
    console.log('...\n');
  }
}

/**
 * Main entry point
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to Drizzle Schema Generation');
  console.log('='.repeat(60));

  // Generate single schema example
  generateSingleSchema();

  // Generate all schemas to file
  generateMultipleSchemas();

  // Show dialect differences
  demonstrateDialects();

  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('  1. Review the generated schema in ./generated/schema.ts');
  console.log('  2. Install Drizzle ORM: npm install drizzle-orm postgres');
  console.log('  3. Use the schema with Drizzle Kit for migrations');
  console.log('\nExample usage:');
  console.log('  import { user, post } from "./generated/schema.js";');
  console.log('  import { drizzle } from "drizzle-orm/postgres-js";');
  console.log('  ');
  console.log('  const db = drizzle(client);');
  console.log('  const users = await db.select().from(user);');
}

main();
