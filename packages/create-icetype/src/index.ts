#!/usr/bin/env node
/**
 * create-icetype
 *
 * Scaffold new IceType projects with best-practice configuration.
 *
 * Usage:
 *   npx create-icetype my-app
 *   npx create-icetype my-app --template with-postgres
 *   npx create-icetype my-app --template with-drizzle
 *   npx create-icetype my-app --template with-clickhouse
 *   npx create-icetype my-app --template with-iceberg
 *
 * Templates:
 *   basic          - Minimal IceType setup with SQLite
 *   with-postgres  - IceType with PostgreSQL adapter
 *   with-drizzle   - IceType with Drizzle ORM integration
 *   with-clickhouse - IceType with ClickHouse analytics
 *   with-iceberg   - IceType with Apache Iceberg for data lakes
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface CreateOptions {
  projectName: string
  template: 'basic' | 'with-postgres' | 'with-drizzle' | 'with-clickhouse' | 'with-iceberg'
  interactive?: boolean
}

export interface GeneratorResult {
  success: boolean
  projectPath: string
  filesCreated: string[]
  error?: string
  warnings?: string[]
}

const VALID_TEMPLATES = ['basic', 'with-postgres', 'with-drizzle', 'with-clickhouse', 'with-iceberg'] as const

const VERSION = '0.1.0'

// Reserved npm package names that should trigger warnings
const RESERVED_NAMES = [
  'node_modules',
  'favicon.ico',
  'package',
  'npm',
  'node',
  'js',
  'javascript',
  'typescript',
  'ts',
  'http',
  'https',
  'fs',
  'path',
  'os',
  'crypto',
  'util',
  'events',
  'stream',
  'buffer',
  'console',
  'process',
  'module',
  'require',
  'exports',
  'global',
  'test',
  'tests',
  'example',
  'examples',
  'sample',
  'samples',
]

// Blacklisted names (npm scope or special)
const BLACKLISTED_NAMES = [
  'node_modules',
  'favicon.ico',
]

// ANSI color codes for CLI output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
}

// Color helper functions (can be disabled for testing)
let colorsEnabled = true

export function enableColors(enabled: boolean): void {
  colorsEnabled = enabled
}

function c(color: keyof typeof colors, text: string): string {
  if (!colorsEnabled) return text
  return `${colors[color]}${text}${colors.reset}`
}

/**
 * Validate npm package name according to npm naming rules
 */
function validateNpmPackageName(name: string): { valid: boolean; error?: string; warnings?: string[] } {
  const warnings: string[] = []

  // Basic checks
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Project name is required' }
  }

  // Check for invalid characters (< > : " | ? * are invalid on many file systems)
  if (/[<>:"|?*]/.test(name)) {
    return { valid: false, error: 'Project name contains invalid characters' }
  }

  // npm package name rules
  const packageName = path.basename(name)

  // Must be lowercase
  if (packageName !== packageName.toLowerCase()) {
    return { valid: false, error: 'Package name must be lowercase' }
  }

  // Cannot start with . or _
  if (packageName.startsWith('.') || packageName.startsWith('_')) {
    return { valid: false, error: 'Package name cannot start with . or _' }
  }

  // Cannot contain spaces
  if (/\s/.test(packageName)) {
    return { valid: false, error: 'Package name cannot contain spaces' }
  }

  // Cannot contain special URL characters
  if (/[~'!()*]/.test(packageName)) {
    return { valid: false, error: 'Package name cannot contain ~\'!()*' }
  }

  // Must be URL-safe (no non-URL-safe characters except @/)
  if (!/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(packageName)) {
    if (!packageName.includes('@') && !packageName.includes('/')) {
      // Simple name validation
      if (!/^[a-z0-9][a-z0-9-._]*$/.test(packageName)) {
        return { valid: false, error: 'Package name can only contain lowercase letters, numbers, hyphens, underscores, and periods' }
      }
    }
  }

  // Cannot be longer than 214 characters
  if (packageName.length > 214) {
    return { valid: false, error: 'Package name cannot be longer than 214 characters' }
  }

  // Check blacklisted names
  if (BLACKLISTED_NAMES.includes(packageName)) {
    return { valid: false, error: `"${packageName}" is a blacklisted name` }
  }

  // Check reserved names (warning, not error)
  if (RESERVED_NAMES.includes(packageName)) {
    warnings.push(`"${packageName}" is a reserved/common name that may cause conflicts`)
  }

  // Check for core Node.js module names
  const coreModules = ['fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'querystring', 'stream', 'util', 'events', 'buffer']
  if (coreModules.includes(packageName)) {
    warnings.push(`"${packageName}" is a core Node.js module name`)
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined }
}

/**
 * Validate project name (file system and npm compatible)
 */
function validateProjectName(name: string): { valid: boolean; error?: string; warnings?: string[] } {
  return validateNpmPackageName(name)
}

/**
 * Generate package.json content based on template
 */
function generatePackageJson(projectName: string, template: CreateOptions['template']): string {
  // Extract just the directory name for the package name
  const packageName = path.basename(projectName)

  const base = {
    name: packageName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      start: 'node dist/index.js',
      lint: 'eslint src',
      format: 'prettier --write .',
    } as Record<string, string>,
    dependencies: {
      '@icetype/core': '^0.1.0',
    } as Record<string, string>,
    devDependencies: {
      typescript: '^5.7.0',
      '@types/node': '^22.0.0',
    } as Record<string, string>,
  }

  // Add template-specific dependencies
  switch (template) {
    case 'basic':
      base.dependencies['@icetype/sqlite'] = '^0.1.0'
      break
    case 'with-postgres':
      base.dependencies['@icetype/core'] = '^0.1.0'
      base.dependencies['@icetype/postgres'] = '^0.1.0'
      base.scripts['db:migrate'] = 'icetype migrate'
      base.scripts['db:generate'] = 'icetype generate'
      break
    case 'with-drizzle':
      base.dependencies['@icetype/core'] = '^0.1.0'
      base.dependencies['@icetype/drizzle'] = '^0.1.0'
      base.dependencies['drizzle-orm'] = '^0.36.0'
      base.devDependencies['drizzle-kit'] = '^0.30.0'
      base.scripts['db:generate'] = 'drizzle-kit generate'
      base.scripts['db:push'] = 'drizzle-kit push'
      base.scripts['db:studio'] = 'drizzle-kit studio'
      break
    case 'with-clickhouse':
      base.dependencies['@icetype/core'] = '^0.1.0'
      base.dependencies['@icetype/clickhouse'] = '^0.1.0'
      base.dependencies['@clickhouse/client'] = '^1.0.0'
      base.scripts['analytics:migrate'] = 'icetype clickhouse:migrate'
      break
    case 'with-iceberg':
      base.dependencies['@icetype/core'] = '^0.1.0'
      base.dependencies['@icetype/iceberg'] = '^0.1.0'
      base.scripts['iceberg:sync'] = 'icetype iceberg:sync'
      base.scripts['iceberg:compact'] = 'icetype iceberg:compact'
      break
  }

  return JSON.stringify(base, null, 2)
}

/**
 * Generate tsconfig.json content
 */
function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: './dist',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      resolveJsonModule: true,
      isolatedModules: true,
    },
    include: ['src/**/*', '*.ts'],
    exclude: ['node_modules', 'dist'],
  }

  return JSON.stringify(config, null, 2)
}

/**
 * Generate schema.ts content based on template
 */
function generateSchema(template: CreateOptions['template']): string {
  if (template === 'with-postgres') {
    return `import { DB } from '@icetype/core'
import { PostgresAdapter } from '@icetype/postgres'

/**
 * IceType Schema - PostgreSQL Template
 *
 * This schema demonstrates a realistic e-commerce data model with:
 * - Users with profiles and authentication
 * - Products with categories and inventory
 * - Orders with line items and status tracking
 * - Reviews with ratings
 *
 * IceType field modifiers:
 *   !  - Required field
 *   ?  - Optional field
 *   #index - Create index for faster lookups
 *   #unique - Unique constraint
 *   -> - Forward relation (has many)
 *   <- - Backward relation (belongs to)
 */

export const db = DB({
  // User management
  User: {
    id: 'string! #unique',
    email: 'string! #unique #index',
    name: 'string!',
    passwordHash: 'string!',
    role: 'string!', // 'admin' | 'customer' | 'vendor'
    emailVerified: 'boolean!',
    avatarUrl: 'string?',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',

    // Relations
    profile: 'Profile? -> user',
    orders: '[Order] -> customer',
    reviews: '[Review] -> author',
    addresses: '[Address] -> user',
  },

  Profile: {
    id: 'string! #unique',
    bio: 'text?',
    phone: 'string?',
    dateOfBirth: 'datetime?',
    preferences: 'json?', // User preferences as JSON
    user: 'User! <- profile',
  },

  Address: {
    id: 'string! #unique',
    label: 'string!', // 'home', 'work', 'shipping'
    street: 'string!',
    city: 'string!',
    state: 'string?',
    postalCode: 'string!',
    country: 'string!',
    isDefault: 'boolean!',
    user: 'User! <- addresses',
  },

  // Product catalog
  Category: {
    id: 'string! #unique',
    name: 'string! #index',
    slug: 'string! #unique',
    description: 'text?',
    parentId: 'string? #index',
    imageUrl: 'string?',
    products: '[Product] -> category',
  },

  Product: {
    id: 'string! #unique',
    sku: 'string! #unique',
    name: 'string! #index',
    slug: 'string! #unique',
    description: 'text!',
    price: 'decimal!',
    compareAtPrice: 'decimal?',
    costPrice: 'decimal?',
    quantity: 'integer!',
    lowStockThreshold: 'integer!',
    isActive: 'boolean!',
    isFeatured: 'boolean!',
    weight: 'decimal?',
    dimensions: 'json?', // { length, width, height }
    metadata: 'json?',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',

    category: 'Category! <- products',
    images: '[ProductImage] -> product',
    reviews: '[Review] -> product',
    orderItems: '[OrderItem] -> product',
  },

  ProductImage: {
    id: 'string! #unique',
    url: 'string!',
    altText: 'string?',
    position: 'integer!',
    product: 'Product! <- images',
  },

  // Orders and transactions
  Order: {
    id: 'string! #unique',
    orderNumber: 'string! #unique #index',
    status: 'string! #index', // 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
    subtotal: 'decimal!',
    tax: 'decimal!',
    shipping: 'decimal!',
    total: 'decimal!',
    currency: 'string!',
    notes: 'text?',
    shippingAddress: 'json!',
    billingAddress: 'json!',
    createdAt: 'datetime! #index',
    updatedAt: 'datetime!',

    customer: 'User! <- orders',
    items: '[OrderItem] -> order',
  },

  OrderItem: {
    id: 'string! #unique',
    quantity: 'integer!',
    unitPrice: 'decimal!',
    total: 'decimal!',

    order: 'Order! <- items',
    product: 'Product! <- orderItems',
  },

  // Reviews and ratings
  Review: {
    id: 'string! #unique',
    rating: 'integer!', // 1-5
    title: 'string?',
    content: 'text?',
    isVerified: 'boolean!',
    helpfulCount: 'integer!',
    createdAt: 'datetime! #index',

    author: 'User! <- reviews',
    product: 'Product! <- reviews',
  },
})

// Configure PostgreSQL adapter
export const adapter = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL,
})

// Type exports for use in application code
export type Schema = typeof db
export type User = Schema['User']
export type Product = Schema['Product']
export type Order = Schema['Order']
`
  }

  if (template === 'with-clickhouse') {
    return `import { DB } from '@icetype/core'
import { ClickHouseAdapter } from '@icetype/clickhouse'

/**
 * IceType Schema - ClickHouse Analytics Template
 *
 * This schema demonstrates analytics-focused data modeling with:
 * - Event tracking for user behavior
 * - Page views and sessions
 * - E-commerce analytics (transactions, products)
 * - Aggregation-friendly table structures
 *
 * ClickHouse is optimized for:
 * - High-volume INSERT operations
 * - Real-time analytics queries
 * - Time-series data
 * - Columnar storage for fast aggregations
 *
 * IceType field modifiers:
 *   !  - Required field
 *   ?  - Optional field
 *   #index - Create index (ClickHouse: ORDER BY key)
 *   #partition - Partition key for data organization
 */

export const db = DB({
  // User behavior tracking
  Event: {
    eventId: 'string! #unique',
    eventType: 'string! #index', // 'click', 'view', 'purchase', 'signup', etc.
    eventName: 'string!',
    userId: 'string? #index',
    sessionId: 'string! #index',
    timestamp: 'datetime! #index',

    // Event properties (flexible JSON)
    properties: 'json?',

    // Context
    page: 'string?',
    referrer: 'string?',
    userAgent: 'string?',
    ip: 'string?',
    country: 'string?',
    city: 'string?',
    device: 'string?', // 'desktop', 'mobile', 'tablet'
    browser: 'string?',
    os: 'string?',

    // UTM tracking
    utmSource: 'string?',
    utmMedium: 'string?',
    utmCampaign: 'string?',

    $partitionBy: 'timestamp.toYYYYMM()',
    $orderBy: ['timestamp', 'eventType', 'userId'],
  },

  // Page view analytics
  PageView: {
    viewId: 'string! #unique',
    sessionId: 'string! #index',
    userId: 'string? #index',
    timestamp: 'datetime! #index',

    // Page details
    path: 'string! #index',
    title: 'string?',
    referrer: 'string?',

    // Performance metrics
    loadTime: 'integer?', // milliseconds
    domContentLoaded: 'integer?',
    firstContentfulPaint: 'integer?',
    largestContentfulPaint: 'integer?',

    // Engagement
    scrollDepth: 'integer?', // percentage
    timeOnPage: 'integer?', // seconds

    $partitionBy: 'timestamp.toYYYYMM()',
    $orderBy: ['timestamp', 'path'],
  },

  // Session aggregates
  Session: {
    sessionId: 'string! #unique',
    userId: 'string? #index',
    startTime: 'datetime! #index',
    endTime: 'datetime?',

    // Session metrics
    pageViews: 'integer!',
    events: 'integer!',
    duration: 'integer?', // seconds

    // Entry/exit
    landingPage: 'string!',
    exitPage: 'string?',

    // Attribution
    source: 'string?',
    medium: 'string?',
    campaign: 'string?',

    // Device/geo
    country: 'string?',
    device: 'string?',
    browser: 'string?',

    // Conversion
    converted: 'boolean!',
    conversionValue: 'decimal?',

    $partitionBy: 'startTime.toYYYYMM()',
    $orderBy: ['startTime', 'userId'],
  },

  // E-commerce transaction analytics
  Transaction: {
    transactionId: 'string! #unique',
    orderId: 'string! #index',
    userId: 'string? #index',
    sessionId: 'string?',
    timestamp: 'datetime! #index',

    // Transaction details
    revenue: 'decimal!',
    tax: 'decimal!',
    shipping: 'decimal!',
    currency: 'string!',
    itemCount: 'integer!',

    // Attribution
    source: 'string?',
    medium: 'string?',
    campaign: 'string?',

    // Flags
    isFirstPurchase: 'boolean!',
    isRefund: 'boolean!',

    $partitionBy: 'timestamp.toYYYYMM()',
    $orderBy: ['timestamp', 'userId'],
  },

  // Product performance analytics
  ProductAnalytics: {
    date: 'datetime! #index',
    productId: 'string! #index',
    productName: 'string!',
    category: 'string?',

    // View metrics
    views: 'integer!',
    uniqueViewers: 'integer!',

    // Cart metrics
    addToCart: 'integer!',
    removeFromCart: 'integer!',

    // Purchase metrics
    purchases: 'integer!',
    quantity: 'integer!',
    revenue: 'decimal!',

    // Calculated rates (denormalized for query performance)
    cartRate: 'decimal?', // addToCart / views
    purchaseRate: 'decimal?', // purchases / views

    $partitionBy: 'date.toYYYYMM()',
    $orderBy: ['date', 'productId'],
  },
})

// Configure ClickHouse adapter
export const adapter = new ClickHouseAdapter({
  host: process.env.CLICKHOUSE_HOST || 'localhost',
  port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
  database: process.env.CLICKHOUSE_DATABASE || 'analytics',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
})

// Example analytics queries
export const queries = {
  // Daily active users
  dailyActiveUsers: \`
    SELECT
      toDate(timestamp) as date,
      uniqExact(userId) as dau
    FROM Event
    WHERE timestamp >= today() - 30
    GROUP BY date
    ORDER BY date
  \`,

  // Funnel analysis
  purchaseFunnel: \`
    SELECT
      countIf(eventType = 'view') as views,
      countIf(eventType = 'add_to_cart') as carts,
      countIf(eventType = 'purchase') as purchases,
      purchases / views as conversion_rate
    FROM Event
    WHERE timestamp >= today() - 7
  \`,

  // Top pages by views
  topPages: \`
    SELECT
      path,
      count() as views,
      uniqExact(userId) as unique_visitors,
      avg(timeOnPage) as avg_time
    FROM PageView
    WHERE timestamp >= today() - 7
    GROUP BY path
    ORDER BY views DESC
    LIMIT 20
  \`,
}
`
  }

  if (template === 'with-iceberg') {
    return `import { DB } from '@icetype/core'
import { IcebergAdapter } from '@icetype/iceberg'

/**
 * IceType Schema - Apache Iceberg Data Lake Template
 *
 * This schema demonstrates data lake patterns with:
 * - Time-travel and snapshot isolation
 * - Schema evolution support
 * - Partitioning for efficient queries
 * - CDC (Change Data Capture) friendly design
 *
 * Apache Iceberg provides:
 * - ACID transactions on data lakes
 * - Time travel queries
 * - Schema evolution without rewriting data
 * - Efficient partitioning and pruning
 *
 * IceType field modifiers:
 *   !  - Required field
 *   ?  - Optional field
 *   #index - Create index
 *   $partitionBy - Iceberg partition spec
 */

export const db = DB({
  // Raw event ingestion (bronze layer)
  RawEvent: {
    eventId: 'string! #unique',
    source: 'string! #index', // 'web', 'mobile', 'api', 'iot'
    eventType: 'string! #index',
    timestamp: 'datetime! #index',
    receivedAt: 'datetime!',

    // Raw payload stored as-is for reprocessing
    payload: 'json!',

    // Metadata for lineage
    schemaVersion: 'string!',
    processingVersion: 'string?',

    $partitionBy: 'timestamp.day',
    $sortBy: ['timestamp', 'source'],
  },

  // Processed user events (silver layer)
  UserEvent: {
    eventId: 'string! #unique',
    userId: 'string! #index',
    eventType: 'string! #index',
    timestamp: 'datetime! #index',

    // Enriched fields
    sessionId: 'string?',
    deviceId: 'string?',
    platform: 'string?', // 'ios', 'android', 'web'
    appVersion: 'string?',

    // Geo enrichment
    country: 'string?',
    region: 'string?',
    city: 'string?',

    // Event-specific properties
    properties: 'json?',

    // Data quality
    isValid: 'boolean!',
    validationErrors: 'json?',

    $partitionBy: 'timestamp.month',
    $sortBy: ['userId', 'timestamp'],
  },

  // User profiles (gold layer - slowly changing dimension)
  UserProfile: {
    userId: 'string! #unique',
    validFrom: 'datetime!',
    validTo: 'datetime?', // null = current record
    isCurrent: 'boolean!',

    // Profile data
    email: 'string?',
    name: 'string?',
    segment: 'string?', // 'free', 'pro', 'enterprise'

    // Computed metrics
    totalEvents: 'integer!',
    firstSeenAt: 'datetime!',
    lastSeenAt: 'datetime!',
    daysSinceFirstSeen: 'integer!',
    daysActive: 'integer!',

    // Engagement scores
    engagementScore: 'decimal?',
    churnRisk: 'decimal?',
    lifetimeValue: 'decimal?',

    // Attribution
    acquisitionSource: 'string?',
    acquisitionCampaign: 'string?',

    $partitionBy: 'validFrom.month',
    $sortBy: ['userId', 'validFrom'],
  },

  // Aggregated metrics (gold layer)
  DailyMetrics: {
    date: 'datetime! #unique',

    // User metrics
    dailyActiveUsers: 'integer!',
    weeklyActiveUsers: 'integer!',
    monthlyActiveUsers: 'integer!',
    newUsers: 'integer!',
    returningUsers: 'integer!',

    // Engagement
    totalSessions: 'integer!',
    totalEvents: 'integer!',
    avgSessionDuration: 'decimal!',
    avgEventsPerUser: 'decimal!',

    // Retention
    day1Retention: 'decimal?',
    day7Retention: 'decimal?',
    day30Retention: 'decimal?',

    // Revenue (if applicable)
    revenue: 'decimal?',
    transactions: 'integer?',
    avgOrderValue: 'decimal?',

    $partitionBy: 'date.month',
    $sortBy: ['date'],
  },

  // Feature store for ML
  UserFeatures: {
    userId: 'string! #unique',
    computedAt: 'datetime!',

    // Activity features
    eventsLast7Days: 'integer!',
    eventsLast30Days: 'integer!',
    sessionsLast7Days: 'integer!',
    avgSessionLength: 'decimal!',

    // Behavioral features
    favoriteEventType: 'string?',
    mostActiveHour: 'integer?',
    mostActiveDay: 'integer?',

    // Temporal features
    daysSinceLastActive: 'integer!',
    avgDaysBetweenSessions: 'decimal?',

    // Encoded features (for ML models)
    segmentEncoded: 'integer?',
    platformEncoded: 'integer?',
    countryEncoded: 'integer?',

    // Feature vector
    featureVector: 'json?', // Array of normalized features

    $partitionBy: 'computedAt.month',
    $sortBy: ['userId'],
  },
})

// Configure Iceberg adapter
export const adapter = new IcebergAdapter({
  catalog: process.env.ICEBERG_CATALOG || 'icetype',
  warehouse: process.env.ICEBERG_WAREHOUSE || 's3://my-bucket/warehouse',

  // S3 configuration
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // Optional: Glue catalog integration
  // catalogType: 'glue',
  // glueDatabase: 'my_database',
})

// Example time-travel queries
export const examples = {
  // Query data as of a specific snapshot
  timeTravel: \`
    SELECT * FROM UserProfile
    FOR SYSTEM_TIME AS OF '2024-01-01 00:00:00'
    WHERE userId = 'user-123'
  \`,

  // Query data changes between snapshots
  incrementalRead: \`
    SELECT * FROM UserEvent
    WHERE _commit_timestamp > '2024-01-01'
    AND _commit_timestamp <= '2024-01-02'
  \`,

  // Compact small files (maintenance)
  compaction: \`
    CALL icetype.compact_table('UserEvent',
      where => 'timestamp < current_date - interval 7 days'
    )
  \`,
}
`
  }

  if (template === 'with-drizzle') {
    return `import { DB } from '@icetype/core'

/**
 * IceType Schema - Drizzle ORM Template
 *
 * This schema demonstrates a content management system with:
 * - Users and authentication
 * - Posts with tags and categories
 * - Comments with threading
 * - Media management
 *
 * This template integrates with Drizzle ORM for:
 * - Type-safe SQL queries
 * - Automatic migrations
 * - Database introspection
 *
 * IceType field modifiers:
 *   !  - Required field
 *   ?  - Optional field
 *   #index - Create index
 *   #unique - Unique constraint
 */

export const db = DB({
  // User management
  User: {
    id: 'string! #unique',
    email: 'string! #unique #index',
    username: 'string! #unique #index',
    passwordHash: 'string!',
    displayName: 'string!',
    bio: 'text?',
    avatarUrl: 'string?',
    isAdmin: 'boolean!',
    isVerified: 'boolean!',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',
    lastLoginAt: 'datetime?',

    posts: '[Post] -> author',
    comments: '[Comment] -> author',
    media: '[Media] -> uploader',
  },

  // Content
  Post: {
    id: 'string! #unique',
    slug: 'string! #unique #index',
    title: 'string!',
    excerpt: 'text?',
    content: 'text!',
    contentHtml: 'text?', // Rendered HTML
    status: 'string! #index', // 'draft', 'published', 'archived'
    visibility: 'string!', // 'public', 'private', 'members'
    publishedAt: 'datetime?',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',

    // SEO
    metaTitle: 'string?',
    metaDescription: 'string?',
    canonicalUrl: 'string?',

    // Stats (denormalized for performance)
    viewCount: 'integer!',
    likeCount: 'integer!',
    commentCount: 'integer!',

    // Relations
    author: 'User! <- posts',
    category: 'Category? <- posts',
    comments: '[Comment] -> post',
    tags: '[PostTag] -> post',
    featuredImage: 'Media? <- featuredPosts',
  },

  Category: {
    id: 'string! #unique',
    name: 'string! #index',
    slug: 'string! #unique',
    description: 'text?',
    color: 'string?', // Hex color for UI
    parentId: 'string? #index', // Self-referential for hierarchy
    position: 'integer!',

    posts: '[Post] -> category',
  },

  Tag: {
    id: 'string! #unique',
    name: 'string! #unique #index',
    slug: 'string! #unique',
    description: 'text?',

    posts: '[PostTag] -> tag',
  },

  PostTag: {
    id: 'string! #unique',
    post: 'Post! <- tags',
    tag: 'Tag! <- posts',
  },

  Comment: {
    id: 'string! #unique',
    content: 'text!',
    contentHtml: 'text?',
    status: 'string!', // 'pending', 'approved', 'spam'
    createdAt: 'datetime!',
    updatedAt: 'datetime!',

    // Threading
    parentId: 'string? #index', // For nested comments
    depth: 'integer!', // Nesting level (0 = top-level)

    author: 'User! <- comments',
    post: 'Post! <- comments',
  },

  // Media management
  Media: {
    id: 'string! #unique',
    filename: 'string!',
    originalName: 'string!',
    mimeType: 'string!',
    size: 'integer!', // bytes
    url: 'string!',
    thumbnailUrl: 'string?',

    // Image-specific
    width: 'integer?',
    height: 'integer?',
    altText: 'string?',

    // Organization
    folder: 'string? #index',

    createdAt: 'datetime!',

    uploader: 'User! <- media',
    featuredPosts: '[Post] -> featuredImage',
  },
})

// Type exports
export type Schema = typeof db
export type User = Schema['User']
export type Post = Schema['Post']
export type Category = Schema['Category']
export type Comment = Schema['Comment']
`
  }

  // Basic template - Blog with simple models
  return `import { DB } from '@icetype/core'

/**
 * IceType Schema - Basic Template
 *
 * This schema demonstrates a simple blog application with:
 * - Users with profiles
 * - Posts with categories
 * - Comments and likes
 *
 * IceType field modifiers:
 *   !  - Required field (NOT NULL)
 *   ?  - Optional field (nullable)
 *   #index - Create database index for faster queries
 *   #unique - Unique constraint
 *   -> - Forward relation (one-to-many, this entity has many of the other)
 *   <- - Backward relation (many-to-one, belongs to)
 *   ~> - Fuzzy/semantic match (AI-powered)
 *
 * Learn more: https://icetype.dev/docs/schema
 */

export const db = DB({
  // User entity - represents authenticated users
  User: {
    id: 'string! #unique',
    email: 'string! #unique #index',
    username: 'string! #unique',
    displayName: 'string!',
    bio: 'text?',
    avatarUrl: 'string?',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',

    // Relations
    posts: '[Post] -> author',
    comments: '[Comment] -> author',
  },

  // Post entity - blog posts
  Post: {
    id: 'string! #unique',
    slug: 'string! #unique #index',
    title: 'string!',
    content: 'text!',
    excerpt: 'text?',
    published: 'boolean!',
    publishedAt: 'datetime?',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',
    viewCount: 'integer!',

    // Relations
    author: 'User! <- posts',
    category: 'Category? <- posts',
    comments: '[Comment] -> post',
  },

  // Category entity - for organizing posts
  Category: {
    id: 'string! #unique',
    name: 'string! #unique',
    slug: 'string! #unique',
    description: 'text?',
    color: 'string?', // Hex color for UI

    // Relations
    posts: '[Post] -> category',
  },

  // Comment entity - comments on posts
  Comment: {
    id: 'string! #unique',
    content: 'text!',
    createdAt: 'datetime!',
    updatedAt: 'datetime!',

    // Relations
    author: 'User! <- comments',
    post: 'Post! <- comments',
  },
})

// Type exports for use in your application
export type Schema = typeof db
export type User = Schema['User']
export type Post = Schema['Post']
export type Category = Schema['Category']
export type Comment = Schema['Comment']

// Example usage:
// import { db, type User, type Post } from './schema'
//
// const users = await db.User.findMany({ where: { published: true } })
// const post = await db.Post.findUnique({ where: { slug: 'hello-world' } })
`
}

/**
 * Generate .gitignore content
 */
function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local
.env.development
.env.production

# IDE
.idea/
.vscode/
*.swp
*.swo
*.sublime-*

# OS
.DS_Store
Thumbs.db
desktop.ini

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Test coverage
coverage/
.nyc_output/

# Cache
.cache/
.parcel-cache/
.turbo/

# TypeScript
*.tsbuildinfo

# Database
*.db
*.sqlite
*.sqlite3

# Drizzle
drizzle/

# ClickHouse
.clickhouse/

# Iceberg
.iceberg/
`
}

/**
 * Generate README.md content
 */
function generateReadme(projectName: string, template: CreateOptions['template']): string {
  const packageName = path.basename(projectName)

  let templateInfo = ''
  let quickStart = ''
  let features = ''

  switch (template) {
    case 'with-postgres':
      templateInfo = `
## PostgreSQL Setup

1. Create a PostgreSQL database:
   \`\`\`bash
   createdb ${packageName}
   \`\`\`

2. Copy \`.env.example\` to \`.env\`:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Update \`DATABASE_URL\` with your connection string:
   \`\`\`
   DATABASE_URL=postgresql://user:password@localhost:5432/${packageName}
   \`\`\`

4. Run migrations:
   \`\`\`bash
   npm run db:migrate
   \`\`\`
`
      features = `
- Type-safe PostgreSQL queries
- Automatic schema migrations
- Connection pooling
- Full-text search support
`
      break

    case 'with-drizzle':
      templateInfo = `
## Drizzle ORM Integration

This project uses Drizzle ORM for database operations.

### Database Commands

\`\`\`bash
# Generate migrations from schema changes
npm run db:generate

# Push schema to database (development)
npm run db:push

# Open Drizzle Studio (visual database browser)
npm run db:studio
\`\`\`
`
      features = `
- Drizzle ORM with type-safe queries
- Visual database studio
- Automatic migration generation
- SQLite by default (easily switch to PostgreSQL)
`
      break

    case 'with-clickhouse':
      templateInfo = `
## ClickHouse Analytics Setup

1. Start ClickHouse (Docker):
   \`\`\`bash
   docker run -d --name clickhouse \\
     -p 8123:8123 -p 9000:9000 \\
     clickhouse/clickhouse-server
   \`\`\`

2. Copy \`.env.example\` to \`.env\`:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Create the analytics database:
   \`\`\`bash
   echo "CREATE DATABASE IF NOT EXISTS analytics" | \\
     curl 'http://localhost:8123/' --data-binary @-
   \`\`\`

4. Run migrations:
   \`\`\`bash
   npm run analytics:migrate
   \`\`\`
`
      features = `
- Real-time analytics with ClickHouse
- Optimized for high-volume event tracking
- Pre-built analytics queries
- Time-series data support
`
      quickStart = `
### Quick Analytics Example

\`\`\`typescript
import { db, adapter } from './schema'

// Track an event
await adapter.insert('Event', {
  eventId: crypto.randomUUID(),
  eventType: 'page_view',
  eventName: 'Home Page Viewed',
  userId: 'user-123',
  sessionId: 'session-456',
  timestamp: new Date(),
  page: '/',
})

// Query daily active users
const dau = await adapter.query(\`
  SELECT toDate(timestamp) as date, uniqExact(userId) as users
  FROM Event
  WHERE timestamp >= today() - 7
  GROUP BY date
  ORDER BY date
\`)
\`\`\`
`
      break

    case 'with-iceberg':
      templateInfo = `
## Apache Iceberg Data Lake Setup

1. Configure your S3-compatible storage in \`.env\`:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

2. Update the environment variables:
   \`\`\`
   ICEBERG_WAREHOUSE=s3://your-bucket/warehouse
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   \`\`\`

3. Initialize the catalog:
   \`\`\`bash
   npm run iceberg:sync
   \`\`\`

### Local Development with MinIO

\`\`\`bash
# Start MinIO
docker run -d --name minio \\
  -p 9000:9000 -p 9001:9001 \\
  -e MINIO_ROOT_USER=minioadmin \\
  -e MINIO_ROOT_PASSWORD=minioadmin \\
  minio/minio server /data --console-address ":9001"

# Create bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/warehouse
\`\`\`
`
      features = `
- Apache Iceberg for data lake management
- Time travel queries
- Schema evolution without data rewrite
- ACID transactions on object storage
- Partition pruning for efficient queries
`
      quickStart = `
### Quick Data Lake Example

\`\`\`typescript
import { db, adapter } from './schema'

// Ingest events
await adapter.insert('RawEvent', {
  eventId: crypto.randomUUID(),
  source: 'web',
  eventType: 'user_signup',
  timestamp: new Date(),
  payload: { email: 'user@example.com' },
  schemaVersion: '1.0',
})

// Time travel query
const snapshot = await adapter.query(\`
  SELECT * FROM UserProfile
  FOR SYSTEM_TIME AS OF '2024-01-01'
  WHERE userId = 'user-123'
\`)

// Incremental reads (CDC)
const changes = await adapter.readChanges('UserEvent', {
  since: '2024-01-01',
  until: '2024-01-02',
})
\`\`\`
`
      break

    default:
      features = `
- Type-safe schema definitions
- SQLite for local development
- Automatic TypeScript types
- Relational modeling with IceType
`
  }

  return `# ${packageName}

A type-safe database project built with [IceType](https://icetype.dev).

## Features
${features}
## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development (watch mode)
npm run dev
\`\`\`
${templateInfo}${quickStart}
## Project Structure

\`\`\`
${packageName}/
  schema.ts      # IceType schema definitions
  tsconfig.json  # TypeScript configuration
  package.json   # Project dependencies
\`\`\`

## Schema

Edit \`schema.ts\` to define your data models using IceType's type-safe schema language.

### Field Modifiers

| Modifier | Description |
|----------|-------------|
| \`!\` | Required field (NOT NULL) |
| \`?\` | Optional field (nullable) |
| \`#index\` | Create index for faster queries |
| \`#unique\` | Unique constraint |
| \`->\` | Has many relation |
| \`<-\` | Belongs to relation |

### Example

\`\`\`typescript
import { DB } from '@icetype/core'

export const db = DB({
  User: {
    id: 'string! #unique',
    email: 'string! #unique #index',
    name: 'string!',
    posts: '[Post] -> author',
  },
  Post: {
    id: 'string! #unique',
    title: 'string!',
    author: 'User! <- posts',
  },
})
\`\`\`

## Learn More

- [IceType Documentation](https://icetype.dev/docs)
- [IceType GitHub](https://github.com/dot-do/icetype)
- [Schema Reference](https://icetype.dev/docs/schema)
- [API Reference](https://icetype.dev/docs/api)

## License

MIT
`
}

/**
 * Generate .env.example for database templates
 */
function generateEnvExample(template: CreateOptions['template']): string {
  switch (template) {
    case 'with-postgres':
      return `# PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Optional: Connection pool settings
# DATABASE_POOL_MIN=2
# DATABASE_POOL_MAX=10
`
    case 'with-clickhouse':
      return `# ClickHouse connection
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Optional: ClickHouse settings
# CLICKHOUSE_READONLY=0
# CLICKHOUSE_COMPRESSION=1
`
    case 'with-iceberg':
      return `# Iceberg catalog configuration
ICEBERG_CATALOG=icetype
ICEBERG_WAREHOUSE=s3://my-bucket/warehouse

# AWS/S3 configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Optional: Custom S3 endpoint (for MinIO, etc.)
# S3_ENDPOINT=http://localhost:9000

# Optional: Glue catalog integration
# ICEBERG_CATALOG_TYPE=glue
# GLUE_DATABASE=my_database
`
    default:
      return `# Database connection
DATABASE_URL=file:./data.db
`
  }
}

/**
 * Generate drizzle.config.ts for drizzle template
 */
function generateDrizzleConfig(): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./data.db',
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Generate .editorconfig
 */
function generateEditorConfig(): string {
  return `# EditorConfig helps maintain consistent coding styles
# https://editorconfig.org

root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
`
}

/**
 * Generate .prettierrc
 */
function generatePrettierConfig(): string {
  const config = {
    semi: false,
    singleQuote: true,
    trailingComma: 'es5',
    tabWidth: 2,
    useTabs: false,
    printWidth: 100,
    bracketSpacing: true,
    arrowParens: 'always',
    endOfLine: 'lf',
  }
  return JSON.stringify(config, null, 2)
}

/**
 * Generate .prettierignore
 */
function generatePrettierIgnore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
build/

# Generated
drizzle/
coverage/

# Other
*.min.js
*.min.css
package-lock.json
pnpm-lock.yaml
yarn.lock
`
}

/**
 * Print progress indicator
 */
function printProgress(message: string, symbol: string = '+'): void {
  console.log(`  ${c('green', symbol)} ${message}`)
}

/**
 * Print a colored box with title
 */
function printBox(title: string, content: string[]): void {
  console.log('')
  console.log(c('cyan', c('bold', title)))
  console.log('')
  content.forEach((line) => console.log(`  ${line}`))
  console.log('')
}

/**
 * Create a new IceType project
 */
export async function createProject(options: CreateOptions): Promise<GeneratorResult> {
  const { projectName, template } = options
  const filesCreated: string[] = []
  const warnings: string[] = []

  // Validate project name
  const nameValidation = validateProjectName(projectName)
  if (!nameValidation.valid) {
    return {
      success: false,
      projectPath: '',
      filesCreated: [],
      error: nameValidation.error,
    }
  }

  // Collect warnings
  if (nameValidation.warnings) {
    warnings.push(...nameValidation.warnings)
  }

  // Validate template
  if (!VALID_TEMPLATES.includes(template)) {
    return {
      success: false,
      projectPath: '',
      filesCreated: [],
      error: `Invalid template: ${template}. Valid templates are: ${VALID_TEMPLATES.join(', ')}`,
    }
  }

  // Resolve project path
  const projectPath = path.resolve(process.cwd(), projectName)

  // Check if directory exists and is not empty
  if (fs.existsSync(projectPath)) {
    const contents = fs.readdirSync(projectPath)
    if (contents.length > 0) {
      return {
        success: false,
        projectPath,
        filesCreated: [],
        error: `Directory ${projectName} already exists and is not empty`,
      }
    }
  }

  try {
    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true })

    // Generate and write files
    const files: Array<{ name: string; content: string }> = [
      { name: 'package.json', content: generatePackageJson(projectName, template) },
      { name: 'tsconfig.json', content: generateTsConfig() },
      { name: 'schema.ts', content: generateSchema(template) },
      { name: '.gitignore', content: generateGitignore() },
      { name: 'README.md', content: generateReadme(projectName, template) },
      { name: '.editorconfig', content: generateEditorConfig() },
      { name: '.prettierrc', content: generatePrettierConfig() },
      { name: '.prettierignore', content: generatePrettierIgnore() },
    ]

    // Add template-specific files
    if (template === 'with-postgres' || template === 'with-clickhouse' || template === 'with-iceberg') {
      files.push({ name: '.env.example', content: generateEnvExample(template) })
    }

    if (template === 'with-drizzle') {
      files.push({ name: 'drizzle.config.ts', content: generateDrizzleConfig() })
    }

    // Write all files
    for (const file of files) {
      const filePath = path.join(projectPath, file.name)
      fs.writeFileSync(filePath, file.content)
      filesCreated.push(file.name)
    }

    return {
      success: true,
      projectPath,
      filesCreated,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (err) {
    const error = err as Error
    let errorMessage = error.message

    // Translate common errors to user-friendly messages
    if (error.message.includes('EACCES') || error.message.includes('permission')) {
      errorMessage = 'permission denied: Unable to create files'
    } else if (error.message.includes('ENOSPC') || error.message.includes('space')) {
      errorMessage = 'No space left on device'
    }

    return {
      success: false,
      projectPath,
      filesCreated,
      error: errorMessage,
    }
  }
}

/**
 * Interactive prompts for missing options
 */
export async function promptForOptions(partialOptions: Partial<CreateOptions>): Promise<CreateOptions> {
  let projectName = partialOptions.projectName
  let template = partialOptions.template

  // In non-interactive mode, use defaults
  if (partialOptions.interactive === false) {
    return {
      projectName: projectName || 'my-icetype-app',
      template: template || 'basic',
    }
  }

  // Default project name if not provided
  if (!projectName) {
    projectName = 'my-icetype-app'
  }

  // Default template if not provided
  if (!template) {
    template = 'basic'
  }

  return {
    projectName,
    template,
  }
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
${c('cyan', c('bold', 'create-icetype'))} - Scaffold new IceType projects

${c('bold', 'Usage:')}
  npx create-icetype <project-name> [options]

${c('bold', 'Options:')}
  --template, -t <template>  Project template to use (default: basic)
  --help                     Show this help message
  --version                  Show version number

${c('bold', 'Templates:')}
  ${c('green', 'basic')}           Minimal IceType setup with SQLite
  ${c('green', 'with-postgres')}   IceType with PostgreSQL adapter
  ${c('green', 'with-drizzle')}    IceType with Drizzle ORM integration
  ${c('green', 'with-clickhouse')} IceType with ClickHouse analytics
  ${c('green', 'with-iceberg')}    IceType with Apache Iceberg data lake

${c('bold', 'Examples:')}
  ${c('dim', '$')} npx create-icetype my-app
  ${c('dim', '$')} npx create-icetype my-app --template with-postgres
  ${c('dim', '$')} npx create-icetype my-app -t with-drizzle
  ${c('dim', '$')} npx create-icetype analytics-pipeline -t with-clickhouse
  ${c('dim', '$')} npx create-icetype data-lake -t with-iceberg

${c('bold', 'Learn more:')}
  Documentation: ${c('cyan', 'https://icetype.dev/docs')}
  GitHub:        ${c('cyan', 'https://github.com/dot-do/icetype')}
`)
}

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]): { projectName?: string; template?: CreateOptions['template']; help?: boolean; version?: boolean } {
  const result: { projectName?: string; template?: CreateOptions['template']; help?: boolean; version?: boolean } = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--version' || arg === '-v') {
      result.version = true
    } else if (arg === '--template' || arg === '-t') {
      const templateArg = args[++i]
      if (templateArg && VALID_TEMPLATES.includes(templateArg as typeof VALID_TEMPLATES[number])) {
        result.template = templateArg as CreateOptions['template']
      }
    } else if (arg && !arg.startsWith('-')) {
      result.projectName = arg
    }
  }

  return result
}

/**
 * Main CLI entry point
 */
export async function main(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  // Handle --help
  if (parsed.help) {
    showHelp()
    return
  }

  // Handle --version
  if (parsed.version) {
    console.log(VERSION)
    return
  }

  // Get options (use prompts for missing values)
  const options = await promptForOptions({
    projectName: parsed.projectName,
    template: parsed.template,
    interactive: false, // CLI defaults to non-interactive for testing
  })

  // Print header
  console.log('')
  console.log(c('cyan', c('bold', 'Creating IceType project...')))
  console.log('')

  // Create the project
  const result = await createProject(options)

  if (result.success) {
    // Print warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.log(c('yellow', 'Warnings:'))
      result.warnings.forEach((warning) => {
        console.log(`  ${c('yellow', '!')} ${warning}`)
      })
      console.log('')
    }

    // Print created files
    console.log(c('green', 'Created files:'))
    result.filesCreated.forEach((file) => {
      printProgress(file)
    })

    // Print success message
    console.log('')
    console.log(c('green', c('bold', `Successfully created ${options.projectName}`)))

    // Print next steps
    printBox('Next steps:', [
      `${c('cyan', 'cd')} ${options.projectName}`,
      `${c('cyan', 'npm install')}`,
      `${c('cyan', 'npm run dev')}`,
    ])

    // Template-specific hints
    if (options.template === 'with-postgres') {
      console.log(c('dim', 'Tip: Copy .env.example to .env and configure your database URL'))
    } else if (options.template === 'with-clickhouse') {
      console.log(c('dim', 'Tip: Start ClickHouse with: docker run -d -p 8123:8123 clickhouse/clickhouse-server'))
    } else if (options.template === 'with-iceberg') {
      console.log(c('dim', 'Tip: Configure your S3 warehouse in .env.example'))
    } else if (options.template === 'with-drizzle') {
      console.log(c('dim', 'Tip: Use "npm run db:studio" to open the visual database browser'))
    }
    console.log('')
  } else {
    console.error(`\n${c('red', 'Error:')} ${result.error}`)
    process.exitCode = 1
  }
}

// Run CLI when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2))
}
