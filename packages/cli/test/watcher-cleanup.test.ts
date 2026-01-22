/**
 * Watcher Cleanup Tests for @icetype/cli
 *
 * Tests for resource leak in watch mode - specifically the timeout cleanup issue.
 *
 * BUG DESCRIPTION:
 * The createWatcher function stores a setTimeout reference but doesn't clear it
 * when watcher.close() is called. This causes:
 * 1. Callbacks to fire after the watcher is closed
 * 2. Potential memory leaks in long-running processes
 * 3. Test flakiness when watchers aren't properly cleaned up
 *
 * EXPECTED FIX:
 * ```typescript
 * // Current (buggy) - just returns FSWatcher
 * return watcher;
 *
 * // Fixed - returns cleanup-aware object
 * return {
 *   watcher,
 *   close: () => {
 *     if (timeout) clearTimeout(timeout);
 *     watcher.close();
 *   }
 * };
 * ```
 *
 * These tests are written to FAIL until the fix is implemented.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'node:fs';

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

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Watcher Resource Cleanup', () => {
  let mockWatcher: EventEmitter & Partial<FSWatcher>;
  let watchCallback: ((eventType: string, filename: string) => void) | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
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

  describe('Timeout Cleanup on Close', () => {
    it('should clear pending timeout when watcher is closed', async () => {
      /**
       * FAILING TEST: This test exposes the resource leak bug.
       *
       * Current behavior: watcher.close() doesn't clear the pending timeout,
       * so the onGenerate callback will still fire after close.
       *
       * Expected behavior: Closing the watcher should clear any pending timeouts.
       */
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      const watcher = createWatcher('./schema.ts', {
        onGenerate,
        debounceMs: 100,
      });

      // Trigger a file change - this schedules a timeout
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Advance time partially (50ms of 100ms debounce)
      await vi.advanceTimersByTimeAsync(50);

      // Close the watcher BEFORE the timeout fires
      watcher.close();

      // Advance time past the original timeout
      await vi.advanceTimersByTimeAsync(100);

      // BUG: The callback should NOT have been called after close
      // Currently this FAILS because the timeout isn't cleared
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it('should not fire callbacks after watcher is closed', async () => {
      /**
       * FAILING TEST: Verifies that no generation callbacks fire after close.
       *
       * This is critical for test cleanup and avoiding side effects.
       */
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      let callbackFiredAfterClose = false;
      let watcherClosed = false;

      const onGenerate = vi.fn().mockImplementation(async () => {
        if (watcherClosed) {
          callbackFiredAfterClose = true;
        }
      });

      const watcher = createWatcher('./schema.ts', {
        onGenerate,
        debounceMs: 100,
      });

      // Trigger a file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Close immediately
      watcherClosed = true;
      watcher.close();

      // Let any pending timers fire
      await vi.advanceTimersByTimeAsync(200);

      // BUG: No callback should fire after close
      expect(callbackFiredAfterClose).toBe(false);
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it('should return a cleanup function that clears timeout', async () => {
      /**
       * FAILING TEST: The createWatcher should return or provide a cleanup mechanism.
       *
       * Currently it just returns the FSWatcher, which doesn't clear timeouts.
       *
       * Expected: Either return { watcher, close } or modify FSWatcher.close behavior.
       */
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      const result = createWatcher('./schema.ts', {
        onGenerate,
        debounceMs: 100,
      });

      // Trigger a file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // The result should have a close method that clears timeouts
      // Currently this returns just the FSWatcher which doesn't clear timeouts
      // The fix should return { watcher, close } or wrap close behavior

      // Check if result has a close method (it does - the FSWatcher)
      expect(typeof result.close).toBe('function');

      // Close should prevent callbacks
      result.close();

      await vi.advanceTimersByTimeAsync(200);

      // BUG: This will FAIL because close doesn't clear the timeout
      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not leak memory with repeated watch/close cycles', async () => {
      /**
       * FAILING TEST: Simulates repeated watch/close cycles.
       *
       * In a real scenario, this could cause memory leaks if timeouts
       * keep accumulating and aren't cleared.
       */
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        // Create a fresh mock for each call
        const freshMockWatcher = new EventEmitter() as EventEmitter & Partial<FSWatcher>;
        freshMockWatcher.close = vi.fn();
        return freshMockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const callbacks: vi.Mock[] = [];
      const watchers: FSWatcher[] = [];

      // Create and close multiple watchers rapidly
      for (let i = 0; i < 10; i++) {
        const onGenerate = vi.fn().mockResolvedValue(undefined);
        callbacks.push(onGenerate);

        const watcher = createWatcher('./schema.ts', {
          onGenerate,
          debounceMs: 100,
        });
        watchers.push(watcher);

        // Trigger a file change on each watcher
        if (watchCallback) {
          watchCallback('change', 'schema.ts');
        }

        // Close immediately
        watcher.close();
      }

      // Advance time to let any leaked timeouts fire
      await vi.advanceTimersByTimeAsync(500);

      // BUG: None of the callbacks should have been called after their watchers closed
      // Currently this FAILS because timeouts aren't cleared on close
      for (let i = 0; i < callbacks.length; i++) {
        expect(callbacks[i]).not.toHaveBeenCalled();
      }
    });

    it('should allow multiple changes but only call once after close', async () => {
      /**
       * FAILING TEST: Even with multiple rapid changes, closing should prevent all callbacks.
       */
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onGenerate = vi.fn().mockResolvedValue(undefined);
      const watcher = createWatcher('./schema.ts', {
        onGenerate,
        debounceMs: 100,
      });

      // Trigger multiple rapid changes
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
        watchCallback('change', 'schema.ts');
        watchCallback('change', 'schema.ts');
      }

      // Close before any debounce completes
      await vi.advanceTimersByTimeAsync(50);
      watcher.close();

      // Advance past all possible timeouts
      await vi.advanceTimersByTimeAsync(200);

      // BUG: No callbacks should fire after close
      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe('Graceful Shutdown Integration', () => {
    it('should clear timeout when shutdown is triggered via signal', async () => {
      /**
       * FAILING TEST: When SIGINT/SIGTERM triggers shutdown, timeouts should be cleared.
       *
       * This is particularly important for clean test runs.
       */
      let originalProcessOn: typeof process.on;
      let signalHandlers: Map<string, (...args: unknown[]) => void>;

      // Setup signal handler capture
      signalHandlers = new Map();
      originalProcessOn = process.on;
      process.on = vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        signalHandlers.set(event, handler);
        return process;
      }) as unknown as typeof process.on;

      const originalProcessExit = process.exit;
      process.exit = vi.fn() as unknown as typeof process.exit;

      try {
        const fs = await import('node:fs');
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.watch).mockImplementation((_path, callback) => {
          watchCallback = callback as (eventType: string, filename: string) => void;
          return mockWatcher as FSWatcher;
        });

        const { watchGenerate } = await import('../utils/watcher.js');

        const runGeneration = vi.fn().mockResolvedValue(undefined);

        watchGenerate({
          schemaPath: './schema.ts',
          runGeneration,
          debounceMs: 100,
        });

        // Wait for initial generation
        await vi.advanceTimersByTimeAsync(0);
        runGeneration.mockClear(); // Clear the initial generation call

        // Trigger a file change
        if (watchCallback) {
          watchCallback('change', 'schema.ts');
        }

        // Advance partially
        await vi.advanceTimersByTimeAsync(50);

        // Trigger SIGINT shutdown
        const sigintHandler = signalHandlers.get('SIGINT');
        expect(sigintHandler).toBeDefined();
        sigintHandler!();

        // Advance past the timeout
        await vi.advanceTimersByTimeAsync(200);

        // BUG: The regeneration callback should NOT have been called after shutdown
        // Currently this FAILS because watchGenerate's shutdown only calls watcher.close()
        // which doesn't clear the internal timeout
        expect(runGeneration).not.toHaveBeenCalled();
      } finally {
        process.on = originalProcessOn;
        process.exit = originalProcessExit;
      }
    });
  });

  describe('Error Handling During Cleanup', () => {
    it('should not call error handler after watcher is closed', async () => {
      /**
       * FAILING TEST: Error handlers should not be called after close.
       */
      const fs = await import('node:fs');
      vi.mocked(fs.watch).mockImplementation((_path, callback) => {
        watchCallback = callback as (eventType: string, filename: string) => void;
        return mockWatcher as FSWatcher;
      });

      const { createWatcher } = await import('../utils/watcher.js');

      const onError = vi.fn();
      const onGenerate = vi.fn().mockRejectedValue(new Error('Generation failed'));

      const watcher = createWatcher('./schema.ts', {
        onGenerate,
        onError,
        debounceMs: 100,
      });

      // Trigger a file change
      if (watchCallback) {
        watchCallback('change', 'schema.ts');
      }

      // Close before the timeout fires
      await vi.advanceTimersByTimeAsync(50);
      watcher.close();

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(200);

      // BUG: Neither onGenerate nor onError should be called after close
      expect(onGenerate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
