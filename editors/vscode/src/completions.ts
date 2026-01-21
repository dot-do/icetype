import * as vscode from 'vscode';

/**
 * IceType Completion Provider
 *
 * Provides IntelliSense completions for IceType schema files including:
 * - Primitive types (string, int, uuid, etc.)
 * - Field modifiers (!, ?, #index, #unique)
 * - Schema directives ($type, $partitionBy, etc.)
 * - Relation operators (->, <-, ~>)
 * - Nested object types and complex patterns
 *
 * Context-aware completions:
 * - Inside entity blocks: shows field types, relations, and entity-level directives
 * - At top level: shows DB() pattern and schema-level completions
 * - After type name: shows modifiers (!, ?, #index, #unique)
 * - Inside strings: shows types and relation operators
 */

// ============================================================================
// Type Completions
// ============================================================================

interface TypeCompletion {
  label: string;
  detail: string;
  documentation: string;
  insertText?: string;
  sortPriority: number; // Lower = higher priority (shown first)
  category: 'common' | 'numeric' | 'temporal' | 'structured' | 'binary' | 'special';
}

// Sort priorities by category:
// 0-9: Most common types (uuid, string, int, boolean, datetime)
// 10-19: Other common types (text, float, double)
// 20-29: Temporal types (date, time, timestamp)
// 30-39: Structured types (json, jsonb, enum)
// 40-49: Binary types (binary, blob, bytes)
// 50-59: Special types (vector, esm)
// 60+: Aliases and less common types

const primitiveTypes: TypeCompletion[] = [
  // Most common types - shown first
  {
    label: 'uuid',
    detail: 'UUID identifier',
    documentation: `Universally unique identifier (UUID v4). The standard choice for primary keys in distributed systems.

**Why use UUID?**
- Globally unique without coordination
- Safe for distributed systems and replication
- No sequential guessing of IDs

**Example:**
\`\`\`typescript
id: 'uuid!'              // Required UUID (primary key)
externalId: 'uuid?'      // Optional UUID (external reference)
\`\`\`

**Common patterns:**
\`\`\`typescript
id: 'uuid!',             // Primary key
tenantId: 'uuid!',       // Partition key for multi-tenancy
\`\`\``,
    sortPriority: 0,
    category: 'common',
  },
  {
    label: 'string',
    detail: 'Text string (up to ~64KB)',
    documentation: `Variable-length text string. Use for names, titles, short content, URLs, etc.

**Capacity:** Up to ~64KB (use \`text\` for longer content)

**Example:**
\`\`\`typescript
name: 'string!'          // Required string
nickname: 'string?'      // Optional string
email: 'string! #unique' // Unique constraint
slug: 'string! #index'   // Indexed for lookups
\`\`\`

**Common patterns:**
\`\`\`typescript
// User fields
email: 'string! #unique',
name: 'string!',
avatar: 'string?',

// Slugs and identifiers
slug: 'string! #unique',
handle: 'string! #index',
\`\`\``,
    sortPriority: 1,
    category: 'common',
  },
  {
    label: 'int',
    detail: 'Integer (-2.1B to 2.1B)',
    documentation: `32-bit signed integer. Use for counts, quantities, and small numeric IDs.

**Range:** -2,147,483,648 to 2,147,483,647

**Example:**
\`\`\`typescript
count: 'int!'            // Required integer
quantity: 'int?'         // Optional integer
sortOrder: 'int! #index' // Indexed for sorting
\`\`\`

**When to use alternatives:**
- Need larger numbers? Use \`bigint\`
- Need decimals? Use \`float\`, \`double\`, or \`decimal\`
- Storing money? Use \`decimal\` for precision`,
    sortPriority: 2,
    category: 'common',
  },
  {
    label: 'boolean',
    detail: 'True/false value',
    documentation: `Boolean value for flags, toggles, and binary states.

**Example:**
\`\`\`typescript
isActive: 'boolean!'     // Required boolean
published: 'boolean!'    // Publication status
verified: 'boolean?'     // Optional (null = unknown)
\`\`\`

**Common patterns:**
\`\`\`typescript
// Feature flags
isActive: 'boolean!',
isVerified: 'boolean!',
isDeleted: 'boolean!',   // Soft delete

// Content states
published: 'boolean!',
featured: 'boolean!',
\`\`\``,
    sortPriority: 3,
    category: 'common',
  },
  {
    label: 'datetime',
    detail: 'Date and time with timezone',
    documentation: `Full date and time with timezone support. The standard choice for timestamps.

**Format:** ISO 8601 (e.g., "2024-01-15T10:30:00Z")

**Example:**
\`\`\`typescript
createdAt: 'datetime!'   // Required timestamp
updatedAt: 'datetime?'   // Optional (null if never updated)
publishedAt: 'datetime?' // Optional publication time
\`\`\`

**Common patterns:**
\`\`\`typescript
// Audit fields (add to every entity)
createdAt: 'datetime!',
updatedAt: 'datetime?',
deletedAt: 'datetime?',  // Soft delete timestamp

// Scheduling
startsAt: 'datetime!',
endsAt: 'datetime?',
\`\`\``,
    sortPriority: 4,
    category: 'common',
  },
  {
    label: 'text',
    detail: 'Long text content (unlimited)',
    documentation: `Long-form text content with no practical size limit. Supports full-text search with \`$fts\` directive.

**Use cases:** Articles, descriptions, comments, markdown content

**Example:**
\`\`\`typescript
content: 'text!'         // Required long text
description: 'text?'     // Optional description
body: 'text! #fts'       // With full-text search
\`\`\`

**Full-text search pattern:**
\`\`\`typescript
Post: {
  title: 'string!',
  content: 'text!',
  $fts: ['title', 'content'],  // Enable search
}
\`\`\`

**AI generation pattern:**
\`\`\`typescript
summary: 'text ~> content',    // Generate summary from content
\`\`\``,
    sortPriority: 5,
    category: 'common',
  },

  // Numeric types
  {
    label: 'integer',
    detail: 'Integer (alias for int)',
    documentation: `Alias for \`int\`. 32-bit signed integer.

**Range:** -2,147,483,648 to 2,147,483,647

**Example:**
\`\`\`typescript
count: 'integer!'
\`\`\`

**Note:** \`int\` is preferred for brevity.`,
    sortPriority: 60,
    category: 'numeric',
  },
  {
    label: 'bigint',
    detail: 'Large integer (64-bit)',
    documentation: `64-bit signed integer for very large numbers.

**Range:** -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807

**Example:**
\`\`\`typescript
viewCount: 'bigint!'     // High view counts
fileSize: 'bigint!'      // File sizes in bytes
snowflakeId: 'bigint!'   // Twitter-style IDs
\`\`\`

**When to use:**
- Counts that might exceed 2 billion
- File sizes in bytes
- Snowflake IDs or similar large numeric IDs
- Financial amounts in smallest units (cents, satoshis)`,
    sortPriority: 11,
    category: 'numeric',
  },
  {
    label: 'float',
    detail: 'Floating point (32-bit)',
    documentation: `32-bit floating point number. Good for approximate values where precision isn't critical.

**Precision:** ~7 significant digits

**Example:**
\`\`\`typescript
rating: 'float!'         // Star ratings (3.5, 4.2)
percentage: 'float!'     // Percentages
score: 'float?'          // Optional score
\`\`\`

**Note:** For financial data or exact decimals, use \`decimal\` instead.`,
    sortPriority: 12,
    category: 'numeric',
  },
  {
    label: 'double',
    detail: 'Double precision (64-bit)',
    documentation: `64-bit double precision floating point. Higher precision than \`float\`.

**Precision:** ~15-17 significant digits

**Example:**
\`\`\`typescript
latitude: 'double!'      // Geographic coordinates
longitude: 'double!'     // Geographic coordinates
scientificValue: 'double!'
\`\`\`

**Common patterns:**
\`\`\`typescript
// Geographic location
latitude: 'double!',
longitude: 'double!',

// Scientific data
measurement: 'double!',
\`\`\``,
    sortPriority: 13,
    category: 'numeric',
  },
  {
    label: 'decimal',
    detail: 'Exact decimal (financial)',
    documentation: `Exact decimal number with specified precision. Essential for financial data.

**Syntax:** \`decimal(precision, scale)\`
- precision: total digits
- scale: digits after decimal point

**Example:**
\`\`\`typescript
price: 'decimal(10,2)!'      // Up to 99999999.99
amount: 'decimal(18,8)!'     // Crypto precision
tax: 'decimal(5,4)!'         // Tax rates (0.0725)
\`\`\`

**Common patterns:**
\`\`\`typescript
// E-commerce
price: 'decimal(10,2)!',
discount: 'decimal(5,2)?',
total: 'decimal(12,2)!',

// Cryptocurrency
amount: 'decimal(18,8)!',
\`\`\``,
    insertText: 'decimal(${1:10},${2:2})',
    sortPriority: 14,
    category: 'numeric',
  },

  // Boolean alias
  {
    label: 'bool',
    detail: 'Boolean (alias)',
    documentation: `Alias for \`boolean\`. True/false value.

**Example:**
\`\`\`typescript
active: 'bool!'
\`\`\`

**Note:** \`boolean\` is preferred for clarity.`,
    sortPriority: 61,
    category: 'common',
  },

  // Temporal types
  {
    label: 'date',
    detail: 'Date only (no time)',
    documentation: `Date without time component.

**Format:** YYYY-MM-DD (e.g., "2024-01-15")

**Example:**
\`\`\`typescript
birthDate: 'date?'       // Optional birth date
dueDate: 'date!'         // Required due date
startDate: 'date!'       // Start of date range
endDate: 'date?'         // End of date range
\`\`\`

**When to use:**
- Birth dates
- Due dates, deadlines
- Date ranges without time component
- Historical dates`,
    sortPriority: 20,
    category: 'temporal',
  },
  {
    label: 'timestamp',
    detail: 'Unix timestamp (ms)',
    documentation: `Unix timestamp in milliseconds since epoch.

**Format:** Integer (e.g., 1705312200000)

**Example:**
\`\`\`typescript
lastLogin: 'timestamp?'  // Optional login time
expiresAt: 'timestamp!'  // Expiration time
\`\`\`

**When to use:**
- Interoperability with systems using Unix time
- Token expiration
- Cache invalidation times

**Note:** \`datetime\` is usually preferred for readability.`,
    sortPriority: 21,
    category: 'temporal',
  },
  {
    label: 'time',
    detail: 'Time only (no date)',
    documentation: `Time without date component.

**Format:** HH:MM:SS (e.g., "14:30:00")

**Example:**
\`\`\`typescript
startTime: 'time!'       // Daily start time
endTime: 'time?'         // Optional end time
openingTime: 'time!'     // Business hours
closingTime: 'time!'
\`\`\`

**When to use:**
- Business hours
- Recurring daily schedules
- Time slots without specific dates`,
    sortPriority: 22,
    category: 'temporal',
  },

  // Structured types
  {
    label: 'json',
    detail: 'JSON object (flexible)',
    documentation: `Arbitrary JSON data. Stored as text, parsed on read.

**Example:**
\`\`\`typescript
metadata: 'json?'        // Flexible metadata
config: 'json!'          // Configuration object
preferences: 'json?'     // User preferences
\`\`\`

**Common patterns:**
\`\`\`typescript
// Flexible metadata
metadata: 'json?',       // { key: value, ... }

// External API responses
rawResponse: 'json?',

// User preferences
preferences: 'json?',
\`\`\`

**Note:** Use \`jsonb\` for better query performance on JSON fields.`,
    sortPriority: 30,
    category: 'structured',
  },
  {
    label: 'jsonb',
    detail: 'Binary JSON (queryable)',
    documentation: `Binary JSON with indexing support. Faster queries than \`json\`.

**Example:**
\`\`\`typescript
settings: 'jsonb?'       // Queryable settings
attributes: 'jsonb!'     // Product attributes
data: 'jsonb!'           // Structured data
\`\`\`

**Advantages over json:**
- Faster queries and indexing
- Can create indexes on nested paths
- Better for frequently queried data

**Common patterns:**
\`\`\`typescript
// Product attributes
attributes: 'jsonb!',    // { color: "red", size: "L" }

// Feature flags
features: 'jsonb?',      // { darkMode: true, beta: false }
\`\`\``,
    sortPriority: 31,
    category: 'structured',
  },
  {
    label: 'enum',
    detail: 'Enumeration (fixed values)',
    documentation: `Enumeration with a fixed set of allowed values.

**Syntax:** \`enum(value1,value2,value3)\`

**Example:**
\`\`\`typescript
status: 'enum(draft,published,archived)!'
role: 'enum(user,admin,moderator)!'
priority: 'enum(low,medium,high,urgent)?'
\`\`\`

**Common patterns:**
\`\`\`typescript
// Content status
status: 'enum(draft,pending,published,archived)!',

// User roles
role: 'enum(user,admin,moderator,owner)!',

// Priority levels
priority: 'enum(low,medium,high,critical)?',

// Order status
orderStatus: 'enum(pending,confirmed,shipped,delivered,cancelled)!',
\`\`\``,
    insertText: 'enum(${1:value1},${2:value2})',
    sortPriority: 32,
    category: 'structured',
  },

  // Binary types
  {
    label: 'binary',
    detail: 'Raw binary data',
    documentation: `Raw binary data for files, images, and other binary content.

**Example:**
\`\`\`typescript
data: 'binary?'          // Binary data
thumbnail: 'binary?'     // Small image
signature: 'binary!'     // Digital signature
\`\`\`

**Note:** For large files, consider storing in R2/S3 and keeping a URL reference instead.`,
    sortPriority: 40,
    category: 'binary',
  },
  {
    label: 'blob',
    detail: 'Binary large object',
    documentation: `Binary large object. Alias for \`binary\`.

**Example:**
\`\`\`typescript
file: 'blob?'            // File content
image: 'blob?'           // Image data
\`\`\``,
    sortPriority: 41,
    category: 'binary',
  },
  {
    label: 'bytes',
    detail: 'Byte array',
    documentation: `Byte array. Alias for \`binary\`.

**Example:**
\`\`\`typescript
hash: 'bytes!'           // Hash value
checksum: 'bytes!'       // Checksum
\`\`\``,
    sortPriority: 42,
    category: 'binary',
  },

  // Special types
  {
    label: 'vector',
    detail: 'Vector embedding (AI/ML)',
    documentation: `Vector embedding for semantic search and AI applications. Specify dimensions in brackets.

**Common dimensions:**
- OpenAI text-embedding-3-small: 1536
- OpenAI text-embedding-3-large: 3072
- Cohere embed-v3: 1024
- BGE-small: 384

**Example:**
\`\`\`typescript
embedding: 'vector[1536]'          // Manual embedding
embedding: 'vector[1536] ~> content'  // Auto-generate from content
\`\`\`

**Common patterns:**
\`\`\`typescript
// Semantic search on content
Document: {
  content: 'text!',
  embedding: 'vector[1536] ~> content',
  $vector: 'embedding',
}

// Product similarity
Product: {
  description: 'text!',
  embedding: 'vector[1536] ~> description',
}
\`\`\`

**Auto-generation:** Use \`~> fieldName\` to automatically generate embeddings from text fields.`,
    insertText: 'vector[${1:1536}]',
    sortPriority: 50,
    category: 'special',
  },
  {
    label: 'esm',
    detail: 'ESM code module',
    documentation: `ECMAScript module string. Enables code execution inside the database with CapnWeb magic-map.

**Example:**
\`\`\`typescript
handler: 'esm!'          // Required code module
transform: 'esm?'        // Optional transform function
validator: 'esm!'        // Validation logic
\`\`\`

**Use cases:**
- Custom validation logic
- Data transformation
- Computed fields
- Business rules

**Magic-map pattern:**
\`\`\`typescript
// Code runs inside the database, minimizing round trips
const results = await collection.all().map(item => ({
  ...item,
  computed: transform(item.data),
}))
\`\`\``,
    sortPriority: 51,
    category: 'special',
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
  sortPriority: number;
}

const modifierCompletions: ModifierCompletion[] = [
  {
    label: '!',
    detail: 'Required field (non-nullable)',
    documentation: `Marks the field as **required** (non-nullable). The field must have a value.

**Example:**
\`\`\`typescript
name: 'string!'          // Required - must have a value
email: 'string!'         // Required
id: 'uuid!'              // Required primary key
\`\`\`

**When to use:**
- Primary keys: \`id: 'uuid!'\`
- Essential fields: \`email: 'string!'\`
- Foreign keys: \`userId: 'uuid!'\`
- Fields that should never be null

**Note:** Required fields must be provided when creating a record.`,
    insertText: '!',
    sortPriority: 0,
  },
  {
    label: '?',
    detail: 'Optional field (nullable)',
    documentation: `Marks the field as **optional** (nullable). The field may be null or undefined.

**Example:**
\`\`\`typescript
nickname: 'string?'      // Optional - can be null
avatar: 'string?'        // Optional URL
deletedAt: 'datetime?'   // Null until deleted (soft delete)
\`\`\`

**When to use:**
- Optional profile fields: \`bio: 'text?'\`
- Soft delete timestamps: \`deletedAt: 'datetime?'\`
- Optional relationships: \`manager: '-> User?'\`
- Fields added after initial schema

**Common patterns:**
\`\`\`typescript
// Soft delete pattern
deletedAt: 'datetime?',  // null = not deleted

// Optional metadata
updatedAt: 'datetime?',  // null = never updated
\`\`\``,
    insertText: '?',
    sortPriority: 1,
  },
  {
    label: '#index',
    detail: 'Secondary index',
    documentation: `Creates a **secondary index** on the field for faster queries.

**Example:**
\`\`\`typescript
email: 'string! #index'      // Indexed for lookups
createdAt: 'datetime! #index' // Indexed for sorting
status: 'string! #index'     // Indexed for filtering
\`\`\`

**When to use:**
- Fields frequently used in WHERE clauses
- Fields used for sorting (ORDER BY)
- Foreign key lookups
- Status/state fields used in filters

**Performance note:** Indexes speed up reads but slow down writes. Index fields you query frequently.

**Alternative:** Use \`$index\` directive for composite indexes:
\`\`\`typescript
$index: [['status', 'createdAt'], ['userId']]
\`\`\``,
    insertText: ' #index',
    sortPriority: 2,
  },
  {
    label: '#unique',
    detail: 'Unique constraint',
    documentation: `Creates a **unique index**. No two records can have the same value.

**Example:**
\`\`\`typescript
email: 'string! #unique'     // No duplicate emails
slug: 'string! #unique'      // Unique URL slugs
username: 'string! #unique'  // Unique usernames
\`\`\`

**When to use:**
- Email addresses
- Usernames and handles
- URL slugs
- External IDs from other systems
- Any field that must be unique

**Error handling:** Inserting a duplicate value will throw a constraint violation error.

**Alternative:** Use \`$unique\` directive for composite unique constraints:
\`\`\`typescript
$unique: [['tenantId', 'slug']]  // Unique slug per tenant
\`\`\``,
    insertText: ' #unique',
    sortPriority: 3,
  },
  {
    label: '#fts',
    detail: 'Full-text search index',
    documentation: `Creates a **full-text search** index on the field.

**Example:**
\`\`\`typescript
content: 'text! #fts'        // Searchable content
title: 'string! #fts'        // Searchable title
description: 'text! #fts'    // Searchable description
\`\`\`

**When to use:**
- Article/blog content
- Product descriptions
- Search functionality
- Any text field users might search

**Alternative:** Use \`$fts\` directive for multi-field search:
\`\`\`typescript
$fts: ['title', 'content', 'tags']  // Search across multiple fields
\`\`\`

**Hybrid search:** Combine with vectors for semantic + keyword search:
\`\`\`typescript
content: 'text!',
embedding: 'vector[1536] ~> content',
$fts: ['content'],
$vector: 'embedding',
\`\`\``,
    insertText: ' #fts',
    sortPriority: 4,
  },
  {
    label: '#sparse',
    detail: 'Sparse index (optional fields)',
    documentation: `Creates a **sparse index** that only includes records where the field has a value.

**Example:**
\`\`\`typescript
deletedAt: 'datetime? #sparse'   // Only index non-null values
externalId: 'string? #sparse'    // Only index when present
\`\`\`

**When to use:**
- Optional fields that are rarely populated
- Soft delete timestamps (most records are null)
- Optional external references
- Fields with high null ratio

**Benefits:**
- Smaller index size
- Faster index maintenance
- Efficient queries for "has value" checks`,
    insertText: ' #sparse',
    sortPriority: 5,
  },
  {
    label: '#primary',
    detail: 'Primary key',
    documentation: `Marks the field as the **primary key**.

**Example:**
\`\`\`typescript
id: 'uuid! #primary'         // Explicit primary key
\`\`\`

**Note:** By convention, a field named \`id\` is automatically treated as the primary key.

**Alternative:** Use \`$primaryKey\` directive for composite keys:
\`\`\`typescript
$primaryKey: ['tenantId', 'id']
\`\`\``,
    insertText: ' #primary',
    sortPriority: 6,
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
  sortPriority: number;
  category: 'essential' | 'indexing' | 'search' | 'constraints' | 'behavior' | 'security';
}

const directiveCompletions: DirectiveCompletion[] = [
  // Essential directives - most commonly used
  {
    label: '$type',
    detail: 'Entity type name',
    documentation: `Defines the entity type name. Should match the key in the schema.

**Example:**
\`\`\`typescript
User: {
  $type: 'User',
  // ...
}
\`\`\`

**Note:** This is often optional as the type is inferred from the key name.`,
    insertText: "\\$type: '${1:EntityName}'",
    sortPriority: 0,
    category: 'essential',
  },
  {
    label: '$partitionBy',
    detail: 'Partition key (multi-tenancy)',
    documentation: `Defines the partition key(s) for data distribution. **Essential for multi-tenant applications.**

**Example:**
\`\`\`typescript
User: {
  $partitionBy: ['tenantId'],
  tenantId: 'uuid!',
  // ...
}
\`\`\`

**Multi-tenant pattern:**
\`\`\`typescript
// All entities partitioned by tenant
const db = DB({
  Organization: {
    id: 'uuid!',
    name: 'string!',
  },
  User: {
    $partitionBy: ['organizationId'],
    organizationId: 'uuid!',
    email: 'string! #unique',
    // ...
  },
  Post: {
    $partitionBy: ['organizationId'],
    organizationId: 'uuid!',
    // ...
  },
})
\`\`\`

**Benefits:**
- Data isolation between tenants
- Efficient queries within tenant
- Horizontal scaling capability`,
    insertText: "\\$partitionBy: ['${1:tenantId}']",
    sortPriority: 1,
    category: 'essential',
  },

  // Indexing directives
  {
    label: '$index',
    detail: 'Secondary/composite indexes',
    documentation: `Defines secondary indexes on one or more fields. Supports composite indexes.

**Syntax:** Array of field arrays - each inner array is one index.

**Example:**
\`\`\`typescript
$index: [
  ['email'],                    // Single-field index
  ['status', 'createdAt'],      // Composite index
  ['userId'],                   // Foreign key index
]
\`\`\`

**Common patterns:**
\`\`\`typescript
// Blog posts
Post: {
  $index: [
    ['authorId'],              // Find posts by author
    ['status', 'publishedAt'], // Published posts sorted by date
    ['categoryId', 'createdAt'], // Category listing
  ],
  // ...
}

// E-commerce orders
Order: {
  $index: [
    ['customerId'],            // Customer's orders
    ['status'],                // Orders by status
    ['createdAt'],             // Recent orders
  ],
  // ...
}
\`\`\`

**Note:** Order matters in composite indexes. Put equality filters first, range/sort filters last.`,
    insertText: "\\$index: [['${1:field1}'], ['${2:field2}', '${3:field3}']]",
    sortPriority: 10,
    category: 'indexing',
  },
  {
    label: '$unique',
    detail: 'Unique constraints',
    documentation: `Defines unique constraints on field combinations.

**Syntax:** Array of field arrays - each inner array is one unique constraint.

**Example:**
\`\`\`typescript
$unique: [
  ['email'],                   // Unique email
  ['tenantId', 'slug'],        // Unique slug per tenant
]
\`\`\`

**Common patterns:**
\`\`\`typescript
// User with unique email per tenant
User: {
  $unique: [['tenantId', 'email']],
  tenantId: 'uuid!',
  email: 'string!',
}

// Post with unique slug per author
Post: {
  $unique: [['authorId', 'slug']],
  authorId: 'uuid!',
  slug: 'string!',
}
\`\`\`

**Note:** Unique constraints also create indexes for efficient lookups.`,
    insertText: "\\$unique: [['${1:field1}', '${2:field2}']]",
    sortPriority: 11,
    category: 'indexing',
  },
  {
    label: '$primaryKey',
    detail: 'Primary key field(s)',
    documentation: `Defines the primary key field(s). Defaults to 'id' if not specified.

**Example:**
\`\`\`typescript
// Simple primary key (default)
$primaryKey: ['id']

// Composite primary key
$primaryKey: ['tenantId', 'id']
\`\`\`

**Composite key pattern:**
\`\`\`typescript
// Multi-tenant with composite key
User: {
  $primaryKey: ['tenantId', 'id'],
  tenantId: 'uuid!',
  id: 'uuid!',
  // ...
}
\`\`\`

**Note:** Usually not needed - 'id' is the default primary key.`,
    insertText: "\\$primaryKey: ['${1:id}']",
    sortPriority: 12,
    category: 'indexing',
  },
  {
    label: '$sortBy',
    detail: 'Default sort order',
    documentation: `Defines the default sort order for queries.

**Example:**
\`\`\`typescript
$sortBy: ['createdAt']           // Sort by creation date
$sortBy: ['-createdAt']          // Descending (newest first)
$sortBy: ['status', '-priority'] // Multi-field sort
\`\`\`

**Common patterns:**
\`\`\`typescript
// Blog posts - newest first
Post: {
  $sortBy: ['-publishedAt'],
  // ...
}

// Tasks - by priority then date
Task: {
  $sortBy: ['status', '-priority', 'dueDate'],
  // ...
}
\`\`\`

**Note:** Prefix with '-' for descending order.`,
    insertText: "\\$sortBy: ['${1:-createdAt}']",
    sortPriority: 13,
    category: 'indexing',
  },
  {
    label: '$cluster',
    detail: 'Clustering key (physical order)',
    documentation: `Defines the clustering key for physical data ordering on disk.

**Example:**
\`\`\`typescript
$cluster: ['tenantId', 'createdAt']
\`\`\`

**Benefits:**
- Faster range queries on clustered fields
- Efficient time-series queries
- Better data locality

**Common patterns:**
\`\`\`typescript
// Time-series data
Event: {
  $cluster: ['userId', 'timestamp'],
  userId: 'uuid!',
  timestamp: 'datetime!',
  // ...
}

// Multi-tenant with time ordering
AuditLog: {
  $cluster: ['tenantId', 'createdAt'],
  // ...
}
\`\`\``,
    insertText: "\\$cluster: ['${1:tenantId}', '${2:createdAt}']",
    sortPriority: 14,
    category: 'indexing',
  },

  // Search directives
  {
    label: '$fts',
    detail: 'Full-text search fields',
    documentation: `Enables full-text search on specified fields. Supports hybrid search with vectors.

**Example:**
\`\`\`typescript
$fts: ['title', 'content']       // Search these fields
$fts: ['name', 'description', 'tags']
\`\`\`

**Search patterns:**
\`\`\`typescript
// Blog with full-text search
Post: {
  $fts: ['title', 'content'],
  title: 'string!',
  content: 'text!',
}

// Product search
Product: {
  $fts: ['name', 'description', 'category'],
  name: 'string!',
  description: 'text!',
  category: 'string!',
}
\`\`\`

**Hybrid search (FTS + Vectors):**
\`\`\`typescript
Document: {
  $fts: ['content'],
  $vector: 'embedding',
  content: 'text!',
  embedding: 'vector[1536] ~> content',
}
\`\`\``,
    insertText: "\\$fts: ['${1:title}', '${2:content}']",
    sortPriority: 20,
    category: 'search',
  },
  {
    label: '$vector',
    detail: 'Vector search field',
    documentation: `Specifies the vector field for semantic search.

**Example:**
\`\`\`typescript
$vector: 'embedding'
\`\`\`

**Semantic search pattern:**
\`\`\`typescript
Document: {
  $vector: 'embedding',
  content: 'text!',
  embedding: 'vector[1536] ~> content',
}
\`\`\`

**Multiple embeddings:**
\`\`\`typescript
Product: {
  $vector: 'descriptionEmbedding',  // Primary vector for search
  description: 'text!',
  descriptionEmbedding: 'vector[1536] ~> description',
  imageEmbedding: 'vector[512]',    // Secondary (manual)
}
\`\`\`

**Usage:**
\`\`\`typescript
// Semantic search
const results = await db.Document.search('similar documents')
\`\`\``,
    insertText: "\\$vector: '${1:embedding}'",
    sortPriority: 21,
    category: 'search',
  },

  // Constraint directives
  {
    label: '$check',
    detail: 'Check constraint',
    documentation: `Defines a check constraint for data validation.

**Example:**
\`\`\`typescript
$check: 'price >= 0'
$check: 'endDate > startDate'
$check: 'quantity >= 0 AND quantity <= 1000'
\`\`\`

**Common patterns:**
\`\`\`typescript
// Price must be positive
Product: {
  $check: 'price >= 0',
  price: 'decimal(10,2)!',
}

// Date range validation
Event: {
  $check: 'endDate >= startDate',
  startDate: 'datetime!',
  endDate: 'datetime!',
}

// Percentage range
Discount: {
  $check: 'percentage >= 0 AND percentage <= 100',
  percentage: 'int!',
}
\`\`\``,
    insertText: "\\$check: '${1:field >= 0}'",
    sortPriority: 30,
    category: 'constraints',
  },
  {
    label: '$default',
    detail: 'Default values',
    documentation: `Defines default values for fields.

**Example:**
\`\`\`typescript
$default: {
  status: 'draft',
  version: 1,
  isActive: true,
}
\`\`\`

**Common patterns:**
\`\`\`typescript
// Content with defaults
Post: {
  $default: {
    status: 'draft',
    viewCount: 0,
    published: false,
  },
  status: 'string!',
  viewCount: 'int!',
  published: 'boolean!',
}

// User settings
User: {
  $default: {
    role: 'user',
    locale: 'en',
    theme: 'system',
  },
  // ...
}
\`\`\``,
    insertText: "\\$default: { ${1:status}: '${2:draft}' }",
    sortPriority: 31,
    category: 'constraints',
  },
  {
    label: '$validate',
    detail: 'Validation rules',
    documentation: `Defines custom validation rules for the entity.

**Example:**
\`\`\`typescript
$validate: {
  email: 'email',
  age: 'min:0,max:150',
  url: 'url',
  phone: 'phone',
}
\`\`\`

**Built-in validators:**
- \`email\` - Valid email format
- \`url\` - Valid URL format
- \`phone\` - Phone number format
- \`min:N\` - Minimum value/length
- \`max:N\` - Maximum value/length
- \`length:N\` - Exact length
- \`regex:pattern\` - Custom regex

**Common patterns:**
\`\`\`typescript
User: {
  $validate: {
    email: 'email',
    username: 'min:3,max:30',
    age: 'min:0,max:150',
  },
  // ...
}
\`\`\``,
    insertText: "\\$validate: { ${1:email}: '${2:email}' }",
    sortPriority: 32,
    category: 'constraints',
  },
  {
    label: '$computed',
    detail: 'Computed/derived fields',
    documentation: `Defines computed/derived fields calculated from other fields.

**Example:**
\`\`\`typescript
$computed: {
  fullName: 'firstName + " " + lastName',
  displayPrice: 'price * (1 - discount)',
}
\`\`\`

**Common patterns:**
\`\`\`typescript
// User full name
User: {
  $computed: {
    fullName: 'firstName + " " + lastName',
  },
  firstName: 'string!',
  lastName: 'string!',
}

// Order total
OrderItem: {
  $computed: {
    subtotal: 'quantity * unitPrice',
  },
  quantity: 'int!',
  unitPrice: 'decimal(10,2)!',
}
\`\`\``,
    insertText: "\\$computed: { ${1:fullName}: '${2:firstName + \" \" + lastName}' }",
    sortPriority: 33,
    category: 'constraints',
  },

  // Behavior directives
  {
    label: '$cascade',
    detail: 'Cascade delete relations',
    documentation: `Defines cascade delete behavior for relations.

**Example:**
\`\`\`typescript
$cascade: ['posts', 'comments']
\`\`\`

**Pattern:**
\`\`\`typescript
User: {
  $cascade: ['posts', 'comments'],  // Delete user's posts and comments
  posts: '[Post] -> author',
  comments: '[Comment] -> author',
}
\`\`\`

**Warning:** Cascade deletes can remove large amounts of data. Use with caution.`,
    insertText: "\\$cascade: ['${1:relation}']",
    sortPriority: 40,
    category: 'behavior',
  },
  {
    label: '$onDelete',
    detail: 'On delete behavior',
    documentation: `Defines behavior when a related entity is deleted.

**Options:**
- \`cascade\` - Delete this record too
- \`restrict\` - Prevent deletion if references exist
- \`set_null\` - Set the reference to null

**Example:**
\`\`\`typescript
$onDelete: 'cascade'     // Delete with parent
$onDelete: 'restrict'    // Prevent parent deletion
$onDelete: 'set_null'    // Set reference to null
\`\`\`

**Common patterns:**
\`\`\`typescript
// Comments deleted with post
Comment: {
  $onDelete: 'cascade',
  post: '-> Post!',
}

// Prevent deleting user with orders
Order: {
  $onDelete: 'restrict',
  user: '-> User!',
}
\`\`\``,
    insertText: "\\$onDelete: '${1|cascade,restrict,set_null|}'",
    sortPriority: 41,
    category: 'behavior',
  },
  {
    label: '$onUpdate',
    detail: 'On update behavior',
    documentation: `Defines behavior when a related entity is updated.

**Options:**
- \`cascade\` - Update references automatically
- \`restrict\` - Prevent update if references exist

**Example:**
\`\`\`typescript
$onUpdate: 'cascade'
$onUpdate: 'restrict'
\`\`\``,
    insertText: "\\$onUpdate: '${1|cascade,restrict|}'",
    sortPriority: 42,
    category: 'behavior',
  },
  {
    label: '$ttl',
    detail: 'Time to live (auto-expire)',
    documentation: `Defines automatic expiration for records.

**Duration format:**
- \`30s\` - 30 seconds
- \`5m\` - 5 minutes
- \`2h\` - 2 hours
- \`7d\` - 7 days
- \`30d\` - 30 days

**Example:**
\`\`\`typescript
$ttl: '30d'              // Expire after 30 days
$ttl: '24h'              // Expire after 24 hours
$ttl: '1h'               // Expire after 1 hour
\`\`\`

**Common patterns:**
\`\`\`typescript
// Session tokens
Session: {
  $ttl: '7d',            // Sessions expire in 7 days
  token: 'string!',
  userId: 'uuid!',
}

// Temporary uploads
TempFile: {
  $ttl: '24h',           // Clean up after 24 hours
  path: 'string!',
}

// Cache entries
Cache: {
  $ttl: '5m',            // Short-lived cache
  key: 'string!',
  value: 'json!',
}
\`\`\``,
    insertText: "\\$ttl: '${1:30d}'",
    sortPriority: 43,
    category: 'behavior',
  },
  {
    label: '$immutable',
    detail: 'Immutable fields',
    documentation: `Marks fields that cannot be updated after creation.

**Example:**
\`\`\`typescript
$immutable: ['createdAt', 'createdBy', 'id']
\`\`\`

**Common patterns:**
\`\`\`typescript
// Audit fields
AuditLog: {
  $immutable: ['createdAt', 'action', 'userId', 'entityId'],
  createdAt: 'datetime!',
  action: 'string!',
  userId: 'uuid!',
  entityId: 'uuid!',
}

// Financial records
Transaction: {
  $immutable: ['amount', 'currency', 'createdAt'],
  amount: 'decimal(18,8)!',
  currency: 'string!',
  createdAt: 'datetime!',
}
\`\`\``,
    insertText: "\\$immutable: ['${1:createdAt}', '${2:createdBy}']",
    sortPriority: 44,
    category: 'behavior',
  },
  {
    label: '$audit',
    detail: 'Enable audit logging',
    documentation: `Enables audit logging for the entity. Tracks all changes with who, when, and what.

**Example:**
\`\`\`typescript
$audit: true
\`\`\`

**What gets logged:**
- Who made the change (user ID)
- When the change occurred
- What changed (field values)
- Type of change (create, update, delete)

**Common patterns:**
\`\`\`typescript
// Financial data - always audit
Transaction: {
  $audit: true,
  amount: 'decimal(18,8)!',
  // ...
}

// Sensitive user data
User: {
  $audit: true,
  // ...
}
\`\`\``,
    insertText: '\\$audit: ${1|true,false|}',
    sortPriority: 45,
    category: 'behavior',
  },

  // Security directives
  {
    label: '$encrypted',
    detail: 'Encrypted fields',
    documentation: `Marks fields that should be encrypted at rest.

**Example:**
\`\`\`typescript
$encrypted: ['ssn', 'creditCard', 'apiKey']
\`\`\`

**Common patterns:**
\`\`\`typescript
// User PII
User: {
  $encrypted: ['ssn', 'dateOfBirth'],
  ssn: 'string?',
  dateOfBirth: 'date?',
}

// Payment data
PaymentMethod: {
  $encrypted: ['cardNumber', 'cvv'],
  cardNumber: 'string!',
  cvv: 'string!',
}

// API credentials
Integration: {
  $encrypted: ['apiKey', 'apiSecret'],
  apiKey: 'string!',
  apiSecret: 'string!',
}
\`\`\`

**Note:** Encrypted fields have some query limitations.`,
    insertText: "\\$encrypted: ['${1:sensitiveField}']",
    sortPriority: 50,
    category: 'security',
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
  sortPriority: number;
}

const relationCompletions: RelationCompletion[] = [
  {
    label: '->',
    detail: 'Belongs to (foreign key)',
    documentation: `Creates a forward relation (belongs to). References another entity by ID.

**Syntax:** \`'-> Entity!'\` or \`'-> Entity?'\`

**Example:**
\`\`\`typescript
// Required relation
author: '-> User!'       // Post must have an author

// Optional relation
category: '-> Category?' // Category is optional
\`\`\`

**Common patterns:**
\`\`\`typescript
// Blog post belongs to author
Post: {
  author: '-> User!',
  category: '-> Category?',
}

// Order belongs to customer
Order: {
  customer: '-> User!',
  shippingAddress: '-> Address?',
}

// Comment belongs to post and user
Comment: {
  post: '-> Post!',
  author: '-> User!',
}
\`\`\`

**Note:** This creates a foreign key field. The actual ID is stored in the record.`,
    insertText: '-> ${1:Entity}${2|!,?|}',
    sortPriority: 0,
  },
  {
    label: '[Entity] ->',
    detail: 'Has many (one-to-many)',
    documentation: `Creates a has-many relation with explicit back-reference.

**Syntax:** \`'[Entity] -> backRefField'\`

**Example:**
\`\`\`typescript
// User has many posts
User: {
  posts: '[Post] -> author',    // References Post.author
}

// Post has many comments
Post: {
  comments: '[Comment] -> post', // References Comment.post
}
\`\`\`

**Complete example:**
\`\`\`typescript
const db = DB({
  User: {
    id: 'uuid!',
    name: 'string!',
    posts: '[Post] -> author',      // Has many posts
    comments: '[Comment] -> author', // Has many comments
  },
  Post: {
    id: 'uuid!',
    title: 'string!',
    author: '-> User!',              // Belongs to user
    comments: '[Comment] -> post',   // Has many comments
  },
  Comment: {
    id: 'uuid!',
    content: 'text!',
    author: '-> User!',              // Belongs to user
    post: '-> Post!',                // Belongs to post
  },
})
\`\`\``,
    insertText: '[${1:Entity}] -> ${2:backRef}',
    sortPriority: 1,
  },
  {
    label: '<-',
    detail: 'Backward relation (inverse)',
    documentation: `Creates a backward relation referencing a field on another entity.

**Syntax:** \`'<- Entity.field[]'\`

**Example:**
\`\`\`typescript
// User's posts (inverse of Post.author)
posts: '<- Post.author[]'

// User's comments (inverse of Comment.author)
comments: '<- Comment.author[]'
\`\`\`

**Note:** This is an alternative syntax to \`[Entity] -> field\`. Use whichever is clearer.`,
    insertText: '<- ${1:Entity}.${2:backRef}[]',
    sortPriority: 2,
  },
  {
    label: '<->',
    detail: 'Many-to-many (bidirectional)',
    documentation: `Creates a bidirectional many-to-many relation.

**Syntax:** \`'<-> Entity[]'\`

**Example:**
\`\`\`typescript
// Users can be friends with each other
User: {
  friends: '<-> User[]',
}

// Posts can have many tags, tags can have many posts
Post: {
  tags: '<-> Tag[]',
}
Tag: {
  posts: '<-> Post[]',
}
\`\`\`

**Common patterns:**
\`\`\`typescript
// Social network - followers/following
User: {
  followers: '<-> User[]',
  following: '<-> User[]',
}

// Course enrollment
Course: {
  students: '<-> User[]',
}
User: {
  courses: '<-> Course[]',
}
\`\`\`

**Note:** Creates a junction table automatically.`,
    insertText: '<-> ${1:Entity}[]',
    sortPriority: 3,
  },
  {
    label: '~>',
    detail: 'AI generation / semantic',
    documentation: `Creates a fuzzy/semantic relation or AI generation directive.

**Two uses:**

**1. AI Field Generation:**
\`\`\`typescript
// Generate summary from content
summary: 'text ~> content'

// Generate embedding from text
embedding: 'vector[1536] ~> content'
\`\`\`

**2. Semantic Relations:**
\`\`\`typescript
// Find similar products
similar: '~> Product[]'

// Find related articles
related: '~> Article[]'
\`\`\`

**AI Generation patterns:**
\`\`\`typescript
Article: {
  content: 'text!',

  // Auto-generated fields
  summary: 'text ~> content',           // AI summary
  embedding: 'vector[1536] ~> content', // Vector embedding
  keywords: 'json ~> content',          // Extracted keywords
}
\`\`\`

**Semantic search pattern:**
\`\`\`typescript
Product: {
  description: 'text!',
  embedding: 'vector[1536] ~> description',
  similar: '~> Product[]',  // Find similar products

  $vector: 'embedding',
}
\`\`\``,
    insertText: '~> ${1:sourceField}',
    sortPriority: 4,
  },
  {
    label: '<~',
    detail: 'Backward semantic relation',
    documentation: `Creates a backward fuzzy/semantic relation.

**Example:**
\`\`\`typescript
// Products related to this one
relatedTo: '<~ Product[]'
\`\`\`

**Note:** Less common than \`~>\`. Use for inverse semantic relationships.`,
    insertText: '<~ ${1:Entity}[]',
    sortPriority: 5,
  },
];

// ============================================================================
// Nested Object / Complex Pattern Completions
// ============================================================================

interface PatternCompletion {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
  sortPriority: number;
}

const patternCompletions: PatternCompletion[] = [
  {
    label: 'entity',
    detail: 'New entity definition',
    documentation: `Create a new entity definition with common fields.

**Template:**
\`\`\`typescript
EntityName: {
  $type: 'EntityName',
  id: 'uuid!',
  createdAt: 'datetime!',
  updatedAt: 'datetime?',
  // ... your fields
}
\`\`\``,
    insertText: `\${1:EntityName}: {
  \\$type: '\${1:EntityName}',

  id: 'uuid!',
  \${2:name}: '\${3:string!}',
  createdAt: 'datetime!',
  updatedAt: 'datetime?',
  $0
},`,
    sortPriority: 0,
  },
  {
    label: 'entity-tenant',
    detail: 'Multi-tenant entity',
    documentation: `Create a multi-tenant entity with partition key.

**Template:**
\`\`\`typescript
EntityName: {
  $partitionBy: ['tenantId'],
  tenantId: 'uuid!',
  // ...
}
\`\`\``,
    insertText: `\${1:EntityName}: {
  \\$type: '\${1:EntityName}',
  \\$partitionBy: ['tenantId'],

  id: 'uuid!',
  tenantId: 'uuid!',
  \${2:name}: '\${3:string!}',
  createdAt: 'datetime!',
  updatedAt: 'datetime?',
  $0
},`,
    sortPriority: 1,
  },
  {
    label: 'entity-fts',
    detail: 'Searchable entity',
    documentation: `Create an entity with full-text search enabled.

**Template:**
\`\`\`typescript
EntityName: {
  $fts: ['title', 'content'],
  title: 'string!',
  content: 'text!',
  // ...
}
\`\`\``,
    insertText: `\${1:EntityName}: {
  \\$type: '\${1:EntityName}',
  \\$fts: ['\${2:title}', '\${3:content}'],

  id: 'uuid!',
  \${2:title}: 'string!',
  \${3:content}: 'text!',
  createdAt: 'datetime!',
  $0
},`,
    sortPriority: 2,
  },
  {
    label: 'entity-vector',
    detail: 'Entity with vector search',
    documentation: `Create an entity with semantic/vector search.

**Template:**
\`\`\`typescript
EntityName: {
  $vector: 'embedding',
  content: 'text!',
  embedding: 'vector[1536] ~> content',
  // ...
}
\`\`\``,
    insertText: `\${1:EntityName}: {
  \\$type: '\${1:EntityName}',
  \\$vector: 'embedding',

  id: 'uuid!',
  \${2:content}: 'text!',
  embedding: 'vector[\${3:1536}] ~> \${2:content}',
  createdAt: 'datetime!',
  $0
},`,
    sortPriority: 3,
  },
  {
    label: 'entity-audit',
    detail: 'Audited entity',
    documentation: `Create an entity with audit logging and immutable fields.

**Template:**
\`\`\`typescript
EntityName: {
  $audit: true,
  $immutable: ['createdAt', 'createdBy'],
  // ...
}
\`\`\``,
    insertText: `\${1:EntityName}: {
  \\$type: '\${1:EntityName}',
  \\$audit: true,
  \\$immutable: ['createdAt', 'createdBy'],

  id: 'uuid!',
  \${2:name}: '\${3:string!}',
  createdAt: 'datetime!',
  createdBy: 'uuid!',
  updatedAt: 'datetime?',
  updatedBy: 'uuid?',
  $0
},`,
    sortPriority: 4,
  },
  {
    label: 'user-entity',
    detail: 'User entity template',
    documentation: `Standard User entity with common fields.`,
    insertText: `User: {
  \\$type: 'User',
  \\$index: [['email'], ['createdAt']],

  id: 'uuid!',
  email: 'string! #unique',
  name: 'string!',
  avatar: 'string?',
  role: 'enum(user,admin,moderator)!',
  emailVerified: 'boolean!',
  createdAt: 'datetime!',
  updatedAt: 'datetime?',
  lastLoginAt: 'datetime?',
  $0
},`,
    sortPriority: 10,
  },
  {
    label: 'post-entity',
    detail: 'Post/Article entity template',
    documentation: `Blog post or article entity with full-text search.`,
    insertText: `Post: {
  \\$type: 'Post',
  \\$fts: ['title', 'content'],
  \\$index: [['authorId'], ['status', 'publishedAt']],

  id: 'uuid!',
  title: 'string!',
  slug: 'string! #unique',
  content: 'text!',
  excerpt: 'text?',
  status: 'enum(draft,published,archived)!',
  author: '-> User!',
  publishedAt: 'datetime?',
  createdAt: 'datetime!',
  updatedAt: 'datetime?',
  $0
},`,
    sortPriority: 11,
  },
  {
    label: 'comment-entity',
    detail: 'Comment entity template',
    documentation: `Comment entity with parent-child support for threading.`,
    insertText: `Comment: {
  \\$type: 'Comment',
  \\$index: [['postId'], ['authorId'], ['parentId']],

  id: 'uuid!',
  content: 'text!',
  post: '-> Post!',
  author: '-> User!',
  parent: '-> Comment?',
  replies: '[Comment] -> parent',
  createdAt: 'datetime!',
  updatedAt: 'datetime?',
  $0
},`,
    sortPriority: 12,
  },
  {
    label: 'org-entity',
    detail: 'Organization/Team entity',
    documentation: `Organization or team entity for multi-tenant apps.`,
    insertText: `Organization: {
  \\$type: 'Organization',

  id: 'uuid!',
  name: 'string!',
  slug: 'string! #unique',
  logo: 'string?',
  plan: 'enum(free,pro,enterprise)!',
  members: '[Membership] -> organization',
  createdAt: 'datetime!',
  $0
},`,
    sortPriority: 13,
  },
  {
    label: 'membership-entity',
    detail: 'Membership/Role assignment',
    documentation: `Membership entity for user-organization relationships.`,
    insertText: `Membership: {
  \\$type: 'Membership',
  \\$unique: [['organizationId', 'userId']],

  id: 'uuid!',
  organization: '-> Organization!',
  user: '-> User!',
  role: 'enum(owner,admin,member,viewer)!',
  createdAt: 'datetime!',
  $0
},`,
    sortPriority: 14,
  },
];

// ============================================================================
// Completion Provider
// ============================================================================

/**
 * Creates completion items for IceType types with improved sorting
 */
function createTypeCompletions(): vscode.CompletionItem[] {
  return primitiveTypes.map((type) => {
    const item = new vscode.CompletionItem(type.label, vscode.CompletionItemKind.TypeParameter);
    item.detail = type.detail;
    item.documentation = new vscode.MarkdownString(type.documentation);
    if (type.insertText) {
      item.insertText = new vscode.SnippetString(type.insertText);
    }
    // Use sortPriority for better ordering (pad with zeros for proper string sorting)
    item.sortText = `0_${String(type.sortPriority).padStart(3, '0')}_${type.label}`;
    return item;
  });
}

/**
 * Creates completion items for IceType modifiers with improved sorting
 */
function createModifierCompletions(): vscode.CompletionItem[] {
  return modifierCompletions.map((mod) => {
    const item = new vscode.CompletionItem(mod.label, vscode.CompletionItemKind.Operator);
    item.detail = mod.detail;
    item.documentation = new vscode.MarkdownString(mod.documentation);
    item.insertText = new vscode.SnippetString(mod.insertText);
    item.sortText = `1_${String(mod.sortPriority).padStart(3, '0')}_${mod.label}`;
    return item;
  });
}

/**
 * Creates completion items for IceType directives with improved sorting
 */
function createDirectiveCompletions(): vscode.CompletionItem[] {
  return directiveCompletions.map((dir) => {
    const item = new vscode.CompletionItem(dir.label, vscode.CompletionItemKind.Keyword);
    item.detail = `[${dir.category}] ${dir.detail}`;
    item.documentation = new vscode.MarkdownString(dir.documentation);
    item.insertText = new vscode.SnippetString(dir.insertText);
    item.sortText = `2_${String(dir.sortPriority).padStart(3, '0')}_${dir.label}`;
    return item;
  });
}

/**
 * Creates completion items for IceType relations with improved sorting
 */
function createRelationCompletions(): vscode.CompletionItem[] {
  return relationCompletions.map((rel) => {
    const item = new vscode.CompletionItem(rel.label, vscode.CompletionItemKind.Reference);
    item.detail = rel.detail;
    item.documentation = new vscode.MarkdownString(rel.documentation);
    item.insertText = new vscode.SnippetString(rel.insertText);
    item.sortText = `3_${String(rel.sortPriority).padStart(3, '0')}_${rel.label}`;
    return item;
  });
}

/**
 * Creates completion items for IceType patterns (entity templates, etc.)
 */
function createPatternCompletions(): vscode.CompletionItem[] {
  return patternCompletions.map((pattern) => {
    const item = new vscode.CompletionItem(pattern.label, vscode.CompletionItemKind.Snippet);
    item.detail = pattern.detail;
    item.documentation = new vscode.MarkdownString(pattern.documentation);
    item.insertText = new vscode.SnippetString(pattern.insertText);
    item.sortText = `4_${String(pattern.sortPriority).padStart(3, '0')}_${pattern.label}`;
    return item;
  });
}

/**
 * Completion context types for context-aware suggestions
 */
type CompletionContext =
  | 'type'           // Inside a type string, show types
  | 'modifier'       // After a type, show modifiers (!, ?, #index)
  | 'directive'      // Property starting with $
  | 'relation'       // Relation operator context
  | 'field'          // Inside entity, can add fields or directives
  | 'entity'         // At top level, can add entities
  | 'all';           // Show everything

/**
 * Determines the completion context based on cursor position
 * with improved context awareness
 */
function getCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position
): CompletionContext {
  const line = document.lineAt(position).text;
  const textBeforeCursor = line.substring(0, position.character);

  // Get the full document text up to the cursor for deeper context analysis
  const fullText = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

  // Check for directive context: after '$' at the start of a property name
  if (/\$\w*$/.test(textBeforeCursor)) {
    return 'directive';
  }

  // Check if we're inside a string (after a colon and quote)
  const afterColonQuote = /:\s*['"][^'"]*$/.test(textBeforeCursor);

  if (afterColonQuote) {
    // Check for relation context: after '- ' or '~ ' or '< ' or '[Entity] -'
    if (/[-~<]\s*$/.test(textBeforeCursor) || /\[[\w]+\]\s*->\s*$/.test(textBeforeCursor)) {
      return 'relation';
    }

    // Check for AI generation context: after '~>'
    if (/~>\s*$/.test(textBeforeCursor)) {
      return 'relation';
    }

    // Check for modifier context: after a type name (with possible vector dimensions or decimal precision)
    if (/['"](?:uuid|string|text|int|integer|bigint|float|double|decimal|boolean|bool|date|datetime|timestamp|time|json|jsonb|binary|blob|bytes|vector|esm|enum)(?:\[\d+\])?(?:\([^)]*\))?(?:\s*~>\s*\w+)?\s*$/.test(textBeforeCursor)) {
      return 'modifier';
    }

    // Check if typing a relation operator start
    if (/['"](?:->?|<-?|~>?|\[)\s*$/.test(textBeforeCursor)) {
      return 'relation';
    }

    // Default to type + relation completions inside strings
    if (/['"][^'"]*$/.test(textBeforeCursor)) {
      return 'type';
    }
  }

  // Check for index modifier context: after '#'
  if (/#\w*$/.test(textBeforeCursor)) {
    return 'modifier';
  }

  // Check if we're at the start of a new property (could be field or directive)
  // Look for pattern like "  name" at start of property name
  if (/^\s*[\w$]*$/.test(textBeforeCursor)) {
    // Determine if we're inside an entity block or at top level
    const braceDepth = countBraceDepth(fullText);

    if (braceDepth >= 2) {
      // Inside entity block - show fields and directives
      return 'field';
    } else if (braceDepth === 1) {
      // Inside DB({}) but not in an entity - show entity patterns
      return 'entity';
    }
  }

  return 'all';
}

/**
 * Count the brace depth at the current position
 * to determine if we're inside an entity block
 */
function countBraceDepth(text: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    const prevChar = i > 0 ? text[i - 1] : '';

    // Handle string boundaries
    if ((char === "'" || char === '"' || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    // Skip if inside string
    if (inString) continue;

    // Count braces
    if (char === '{') depth++;
    if (char === '}') depth--;
  }

  return depth;
}

/**
 * IceType Completion Item Provider
 *
 * Provides context-aware completions for IceType schemas:
 * - Inside entity blocks: field types, relations, entity-level directives
 * - At top level: entity patterns and schema templates
 * - After type names: modifiers (!, ?, #index, #unique)
 * - Inside strings: types and relation operators
 */
export class IceTypeCompletionProvider implements vscode.CompletionItemProvider {
  private typeCompletions: vscode.CompletionItem[];
  private modifierCompletions: vscode.CompletionItem[];
  private directiveCompletions: vscode.CompletionItem[];
  private relationCompletions: vscode.CompletionItem[];
  private patternCompletions: vscode.CompletionItem[];

  constructor() {
    this.typeCompletions = createTypeCompletions();
    this.modifierCompletions = createModifierCompletions();
    this.directiveCompletions = createDirectiveCompletions();
    this.relationCompletions = createRelationCompletions();
    this.patternCompletions = createPatternCompletions();
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
        // Inside a type string - show types and relation operators
        return [...this.typeCompletions, ...this.relationCompletions];

      case 'modifier':
        // After a type - show modifiers
        return this.modifierCompletions;

      case 'directive':
        // After $ - show directives
        return this.directiveCompletions;

      case 'relation':
        // After relation operator - show relation completions
        return this.relationCompletions;

      case 'field':
        // Inside entity block - show fields (types) and directives
        return [
          ...this.typeCompletions,
          ...this.directiveCompletions,
          ...this.relationCompletions,
        ];

      case 'entity':
        // At top level inside DB({}) - show entity patterns
        return this.patternCompletions;

      case 'all':
      default:
        // Unknown context - show everything
        return [
          ...this.typeCompletions,
          ...this.modifierCompletions,
          ...this.directiveCompletions,
          ...this.relationCompletions,
          ...this.patternCompletions,
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
