# Changelog

All notable changes to the IceType VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-21

### Added

#### Syntax Highlighting
- Full syntax highlighting for standalone `.ice` and `.icetype` files
- Injection grammar for IceType schemas embedded in TypeScript/JavaScript files
- Support for all IceType primitive types: `uuid`, `string`, `text`, `int`, `bigint`, `float`, `double`, `decimal`, `boolean`, `date`, `datetime`, `timestamp`, `time`, `json`, `binary`, `vector`, `esm`
- Highlighting for field modifiers: `!` (required), `?` (optional), `#` (indexed)
- Relation operator highlighting: `->` (forward), `<-` (backward), `~>` (fuzzy), `<~` (reverse fuzzy), `<->` (bidirectional)
- Schema directive highlighting: `$type`, `$partitionBy`, `$index`, `$fts`, `$vector`, `$unique`, `$primaryKey`, `$sortBy`, and more
- Entity type references (PascalCase identifiers)
- AI generation directives (`text ~> sourceField`, `vector[1536] ~> text`)
- Vector type with dimensions (`vector[1536]`)
- Decimal type with precision (`decimal(10,2)`)

#### Snippets
- `ice-schema` - Complete schema with DB() wrapper
- `ice-entity` - New entity definition
- `ice-field` - String field with modifiers
- `ice-number` - Numeric field types
- `ice-boolean` - Boolean field
- `ice-date` - Date/time field types
- `ice-uuid` - UUID field
- `ice-json` - JSON field
- `ice-relation` - Forward relation (belongs to)
- `ice-has-many` - Backward relation (has many)
- `ice-fuzzy` - Fuzzy/semantic relation
- `ice-vector` - Vector embedding field
- `ice-generate` - AI-generated field
- `ice-code` - ESM code field
- `ice-partition` - Partition directive
- `ice-index` - Index directive
- `ice-fts` - Full-text search directive
- `ice-user` - User entity template
- `ice-post` - Post entity template
- `ice-org` - Organization entity template

#### Color Themes
- **IceType Dark** - Dark theme optimized for IceType schema readability
- **IceType Light** - Light theme with high contrast for schema elements

#### Language Configuration
- Auto-closing brackets and quotes
- Code folding for blocks
- Comment toggling (single-line and block comments)
- Word pattern matching for IceType identifiers

#### Autocomplete (IntelliSense)
- Completions for all primitive types with documentation
- Field modifier completions (`!`, `?`, `#index`, `#unique`, `#fts`, `#sparse`)
- Directive completions (`$type`, `$partitionBy`, `$index`, `$fts`, `$vector`, etc.)
- Relation operator completions (`->`, `<-`, `~>`, `<~`, `<->`)
- Context-aware completions based on cursor position
- Snippet support for complex types (`vector[1536]`, `decimal(10,2)`, `enum()`)
- Works in both standalone IceType files and embedded schemas in TypeScript/JavaScript

#### Editor Features
- Status bar indicator when editing IceType files
- Semantic token support for enhanced theming
- Default editor configuration for IceType files (2-space indentation, format on save)

### Technical Details

- Minimum VS Code version: 1.75.0
- TextMate grammar for syntax highlighting
- Injection grammar for TypeScript/JavaScript embedding
- TypeScript-based extension activation

---

## Future Releases

Planned features for upcoming versions:

- Language Server Protocol (LSP) support
- Enhanced autocomplete with entity name suggestions
- Schema validation and diagnostics
- Go to definition for entity references
- Hover information for types and fields
- Code actions and quick fixes
- Formatting support
