/**
 * Watch Mode CLI Flag Tests for @icetype/cli
 *
 * RED PHASE TDD: These tests are written to FAIL before implementation.
 *
 * Tests for the --watch/-w flag in the ice generate command.
 * Focuses on CLI-level behavior and integration with the file watcher.
 *
 * Test scenarios:
 * 1. ice generate --watch starts file watcher
 * 2. Changes to schema files trigger regeneration
 * 3. Errors don't crash the watcher
 * 4. Clean shutdown on SIGINT
 * 5. Debouncing rapid file changes
 *
 * RED PHASE FAILING TESTS (features not yet implemented):
 * - Watching multiple schema files (glob patterns)
 * - Custom debounce time via --debounce CLI flag
 * - Watching imported dependencies
 * - onReady callback when watch mode is initialized
 * - Restart watcher on file rename
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'node:fs';
import type { FieldDefinition, IceTypeSchema } from '@icetype/core';

// Mock fs.watch and related functions
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    watch: vi.fn(),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

/**
 * Create a valid IceTypeSchema object for testing
 */
function createValidSchema(name: string = 'TestEntity'): IceTypeSchema {
  const fields = new Map<string, FieldDefinition>();
  fields.set('id', {
    name: 'id',
    type: 'uuid',
    modifier: '!',
    isArray: false,
    isOptional: false,
    isUnique: true,
    isIndexed: false,
  });
  fields.set('name', {
    name: 'name',
    type: 'string',
    modifier: '',
    isArray: false,
    isOptional: false,
    isUnique: false,
    isIndexed: false,
  });

  return {
    name,
    version: 1,
    fields,
    directives: {},
    relations: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('Watch Mode CLI Flag (--watch / -w)', () => {
  let mockWatcher: EventEmitter & Partial<FSWatcher>;
  let watchCallback: ((eventType: string, filename: string) => void) | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.useFakeTimers();

    // Create a mock FSWatcher that extends EventEmitter
    mockWatcher = new EventEmitter() as EventEmitter & Partial<FSWatcher>;
    mockWatcher.close = vi.fn();
    watchCallback = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Starting watch mode', () => {
    it('should start file watcher when --watch flag is provided', async () => {
      /**
       * RED TEST: Verify that passing --watch starts the file watcher.
       * This should call fs.watch with the schema file path.
       */
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();
      const mockWatch = vi.fn().mockReturnValue(mockWatcher as FSWatcher);

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      // Start watch mode (runs forever, so don't await)
      const watchPromise = generate(['--schema', './schema.ts', '--watch', '-q']);

      // Allow initial generation to complete
      await vi.advanceTimersByTimeAsync(0);

      // Verify fs.watch was called with the schema path
      expect(mockWatch).toHaveBeenCalledWith('./schema.ts', expect.any(Function));
    });

    it('should start file watcher when -w short flag is provided', async () => {
      /**
       * RED TEST: Verify that -w short flag works the same as --watch.
       */
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();
      const mockWatch = vi.fn().mockReturnValue(mockWatcher as FSWatcher);

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      // Start watch mode with -w flag
      generate(['-s', './schema.ts', '-w', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      expect(mockWatch).toHaveBeenCalledWith('./schema.ts', expect.any(Function));
    });

    it('should perform initial generation before starting watch', async () => {
      /**
       * RED TEST: Watch mode should generate types once before watching.
       */
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Verify initial generation happened
      expect(mockLoadSchemaFile).toHaveBeenCalledWith('./schema.ts');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('Schema file changes trigger regeneration', () => {
    it('should regenerate types when schema file changes', async () => {
      /**
       * RED TEST: When a schema file is modified, types should be regenerated.
       */
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Clear initial generation calls
      mockLoadSchemaFile.mockClear();
      mockWriteFileSync.mockClear();

      // Simulate file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(150);

      // Verify regeneration happened
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    });

    it('should use updated schema content on regeneration', async () => {
      /**
       * RED TEST: Regeneration should pick up the new schema content.
       */
      const initialSchema = createValidSchema('User');
      const updatedSchema = createValidSchema('UpdatedUser');
      let callCount = 0;

      const mockWriteFileSync = vi.fn();
      const mockLoadSchemaFile = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            schemas: [{ name: 'User', schema: initialSchema }],
            errors: [],
          });
        }
        return Promise.resolve({
          schemas: [{ name: 'UpdatedUser', schema: updatedSchema }],
          errors: [],
        });
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Verify initial content
      const [, initialContent] = mockWriteFileSync.mock.calls[0];
      expect(initialContent).toContain('export interface User');

      // Simulate file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Verify updated content
      const [, updatedContent] = mockWriteFileSync.mock.calls[1];
      expect(updatedContent).toContain('export interface UpdatedUser');
    });
  });

  describe('Error resilience - errors do not crash watcher', () => {
    it('should continue watching after generation error', async () => {
      /**
       * RED TEST: If generation fails, the watcher should continue running.
       */
      let callCount = 0;
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();
      const mockLoadSchemaFile = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second call (first file change) fails
          return Promise.resolve({
            schemas: [],
            errors: ['Syntax error in schema'],
          });
        }
        return Promise.resolve({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        });
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // First file change - should fail
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }
      await vi.advanceTimersByTimeAsync(150);

      // Second file change - should succeed
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }
      await vi.advanceTimersByTimeAsync(150);

      // Verify both attempts were made (watcher continued after error)
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(2);
    });

    it('should continue watching after write error', async () => {
      /**
       * RED TEST: If file write fails, the watcher should continue.
       */
      let writeCallCount = 0;
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn().mockImplementation(() => {
        writeCallCount++;
        if (writeCallCount === 2) {
          throw new Error('EACCES: permission denied');
        }
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // First file change - should fail on write
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }
      await vi.advanceTimersByTimeAsync(150);

      // Second file change - should succeed
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }
      await vi.advanceTimersByTimeAsync(150);

      // Verify three write attempts: initial + 2 changes
      expect(mockWriteFileSync).toHaveBeenCalledTimes(3);
    });

    it('should log error but not exit on generation failure', async () => {
      /**
       * RED TEST: Errors should be logged but not cause process exit.
       */
      const mockConsoleError = vi.spyOn(console, 'error');
      const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      let callCount = 0;
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.resolve({
              schemas: [],
              errors: ['Schema parsing failed'],
            });
          }
          return Promise.resolve({
            schemas: [{ name: 'User', schema: mockSchema }],
            errors: [],
          });
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      // Should not throw
      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Trigger error
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }
      await vi.advanceTimersByTimeAsync(150);

      // Process.exit should NOT have been called
      expect(mockProcessExit).not.toHaveBeenCalled();

      mockProcessExit.mockRestore();
    });
  });

  describe('Clean shutdown on SIGINT', () => {
    let originalProcessOn: typeof process.on;
    let originalProcessExit: typeof process.exit;
    let signalHandlers: Map<string, (...args: unknown[]) => void>;

    beforeEach(() => {
      signalHandlers = new Map();
      originalProcessOn = process.on;
      originalProcessExit = process.exit;

      process.on = vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        signalHandlers.set(event, handler);
        return process;
      }) as unknown as typeof process.on;

      process.exit = vi.fn() as unknown as typeof process.exit;
    });

    afterEach(() => {
      process.on = originalProcessOn;
      process.exit = originalProcessExit;
    });

    it('should register SIGINT handler in watch mode', async () => {
      /**
       * RED TEST: Watch mode should register a SIGINT handler for clean shutdown.
       */
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should close watcher on SIGINT', async () => {
      /**
       * RED TEST: SIGINT should trigger watcher cleanup.
       */
      const mockSchema = createValidSchema('User');
      let closeCalled = false;
      mockWatcher.close = vi.fn(() => { closeCalled = true; });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Trigger SIGINT
      const sigintHandler = signalHandlers.get('SIGINT');
      expect(sigintHandler).toBeDefined();
      sigintHandler!();

      expect(closeCalled).toBe(true);
    });

    it('should exit with code 0 on SIGINT', async () => {
      /**
       * RED TEST: Clean shutdown should exit with success code.
       */
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      const sigintHandler = signalHandlers.get('SIGINT');
      sigintHandler!();

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should clear pending debounce timeout on SIGINT', async () => {
      /**
       * RED TEST: Shutdown should cancel pending regeneration.
       */
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // Trigger file change (starts debounce timer)
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Partially advance (debounce not complete)
      await vi.advanceTimersByTimeAsync(50);

      // Trigger SIGINT
      const sigintHandler = signalHandlers.get('SIGINT');
      sigintHandler!();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(150);

      // Regeneration should NOT have happened
      expect(mockLoadSchemaFile).not.toHaveBeenCalled();
    });

    it('should also handle SIGTERM for clean shutdown', async () => {
      /**
       * RED TEST: SIGTERM should also trigger clean shutdown.
       */
      const mockSchema = createValidSchema('User');
      let closeCalled = false;
      mockWatcher.close = vi.fn(() => { closeCalled = true; });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      const sigtermHandler = signalHandlers.get('SIGTERM');
      expect(sigtermHandler).toBeDefined();
      sigtermHandler!();

      expect(closeCalled).toBe(true);
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('Debouncing rapid file changes', () => {
    it('should debounce rapid consecutive changes', async () => {
      /**
       * RED TEST: Multiple rapid changes should result in single regeneration.
       */
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // Simulate rapid file changes
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
        await vi.advanceTimersByTimeAsync(30);
        watchCallback('change', 'schema.ts');
        await vi.advanceTimersByTimeAsync(30);
        watchCallback('change', 'schema.ts');
        await vi.advanceTimersByTimeAsync(30);
        watchCallback('change', 'schema.ts');
      }

      // Wait for debounce to complete
      await vi.advanceTimersByTimeAsync(150);

      // Should only have regenerated once
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on each new change', async () => {
      /**
       * RED TEST: Each new change resets the debounce timer.
       */
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // First change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Wait 80ms (less than 100ms debounce)
      await vi.advanceTimersByTimeAsync(80);
      expect(mockLoadSchemaFile).not.toHaveBeenCalled();

      // Second change - resets timer
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Wait another 80ms (still shouldn't trigger, timer was reset)
      await vi.advanceTimersByTimeAsync(80);
      expect(mockLoadSchemaFile).not.toHaveBeenCalled();

      // Wait remaining time
      await vi.advanceTimersByTimeAsync(30);
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
    });

    it('should use default debounce time of 100ms', async () => {
      /**
       * RED TEST: Default debounce should be 100ms.
       */
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // At 99ms - should not have triggered yet
      await vi.advanceTimersByTimeAsync(99);
      expect(mockLoadSchemaFile).not.toHaveBeenCalled();

      // At 101ms - should have triggered
      await vi.advanceTimersByTimeAsync(2);
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
    });

    it('should ignore non-change events (rename, etc.)', async () => {
      /**
       * RED TEST: Only 'change' events should trigger regeneration.
       */
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // Trigger non-change events
      if (watchCallback) {
        watchCallback('rename', 'schema.ts');
        watchCallback('access', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Should not have regenerated
      expect(mockLoadSchemaFile).not.toHaveBeenCalled();
    });
  });

  describe('Watch mode with other flags', () => {
    it('should respect --quiet flag in watch mode', async () => {
      /**
       * RED TEST: Watch mode should suppress info messages when --quiet is set.
       */
      const mockConsoleLog = vi.spyOn(console, 'log');
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      mockConsoleLog.mockClear();

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '--quiet']);

      await vi.advanceTimersByTimeAsync(0);

      // In quiet mode, there should be minimal or no info logging
      const infoCalls = mockConsoleLog.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Watching')
      );
      expect(infoCalls.length).toBe(0);
    });

    it('should support --verbose flag in watch mode', async () => {
      /**
       * RED TEST: Watch mode should output debug info when --verbose is set.
       */
      const mockConsoleLog = vi.spyOn(console, 'log');
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      mockConsoleLog.mockClear();

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '--verbose']);

      await vi.advanceTimersByTimeAsync(0);

      // Verbose mode should produce more output
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should use custom output path in watch mode', async () => {
      /**
       * RED TEST: Custom --output should work with --watch.
       */
      const mockSchema = createValidSchema('User');
      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--output', './custom/types.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Verify initial write to custom path
      expect(mockWriteFileSync).toHaveBeenCalledWith('./custom/types.ts', expect.any(String));

      mockWriteFileSync.mockClear();

      // Trigger file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Verify regeneration also uses custom path
      expect(mockWriteFileSync).toHaveBeenCalledWith('./custom/types.ts', expect.any(String));
    });

    it('should apply --nullable-style in watch mode regenerations', async () => {
      /**
       * RED TEST: nullable-style option should persist across regenerations.
       */
      const fields = new Map<string, FieldDefinition>();
      fields.set('name', {
        name: 'name',
        type: 'string',
        modifier: '?',
        isArray: false,
        isOptional: true,
        isUnique: false,
        isIndexed: false,
      });

      const mockSchema: IceTypeSchema = {
        name: 'User',
        version: 1,
        fields,
        directives: {},
        relations: new Map(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockWriteFileSync = vi.fn();

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: mockWriteFileSync,
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '--nullable-style', 'strict', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Verify initial generation uses strict style
      const [, initialContent] = mockWriteFileSync.mock.calls[0];
      expect(initialContent).toContain('name?: string | null;');
      expect(initialContent).not.toContain('| undefined');

      mockWriteFileSync.mockClear();

      // Trigger file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Verify regeneration also uses strict style
      const [, regeneratedContent] = mockWriteFileSync.mock.calls[0];
      expect(regeneratedContent).toContain('name?: string | null;');
      expect(regeneratedContent).not.toContain('| undefined');
    });
  });

  // =============================================================================
  // RED PHASE FAILING TESTS - Features NOT YET Implemented
  // =============================================================================

  describe('[RED] Custom debounce time via CLI flag', () => {
    it('should support --debounce CLI flag to customize debounce time', async () => {
      /**
       * RED TEST: The --debounce flag should allow customizing debounce time.
       * This feature is NOT yet implemented - test should FAIL.
       *
       * Currently parseArgs throws "Unknown option '--debounce'" because
       * the flag is not yet defined in the CLI options.
       *
       * When implemented:
       * - The flag should be accepted without error
       * - The custom debounce time should be applied
       */
      const mockSchema = createValidSchema('User');
      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      // Use --debounce flag to set custom debounce time of 500ms
      // Currently this throws "Unknown option '--debounce'" - when implemented, it should NOT throw
      // RED ASSERTION: This should NOT throw when the flag is implemented
      await expect(
        generate(['--schema', './schema.ts', '--watch', '--debounce', '500', '-q'])
      ).resolves.not.toThrow();

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // At 400ms with 500ms debounce - should NOT have triggered
      await vi.advanceTimersByTimeAsync(400);
      expect(mockLoadSchemaFile).not.toHaveBeenCalled();

      // At 550ms total - should have triggered
      await vi.advanceTimersByTimeAsync(150);
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
    });

    it('should validate --debounce value is a positive number', async () => {
      /**
       * RED TEST: Invalid debounce values should throw a specific validation error.
       * This feature is NOT yet implemented - test should FAIL.
       *
       * Currently parseArgs throws "Unknown option '--debounce'" instead
       * of a validation error because the flag doesn't exist yet.
       *
       * When implemented, the error should specifically mention the invalid value.
       */
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: createValidSchema('User') }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      // Negative debounce should throw a validation error with specific message
      // NOT "Unknown option" - the error should mention the invalid value
      await expect(
        generate(['--schema', './schema.ts', '--watch', '--debounce', '-100', '-q'])
      ).rejects.toThrow('--debounce must be a positive number');
    });
  });

  describe('[RED] Watch multiple schema files with glob patterns', () => {
    it('should watch all files matching glob pattern', async () => {
      /**
       * RED TEST: The --schema flag should accept glob patterns for watching multiple files.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');
      const mockWatch = vi.fn().mockReturnValue(mockWatcher as FSWatcher);

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      // Use glob pattern to watch multiple schema files
      generate(['--schema', './schemas/*.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Should have set up watchers for all matching files
      // This requires glob expansion which is not yet implemented
      expect(mockWatch.mock.calls.length).toBeGreaterThan(1);
    });

    it('should regenerate when any watched file changes', async () => {
      /**
       * RED TEST: Changes to any watched file should trigger regeneration.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');
      const watchCallbacks: Map<string, (eventType: string, filename: string) => void> = new Map();
      const mockWatch = vi.fn().mockImplementation((path, callback) => {
        watchCallbacks.set(path, callback);
        const watcher = new EventEmitter() as EventEmitter & Partial<FSWatcher>;
        watcher.close = vi.fn();
        return watcher as FSWatcher;
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schemas/*.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // Simulate change to second file
      const secondFileCallback = watchCallbacks.get('./schemas/post.ts');
      if (secondFileCallback) {
        secondFileCallback('change', 'post.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Should have regenerated
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('[RED] Watch imported dependencies', () => {
    it('should detect and watch files imported by the schema', async () => {
      /**
       * RED TEST: The watcher should also watch files imported by the schema.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');
      const mockWatch = vi.fn().mockReturnValue(mockWatcher as FSWatcher);

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: vi.fn(),
          readFileSync: vi.fn().mockReturnValue(`
            import { BaseEntity } from './base.ts';
            export const User = { extends: BaseEntity };
          `),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      // Start watch mode
      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);

      // Should have watched both the main schema AND its import
      const watchedPaths = mockWatch.mock.calls.map((call: [string, ...unknown[]]) => call[0]);
      expect(watchedPaths).toContain('./schema.ts');
      expect(watchedPaths).toContain('./base.ts');
    });

    it('should regenerate when an imported file changes', async () => {
      /**
       * RED TEST: Changes to imported files should trigger regeneration.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');
      const watchCallbacks: Map<string, (eventType: string, filename: string) => void> = new Map();
      const mockWatch = vi.fn().mockImplementation((path, callback) => {
        watchCallbacks.set(path, callback);
        const watcher = new EventEmitter() as EventEmitter & Partial<FSWatcher>;
        watcher.close = vi.fn();
        return watcher as FSWatcher;
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: vi.fn(),
          readFileSync: vi.fn().mockReturnValue(`
            import { BaseEntity } from './base.ts';
            export const User = { extends: BaseEntity };
          `),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      const mockLoadSchemaFile = vi.fn().mockResolvedValue({
        schemas: [{ name: 'User', schema: mockSchema }],
        errors: [],
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: mockLoadSchemaFile,
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockLoadSchemaFile.mockClear();

      // Simulate change to imported file
      const importedFileCallback = watchCallbacks.get('./base.ts');
      if (importedFileCallback) {
        importedFileCallback('change', 'base.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Should have regenerated
      expect(mockLoadSchemaFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('[RED] onReady callback for watch initialization', () => {
    it('should call onReady callback when watcher is initialized', async () => {
      /**
       * RED TEST: The watcher should call an onReady callback when setup is complete.
       * This is useful for testing and for CLI feedback.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockReturnValue(mockWatcher as FSWatcher),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { watchGenerate } = await import('../utils/watcher.js');

      const onReady = vi.fn();

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration: vi.fn().mockResolvedValue(undefined),
        onReady, // This option should trigger after initial generation and watcher setup
      } as any);

      await vi.advanceTimersByTimeAsync(0);

      // onReady should have been called once watcher is set up
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('[RED] Restart watcher on file rename', () => {
    it('should restart watcher when watched file is renamed', async () => {
      /**
       * RED TEST: When a watched file is renamed, the watcher should restart.
       * Currently 'rename' events are ignored, which can cause issues.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');
      const mockWatch = vi.fn().mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: mockWatch,
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockReturnValue(true),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      const initialWatchCallCount = mockWatch.mock.calls.length;

      // Simulate rename event
      if (watchCallback) {
        watchCallback('rename', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Watcher should have been restarted (watch called again)
      expect(mockWatch.mock.calls.length).toBeGreaterThan(initialWatchCallCount);
    });

    it('should emit warning when file disappears during watch', async () => {
      /**
       * RED TEST: When the watched file is deleted, emit a warning.
       * This feature is NOT yet implemented - test should FAIL.
       */
      const mockSchema = createValidSchema('User');
      const mockConsoleWarn = vi.spyOn(console, 'warn');
      let existsReturnValue = true;

      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
        return {
          ...actual,
          watch: vi.fn().mockImplementation((_path, callback) => {
            watchCallback = callback as (eventType: string, filename: string) => void;
            return mockWatcher as FSWatcher;
          }),
          writeFileSync: vi.fn(),
          existsSync: vi.fn().mockImplementation(() => existsReturnValue),
        };
      });

      vi.doMock('../utils/schema-loader.js', () => ({
        loadSchemaFile: vi.fn().mockResolvedValue({
          schemas: [{ name: 'User', schema: mockSchema }],
          errors: [],
        }),
      }));

      const { generate } = await import('../commands/generate.js');

      generate(['--schema', './schema.ts', '--watch', '-q']);

      await vi.advanceTimersByTimeAsync(0);
      mockConsoleWarn.mockClear();

      // File disappears
      existsReturnValue = false;

      // Simulate rename event (which can indicate deletion)
      if (watchCallback) {
        watchCallback('rename', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Should have warned about missing file
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('File no longer exists')
      );
    });
  });
});
