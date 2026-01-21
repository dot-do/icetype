/**
 * Performance Benchmark Targets for IceType
 *
 * This file defines the performance targets that IceType operations
 * should meet. These targets are used in benchmark tests to ensure
 * performance doesn't regress.
 *
 * @packageDocumentation
 */

// =============================================================================
// Parser Performance Targets
// =============================================================================

export const PARSER_TARGETS = {
  /** Maximum time (ms) to parse a simple 10-field schema */
  simpleSchema10Fields: 1,

  /** Maximum time (ms) to parse a complex 50-field schema */
  complexSchema50Fields: 5,

  /** Maximum time (ms) to parse 100 entities (20 fields each) */
  batch100Entities: 100,

  /** Maximum time (ms) to parse 1000 entities (20 fields each) */
  batch1000Entities: 1000,

  /** Maximum average time (ms) per entity when batch parsing */
  perEntityAverage: 1,

  /** Maximum time (ms) to tokenize 1000 characters */
  tokenize1000Chars: 1,

  /** Maximum memory (bytes) per entity for large schemas */
  memoryPerEntity: 10 * 1024, // 10KB
} as const;

// =============================================================================
// SQL Generation Performance Targets
// =============================================================================

export const GENERATION_TARGETS = {
  /** Maximum time (ms) to generate DDL for 20-field schema */
  ddl20Fields: 5,

  /** Maximum time (ms) to generate DDL for 100-field schema */
  ddl100Fields: 10,

  /** Maximum time (ms) to generate DDL for 100 schemas (20 fields each) */
  batch100Schemas: 500,

  /** Maximum time (ms) for full pipeline (parse + generate) for 30-field schema */
  fullPipeline30Fields: 10,

  /** Maximum time (ms) for 3-dialect generation (PostgreSQL, MySQL, SQLite) */
  threeDialects30Fields: 15,

  /** Maximum time (ms) for 100 schemas through full pipeline */
  fullPipeline100Schemas: 1000,
} as const;

// =============================================================================
// Diff Computation Performance Targets
// =============================================================================

export const DIFF_TARGETS = {
  /** Maximum time (ms) to compute diff for 20-field schemas */
  diff20Fields: 5,

  /** Maximum time (ms) to compute diff for 100-field schemas */
  diff100Fields: 10,

  /** Maximum time (ms) to compute diff for 100 schema pairs */
  batch100Pairs: 500,

  /** Maximum time (ms) for high-churn schema (50% changes) */
  highChurn100Fields: 10,
} as const;

// =============================================================================
// Memory Targets
// =============================================================================

export const MEMORY_TARGETS = {
  /** Maximum memory per entity (bytes) */
  perEntity: 10 * 1024, // 10KB

  /** Memory growth should be linear within this tolerance (%) */
  linearGrowthTolerance: 20,
} as const;

// =============================================================================
// Aggregate Targets
// =============================================================================

export const BENCHMARK_TARGETS = {
  parser: PARSER_TARGETS,
  generation: GENERATION_TARGETS,
  diff: DIFF_TARGETS,
  memory: MEMORY_TARGETS,
} as const;

export type BenchmarkTargets = typeof BENCHMARK_TARGETS;
