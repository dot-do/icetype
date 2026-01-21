/**
 * Core type definitions for IceType schema language
 *
 * IceType is a type-safe, concise schema language with:
 * - Field modifiers: ! (required), # (indexed), ? (optional), [] (array)
 * - Relation operators: -> (forward), ~> (fuzzy), <- (backward), <~ (fuzzy backward)
 * - AI generation directives: ~> for auto-generation from source fields
 * - Directives: $partitionBy, $index, $fts, $vector
 *
 * @packageDocumentation
 */

// =============================================================================
// Branded Types for Type-Safe IDs
// =============================================================================

/** Branded type for schema identifiers */
export type SchemaId = string & { readonly __brand: 'SchemaId' };

/** Branded type for field identifiers (index position) */
export type FieldId = number & { readonly __brand: 'FieldId' };

/** Branded type for relation identifiers */
export type RelationId = string & { readonly __brand: 'RelationId' };

/** Create a SchemaId from a string */
export function createSchemaId(id: string): SchemaId {
  // Validate non-empty string
  if (!id || id.trim() === '') {
    throw new TypeError('Invalid SchemaId: identifier cannot be empty or whitespace-only');
  }
  // Validate identifier pattern (cannot start with a number)
  if (/^\d/.test(id)) {
    throw new TypeError(`Invalid SchemaId: identifier cannot start with a number: "${id}"`);
  }
  return id as SchemaId;
}

/** Create a FieldId from a number */
export function createFieldId(id: number): FieldId {
  // Validate finite number (not NaN or Infinity)
  if (!Number.isFinite(id)) {
    if (Number.isNaN(id)) {
      throw new TypeError(`Invalid FieldId: value cannot be NaN`);
    }
    throw new TypeError(`Invalid FieldId: value cannot be Infinity`);
  }
  // Validate integer
  if (!Number.isInteger(id)) {
    throw new TypeError(`Invalid FieldId: value must be an integer, got ${id}`);
  }
  // Validate non-negative
  if (id < 0) {
    throw new TypeError(`Invalid FieldId: value must be non-negative, got ${id}`);
  }
  return id as FieldId;
}

/** Create a RelationId from a string */
export function createRelationId(id: string): RelationId {
  // Validate non-empty string
  if (!id || id.trim() === '') {
    throw new TypeError('Invalid RelationId: identifier cannot be empty or whitespace-only');
  }
  return id as RelationId;
}

// =============================================================================
// Field Modifiers and Operators
// =============================================================================

/** IceType field modifiers */
export type FieldModifier = '!' | '#' | '?' | '';

/** IceType relation operators */
export type RelationOperator = '->' | '~>' | '<-' | '<~';

// =============================================================================
// Primitive Types
// =============================================================================

/** IceType primitive types */
export type PrimitiveType =
  | 'string'
  | 'text'
  | 'int'
  | 'long'
  | 'bigint'
  | 'float'
  | 'double'
  | 'bool'
  | 'boolean'
  | 'timestamp'
  | 'timestamptz'
  | 'date'
  | 'time'
  | 'uuid'
  | 'json'
  | 'binary';

/** Parametric types that take numeric arguments */
export type ParametricType = 'decimal' | 'varchar' | 'char' | 'fixed';

/** Generic types that use angle brackets */
export type GenericType = 'map' | 'struct' | 'enum' | 'ref' | 'list';

// =============================================================================
// Field Definition
// =============================================================================

/** IceType field definition */
export interface FieldDefinition {
  /** Field name */
  name: string;
  /** Field type (primitive or custom) */
  type: string;
  /** Field modifier (!, #, ?, or empty) */
  modifier: FieldModifier;
  /** Whether field is an array */
  isArray: boolean;
  /** Whether field is optional (?) */
  isOptional: boolean;
  /** Whether field is unique (#) */
  isUnique: boolean;
  /** Whether field is indexed */
  isIndexed: boolean;
  /** Default value if specified */
  defaultValue?: unknown;
  /** Relation definition if this is a relation field */
  relation?: RelationDefinition;
  /** Precision for decimal types */
  precision?: number;
  /** Scale for decimal types */
  scale?: number;
  /** Length for varchar/char types */
  length?: number;
}

// =============================================================================
// Relation Definition
// =============================================================================

/** IceType relation definition */
export interface RelationDefinition {
  /** Relation operator */
  operator: RelationOperator;
  /** Target type name */
  targetType: string;
  /** Inverse relation name (for backward refs) */
  inverse?: string;
  /** Cascade behavior on delete */
  onDelete?: 'cascade' | 'set_null' | 'restrict';
}

// =============================================================================
// Schema Directives
// =============================================================================

/** Index directive configuration */
export interface IndexDirective {
  /** Fields to include in index */
  fields: string[];
  /** Whether index is unique */
  unique?: boolean;
  /** Optional index name */
  name?: string;
}

/** Vector index directive */
export interface VectorDirective {
  /** Field name containing vectors */
  field: string;
  /** Vector dimensions */
  dimensions: number;
  /** Distance metric */
  metric?: 'cosine' | 'euclidean' | 'dot';
}

/** IceType schema directives */
export interface SchemaDirectives {
  /** Partition key fields */
  partitionBy?: string[];
  /** Secondary indexes */
  index?: IndexDirective[];
  /** Full-text search fields */
  fts?: string[];
  /** Vector index configuration */
  vector?: VectorDirective[];
}

// =============================================================================
// Complete Schema
// =============================================================================

/** Complete IceType schema */
export interface IceTypeSchema {
  /** Schema/entity name */
  name: string;
  /** Field definitions */
  fields: Map<string, FieldDefinition>;
  /** Schema directives */
  directives: SchemaDirectives;
  /** Relation definitions */
  relations: Map<string, RelationDefinition>;
  /** Schema version */
  version: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

// =============================================================================
// Validation Types
// =============================================================================

/** Validation error */
export interface ValidationError {
  /** Path to the error (field name or directive) */
  path: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationError[];
}

// =============================================================================
// Parsed Type Result
// =============================================================================

/** Result of parsing a type string */
export interface ParsedType {
  /** The base type name */
  type: string;
  /** Whether type is optional (?) */
  optional: boolean;
  /** Whether type is unique (#) */
  unique: boolean;
  /** Whether type is indexed */
  indexed: boolean;
  /** Whether type is required (!) */
  required: boolean;
  /** Whether type is an array */
  array?: boolean;
  /** Precision for decimal */
  precision?: number;
  /** Scale for decimal */
  scale?: number;
  /** Length for varchar/char */
  length?: number;
  /** Key type for map */
  keyType?: string;
  /** Value type for map */
  valueType?: string;
  /** Struct name */
  structName?: string;
  /** Enum name */
  enumName?: string;
  /** Reference target */
  refTarget?: string;
  /** List element type */
  elementType?: string;
  /** Default value */
  default?: unknown;
}

// =============================================================================
// Token Types (for lexer)
// =============================================================================

/** Token types for lexical analysis */
export type TokenType =
  | 'IDENTIFIER'
  | 'TYPE'
  | 'MODIFIER'
  | 'RELATION_OP'
  | 'DIRECTIVE'
  | 'NUMBER'
  | 'STRING'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LBRACE'
  | 'RBRACE'
  | 'LPAREN'
  | 'RPAREN'
  | 'LANGLE'
  | 'RANGLE'
  | 'COMMA'
  | 'COLON'
  | 'EQUALS'
  | 'PIPE'
  | 'WHITESPACE'
  | 'NEWLINE'
  | 'EOF';

/** Lexical token */
export interface Token {
  /** Token type */
  type: TokenType;
  /** Token value */
  value: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
}

// =============================================================================
// Schema Definition (input format)
// =============================================================================

/** Raw schema definition object (input to parser) */
export type SchemaDefinition = {
  $type?: string;
  $partitionBy?: string[];
  $index?: string[][];
  $fts?: string[];
  $vector?: Record<string, number>;
  [key: string]: unknown;
};

// =============================================================================
// Parse Error (re-exported from errors.ts for backward compatibility)
// =============================================================================

/**
 * Re-export ParseError from errors.ts for backward compatibility.
 * The new implementation in errors.ts extends IceTypeError.
 */
export { ParseError } from './errors.js';
