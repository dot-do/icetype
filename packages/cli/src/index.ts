/**
 * @icetype/cli
 *
 * IceType CLI - schema management and code generation.
 *
 * @packageDocumentation
 */

export { init } from './commands/init.js';
export {
  generate,
  generateTypeScriptInterface,
  runGeneration,
  type GenerateOptions,
} from './commands/generate.js';
export { validate } from './commands/validate.js';
export { clickhouseExport } from './commands/clickhouse.js';
export { duckdbExport } from './commands/duckdb.js';
export { icebergExport } from './commands/iceberg.js';
export {
  postgresExport,
  generatePostgresDDL,
  generatePostgresDDLForAllSchemas,
  type PostgresDDLOptions,
} from './commands/postgres.js';

// Schema loader utilities
export {
  loadSchemaFile,
  loadSingleSchema,
  loadAllSchemas,
  type LoadedSchema,
  type LoadResult,
} from './utils/schema-loader.js';

// Logger utilities
export {
  createLogger,
  LogLevel,
  type Logger,
  type LoggerOptions,
} from './utils/logger.js';

// Watcher utilities
export {
  createWatcher,
  watchGenerate,
  type WatcherOptions,
  type WatchGenerateOptions,
} from './utils/watcher.js';
