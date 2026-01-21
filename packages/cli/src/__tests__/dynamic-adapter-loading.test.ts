/**
 * Dynamic Adapter Loading Tests for @icetype/cli
 *
 * TDD RED PHASE: These tests define the expected behavior for dynamic adapter
 * loading in the CLI. The CLI should discover and register adapters dynamically
 * from the registry rather than using hardcoded imports.
 *
 * Current problem: The CLI has hardcoded imports in packages/cli/src/cli.ts:
 * - import { clickhouseExport } from './commands/clickhouse.js';
 * - import { duckdbExport } from './commands/duckdb.js';
 * - import { icebergExport } from './commands/iceberg.js';
 * - import { postgresExport } from './commands/postgres.js';
 *
 * Expected behavior after refactoring:
 * 1. CLI discovers adapters from the registry at startup
 * 2. New adapters can be added without modifying CLI code
 * 3. Commands are registered dynamically based on available adapters
 * 4. Unknown adapter names show helpful error messages
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// =============================================================================
// Dynamic Adapter Discovery Tests
// =============================================================================

describe('Dynamic CLI Adapter Loading', () => {
  beforeEach(async () => {
    // Reset the adapter registry before each test
    const { resetAdapterRegistry } = await import('../utils/adapter-registry.js');
    resetAdapterRegistry();
  });

  afterEach(async () => {
    const { resetAdapterRegistry } = await import('../utils/adapter-registry.js');
    resetAdapterRegistry();
    vi.restoreAllMocks();
  });

  describe('CLI discovers adapters from registry', () => {
    it('should discover all registered adapters without hardcoded imports', async () => {
      const { initializeAdapterRegistry, listAdapters } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapters = listAdapters();

      // The CLI should discover adapters dynamically from the registry
      // not from hardcoded imports in cli.ts
      expect(adapters.length).toBeGreaterThan(0);

      // Verify core adapters are discoverable
      expect(adapters).toContain('postgres');
      expect(adapters).toContain('duckdb');
      expect(adapters).toContain('clickhouse');
      expect(adapters).toContain('iceberg');
    });

    it('should have a getAvailableCommands function that returns adapter-based commands', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      // This function should exist and return commands based on registered adapters
      // Currently does not exist - this is the RED phase
      const { getAvailableCommands } = await import('../utils/adapter-registry.js');

      const commands = getAvailableCommands();

      // Should return command metadata for each adapter
      expect(commands).toBeDefined();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);

      // Each command should have name, description, and subcommands
      const postgresCommand = commands.find((c: { name: string }) => c.name === 'postgres');
      expect(postgresCommand).toBeDefined();
      expect(postgresCommand.subcommands).toContain('export');
    });

    it('should provide adapter metadata including supported operations', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const postgres = getAdapter('postgres');
      expect(postgres).toBeDefined();

      // Adapters should expose their supported operations (export, import, etc.)
      // This requires extending the SchemaAdapter interface
      // Currently adapters don't have this metadata - RED phase
      expect((postgres as any).supportedOperations).toBeDefined();
      expect((postgres as any).supportedOperations).toContain('export');
    });
  });

  describe('new adapters do not require CLI code changes', () => {
    it('should automatically support a newly registered adapter', async () => {
      const { globalRegistry } = await import('@icetype/adapters');
      const { initializeAdapterRegistry, listAdapters } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const initialAdapters = listAdapters();
      const initialCount = initialAdapters.length;

      // Register a new custom adapter (simulating a plugin)
      const customAdapter = {
        name: 'custom-database',
        version: '1.0.0',
        transform: (schema: any) => ({ tables: [schema.name] }),
        serialize: (output: any) => JSON.stringify(output),
        supportedOperations: ['export'],
      };

      globalRegistry.register(customAdapter);

      const updatedAdapters = listAdapters();

      // The new adapter should be discoverable without any CLI code changes
      expect(updatedAdapters.length).toBe(initialCount + 1);
      expect(updatedAdapters).toContain('custom-database');
    });

    it('should generate help text dynamically from registered adapters', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      // Register a new adapter
      globalRegistry.register({
        name: 'newdb',
        version: '1.0.0',
        transform: (schema: any) => schema,
        serialize: (output: any) => JSON.stringify(output),
        description: 'NewDB database adapter',
        supportedOperations: ['export', 'import'],
      } as any);

      // This function should generate dynamic help text
      // Currently does not exist - RED phase
      const { generateDynamicHelpText } = await import('../utils/adapter-registry.js');

      const helpText = generateDynamicHelpText();

      // Help should include the new adapter without hardcoding
      expect(helpText).toContain('newdb');
      expect(helpText).toContain('export');
    });

    it('should not require modifying cli.ts switch statement for new adapters', async () => {
      // This test verifies the architecture allows dynamic command routing
      // Currently cli.ts has a hardcoded switch statement - RED phase

      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      // Register a completely new adapter type
      const mongoAdapter = {
        name: 'mongodb',
        version: '1.0.0',
        transform: (schema: any) => ({ collection: schema.name }),
        serialize: (output: any) => JSON.stringify(output),
        supportedOperations: ['export'],
      };

      globalRegistry.register(mongoAdapter as any);

      // A dynamic command router should be able to handle this new adapter
      // Currently the CLI requires adding a case to the switch statement - RED phase
      const { createDynamicCommandRouter } = await import('../utils/adapter-registry.js');

      const router = createDynamicCommandRouter();

      // Router should be able to dispatch to mongodb export without hardcoded support
      expect(router.hasCommand('mongodb')).toBe(true);
      expect(router.getSubcommands('mongodb')).toContain('export');
    });
  });

  describe('commands are registered dynamically', () => {
    it('should register export command for each adapter that supports it', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      // This function should build a command registry from adapters
      // Currently does not exist - RED phase
      const { buildCommandRegistry } = await import('../utils/adapter-registry.js');

      const commandRegistry = buildCommandRegistry();

      // Each adapter should have its export command registered
      expect(commandRegistry.has('postgres:export')).toBe(true);
      expect(commandRegistry.has('duckdb:export')).toBe(true);
      expect(commandRegistry.has('clickhouse:export')).toBe(true);
      expect(commandRegistry.has('iceberg:export')).toBe(true);
    });

    it('should provide a unified export handler that works with any adapter', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');
      const { parseSchema } = await import('@icetype/core');

      initializeAdapterRegistry();

      // A generic export handler that works with any registered adapter
      // Currently each command file has its own handler - RED phase
      const { createUnifiedExportHandler } = await import('../utils/adapter-registry.js');

      const exportHandler = createUnifiedExportHandler();

      const schema = parseSchema({
        $type: 'User',
        id: 'uuid!',
        name: 'string',
      });

      // Should be able to export to any registered adapter by name
      const postgresResult = await exportHandler.export('postgres', schema);
      const duckdbResult = await exportHandler.export('duckdb', schema);

      expect(postgresResult).toBeDefined();
      expect(typeof postgresResult).toBe('string');
      expect(postgresResult).toContain('CREATE TABLE');

      expect(duckdbResult).toBeDefined();
      expect(typeof duckdbResult).toBe('string');
    });

    it('should support registering custom command handlers for adapters', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');
      const { globalRegistry } = await import('@icetype/adapters');

      initializeAdapterRegistry();

      // Adapters should be able to register custom command handlers
      // beyond just export (e.g., migrate, sync, etc.)
      // Currently not supported - RED phase
      const { registerAdapterCommand } = await import('../utils/adapter-registry.js');

      const customHandler = vi.fn().mockResolvedValue('Migration complete');

      registerAdapterCommand('postgres', 'migrate', customHandler);

      // The command should be callable
      const { executeAdapterCommand } = await import('../utils/adapter-registry.js');

      await executeAdapterCommand('postgres', 'migrate', ['--version', '1']);

      expect(customHandler).toHaveBeenCalledWith(['--version', '1']);
    });
  });

  describe('unknown adapters show helpful error messages', () => {
    it('should throw descriptive error when adapter not found', async () => {
      const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const adapter = getAdapter('nonexistent-adapter');

      // Currently returns undefined - should throw helpful error instead
      // This requires a getAdapterOrThrow function - RED phase
      const { getAdapterOrThrow } = await import('../utils/adapter-registry.js');

      expect(() => getAdapterOrThrow('nonexistent-adapter')).toThrow();

      try {
        getAdapterOrThrow('nonexistent-adapter');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;

        // Error should be helpful
        expect(errorMessage).toContain('nonexistent-adapter');
        expect(errorMessage).toContain('not found');

        // Error should suggest similar adapters
        expect(errorMessage).toMatch(/available.*postgres|duckdb|clickhouse|iceberg/i);
      }
    });

    it('should suggest similar adapter names for typos', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      // This function should suggest corrections for typos
      // Currently does not exist - RED phase
      const { suggestSimilarAdapters } = await import('../utils/adapter-registry.js');

      // Test typos
      const postgresSuggestions = suggestSimilarAdapters('postgress'); // double s
      expect(postgresSuggestions).toContain('postgres');

      const duckdbSuggestions = suggestSimilarAdapters('duckbd'); // transposed
      expect(duckdbSuggestions).toContain('duckdb');

      const clickhouseSuggestions = suggestSimilarAdapters('clickhouse'); // correct (no suggestions needed)
      expect(clickhouseSuggestions).toContain('clickhouse');
    });

    it('should provide list of available adapters in error message', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      const { getAdapterOrThrow } = await import('../utils/adapter-registry.js');

      try {
        getAdapterOrThrow('oracle');
      } catch (error) {
        const errorMessage = (error as Error).message;

        // Should list what IS available
        expect(errorMessage).toContain('postgres');
        expect(errorMessage).toContain('duckdb');
        expect(errorMessage).toContain('clickhouse');
        expect(errorMessage).toContain('iceberg');
      }
    });

    it('should show help for unknown subcommand on valid adapter', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      // This function should validate subcommands and show available ones
      // Currently does not exist - RED phase
      const { validateAdapterSubcommand } = await import('../utils/adapter-registry.js');

      expect(() => {
        validateAdapterSubcommand('postgres', 'invalidsubcommand');
      }).toThrow();

      try {
        validateAdapterSubcommand('postgres', 'invalidsubcommand');
      } catch (error) {
        const errorMessage = (error as Error).message;

        // Should mention the invalid subcommand
        expect(errorMessage).toContain('invalidsubcommand');

        // Should list available subcommands for postgres
        expect(errorMessage).toContain('export');
      }
    });
  });

  describe('CLI main function integration', () => {
    it('should use dynamic routing instead of switch statement', async () => {
      // This test verifies that cli.ts can be refactored to use dynamic routing
      // Currently cli.ts uses a hardcoded switch statement - RED phase

      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      // A CLI router that dispatches based on registered adapters
      const { createCliRouter } = await import('../utils/adapter-registry.js');

      const router = createCliRouter();

      // Should be able to check if a command is available
      expect(router.isAdapterCommand('postgres')).toBe(true);
      expect(router.isAdapterCommand('duckdb')).toBe(true);
      expect(router.isAdapterCommand('unknown')).toBe(false);

      // Should be able to get the handler for a command
      const postgresHandler = router.getHandler('postgres', 'export');
      expect(postgresHandler).toBeDefined();
      expect(typeof postgresHandler).toBe('function');
    });

    it('should support lazy loading of adapter implementations', async () => {
      const { initializeAdapterRegistry } = await import('../utils/adapter-registry.js');

      initializeAdapterRegistry();

      // Adapters should be lazily loaded to reduce startup time
      // Currently all adapters are imported at startup - RED phase
      const { createLazyAdapterLoader } = await import('../utils/adapter-registry.js');

      const loader = createLazyAdapterLoader();

      // Adapter should not be loaded until needed
      expect(loader.isLoaded('postgres')).toBe(false);

      // Load on demand
      const adapter = await loader.load('postgres');

      expect(adapter).toBeDefined();
      expect(loader.isLoaded('postgres')).toBe(true);
    });
  });
});

// =============================================================================
// Adapter Interface Extension Tests
// =============================================================================

describe('Extended Adapter Interface for CLI', () => {
  beforeEach(async () => {
    const { resetAdapterRegistry } = await import('../utils/adapter-registry.js');
    resetAdapterRegistry();
  });

  afterEach(async () => {
    const { resetAdapterRegistry } = await import('../utils/adapter-registry.js');
    resetAdapterRegistry();
  });

  it('should have adapters with CLI metadata', async () => {
    const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

    initializeAdapterRegistry();

    const postgres = getAdapter('postgres');

    // Extended adapter interface for CLI integration
    // Currently adapters don't have this - RED phase
    expect((postgres as any).cliMetadata).toBeDefined();
    expect((postgres as any).cliMetadata.description).toBeDefined();
    expect((postgres as any).cliMetadata.examples).toBeDefined();
    expect(Array.isArray((postgres as any).cliMetadata.examples)).toBe(true);
  });

  it('should have adapters with option definitions for parseArgs', async () => {
    const { initializeAdapterRegistry, getAdapter } = await import('../utils/adapter-registry.js');

    initializeAdapterRegistry();

    const postgres = getAdapter('postgres');

    // Adapters should define their CLI options for parseArgs
    // Currently options are hardcoded in each command file - RED phase
    expect((postgres as any).cliOptions).toBeDefined();
    expect((postgres as any).cliOptions.schema).toBeDefined();
    expect((postgres as any).cliOptions.output).toBeDefined();
  });
});
