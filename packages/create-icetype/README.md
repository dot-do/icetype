# create-icetype

Scaffold new IceType projects with best-practice configuration. This CLI tool creates fully-configured TypeScript projects with IceType schema definitions and your choice of database adapter.

## Installation

You do not need to install this package directly. Use `npx` to run it:

```bash
npx create-icetype my-app
# or
pnpm create icetype my-app
```

## Usage

```bash
# Create a basic project with SQLite
npx create-icetype my-app

# Create a project with PostgreSQL adapter
npx create-icetype my-app --template with-postgres

# Create a project with Drizzle ORM integration
npx create-icetype my-app --template with-drizzle

# Create a project with ClickHouse for analytics
npx create-icetype my-app --template with-clickhouse

# Create a project with Apache Iceberg for data lakes
npx create-icetype my-app --template with-iceberg
```

### Command Line Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--template <name>` | `-t` | Project template to use (default: basic) |
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show version number |

## API

For programmatic usage, you can import the package:

### Main Exports

| Export | Description |
|--------|-------------|
| `createProject(options)` | Create a new project programmatically |
| `promptForOptions(partial)` | Get options with defaults for missing values |
| `main(args)` | CLI entry point |
| `enableColors(enabled)` | Enable/disable colored output |

### Types

| Type | Description |
|------|-------------|
| `CreateOptions` | Options for project creation |
| `GeneratorResult` | Result of project generation |

### CreateOptions

```typescript
interface CreateOptions {
  projectName: string;
  template: 'basic' | 'with-postgres' | 'with-drizzle' | 'with-clickhouse' | 'with-iceberg';
  interactive?: boolean;
}
```

### GeneratorResult

```typescript
interface GeneratorResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  error?: string;
  warnings?: string[];
}
```

## Templates

### basic

Minimal IceType setup with SQLite for local development.

**Includes:**
- `@icetype/core` - Core schema parser
- `@icetype/sqlite` - SQLite adapter
- TypeScript configuration
- Basic blog schema example

### with-postgres

IceType with PostgreSQL adapter for production databases.

**Includes:**
- `@icetype/core` - Core schema parser
- `@icetype/postgres` - PostgreSQL DDL generation
- E-commerce schema example (Users, Products, Orders)
- Migration scripts (`npm run db:migrate`)

### with-drizzle

IceType with Drizzle ORM integration for type-safe SQL queries.

**Includes:**
- `@icetype/core` - Core schema parser
- `@icetype/drizzle` - Drizzle schema generation
- `drizzle-orm` and `drizzle-kit`
- CMS schema example (Users, Posts, Categories)
- Drizzle Studio (`npm run db:studio`)

### with-clickhouse

IceType with ClickHouse for real-time analytics.

**Includes:**
- `@icetype/core` - Core schema parser
- `@icetype/clickhouse` - ClickHouse DDL generation
- `@clickhouse/client` - Official ClickHouse client
- Analytics schema example (Events, PageViews, Sessions)
- Pre-built analytics queries

### with-iceberg

IceType with Apache Iceberg for data lake management.

**Includes:**
- `@icetype/core` - Core schema parser
- `@icetype/iceberg` - Iceberg metadata generation
- Data lake schema example (Bronze/Silver/Gold layers)
- Time-travel query examples

## Examples

### Programmatic Usage

```typescript
import { createProject } from 'create-icetype';

const result = await createProject({
  projectName: 'my-analytics-app',
  template: 'with-clickhouse',
});

if (result.success) {
  console.log(`Created project at ${result.projectPath}`);
  console.log('Files created:', result.filesCreated);
} else {
  console.error('Error:', result.error);
}
```

### With Custom Options

```typescript
import { createProject, promptForOptions } from 'create-icetype';

// Get options with defaults
const options = await promptForOptions({
  projectName: 'my-app',
  // template will default to 'basic'
});

const result = await createProject(options);
```

### Disable Colors (for CI)

```typescript
import { enableColors, main } from 'create-icetype';

// Disable ANSI colors for CI environments
enableColors(false);

await main(['my-app', '--template', 'with-postgres']);
```

## Project Structure

After running `create-icetype`, you will have:

```
my-app/
  package.json      # Dependencies and scripts
  tsconfig.json     # TypeScript configuration
  schema.ts         # IceType schema definitions
  .gitignore        # Git ignore rules
  .env.example      # Environment variables template (database templates)
  .editorconfig     # Editor configuration
  .prettierrc       # Prettier configuration
  .prettierignore   # Prettier ignore rules
  README.md         # Project documentation
```

## Generated Schema

Each template includes a comprehensive schema example:

```typescript
import { DB } from '@icetype/core'

export const db = DB({
  User: {
    id: 'string! #unique',
    email: 'string! #unique #index',
    name: 'string!',
    posts: '[Post] -> author',
  },
  Post: {
    id: 'string! #unique',
    title: 'string!',
    content: 'text!',
    author: 'User! <- posts',
  },
})
```

## Documentation

For full documentation, visit the [IceType Documentation](https://icetype.dev/docs).

## Related Packages

- [`icetype`](../icetype) - Main IceType package
- [`@icetype/core`](../core) - Core parser and types
- [`@icetype/postgres`](../postgres) - PostgreSQL adapter
- [`@icetype/drizzle`](../drizzle) - Drizzle ORM adapter
- [`@icetype/clickhouse`](../clickhouse) - ClickHouse adapter
- [`@icetype/iceberg`](../iceberg) - Apache Iceberg adapter

## License

MIT
