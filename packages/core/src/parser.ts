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

import {
  ParseError,
  type FieldDefinition,
  type FieldModifier,
  type RelationDefinition,
  type RelationOperator,
  type SchemaDirectives,
  type VectorDirective,
  type IceTypeSchema,
  type ParsedType,
  type Token,
  type TokenType,
  type ValidationResult,
  type ValidationError,
  type SchemaDefinition,
  type PrimitiveType,
  type ParametricType,
  type GenericType,
} from './types.js';

// =============================================================================
// Extended Types
// =============================================================================

/**
 * Extended schema directives interface with projection fields.
 * This extends SchemaDirectives to include projection-specific directives.
 */
export interface SchemaDirectivesExtended extends SchemaDirectives {
  /** Type of projection: oltp, olap, or both */
  projection?: 'oltp' | 'olap' | 'both';
  /** Source entity name to project from */
  from?: string;
  /** Relations to expand/flatten */
  expand?: string[];
  /** Explicit field mappings */
  flatten?: Record<string, string>;
}

// =============================================================================
// Constants
// =============================================================================

/** Known primitive types */
export const PRIMITIVE_TYPES = new Set<string>([
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
export const PARAMETRIC_TYPES = new Set<string>(['decimal', 'varchar', 'char', 'fixed']);

/** Generic types that use angle brackets */
export const GENERIC_TYPES = new Set<string>(['map', 'struct', 'enum', 'ref', 'list']);

/** Type aliases mapping to canonical forms */
export const TYPE_ALIASES: Record<string, string> = {
  bool: 'boolean',
};

/** Relation operators */
export const RELATION_OPERATORS: RelationOperator[] = ['->', '~>', '<-', '<~'];

/** Valid field modifiers */
const VALID_MODIFIERS: FieldModifier[] = ['!', '#', '?', ''];

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a string is a valid primitive type.
 *
 * @param type - The type string to check
 * @returns True if the type is a valid primitive type
 */
export function isValidPrimitiveType(type: string): type is PrimitiveType {
  return PRIMITIVE_TYPES.has(type.toLowerCase());
}

/**
 * Type guard to check if a character is a valid field modifier.
 *
 * @param char - The character to check
 * @returns True if the character is a valid modifier (!, #, ?, or empty string)
 */
export function isValidModifier(char: string): char is FieldModifier {
  return VALID_MODIFIERS.includes(char as FieldModifier);
}

/**
 * Type guard to check if a string is a valid relation operator.
 *
 * @param op - The string to check
 * @returns True if the string is a valid relation operator (->, ~>, <-, <~)
 */
export function isValidRelationOperator(op: string): op is RelationOperator {
  return RELATION_OPERATORS.includes(op as RelationOperator);
}

/**
 * Type guard to check if a string is a valid parametric type.
 *
 * @param type - The type string to check
 * @returns True if the type is a valid parametric type
 */
export function isValidParametricType(type: string): type is ParametricType {
  return PARAMETRIC_TYPES.has(type.toLowerCase());
}

/**
 * Type guard to check if a string is a valid generic type.
 *
 * @param type - The type string to check
 * @returns True if the type is a valid generic type
 */
export function isValidGenericType(type: string): type is GenericType {
  return GENERIC_TYPES.has(type.toLowerCase());
}

/** Known directives */
export const KNOWN_DIRECTIVES = new Set<string>([
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
  // Projection directives
  '$projection',
  '$from',
  '$expand',
  '$flatten',
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
      // Type narrowing: jsType === 'string' guarantees value is string
      if (typeof value !== 'string') {
        return 'string'; // Safety fallback
      }
      // UUID pattern
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return 'uuid';
      }
      // ISO timestamp
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return 'timestamp';
      }
      // Date
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return 'date';
      }
      // Time
      if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
        return 'time';
      }
      return 'string';
    }

    case 'number': {
      // Type narrowing: jsType === 'number' guarantees value is number
      if (typeof value !== 'number') {
        return 'float'; // Safety fallback
      }
      if (Number.isInteger(value)) {
        if (value > 2147483647 || value < -2147483648) {
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
export function parseDefaultValue(value: string): unknown {
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

export interface ParseTypeOptions {
  throwOnUnknownType?: boolean;
  /** Field name for better error context */
  fieldName?: string;
  /** Line number for error reporting */
  line?: number;
  /** Column number for error reporting */
  column?: number;
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
export function parseTypeString(input: string, options: ParseTypeOptions = {}): ParsedType {
  const { throwOnUnknownType = true, fieldName, line = 1, column = 1 } = options;
  let str = input.trim();

  // Helper to build parse error options with optional path
  const makeErrorOpts = (code: string): { line: number; column: number; code: string; path?: string } => {
    const opts: { line: number; column: number; code: string; path?: string } = { line, column, code };
    if (fieldName !== undefined) {
      opts.path = fieldName;
    }
    return opts;
  };

  if (!str) {
    throw new ParseError('Empty type string', makeErrorOpts('EMPTY_TYPE'));
  }

  if (/^[?!#]/.test(str)) {
    throw new ParseError('Invalid modifier position: modifiers must come after the type name', makeErrorOpts('INVALID_MODIFIER_POSITION'));
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
      throw new ParseError(`Unknown generic type: ${genericType}`, makeErrorOpts('UNKNOWN_GENERIC_TYPE'));
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
        throw new ParseError(`Map type requires exactly 2 type parameters (got ${parts.length})`, makeErrorOpts('INVALID_MAP_PARAMS'));
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
      throw new ParseError(`Unknown parametric type: ${typeName}`, makeErrorOpts('UNKNOWN_PARAMETRIC_TYPE'));
    }

    const params = paramsStr.split(',').map((p) => {
      const trimmed = p.trim();
      const num = parseInt(trimmed, 10);
      if (isNaN(num)) {
        throw new ParseError(`Invalid parameter value: '${trimmed}' (expected a number)`, makeErrorOpts('INVALID_PARAM_VALUE'));
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
      if (params[0] !== undefined) {
        result.precision = params[0];
      }
      result.scale = params.length > 1 && params[1] !== undefined ? params[1] : 0;
    } else if (typeName === 'varchar' || typeName === 'char' || typeName === 'fixed') {
      if (params[0] !== undefined) {
        result.length = params[0];
      }
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
    throw new ParseError(`Unknown type: '${str}'`, makeErrorOpts('UNKNOWN_TYPE'));
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
export function splitGenericParams(content: string): string[] {
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

export function isRelationString(input: string): boolean {
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

export interface ParseRelationOptions {
  /** Field name for better error context */
  fieldName?: string;
  /** Line number for error reporting */
  line?: number;
  /** Column number for error reporting */
  column?: number;
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
 * @param options - Parsing options for error context
 * @returns The parsed relation definition
 */
export function parseRelationString(
  input: string,
  options: ParseRelationOptions = {}
): RelationDefinition & { array?: boolean; optional?: boolean } {
  const { fieldName, line = 1, column = 1 } = options;

  // Helper to build parse error options with optional path
  const makeErrorOpts = (code: string): { line: number; column: number; code: string; path?: string } => {
    const opts: { line: number; column: number; code: string; path?: string } = { line, column, code };
    if (fieldName !== undefined) {
      opts.path = fieldName;
    }
    return opts;
  };

  if (!input || typeof input !== 'string') {
    throw new ParseError('Relation definition must be a non-empty string', makeErrorOpts('EMPTY_RELATION'));
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new ParseError('Relation definition must be a non-empty string', makeErrorOpts('EMPTY_RELATION'));
  }

  const opMatch = findOperator(trimmed);
  if (!opMatch) {
    throw new ParseError(`No valid relation operator found. Use ->, ~>, <-, or <~`, makeErrorOpts('MISSING_RELATION_OPERATOR'));
  }

  const { operator, index } = opMatch;
  let targetPart = trimmed.slice(index + operator.length).trim();

  if (!targetPart) {
    throw new ParseError(`Relation operator '${operator}' requires a target type (e.g., '${operator} User')`, makeErrorOpts('MISSING_TARGET_TYPE'));
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
    const name = typeof definition.$type === 'string' ? definition.$type : 'Unknown';
    const fields = new Map<string, FieldDefinition>();
    const relations = new Map<string, RelationDefinition>();
    const directives = this.parseDirectives(definition);

    for (const [key, value] of Object.entries(definition)) {
      if (key.startsWith('$')) continue;

      if (typeof value === 'string') {
        const fieldDef = this.parseField(value, { throwOnUnknownType: false, fieldName: key });
        fieldDef.name = key;

        if (fieldDef.relation) {
          relations.set(key, fieldDef.relation);
        }

        fields.set(key, fieldDef);
      } else if (typeof value === 'object' && value !== null) {
        // Check if this is an object-style field definition with 'type' property
        const objValue = value as Record<string, unknown>;
        if ('type' in objValue && typeof objValue.type === 'string') {
          // Parse the type string to get the field definition
          const fieldDef = this.parseField(objValue.type, { throwOnUnknownType: false, fieldName: key });
          fieldDef.name = key;

          // Apply default value if specified
          if ('default' in objValue && objValue.default !== undefined) {
            fieldDef.defaultValue = objValue.default;
          }

          // Apply optional modifier if specified
          if ('optional' in objValue && objValue.optional === true) {
            fieldDef.isOptional = true;
            fieldDef.modifier = '?';
          }

          // Apply unique modifier if specified
          if ('unique' in objValue && objValue.unique === true) {
            fieldDef.isUnique = true;
            fieldDef.modifier = '#';
          }

          // Apply required modifier if specified
          if ('required' in objValue && objValue.required === true) {
            fieldDef.modifier = '!';
          }

          if (fieldDef.relation) {
            relations.set(key, fieldDef.relation);
          }

          fields.set(key, fieldDef);
        } else {
          // Fallback: treat as json type
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
    const { fieldName, line, column } = options;

    if (isRelationString(trimmed)) {
      const relOpts: ParseRelationOptions = {};
      if (fieldName !== undefined) {
        relOpts.fieldName = fieldName;
      }
      if (line !== undefined) {
        relOpts.line = line;
      }
      if (column !== undefined) {
        relOpts.column = column;
      }
      const relation = parseRelationString(trimmed, relOpts);
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

    const result: FieldDefinition = {
      name: '',
      type: parsed.type,
      modifier,
      isArray: parsed.array || false,
      isOptional: parsed.optional,
      isUnique: parsed.unique,
      isIndexed: parsed.indexed,
    };

    if (parsed.default !== undefined) {
      result.defaultValue = parsed.default;
    }
    if (parsed.precision !== undefined) {
      result.precision = parsed.precision;
    }
    if (parsed.scale !== undefined) {
      result.scale = parsed.scale;
    }
    if (parsed.length !== undefined) {
      result.length = parsed.length;
    }

    return result;
  }

  /**
   * Parse a relation definition string.
   *
   * @param relDef - The relation definition string
   * @returns The parsed relation definition
   */
  parseRelation(relDef: string): RelationDefinition {
    const result = parseRelationString(relDef);
    const relation: RelationDefinition = {
      operator: result.operator,
      targetType: result.targetType,
    };
    if (result.inverse !== undefined) {
      relation.inverse = result.inverse;
    }
    if (result.onDelete !== undefined) {
      relation.onDelete = result.onDelete;
    }
    return relation;
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
          if (Array.isArray(value) && value.every((v): v is string => typeof v === 'string')) {
            directives.partitionBy = value;
          }
          break;

        case '$index':
          if (Array.isArray(value) && value.every((v): v is string[] =>
            Array.isArray(v) && v.every((s): s is string => typeof s === 'string')
          )) {
            directives.index = value.map((fields) => ({
              fields,
              unique: false,
            }));
          }
          break;

        case '$fts':
          if (Array.isArray(value) && value.every((v): v is string => typeof v === 'string')) {
            directives.fts = value;
          }
          break;

        case '$vector':
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const vectorDirs: VectorDirective[] = [];
            for (const [field, dims] of Object.entries(value)) {
              if (typeof dims === 'number') {
                vectorDirs.push({
                  field,
                  dimensions: dims,
                });
              }
            }
            directives.vector = vectorDirs;
          }
          break;

        // Projection directives
        case '$projection':
          if (typeof value === 'string' && ['oltp', 'olap', 'both'].includes(value)) {
            (directives as SchemaDirectivesExtended).projection = value as 'oltp' | 'olap' | 'both';
          }
          break;

        case '$from':
          if (typeof value === 'string') {
            (directives as SchemaDirectivesExtended).from = value;
          }
          break;

        case '$expand':
          if (Array.isArray(value) && value.every((v): v is string => typeof v === 'string')) {
            (directives as SchemaDirectivesExtended).expand = value;
          }
          break;

        case '$flatten':
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const flattenObj: Record<string, string> = {};
            let valid = true;
            for (const [k, v] of Object.entries(value)) {
              if (typeof v === 'string') {
                flattenObj[k] = v;
              } else {
                valid = false;
                break;
              }
            }
            if (valid) {
              (directives as SchemaDirectivesExtended).flatten = flattenObj;
            }
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
