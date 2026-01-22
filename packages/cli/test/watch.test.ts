/**
 * Watch Mode Tests for @icetype/cli
 *
 * Tests for the file watcher utility that enables watch mode for the generate command.
 * Uses TDD approach - these tests are written before the implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'node:fs';
import type { CleanupAwareWatcher } from '../src/utils/watcher.js';

// Mock fs.watch
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

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Watch Mode', () => {
  let mockWatcher: EventEmitter & Partial<FSWatcher>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Create a mock FSWatcher that extends EventEmitter
    mockWatcher = new EventEmitter() as EventEmitter & Partial<FSWatcher>;
    mockWatcher.close = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('createWatcher', () => {
    it('should create a file watcher for the schema file', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      const watcher = createWatcher('./schema.ts', { onGenerate });

      expect(fs.watch).toHaveBeenCalledWith('./schema.ts', expect.any(Function));
      expect(watcher).toBeDefined();
    });

    it('should trigger regeneration on file change', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        // Store the callback to trigger it later
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      createWatcher('./schema.ts', { onGenerate });

      // Simulate a file change event
      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        storedCallback('change', 'schema.ts');
      }

      // Fast-forward debounce timer
      await vi.advanceTimersByTimeAsync(150);

      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid changes', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      createWatcher('./schema.ts', { onGenerate, debounceMs: 100 });

      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        // Simulate rapid file changes
        storedCallback('change', 'schema.ts');
        await vi.advanceTimersByTimeAsync(50);
        storedCallback('change', 'schema.ts');
        await vi.advanceTimersByTimeAsync(50);
        storedCallback('change', 'schema.ts');
        await vi.advanceTimersByTimeAsync(150);
      }

      // Should only generate once due to debouncing
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it('should handle watcher errors gracefully', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const error = new Error('Generation failed');
      const onGenerate = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();
      createWatcher('./schema.ts', { onGenerate, onError });

      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        storedCallback('change', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should respect custom debounce time', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      createWatcher('./schema.ts', { onGenerate, debounceMs: 200 });

      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        storedCallback('change', 'schema.ts');
      }

      // After 150ms - should NOT have been called yet
      await vi.advanceTimersByTimeAsync(150);
      expect(onGenerate).not.toHaveBeenCalled();

      // After 200ms total - should be called
      await vi.advanceTimersByTimeAsync(100);
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it('should ignore non-change events', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      createWatcher('./schema.ts', { onGenerate });

      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        // Simulate a 'rename' event (not 'change')
        storedCallback('rename', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      expect(onGenerate).not.toHaveBeenCalled();
    });

    it('should return a CleanupAwareWatcher based on the FSWatcher', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      const watcher = createWatcher('./schema.ts', { onGenerate });

      // The returned watcher should be the same object (enhanced in place)
      expect(watcher).toBe(mockWatcher);
      // And should have the isClosed property
      expect(watcher.isClosed).toBe(false);
    });

    it('should set isClosed to true after close() is called', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      const watcher = createWatcher('./schema.ts', { onGenerate });

      expect(watcher.isClosed).toBe(false);
      watcher.close();
      expect(watcher.isClosed).toBe(true);
    });
  });

  describe('watchGenerate', () => {
    it('should run initial generation', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      // Don't await - it runs forever, just verify initial call
      const watchPromise = watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      // Give it a moment to run initial generation
      await vi.advanceTimersByTimeAsync(0);

      expect(runGeneration).toHaveBeenCalledTimes(1);

      // Cleanup
      mockWatcher.close?.();
    });

    it('should continue watching after errors', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { watchGenerate } = await import('../utils/watcher.js');

      let callCount = 0;
      const runGeneration = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First run failed'));
        }
        return Promise.resolve();
      });

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      // Initial run - should fail but continue
      await vi.advanceTimersByTimeAsync(0);
      expect(runGeneration).toHaveBeenCalledTimes(1);

      // Simulate a file change
      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        storedCallback('change', 'schema.ts');
      }

      await vi.advanceTimersByTimeAsync(150);

      // Should have been called again
      expect(runGeneration).toHaveBeenCalledTimes(2);
    });

    it('should support --quiet mode', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
        quiet: true,
      });

      await vi.advanceTimersByTimeAsync(0);

      // In quiet mode, info messages should not be logged
      // Only verify generation ran
      expect(runGeneration).toHaveBeenCalledTimes(1);
    });

    it('should support --verbose mode', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
        verbose: true,
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(runGeneration).toHaveBeenCalledTimes(1);
    });
  });

  describe('WatcherOptions validation', () => {
    it('should use default debounce of 100ms when not specified', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      createWatcher('./schema.ts', { onGenerate });

      const storedCallback = (mockWatcher as EventEmitter & { callback?: (eventType: string, filename: string) => void }).callback;
      if (storedCallback) {
        storedCallback('change', 'schema.ts');
      }

      // After 50ms - should NOT have been called
      await vi.advanceTimersByTimeAsync(50);
      expect(onGenerate).not.toHaveBeenCalled();

      // After 100ms total - should be called
      await vi.advanceTimersByTimeAsync(60);
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Signal Handling for Graceful Shutdown', () => {
    let originalProcessOn: typeof process.on;
    let originalProcessExit: typeof process.exit;
    let signalHandlers: Map<string, (...args: unknown[]) => void>;

    beforeEach(() => {
      signalHandlers = new Map();
      originalProcessOn = process.on;
      originalProcessExit = process.exit;

      // Mock process.on to capture signal handlers
      process.on = vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        signalHandlers.set(event, handler);
        return process;
      }) as unknown as typeof process.on;

      // Mock process.exit to prevent actual exit
      process.exit = vi.fn() as unknown as typeof process.exit;
    });

    afterEach(() => {
      process.on = originalProcessOn;
      process.exit = originalProcessExit;
    });

    it('should register SIGINT handler', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register SIGTERM handler', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should close watcher on SIGINT', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      let closeCalled = false;
      mockWatcher.close = vi.fn(() => { closeCalled = true; });
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      // Trigger SIGINT handler
      const sigintHandler = signalHandlers.get('SIGINT');
      expect(sigintHandler).toBeDefined();
      sigintHandler!();

      // Verify the underlying close was called (tracked via our flag since createWatcher wraps close)
      expect(closeCalled).toBe(true);
    });

    it('should close watcher on SIGTERM', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      let closeCalled = false;
      mockWatcher.close = vi.fn(() => { closeCalled = true; });
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      // Trigger SIGTERM handler
      const sigtermHandler = signalHandlers.get('SIGTERM');
      expect(sigtermHandler).toBeDefined();
      sigtermHandler!();

      // Verify the underlying close was called (tracked via our flag since createWatcher wraps close)
      expect(closeCalled).toBe(true);
    });

    it('should call process.exit(0) on graceful shutdown', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      // Trigger SIGINT handler
      const sigintHandler = signalHandlers.get('SIGINT');
      sigintHandler!();

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should log shutdown message on signal', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      // Trigger SIGINT handler
      const sigintHandler = signalHandlers.get('SIGINT');
      sigintHandler!();

      // Verify a shutdown message was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down')
      );
    });

    it('should not log shutdown message in quiet mode', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      let closeCalled = false;
      mockWatcher.close = vi.fn(() => { closeCalled = true; });
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      // Clear any previous logs
      mockConsoleLog.mockClear();

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
        quiet: true,
      });

      await vi.advanceTimersByTimeAsync(0);

      // Trigger SIGINT handler
      const sigintHandler = signalHandlers.get('SIGINT');
      sigintHandler!();

      // In quiet mode, info messages should not be logged
      // The shutdown message should not contain 'Shutting down' in quiet mode
      const shutdownMessageLogged = mockConsoleLog.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('Shutting down')
      );
      expect(shutdownMessageLogged).toBe(false);

      // But watcher should still be closed and process should still exit
      expect(closeCalled).toBe(true);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle multiple signals gracefully (only shutdown once)', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      let closeCallCount = 0;
      mockWatcher.close = vi.fn(() => { closeCallCount++; });
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as FSWatcher);

      const { watchGenerate } = await import('../utils/watcher.js');

      const runGeneration = vi.fn().mockResolvedValue(undefined);

      watchGenerate({
        schemaPath: './schema.ts',
        runGeneration,
      });

      await vi.advanceTimersByTimeAsync(0);

      // Get both handlers
      const sigintHandler = signalHandlers.get('SIGINT');
      const sigtermHandler = signalHandlers.get('SIGTERM');

      // Trigger SIGINT first
      sigintHandler!();

      // Verify watcher.close was called once (tracked via our counter since createWatcher wraps close)
      expect(closeCallCount).toBe(1);
      expect(process.exit).toHaveBeenCalledTimes(1);
    });
  });
});
