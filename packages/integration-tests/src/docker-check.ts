/**
 * Docker availability checker for integration tests.
 *
 * This module provides utilities to check if Docker is available
 * and skip tests accordingly if it's not.
 *
 * @packageDocumentation
 */

import { execSync } from 'child_process';

let dockerAvailable: boolean | null = null;

/**
 * Check if Docker is available and running.
 *
 * This function caches the result for subsequent calls.
 *
 * @returns true if Docker is available and running, false otherwise
 */
export function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) {
    return dockerAvailable;
  }

  try {
    // Try to run docker info to check if Docker daemon is running
    execSync('docker info', {
      stdio: 'pipe',
      timeout: 5000,
    });
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
    console.warn(
      '\n[Integration Tests] Docker is not available. Skipping container-based tests.\n' +
        'To run integration tests, ensure Docker is installed and running.\n'
    );
  }

  return dockerAvailable;
}

/**
 * Condition function for skipping tests when Docker is not available.
 *
 * Usage with vitest:
 * ```typescript
 * import { describe } from 'vitest';
 * import { skipIfNoDocker } from './docker-check.js';
 *
 * describe.skipIf(skipIfNoDocker())('PostgreSQL Integration Tests', () => {
 *   // tests...
 * });
 * ```
 */
export function skipIfNoDocker(): boolean {
  return !isDockerAvailable();
}
