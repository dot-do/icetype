# @icetype/cli

IceType CLI - schema management and code generation. This package provides command-line tools for working with IceType schemas, including validation, code generation, and database migrations.

## Installation

```bash
npm install @icetype/cli
# or
pnpm add @icetype/cli

# Or install globally
npm install -g @icetype/cli
```

## Usage

### Command Line

```bash
# Initialize a new IceType project
ice init

# Generate code from schemas
ice generate

# Validate schemas
ice validate ./schema.ts

# Export to PostgreSQL DDL
ice postgres ./schema.ts --output ./migrations

# Export to ClickHouse DDL
ice clickhouse ./schema.ts

# Export to DuckDB DDL
ice duckdb ./schema.ts

# Export to Iceberg metadata
ice iceberg ./schema.ts --location s3://bucket/warehouse

# Export to Prisma schema
ice prisma ./schema.ts --output ./prisma/schema.prisma

# Export to Drizzle schema
ice drizzle ./schema.ts --output ./drizzle/schema.ts

# Import from Prisma
ice prisma:import ./prisma/schema.prisma

# Import from Drizzle
ice drizzle:import ./drizzle/schema.ts
```

### Programmatic API

```typescript
import {
  generate,
  validate,
  loadAllSchemas,
  postgresExport,
  drizzleExport,
  prismaImport,
} from '@icetype/cli';

// Load and validate schemas
const schemas = await loadAllSchemas('./schemas');
const validation = await validate('./schemas');

// Generate TypeScript interfaces
await generate({
  input: './schema.ts',
  output: './generated',
  format: 'typescript',
});

// Export to PostgreSQL
const ddl = await postgresExport('./schema.ts', {
  schema: 'public',
  ifNotExists: true,
});
```

## API

### Commands

| Export | Description |
|--------|-------------|
| `init()` | Initialize a new IceType project |
| `generate(options)` | Generate code from schemas |
| `validate(path)` | Validate schema files |
| `postgresExport(input, options)` | Export to PostgreSQL DDL |
| `clickhouseExport(input, options)` | Export to ClickHouse DDL |
| `duckdbExport(input, options)` | Export to DuckDB DDL |
| `icebergExport(input, options)` | Export to Iceberg metadata |
| `prismaExport(input, options)` | Export to Prisma schema |
| `prismaImport(input)` | Import from Prisma schema |
| `drizzleExport(input, options)` | Export to Drizzle schema |
| `drizzleImport(input)` | Import from Drizzle schema |

### Schema Loader

| Export | Description |
|--------|-------------|
| `loadSchemaFile(path)` | Load a single schema file |
| `loadAllSchemas(dir)` | Load all schemas from a directory |
| `loadSingleSchema(path)` | Load and parse a single schema |

### Utilities

| Export | Description |
|--------|-------------|
| `createLogger(options)` | Create a logger instance |
| `createWatcher(options)` | Create a file watcher for development |
| `watchGenerate(options)` | Watch files and regenerate on changes |
| `initializeAdapterRegistry()` | Initialize the global adapter registry |

### Configuration

| Export | Description |
|--------|-------------|
| `defineConfig(config)` | Define an IceType configuration |
| `loadConfig(path)` | Load configuration from file |
| `resolveConfig(config)` | Resolve and validate configuration |

## Examples

### Generate TypeScript Types

```typescript
import { generate, loadAllSchemas } from '@icetype/cli';

// Load schemas
const schemas = await loadAllSchemas('./schemas');

// Generate TypeScript interfaces
await generate({
  input: './schemas',
  output: './generated/types.ts',
  format: 'typescript',
});
```

### Export to Multiple Databases

```typescript
import {
  postgresExport,
  mysqlExport,
  sqliteExport,
} from '@icetype/cli';

const schemaPath = './schema.ts';

// Generate DDL for each database
const pgDDL = await postgresExport(schemaPath, { schema: 'public' });
const mysqlDDL = await mysqlExport(schemaPath, { charset: 'utf8mb4' });
const sqliteDDL = await sqliteExport(schemaPath, { strict: true });
```

### Watch Mode for Development

```typescript
import { watchGenerate, createLogger } from '@icetype/cli';

const logger = createLogger({ level: 'info' });

await watchGenerate({
  input: './schemas',
  output: './generated',
  format: 'typescript',
  logger,
  onChange: (files) => {
    logger.info(`Changed: ${files.join(', ')}`);
  },
});
```

### Configuration File (icetype.config.ts)

```typescript
import { defineConfig } from '@icetype/cli';

export default defineConfig({
  schemas: './schemas/**/*.ts',
  output: {
    types: './generated/types.ts',
    postgres: './migrations/postgres.sql',
    drizzle: './drizzle/schema.ts',
  },
  adapters: {
    postgres: {
      schema: 'public',
      ifNotExists: true,
    },
    drizzle: {
      dialect: 'pg',
    },
  },
  watch: {
    enabled: true,
    debounce: 100,
  },
});
```

### Import and Convert Schemas

```typescript
import { prismaImport, drizzleImport } from '@icetype/cli';

// Import from Prisma
const iceTypeSchemas = await prismaImport('./prisma/schema.prisma');
console.log(iceTypeSchemas);
// [{ $type: 'User', id: 'uuid!', email: 'string!#', ... }]

// Import from Drizzle
const schemas = await drizzleImport('./drizzle/schema.ts');
```

## Security

The IceType CLI implements comprehensive input sanitization to protect against common security vulnerabilities. All file paths provided to CLI commands are validated before use.

### Input Sanitization

The `@icetype/cli` package includes a path sanitization module (`path-sanitizer.ts`) that validates all user-provided file paths. The following security controls are implemented:

#### Path Traversal Prevention (CWE-22)

- Path traversal sequences (`../`, `..\\`) are rejected
- URL-encoded traversal (`%2e%2e`) is detected and blocked
- Unicode variants of dots (e.g., full-width period `\uFF0E`) are normalized
- Paths are validated to remain within the project directory after normalization

#### Symlink Safety (CWE-59)

- Symbolic links are resolved using `realpathSync()` before access
- The resolved path must be within the project directory
- Both input and output paths undergo symlink validation

#### Command Injection Prevention (CWE-78)

- Dangerous shell characters are rejected: `;`, `|`, `&`, `$`, `` ` ``, `<`, `>`, `(`, `)`, `!`, `{`, `}`, `[`, `]`, `#`
- Command substitution patterns (`$(...)` and backticks) are explicitly blocked
- Null byte injection (`\x00`) is detected and rejected
- Windows UNC paths (`\\server\share`) are not allowed

#### Extension Validation (CWE-434)

Schema files must have one of these extensions:
- `.ts`, `.js`, `.mjs`, `.json`

Output files must have one of these extensions:
- `.ts`, `.d.ts`, `.js`

Migration outputs must have one of these extensions:
- `.sql`, `.json`, `.ts`, `.js`

Dangerous extensions are explicitly blocked:
- `.sh`, `.bash`, `.exe`, `.bat`, `.cmd`, `.php`, `.py`, `.rb`, etc.

Double extensions with dangerous intermediate extensions (e.g., `schema.sh.ts`) are rejected.

#### Resource Limits (CWE-400)

- Maximum path length: 4096 characters
- Empty paths are rejected

### Commands with Path Validation

| Command | Validated Paths |
|---------|-----------------|
| `ice generate` | `--schema`, `--output` |
| `ice validate` | `--schema` |
| `ice init` | `--dir` |
| `ice migrate` | `--schema`, `--output`, `--old`, `--new` |

### API Functions

The path sanitization utilities are available for programmatic use:

```typescript
import {
  sanitizePath,
  validateSchemaPath,
  validateOutputPath,
  validateDirectoryPath,
  validateMigrationOutputPath,
  isWithinProjectDirectory,
  checkSymlinkSafety,
  PathSecurityError,
} from '@icetype/cli/utils/path-sanitizer';

// Sanitize a path (throws PathSecurityError on invalid input)
const safePath = sanitizePath(userInput);

// Validate a schema file path
validateSchemaPath('./schema.ts'); // throws if invalid

// Check if a path is within project bounds
const isValid = isWithinProjectDirectory('./src/schema.ts');

// Validate symlink safety
checkSymlinkSafety('./linked-schema.ts'); // throws if symlink escapes project
```

### Test Mode

For testing purposes, strict path validation (project boundary and symlink checks) can be disabled:

```bash
ICETYPE_SKIP_PATH_SECURITY=1
```

**Warning**: This environment variable should NEVER be set in production. It is intended solely for unit tests that use mock paths.

### Error Codes

When path validation fails, a `PathSecurityError` is thrown with one of these codes:

| Code | Description |
|------|-------------|
| `EMPTY_PATH` | Path is empty or whitespace only |
| `PATH_TOO_LONG` | Path exceeds 4096 characters |
| `NULL_BYTE` | Path contains null byte injection |
| `SHELL_CHARS` | Path contains dangerous shell characters |
| `COMMAND_SUBSTITUTION` | Path contains command substitution patterns |
| `UNC_PATH` | Path is a Windows UNC/network path |
| `ENCODED_TRAVERSAL` | Path contains URL-encoded traversal |
| `PATH_TRAVERSAL` | Path contains `..` traversal sequences |
| `INVALID_PATH` | Path is invalid (e.g., only dots) |
| `OUTSIDE_PROJECT` | Path resolves outside project directory |
| `SYMLINK_ESCAPE` | Symlink resolves outside project directory |
| `INVALID_EXTENSION` | File has an invalid or dangerous extension |

### Limitations

1. **Project Root Detection**: The project root defaults to `process.cwd()`. Custom project roots can be passed to validation functions.

2. **Race Conditions**: Symlink checks are point-in-time. A TOCTOU (time-of-check-time-of-use) vulnerability could exist if symlinks are modified between validation and use.

3. **Glob Patterns**: The `*` and `?` characters are allowed in paths for glob pattern support. This is intentional for schema discovery patterns like `./schemas/*.ts`.

For more details, see the project's [Security Policy](/SECURITY.md).

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs/cli).

## Related Packages

- [`icetype`](../icetype) - Main entry point
- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter
- [`@icetype/prisma`](../prisma) - Prisma adapter

## License

MIT
