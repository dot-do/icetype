/**
 * MySQL DDL Generation Example
 *
 * Demonstrates how to generate MySQL CREATE TABLE statements
 * from IceType schemas using the MySQL adapter.
 *
 * Run with: pnpm tsx generate.ts
 */

import { parseSchema } from '@icetype/core';
import { MySQLAdapter, transformToMySQLDDL } from '@icetype/mysql';
import { UserSchema, schemas } from './schema.js';

/**
 * Main function - generate MySQL DDL for all schemas
 */
function main() {
  console.log('='.repeat(60));
  console.log('IceType to MySQL DDL Generation');
  console.log('='.repeat(60));

  const adapter = new MySQLAdapter();

  for (const [name, definition] of Object.entries(schemas)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`-- ${name} Table`);
    console.log('='.repeat(60) + '\n');

    // Parse the IceType schema
    const schema = parseSchema(definition);

    // Transform to MySQL DDL with InnoDB engine and utf8mb4 charset
    const ddl = adapter.transform(schema, {
      ifNotExists: true,
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      includeSystemFields: true,  // Include $id, $type, $version, etc.
    });

    // Serialize to SQL (with indexes)
    const sql = adapter.serializeWithIndexes(ddl);

    console.log(sql);
    console.log('');

    // Print schema summary
    console.log(`-- Summary:`);
    console.log(`--   Columns: ${ddl.columns.length}`);
    console.log(`--   Primary Key: ${ddl.primaryKey?.join(', ') || 'none'}`);
    console.log(`--   Engine: ${ddl.engine}`);
    console.log(`--   Charset: ${ddl.charset}`);
    if (ddl.uniqueConstraints && ddl.uniqueConstraints.length > 0) {
      console.log(`--   Unique Constraints: ${ddl.uniqueConstraints.map(c => c.join(', ')).join('; ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DDL generation complete!');
  console.log('='.repeat(60));

  // Print convenience function example
  console.log('\n--- Alternative: Using convenience function ---\n');

  const quickDDL = transformToMySQLDDL(parseSchema(UserSchema), {
    ifNotExists: true,
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    includeSystemFields: false,  // Skip system fields for simpler output
  });

  console.log('// Without system fields:\n');
  console.log(quickDDL);

  // Print usage examples
  console.log(`
MySQL Usage Examples:

-- Create the database
CREATE DATABASE IF NOT EXISTS myapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE myapp;

-- Insert a user
INSERT INTO User (
    \`$id\`, \`$type\`, \`$version\`, \`$createdAt\`, \`$updatedAt\`,
    id, email, name, createdAt, updatedAt
) VALUES (
    CONCAT('user_', UUID()), 'User', 1,
    UNIX_TIMESTAMP() * 1000,
    UNIX_TIMESTAMP() * 1000,
    UUID(), 'user@example.com', 'John Doe',
    NOW(), NOW()
);

-- Query users
SELECT * FROM User
WHERE isActive = TRUE
  AND role = 'admin';

-- Join orders with users
SELECT
    o.orderNumber,
    u.name AS customer_name,
    o.totalAmount
FROM \`Order\` o
JOIN User u ON o.userId = u.id
WHERE o.status = 'shipped';

-- Aggregate order stats by user
SELECT
    u.name,
    COUNT(o.id) AS order_count,
    SUM(o.totalAmount) AS total_spent
FROM User u
LEFT JOIN \`Order\` o ON o.userId = u.id
GROUP BY u.id, u.name
ORDER BY total_spent DESC;

-- Query products with JSON attributes (MySQL 5.7+)
SELECT * FROM Product
WHERE JSON_EXTRACT(attributes, '$.color') = 'red';

-- Full-text search setup and query
ALTER TABLE Product ADD FULLTEXT INDEX ft_product_name_desc (name, description);

SELECT * FROM Product
WHERE MATCH(name, description) AGAINST('laptop computer' IN NATURAL LANGUAGE MODE);

-- Add foreign key constraints (after table creation)
ALTER TABLE \`Order\` ADD CONSTRAINT fk_order_user
  FOREIGN KEY (userId) REFERENCES User(id);

ALTER TABLE OrderItem ADD CONSTRAINT fk_orderitem_order
  FOREIGN KEY (orderId) REFERENCES \`Order\`(id);

ALTER TABLE OrderItem ADD CONSTRAINT fk_orderitem_product
  FOREIGN KEY (productId) REFERENCES Product(id);
`);
}

main();
