/**
 * Iceberg Schema Evolution/Migrations from IceType Schema Diffs
 *
 * Generates Iceberg-specific schema evolution operations from IceType schema changes.
 * Apache Iceberg supports in-place schema evolution without rewriting data files.
 *
 * @see https://iceberg.apache.org/docs/latest/evolution/
 * @packageDocumentation
 */

import type { SchemaDiff, SchemaChange, FieldDefinition } from '@icetype/core';
import type { IcebergType } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Iceberg add-column operation
 */
export interface IcebergAddColumn {
  op: 'add-column';
  name: string;
  type: IcebergType;
  required: boolean;
  doc?: string;
}

/**
 * Iceberg drop-column operation
 */
export interface IcebergDropColumn {
  op: 'drop-column';
  name: string;
}

/**
 * Iceberg rename-column operation
 */
export interface IcebergRenameColumn {
  op: 'rename-column';
  oldName: string;
  newName: string;
}

/**
 * Iceberg update-type operation
 */
export interface IcebergUpdateType {
  op: 'update-type';
  name: string;
  newType: IcebergType;
}

/**
 * Iceberg make-optional operation (make column nullable)
 */
export interface IcebergMakeOptional {
  op: 'make-optional';
  name: string;
}

/**
 * Iceberg make-required operation (make column not null)
 */
export interface IcebergMakeRequired {
  op: 'make-required';
  name: string;
}

/**
 * Union of all Iceberg schema evolution operations
 */
export type IcebergOperation =
  | IcebergAddColumn
  | IcebergDropColumn
  | IcebergRenameColumn
  | IcebergUpdateType
  | IcebergMakeOptional
  | IcebergMakeRequired;

/**
 * Iceberg schema update containing a list of operations
 */
export interface IcebergSchemaUpdate {
  operations: IcebergOperation[];
}

// =============================================================================
// Type Mapping
// =============================================================================

/**
 * Map IceType primitive type to Iceberg type
 */
function mapIceTypeToIceberg(iceType: string): IcebergType {
  const normalized = iceType.toLowerCase();

  switch (normalized) {
    case 'string':
    case 'text':
      return { type: 'string' };
    case 'int':
      return { type: 'int' };
    case 'long':
    case 'bigint':
      return { type: 'long' };
    case 'float':
      return { type: 'float' };
    case 'double':
      return { type: 'double' };
    case 'bool':
    case 'boolean':
      return { type: 'boolean' };
    case 'uuid':
      return { type: 'uuid' };
    case 'timestamp':
      return { type: 'timestamp' };
    case 'timestamptz':
      return { type: 'timestamptz' };
    case 'date':
      return { type: 'date' };
    case 'time':
      return { type: 'time' };
    case 'binary':
      return { type: 'binary' };
    case 'json':
      return { type: 'string' };
    case 'decimal':
      return { type: 'decimal', precision: 38, scale: 9 };
    default:
      return { type: 'string' };
  }
}

/**
 * Map a field definition to Iceberg type, handling arrays
 */
function fieldDefinitionToIcebergType(field: FieldDefinition): IcebergType {
  if (field.isArray) {
    const elementType = mapIceTypeToIceberg(field.type);
    return {
      type: 'list',
      elementType,
    };
  }
  return mapIceTypeToIceberg(field.type);
}

// =============================================================================
// Migration Generator
// =============================================================================

/**
 * Generator for Iceberg schema evolution operations from IceType schema diffs.
 *
 * @example
 * ```typescript
 * import { diffSchemas, parseSchema } from '@icetype/core';
 * import { IcebergMigrationGenerator } from '@icetype/iceberg';
 *
 * const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });
 * const newSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string', age: 'int?' });
 *
 * const diff = diffSchemas(oldSchema, newSchema);
 * const generator = new IcebergMigrationGenerator();
 * const update = generator.generateSchemaUpdate(diff);
 *
 * console.log(update.operations);
 * // [{ op: 'add-column', name: 'age', type: { type: 'int' }, required: false }]
 * ```
 */
export class IcebergMigrationGenerator {
  /**
   * Generate Iceberg schema update from a schema diff.
   *
   * @param diff - The schema diff from diffSchemas()
   * @returns An IcebergSchemaUpdate containing evolution operations
   */
  generateSchemaUpdate(diff: SchemaDiff): IcebergSchemaUpdate {
    const operations: IcebergOperation[] = [];

    for (const change of diff.changes) {
      const operation = this.changeToOperation(change);
      if (operation) {
        operations.push(operation);
      }
    }

    return { operations };
  }

  /**
   * Convert a single schema change to an Iceberg operation.
   *
   * @param change - A schema change from the diff
   * @returns The corresponding Iceberg operation, or null if not applicable
   */
  private changeToOperation(change: SchemaChange): IcebergOperation | null {
    switch (change.type) {
      case 'add_field':
        return this.createAddColumn(change.field, change.definition);

      case 'remove_field':
        return this.createDropColumn(change.field);

      case 'rename_field':
        return this.createRenameColumn(change.oldName, change.newName);

      case 'change_type':
        return this.createUpdateType(change.field, change.newType);

      case 'change_modifier':
        return this.createModifierChange(change.field, change.oldModifier, change.newModifier);

      case 'change_directive':
        // Directive changes (like $partitionBy) don't affect Iceberg schema evolution
        // They would be handled separately through partition spec evolution
        return null;

      default:
        return null;
    }
  }

  /**
   * Create an add-column operation.
   */
  private createAddColumn(name: string, definition: FieldDefinition): IcebergAddColumn {
    const type = fieldDefinitionToIcebergType(definition);
    const required = definition.modifier === '!' && !definition.isOptional;

    return {
      op: 'add-column',
      name,
      type,
      required,
      doc: name, // Use field name as documentation
    };
  }

  /**
   * Create a drop-column operation.
   */
  private createDropColumn(name: string): IcebergDropColumn {
    return {
      op: 'drop-column',
      name,
    };
  }

  /**
   * Create a rename-column operation.
   */
  private createRenameColumn(oldName: string, newName: string): IcebergRenameColumn {
    return {
      op: 'rename-column',
      oldName,
      newName,
    };
  }

  /**
   * Create an update-type operation.
   */
  private createUpdateType(name: string, newType: string): IcebergUpdateType {
    return {
      op: 'update-type',
      name,
      newType: mapIceTypeToIceberg(newType),
    };
  }

  /**
   * Create a modifier change operation (make-optional or make-required).
   */
  private createModifierChange(
    name: string,
    oldModifier: string,
    newModifier: string
  ): IcebergMakeOptional | IcebergMakeRequired | null {
    // Detect transition from required to optional
    if ((oldModifier === '!' || oldModifier === '#' || oldModifier === '') && newModifier === '?') {
      return {
        op: 'make-optional',
        name,
      };
    }

    // Detect transition from optional to required
    if (oldModifier === '?' && (newModifier === '!' || newModifier === '#' || newModifier === '')) {
      return {
        op: 'make-required',
        name,
      };
    }

    // Other modifier changes (e.g., adding/removing index) don't affect schema evolution
    return null;
  }

  /**
   * Serialize an Iceberg schema update to JSON.
   *
   * @param update - The schema update to serialize
   * @returns Pretty-printed JSON string
   */
  serializeUpdate(update: IcebergSchemaUpdate): string {
    return JSON.stringify(update, null, 2);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new Iceberg migration generator.
 */
export function createIcebergMigrationGenerator(): IcebergMigrationGenerator {
  return new IcebergMigrationGenerator();
}

/**
 * Generate an Iceberg schema update from a schema diff.
 *
 * @example
 * ```typescript
 * import { diffSchemas, parseSchema } from '@icetype/core';
 * import { generateIcebergSchemaUpdate } from '@icetype/iceberg';
 *
 * const oldSchema = parseSchema({ $type: 'User', id: 'uuid!', name: 'string' });
 * const newSchema = parseSchema({ $type: 'User', id: 'uuid!', fullName: 'string' });
 *
 * const diff = diffSchemas(oldSchema, newSchema);
 * const update = generateIcebergSchemaUpdate(diff);
 *
 * console.log(update.operations);
 * // [{ op: 'rename-column', oldName: 'name', newName: 'fullName' }]
 * ```
 */
export function generateIcebergSchemaUpdate(diff: SchemaDiff): IcebergSchemaUpdate {
  const generator = new IcebergMigrationGenerator();
  return generator.generateSchemaUpdate(diff);
}
