/**
 * SQLite DDL Generation Example
 *
 * Demonstrates how to generate SQLite CREATE TABLE statements
 * from IceType schemas using the SQLite adapter.
 *
 * Run with: npx tsx generate.ts
 */

import { parseSchema } from '@icetype/core';
import { SQLiteAdapter, transformToSQLiteDDL } from '@icetype/sqlite';
import { schemas, NoteSchema } from './schema.js';

/**
 * Main function - generate SQLite DDL for all schemas
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to SQLite DDL Generation');
  console.log('='.repeat(60));

  const adapter = new SQLiteAdapter();

  // -------------------------------------------------------------------------
  // Generate DDL for all schemas with STRICT mode
  // -------------------------------------------------------------------------
  console.log('\n--- STRICT Mode (recommended for type safety) ---\n');

  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`${'='.repeat(60)}`);
    console.log(`-- ${name} Table`);
    console.log('='.repeat(60) + '\n');

    // Parse the IceType schema
    const schema = parseSchema(definition);

    // Transform to SQLite DDL with STRICT mode
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      strict: true,              // Enable SQLite STRICT mode (3.37+)
      includeSystemFields: true, // Include $id, $type, $version, etc.
    });

    // Serialize to SQL (with indexes)
    const sql = adapter.serializeWithIndexes(ddl);

    console.log(sql);
    console.log('');

    // Print schema summary
    console.log(`-- Summary:`);
    console.log(`--   Columns: ${ddl.columns.length}`);
    console.log(`--   Primary Key: ${ddl.primaryKey?.join(', ') || 'none'}`);
    if (ddl.uniqueConstraints && ddl.uniqueConstraints.length > 0) {
      console.log(`--   Unique Constraints: ${ddl.uniqueConstraints.map(c => c.join(', ')).join('; ')}`);
    }
    console.log('');
  }

  // -------------------------------------------------------------------------
  // Demonstrate non-STRICT mode (for older SQLite versions)
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('--- Non-STRICT Mode (for older SQLite versions) ---');
  console.log('='.repeat(60) + '\n');

  const noteSchema = parseSchema(NoteSchema);
  const nonStrictDDL = transformToSQLiteDDL(noteSchema, {
    ifNotExists: true,
    strict: false,
    includeSystemFields: false,  // Skip system fields for simpler output
  });

  console.log('// Without STRICT and without system fields:\n');
  console.log(nonStrictDDL);

  // -------------------------------------------------------------------------
  // Show usage examples
  // -------------------------------------------------------------------------
  console.log(`
${'='.repeat(60)}
SQLite Usage Examples
${'='.repeat(60)}

-- Insert a note
INSERT INTO Note (
    "$id", "$type", "$version", "$createdAt", "$updatedAt",
    id, title, content, tags, isPinned, isArchived, createdAt, updatedAt
) VALUES (
    'note_' || lower(hex(randomblob(8))),
    'Note', 1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000,
    lower(hex(randomblob(16))),
    'My First Note',
    'This is the content of my note.',
    json('["work", "important"]'),
    0, 0,
    datetime('now'),
    datetime('now')
);

-- Query notes by tag (using JSON functions)
SELECT * FROM Note
WHERE json_extract(tags, '$') LIKE '%important%';

-- Query tasks by status and priority
SELECT * FROM Task
WHERE status = 'pending'
  AND priority >= 2
ORDER BY dueDate ASC;

-- Get all settings in a category
SELECT key, json_extract(value, '$') as value
FROM Setting
WHERE category = 'appearance';

-- Clean up expired sessions
DELETE FROM Session
WHERE datetime(expiresAt) < datetime('now');

-- Full-text search (requires FTS5 extension)
-- CREATE VIRTUAL TABLE Note_fts USING fts5(title, content, content=Note);
-- SELECT * FROM Note_fts WHERE Note_fts MATCH 'search term';

-- Check constraint example (add after table creation)
-- For Task priority validation:
-- ALTER TABLE Task ADD CONSTRAINT chk_priority CHECK (priority BETWEEN 0 AND 3);
`);

  console.log('='.repeat(60));
  console.log('DDL generation complete!');
  console.log('='.repeat(60));
}

main();
