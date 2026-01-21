# IceType Benchmarks

Performance benchmarks for IceType schema parsing and generation operations using Vitest bench mode.

## Running Benchmarks

```bash
# From root
pnpm bench

# Run with JSON output
pnpm bench:json

# From benchmarks package
pnpm --filter @icetype/benchmarks bench

# Watch mode (re-run on changes)
pnpm --filter @icetype/benchmarks bench:watch

# Verbose output
pnpm --filter @icetype/benchmarks bench:verbose
```

## Benchmark Results

Last run: 2025-01-21

### Parser Benchmarks

| Benchmark | Hz (ops/sec) | Mean | p99 |
|-----------|--------------|------|-----|
| tokenize schema definition | 665,536 | 0.0015ms | 0.0020ms |
| parse simple schema (10 fields) | 373,174 | 0.0027ms | 0.0034ms |
| parse complex schema (20 fields) | 101,972 | 0.0098ms | 0.0120ms |
| parse simple schema (50 fields) | 53,973 | 0.0185ms | 0.0228ms |
| parse complex schema (50 fields) | 42,114 | 0.0237ms | 0.0370ms |

### Large Schema Benchmarks

| Benchmark | Hz (ops/sec) | Mean | p99 |
|-----------|--------------|------|-----|
| parse 100 entities (20 fields each) | 977 | 1.02ms | 1.99ms |
| parse 1000 entities (10 fields each) | 263 | 3.81ms | 4.09ms |

### Generation Benchmarks

| Benchmark | Hz (ops/sec) | Mean | p99 |
|-----------|--------------|------|-----|
| SQLite DDL (20 fields) | 144,188 | 0.0069ms | 0.0085ms |
| PostgreSQL DDL (20 fields) | 129,034 | 0.0077ms | 0.0105ms |
| MySQL DDL (20 fields) | 124,590 | 0.0080ms | 0.0101ms |
| PostgreSQL DDL (50 fields) | 62,476 | 0.0160ms | 0.0207ms |
| PostgreSQL DDL (100 fields) | 33,263 | 0.0301ms | 0.0501ms |

### Diff Benchmarks

| Benchmark | Hz (ops/sec) | Mean | p99 |
|-----------|--------------|------|-----|
| diffSchemas (20 fields) | 536,839 | 0.0019ms | 0.0032ms |
| diffSchemas (100 fields) | 114,864 | 0.0087ms | 0.0193ms |

### Batch Benchmarks

| Benchmark | Hz (ops/sec) | Mean | p99 |
|-----------|--------------|------|-----|
| batch SQLite DDL (100 schemas) | 1,443 | 0.69ms | 0.92ms |
| batch PostgreSQL DDL (100 schemas) | 1,304 | 0.77ms | 1.00ms |
| batch MySQL DDL (100 schemas) | 1,251 | 0.80ms | 1.04ms |

## Key Findings

1. **Tokenization is fastest** - Raw tokenization runs at ~666k ops/sec
2. **SQLite adapter is fastest** - 12-15% faster than PostgreSQL/MySQL
3. **Schema diffing is efficient** - 537k ops/sec for small schemas
4. **Large batches perform well** - 100 schemas in <1ms

## Benchmark Files

- `src/parser.bench.ts` - Schema parsing performance tests
- `src/generation.bench.ts` - DDL generation and diffing tests

## Output Formats

Benchmark results can be output in JSON format for CI/CD integration:

```bash
pnpm bench:json
```

This outputs `benchmark-results.json` which can be used for:
- Performance regression detection
- Historical tracking
- CI pipeline integration

## CI Integration

Benchmarks run automatically via GitHub Actions on:
- Every push to `main`
- Every pull request targeting `main`
- Manual workflow dispatch

### Workflow Features

The CI workflow (`.github/workflows/benchmarks.yml`) provides:

1. **Automatic benchmark execution** - Runs all benchmarks on every PR and push
2. **Baseline comparison** - Compares PR benchmarks against the `main` branch baseline
3. **Regression detection** - Fails the CI if performance regresses beyond threshold (default: 20%)
4. **PR comments** - Posts benchmark comparison results as PR comments
5. **Artifact storage** - Stores benchmark results for 30 days

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `REGRESSION_THRESHOLD` | 20 | Percentage threshold for regression detection |
| `retention-days` | 30 | How long benchmark artifacts are stored |

### Manual Trigger

You can manually trigger benchmarks from the GitHub Actions UI:

1. Go to Actions > Benchmarks
2. Click "Run workflow"
3. Optionally enable/disable baseline comparison

### Interpreting Results

In PR comments, benchmarks are marked as:
- **stable** - Within threshold (no significant change)
- **improvement** - Performance improved by more than threshold
- **regression** - Performance degraded by more than threshold (fails CI)

### Disabling Regression Checks

For PRs that intentionally trade performance for other benefits, add `[skip-bench-check]` to your PR description, or adjust the threshold via workflow dispatch.

## Configuration

Benchmarks are configured in `vitest.config.ts`:

```typescript
{
  benchmark: {
    include: ['src/**/*.bench.ts'],
    reporters: ['default', 'json'],
    outputFile: {
      json: './benchmark-results.json',
    },
  },
}
```
