/**
 * Playground Tests for @icetype/playground
 *
 * Tests for the interactive web playground where users can try IceType schemas.
 * Similar to TypeScript Playground or Prisma Playground.
 *
 * These tests are written in RED phase - they should FAIL because:
 * - Playground components don't exist yet
 * - Schema editor not implemented
 * - Live preview not implemented
 * - Dialect selector not implemented
 * - Share URL functionality not implemented
 * - Example schema loading not implemented
 *
 * Expected Features (to be implemented):
 * - Monaco editor for schema input
 * - Live TypeScript/SQL/Iceberg output preview
 * - Dialect selection dropdown (TypeScript, PostgreSQL, MySQL, SQLite, ClickHouse, Iceberg)
 * - Share button for generating shareable URLs
 * - Example schemas selector with pre-built schemas
 * - Error messages display for invalid schemas
 * - Keyboard shortcuts for common actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Components that don't exist yet - imports will fail
import { Playground } from '../components/Playground';
import { SchemaEditor } from '../components/SchemaEditor';
import { OutputPreview } from '../components/OutputPreview';
import { DialectSelector } from '../components/DialectSelector';
import { ShareButton } from '../components/ShareButton';
import { ExampleSelector } from '../components/ExampleSelector';
import { ErrorDisplay } from '../components/ErrorDisplay';

// Utility functions that don't exist yet
import { compressSchema, decompressSchema, generateShareUrl, parseShareUrl } from '../lib/share';
import { compileSchema, type CompileResult } from '../lib/compiler';
import { EXAMPLE_SCHEMAS, type ExampleSchema } from '../lib/examples';
import { type Dialect, SUPPORTED_DIALECTS } from '../lib/dialects';

// =============================================================================
// SchemaEditor Tests
// =============================================================================

describe('SchemaEditor', () => {
  describe('basic input', () => {
    it('should render an editor component', () => {
      render(<SchemaEditor value="" onChange={() => {}} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should display initial schema value', () => {
      const initialSchema = `User {
  id: uuid!
  name: string!
}`;
      render(<SchemaEditor value={initialSchema} onChange={() => {}} />);

      expect(screen.getByText(/User/)).toBeInTheDocument();
      expect(screen.getByText(/uuid/)).toBeInTheDocument();
    });

    it('should call onChange when user types', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<SchemaEditor value="" onChange={onChange} />);

      const editor = screen.getByRole('textbox');
      await user.type(editor, 'User { id: uuid! }');

      expect(onChange).toHaveBeenCalled();
    });

    it('should support syntax highlighting for IceType', () => {
      const schema = `User {
  id: uuid!
  email: string! #unique
  posts: [Post] -> author
}`;
      render(<SchemaEditor value={schema} onChange={() => {}} />);

      // Monaco should apply syntax highlighting classes
      expect(screen.getByTestId('schema-editor')).toHaveAttribute('data-language', 'icetype');
    });

    it('should show line numbers', () => {
      render(<SchemaEditor value="User { id: uuid! }" onChange={() => {}} showLineNumbers />);

      expect(screen.getByTestId('line-numbers')).toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should format code on Shift+Alt+F', async () => {
      const user = userEvent.setup();
      const onFormat = vi.fn();

      render(
        <SchemaEditor
          value="User{id:uuid!}"
          onChange={() => {}}
          onFormat={onFormat}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('{Shift>}{Alt>}f{/Alt}{/Shift}');

      expect(onFormat).toHaveBeenCalled();
    });

    it('should save on Ctrl+S / Cmd+S', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(
        <SchemaEditor
          value="User { id: uuid! }"
          onChange={() => {}}
          onSave={onSave}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('{Control>}s{/Control}');

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('autocomplete', () => {
    it('should suggest type names', async () => {
      const user = userEvent.setup();

      render(<SchemaEditor value="User { name: " onChange={() => {}} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('str');

      await waitFor(() => {
        expect(screen.getByText('string')).toBeInTheDocument();
      });
    });

    it('should suggest directives after $', async () => {
      const user = userEvent.setup();

      render(<SchemaEditor value="User { $" onChange={() => {}} />);

      const editor = screen.getByRole('textbox');
      await user.click(editor);

      await waitFor(() => {
        expect(screen.getByText('$partitionBy')).toBeInTheDocument();
        expect(screen.getByText('$fts')).toBeInTheDocument();
        expect(screen.getByText('$vector')).toBeInTheDocument();
      });
    });
  });
});

// =============================================================================
// OutputPreview Tests
// =============================================================================

describe('OutputPreview', () => {
  const sampleSchema = `User {
  id: uuid!
  name: string!
  email: string! #unique
}`;

  describe('TypeScript output', () => {
    it('should display generated TypeScript types', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="typescript" />);

      await waitFor(() => {
        expect(screen.getByText(/interface User/)).toBeInTheDocument();
        expect(screen.getByText(/id: string/)).toBeInTheDocument();
        expect(screen.getByText(/name: string/)).toBeInTheDocument();
      });
    });

    it('should show export statements', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="typescript" />);

      await waitFor(() => {
        expect(screen.getByText(/export/)).toBeInTheDocument();
      });
    });
  });

  describe('SQL output', () => {
    it('should display PostgreSQL DDL', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="postgresql" />);

      await waitFor(() => {
        expect(screen.getByText(/CREATE TABLE/)).toBeInTheDocument();
        expect(screen.getByText(/\"user\"/i)).toBeInTheDocument();
        expect(screen.getByText(/UUID/)).toBeInTheDocument();
      });
    });

    it('should display MySQL DDL', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="mysql" />);

      await waitFor(() => {
        expect(screen.getByText(/CREATE TABLE/)).toBeInTheDocument();
        expect(screen.getByText(/CHAR\(36\)/)).toBeInTheDocument();
      });
    });

    it('should display SQLite DDL', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="sqlite" />);

      await waitFor(() => {
        expect(screen.getByText(/CREATE TABLE/)).toBeInTheDocument();
        expect(screen.getByText(/TEXT/)).toBeInTheDocument();
      });
    });

    it('should display ClickHouse DDL', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="clickhouse" />);

      await waitFor(() => {
        expect(screen.getByText(/CREATE TABLE/)).toBeInTheDocument();
        expect(screen.getByText(/ENGINE/)).toBeInTheDocument();
      });
    });

    it('should show unique constraints', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="postgresql" />);

      await waitFor(() => {
        expect(screen.getByText(/UNIQUE/)).toBeInTheDocument();
      });
    });
  });

  describe('Iceberg output', () => {
    it('should display Iceberg schema JSON', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="iceberg" />);

      await waitFor(() => {
        expect(screen.getByText(/"type":\s*"struct"/)).toBeInTheDocument();
        expect(screen.getByText(/"fields"/)).toBeInTheDocument();
      });
    });

    it('should show field IDs for Iceberg', async () => {
      render(<OutputPreview schema={sampleSchema} dialect="iceberg" />);

      await waitFor(() => {
        expect(screen.getByText(/"id":\s*\d+/)).toBeInTheDocument();
      });
    });
  });

  describe('live updates', () => {
    it('should update output when schema changes', async () => {
      const { rerender } = render(
        <OutputPreview schema="User { id: uuid! }" dialect="typescript" />
      );

      await waitFor(() => {
        expect(screen.getByText(/interface User/)).toBeInTheDocument();
      });

      rerender(
        <OutputPreview schema="Post { id: uuid! title: string! }" dialect="typescript" />
      );

      await waitFor(() => {
        expect(screen.getByText(/interface Post/)).toBeInTheDocument();
        expect(screen.getByText(/title/)).toBeInTheDocument();
      });
    });

    it('should debounce rapid changes', async () => {
      const compileSpy = vi.spyOn(await import('../lib/compiler'), 'compileSchema');

      const { rerender } = render(
        <OutputPreview schema="A { id: uuid! }" dialect="typescript" />
      );

      // Rapid changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <OutputPreview schema={`Entity${i} { id: uuid! }`} dialect="typescript" />
        );
      }

      // Should have debounced to fewer calls
      await waitFor(() => {
        expect(compileSpy).toHaveBeenCalledTimes(expect.lessThan(10));
      });
    });
  });

  describe('copy to clipboard', () => {
    it('should have a copy button', () => {
      render(<OutputPreview schema={sampleSchema} dialect="typescript" />);

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('should copy output to clipboard when clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn();
      Object.assign(navigator, { clipboard: { writeText } });

      render(<OutputPreview schema={sampleSchema} dialect="typescript" />);

      await user.click(screen.getByRole('button', { name: /copy/i }));

      expect(writeText).toHaveBeenCalled();
    });

    it('should show success feedback after copy', async () => {
      const user = userEvent.setup();
      Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

      render(<OutputPreview schema={sampleSchema} dialect="typescript" />);

      await user.click(screen.getByRole('button', { name: /copy/i }));

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });
});

// =============================================================================
// DialectSelector Tests
// =============================================================================

describe('DialectSelector', () => {
  const dialects: Dialect[] = ['typescript', 'postgresql', 'mysql', 'sqlite', 'clickhouse', 'iceberg'];

  it('should render a dropdown/select', () => {
    render(<DialectSelector value="typescript" onChange={() => {}} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should display all supported dialects', async () => {
    const user = userEvent.setup();

    render(<DialectSelector value="typescript" onChange={() => {}} />);

    await user.click(screen.getByRole('combobox'));

    for (const dialect of dialects) {
      expect(screen.getByRole('option', { name: new RegExp(dialect, 'i') })).toBeInTheDocument();
    }
  });

  it('should show the current selection', () => {
    render(<DialectSelector value="postgresql" onChange={() => {}} />);

    expect(screen.getByRole('combobox')).toHaveTextContent(/postgresql/i);
  });

  it('should call onChange when selection changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DialectSelector value="typescript" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /mysql/i }));

    expect(onChange).toHaveBeenCalledWith('mysql');
  });

  it('should display dialect icons/labels', () => {
    render(<DialectSelector value="typescript" onChange={() => {}} />);

    expect(screen.getByTestId('dialect-icon-typescript')).toBeInTheDocument();
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DialectSelector value="typescript" onChange={onChange} />);

    const select = screen.getByRole('combobox');
    await user.click(select);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalled();
  });
});

// =============================================================================
// ShareButton Tests
// =============================================================================

describe('ShareButton', () => {
  const testSchema = `User {
  id: uuid!
  name: string!
}`;

  it('should render a share button', () => {
    render(<ShareButton schema={testSchema} dialect="typescript" />);

    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('should generate a shareable URL when clicked', async () => {
    const user = userEvent.setup();

    render(<ShareButton schema={testSchema} dialect="typescript" />);

    await user.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/playground.*\?code=/)).toBeInTheDocument();
    });
  });

  it('should copy URL to clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ShareButton schema={testSchema} dialect="typescript" />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    await user.click(screen.getByRole('button', { name: /copy.*url/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?code='));
  });

  it('should include dialect in share URL', async () => {
    const user = userEvent.setup();

    render(<ShareButton schema={testSchema} dialect="postgresql" />);

    await user.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/dialect=postgresql/)).toBeInTheDocument();
    });
  });

  it('should compress schema in URL', () => {
    const url = generateShareUrl(testSchema, 'typescript');

    expect(url).toContain('code=');
    // URL should be shorter than raw schema for typical schemas
    expect(url.length).toBeLessThan(testSchema.length * 3);
  });
});

// =============================================================================
// Share URL Utility Tests
// =============================================================================

describe('share utilities', () => {
  const testSchema = `User {
  id: uuid!
  name: string!
  email: string! #unique
  posts: [Post] -> author
}

Post {
  id: uuid!
  title: string!
  content: text?
  author: User! <- posts
}`;

  describe('compressSchema', () => {
    it('should compress schema to shorter string', () => {
      const compressed = compressSchema(testSchema);

      expect(compressed.length).toBeLessThan(testSchema.length);
    });

    it('should be URL-safe', () => {
      const compressed = compressSchema(testSchema);

      // Should not contain characters that need URL encoding
      expect(compressed).toMatch(/^[A-Za-z0-9+/=_-]*$/);
    });
  });

  describe('decompressSchema', () => {
    it('should restore original schema', () => {
      const compressed = compressSchema(testSchema);
      const decompressed = decompressSchema(compressed);

      expect(decompressed).toBe(testSchema);
    });

    it('should handle empty string', () => {
      const compressed = compressSchema('');
      const decompressed = decompressSchema(compressed);

      expect(decompressed).toBe('');
    });

    it('should handle unicode characters', () => {
      const unicodeSchema = `User { name: string! // 用户名 }`;
      const compressed = compressSchema(unicodeSchema);
      const decompressed = decompressSchema(compressed);

      expect(decompressed).toBe(unicodeSchema);
    });
  });

  describe('generateShareUrl', () => {
    it('should create valid URL', () => {
      const url = generateShareUrl(testSchema, 'typescript');

      expect(() => new URL(url)).not.toThrow();
    });

    it('should include code parameter', () => {
      const url = generateShareUrl(testSchema, 'typescript');
      const parsed = new URL(url);

      expect(parsed.searchParams.has('code')).toBe(true);
    });

    it('should include dialect parameter', () => {
      const url = generateShareUrl(testSchema, 'postgresql');
      const parsed = new URL(url);

      expect(parsed.searchParams.get('dialect')).toBe('postgresql');
    });
  });

  describe('parseShareUrl', () => {
    it('should extract schema from URL', () => {
      const url = generateShareUrl(testSchema, 'typescript');
      const parsed = parseShareUrl(url);

      expect(parsed.schema).toBe(testSchema);
    });

    it('should extract dialect from URL', () => {
      const url = generateShareUrl(testSchema, 'mysql');
      const parsed = parseShareUrl(url);

      expect(parsed.dialect).toBe('mysql');
    });

    it('should return defaults for invalid URL', () => {
      const parsed = parseShareUrl('https://example.com/playground');

      expect(parsed.schema).toBe('');
      expect(parsed.dialect).toBe('typescript');
    });
  });
});

// =============================================================================
// ExampleSelector Tests
// =============================================================================

describe('ExampleSelector', () => {
  it('should render example selector', () => {
    render(<ExampleSelector onSelect={() => {}} />);

    expect(screen.getByRole('combobox', { name: /example/i })).toBeInTheDocument();
  });

  it('should display available examples', async () => {
    const user = userEvent.setup();

    render(<ExampleSelector onSelect={() => {}} />);

    await user.click(screen.getByRole('combobox', { name: /example/i }));

    // Should show built-in examples
    expect(screen.getByText(/blog/i)).toBeInTheDocument();
    expect(screen.getByText(/e-commerce/i)).toBeInTheDocument();
    expect(screen.getByText(/social/i)).toBeInTheDocument();
  });

  it('should call onSelect with schema when example chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<ExampleSelector onSelect={onSelect} />);

    await user.click(screen.getByRole('combobox', { name: /example/i }));
    await user.click(screen.getByText(/blog/i));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringContaining('blog'),
      schema: expect.stringContaining('Post'),
    }));
  });

  it('should show example descriptions', async () => {
    const user = userEvent.setup();

    render(<ExampleSelector onSelect={() => {}} />);

    await user.click(screen.getByRole('combobox', { name: /example/i }));

    // Each example should have a description
    expect(screen.getByText(/users.*posts.*comments/i)).toBeInTheDocument();
  });
});

// =============================================================================
// Example Schemas Tests
// =============================================================================

describe('EXAMPLE_SCHEMAS', () => {
  it('should have blog example', () => {
    const blog = EXAMPLE_SCHEMAS.find((e: ExampleSchema) => e.id === 'blog');

    expect(blog).toBeDefined();
    expect(blog?.schema).toContain('User');
    expect(blog?.schema).toContain('Post');
    expect(blog?.schema).toContain('Comment');
  });

  it('should have e-commerce example', () => {
    const ecommerce = EXAMPLE_SCHEMAS.find((e: ExampleSchema) => e.id === 'ecommerce');

    expect(ecommerce).toBeDefined();
    expect(ecommerce?.schema).toContain('Product');
    expect(ecommerce?.schema).toContain('Order');
    expect(ecommerce?.schema).toContain('Customer');
  });

  it('should have social network example', () => {
    const social = EXAMPLE_SCHEMAS.find((e: ExampleSchema) => e.id === 'social');

    expect(social).toBeDefined();
    expect(social?.schema).toContain('User');
    expect(social?.schema).toContain('Follow');
  });

  it('should have all required fields for each example', () => {
    for (const example of EXAMPLE_SCHEMAS) {
      expect(example).toHaveProperty('id');
      expect(example).toHaveProperty('name');
      expect(example).toHaveProperty('description');
      expect(example).toHaveProperty('schema');
      expect(typeof example.schema).toBe('string');
      expect(example.schema.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// ErrorDisplay Tests
// =============================================================================

describe('ErrorDisplay', () => {
  it('should not render when there are no errors', () => {
    const { container } = render(<ErrorDisplay errors={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('should display error messages', () => {
    const errors = [
      { line: 1, column: 5, message: 'Unexpected token' },
      { line: 3, column: 10, message: 'Unknown type "strng"' },
    ];

    render(<ErrorDisplay errors={errors} />);

    expect(screen.getByText(/unexpected token/i)).toBeInTheDocument();
    expect(screen.getByText(/unknown type/i)).toBeInTheDocument();
  });

  it('should show line and column numbers', () => {
    const errors = [{ line: 5, column: 12, message: 'Missing closing brace' }];

    render(<ErrorDisplay errors={errors} />);

    expect(screen.getByText(/line 5/i)).toBeInTheDocument();
    expect(screen.getByText(/column 12/i)).toBeInTheDocument();
  });

  it('should highlight error severity', () => {
    const errors = [
      { line: 1, column: 1, message: 'Error', severity: 'error' as const },
      { line: 2, column: 1, message: 'Warning', severity: 'warning' as const },
    ];

    render(<ErrorDisplay errors={errors} />);

    expect(screen.getByTestId('error-error')).toHaveClass('severity-error');
    expect(screen.getByTestId('error-warning')).toHaveClass('severity-warning');
  });

  it('should be dismissible', async () => {
    const user = userEvent.setup();
    const errors = [{ line: 1, column: 1, message: 'Test error' }];

    render(<ErrorDisplay errors={errors} />);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText(/test error/i)).not.toBeInTheDocument();
  });

  it('should support clicking to jump to error location', async () => {
    const user = userEvent.setup();
    const onErrorClick = vi.fn();
    const errors = [{ line: 10, column: 5, message: 'Error here' }];

    render(<ErrorDisplay errors={errors} onErrorClick={onErrorClick} />);

    await user.click(screen.getByText(/error here/i));

    expect(onErrorClick).toHaveBeenCalledWith({ line: 10, column: 5 });
  });
});

// =============================================================================
// Compiler Integration Tests
// =============================================================================

describe('compileSchema', () => {
  it('should compile valid schema to TypeScript', async () => {
    const result = await compileSchema('User { id: uuid! name: string! }', 'typescript');

    expect(result.success).toBe(true);
    expect(result.output).toContain('interface User');
  });

  it('should compile valid schema to PostgreSQL', async () => {
    const result = await compileSchema('User { id: uuid! name: string! }', 'postgresql');

    expect(result.success).toBe(true);
    expect(result.output).toContain('CREATE TABLE');
    expect(result.output).toContain('UUID');
  });

  it('should return errors for invalid schema', async () => {
    const result = await compileSchema('User { id: unknowntype! }', 'typescript');

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(expect.greaterThan(0));
  });

  it('should include source map for debugging', async () => {
    const result = await compileSchema('User { id: uuid! }', 'typescript');

    expect(result.sourceMap).toBeDefined();
  });
});

// =============================================================================
// Playground Integration Tests
// =============================================================================

describe('Playground', () => {
  it('should render all main components', () => {
    render(<Playground />);

    expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
    expect(screen.getByTestId('output-preview')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /dialect/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('should have default example schema on load', () => {
    render(<Playground />);

    expect(screen.getByText(/User/)).toBeInTheDocument();
  });

  it('should update preview when schema changes', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'Product { id: uuid! price: float! }');

    await waitFor(() => {
      expect(screen.getByText(/Product/)).toBeInTheDocument();
      expect(screen.getByText(/price/)).toBeInTheDocument();
    });
  });

  it('should update preview when dialect changes', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    // Initial TypeScript output
    expect(screen.getByText(/interface/)).toBeInTheDocument();

    // Switch to PostgreSQL
    await user.click(screen.getByRole('combobox', { name: /dialect/i }));
    await user.click(screen.getByRole('option', { name: /postgresql/i }));

    await waitFor(() => {
      expect(screen.getByText(/CREATE TABLE/)).toBeInTheDocument();
    });
  });

  it('should load schema from URL on mount', () => {
    const schema = 'Product { id: uuid! }';
    const url = generateShareUrl(schema, 'mysql');
    const searchParams = new URL(url).searchParams;

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: `?${searchParams.toString()}`,
        href: url,
      },
      writable: true,
    });

    render(<Playground />);

    expect(screen.getByText(/Product/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /dialect/i })).toHaveTextContent(/mysql/i);
  });

  it('should show errors for invalid schemas', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'User { id: invalidtype! }');

    await waitFor(() => {
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
      expect(screen.getByText(/unknown type/i)).toBeInTheDocument();
    });
  });

  it('should have a reset button', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'CustomSchema { field: string! }');

    await user.click(screen.getByRole('button', { name: /reset/i }));

    // Should restore default schema
    expect(screen.queryByText(/CustomSchema/)).not.toBeInTheDocument();
    expect(screen.getByText(/User/)).toBeInTheDocument();
  });

  it('should persist schema to localStorage', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<Playground />);

    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'Test { id: uuid! }');

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        'icetype-playground-schema',
        expect.stringContaining('Test')
      );
    });
  });

  it('should restore schema from localStorage on mount', () => {
    const savedSchema = 'SavedSchema { id: uuid! name: string! }';
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(savedSchema);

    render(<Playground />);

    expect(screen.getByText(/SavedSchema/)).toBeInTheDocument();
  });
});

// =============================================================================
// Responsive Layout Tests
// =============================================================================

describe('Playground responsive layout', () => {
  it('should show side-by-side layout on large screens', () => {
    // Mock large screen
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
    window.dispatchEvent(new Event('resize'));

    render(<Playground />);

    const container = screen.getByTestId('playground-container');
    expect(container).toHaveClass('layout-horizontal');
  });

  it('should show stacked layout on small screens', () => {
    // Mock small screen
    Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });
    window.dispatchEvent(new Event('resize'));

    render(<Playground />);

    const container = screen.getByTestId('playground-container');
    expect(container).toHaveClass('layout-vertical');
  });

  it('should have resizable panels', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    const divider = screen.getByTestId('panel-divider');

    // Simulate drag to resize
    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);

    // Panel width should have changed
    const editorPanel = screen.getByTestId('editor-panel');
    expect(editorPanel.style.width).not.toBe('50%');
  });
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('Playground accessibility', () => {
  it('should have proper ARIA labels', () => {
    render(<Playground />);

    expect(screen.getByRole('textbox', { name: /schema editor/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /output preview/i })).toBeInTheDocument();
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    // Tab through interactive elements
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /example/i }));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /dialect/i }));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /share/i }));
  });

  it('should announce errors to screen readers', async () => {
    const user = userEvent.setup();

    render(<Playground />);

    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'Invalid {{{');

    await waitFor(() => {
      const errorRegion = screen.getByRole('alert');
      expect(errorRegion).toBeInTheDocument();
    });
  });
});
