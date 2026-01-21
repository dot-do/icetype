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
export { prismaExport } from './commands/prisma.js';
export {
  prismaImport,
  formatAsTypeScript as formatPrismaAsTypeScript,
  formatAsJson as formatPrismaAsJson,
  formatSchemas as formatPrismaSchemas,
} from './commands/prisma-import.js';
export { drizzleExport } from './commands/drizzle.js';
export {
  drizzleImport,
  fieldToIceTypeString,
  generateTypeScriptOutput as generateDrizzleTypeScriptOutput,
  generateJsonOutput as generateDrizzleJsonOutput,
  generateOutput as generateDrizzleOutput,
  type DrizzleImportFormat,
  type DrizzleImportCommandOptions,
} from './commands/drizzle-import.js';

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

// Adapter registry utilities
export {
  initializeAdapterRegistry,
  getAdapter,
  hasAdapter,
  listAdapters,
  resetAdapterRegistry,
  globalRegistry,
} from './utils/adapter-registry.js';

// Help utilities
export {
  generateHelpText,
  hasHelpFlag,
  showHelpIfRequested,
  type HelpCommand,
  type HelpOption,
} from './utils/help.js';

// Config utilities
export {
  defineConfig,
  loadConfig,
  findConfigFile,
  mergeConfig,
  validateConfig,
  validateConfigExport,
  resolveConfig,
  resolveFullConfig,
  type IceTypeConfig,
  type IceTypeConfigFn,
  type IceTypeConfigExport,
  type OutputConfig,
  type AdaptersConfig,
  type DuckDBAdapterConfig,
  type PostgresAdapterConfig,
  type ClickHouseAdapterConfig,
  type IcebergAdapterConfig,
  type WatchConfig,
  type ValidationResult,
  type LoadConfigResult,
  type LoadConfigOptions,
  type ResolveConfigOptions,
} from './utils/config.js';
