# SQLite DDL Example

This example demonstrates how to generate SQLite DDL (CREATE TABLE statements) from IceType schemas.

## What is SQLite?

SQLite is a lightweight, embedded relational database. It's ideal for:

- **Edge computing** - Perfect for Cloudflare D1 and similar edge databases
- **Mobile/IoT** - Embedded in apps without a separate server
- **Local apps** - Desktop applications with local data storage
- **Prototyping** - Quick development without database setup

## Files

- `schema.ts` - Example schemas (Note, Task, Setting, Session)
- `generate.ts` - Generates SQLite CREATE TABLE statements

## Type Mapping

| IceType | SQLite |
|---------|--------|
| `string` | `TEXT` |
| `text` | `TEXT` |
| `int` | `INTEGER` |
| `long` | `INTEGER` |
| `float` | `REAL` |
| `double` | `REAL` |
| `boolean` | `INTEGER` |
| `timestamp` | `TEXT` |
| `date` | `TEXT` |
| `time` | `TEXT` |
| `uuid` | `TEXT` |
| `json` | `TEXT` |
| `binary` | `BLOB` |
| `decimal` | `REAL` |
| `string?` | `TEXT` (nullable) |

SQLite has only four storage classes: INTEGER, REAL, TEXT, and BLOB.

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Generate SQLite DDL
cd examples/sqlite
pnpm generate
```

Or run directly with tsx:

```bash
cd examples/sqlite
npx tsx generate.ts
```

## Expected Output

```sql
============================================================
-- Note Table
============================================================

CREATE TABLE IF NOT EXISTS Note (
  "$id" TEXT NOT NULL PRIMARY KEY,
  "$type" TEXT NOT NULL,
  "$version" INTEGER NOT NULL DEFAULT 1,
  "$createdAt" INTEGER NOT NULL,
  "$updatedAt" INTEGER NOT NULL,
  id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT,
  isPinned INTEGER NOT NULL DEFAULT 0,
  isArchived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (id)
) STRICT;

CREATE INDEX idx_Note_id ON Note (id);
```

## STRICT Mode

SQLite 3.37+ supports STRICT tables for better type enforcement:

```sql
CREATE TABLE Note (...) STRICT;
```

In STRICT mode:
- Columns must use declared types (INTEGER, REAL, TEXT, BLOB, or ANY)
- Type affinity rules don't apply - types are enforced
- Better data integrity and fewer surprises

Disable STRICT mode for older SQLite versions:

```typescript
const ddl = transformToSQLiteDDL(schema, {
  strict: false,  // For SQLite < 3.37
});
```

## System Fields

The SQLite adapter adds system fields to each table:

| Field | Type | Description |
|-------|------|-------------|
| `$id` | TEXT | Unique document identifier (primary key) |
| `$type` | TEXT | Document type name |
| `$version` | INTEGER | Version for optimistic concurrency |
| `$createdAt` | INTEGER | Creation timestamp (epoch ms) |
| `$updatedAt` | INTEGER | Last update timestamp (epoch ms) |

Disable system fields with `includeSystemFields: false`.

## SQLite Features

### JSON Support

SQLite has built-in JSON functions (json1 extension, included by default since 3.38):

```sql
-- Store JSON
INSERT INTO Note (tags) VALUES (json('["work", "urgent"]'));

-- Query JSON
SELECT * FROM Note WHERE json_extract(tags, '$[0]') = 'work';

-- JSON array contains
SELECT * FROM Note WHERE tags LIKE '%"work"%';
```

### Date/Time Handling

SQLite stores dates as TEXT (ISO8601) or INTEGER (Unix epoch):

```sql
-- Insert with datetime
INSERT INTO Task (dueDate) VALUES (date('now', '+7 days'));

-- Query by date
SELECT * FROM Task WHERE date(dueDate) < date('now');

-- Format dates
SELECT strftime('%Y-%m-%d', createdAt) FROM Note;
```

### Full-Text Search (FTS5)

```sql
-- Create FTS5 virtual table
CREATE VIRTUAL TABLE Note_fts USING fts5(
  title, content,
  content=Note,
  content_rowid=rowid
);

-- Search
SELECT * FROM Note_fts WHERE Note_fts MATCH 'search term';
```

### WITHOUT ROWID

For tables where the primary key is the main identifier:

```typescript
const ddl = adapter.transform(schema, {
  withoutRowid: true,  // Optimize storage for PRIMARY KEY lookups
});
```

## Best Practices

1. **Use STRICT mode** - Prevents type coercion bugs (SQLite 3.37+)
2. **Index strategically** - SQLite indexes are B-trees; index columns used in WHERE/ORDER BY
3. **Use JSON functions** - For flexible semi-structured data within TEXT columns
4. **Batch writes** - Wrap multiple inserts in a transaction for performance
5. **Use WAL mode** - `PRAGMA journal_mode=WAL;` for better concurrency

## Next Steps

- See [postgres](../postgres/) for PostgreSQL DDL generation
- See [duckdb](../duckdb/) for DuckDB DDL generation
- See [basic](../basic/) for basic schema definitions
- See [iceberg](../iceberg/) for Iceberg metadata export
