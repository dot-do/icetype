# IceType Development Guide

## Project Overview

IceType is a type-safe, concise schema language that compiles to multiple backends including Apache Iceberg, Parquet, ClickHouse, DuckDB, and more.

## Package Structure

```
packages/
├── icetype/       # Main entry: re-exports CLI + core
├── cli/           # @icetype/cli - CLI tools
├── core/          # @icetype/core - Parser, types, validation
└── iceberg/       # @icetype/iceberg - Iceberg metadata & Parquet schema gen
```

## IceType Schema Syntax

```typescript
import { parseSchema } from '@icetype/core';

const userSchema = parseSchema({
  $type: 'User',
  $partitionBy: ['tenantId'],
  $index: [['email'], ['createdAt']],

  // Field modifiers
  id: 'uuid!',           // ! = required/unique
  email: 'string#',      // # = indexed
  age: 'int?',           // ? = optional
  tags: 'string[]',      // [] = array

  // Relations
  posts: '<- Post.author[]',    // backward relation
  org: '-> Organization?',      // forward relation
  similar: '~> User[]',         // fuzzy/semantic relation
});
```

## Beads Issue Tracking

This project uses **Beads** for issue tracking. Issues are stored in `.beads/` and synced via git.

### Hierarchical IDs

Beads supports hierarchical IDs for organizing epics and their children:

```
icetype-a3f8        (Epic: CLI Improvements)
icetype-a3f8.1      (Task: Schema file loading)
icetype-a3f8.1.1    (Sub-task: TypeScript loader)
icetype-a3f8.1.2    (Sub-task: JSON loader)
icetype-a3f8.2      (Task: Add tests)
```

### Creating Issues

```bash
# Create epic
bd create --title="Epic: Feature Name" --type=feature --priority=0

# Create child task (hierarchical)
bd create --title="Implement X" --type=task --priority=1 --parent=icetype-a3f8

# Create sub-task
bd create --title="Sub-task Y" --type=task --parent=icetype-a3f8.1
```

### Managing Work

```bash
bd ready           # Show available work
bd list            # All issues
bd show <id>       # Issue details
bd update <id> --status=in_progress
bd close <id>      # Complete issue
bd sync            # Sync with git
```

## Development Workflow

### Building

```bash
pnpm install
pnpm build
pnpm test
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @icetype/core test
```

### CLI Commands

```bash
ice init                    # Initialize icetype project
ice generate                # Generate TypeScript types from schema
ice validate                # Validate schema syntax
ice iceberg export          # Export to Iceberg format
```

## Session Close Protocol

Before saying "done" or "complete":

```
[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. bd sync                 (commit beads changes)
[ ] 4. git commit -m "..."     (commit code)
[ ] 5. bd sync                 (commit any new beads changes)
[ ] 6. git push                (push to remote)
```

**NEVER skip this.** Work is not done until pushed.
