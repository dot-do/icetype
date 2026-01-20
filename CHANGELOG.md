# Changelog

## [0.1.0] - 2026-01-20

### Added
- Initial release of IceType - a type-safe schema language for data lakes and databases

**Core Packages:**
- @icetype/core: Schema parser, validation, type inference, standardized error handling
- @icetype/iceberg: Iceberg metadata and Parquet schema generation
- @icetype/cli: CLI tools (init, generate, validate, iceberg export)
- @icetype/adapters: Adapter abstraction layer with registry

**Database Adapters:**
- @icetype/clickhouse: ClickHouse DDL generation with MergeTree engine support
- @icetype/duckdb: DuckDB DDL generation with constraint support

**Documentation & Examples:**
- Comprehensive documentation site (Fumadocs)
- Examples for basic usage, Iceberg, ClickHouse, and DuckDB

**Test Coverage:**
- 761+ tests across all packages
- Integration tests for full pipeline verification
