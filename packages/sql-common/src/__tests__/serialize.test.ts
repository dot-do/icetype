/**
 * Tests for shared serializeDDL function
 *
 * Tests DDL serialization across all supported SQL dialects:
 * - PostgreSQL
 * - MySQL
 * - SQLite
 * - DuckDB
 * - ClickHouse
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  serializeDDL,
  type DDLStructure,
  type SqlDialect,
} from '../serialize.js';

// =============================================================================
// DDLStructure Type Tests (Compile-time verification)
// =============================================================================

describe('DDLStructure interface', () => {
  it('should accept minimal DDL structure', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
    };
    expect(ddl.tableName).toBe('users');
    expect(ddl.columns).toHaveLength(1);
  });

  it('should accept full DDL structure with all options', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      schemaName: 'public',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'email', type: 'TEXT', nullable: false, unique: true },
      ],
      primaryKey: ['id'],
      uniqueConstraints: [['email']],
      checkConstraints: [{ name: 'check_email', expression: "email LIKE '%@%'" }],
      foreignKeys: [{
        columns: ['user_id'],
        references: { table: 'profiles', columns: ['id'] },
        onDelete: 'CASCADE',
        onUpdate: 'SET NULL',
      }],
      ifNotExists: true,
      // SQLite-specific
      strict: true,
      withoutRowid: true,
      // MySQL-specific
      engine: 'InnoDB',
      charset: 'utf8mb4',
    };
    expect(ddl.tableName).toBe('users');
    expect(ddl.strict).toBe(true);
    expect(ddl.engine).toBe('InnoDB');
  });
});

// =============================================================================
// serializeDDL() Basic Tests - CREATE TABLE with columns
// =============================================================================

describe('serializeDDL() - CREATE TABLE with columns', () => {
  const dialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite', 'duckdb', 'clickhouse'];

  dialects.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should generate basic CREATE TABLE statement', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'TEXT', nullable: true },
          ],
        };

        const sql = serializeDDL(ddl, dialect);

        expect(sql).toContain('CREATE TABLE');
        expect(sql).toContain('users');
        expect(sql).toContain('id');
        expect(sql).toContain('INTEGER');
        expect(sql).toContain('name');
        expect(sql).toContain('TEXT');
      });

      it('should include NOT NULL for non-nullable columns', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
          ],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('NOT NULL');
      });

      it('should include UNIQUE for unique columns', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'email', type: 'TEXT', nullable: false, unique: true },
          ],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('UNIQUE');
      });

      it('should include DEFAULT for columns with defaults', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'version', type: 'INTEGER', nullable: false, default: '1' },
          ],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('DEFAULT 1');
      });
    });
  });
});

// =============================================================================
// serializeDDL() - PRIMARY KEY constraint
// =============================================================================

describe('serializeDDL() - PRIMARY KEY constraint', () => {
  const dialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite', 'duckdb', 'clickhouse'];

  dialects.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should generate PRIMARY KEY constraint for single column', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'TEXT', nullable: true },
          ],
          primaryKey: ['id'],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('PRIMARY KEY');
        // Should contain the column name in the primary key
        expect(sql).toMatch(/PRIMARY KEY\s*\([^)]*id[^)]*\)/i);
      });

      it('should generate composite PRIMARY KEY constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'order_items',
          columns: [
            { name: 'order_id', type: 'INTEGER', nullable: false },
            { name: 'product_id', type: 'INTEGER', nullable: false },
            { name: 'quantity', type: 'INTEGER', nullable: false },
          ],
          primaryKey: ['order_id', 'product_id'],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('PRIMARY KEY');
        expect(sql).toMatch(/PRIMARY KEY\s*\([^)]*order_id[^)]*,\s*[^)]*product_id[^)]*\)/i);
      });
    });
  });
});

// =============================================================================
// serializeDDL() - UNIQUE constraints
// =============================================================================

describe('serializeDDL() - UNIQUE constraints', () => {
  const dialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite', 'duckdb', 'clickhouse'];

  dialects.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should generate table-level UNIQUE constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'email', type: 'TEXT', nullable: false },
          ],
          uniqueConstraints: [['email']],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toMatch(/UNIQUE\s*\([^)]*email[^)]*\)/i);
      });

      it('should generate composite UNIQUE constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'tenant_id', type: 'INTEGER', nullable: false },
            { name: 'email', type: 'TEXT', nullable: false },
          ],
          uniqueConstraints: [['tenant_id', 'email']],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toMatch(/UNIQUE\s*\([^)]*tenant_id[^)]*,\s*[^)]*email[^)]*\)/i);
      });

      it('should generate multiple UNIQUE constraints', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'email', type: 'TEXT', nullable: false },
            { name: 'username', type: 'TEXT', nullable: false },
          ],
          uniqueConstraints: [['email'], ['username']],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toMatch(/UNIQUE\s*\([^)]*email[^)]*\)/i);
        expect(sql).toMatch(/UNIQUE\s*\([^)]*username[^)]*\)/i);
      });
    });
  });
});

// =============================================================================
// serializeDDL() - CHECK constraints
// =============================================================================

describe('serializeDDL() - CHECK constraints', () => {
  const dialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite', 'duckdb'];

  dialects.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should generate anonymous CHECK constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'price', type: 'DECIMAL', nullable: false },
          ],
          checkConstraints: [{ expression: 'price > 0' }],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('CHECK');
        expect(sql).toContain('price > 0');
      });

      it('should generate named CHECK constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'price', type: 'DECIMAL', nullable: false },
          ],
          checkConstraints: [{ name: 'check_positive_price', expression: 'price > 0' }],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('CONSTRAINT');
        expect(sql).toContain('check_positive_price');
        expect(sql).toContain('CHECK');
        expect(sql).toContain('price > 0');
      });

      it('should generate multiple CHECK constraints', () => {
        const ddl: DDLStructure = {
          tableName: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'price', type: 'DECIMAL', nullable: false },
            { name: 'quantity', type: 'INTEGER', nullable: false },
          ],
          checkConstraints: [
            { expression: 'price > 0' },
            { expression: 'quantity >= 0' },
          ],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('price > 0');
        expect(sql).toContain('quantity >= 0');
      });
    });
  });
});

// =============================================================================
// serializeDDL() - FOREIGN KEY constraints
// =============================================================================

describe('serializeDDL() - FOREIGN KEY constraints', () => {
  const dialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite', 'duckdb'];

  dialects.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should generate basic FOREIGN KEY constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            columns: ['user_id'],
            references: { table: 'users', columns: ['id'] },
          }],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('FOREIGN KEY');
        expect(sql).toContain('user_id');
        expect(sql).toContain('REFERENCES');
        expect(sql).toContain('users');
      });

      it('should generate FOREIGN KEY with ON DELETE clause', () => {
        const ddl: DDLStructure = {
          tableName: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            columns: ['user_id'],
            references: { table: 'users', columns: ['id'] },
            onDelete: 'CASCADE',
          }],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('ON DELETE CASCADE');
      });

      it('should generate FOREIGN KEY with ON UPDATE clause', () => {
        const ddl: DDLStructure = {
          tableName: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            columns: ['user_id'],
            references: { table: 'users', columns: ['id'] },
            onUpdate: 'SET NULL',
          }],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('ON UPDATE SET NULL');
      });

      it('should generate composite FOREIGN KEY constraint', () => {
        const ddl: DDLStructure = {
          tableName: 'order_details',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'order_id', type: 'INTEGER', nullable: false },
            { name: 'product_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            columns: ['order_id', 'product_id'],
            references: { table: 'order_items', columns: ['order_id', 'product_id'] },
          }],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('FOREIGN KEY');
        expect(sql).toMatch(/order_id[^)]*,\s*[^)]*product_id/i);
        expect(sql).toContain('REFERENCES');
        expect(sql).toContain('order_items');
      });
    });
  });
});

// =============================================================================
// serializeDDL() - IF NOT EXISTS option
// =============================================================================

describe('serializeDDL() - IF NOT EXISTS option', () => {
  const dialects: SqlDialect[] = ['postgres', 'mysql', 'sqlite', 'duckdb', 'clickhouse'];

  dialects.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should include IF NOT EXISTS when option is true', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
          ],
          ifNotExists: true,
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('IF NOT EXISTS');
      });

      it('should NOT include IF NOT EXISTS when option is false', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
          ],
          ifNotExists: false,
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).not.toContain('IF NOT EXISTS');
      });

      it('should NOT include IF NOT EXISTS when option is undefined', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
          ],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).not.toContain('IF NOT EXISTS');
      });
    });
  });
});

// =============================================================================
// serializeDDL() - Dialect-specific options: SQLite STRICT
// =============================================================================

describe('serializeDDL() - SQLite STRICT option', () => {
  it('should include STRICT for SQLite when option is true', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      strict: true,
    };

    const sql = serializeDDL(ddl, 'sqlite');
    expect(sql).toContain('STRICT');
  });

  it('should NOT include STRICT for SQLite when option is false', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      strict: false,
    };

    const sql = serializeDDL(ddl, 'sqlite');
    expect(sql).not.toContain('STRICT');
  });

  it('should include WITHOUT ROWID for SQLite when option is true', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      primaryKey: ['id'],
      withoutRowid: true,
    };

    const sql = serializeDDL(ddl, 'sqlite');
    expect(sql).toContain('WITHOUT ROWID');
  });

  it('should combine STRICT and WITHOUT ROWID for SQLite', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      primaryKey: ['id'],
      strict: true,
      withoutRowid: true,
    };

    const sql = serializeDDL(ddl, 'sqlite');
    expect(sql).toContain('STRICT');
    expect(sql).toContain('WITHOUT ROWID');
  });

  it('should NOT include STRICT for non-SQLite dialects', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      strict: true,
    };

    expect(serializeDDL(ddl, 'postgres')).not.toContain('STRICT');
    expect(serializeDDL(ddl, 'mysql')).not.toContain('STRICT');
    expect(serializeDDL(ddl, 'duckdb')).not.toContain('STRICT');
  });
});

// =============================================================================
// serializeDDL() - Dialect-specific options: MySQL ENGINE
// =============================================================================

describe('serializeDDL() - MySQL ENGINE option', () => {
  it('should include ENGINE for MySQL when option is set', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      engine: 'InnoDB',
    };

    const sql = serializeDDL(ddl, 'mysql');
    expect(sql).toContain('ENGINE=InnoDB');
  });

  it('should include CHARACTER SET for MySQL when charset is set', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      charset: 'utf8mb4',
    };

    const sql = serializeDDL(ddl, 'mysql');
    expect(sql).toContain('CHARACTER SET utf8mb4');
  });

  it('should include ENGINE and CHARACTER SET together for MySQL', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      engine: 'InnoDB',
      charset: 'utf8mb4',
    };

    const sql = serializeDDL(ddl, 'mysql');
    expect(sql).toContain('ENGINE=InnoDB');
    expect(sql).toContain('CHARACTER SET utf8mb4');
  });

  it('should NOT include ENGINE for non-MySQL dialects', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
      ],
      engine: 'InnoDB',
    };

    expect(serializeDDL(ddl, 'postgres')).not.toContain('ENGINE');
    expect(serializeDDL(ddl, 'sqlite')).not.toContain('ENGINE');
    expect(serializeDDL(ddl, 'duckdb')).not.toContain('ENGINE');
  });
});

// =============================================================================
// serializeDDL() - Proper identifier escaping per dialect
// =============================================================================

describe('serializeDDL() - Identifier escaping per dialect', () => {
  describe('PostgreSQL and DuckDB (double quotes)', () => {
    const dialects: SqlDialect[] = ['postgres', 'duckdb'];

    dialects.forEach((dialect) => {
      describe(`dialect: ${dialect}`, () => {
        it('should escape identifiers with $ using double quotes', () => {
          const ddl: DDLStructure = {
            tableName: 'users',
            columns: [
              { name: '$id', type: 'TEXT', nullable: false },
            ],
          };

          const sql = serializeDDL(ddl, dialect);
          expect(sql).toContain('"$id"');
        });

        it('should escape reserved keywords using double quotes', () => {
          const ddl: DDLStructure = {
            tableName: 'order',
            columns: [
              { name: 'select', type: 'TEXT', nullable: false },
            ],
          };

          const sql = serializeDDL(ddl, dialect);
          // Table name 'order' should be escaped
          if (dialect === 'postgres') {
            expect(sql).toContain('"order"');
            expect(sql).toContain('"select"');
          }
        });
      });
    });
  });

  describe('MySQL and ClickHouse (backticks)', () => {
    const dialects: SqlDialect[] = ['mysql', 'clickhouse'];

    dialects.forEach((dialect) => {
      describe(`dialect: ${dialect}`, () => {
        it('should escape identifiers with $ using backticks', () => {
          const ddl: DDLStructure = {
            tableName: 'users',
            columns: [
              { name: '$id', type: 'TEXT', nullable: false },
            ],
          };

          const sql = serializeDDL(ddl, dialect);
          expect(sql).toContain('`$id`');
        });
      });
    });
  });

  describe('SQLite (double quotes)', () => {
    it('should escape identifiers with $ using double quotes', () => {
      const ddl: DDLStructure = {
        tableName: 'users',
        columns: [
          { name: '$id', type: 'TEXT', nullable: false },
        ],
      };

      const sql = serializeDDL(ddl, 'sqlite');
      expect(sql).toContain('"$id"');
    });
  });
});

// =============================================================================
// serializeDDL() - Schema name support
// =============================================================================

describe('serializeDDL() - Schema name support', () => {
  const dialectsWithSchema: SqlDialect[] = ['postgres', 'duckdb'];

  dialectsWithSchema.forEach((dialect) => {
    describe(`dialect: ${dialect}`, () => {
      it('should include schema name in table reference', () => {
        const ddl: DDLStructure = {
          tableName: 'users',
          schemaName: 'public',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
          ],
        };

        const sql = serializeDDL(ddl, dialect);
        expect(sql).toContain('public');
        expect(sql).toContain('users');
      });
    });
  });
});

// =============================================================================
// serializeDDL() - Integration tests with realistic schemas
// =============================================================================

describe('serializeDDL() - Integration tests', () => {
  it('should generate a complete users table for PostgreSQL', () => {
    const ddl: DDLStructure = {
      tableName: 'users',
      schemaName: 'public',
      columns: [
        { name: 'id', type: 'SERIAL', nullable: false },
        { name: 'email', type: 'TEXT', nullable: false, unique: true },
        { name: 'name', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'NOW()' },
      ],
      primaryKey: ['id'],
      ifNotExists: true,
    };

    const sql = serializeDDL(ddl, 'postgres');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('public');
    expect(sql).toContain('users');
    expect(sql).toContain('id SERIAL NOT NULL');
    expect(sql).toContain('email TEXT NOT NULL UNIQUE');
    expect(sql).toContain('created_at TIMESTAMP NOT NULL DEFAULT NOW()');
    expect(sql).toContain('PRIMARY KEY (id)');
  });

  it('should generate a complete orders table for MySQL', () => {
    const ddl: DDLStructure = {
      tableName: 'orders',
      columns: [
        { name: 'id', type: 'INT', nullable: false },
        { name: 'user_id', type: 'INT', nullable: false },
        { name: 'total', type: 'DECIMAL(10,2)', nullable: false },
        { name: 'status', type: 'VARCHAR(50)', nullable: false, default: "'pending'" },
      ],
      primaryKey: ['id'],
      foreignKeys: [{
        columns: ['user_id'],
        references: { table: 'users', columns: ['id'] },
        onDelete: 'CASCADE',
      }],
      engine: 'InnoDB',
      charset: 'utf8mb4',
      ifNotExists: true,
    };

    const sql = serializeDDL(ddl, 'mysql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('orders');
    expect(sql).toContain('PRIMARY KEY');
    expect(sql).toContain('FOREIGN KEY');
    expect(sql).toContain('user_id');
    expect(sql).toContain('REFERENCES');
    expect(sql).toContain('users');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain('ENGINE=InnoDB');
    expect(sql).toContain('CHARACTER SET utf8mb4');
  });

  it('should generate a complete table for SQLite with STRICT mode', () => {
    const ddl: DDLStructure = {
      tableName: 'products',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'name', type: 'TEXT', nullable: false },
        { name: 'price', type: 'REAL', nullable: false },
      ],
      primaryKey: ['id'],
      checkConstraints: [{ expression: 'price > 0' }],
      strict: true,
      ifNotExists: true,
    };

    const sql = serializeDDL(ddl, 'sqlite');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('products');
    expect(sql).toContain('PRIMARY KEY');
    expect(sql).toContain('CHECK (price > 0)');
    expect(sql).toContain('STRICT');
  });
});
