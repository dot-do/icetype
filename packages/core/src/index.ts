/**
 * @icetype/core
 *
 * IceType schema language - parser, types, and validation.
 *
 * IceType is a type-safe, concise schema language with:
 * - Field modifiers: `!` (required), `#` (indexed), `?` (optional), `[]` (array)
 * - Relation operators: `->` (forward), `~>` (fuzzy), `<-` (backward), `<~` (fuzzy backward)
 * - AI generation directives: `~>` for auto-generation from source fields
 * - Directives: `$partitionBy`, `$index`, `$fts`, `$vector`
 *
 * @example
 * ```typescript
 * import { parseSchema, validateSchema, inferType } from '@icetype/core';
 *
 * // Define a schema
 * const userSchema = parseSchema({
 *   $type: 'User',
 *   $partitionBy: ['id'],
 *   $index: [['email'], ['createdAt']],
 *
 *   id: 'uuid!',           // Required UUID
 *   email: 'string#',      // Indexed string
 *   name: 'string',        // Regular string
 *   age: 'int?',           // Optional integer
 *   status: 'string = "active"',  // Default value
 *   posts: '<- Post.author[]',    // Backward relation
 * });
 *
 * // Validate the schema
 * const result = validateSchema(userSchema);
 * if (!result.valid) {
 *   console.error('Schema errors:', result.errors);
 * }
 *
 * // Infer types from values
 * inferType('hello')                  // 'string'
 * inferType(42)                       // 'int'
 * inferType('2024-01-15T10:30:00Z')   // 'timestamp'
 * ```
 *
 * @packageDocumentation
 */

// Re-export all types
export type {
  // Branded types
  SchemaId,
  FieldId,
  RelationId,

  // Field and schema types
  FieldModifier,
  RelationOperator,
  PrimitiveType,
  ParametricType,
  GenericType,
  FieldDefinition,
  RelationDefinition,
  IndexDirective,
  VectorDirective,
  SchemaDirectives,
  IceTypeSchema,

  // Validation types
  ValidationError,
  ValidationResult,

  // Parser types
  ParsedType,
  Token,
  TokenType,
  SchemaDefinition,
} from './types.js';

// Re-export ParseError class and branded type creators
export {
  ParseError,
  createSchemaId,
  createFieldId,
  createRelationId,
} from './types.js';

// Re-export parser functions
export {
  // Parser class
  IceTypeParser,
  parser,

  // Convenience functions
  parseSchema,
  parseField,
  parseRelation,
  parseDirectives,
  validateSchema,

  // Utilities
  tokenize,
  inferType,

  // Type guards
  isValidPrimitiveType,
  isValidModifier,
  isValidRelationOperator,
  isValidParametricType,
  isValidGenericType,
} from './parser.js';
