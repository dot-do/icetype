# MySQL DDL Example

This example demonstrates how to generate MySQL DDL (CREATE TABLE statements) from IceType schemas.

## What is MySQL?

MySQL is one of the most popular open-source relational database systems. It's designed for:

- **High performance** - Optimized for read-heavy workloads
- **ACID compliance** - Full transaction support with InnoDB engine
- **Scalability** - Replication and clustering for horizontal scaling
- **JSON support** - Native JSON data type in MySQL 5.7+

## Files

- `schema.ts` - Business schemas (User, Product, Order, OrderItem)
- `generate.ts` - Generates MySQL CREATE TABLE statements

## Type Mapping

| IceType | MySQL |
|---------|-------|
| `string` | `VARCHAR(255)` |
| `text` | `TEXT` |
| `int` | `INT` |
| `long` | `BIGINT` |
| `float` | `FLOAT` |
| `double` | `DOUBLE` |
| `boolean` | `TINYINT(1)` |
| `timestamp` | `DATETIME` |
| `date` | `DATE` |
| `time` | `TIME` |
| `uuid` | `CHAR(36)` |
| `decimal(p,s)` | `DECIMAL(p,s)` |
| `json` | `JSON` |
| `binary` | `BLOB` |
| `string?` | `VARCHAR(255)` (nullable) |

## Running the Example

```bash
# Install dependencies (from monorepo root)
pnpm install

# Generate MySQL DDL
cd examples/mysql
pnpm tsx generate.ts
```

Or use the npm script:

```bash
cd examples/mysql
pnpm run generate
```

## Expected Output

```sql
============================================================
-- User Table
============================================================

CREATE TABLE IF NOT EXISTS User (
  `$id` VARCHAR(255) NOT NULL,
  `$type` VARCHAR(255) NOT NULL,
  `$version` INT NOT NULL DEFAULT 1,
  `$createdAt` BIGINT NOT NULL,
  `$updatedAt` BIGINT NOT NULL,
  id CHAR(36) NOT NULL,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  age INT,
  bio TEXT,
  avatarUrl VARCHAR(255),
  isActive TINYINT(1) DEFAULT TRUE,
  role VARCHAR(255) DEFAULT 'user',
  createdAt DATETIME,
  updatedAt DATETIME,
  PRIMARY KEY (`$id`),
  UNIQUE (email)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_User_email ON User (email);
CREATE INDEX idx_User_createdAt ON User (createdAt);
```

## System Fields

The MySQL adapter adds system fields to each table:

| Field | Type | Description |
|-------|------|-------------|
| `$id` | VARCHAR(255) | Unique document identifier (primary key) |
| `$type` | VARCHAR(255) | Document type name |
| `$version` | INT | Version for optimistic concurrency |
| `$createdAt` | BIGINT | Creation timestamp (epoch ms) |
| `$updatedAt` | BIGINT | Last update timestamp (epoch ms) |

You can disable system fields with `includeSystemFields: false`.

## MySQL Features

### InnoDB Engine

InnoDB is the default and recommended storage engine:

```sql
-- Create table with InnoDB
CREATE TABLE Users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255)
) ENGINE=InnoDB;
```

Benefits:
- ACID transactions
- Row-level locking
- Foreign key support
- Crash recovery

### utf8mb4 Character Set

Always use `utf8mb4` for full Unicode support (including emojis):

```sql
CREATE TABLE Posts (
  content TEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### JSON Data Type

MySQL 5.7+ supports native JSON:

```sql
-- Store JSON data
INSERT INTO Product (attributes) VALUES ('{"color": "red", "size": "large"}');

-- Query JSON fields
SELECT * FROM Product
WHERE JSON_EXTRACT(attributes, '$.color') = 'red';

-- Or use shorthand syntax
SELECT * FROM Product
WHERE attributes->>'$.color' = 'red';
```

### Full-Text Search

```sql
-- Create a full-text index
ALTER TABLE Product ADD FULLTEXT INDEX ft_search (name, description);

-- Search with natural language mode
SELECT * FROM Product
WHERE MATCH(name, description) AGAINST('laptop computer' IN NATURAL LANGUAGE MODE);

-- Boolean mode for more control
SELECT * FROM Product
WHERE MATCH(name, description) AGAINST('+laptop -tablet' IN BOOLEAN MODE);
```

### Foreign Keys

```sql
-- Add foreign key constraint
ALTER TABLE `Order` ADD CONSTRAINT fk_order_user
  FOREIGN KEY (userId) REFERENCES User(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
```

## Best Practices

1. **Use InnoDB** - Default engine with transactions and foreign keys
2. **Use utf8mb4** - Full Unicode support including emojis
3. **Use DECIMAL for money** - Never use FLOAT/DOUBLE for currency
4. **Index strategically** - Index columns used in WHERE, JOIN, ORDER BY
5. **Use prepared statements** - Prevent SQL injection

## Next Steps

- See [postgres](../postgres/) for PostgreSQL DDL generation
- See [duckdb](../duckdb/) for DuckDB DDL generation
- See [clickhouse](../clickhouse/) for ClickHouse DDL generation
- See [basic](../basic/) for basic schema definitions
