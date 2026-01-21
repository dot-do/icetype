/**
 * Migration History Module for @icetype/migrations
 *
 * Provides interfaces and implementations for tracking applied migrations.
 *
 * @packageDocumentation
 */

import type { Migration, SchemaVersion } from '@icetype/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Record of an applied migration.
 */
export interface MigrationRecord {
  /** The ID of the migration */
  migrationId: string;
  /** Schema version before the migration */
  fromVersion: SchemaVersion;
  /** Schema version after the migration */
  toVersion: SchemaVersion;
  /** When the migration was applied */
  appliedAt: Date;
  /** Checksum for integrity verification */
  checksum: string;
  /** Optional description */
  description?: string;
}

/**
 * Record of a rolled-back migration.
 */
export interface RollbackRecord {
  /** The ID of the migration that was rolled back */
  migrationId: string;
  /** When the migration was rolled back */
  rolledBackAt: Date;
  /** The original migration record before rollback */
  originalRecord: MigrationRecord;
}

/**
 * Result of checking if a rollback is allowed.
 */
export interface RollbackResult {
  /** Whether the rollback is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** List of dependent migrations that would break */
  dependentMigrations?: string[];
  /** List of migrations that would be cascaded if cascade option is used */
  cascadeRollbacks?: string[];
}

/**
 * Result of checking if a migration can be re-applied.
 */
export interface ReapplyResult {
  /** Whether re-applying is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
}

/**
 * Options for recording a migration.
 */
export interface RecordOptions {
  /** Force re-application of a previously rolled-back migration */
  force?: boolean;
}

/**
 * Options for checking rollback permissions.
 */
export interface RollbackCheckOptions {
  /** Allow cascading rollback of dependent migrations */
  cascade?: boolean;
}

/**
 * Options for querying migration history.
 */
export interface HistoryQueryOptions {
  /** Sort order: 'asc' (chronological) or 'desc' (reverse) */
  order?: 'asc' | 'desc';
  /** Maximum number of records to return */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
}

/**
 * Interface for persisting migration records.
 * Implementations can store to database, file, etc.
 */
export interface HistoryStorage {
  /**
   * Save a migration record.
   * @param record - The record to save
   */
  save(record: MigrationRecord): Promise<void>;

  /**
   * Load a migration record by ID.
   * @param migrationId - The ID of the migration
   * @returns The record or null if not found
   */
  load(migrationId: string): Promise<MigrationRecord | null>;

  /**
   * Remove a migration record.
   * @param migrationId - The ID of the migration to remove
   */
  remove(migrationId: string): Promise<void>;

  /**
   * Check if a migration record exists.
   * @param migrationId - The ID of the migration
   * @returns true if the record exists
   */
  has(migrationId: string): Promise<boolean>;

  /**
   * Get all migration records.
   * @param options - Query options
   * @returns Array of migration records
   */
  getAll(options?: HistoryQueryOptions): Promise<MigrationRecord[]>;

  /**
   * Save a rollback record.
   * @param record - The rollback record to save
   */
  saveRollback(record: RollbackRecord): Promise<void>;

  /**
   * Load a rollback record by migration ID.
   * @param migrationId - The ID of the migration
   * @returns The rollback record or null if not found
   */
  loadRollback(migrationId: string): Promise<RollbackRecord | null>;

  /**
   * Check if a migration has been rolled back.
   * @param migrationId - The ID of the migration
   * @returns true if the migration has been rolled back
   */
  hasRollback(migrationId: string): Promise<boolean>;

  /**
   * Get all rollback records.
   * @param options - Query options
   * @returns Array of rollback records
   */
  getAllRollbacks(options?: HistoryQueryOptions): Promise<RollbackRecord[]>;

  /**
   * Remove a rollback record (when re-applying a migration).
   * @param migrationId - The ID of the migration
   */
  removeRollback(migrationId: string): Promise<void>;
}

/**
 * Interface for tracking applied migrations.
 */
export interface MigrationHistory {
  /**
   * Record that a migration has been applied.
   * @param migration - The migration that was applied
   * @param options - Optional options including force flag for re-applying rolled-back migrations
   */
  record(migration: Migration, options?: RecordOptions): Promise<void>;

  /**
   * Check if a migration has been applied.
   * @param migrationId - The ID of the migration
   * @returns true if the migration has been applied
   */
  hasApplied(migrationId: string): Promise<boolean>;

  /**
   * Get the current schema version.
   * @returns The current version, or null if no migrations applied
   */
  getCurrentVersion(): Promise<SchemaVersion | null>;

  /**
   * Get all applied migration records.
   * @param options - Query options
   * @returns Array of migration records
   */
  getAll(options?: HistoryQueryOptions): Promise<MigrationRecord[]>;

  /**
   * Get migrations that haven't been applied yet.
   * @param allMigrations - All available migrations
   * @returns Migrations that are pending
   */
  getPending(allMigrations: Migration[]): Promise<Migration[]>;

  /**
   * Remove a migration record (for rollback).
   * @param migrationId - The ID of the migration to remove
   */
  remove(migrationId: string): Promise<void>;

  /**
   * Verify that a migration's content matches its recorded checksum.
   * @param migration - The migration to verify
   * @returns true if the checksum matches
   */
  verifyIntegrity(migration: Migration): Promise<boolean>;

  /**
   * Record that a migration has been rolled back.
   * This removes the migration from applied state and tracks it as rolled back.
   * @param migrationId - The ID of the migration that was rolled back
   */
  recordRollback(migrationId: string): Promise<void>;

  /**
   * Check if a migration was previously rolled back.
   * @param migrationId - The ID of the migration
   * @returns true if the migration was rolled back
   */
  wasRolledBack(migrationId: string): Promise<boolean>;

  /**
   * Get the rollback record for a migration.
   * @param migrationId - The ID of the migration
   * @returns The rollback record or null if not found
   */
  getRollbackRecord(migrationId: string): Promise<RollbackRecord | null>;

  /**
   * Get all rolled-back migrations.
   * @returns Array of rollback records
   */
  getRolledBackMigrations(): Promise<RollbackRecord[]>;

  /**
   * Check if a rollback is allowed for a migration.
   * Validates that the migration was applied and checks for dependent migrations.
   * @param migrationId - The ID of the migration to rollback
   * @param options - Optional options including cascade flag
   * @returns Result indicating if rollback is allowed
   */
  canRollback(migrationId: string, options?: RollbackCheckOptions): Promise<RollbackResult>;

  /**
   * Check if a rolled-back migration can be re-applied.
   * @param migrationId - The ID of the migration
   * @param options - Optional options including force flag
   * @returns Result indicating if re-apply is allowed
   */
  canReapply(migrationId: string, options?: RecordOptions): Promise<ReapplyResult>;
}

// =============================================================================
// Checksum Implementation
// =============================================================================

/**
 * Simple hash function for generating checksums.
 * Uses a basic FNV-1a hash for consistency.
 */
function hashString(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Convert to unsigned 32-bit integer and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generate a checksum for a migration's content.
 */
function generateChecksum(migration: Migration): string {
  // Create a deterministic string representation of the migration
  const content = JSON.stringify({
    id: migration.id,
    fromVersion: migration.fromVersion,
    toVersion: migration.toVersion,
    operations: migration.operations,
  });
  return hashString(content);
}

// =============================================================================
// In-Memory Storage Implementation
// =============================================================================

/**
 * In-memory implementation of HistoryStorage.
 * Useful for testing and development.
 */
export class InMemoryHistoryStorage implements HistoryStorage {
  private records: Map<string, MigrationRecord> = new Map();
  private rollbacks: Map<string, RollbackRecord> = new Map();

  async save(record: MigrationRecord): Promise<void> {
    this.records.set(record.migrationId, { ...record });
  }

  async load(migrationId: string): Promise<MigrationRecord | null> {
    const record = this.records.get(migrationId);
    return record ? { ...record } : null;
  }

  async remove(migrationId: string): Promise<void> {
    this.records.delete(migrationId);
  }

  async has(migrationId: string): Promise<boolean> {
    return this.records.has(migrationId);
  }

  async getAll(options?: HistoryQueryOptions): Promise<MigrationRecord[]> {
    let records = Array.from(this.records.values());

    // Sort by appliedAt
    records.sort((a, b) => {
      const diff = a.appliedAt.getTime() - b.appliedAt.getTime();
      return options?.order === 'desc' ? -diff : diff;
    });

    // Apply offset and limit
    if (options?.offset) {
      records = records.slice(options.offset);
    }
    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return records.map((r) => ({ ...r }));
  }

  async saveRollback(record: RollbackRecord): Promise<void> {
    this.rollbacks.set(record.migrationId, {
      ...record,
      originalRecord: { ...record.originalRecord },
    });
  }

  async loadRollback(migrationId: string): Promise<RollbackRecord | null> {
    const record = this.rollbacks.get(migrationId);
    if (!record) return null;
    return {
      ...record,
      originalRecord: { ...record.originalRecord },
    };
  }

  async hasRollback(migrationId: string): Promise<boolean> {
    return this.rollbacks.has(migrationId);
  }

  async getAllRollbacks(options?: HistoryQueryOptions): Promise<RollbackRecord[]> {
    let records = Array.from(this.rollbacks.values());

    // Sort by rolledBackAt
    records.sort((a, b) => {
      const diff = a.rolledBackAt.getTime() - b.rolledBackAt.getTime();
      return options?.order === 'desc' ? -diff : diff;
    });

    // Apply offset and limit
    if (options?.offset) {
      records = records.slice(options.offset);
    }
    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return records.map((r) => ({
      ...r,
      originalRecord: { ...r.originalRecord },
    }));
  }

  async removeRollback(migrationId: string): Promise<void> {
    this.rollbacks.delete(migrationId);
  }

  /**
   * Clear all records (useful for testing).
   */
  clear(): void {
    this.records.clear();
    this.rollbacks.clear();
  }
}

// =============================================================================
// Migration History Implementation
// =============================================================================

class DefaultMigrationHistory implements MigrationHistory {
  constructor(private readonly storage: HistoryStorage) {}

  async record(migration: Migration, options?: RecordOptions): Promise<void> {
    // Check if this migration was previously rolled back
    const wasRolledBack = await this.wasRolledBack(migration.id);
    if (wasRolledBack && !options?.force) {
      throw new Error(
        `Migration ${migration.id} was previously rolled back. Use force option to re-apply.`
      );
    }

    const record: MigrationRecord = {
      migrationId: migration.id,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      appliedAt: new Date(),
      checksum: generateChecksum(migration),
      description: migration.description,
    };

    await this.storage.save(record);

    // If re-applying a rolled-back migration with force, clear the rollback record
    if (wasRolledBack && options?.force) {
      await this.storage.removeRollback(migration.id);
    }
  }

  async hasApplied(migrationId: string): Promise<boolean> {
    return this.storage.has(migrationId);
  }

  async getCurrentVersion(): Promise<SchemaVersion | null> {
    const records = await this.storage.getAll({ order: 'desc', limit: 1 });

    if (records.length === 0) {
      return null;
    }

    return records[0]!.toVersion;
  }

  async getAll(options?: HistoryQueryOptions): Promise<MigrationRecord[]> {
    return this.storage.getAll(options);
  }

  async getPending(allMigrations: Migration[]): Promise<Migration[]> {
    const pending: Migration[] = [];

    for (const migration of allMigrations) {
      const applied = await this.hasApplied(migration.id);
      if (!applied) {
        pending.push(migration);
      }
    }

    return pending;
  }

  async remove(migrationId: string): Promise<void> {
    await this.storage.remove(migrationId);
  }

  async verifyIntegrity(migration: Migration): Promise<boolean> {
    const record = await this.storage.load(migration.id);

    if (!record) {
      // Migration hasn't been applied yet
      return true;
    }

    const currentChecksum = generateChecksum(migration);
    return record.checksum === currentChecksum;
  }

  async recordRollback(migrationId: string): Promise<void> {
    // Get the original migration record
    const originalRecord = await this.storage.load(migrationId);

    if (!originalRecord) {
      throw new Error(`Cannot rollback migration ${migrationId}: not found in history`);
    }

    // Create rollback record
    const rollbackRecord: RollbackRecord = {
      migrationId,
      rolledBackAt: new Date(),
      originalRecord,
    };

    // Save the rollback record
    await this.storage.saveRollback(rollbackRecord);

    // Remove the migration from applied state
    await this.storage.remove(migrationId);
  }

  async wasRolledBack(migrationId: string): Promise<boolean> {
    return this.storage.hasRollback(migrationId);
  }

  async getRollbackRecord(migrationId: string): Promise<RollbackRecord | null> {
    return this.storage.loadRollback(migrationId);
  }

  async getRolledBackMigrations(): Promise<RollbackRecord[]> {
    return this.storage.getAllRollbacks();
  }

  async canRollback(migrationId: string, options?: RollbackCheckOptions): Promise<RollbackResult> {
    // Check if migration was applied
    const wasApplied = await this.hasApplied(migrationId);
    if (!wasApplied) {
      return {
        allowed: false,
        reason: `Migration ${migrationId} was not applied or has already been rolled back`,
      };
    }

    // Get the migration record to check its version
    const migrationRecord = await this.storage.load(migrationId);
    if (!migrationRecord) {
      return {
        allowed: false,
        reason: `Migration ${migrationId} record not found`,
      };
    }

    // Check for dependent migrations (migrations that depend on this one's toVersion)
    const allRecords = await this.storage.getAll({ order: 'asc' });
    const dependentMigrations: string[] = [];

    for (const record of allRecords) {
      if (record.migrationId === migrationId) continue;

      // A migration is dependent if its fromVersion matches our toVersion
      if (
        record.fromVersion.major === migrationRecord.toVersion.major &&
        record.fromVersion.minor === migrationRecord.toVersion.minor &&
        record.fromVersion.patch === migrationRecord.toVersion.patch
      ) {
        dependentMigrations.push(record.migrationId);
      }
    }

    if (dependentMigrations.length > 0) {
      if (options?.cascade) {
        // With cascade option, rollback is allowed but we return the list of cascaded rollbacks
        return {
          allowed: true,
          cascadeRollbacks: dependentMigrations,
        };
      }

      return {
        allowed: false,
        reason: `Cannot rollback migration ${migrationId}: dependent migrations exist`,
        dependentMigrations,
      };
    }

    return {
      allowed: true,
    };
  }

  async canReapply(migrationId: string, options?: RecordOptions): Promise<ReapplyResult> {
    const wasRolledBack = await this.wasRolledBack(migrationId);

    if (!wasRolledBack) {
      // Not rolled back, so it can be applied normally
      return { allowed: true };
    }

    if (options?.force) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Migration ${migrationId} was previously rolled back. Use force option to re-apply.`,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a MigrationHistory instance with the given storage.
 *
 * @param storage - The storage backend to use
 * @returns A MigrationHistory instance
 *
 * @example
 * ```typescript
 * // In-memory storage (for testing)
 * const storage = new InMemoryHistoryStorage();
 * const history = createMigrationHistory(storage);
 *
 * // Record a migration
 * await history.record(migration);
 *
 * // Check if applied
 * const applied = await history.hasApplied('migration-1');
 *
 * // Get pending migrations
 * const pending = await history.getPending(allMigrations);
 * ```
 */
export function createMigrationHistory(storage: HistoryStorage): MigrationHistory {
  return new DefaultMigrationHistory(storage);
}
