/**
 * IceType Schema Parser
 *
 * Parses IceType schema definitions with support for:
 * - Field modifiers: ! (required/unique), # (indexed), ? (optional), [] (array)
 * - Relation operators: -> (forward), ~> (fuzzy), <- (backward), <~ (fuzzy backward)
 * - Parametric types: decimal(10,2), varchar(255)
 * - Generic types: map<string, int>, list<string>
 * - Directives: $partitionBy, $index, $fts, $vector
 *
 * @packageDocumentation
 */

import type {
  FieldDefinition,
  FieldModifier,
  RelationDefinition,
  RelationOperator,
  SchemaDirectives,
  IndexDirective,
  VectorDirective,
  IceTypeSchema,
  ParsedType,
  Token,
  TokenType,
  ValidationResult,
  ValidationError,
  SchemaDefinition,
} from './types.js';

// =============================================================================
// Constants
// =============================================================================

/** Known primitive types */
const PRIMITIVE_TYPES = new Set<string>([
  'string',
  'int',
  'float',
  'double',
  'boolean',
  'bool',
  'uuid',
  'timestamp',
  'timestamptz',
  'date',
  'time',
  'json',
  'text',
  'binary',
  'long',
  'bigint',
]);

/** Parametric types that take numeric arguments */
const PARAMETRIC_TYPES = new Set<string>(['decimal', 'varchar', 'char', 'fixed']);

/** Generic types that use angle brackets */
const GENERIC_TYPES = new Set<string>(['map', 'struct', 'enum', 'ref', 'list']);

/** Type aliases mapping to canonical forms */
const TYPE_ALIASES: Record<string, string> = {
  bool: 'boolean',
};

/** Relation operators */
const RELATION_OPERATORS: RelationOperator[] = ['->', '~>', '<-', '<~'];

/** Known directives */
const KNOWN_DIRECTIVES = new Set<string>([
  '$type',
  '$id',
  '$context',
  '$partitionBy',
  '$orderBy',
  '$index',
  '$ttl',
  '$seed',
  '$readonly',
  '$fts',
  '$vector',
]);

// =============================================================================
// Tokenizer
// =============================================================================

/**
 * Tokenize an IceType schema input string.
 *
 * @param input - The input string to tokenize
 * @returns Array of tokens
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  const addToken = (type: TokenType, value: string) => {
    tokens.push({ type, value, line, column });
    column += value.length;
    pos += value.length;
  };

  const peek = (offset = 0): string => input[pos + offset] ?? '';
  const peekTwo = (): string => input.slice(pos, pos + 2);

  while (pos < input.length) {
    const char = input[pos]!;
    const twoChars = peekTwo();

    // Whitespace
    if (char === ' ' || char === '\t') {
      let ws = '';
      while (pos < input.length && (input[pos] === ' ' || input[pos] === '\t')) {
        ws += input[pos];
        pos++;
        column++;
      }
      continue;
    }

    // Newlines
    if (char === '\n') {
      pos++;
      line++;
      column = 1;
      continue;
    }

    if (char === '\r') {
      pos++;
      if (peek() === '\n') {
        pos++;
      }
      line++;
      column = 1;
      continue;
    }

    // Relation operators (2-char)
    if (twoChars === '->' || twoChars === '~>' || twoChars === '<-' || twoChars === '<~') {
      addToken('RELATION_OP', twoChars);
      continue;
    }

    // String literals
    if (char === '"' || char === "'") {
      const quote = char;
      let str = '';
      pos++;
      column++;
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          const nextChar = input[pos + 1];
          if (nextChar === quote || nextChar === '\\') {
            str += nextChar;
            pos += 2;
            column += 2;
          } else {
            str += input[pos]!;
            pos++;
            column++;
          }
        } else {
          str += input[pos]!;
          pos++;
          column++;
        }
      }
      if (input[pos] === quote) {
        pos++;
        column++;
      }
      tokens.push({ type: 'STRING', value: str, line, column: column - str.length - 2 });
      continue;
    }

    // Numbers (including negative)
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(peek(1)))) {
      let num = '';
      if (char === '-') {
        num = '-';
        pos++;
        column++;
      }
      while (pos < input.length && /[0-9.]/.test(input[pos]!)) {
        num += input[pos]!;
        pos++;
        column++;
      }
      tokens.push({ type: 'NUMBER', value: num, line, column: column - num.length });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(char)) {
      let ident = '';
      const startCol = column;
      while (pos < input.length && /[a-zA-Z0-9_$]/.test(input[pos]!)) {
        ident += input[pos]!;
        pos++;
        column++;
      }

      if (ident.startsWith('$')) {
        tokens.push({ type: 'DIRECTIVE', value: ident, line, column: startCol });
      } else if (
        PRIMITIVE_TYPES.has(ident.toLowerCase()) ||
        PARAMETRIC_TYPES.has(ident.toLowerCase()) ||
        GENERIC_TYPES.has(ident.toLowerCase())
      ) {
        tokens.push({ type: 'TYPE', value: ident, line, column: startCol });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: ident, line, column: startCol });
      }
      continue;
    }

    // Modifiers
    if (char === '!' || char === '#' || char === '?') {
      addToken('MODIFIER', char);
      continue;
    }

    // Single character tokens
    switch (char) {
      case '[':
        addToken('LBRACKET', char);
        break;
      case ']':
        addToken('RBRACKET', char);
        break;
      case '{':
        addToken('LBRACE', char);
        break;
      case '}':
        addToken('RBRACE', char);
        break;
      case '(':
        addToken('LPAREN', char);
        break;
      case ')':
        addToken('RPAREN', char);
        break;
      case '<':
        addToken('LANGLE', char);
        break;
      case '>':
        addToken('RANGLE', char);
        break;
      case ',':
        addToken('COMMA', char);
        break;
      case ':':
        addToken('COLON', char);
        break;
      case '=':
        addToken('EQUALS', char);
        break;
      case '|':
        addToken('PIPE', char);
        break;
      default:
        pos++;
        column++;
    }
  }

  tokens.push({ type: 'EOF', value: '', line, column });
  return tokens;
}

// =============================================================================
// Type Inference
// =============================================================================

/**
 * Infer the IceType type from a JavaScript value.
 *
 * @param value - The value to infer type from
 * @returns The inferred IceType type string
 *
 * @example
 * ```typescript
 * inferType('hello')                    // 'string'
 * inferType(42)                         // 'int'
 * inferType(3.14)                       // 'float'
 * inferType(true)                       // 'bool'
 * inferType('2024-01-15')               // 'date'
 * inferType('2024-01-15T10:30:00Z')     // 'timestamp'
 * inferType('550e8400-e29b-41d4-a716-446655440000') // 'uuid'
 * inferType([1, 2, 3])                  // 'int[]'
 * inferType({ foo: 'bar' })             // 'json'
 * ```
 */
export function inferType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'json?';
  }

  const jsType = typeof value;

  switch (jsType) {
    case 'string': {
      const strValue = value as string;
      // UUID pattern
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
        return 'uuid';
      }
      // ISO timestamp
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(strValue)) {
        return 'timestamp';
      }
      // Date
      if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        return 'date';
      }
      // Time
      if (/^\d{2}:\d{2}:\d{2}$/.test(strValue)) {
        return 'time';
      }
      return 'string';
    }

    case 'number': {
      const numValue = value as number;
      if (Number.isInteger(numValue)) {
        if (numValue > 2147483647 || numValue < -2147483648) {
          return 'bigint';
        }
        return 'int';
      }
      return 'float';
    }

    case 'boolean':
      return 'bool';

    case 'object': {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return 'json[]';
        }
        const elementType = inferType(value[0]);
        return `${elementType}[]`;
      }
      if (value instanceof Date) {
        return 'timestamp';
      }
      if (value instanceof Uint8Array) {
        return 'binary';
      }
      return 'json';
    }

    case 'bigint':
      return 'bigint';

    default:
      return 'json';
  }
}

// =============================================================================
// Default Value Parser
// =============================================================================

/**
 * Parse a default value string into the appropriate type.
 */
function parseDefaultValue(value: string): unknown {
  const trimmed = value.trim();

  // Function call: now(), uuid(), gen_random_uuid()
  const funcMatch = trimmed.match(/^(\w+)\(\)$/);
  if (funcMatch) {
    return { function: funcMatch[1] };
  }

  // Boolean literals
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Null literal
  if (trimmed === 'null') return null;

  // Empty object
  if (trimmed === '{}') return {};

  // Empty array
  if (trimmed === '[]') return [];

  // Quoted string (double quotes)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }

  // Quoted string (single quotes)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'");
  }

  // Numeric value
  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    if (Number.isInteger(num) && !trimmed.includes('.')) {
      return parseInt(trimmed, 10);
    }
    return num;
  }

  return trimmed;
}

// =============================================================================
// Type String Parser
// =============================================================================

interface ParseTypeOptions {
  throwOnUnknownType?: boolean;
}

/**
 * Parse a type string into a ParsedType object.
 *
 * Syntax: `<type>[(<params>)][<modifiers>][[]]['=' <default>]`
 *
 * @param input - The type string to parse
 * @param options - Parsing options
 * @returns The parsed type
 */
function parseTypeString(input: string, options: ParseTypeOptions = {}): ParsedType {
  const { throwOnUnknownType = true } = options;
  let str = input.trim();

  if (!str) {
    throw new Error('Empty type string');
  }

  if (/^[?!#]/.test(str)) {
    throw new Error('Invalid modifier position: modifiers must come after the type name');
  }

  // 1. Extract default value (after ' = ')
  let defaultValue: unknown = undefined;
  const defaultMatch = str.match(/^(.+?)\s*=\s*(.+)$/);
  if (defaultMatch && defaultMatch[1] && defaultMatch[2]) {
    str = defaultMatch[1].trim();
    defaultValue = parseDefaultValue(defaultMatch[2].trim());
  }

  // 2. Extract modifiers from the end (?, !, #)
  let optional = false;
  let unique = false;
  let indexed = false;
  let required = false;

  while (str.length > 0) {
    const lastChar = str[str.length - 1];
    if (lastChar === '?') {
      optional = true;
      str = str.slice(0, -1);
    } else if (lastChar === '!') {
      required = true;
      unique = true;
      str = str.slice(0, -1);
    } else if (lastChar === '#') {
      indexed = true;
      unique = true;
      str = str.slice(0, -1);
    } else {
      break;
    }
  }

  // 3. Extract array suffix []
  let isArray = false;
  if (str.endsWith('[]')) {
    isArray = true;
    str = str.slice(0, -2);
  }

  // 4. Check for generic types (map<...>, struct<...>, etc.)
  const genericMatch = str.match(/^(\w+)<(.+)>$/);
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    const genericType = genericMatch[1].toLowerCase();
    const innerContent = genericMatch[2].trim();

    if (!GENERIC_TYPES.has(genericType)) {
      throw new Error(`Unknown generic type: ${genericType}`);
    }

    const result: ParsedType = {
      type: genericType,
      optional,
      unique,
      indexed,
      required,
    };

    if (isArray) result.array = true;

    if (genericType === 'map') {
      const parts = splitGenericParams(innerContent);
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Map type requires exactly 2 type parameters: ${input}`);
      }
      result.keyType = parts[0].trim().toLowerCase();
      result.valueType = parts[1].trim().toLowerCase();
    } else if (genericType === 'struct') {
      result.structName = innerContent.trim();
    } else if (genericType === 'enum') {
      result.enumName = innerContent.trim();
    } else if (genericType === 'ref') {
      result.refTarget = innerContent.trim();
    } else if (genericType === 'list') {
      result.elementType = innerContent.trim().toLowerCase();
    }

    if (defaultValue !== undefined) result.default = defaultValue;

    return result;
  }

  // 5. Check for parametric types with parentheses
  const parametricMatch = str.match(/^(\w+)\((.+)\)$/);
  if (parametricMatch && parametricMatch[1] && parametricMatch[2]) {
    const typeName = parametricMatch[1].toLowerCase();
    const paramsStr = parametricMatch[2].trim();

    if (!PARAMETRIC_TYPES.has(typeName)) {
      throw new Error(`Unknown parametric type: ${typeName}`);
    }

    const params = paramsStr.split(',').map((p) => {
      const trimmed = p.trim();
      const num = parseInt(trimmed, 10);
      if (isNaN(num)) {
        throw new Error(`Invalid parameter value: ${trimmed}`);
      }
      return num;
    });

    const result: ParsedType = {
      type: typeName,
      optional,
      unique,
      indexed,
      required,
    };

    if (isArray) result.array = true;

    if (typeName === 'decimal') {
      result.precision = params[0];
      result.scale = params.length > 1 ? params[1] : 0;
    } else if (typeName === 'varchar' || typeName === 'char' || typeName === 'fixed') {
      result.length = params[0];
    }

    if (defaultValue !== undefined) result.default = defaultValue;

    return result;
  }

  // 6. Simple type name
  let typeName = str.toLowerCase();

  const alias = TYPE_ALIASES[typeName];
  if (alias) {
    typeName = alias;
  }

  if (throwOnUnknownType && !PRIMITIVE_TYPES.has(typeName) && !PARAMETRIC_TYPES.has(typeName)) {
    throw new Error(`Unknown type: ${str}`);
  }

  const result: ParsedType = {
    type: typeName,
    optional,
    unique,
    indexed,
    required,
  };

  if (isArray) result.array = true;
  if (defaultValue !== undefined) result.default = defaultValue;

  return result;
}

/**
 * Split generic parameters by comma, respecting nested angle brackets.
 */
function splitGenericParams(content: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of content) {
    if (char === '<') {
      depth++;
      current += char;
    } else if (char === '>') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

// =============================================================================
// Relation Parser
// =============================================================================

function isRelationString(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  return RELATION_OPERATORS.some((op) => trimmed.includes(op));
}

function findOperator(input: string): { operator: RelationOperator; index: number } | null {
  let bestMatch: { operator: RelationOperator; index: number } | null = null;

  for (const op of RELATION_OPERATORS) {
    const index = input.indexOf(op);
    if (index !== -1) {
      if (bestMatch === null || index < bestMatch.index) {
        bestMatch = { operator: op, index };
      }
    }
  }

  return bestMatch;
}

/**
 * Parse a relation string into a RelationDefinition.
 *
 * Operators:
 * - `->` - Forward relation (direct foreign key)
 * - `~>` - Fuzzy forward (weak reference, AI-powered matching)
 * - `<-` - Backward relation (reverse reference)
 * - `<~` - Fuzzy backward (AI-powered reverse lookup)
 *
 * @param input - The relation string to parse
 * @returns The parsed relation definition
 */
function parseRelationString(input: string): RelationDefinition & { array?: boolean; optional?: boolean } {
  if (!input || typeof input !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Input must be a non-empty string');
  }

  const opMatch = findOperator(trimmed);
  if (!opMatch) {
    throw new Error('No valid relation operator found');
  }

  const { operator, index } = opMatch;
  let targetPart = trimmed.slice(index + operator.length).trim();

  if (!targetPart) {
    throw new Error('Relation operator requires a target type');
  }

  let isArray = false;
  let isOptional = false;

  let foundModifier = true;
  while (foundModifier) {
    foundModifier = false;

    if (targetPart.endsWith('?')) {
      isOptional = true;
      targetPart = targetPart.slice(0, -1);
      foundModifier = true;
    } else if (targetPart.endsWith('[]')) {
      isArray = true;
      targetPart = targetPart.slice(0, -2);
      foundModifier = true;
    }
  }

  let targetType = targetPart;
  let inverse: string | undefined;

  if (targetPart.includes('.')) {
    const dotParts = targetPart.split('.');
    if (dotParts.length === 2 && dotParts[0] && dotParts[1]) {
      targetType = dotParts[0].trim();
      inverse = dotParts[1].trim();
    }
  }

  const result: RelationDefinition & { array?: boolean; optional?: boolean } = {
    operator,
    targetType,
  };

  if (inverse) {
    result.inverse = inverse;
  }

  if (isArray) {
    result.array = true;
  }

  if (isOptional) {
    result.optional = true;
  }

  return result;
}

// =============================================================================
// IceType Parser Class
// =============================================================================

/**
 * IceType schema parser.
 *
 * Parses IceType schema definitions including field definitions,
 * relations, and directives.
 */
export class IceTypeParser {
  /**
   * Parse a complete IceType schema definition.
   *
   * @param definition - The schema definition object
   * @returns The parsed IceType schema
   */
  parse(definition: SchemaDefinition): IceTypeSchema {
    const name = (definition.$type as string) || 'Unknown';
    const fields = new Map<string, FieldDefinition>();
    const relations = new Map<string, RelationDefinition>();
    const directives = this.parseDirectives(definition);

    for (const [key, value] of Object.entries(definition)) {
      if (key.startsWith('$')) continue;

      if (typeof value === 'string') {
        const fieldDef = this.parseField(value, { throwOnUnknownType: false });
        fieldDef.name = key;

        if (fieldDef.relation) {
          relations.set(key, fieldDef.relation);
        }

        fields.set(key, fieldDef);
      } else if (typeof value === 'object' && value !== null) {
        const fieldDef: FieldDefinition = {
          name: key,
          type: 'json',
          modifier: '',
          isArray: false,
          isOptional: false,
          isUnique: false,
          isIndexed: false,
        };
        fields.set(key, fieldDef);
      }
    }

    const now = Date.now();

    return {
      name,
      fields,
      directives,
      relations,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Parse a single field definition string.
   *
   * @param fieldDef - The field definition string
   * @param options - Parsing options
   * @returns The parsed field definition
   */
  parseField(fieldDef: string, options: ParseTypeOptions = {}): FieldDefinition {
    const trimmed = fieldDef.trim();

    if (isRelationString(trimmed)) {
      const relation = parseRelationString(trimmed);
      return {
        name: '',
        type: relation.targetType,
        modifier: relation.optional ? '?' : '',
        isArray: relation.array || false,
        isOptional: relation.optional || false,
        isUnique: false,
        isIndexed: false,
        relation,
      };
    }

    const parsed = parseTypeString(trimmed, options);

    let modifier: FieldModifier = '';
    if (parsed.required) {
      modifier = '!';
    } else if (parsed.unique || parsed.indexed) {
      modifier = '#';
    } else if (parsed.optional) {
      modifier = '?';
    }

    return {
      name: '',
      type: parsed.type,
      modifier,
      isArray: parsed.array || false,
      isOptional: parsed.optional,
      isUnique: parsed.unique,
      isIndexed: parsed.indexed,
      defaultValue: parsed.default,
      precision: parsed.precision,
      scale: parsed.scale,
      length: parsed.length,
    };
  }

  /**
   * Parse a relation definition string.
   *
   * @param relDef - The relation definition string
   * @returns The parsed relation definition
   */
  parseRelation(relDef: string): RelationDefinition {
    const result = parseRelationString(relDef);
    return {
      operator: result.operator,
      targetType: result.targetType,
      inverse: result.inverse,
      onDelete: result.onDelete,
    };
  }

  /**
   * Parse schema directives from a definition object.
   *
   * @param definition - The definition object containing directives
   * @returns The parsed schema directives
   */
  parseDirectives(definition: SchemaDefinition): SchemaDirectives {
    const directives: SchemaDirectives = {};

    for (const [key, value] of Object.entries(definition)) {
      if (!key.startsWith('$')) continue;
      if (!KNOWN_DIRECTIVES.has(key)) continue;

      switch (key) {
        case '$partitionBy':
          if (Array.isArray(value)) {
            directives.partitionBy = value as string[];
          }
          break;

        case '$index':
          if (Array.isArray(value)) {
            directives.index = (value as string[][]).map((fields) => ({
              fields,
              unique: false,
            }));
          }
          break;

        case '$fts':
          if (Array.isArray(value)) {
            directives.fts = value as string[];
          }
          break;

        case '$vector':
          if (typeof value === 'object' && value !== null) {
            const vectorDirs: VectorDirective[] = [];
            for (const [field, dims] of Object.entries(value)) {
              vectorDirs.push({
                field,
                dimensions: dims as number,
              });
            }
            directives.vector = vectorDirs;
          }
          break;
      }
    }

    return directives;
  }

  /**
   * Validate a parsed IceType schema.
   *
   * @param schema - The schema to validate
   * @returns The validation result
   */
  validateSchema(schema: IceTypeSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!schema.name || schema.name === 'Unknown') {
      warnings.push({
        path: '$type',
        message: 'Schema name not specified',
        code: 'MISSING_SCHEMA_NAME',
      });
    }

    for (const [fieldName, field] of schema.fields) {
      if (!field.relation && !this.isValidType(field.type)) {
        errors.push({
          path: fieldName,
          message: `Unknown type: ${field.type}`,
          code: 'UNKNOWN_TYPE',
        });
      }

      if (field.isOptional && field.modifier === '!') {
        warnings.push({
          path: fieldName,
          message: 'Field marked as both required (!) and optional (?)',
          code: 'CONFLICTING_MODIFIERS',
        });
      }
    }

    for (const [relName, relation] of schema.relations) {
      if (!relation.targetType) {
        errors.push({
          path: relName,
          message: 'Relation missing target type',
          code: 'MISSING_TARGET_TYPE',
        });
      }
    }

    if (schema.directives.partitionBy) {
      for (const field of schema.directives.partitionBy) {
        if (!schema.fields.has(field)) {
          errors.push({
            path: `$partitionBy.${field}`,
            message: `Partition field '${field}' does not exist in schema`,
            code: 'UNKNOWN_PARTITION_FIELD',
          });
        }
      }
    }

    if (schema.directives.index) {
      for (const index of schema.directives.index) {
        for (const field of index.fields) {
          if (!schema.fields.has(field)) {
            errors.push({
              path: `$index.${field}`,
              message: `Index field '${field}' does not exist in schema`,
              code: 'UNKNOWN_INDEX_FIELD',
            });
          }
        }
      }
    }

    if (schema.directives.fts) {
      for (const field of schema.directives.fts) {
        if (!schema.fields.has(field)) {
          errors.push({
            path: `$fts.${field}`,
            message: `FTS field '${field}' does not exist in schema`,
            code: 'UNKNOWN_FTS_FIELD',
          });
        }
      }
    }

    if (schema.directives.vector) {
      for (const vector of schema.directives.vector) {
        if (!schema.fields.has(vector.field)) {
          errors.push({
            path: `$vector.${vector.field}`,
            message: `Vector field '${vector.field}' does not exist in schema`,
            code: 'UNKNOWN_VECTOR_FIELD',
          });
        }
        if (vector.dimensions <= 0) {
          errors.push({
            path: `$vector.${vector.field}`,
            message: `Vector dimensions must be positive`,
            code: 'INVALID_VECTOR_DIMENSIONS',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidType(type: string): boolean {
    const normalized = type.toLowerCase();
    return (
      PRIMITIVE_TYPES.has(normalized) ||
      PARAMETRIC_TYPES.has(normalized) ||
      GENERIC_TYPES.has(normalized) ||
      normalized === 'json' ||
      normalized === 'reference' ||
      normalized === 'enum' ||
      normalized === 'array'
    );
  }
}

// =============================================================================
// Convenience Exports
// =============================================================================

/** Default parser instance */
export const parser = new IceTypeParser();

/**
 * Parse an IceType schema definition.
 *
 * @param definition - The schema definition
 * @returns The parsed schema
 */
export function parseSchema(definition: SchemaDefinition): IceTypeSchema {
  return parser.parse(definition);
}

/**
 * Parse a single field definition.
 *
 * @param fieldDef - The field definition string
 * @returns The parsed field definition
 */
export function parseField(fieldDef: string): FieldDefinition {
  return parser.parseField(fieldDef);
}

/**
 * Parse a relation definition.
 *
 * @param relDef - The relation definition string
 * @returns The parsed relation definition
 */
export function parseRelation(relDef: string): RelationDefinition {
  return parser.parseRelation(relDef);
}

/**
 * Parse schema directives.
 *
 * @param definition - The definition object
 * @returns The parsed directives
 */
export function parseDirectives(definition: SchemaDefinition): SchemaDirectives {
  return parser.parseDirectives(definition);
}

/**
 * Validate an IceType schema.
 *
 * @param schema - The schema to validate
 * @returns The validation result
 */
export function validateSchema(schema: IceTypeSchema): ValidationResult {
  return parser.validateSchema(schema);
}
