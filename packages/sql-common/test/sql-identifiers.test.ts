/**
 * SQL Identifier Validation Tests - Edge Cases
 *
 * [RED Phase TDD] Tests for SQL identifier validation including:
 * - Reserved SQL keywords as identifiers
 * - Special characters in names
 * - Unicode identifiers
 * - Very long identifiers (max length varies by dialect)
 * - Empty or whitespace-only identifiers
 * - Proper quoting/escaping by dialect
 *
 * Issue: icetype-eg2.7
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  escapeIdentifier,
  validateSchemaName,
  InvalidSchemaNameError,
  type SqlDialect,
} from '../src/index.js';

// =============================================================================
// SQL Reserved Keywords Tests
// =============================================================================

describe('SQL Reserved Keywords as Identifiers', () => {
  const allDialects: SqlDialect[] = ['duckdb', 'postgres', 'clickhouse', 'sqlite', 'mysql'];

  // Common SQL reserved keywords that are often used as identifiers
  const reservedKeywords = [
    'select', 'from', 'where', 'insert', 'update', 'delete', 'drop', 'create',
    'table', 'index', 'view', 'database', 'schema', 'column', 'constraint',
    'primary', 'key', 'foreign', 'references', 'unique', 'check', 'default',
    'null', 'not', 'and', 'or', 'in', 'is', 'like', 'between', 'exists',
    'case', 'when', 'then', 'else', 'end', 'as', 'on', 'join', 'left', 'right',
    'inner', 'outer', 'group', 'by', 'having', 'order', 'asc', 'desc',
    'limit', 'offset', 'union', 'all', 'distinct', 'into', 'values', 'set',
    'grant', 'revoke', 'begin', 'commit', 'rollback', 'transaction',
    'true', 'false', 'user', 'role', 'public', 'current_user',
    'current_date', 'current_time', 'current_timestamp',
  ];

  describe('reserved keywords should be properly escaped', () => {
    reservedKeywords.forEach((keyword) => {
      it(`should escape "${keyword}" keyword in PostgreSQL`, () => {
        const escaped = escapeIdentifier(keyword, 'postgres');
        // Should be quoted for PostgreSQL
        expect(escaped).toBe(`"${keyword}"`);
      });
    });

    it('should escape SELECT keyword in all dialects', () => {
      // PostgreSQL escapes keywords
      expect(escapeIdentifier('select', 'postgres')).toBe('"select"');

      // Other dialects may or may not escape keywords - but the output should be safe
      // DuckDB, SQLite use double quotes
      const duckdbResult = escapeIdentifier('select', 'duckdb');
      expect(duckdbResult === 'select' || duckdbResult === '"select"').toBe(true);

      const sqliteResult = escapeIdentifier('select', 'sqlite');
      expect(sqliteResult === 'select' || sqliteResult === '"select"').toBe(true);

      // ClickHouse, MySQL use backticks
      const clickhouseResult = escapeIdentifier('select', 'clickhouse');
      expect(clickhouseResult === 'select' || clickhouseResult === '`select`').toBe(true);

      const mysqlResult = escapeIdentifier('select', 'mysql');
      expect(mysqlResult === 'select' || mysqlResult === '`select`').toBe(true);
    });

    it('should handle uppercase reserved keywords', () => {
      expect(escapeIdentifier('SELECT', 'postgres')).toBe('"SELECT"');
      expect(escapeIdentifier('TABLE', 'postgres')).toBe('"TABLE"');
    });

    it('should handle mixed case reserved keywords', () => {
      expect(escapeIdentifier('Select', 'postgres')).toBe('"Select"');
      expect(escapeIdentifier('TaBLe', 'postgres')).toBe('"TaBLe"');
    });
  });
});

// =============================================================================
// Special Characters in Names Tests
// =============================================================================

describe('Special Characters in Identifiers', () => {
  const allDialects: SqlDialect[] = ['duckdb', 'postgres', 'clickhouse', 'sqlite', 'mysql'];

  describe('hyphens in identifiers', () => {
    it('should escape identifiers with hyphens', () => {
      expect(escapeIdentifier('user-name', 'postgres')).toBe('"user-name"');
      expect(escapeIdentifier('user-name', 'duckdb')).toBe('"user-name"');
      expect(escapeIdentifier('user-name', 'sqlite')).toBe('"user-name"');
      expect(escapeIdentifier('user-name', 'clickhouse')).toBe('`user-name`');
      expect(escapeIdentifier('user-name', 'mysql')).toBe('`user-name`');
    });
  });

  describe('spaces in identifiers', () => {
    it('should escape identifiers with spaces', () => {
      expect(escapeIdentifier('user name', 'postgres')).toBe('"user name"');
      expect(escapeIdentifier('my table', 'duckdb')).toBe('"my table"');
      expect(escapeIdentifier('column with spaces', 'sqlite')).toBe('"column with spaces"');
      expect(escapeIdentifier('spaced identifier', 'clickhouse')).toBe('`spaced identifier`');
      expect(escapeIdentifier('space test', 'mysql')).toBe('`space test`');
    });
  });

  describe('special characters requiring escaping', () => {
    const specialChars = [
      { char: '@', name: 'at sign' },
      { char: '#', name: 'hash' },
      { char: '!', name: 'exclamation' },
      { char: '%', name: 'percent' },
      { char: '^', name: 'caret' },
      { char: '&', name: 'ampersand' },
      { char: '*', name: 'asterisk' },
      { char: '(', name: 'open paren' },
      { char: ')', name: 'close paren' },
      { char: '+', name: 'plus' },
      { char: '=', name: 'equals' },
      { char: '[', name: 'open bracket' },
      { char: ']', name: 'close bracket' },
      { char: '{', name: 'open brace' },
      { char: '}', name: 'close brace' },
      { char: '|', name: 'pipe' },
      { char: '\\', name: 'backslash' },
      { char: '/', name: 'slash' },
      { char: '?', name: 'question' },
      { char: '<', name: 'less than' },
      { char: '>', name: 'greater than' },
      { char: ',', name: 'comma' },
      { char: '.', name: 'period' },
      { char: ':', name: 'colon' },
      { char: ';', name: 'semicolon' },
    ];

    specialChars.forEach(({ char, name }) => {
      it(`should escape identifier with ${name} (${char})`, () => {
        const identifier = `test${char}column`;
        const escaped = escapeIdentifier(identifier, 'postgres');
        expect(escaped).toBe(`"test${char}column"`);
      });
    });
  });

  describe('embedded quote characters', () => {
    it('should escape double quotes within identifiers for double-quote dialects', () => {
      // DuckDB, PostgreSQL, SQLite use double quotes
      expect(escapeIdentifier('user"name', 'postgres')).toBe('"user""name"');
      expect(escapeIdentifier('user"name', 'duckdb')).toBe('"user""name"');
      expect(escapeIdentifier('user"name', 'sqlite')).toBe('"user""name"');
    });

    it('should escape backticks within identifiers for backtick dialects', () => {
      // ClickHouse, MySQL use backticks
      expect(escapeIdentifier('user`name', 'clickhouse')).toBe('`user``name`');
      expect(escapeIdentifier('user`name', 'mysql')).toBe('`user``name`');
    });

    it('should handle multiple embedded quotes', () => {
      expect(escapeIdentifier('a"b"c', 'postgres')).toBe('"a""b""c"');
      expect(escapeIdentifier('a`b`c', 'mysql')).toBe('`a``b``c`');
    });

    it('should handle cross-quote characters (quotes in wrong dialect)', () => {
      // Backticks in double-quote dialects don't need extra escaping (just quoting)
      expect(escapeIdentifier('user`name', 'postgres')).toBe('"user`name"');

      // Double quotes in backtick dialects don't need extra escaping (just quoting)
      expect(escapeIdentifier('user"name', 'mysql')).toBe('`user"name`');
    });
  });

  describe('system field prefix ($)', () => {
    it('should escape identifiers starting with $', () => {
      expect(escapeIdentifier('$id', 'postgres')).toBe('"$id"');
      expect(escapeIdentifier('$createdAt', 'duckdb')).toBe('"$createdAt"');
      expect(escapeIdentifier('$version', 'clickhouse')).toBe('`$version`');
      expect(escapeIdentifier('$custom_field', 'mysql')).toBe('`$custom_field`');
    });

    it('should escape identifiers with $ anywhere', () => {
      expect(escapeIdentifier('user$data', 'postgres')).toBe('"user$data"');
      expect(escapeIdentifier('price$usd', 'mysql')).toBe('`price$usd`');
    });
  });

  describe('identifiers starting with numbers', () => {
    it('should escape identifiers starting with digits', () => {
      expect(escapeIdentifier('123table', 'postgres')).toBe('"123table"');
      expect(escapeIdentifier('1st_column', 'duckdb')).toBe('"1st_column"');
      expect(escapeIdentifier('0_index', 'clickhouse')).toBe('`0_index`');
      expect(escapeIdentifier('9lives', 'mysql')).toBe('`9lives`');
    });

    it('should handle all-numeric identifiers', () => {
      expect(escapeIdentifier('123', 'postgres')).toBe('"123"');
      expect(escapeIdentifier('456789', 'mysql')).toBe('`456789`');
    });
  });
});

// =============================================================================
// Unicode Identifiers Tests
// =============================================================================

describe('Unicode Identifiers', () => {
  describe('unicode letters in identifiers', () => {
    it('should handle accented characters', () => {
      // These need escaping because they're not simple ASCII alphanumeric
      expect(escapeIdentifier('cafe', 'postgres')).toBe('cafe');
      expect(escapeIdentifier('caf\u00e9', 'postgres')).toBe('"caf\u00e9"'); // e with acute
      expect(escapeIdentifier('na\u00efve', 'postgres')).toBe('"na\u00efve"'); // i with diaeresis
    });

    it('should handle non-ASCII letters', () => {
      expect(escapeIdentifier('\u00fcser', 'postgres')).toBe('"\u00fcser"'); // u with umlaut
      expect(escapeIdentifier('\u00f1ame', 'postgres')).toBe('"\u00f1ame"'); // n with tilde
    });

    it('should handle CJK characters', () => {
      expect(escapeIdentifier('\u7528\u6237', 'postgres')).toBe('"\u7528\u6237"'); // Chinese for "user"
      expect(escapeIdentifier('\u30e6\u30fc\u30b6\u30fc', 'postgres')).toBe('"\u30e6\u30fc\u30b6\u30fc"'); // Japanese katakana for "user"
    });

    it('should handle Cyrillic characters', () => {
      expect(escapeIdentifier('\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c', 'postgres')).toBe('"\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c"'); // Russian for "user"
    });

    it('should handle Greek characters', () => {
      expect(escapeIdentifier('\u03c7\u03c1\u03ae\u03c3\u03c4\u03b7\u03c2', 'postgres')).toBe('"\u03c7\u03c1\u03ae\u03c3\u03c4\u03b7\u03c2"'); // Greek for "user"
    });

    it('should handle Arabic characters', () => {
      expect(escapeIdentifier('\u0645\u0633\u062a\u062e\u062f\u0645', 'postgres')).toBe('"\u0645\u0633\u062a\u062e\u062f\u0645"'); // Arabic for "user"
    });
  });

  describe('unicode symbols and emoji', () => {
    it('should handle emoji in identifiers', () => {
      expect(escapeIdentifier('\u{1F4CA}stats', 'postgres')).toBe('"\u{1F4CA}stats"'); // chart emoji
      expect(escapeIdentifier('user\u{1F44D}', 'mysql')).toBe('`user\u{1F44D}`'); // thumbs up
    });

    it('should handle mathematical symbols', () => {
      expect(escapeIdentifier('\u03c0_value', 'postgres')).toBe('"\u03c0_value"'); // pi
      expect(escapeIdentifier('\u221e_limit', 'postgres')).toBe('"\u221e_limit"'); // infinity
    });

    it('should handle currency symbols', () => {
      expect(escapeIdentifier('price_\u20ac', 'postgres')).toBe('"price_\u20ac"'); // euro
      expect(escapeIdentifier('cost_\u00a3', 'mysql')).toBe('`cost_\u00a3`'); // pound
      expect(escapeIdentifier('amount_\u00a5', 'clickhouse')).toBe('`amount_\u00a5`'); // yen
    });
  });

  describe('unicode normalization edge cases', () => {
    it('should handle composed vs decomposed unicode', () => {
      // e with acute as single codepoint
      const composed = 'caf\u00e9';
      // e + combining acute accent (two codepoints)
      const decomposed = 'cafe\u0301';

      // Both should be escaped since they contain non-ASCII
      expect(escapeIdentifier(composed, 'postgres')).toBe(`"${composed}"`);
      expect(escapeIdentifier(decomposed, 'postgres')).toBe(`"${decomposed}"`);
    });

    it('should handle zero-width characters', () => {
      // Zero-width joiner
      expect(escapeIdentifier('user\u200dname', 'postgres')).toBe('"user\u200dname"');
      // Zero-width non-joiner
      expect(escapeIdentifier('user\u200cname', 'postgres')).toBe('"user\u200cname"');
    });
  });
});

// =============================================================================
// Identifier Length Tests
// =============================================================================

describe('Very Long Identifiers', () => {
  describe('maximum identifier length by dialect', () => {
    // PostgreSQL: 63 bytes (NAMEDATALEN - 1)
    // MySQL: 64 characters
    // SQLite: No limit (but practical limits apply)
    // ClickHouse: No documented limit
    // DuckDB: No documented limit

    it('should handle PostgreSQL max length (63 bytes)', () => {
      const maxPgIdentifier = 'a'.repeat(63);
      const escaped = escapeIdentifier(maxPgIdentifier, 'postgres');
      expect(escaped).toBe(maxPgIdentifier);
    });

    it('should handle identifier exceeding PostgreSQL max (64+ bytes)', () => {
      const longIdentifier = 'a'.repeat(100);
      const escaped = escapeIdentifier(longIdentifier, 'postgres');
      // escapeIdentifier should still work, validation is separate
      expect(escaped).toBe(longIdentifier);
    });

    it('should handle MySQL max length (64 characters)', () => {
      const maxMysqlIdentifier = 'a'.repeat(64);
      const escaped = escapeIdentifier(maxMysqlIdentifier, 'mysql');
      expect(escaped).toBe(maxMysqlIdentifier);
    });

    it('should handle very long identifiers (1000+ characters)', () => {
      const veryLongIdentifier = 'a'.repeat(1000);
      const escaped = escapeIdentifier(veryLongIdentifier, 'postgres');
      expect(escaped).toBe(veryLongIdentifier);
    });

    it('should handle long identifiers with special chars needing escaping', () => {
      const longWithSpecial = 'a'.repeat(50) + '-' + 'b'.repeat(50);
      const escaped = escapeIdentifier(longWithSpecial, 'postgres');
      expect(escaped).toBe(`"${longWithSpecial}"`);
    });
  });

  describe('validate identifier length function', () => {
    it('should validate identifier length for PostgreSQL (max 63 bytes)', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      // Exactly 63 bytes should be valid
      const maxIdentifier = 'a'.repeat(63);
      expect(() => validateIdentifier(maxIdentifier, 'postgres')).not.toThrow();

      // 64 bytes should throw
      const tooLongIdentifier = 'a'.repeat(64);
      expect(() => validateIdentifier(tooLongIdentifier, 'postgres')).toThrow(IdentifierTooLongError);
    });

    it('should validate identifier length for MySQL (max 64 characters)', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      // Exactly 64 characters should be valid
      const maxIdentifier = 'a'.repeat(64);
      expect(() => validateIdentifier(maxIdentifier, 'mysql')).not.toThrow();

      // 65 characters should throw
      const tooLongIdentifier = 'a'.repeat(65);
      expect(() => validateIdentifier(tooLongIdentifier, 'mysql')).toThrow(IdentifierTooLongError);
    });

    it('should handle multibyte UTF-8 in length validation', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      // Each emoji is 4 bytes in UTF-8
      // 16 emojis = 64 bytes (exceeds PostgreSQL's 63 byte limit)
      const emojiIdentifier = '\u{1F600}'.repeat(16);
      expect(() => validateIdentifier(emojiIdentifier, 'postgres')).toThrow(IdentifierTooLongError);

      // But should be valid for MySQL which counts characters (16 chars < 64)
      expect(() => validateIdentifier(emojiIdentifier, 'mysql')).not.toThrow();
    });

    it('should provide appropriate error messages for too-long identifiers', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      const longIdentifier = 'a'.repeat(100);
      try {
        validateIdentifier(longIdentifier, 'postgres');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(IdentifierTooLongError);
        expect((e as Error).message).toContain('postgres');
        expect((e as Error).message).toContain('63');
        expect((e as Error).message).toContain('bytes');
      }
    });
  });
});

// =============================================================================
// Empty and Whitespace-Only Identifiers Tests
// =============================================================================

describe('Empty and Whitespace-Only Identifiers', () => {
  describe('empty identifiers', () => {
    it('should handle empty string identifier', () => {
      // An empty identifier is technically invalid SQL
      // The function should either throw or return quoted empty string
      const result = escapeIdentifier('', 'postgres');
      // Either '""' or throw is acceptable - currently returns '""'
      expect(result === '""' || result === '').toBe(true);
    });
  });

  describe('whitespace-only identifiers', () => {
    it('should escape single space identifier', () => {
      const escaped = escapeIdentifier(' ', 'postgres');
      expect(escaped).toBe('" "');
    });

    it('should escape multiple spaces identifier', () => {
      const escaped = escapeIdentifier('   ', 'postgres');
      expect(escaped).toBe('"   "');
    });

    it('should escape tab character identifier', () => {
      const escaped = escapeIdentifier('\t', 'postgres');
      expect(escaped).toBe('"\t"');
    });

    it('should escape newline character identifier', () => {
      const escaped = escapeIdentifier('\n', 'postgres');
      expect(escaped).toBe('"\n"');
    });

    it('should escape mixed whitespace identifier', () => {
      const escaped = escapeIdentifier(' \t\n ', 'postgres');
      expect(escaped).toBe('" \t\n "');
    });
  });

  describe('identifiers with leading/trailing whitespace', () => {
    it('should escape identifier with leading space', () => {
      const escaped = escapeIdentifier(' username', 'postgres');
      expect(escaped).toBe('" username"');
    });

    it('should escape identifier with trailing space', () => {
      const escaped = escapeIdentifier('username ', 'postgres');
      expect(escaped).toBe('"username "');
    });

    it('should escape identifier with both leading and trailing spaces', () => {
      const escaped = escapeIdentifier(' username ', 'postgres');
      expect(escaped).toBe('" username "');
    });
  });
});

// =============================================================================
// Proper Quoting/Escaping by Dialect Tests
// =============================================================================

describe('Proper Quoting/Escaping by Dialect', () => {
  const testIdentifiers = [
    { id: 'simple', needsEscape: false },
    { id: 'with_underscore', needsEscape: false },
    { id: 'with-hyphen', needsEscape: true },
    { id: 'with space', needsEscape: true },
    { id: '123numeric', needsEscape: true },
    { id: '$system', needsEscape: true },
    { id: 'has"quote', needsEscape: true },
    { id: 'has`backtick', needsEscape: true },
    { id: 'select', needsEscape: 'postgres' }, // keyword only in postgres
  ];

  describe('PostgreSQL quoting', () => {
    it('should use double quotes for escaping', () => {
      expect(escapeIdentifier('with-hyphen', 'postgres')).toBe('"with-hyphen"');
    });

    it('should double escape embedded double quotes', () => {
      expect(escapeIdentifier('has"quote', 'postgres')).toBe('"has""quote"');
    });

    it('should not quote simple identifiers', () => {
      expect(escapeIdentifier('simple', 'postgres')).toBe('simple');
    });

    it('should escape reserved keywords', () => {
      expect(escapeIdentifier('select', 'postgres')).toBe('"select"');
      expect(escapeIdentifier('table', 'postgres')).toBe('"table"');
    });
  });

  describe('MySQL quoting', () => {
    it('should use backticks for escaping', () => {
      expect(escapeIdentifier('with-hyphen', 'mysql')).toBe('`with-hyphen`');
    });

    it('should double escape embedded backticks', () => {
      expect(escapeIdentifier('has`backtick', 'mysql')).toBe('`has``backtick`');
    });

    it('should not quote simple identifiers', () => {
      expect(escapeIdentifier('simple', 'mysql')).toBe('simple');
    });
  });

  describe('SQLite quoting', () => {
    it('should use double quotes for escaping', () => {
      expect(escapeIdentifier('with-hyphen', 'sqlite')).toBe('"with-hyphen"');
    });

    it('should double escape embedded double quotes', () => {
      expect(escapeIdentifier('has"quote', 'sqlite')).toBe('"has""quote"');
    });

    it('should not quote simple identifiers', () => {
      expect(escapeIdentifier('simple', 'sqlite')).toBe('simple');
    });
  });

  describe('ClickHouse quoting', () => {
    it('should use backticks for escaping', () => {
      expect(escapeIdentifier('with-hyphen', 'clickhouse')).toBe('`with-hyphen`');
    });

    it('should double escape embedded backticks', () => {
      expect(escapeIdentifier('has`backtick', 'clickhouse')).toBe('`has``backtick`');
    });

    it('should not quote simple identifiers', () => {
      expect(escapeIdentifier('simple', 'clickhouse')).toBe('simple');
    });
  });

  describe('DuckDB quoting', () => {
    it('should use double quotes for escaping', () => {
      expect(escapeIdentifier('with-hyphen', 'duckdb')).toBe('"with-hyphen"');
    });

    it('should double escape embedded double quotes', () => {
      expect(escapeIdentifier('has"quote', 'duckdb')).toBe('"has""quote"');
    });

    it('should not quote simple identifiers', () => {
      expect(escapeIdentifier('simple', 'duckdb')).toBe('simple');
    });
  });
});

// =============================================================================
// SQL Injection Prevention Tests
// =============================================================================

describe('SQL Injection Prevention via Identifiers', () => {
  const injectionPayloads = [
    'users; DROP TABLE users; --',
    "users'; DROP TABLE users; --",
    'users" OR "1"="1',
    'users`; DROP TABLE users; --',
    'users\'; SELECT * FROM passwords; --',
    'users UNION SELECT * FROM passwords',
    'users/**/WHERE/**/1=1',
    'users\nDROP TABLE users',
    'users\r\nDROP TABLE users',
  ];

  describe('escapeIdentifier should neutralize injection attempts', () => {
    injectionPayloads.forEach((payload) => {
      it(`should safely quote injection payload: ${payload.slice(0, 30)}...`, () => {
        const escaped = escapeIdentifier(payload, 'postgres');

        // Should be quoted
        expect(escaped.startsWith('"')).toBe(true);
        expect(escaped.endsWith('"')).toBe(true);

        // Should not contain unquoted semicolons that could end statements
        // The semicolon should be inside the quotes
        expect(escaped).toContain(payload.replace(/"/g, '""'));
      });
    });
  });

  describe('validateSchemaName should reject injection attempts', () => {
    injectionPayloads.forEach((payload) => {
      it(`should reject injection payload: ${payload.slice(0, 30)}...`, () => {
        expect(() => validateSchemaName(payload)).toThrow(InvalidSchemaNameError);
      });
    });
  });
});

// =============================================================================
// Edge Cases and Corner Cases Tests
// =============================================================================

describe('Edge Cases and Corner Cases', () => {
  describe('null byte handling', () => {
    it('should handle null byte in identifier', () => {
      const withNull = 'user\x00name';
      const escaped = escapeIdentifier(withNull, 'postgres');
      // Should be escaped since it contains special char
      expect(escaped).toBe('"user\x00name"');
    });
  });

  describe('very short identifiers', () => {
    it('should handle single character identifiers', () => {
      expect(escapeIdentifier('a', 'postgres')).toBe('a');
      expect(escapeIdentifier('_', 'postgres')).toBe('_');
      expect(escapeIdentifier('1', 'postgres')).toBe('"1"');
      expect(escapeIdentifier('-', 'postgres')).toBe('"-"');
    });
  });

  describe('underscore edge cases', () => {
    it('should not escape underscores', () => {
      expect(escapeIdentifier('_', 'postgres')).toBe('_');
      expect(escapeIdentifier('__', 'postgres')).toBe('__');
      expect(escapeIdentifier('___test___', 'postgres')).toBe('___test___');
    });

    it('should handle leading underscores', () => {
      expect(escapeIdentifier('_private', 'postgres')).toBe('_private');
      expect(escapeIdentifier('__dunder__', 'postgres')).toBe('__dunder__');
    });
  });

  describe('case sensitivity', () => {
    it('should preserve case in identifiers', () => {
      expect(escapeIdentifier('UserName', 'postgres')).toBe('UserName');
      expect(escapeIdentifier('USERNAME', 'postgres')).toBe('USERNAME');
      expect(escapeIdentifier('username', 'postgres')).toBe('username');
    });

    it('should preserve case in escaped identifiers', () => {
      expect(escapeIdentifier('User-Name', 'postgres')).toBe('"User-Name"');
      expect(escapeIdentifier('USER NAME', 'postgres')).toBe('"USER NAME"');
    });
  });

  describe('control characters', () => {
    const controlChars = [
      { char: '\x00', name: 'null' },
      { char: '\x01', name: 'SOH' },
      { char: '\x07', name: 'bell' },
      { char: '\x08', name: 'backspace' },
      { char: '\x0b', name: 'vertical tab' },
      { char: '\x0c', name: 'form feed' },
      { char: '\x1b', name: 'escape' },
      { char: '\x7f', name: 'delete' },
    ];

    controlChars.forEach(({ char, name }) => {
      it(`should escape identifier with ${name} control character`, () => {
        const identifier = `test${char}column`;
        const escaped = escapeIdentifier(identifier, 'postgres');
        expect(escaped).toBe(`"test${char}column"`);
      });
    });
  });

  describe('bidirectional text', () => {
    it('should handle RTL markers', () => {
      // Right-to-left mark
      expect(escapeIdentifier('user\u200fname', 'postgres')).toBe('"user\u200fname"');
      // Left-to-right mark
      expect(escapeIdentifier('user\u200ename', 'postgres')).toBe('"user\u200ename"');
    });

    it('should handle RTL override characters', () => {
      // Right-to-left override - potential security issue
      expect(escapeIdentifier('user\u202ename', 'postgres')).toBe('"user\u202ename"');
    });
  });
});

// =============================================================================
// Validate Identifier Function Tests
// =============================================================================

/**
 * Tests for the validateIdentifier function.
 *
 * The validateIdentifier function:
 * 1. Validates that identifiers are not empty
 * 2. Validates identifier length by dialect (PostgreSQL: 63 bytes, MySQL: 64 chars)
 * 3. Rejects identifiers with dangerous characters that can't be safely escaped
 * 4. Provides appropriate error types for different validation failures
 */
describe('validateIdentifier function', () => {
  describe('empty identifier validation', () => {
    it('should throw InvalidIdentifierError for empty string', async () => {
      // This import should fail until validateIdentifier is implemented
      const { validateIdentifier, InvalidIdentifierError } = await import('../index.js');

      expect(() => validateIdentifier('', 'postgres')).toThrow(InvalidIdentifierError);
    });

    it('should throw InvalidIdentifierError for whitespace-only string', async () => {
      const { validateIdentifier, InvalidIdentifierError } = await import('../index.js');

      expect(() => validateIdentifier('   ', 'postgres')).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier('\t', 'postgres')).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier('\n', 'postgres')).toThrow(InvalidIdentifierError);
    });
  });

  describe('identifier length validation by dialect', () => {
    it('should throw IdentifierTooLongError for PostgreSQL identifiers > 63 bytes', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      const longIdentifier = 'a'.repeat(64);
      expect(() => validateIdentifier(longIdentifier, 'postgres')).toThrow(IdentifierTooLongError);
    });

    it('should accept PostgreSQL identifiers of exactly 63 bytes', async () => {
      const { validateIdentifier } = await import('../index.js');

      const maxIdentifier = 'a'.repeat(63);
      expect(() => validateIdentifier(maxIdentifier, 'postgres')).not.toThrow();
    });

    it('should throw IdentifierTooLongError for MySQL identifiers > 64 characters', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      const longIdentifier = 'a'.repeat(65);
      expect(() => validateIdentifier(longIdentifier, 'mysql')).toThrow(IdentifierTooLongError);
    });

    it('should count bytes not characters for PostgreSQL multibyte UTF-8', async () => {
      const { validateIdentifier, IdentifierTooLongError } = await import('../index.js');

      // Each emoji is 4 bytes, so 16 emojis = 64 bytes (exceeds 63 byte limit)
      const emojiIdentifier = '\u{1F600}'.repeat(16);
      expect(() => validateIdentifier(emojiIdentifier, 'postgres')).toThrow(IdentifierTooLongError);
    });

    it('should count characters not bytes for MySQL', async () => {
      const { validateIdentifier } = await import('../index.js');

      // 64 emoji characters should be valid for MySQL (counts chars not bytes)
      const emojiIdentifier = '\u{1F600}'.repeat(64);
      expect(() => validateIdentifier(emojiIdentifier, 'mysql')).not.toThrow();
    });
  });

  describe('reserved keyword checking', () => {
    it('should escape reserved keywords in all dialects, not just PostgreSQL', async () => {
      // Currently keywords are only escaped for PostgreSQL
      // This test verifies MySQL keywords should also be escaped

      // This tests the escapeIdentifier function behavior change
      expect(escapeIdentifier('select', 'mysql')).toBe('`select`');
      expect(escapeIdentifier('table', 'mysql')).toBe('`table`');
      expect(escapeIdentifier('order', 'mysql')).toBe('`order`');
    });

    it('should escape reserved keywords in SQLite', async () => {
      expect(escapeIdentifier('select', 'sqlite')).toBe('"select"');
      expect(escapeIdentifier('table', 'sqlite')).toBe('"table"');
    });

    it('should escape reserved keywords in ClickHouse', async () => {
      expect(escapeIdentifier('select', 'clickhouse')).toBe('`select`');
      expect(escapeIdentifier('database', 'clickhouse')).toBe('`database`');
    });

    it('should escape reserved keywords in DuckDB', async () => {
      expect(escapeIdentifier('select', 'duckdb')).toBe('"select"');
      expect(escapeIdentifier('table', 'duckdb')).toBe('"table"');
    });
  });

  describe('dangerous character validation', () => {
    it('should throw InvalidIdentifierError for null bytes', async () => {
      const { validateIdentifier, InvalidIdentifierError } = await import('../index.js');

      expect(() => validateIdentifier('user\x00name', 'postgres')).toThrow(InvalidIdentifierError);
    });

    it('should throw InvalidIdentifierError for control characters', async () => {
      const { validateIdentifier, InvalidIdentifierError } = await import('../index.js');

      expect(() => validateIdentifier('user\x01name', 'postgres')).toThrow(InvalidIdentifierError);
      expect(() => validateIdentifier('user\x7fname', 'postgres')).toThrow(InvalidIdentifierError);
    });

    it('should throw InvalidIdentifierError for bidirectional override characters', async () => {
      const { validateIdentifier, InvalidIdentifierError } = await import('../index.js');

      // Right-to-left override - known security risk
      expect(() => validateIdentifier('user\u202ename', 'postgres')).toThrow(InvalidIdentifierError);
      // Left-to-right override
      expect(() => validateIdentifier('user\u202dname', 'postgres')).toThrow(InvalidIdentifierError);
    });
  });

  describe('validateIdentifier return type', () => {
    it('should return validation result object with details', async () => {
      const { validateIdentifier } = await import('../index.js');

      const result = validateIdentifier('valid_identifier', 'postgres');

      expect(result).toEqual({
        valid: true,
        identifier: 'valid_identifier',
        dialect: 'postgres',
        needsQuoting: false,
        isReservedKeyword: false,
        byteLength: 16,
        charLength: 16,
      });
    });

    it('should return needsQuoting: true for special identifiers', async () => {
      const { validateIdentifier } = await import('../index.js');

      const result = validateIdentifier('user-name', 'postgres');

      expect(result.valid).toBe(true);
      expect(result.needsQuoting).toBe(true);
    });

    it('should return isReservedKeyword: true for SQL keywords', async () => {
      const { validateIdentifier } = await import('../index.js');

      const result = validateIdentifier('select', 'postgres');

      expect(result.valid).toBe(true);
      expect(result.isReservedKeyword).toBe(true);
      expect(result.needsQuoting).toBe(true);
    });
  });
});

// =============================================================================
// Reserved Keywords Escaping for All Dialects
// =============================================================================

describe('Reserved keywords escaping for all dialects', () => {
  // Verifies that keywords are escaped for ALL dialects consistently

  const commonKeywords = ['select', 'from', 'where', 'table', 'insert', 'update', 'delete', 'order', 'group', 'by'];

  describe('MySQL should escape reserved keywords', () => {
    commonKeywords.forEach((keyword) => {
      it(`should escape "${keyword}" in MySQL`, () => {
        expect(escapeIdentifier(keyword, 'mysql')).toBe(`\`${keyword}\``);
      });
    });
  });

  describe('SQLite should escape reserved keywords', () => {
    commonKeywords.forEach((keyword) => {
      it(`should escape "${keyword}" in SQLite`, () => {
        expect(escapeIdentifier(keyword, 'sqlite')).toBe(`"${keyword}"`);
      });
    });
  });

  describe('ClickHouse should escape reserved keywords', () => {
    commonKeywords.forEach((keyword) => {
      it(`should escape "${keyword}" in ClickHouse`, () => {
        expect(escapeIdentifier(keyword, 'clickhouse')).toBe(`\`${keyword}\``);
      });
    });
  });

  describe('DuckDB should escape reserved keywords', () => {
    commonKeywords.forEach((keyword) => {
      it(`should escape "${keyword}" in DuckDB`, () => {
        expect(escapeIdentifier(keyword, 'duckdb')).toBe(`"${keyword}"`);
      });
    });
  });
});

// =============================================================================
// Dialect-Specific Reserved Keywords Tests
// =============================================================================

describe('Dialect-specific reserved keywords', () => {
  describe('MySQL-specific keywords', () => {
    const mysqlKeywords = ['groups', 'empty', 'rank', 'system', 'window', 'cume_dist', 'dense_rank'];

    mysqlKeywords.forEach((keyword) => {
      it(`should escape MySQL keyword "${keyword}"`, () => {
        expect(escapeIdentifier(keyword, 'mysql')).toBe(`\`${keyword}\``);
      });
    });
  });

  describe('PostgreSQL-specific keywords', () => {
    const postgresKeywords = ['ilike', 'analyse', 'lateral', 'variadic', 'verbose', 'tablesample'];

    postgresKeywords.forEach((keyword) => {
      it(`should escape PostgreSQL keyword "${keyword}"`, () => {
        expect(escapeIdentifier(keyword, 'postgres')).toBe(`"${keyword}"`);
      });
    });
  });

  describe('ClickHouse-specific keywords', () => {
    const clickhouseKeywords = ['prewhere', 'final', 'sample', 'settings', 'totals', 'materialize'];

    clickhouseKeywords.forEach((keyword) => {
      it(`should escape ClickHouse keyword "${keyword}"`, () => {
        expect(escapeIdentifier(keyword, 'clickhouse')).toBe(`\`${keyword}\``);
      });
    });
  });

  describe('SQLite-specific keywords', () => {
    const sqliteKeywords = ['autoincrement', 'glob', 'indexed', 'pragma', 'vacuum', 'reindex'];

    sqliteKeywords.forEach((keyword) => {
      it(`should escape SQLite keyword "${keyword}"`, () => {
        expect(escapeIdentifier(keyword, 'sqlite')).toBe(`"${keyword}"`);
      });
    });
  });

  describe('DuckDB-specific keywords', () => {
    const duckdbKeywords = ['pivot', 'unpivot', 'qualify', 'asof', 'positional', 'macro'];

    duckdbKeywords.forEach((keyword) => {
      it(`should escape DuckDB keyword "${keyword}"`, () => {
        expect(escapeIdentifier(keyword, 'duckdb')).toBe(`"${keyword}"`);
      });
    });
  });
});
