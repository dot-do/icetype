# IceType VS Code Extension

Syntax highlighting and language support for the [IceType](https://github.com/dot-do/icetype) schema language.

## Features

- Syntax highlighting for `.ice` and `.icetype` files
- Syntax highlighting for IceType schemas embedded in TypeScript/JavaScript
- Auto-closing brackets and quotes
- Code folding
- Comment toggling

### Highlighted Elements

| Element | Color | Example |
|---------|-------|---------|
| Primitive types | Blue | `uuid`, `string`, `int`, `boolean` |
| Field modifiers | Orange | `!` (required), `?` (optional), `#` (indexed) |
| Relations | Green | `->`, `<-`, `~>`, `<~` |
| Directives | Purple | `$type`, `$partitionBy`, `$index`, `$fts` |
| Entity types | Cyan | `User`, `Post`, `Organization` |

## Installation

### From VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "IceType"
4. Click Install

### From VSIX File

1. Download the `.vsix` file from the [releases page](https://github.com/dot-do/icetype/releases)
2. In VS Code, go to Extensions
3. Click the `...` menu and select "Install from VSIX..."
4. Select the downloaded file

### Development Installation

```bash
# Clone the repository
git clone https://github.com/dot-do/icetype.git
cd icetype/editors/vscode

# Install dependencies
npm install

# Package the extension
npm run package

# Install the generated .vsix file
code --install-extension icetype-vscode-*.vsix
```

## Usage

### Standalone `.ice` Files

Create a file with `.ice` or `.icetype` extension:

```icetype
// user.ice
{
  $type: 'User',
  $partitionBy: ['tenantId'],
  $index: [['email'], ['createdAt']],

  id: 'uuid!',
  email: 'string#',
  name: 'string!',
  age: 'int?',

  posts: '<- Post.author[]',
  org: '-> Organization?',
}
```

### Embedded in TypeScript

IceType schemas embedded in TypeScript files are also highlighted:

```typescript
import { parseSchema } from '@icetype/core';

const userSchema = parseSchema({
  $type: 'User',
  $partitionBy: ['tenantId'],

  id: 'uuid!',
  email: 'string#',
  posts: '<- Post.author[]',
});
```

## Syntax Reference

### Field Types

| Type | Description |
|------|-------------|
| `uuid` | UUID/GUID identifier |
| `string` | Variable-length text |
| `text` | Long-form text |
| `int`, `integer` | 32-bit integer |
| `bigint` | 64-bit integer |
| `float` | 32-bit floating point |
| `double` | 64-bit floating point |
| `decimal(p,s)` | Fixed precision decimal |
| `boolean`, `bool` | Boolean value |
| `date` | Date without time |
| `datetime`, `timestamp` | Date with time |
| `time` | Time without date |
| `json`, `jsonb` | JSON data |
| `binary`, `blob`, `bytes` | Binary data |
| `vector[n]` | Vector with n dimensions |
| `esm` | ECMAScript module string |

### Field Modifiers

| Modifier | Meaning |
|----------|---------|
| `!` | Required (not nullable) |
| `?` | Optional (nullable) |
| `#` | Indexed |
| `[]` | Array |

### Relations

| Relation | Meaning |
|----------|---------|
| `-> Entity` | Forward relation (belongs to) |
| `<- Entity.field[]` | Backward relation (has many) |
| `~> Entity[]` | Fuzzy/semantic relation |
| `<~ Entity[]` | Reverse fuzzy relation |

### Directives

| Directive | Purpose |
|-----------|---------|
| `$type` | Schema type name |
| `$partitionBy` | Partitioning columns |
| `$index` | Secondary indexes |
| `$fts` | Full-text search fields |
| `$vector` | Vector embedding field |
| `$unique` | Unique constraints |
| `$primaryKey` | Primary key columns |
| `$sortBy` | Sort order columns |

## Contributing

Contributions are welcome! Please see the [main repository](https://github.com/dot-do/icetype) for contribution guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
