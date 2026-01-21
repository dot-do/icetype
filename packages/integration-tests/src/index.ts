/**
 * @icetype/integration-tests
 *
 * Integration tests for IceType database adapters using testcontainers.
 * These tests verify that generated DDL works against real database instances.
 *
 * @packageDocumentation
 */

export { isDockerAvailable, skipIfNoDocker } from './docker-check.js';
