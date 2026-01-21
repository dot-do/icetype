import * as vscode from 'vscode';

/**
 * IceType Completion Provider
 *
 * Provides IntelliSense completions for IceType schema files including:
 * - Primitive types (string, int, uuid, etc.)
 * - Field modifiers (!, ?, #index, #unique)
 * - Schema directives ($type, $partitionBy, etc.)
 * - Relation operators (->, <-, ~>)
 */

// ============================================================================
// Type Completions
// ============================================================================

interface TypeCompletion {
  label: string;
  detail: string;
  documentation: string;
  insertText?: string;
}

const primitiveTypes: TypeCompletion[] = [
  {
    label: 'uuid',
    detail: 'UUID identifier',
    documentation: 'Universally unique identifier (UUID v4). Commonly used for primary keys.\n\nExample: `id: \'uuid!\'`',
  },
  {
    label: 'string',
    detail: 'Text string',
    documentation: 'Variable-length text string. For longer content, consider using `text`.\n\nExample: `name: \'string!\'`',
  },
  {
    label: 'text',
    detail: 'Long text content',
    documentation: 'Long-form text content. Supports full-text search when combined with $fts directive.\n\nExample: `content: \'text!\'`',
  },
  {
    label: 'int',
    detail: 'Integer number',
    documentation: '32-bit signed integer. Range: -2,147,483,648 to 2,147,483,647.\n\nExample: `count: \'int!\'`',
  },
  {
    label: 'integer',
    detail: 'Integer number (alias)',
    documentation: 'Alias for `int`. 32-bit signed integer.\n\nExample: `count: \'integer!\'`',
  },
  {
    label: 'bigint',
    detail: 'Large integer',
    documentation: '64-bit signed integer. Use for large numbers that exceed int range.\n\nExample: `viewCount: \'bigint!\'`',
  },
  {
    label: 'float',
    detail: 'Floating point number',
    documentation: '32-bit floating point number. For higher precision, use `double` or `decimal`.\n\nExample: `price: \'float!\'`',
  },
  {
    label: 'double',
    detail: 'Double precision float',
    documentation: '64-bit double precision floating point number.\n\nExample: `latitude: \'double!\'`',
  },
  {
    label: 'decimal',
    detail: 'Exact decimal number',
    documentation: 'Exact decimal number with specified precision. Use for financial data.\n\nExample: `price: \'decimal(10,2)!\'`',
    insertText: 'decimal(${1:10},${2:2})',
  },
  {
    label: 'boolean',
    detail: 'Boolean value',
    documentation: 'True/false boolean value.\n\nExample: `isActive: \'boolean!\'`',
  },
  {
    label: 'bool',
    detail: 'Boolean (alias)',
    documentation: 'Alias for `boolean`. True/false value.\n\nExample: `published: \'bool!\'`',
  },
  {
    label: 'date',
    detail: 'Date only',
    documentation: 'Date without time component (YYYY-MM-DD).\n\nExample: `birthDate: \'date?\'`',
  },
  {
    label: 'datetime',
    detail: 'Date and time',
    documentation: 'Full date and time with timezone. ISO 8601 format.\n\nExample: `createdAt: \'datetime!\'`',
  },
  {
    label: 'timestamp',
    detail: 'Unix timestamp',
    documentation: 'Unix timestamp (milliseconds since epoch).\n\nExample: `lastLogin: \'timestamp?\'`',
  },
  {
    label: 'time',
    detail: 'Time only',
    documentation: 'Time without date component (HH:MM:SS).\n\nExample: `startTime: \'time!\'`',
  },
  {
    label: 'json',
    detail: 'JSON object',
    documentation: 'Arbitrary JSON data. Stored as text, parsed on read.\n\nExample: `metadata: \'json?\'`',
  },
  {
    label: 'jsonb',
    detail: 'Binary JSON',
    documentation: 'Binary JSON with indexing support. Faster queries than `json`.\n\nExample: `settings: \'jsonb?\'`',
  },
  {
    label: 'binary',
    detail: 'Binary data',
    documentation: 'Raw binary data. Use for files, images, etc.\n\nExample: `data: \'binary?\'`',
  },
  {
    label: 'blob',
    detail: 'Binary large object',
    documentation: 'Binary large object. Alias for `binary`.\n\nExample: `file: \'blob?\'`',
  },
  {
    label: 'bytes',
    detail: 'Byte array',
    documentation: 'Byte array. Alias for `binary`.\n\nExample: `hash: \'bytes!\'`',
  },
  {
    label: 'vector',
    detail: 'Vector embedding',
    documentation: 'Vector embedding for semantic search. Specify dimensions in brackets.\n\nExample: `embedding: \'vector[1536]\'`\n\nAuto-generate from text: `embedding: \'vector[1536] ~> content\'`',
    insertText: 'vector[${1:1536}]',
  },
  {
    label: 'esm',
    detail: 'ESM code module',
    documentation: 'ECMAScript module string. Enables code execution inside the database with CapnWeb magic-map.\n\nExample: `handler: \'esm!\'`',
  },
  {
    label: 'enum',
    detail: 'Enumeration type',
    documentation: 'Enumeration with fixed set of values.\n\nExample: `status: \'enum(draft,published,archived)!\'`',
    insertText: 'enum(${1:value1},${2:value2})',
  },
];

// ============================================================================
// Modifier Completions
// ============================================================================

interface ModifierCompletion {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

const modifierCompletions: ModifierCompletion[] = [
  {
    label: '!',
    detail: 'Required field',
    documentation: 'Marks the field as required (non-nullable). The field must have a value.\n\nExample: `name: \'string!\'`',
    insertText: '!',
  },
  {
    label: '?',
    detail: 'Optional field',
    documentation: 'Marks the field as optional (nullable). The field may be null or undefined.\n\nExample: `nickname: \'string?\'`',
    insertText: '?',
  },
  {
    label: '#index',
    detail: 'Index modifier',
    documentation: 'Creates a secondary index on the field for faster queries.\n\nExample: `email: \'string! #index\'`',
    insertText: ' #index',
  },
  {
    label: '#unique',
    detail: 'Unique constraint',
    documentation: 'Creates a unique index. No two records can have the same value.\n\nExample: `email: \'string! #unique\'`',
    insertText: ' #unique',
  },
  {
    label: '#fts',
    detail: 'Full-text search index',
    documentation: 'Creates a full-text search index on the field.\n\nExample: `content: \'text! #fts\'`',
    insertText: ' #fts',
  },
  {
    label: '#sparse',
    detail: 'Sparse index',
    documentation: 'Creates a sparse index that only includes documents with the field.\n\nExample: `optionalField: \'string? #sparse\'`',
    insertText: ' #sparse',
  },
];

// ============================================================================
// Directive Completions
// ============================================================================

interface DirectiveCompletion {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

const directiveCompletions: DirectiveCompletion[] = [
  {
    label: '$type',
    detail: 'Entity type name',
    documentation: 'Defines the entity type name. Should match the key in the schema.\n\nExample: `$type: \'User\'`',
    insertText: "\\$type: '${1:EntityName}'",
  },
  {
    label: '$partitionBy',
    detail: 'Partition key',
    documentation: 'Defines the partition key(s) for data distribution. Essential for multi-tenant applications.\n\nExample: `$partitionBy: [\'tenantId\']`',
    insertText: "\\$partitionBy: ['${1:field}']",
  },
  {
    label: '$index',
    detail: 'Secondary indexes',
    documentation: 'Defines secondary indexes on one or more fields. Supports composite indexes.\n\nExample: `$index: [[\'email\'], [\'createdAt\', \'status\']]`',
    insertText: "\\$index: [['${1:field1}'], ['${2:field2}']]",
  },
  {
    label: '$fts',
    detail: 'Full-text search fields',
    documentation: 'Enables full-text search on specified fields. Supports hybrid search with vectors.\n\nExample: `$fts: [\'title\', \'content\']`',
    insertText: "\\$fts: ['${1:field1}', '${2:field2}']",
  },
  {
    label: '$vector',
    detail: 'Vector search field',
    documentation: 'Specifies the vector field for semantic search.\n\nExample: `$vector: \'embedding\'`',
    insertText: "\\$vector: '${1:embeddingField}'",
  },
  {
    label: '$unique',
    detail: 'Unique constraints',
    documentation: 'Defines unique constraints on field combinations.\n\nExample: `$unique: [[\'email\'], [\'tenantId\', \'slug\']]`',
    insertText: "\\$unique: [['${1:field1}', '${2:field2}']]",
  },
  {
    label: '$primaryKey',
    detail: 'Primary key',
    documentation: 'Defines the primary key field(s). Defaults to \'id\' if not specified.\n\nExample: `$primaryKey: [\'id\']`',
    insertText: "\\$primaryKey: ['${1:id}']",
  },
  {
    label: '$sortBy',
    detail: 'Default sort order',
    documentation: 'Defines the default sort order for queries.\n\nExample: `$sortBy: [\'createdAt\']`',
    insertText: "\\$sortBy: ['${1:field}']",
  },
  {
    label: '$cluster',
    detail: 'Clustering key',
    documentation: 'Defines the clustering key for physical data ordering.\n\nExample: `$cluster: [\'tenantId\', \'createdAt\']`',
    insertText: "\\$cluster: ['${1:field1}', '${2:field2}']",
  },
  {
    label: '$check',
    detail: 'Check constraint',
    documentation: 'Defines a check constraint for data validation.\n\nExample: `$check: \'price >= 0\'`',
    insertText: "\\$check: '${1:expression}'",
  },
  {
    label: '$default',
    detail: 'Default value',
    documentation: 'Defines default values for fields.\n\nExample: `$default: { status: \'draft\', version: 1 }`',
    insertText: '\\$default: { ${1:field}: ${2:value} }',
  },
  {
    label: '$validate',
    detail: 'Validation rules',
    documentation: 'Defines custom validation rules for the entity.\n\nExample: `$validate: { email: \'email\', age: \'min:0,max:150\' }`',
    insertText: '\\$validate: { ${1:field}: ${2:rule} }',
  },
  {
    label: '$computed',
    detail: 'Computed fields',
    documentation: 'Defines computed/derived fields.\n\nExample: `$computed: { fullName: \'firstName + \" \" + lastName\' }`',
    insertText: "\\$computed: { ${1:field}: '${2:expression}' }",
  },
  {
    label: '$cascade',
    detail: 'Cascade behavior',
    documentation: 'Defines cascade delete/update behavior for relations.\n\nExample: `$cascade: [\'posts\', \'comments\']`',
    insertText: "\\$cascade: ['${1:relation}']",
  },
  {
    label: '$onDelete',
    detail: 'On delete behavior',
    documentation: 'Defines behavior when related entity is deleted.\n\nExample: `$onDelete: \'cascade\'`',
    insertText: "\\$onDelete: '${1|cascade,restrict,set_null|}'",
  },
  {
    label: '$onUpdate',
    detail: 'On update behavior',
    documentation: 'Defines behavior when related entity is updated.\n\nExample: `$onUpdate: \'cascade\'`',
    insertText: "\\$onUpdate: '${1|cascade,restrict|}'",
  },
  {
    label: '$ttl',
    detail: 'Time to live',
    documentation: 'Defines automatic expiration for records.\n\nExample: `$ttl: \'30d\'` (30 days)',
    insertText: "\\$ttl: '${1:duration}'",
  },
  {
    label: '$immutable',
    detail: 'Immutable fields',
    documentation: 'Marks fields that cannot be updated after creation.\n\nExample: `$immutable: [\'createdAt\', \'createdBy\']`',
    insertText: "\\$immutable: ['${1:field}']",
  },
  {
    label: '$audit',
    detail: 'Audit logging',
    documentation: 'Enables audit logging for the entity.\n\nExample: `$audit: true`',
    insertText: '\\$audit: ${1|true,false|}',
  },
  {
    label: '$encrypted',
    detail: 'Encrypted fields',
    documentation: 'Marks fields that should be encrypted at rest.\n\nExample: `$encrypted: [\'ssn\', \'creditCard\']`',
    insertText: "\\$encrypted: ['${1:field}']",
  },
];

// ============================================================================
// Relation Completions
// ============================================================================

interface RelationCompletion {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

const relationCompletions: RelationCompletion[] = [
  {
    label: '->',
    detail: 'Forward relation (belongs to)',
    documentation: 'Creates a forward relation (belongs to). References another entity by ID.\n\nExample: `author: \'-> User!\'` (required)\nExample: `category: \'-> Category?\'` (optional)',
    insertText: '-> ${1:Entity}',
  },
  {
    label: '<-',
    detail: 'Backward relation (has many)',
    documentation: 'Creates a backward relation (has many). References the back-reference field.\n\nExample: `posts: \'<- Post.author[]\'`',
    insertText: '<- ${1:Entity}.${2:backRef}[]',
  },
  {
    label: '[Entity] ->',
    detail: 'Has many with back-reference',
    documentation: 'Creates a has-many relation with explicit back-reference.\n\nExample: `posts: \'[Post] -> author\'`',
    insertText: '[${1:Entity}] -> ${2:backRef}',
  },
  {
    label: '~>',
    detail: 'Fuzzy/semantic relation',
    documentation: 'Creates a fuzzy/semantic relation using vector similarity.\n\nExample: `similar: \'~> Product[]\'` (find similar products)\nExample: `generated: \'text ~> sourceField\'` (AI generation)',
    insertText: '~> ${1:Entity}',
  },
  {
    label: '<~',
    detail: 'Backward fuzzy relation',
    documentation: 'Creates a backward fuzzy/semantic relation.\n\nExample: `relatedTo: \'<~ Product[]\'`',
    insertText: '<~ ${1:Entity}',
  },
  {
    label: '<->',
    detail: 'Bidirectional relation',
    documentation: 'Creates a bidirectional many-to-many relation.\n\nExample: `friends: \'<-> User[]\'`',
    insertText: '<-> ${1:Entity}[]',
  },
];

// ============================================================================
// Completion Provider
// ============================================================================

/**
 * Creates completion items for IceType types
 */
function createTypeCompletions(): vscode.CompletionItem[] {
  return primitiveTypes.map((type) => {
    const item = new vscode.CompletionItem(type.label, vscode.CompletionItemKind.TypeParameter);
    item.detail = type.detail;
    item.documentation = new vscode.MarkdownString(type.documentation);
    if (type.insertText) {
      item.insertText = new vscode.SnippetString(type.insertText);
    }
    item.sortText = `0_${type.label}`; // Prioritize types
    return item;
  });
}

/**
 * Creates completion items for IceType modifiers
 */
function createModifierCompletions(): vscode.CompletionItem[] {
  return modifierCompletions.map((mod) => {
    const item = new vscode.CompletionItem(mod.label, vscode.CompletionItemKind.Operator);
    item.detail = mod.detail;
    item.documentation = new vscode.MarkdownString(mod.documentation);
    item.insertText = new vscode.SnippetString(mod.insertText);
    item.sortText = `1_${mod.label}`; // After types
    return item;
  });
}

/**
 * Creates completion items for IceType directives
 */
function createDirectiveCompletions(): vscode.CompletionItem[] {
  return directiveCompletions.map((dir) => {
    const item = new vscode.CompletionItem(dir.label, vscode.CompletionItemKind.Keyword);
    item.detail = dir.detail;
    item.documentation = new vscode.MarkdownString(dir.documentation);
    item.insertText = new vscode.SnippetString(dir.insertText);
    item.sortText = `2_${dir.label}`; // After modifiers
    return item;
  });
}

/**
 * Creates completion items for IceType relations
 */
function createRelationCompletions(): vscode.CompletionItem[] {
  return relationCompletions.map((rel) => {
    const item = new vscode.CompletionItem(rel.label, vscode.CompletionItemKind.Reference);
    item.detail = rel.detail;
    item.documentation = new vscode.MarkdownString(rel.documentation);
    item.insertText = new vscode.SnippetString(rel.insertText);
    item.sortText = `3_${rel.label}`; // After directives
    return item;
  });
}

/**
 * Determines the completion context based on cursor position
 */
function getCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position
): 'type' | 'modifier' | 'directive' | 'relation' | 'all' {
  const line = document.lineAt(position).text;
  const textBeforeCursor = line.substring(0, position.character);

  // Check for directive context: after '$' at the start of a property name
  if (/\$\w*$/.test(textBeforeCursor)) {
    return 'directive';
  }

  // Check if we're inside a string (after a colon and quote)
  const afterColonQuote = /:\s*['"][^'"]*$/.test(textBeforeCursor);

  if (afterColonQuote) {
    // Check for relation context: after '- ' or '~ ' or '< '
    if (/[-~<]\s*$/.test(textBeforeCursor)) {
      return 'relation';
    }

    // Check for modifier context: after a type name
    if (/['"](?:uuid|string|text|int|integer|bigint|float|double|decimal|boolean|bool|date|datetime|timestamp|time|json|jsonb|binary|blob|bytes|vector|esm|enum)(?:\[\d+\])?(?:\(\d+,\d+\))?\s*$/.test(textBeforeCursor)) {
      return 'modifier';
    }

    // Check for relation operator context: typing '-', '~', or '<'
    if (/['"][^'"]*$/.test(textBeforeCursor)) {
      // Default to type + relation completions inside strings
      return 'type';
    }
  }

  // Check for index modifier context: after '#'
  if (/#\w*$/.test(textBeforeCursor)) {
    return 'modifier';
  }

  return 'all';
}

/**
 * IceType Completion Item Provider
 */
export class IceTypeCompletionProvider implements vscode.CompletionItemProvider {
  private typeCompletions: vscode.CompletionItem[];
  private modifierCompletions: vscode.CompletionItem[];
  private directiveCompletions: vscode.CompletionItem[];
  private relationCompletions: vscode.CompletionItem[];

  constructor() {
    this.typeCompletions = createTypeCompletions();
    this.modifierCompletions = createModifierCompletions();
    this.directiveCompletions = createDirectiveCompletions();
    this.relationCompletions = createRelationCompletions();
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const completionContext = getCompletionContext(document, position);

    switch (completionContext) {
      case 'type':
        return [...this.typeCompletions, ...this.relationCompletions];
      case 'modifier':
        return this.modifierCompletions;
      case 'directive':
        return this.directiveCompletions;
      case 'relation':
        return this.relationCompletions;
      case 'all':
      default:
        return [
          ...this.typeCompletions,
          ...this.modifierCompletions,
          ...this.directiveCompletions,
          ...this.relationCompletions,
        ];
    }
  }
}

/**
 * Trigger characters for IceType completions
 */
export const triggerCharacters = [
  ':', // After field name
  "'", // Start of type string
  '"', // Start of type string
  '$', // Start of directive
  '#', // Start of index modifier
  '-', // Start of relation operator
  '~', // Start of fuzzy relation
  '<', // Start of backward relation
  ' ', // After type for modifier
];
