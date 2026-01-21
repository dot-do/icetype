# @icetype/migrations

Migration generation and management infrastructure for IceType schemas. This package provides tools for generating SQL migration statements from schema changes and managing migration history.

## Installation

```bash
npm install @icetype/migrations
# or
pnpm add @icetype/migrations
```

## Usage

```typescript
import {
  generateMigration,
  createMigrationRunner,
  createMigrationHistory,
  InMemoryHistoryStorage,
} from '@icetype/migrations';
import { diffSchemas, parseSchema } from '@icetype/core';

// Define old and new schemas
const oldSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string!',
});

const newSchema = parseSchema({
  $type: 'User',
  id: 'uuid!',
  name: 'string!',
  email: 'string!',
  createdAt: 'timestamp!',
});

// Generate schema diff
const diff = diffSchemas(oldSchema, newSchema);

// Generate SQL migration statements
const statements = generateMigration(diff, 'postgres');
console.log(statements);
// ['ALTER TABLE "User" ADD COLUMN "email" TEXT NOT NULL;',
//  'ALTER TABLE "User" ADD COLUMN "createdAt" TIMESTAMP NOT NULL;']
```

## API

### Generator Functions

| Export | Description |
|--------|-------------|
| `createMigrationGenerator(dialect)` | Create a migration generator for a specific dialect |
| `generateMigration(diff, dialect, options)` | Generate SQL statements from a schema diff |

### Runner Functions

| Export | Description |
|--------|-------------|
| `createMigrationRunner(executor)` | Create a migration runner with a database executor |
| `MigrationError` | Error class for migration failures |

### History Functions

| Export | Description |
|--------|-------------|
| `createMigrationHistory(storage)` | Create a migration history tracker |
| `InMemoryHistoryStorage` | In-memory storage for testing |

### Types

| Type | Description |
|------|-------------|
| `Dialect` | Supported SQL dialects: 'sqlite', 'postgres', 'mysql', 'duckdb' |
| `MigrationGenerator` | Interface for migration generators |
| `MigrationRunner` | Interface for migration runners |
| `MigrationHistory` | Interface for history management |
| `MigrationResult` | Result of running a migration |
| `MigrationRecord` | Record of an applied migration |

## Examples

### Generate Migrations for Different Dialects

```typescript
import { generateMigration } from '@icetype/migrations';
import { diffSchemas, parseSchema } from '@icetype/core';

const diff = diffSchemas(oldSchema, newSchema);

// Generate for different databases
const pgStatements = generateMigration(diff, 'postgres');
const mysqlStatements = generateMigration(diff, 'mysql');
const sqliteStatements = generateMigration(diff, 'sqlite');
const duckdbStatements = generateMigration(diff, 'duckdb');
```

### Execute Migrations with Runner

```typescript
import { createMigrationRunner, MigrationError } from '@icetype/migrations';

// Create a database executor
const executor = {
  async execute(sql: string): Promise<void> {
    await db.query(sql);
  },
  async executeInTransaction(statements: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const sql of statements) {
        await tx.query(sql);
      }
    });
  },
};

// Create the runner
const runner = createMigrationRunner(executor);

// Run migration
try {
  const result = await runner.run(migration, statements);
  console.log(`Applied ${result.statementsExecuted} statements`);
} catch (error) {
  if (error instanceof MigrationError) {
    console.error(`Migration failed at statement: ${error.failedStatement}`);
  }
}
```

### Track Migration History

```typescript
import {
  createMigrationHistory,
  InMemoryHistoryStorage,
} from '@icetype/migrations';

// Create history tracker (use database storage in production)
const storage = new InMemoryHistoryStorage();
const history = createMigrationHistory(storage);

// Record a completed migration
await history.record({
  id: 'migration-001',
  version: '1.0.0',
  appliedAt: new Date(),
  statements: ['ALTER TABLE ...'],
  checksum: 'abc123',
});

// Get applied migrations
const applied = await history.getApplied();

// Get pending migrations
const allMigrations = [migration1, migration2, migration3];
const pending = await history.getPending(allMigrations);

// Check if a specific migration was applied
const wasApplied = await history.isApplied('migration-001');
```

### Batch Migrations

```typescript
import { createMigrationRunner } from '@icetype/migrations';

const runner = createMigrationRunner(executor);

// Run multiple migrations in sequence
const migrations = [
  { id: '001', statements: ['CREATE TABLE ...'] },
  { id: '002', statements: ['ALTER TABLE ...'] },
  { id: '003', statements: ['CREATE INDEX ...'] },
];

const batchResult = await runner.runBatch(migrations);
console.log(`Applied ${batchResult.successful} migrations`);
console.log(`Failed: ${batchResult.failed}`);
```

### Rollback Support

```typescript
import { createMigrationHistory } from '@icetype/migrations';

const history = createMigrationHistory(storage);

// Record rollback
await history.recordRollback('migration-001', {
  rolledBackAt: new Date(),
  reason: 'Schema incompatibility',
});

// Get rollback history
const rollbacks = await history.getRollbacks('migration-001');
```

### Custom Migration Generator

```typescript
import { createMigrationGenerator, Dialect } from '@icetype/migrations';

const generator = createMigrationGenerator('postgres');

// Generate migration from a single operation
const addColumnSQL = generator.addColumn({
  table: 'User',
  column: 'email',
  type: 'TEXT',
  nullable: false,
  default: null,
});

// Generate migration from drop operation
const dropColumnSQL = generator.dropColumn({
  table: 'User',
  column: 'legacyField',
});

// Generate index creation
const indexSQL = generator.createIndex({
  table: 'User',
  columns: ['email'],
  unique: true,
});
```

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/migrations).

## Related Packages

- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter with migrations
- [`@icetype/mysql`](../mysql) - MySQL adapter with migrations
- [`@icetype/sqlite`](../sqlite) - SQLite adapter with migrations

## License

MIT
