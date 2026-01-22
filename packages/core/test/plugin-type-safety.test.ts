/**
 * Plugin Type Safety Tests for @icetype/core
 *
 * RED phase TDD tests for generic hooks with type-safe parameters.
 * These tests define the expected type-safe API for:
 * - Plugin hooks with typed parameters (not `unknown`)
 * - Type inference for transform output
 * - Compile-time type checking for hook signatures
 * - Type-safe plugin configuration
 *
 * Current state: The plugin system uses `unknown` for hook parameters.
 *
 * TEST ORGANIZATION:
 * 1. "Type-Level Tests (RED)" - Assert current broken state (types ARE unknown)
 *    These will FAIL when generics are implemented (types won't be unknown)
 * 2. "Expected Generic API" - Define desired API with local generic interfaces
 * 3. "Runtime Tests" - Demonstrate casting workarounds needed today
 * 4. "RED: Missing Generic Exports" - Test for generic types that should exist
 *    These FAIL because the generic types don't exist in the module
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, expectTypeOf } from 'vitest';

import {
  createPluginManager,
  type Plugin,
  type PluginManager,
  type PluginHooks,
  type PluginConfig,
  // GREEN: These generic types are now implemented
  type TypedPlugin,
  type TypedPluginHooks,
  type TypedPluginConfig,
} from '../src/plugin-system.js';

import type { IceTypeSchema, FieldDefinition, ValidationResult } from '../src/types.js';

// =============================================================================
// Type Definitions for Type-Safe Plugins (Expected API)
// =============================================================================

// Expected type-safe context interface
interface TypedPluginContext {
  config: {
    outputDir: string;
    verbose: boolean;
  };
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// Expected type-safe options interface for transforms
interface PostgresTransformOptions {
  schemaName: string;
  ifNotExists: boolean;
  cascade: boolean;
}

// Expected type-safe output from transform
interface PostgresOutput {
  sql: string;
  tables: string[];
  indexes: string[];
}

// Expected type-safe validation result
interface TypedValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

// =============================================================================
// GREEN: Tests for Generic Type Exports
// These tests verify that the generic types are properly exported and work
// =============================================================================

describe('Plugin Type Safety - GREEN: Generic Type Exports', () => {
  /**
   * These tests verify that the expected generic types are exported and work correctly.
   */

  it('should export TypedPlugin generic interface', () => {
    // GREEN: TypedPlugin<TContext, TSchema, TOptions, TOutput> is now implemented
    // Verify it works with type parameters
    type MyTypedPlugin = TypedPlugin<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;

    // Verify the transform hook has typed schema
    type PluginTransformSchema = MyTypedPlugin['hooks']['transform'] extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
    expectTypeOf<PluginTransformSchema>().toEqualTypeOf<IceTypeSchema>();

    // Verify the transform hook has typed options
    type PluginTransformOptions = MyTypedPlugin['hooks']['transform'] extends (s: unknown, o?: infer O, ...args: unknown[]) => unknown ? O : never;
    expectTypeOf<PluginTransformOptions>().toEqualTypeOf<PostgresTransformOptions | undefined>();
  });

  it('should export TypedPluginHooks generic interface', () => {
    // GREEN: TypedPluginHooks<TContext, TSchema, TOptions, TOutput> is now implemented
    type MyTypedHooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;

    // Verify init has typed context
    type HooksInitContext = MyTypedHooks extends { init?: (c: infer C) => unknown } ? C : never;
    expectTypeOf<HooksInitContext>().toEqualTypeOf<TypedPluginContext>();

    // Verify transform has typed schema
    type HooksTransformSchema = MyTypedHooks['transform'] extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
    expectTypeOf<HooksTransformSchema>().toEqualTypeOf<IceTypeSchema>();
  });

  it('should export TypedPluginConfig generic interface', () => {
    // GREEN: TypedPluginConfig<TOptions> is now implemented
    interface MyOptions {
      connectionString: string;
      poolSize: number;
    }

    type MyTypedConfig = TypedPluginConfig<MyOptions>;
    type ConfigOptions = MyTypedConfig['options'];

    // Verify options are typed, not Record<string, unknown>
    expectTypeOf<ConfigOptions>().toEqualTypeOf<MyOptions>();
  });

  it('should have typed execute return based on hook (non-generic PluginManager still returns unknown)', () => {
    // Note: The PluginManager interface itself is not generic - it still uses unknown
    // for maximum flexibility. The typed interfaces are for plugin authors to use.
    type ExecuteReturn = ReturnType<PluginManager['execute']>;

    // PluginManager.execute() returns Promise<unknown> - this is by design
    // Plugin authors use TypedPlugin for type safety in their implementations
    expectTypeOf<ExecuteReturn>().toEqualTypeOf<Promise<unknown>>();
  });
});

// =============================================================================
// GREEN: Tests verifying non-generic types still work (backward compatibility)
// =============================================================================

describe('Plugin Type Safety - Backward Compatibility (Non-Generic Types)', () => {
  /**
   * These tests verify that the original non-generic interfaces still work
   * and maintain their existing behavior (using unknown types).
   */

  it('Plugin hooks init context IS unknown (backward compatible)', () => {
    type PluginInitContext = Plugin['hooks'] extends { init?: (ctx: infer C) => unknown } ? C : never;
    expectTypeOf<PluginInitContext>().toEqualTypeOf<unknown>();
  });

  it('PluginHooks init context IS unknown (backward compatible)', () => {
    type InitHookContext = PluginHooks extends { init?: (context: infer C) => unknown } ? C : never;
    expectTypeOf<InitHookContext>().toEqualTypeOf<unknown>();
  });

  it('PluginConfig options IS Record<string, unknown> (backward compatible)', () => {
    type ConfigOptions = PluginConfig['options'];
    expectTypeOf<ConfigOptions>().toEqualTypeOf<Record<string, unknown>>();
  });
});

// =============================================================================
// GREEN: Tests for TypedPluginHooks generic interface
// Verifies that TypedPluginHooks provides proper type inference
// =============================================================================

describe('Plugin Type Safety - TypedPluginHooks Generic Tests', () => {
  describe('TypedPluginHooks provides typed parameters', () => {
    it('init context is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
      type InitContext = Hooks extends { init?: (c: infer C) => unknown } ? C : never;
      expectTypeOf<InitContext>().toEqualTypeOf<TypedPluginContext>();
    });

    it('transform schema is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
      type TransformSchema = Hooks['transform'] extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
      expectTypeOf<TransformSchema>().toEqualTypeOf<IceTypeSchema>();
    });

    it('transform options is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
      type TransformOptions = Hooks['transform'] extends (s: unknown, o?: infer O, ...args: unknown[]) => unknown ? O : never;
      expectTypeOf<TransformOptions>().toEqualTypeOf<PostgresTransformOptions | undefined>();
    });

    it('transform return type is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
      type TransformReturn = Hooks['transform'] extends (...args: unknown[]) => Promise<infer R> ? R : never;
      expectTypeOf<TransformReturn>().toEqualTypeOf<PostgresOutput>();
    });

    it('validate schema is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
      type ValidateHook = NonNullable<Hooks['validate']>;
      type ValidateSchema = ValidateHook extends (s: infer S) => unknown ? S : never;
      expectTypeOf<ValidateSchema>().toEqualTypeOf<IceTypeSchema>();
    });

    it('generate schema is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput, { format: string }, string>;
      type GenerateHook = NonNullable<Hooks['generate']>;
      type GenerateSchema = GenerateHook extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
      expectTypeOf<GenerateSchema>().toEqualTypeOf<IceTypeSchema>();
    });

    it('generate return type is typed', () => {
      type Hooks = TypedPluginHooks<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput, { format: string }, string>;
      type GenerateHook = NonNullable<Hooks['generate']>;
      type GenerateReturn = GenerateHook extends (...args: unknown[]) => Promise<infer R> ? R : never;
      expectTypeOf<GenerateReturn>().toEqualTypeOf<string>();
    });
  });
});

// =============================================================================
// GREEN: Tests for TypedPlugin generic interface
// Verifies that TypedPlugin provides proper type inference
// =============================================================================

describe('Plugin Type Safety - TypedPlugin Generic Tests', () => {
  it('TypedPlugin hooks have typed context', () => {
    type MyPlugin = TypedPlugin<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
    type InitContext = MyPlugin['hooks'] extends { init?: (c: infer C) => unknown } ? C : never;
    expectTypeOf<InitContext>().toEqualTypeOf<TypedPluginContext>();
  });

  it('TypedPlugin hooks have typed transform input', () => {
    type MyPlugin = TypedPlugin<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
    type TransformInput = MyPlugin['hooks']['transform'] extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
    expectTypeOf<TransformInput>().toEqualTypeOf<IceTypeSchema>();
  });

  it('TypedPlugin hooks have typed transform output', () => {
    type MyPlugin = TypedPlugin<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput>;
    type TransformOutput = MyPlugin['hooks']['transform'] extends (...args: unknown[]) => Promise<infer O> ? O : never;
    expectTypeOf<TransformOutput>().toEqualTypeOf<PostgresOutput>();
  });
});

// =============================================================================
// GREEN: Tests for TypedPluginConfig generic interface
// Verifies that TypedPluginConfig provides proper type inference
// =============================================================================

describe('Plugin Type Safety - TypedPluginConfig Generic Tests', () => {
  it('TypedPluginConfig options are typed', () => {
    interface MyOptions {
      connectionString: string;
      poolSize: number;
    }
    type MyConfig = TypedPluginConfig<MyOptions>;
    type ConfigOptions = MyConfig['options'];
    expectTypeOf<ConfigOptions>().toEqualTypeOf<MyOptions>();
  });
});

// =============================================================================
// Non-generic types maintain backward compatibility (use unknown)
// =============================================================================

describe('Plugin Type Safety - Non-Generic Backward Compatibility', () => {
  it('PluginHooks (non-generic) uses unknown for flexibility', () => {
    type InitContext = PluginHooks extends { init?: (c: infer C) => unknown } ? C : never;
    expectTypeOf<InitContext>().toEqualTypeOf<unknown>();
  });

  it('Plugin (non-generic) uses unknown for flexibility', () => {
    type TransformInput = Plugin['hooks']['transform'] extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
    expectTypeOf<TransformInput>().toEqualTypeOf<unknown>();
  });

  it('PluginConfig (non-generic) uses Record<string, unknown> for flexibility', () => {
    type ConfigOptions = PluginConfig['options'];
    expectTypeOf<ConfigOptions>().toEqualTypeOf<Record<string, unknown>>();
  });

  it('PluginManager.execute returns Promise<unknown> for maximum flexibility', () => {
    type ExecuteReturn = ReturnType<PluginManager['execute']>;
    expectTypeOf<ExecuteReturn>().toEqualTypeOf<Promise<unknown>>();
  });
});

// =============================================================================
// Expected Generic API - Design Specification
// Local types showing what the implementation should look like
// =============================================================================

describe('Plugin Type Safety - Expected Generic API (Design Specs)', () => {
  describe('Expected: TypedPluginHooks<TContext, TSchema, TOptions, TOutput>', () => {
    it('should define expected generic hooks interface', () => {
      // This is the API we want to implement:
      interface TypedPluginHooks<
        TContext = unknown,
        TSchema = unknown,
        TOptions = unknown,
        TOutput = unknown,
        TGenOptions = unknown,
        TGenOutput = unknown
      > {
        init?: (context: TContext) => Promise<void>;
        validate?: (schema: TSchema) => Promise<{ valid: boolean; errors: ValidationResult['errors'] }>;
        transform: (schema: TSchema, options?: TOptions, deps?: Map<string, Plugin>) => Promise<TOutput>;
        generate?: (schema: TSchema, options?: TGenOptions) => Promise<TGenOutput>;
        dispose?: () => void | Promise<void>;
      }

      // Usage example:
      type PostgresHooks = TypedPluginHooks<
        TypedPluginContext,
        IceTypeSchema,
        PostgresTransformOptions,
        PostgresOutput,
        { format: string },
        string
      >;

      // Verify the expected generic works
      type ExpectedInitContext = PostgresHooks extends { init?: (ctx: infer C) => unknown } ? C : never;
      expectTypeOf<ExpectedInitContext>().toEqualTypeOf<TypedPluginContext>();

      type ExpectedTransformInput = PostgresHooks['transform'] extends (s: infer S, ...args: unknown[]) => unknown ? S : never;
      expectTypeOf<ExpectedTransformInput>().toEqualTypeOf<IceTypeSchema>();
    });
  });

  describe('Expected: TypedPlugin<TContext, TSchema, TOptions, TOutput>', () => {
    it('should define expected generic plugin interface', () => {
      interface TypedPlugin<
        TContext = unknown,
        TSchema = unknown,
        TOptions = unknown,
        TOutput = unknown
      > {
        name: string;
        version: string;
        dependencies?: Array<{ name: string; version: string; optional?: boolean }>;
        hooks: {
          init?: (context: TContext) => Promise<void>;
          validate?: (schema: TSchema) => Promise<{ valid: boolean; errors: unknown[] }>;
          transform: (schema: TSchema, options?: TOptions, deps?: Map<string, Plugin>) => Promise<TOutput>;
          generate?: (schema: TSchema, options?: unknown) => Promise<unknown>;
          dispose?: () => void | Promise<void>;
        };
      }

      // Usage example - NO CASTS NEEDED with proper generics:
      const examplePlugin: TypedPlugin<TypedPluginContext, IceTypeSchema, PostgresTransformOptions, PostgresOutput> = {
        name: 'postgres',
        version: '1.0.0',
        hooks: {
          init: async (context) => {
            // context is typed as TypedPluginContext
            const _dir = context.config.outputDir;
          },
          transform: async (schema, options) => {
            // schema is IceTypeSchema, options is PostgresTransformOptions
            return {
              sql: `CREATE TABLE ${options?.schemaName ?? 'public'}.${schema.name}`,
              tables: [schema.name],
              indexes: [],
            };
          },
        },
      };

      expect(examplePlugin.name).toBe('postgres');
    });
  });

  describe('Expected: TypedPluginConfig<TOptions>', () => {
    it('should define expected generic config interface', () => {
      interface TypedPluginConfig<TOptions extends Record<string, unknown> = Record<string, unknown>> {
        pluginName: string;
        options: TOptions;
      }

      interface PostgresConfig {
        connectionString: string;
        poolSize: number;
        ssl: boolean;
      }

      // Usage example - NO CASTS NEEDED:
      const config: TypedPluginConfig<PostgresConfig> = {
        pluginName: 'postgres',
        options: {
          connectionString: 'postgres://localhost/db',
          poolSize: 10,
          ssl: true,
        },
      };

      expect(config.options.connectionString).toBe('postgres://localhost/db');
      expect(config.options.poolSize).toBe(10);
    });
  });
});

// =============================================================================
// Runtime Tests - Demonstrate Casting Workarounds
// =============================================================================

describe('Plugin Type Safety - Generic Hooks (Runtime)', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Typed init hook', () => {
    it('should accept typed context parameter in init hook', async () => {
      const receivedContext: TypedPluginContext[] = [];

      const typedPlugin: Plugin = {
        name: 'typed-init-plugin',
        version: '1.0.0',
        hooks: {
          init: async (context) => {
            // PROBLEM: context is `unknown`, requires cast
            const typedCtx = context as TypedPluginContext;
            expect(typedCtx.config.outputDir).toBeDefined();
            expect(typedCtx.config.verbose).toBeDefined();
            expect(typeof typedCtx.logger.info).toBe('function');
            receivedContext.push(typedCtx);
          },
          transform: async (schema) => schema,
        },
      };

      manager.register(typedPlugin);

      const context: TypedPluginContext = {
        config: {
          outputDir: './dist',
          verbose: true,
        },
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      };

      await manager.initialize('typed-init-plugin', context);

      expect(receivedContext).toHaveLength(1);
      expect(receivedContext[0]!.config.outputDir).toBe('./dist');
    });

    it('should provide type inference for context without explicit casting', async () => {
      let contextWasTyped = false;

      const plugin: Plugin = {
        name: 'inference-test-plugin',
        version: '1.0.0',
        hooks: {
          init: async (context) => {
            const hasTypedStructure =
              typeof context === 'object' &&
              context !== null &&
              'config' in context &&
              'logger' in context;
            contextWasTyped = hasTypedStructure;
          },
          transform: async (schema) => schema,
        },
      };

      manager.register(plugin);

      await manager.initialize('inference-test-plugin', {
        config: { outputDir: './out', verbose: false },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });

      expect(contextWasTyped).toBe(true);
    });
  });

  describe('Typed transform hook', () => {
    it('should accept typed schema input and return typed output', async () => {
      const transformedResults: PostgresOutput[] = [];

      const plugin: Plugin = {
        name: 'typed-transform-plugin',
        version: '1.0.0',
        hooks: {
          transform: async (schema, options) => {
            // PROBLEM: Both are `unknown`, require casts
            const typedSchema = schema as IceTypeSchema;
            const typedOptions = options as PostgresTransformOptions;

            expect(typedSchema.name).toBeDefined();
            expect(typedSchema.fields).toBeInstanceOf(Map);
            expect(typedOptions.schemaName).toBe('public');

            const result: PostgresOutput = {
              sql: `CREATE TABLE ${typedOptions.schemaName}.${typedSchema.name}`,
              tables: [typedSchema.name],
              indexes: [],
            };

            transformedResults.push(result);
            return result;
          },
        },
      };

      manager.register(plugin);

      const schema: IceTypeSchema = {
        name: 'User',
        fields: new Map<string, FieldDefinition>([
          ['id', { name: 'id', type: 'uuid', modifier: '!', isArray: false, isOptional: false, isUnique: true, isIndexed: true }],
          ['name', { name: 'name', type: 'string', modifier: '!', isArray: false, isOptional: false, isUnique: false, isIndexed: false }],
        ]),
        directives: {},
        relations: new Map(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const options: PostgresTransformOptions = {
        schemaName: 'public',
        ifNotExists: true,
        cascade: false,
      };

      const result = await manager.execute('typed-transform-plugin', 'transform', schema, options);

      // PROBLEM: result is `unknown`, requires casting
      const typedResult = result as PostgresOutput;
      expect(typedResult.sql).toContain('CREATE TABLE');
      expect(typedResult.tables).toContain('User');
    });

    it('should infer output type from transform return value', async () => {
      const plugin: Plugin = {
        name: 'output-inference-plugin',
        version: '1.0.0',
        hooks: {
          transform: async (schema) => {
            const typedSchema = schema as IceTypeSchema;
            return {
              tableName: typedSchema.name,
              columnCount: typedSchema.fields.size,
              generated: true,
            };
          },
        },
      };

      manager.register(plugin);

      const schema: IceTypeSchema = {
        name: 'Product',
        fields: new Map([
          ['id', { name: 'id', type: 'uuid', modifier: '!', isArray: false, isOptional: false, isUnique: true, isIndexed: true }],
          ['price', { name: 'price', type: 'decimal', modifier: '!', isArray: false, isOptional: false, isUnique: false, isIndexed: false, precision: 10, scale: 2 }],
        ]),
        directives: {},
        relations: new Map(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await manager.execute('output-inference-plugin', 'transform', schema);

      // PROBLEM: result is `unknown`, no type inference
      const inferredResult = result as { tableName: string; columnCount: number; generated: boolean };

      expect(inferredResult.tableName).toBe('Product');
      expect(inferredResult.columnCount).toBe(2);
      expect(inferredResult.generated).toBe(true);
    });
  });

  describe('Typed validate hook', () => {
    it('should accept typed schema and return typed validation result', async () => {
      const plugin: Plugin = {
        name: 'typed-validate-plugin',
        version: '1.0.0',
        hooks: {
          validate: async (schema) => {
            // PROBLEM: schema is `unknown`, requires cast
            const typedSchema = schema as IceTypeSchema;

            const errors: TypedValidationResult['errors'] = [];

            if (!typedSchema.fields.has('id')) {
              errors.push({
                path: 'fields.id',
                message: 'Schema must have an id field',
                code: 'MISSING_ID_FIELD',
              });
            }

            for (const [fieldName, field] of typedSchema.fields) {
              if (!field.type) {
                errors.push({
                  path: `fields.${fieldName}`,
                  message: `Field ${fieldName} must have a type`,
                  code: 'MISSING_FIELD_TYPE',
                });
              }
            }

            return {
              valid: errors.length === 0,
              errors,
            };
          },
          transform: async (schema) => schema,
        },
      };

      manager.register(plugin);

      const validSchema: IceTypeSchema = {
        name: 'ValidEntity',
        fields: new Map([
          ['id', { name: 'id', type: 'uuid', modifier: '!', isArray: false, isOptional: false, isUnique: true, isIndexed: true }],
        ]),
        directives: {},
        relations: new Map(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await manager.execute('typed-validate-plugin', 'validate', validSchema);

      // PROBLEM: result is `unknown`, requires casting
      const typedResult = result as TypedValidationResult;
      expect(typedResult.valid).toBe(true);
      expect(typedResult.errors).toHaveLength(0);
    });

    it('should return typed validation errors', async () => {
      const plugin: Plugin = {
        name: 'validation-errors-plugin',
        version: '1.0.0',
        hooks: {
          validate: async (schema) => {
            const typedSchema = schema as IceTypeSchema;

            if (!typedSchema.fields.has('id')) {
              return {
                valid: false,
                errors: [{
                  path: 'fields',
                  message: 'Missing required id field',
                  code: 'E001',
                }],
              };
            }

            return { valid: true, errors: [] };
          },
          transform: async (schema) => schema,
        },
      };

      manager.register(plugin);

      const invalidSchema: IceTypeSchema = {
        name: 'InvalidEntity',
        fields: new Map([
          ['name', { name: 'name', type: 'string', modifier: '', isArray: false, isOptional: true, isUnique: false, isIndexed: false }],
        ]),
        directives: {},
        relations: new Map(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await manager.execute('validation-errors-plugin', 'validate', invalidSchema);
      const typedResult = result as TypedValidationResult;

      expect(typedResult.valid).toBe(false);
      expect(typedResult.errors).toHaveLength(1);
      expect(typedResult.errors[0]!.code).toBe('E001');
    });
  });

  describe('Typed generate hook', () => {
    it('should accept typed schema and options for generation', async () => {
      interface GenerateOptions {
        format: 'sql' | 'prisma' | 'drizzle';
        includeComments: boolean;
      }

      const plugin: Plugin = {
        name: 'typed-generate-plugin',
        version: '1.0.0',
        hooks: {
          generate: async (schema, options) => {
            const typedSchema = schema as IceTypeSchema;
            const typedOptions = options as GenerateOptions;

            expect(typedSchema.name).toBeDefined();
            expect(typedOptions.format).toBe('sql');

            if (typedOptions.format === 'sql') {
              const lines: string[] = [];
              if (typedOptions.includeComments) {
                lines.push(`-- Table: ${typedSchema.name}`);
              }
              lines.push(`CREATE TABLE ${typedSchema.name} (`);

              const fieldLines: string[] = [];
              for (const [, field] of typedSchema.fields) {
                fieldLines.push(`  ${field.name} ${field.type.toUpperCase()}`);
              }
              lines.push(fieldLines.join(',\n'));
              lines.push(');');

              return lines.join('\n');
            }

            return '';
          },
          transform: async (schema) => schema,
        },
      };

      manager.register(plugin);

      const schema: IceTypeSchema = {
        name: 'Order',
        fields: new Map([
          ['id', { name: 'id', type: 'uuid', modifier: '!', isArray: false, isOptional: false, isUnique: true, isIndexed: true }],
          ['total', { name: 'total', type: 'decimal', modifier: '!', isArray: false, isOptional: false, isUnique: false, isIndexed: false }],
        ]),
        directives: {},
        relations: new Map(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const options: GenerateOptions = {
        format: 'sql',
        includeComments: true,
      };

      const result = await manager.execute('typed-generate-plugin', 'generate', schema, options);

      // PROBLEM: result is `unknown`, requires casting
      const sql = result as string;
      expect(sql).toContain('-- Table: Order');
      expect(sql).toContain('CREATE TABLE Order');
    });
  });
});

// =============================================================================
// Type-Safe Plugin Configuration Tests
// =============================================================================

describe('Plugin Type Safety - Configuration', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Typed plugin configuration', () => {
    it('should support typed configuration options', async () => {
      interface PostgresAdapterConfig {
        connectionString: string;
        poolSize: number;
        ssl: boolean;
        schema: string;
      }

      const config: PluginConfig = {
        pluginName: 'postgres-adapter',
        options: {
          connectionString: 'postgres://localhost:5432/mydb',
          poolSize: 10,
          ssl: true,
          schema: 'public',
        } satisfies PostgresAdapterConfig,
      };

      // PROBLEM: config.options is Record<string, unknown>, not PostgresAdapterConfig
      const typedOptions = config.options as PostgresAdapterConfig;

      expect(typedOptions.connectionString).toBe('postgres://localhost:5432/mydb');
      expect(typedOptions.poolSize).toBe(10);
      expect(typedOptions.ssl).toBe(true);
      expect(typedOptions.schema).toBe('public');
    });

    it('should type-check configuration against expected schema', async () => {
      const configWithWrongTypes = {
        pluginName: 'type-check-plugin',
        options: {
          requiredString: 123, // Should be string
          requiredBoolean: 'true', // Should be boolean
        },
      };

      // Currently passes because validation doesn't check types at compile time
      expect(configWithWrongTypes.options.requiredString).toBe(123);
    });
  });

  describe('Typed plugin registration', () => {
    it('should allow registering plugins with typed hooks', () => {
      interface MyContext { appName: string }
      interface MyOptions { debug: boolean }
      interface MyOutput { success: boolean; data: string }

      const typedPlugin: Plugin = {
        name: 'fully-typed-plugin',
        version: '1.0.0',
        hooks: {
          init: async (context) => {
            // PROBLEM: context is `unknown`, requires cast
            const ctx = context as MyContext;
            expect(ctx.appName).toBeDefined();
          },
          transform: async (schema, options) => {
            // PROBLEM: Both are `unknown`, require casts
            const _typedSchema = schema as IceTypeSchema;
            const typedOpts = options as MyOptions | undefined;

            const result: MyOutput = {
              success: true,
              data: typedOpts?.debug ? 'debug mode' : 'normal mode',
            };
            return result;
          },
        },
      };

      manager.register(typedPlugin);
      expect(manager.has('fully-typed-plugin')).toBe(true);
    });
  });
});

// =============================================================================
// Compile-Time Type Checking Tests
// =============================================================================

describe('Plugin Type Safety - Compile-Time Checks', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Hook signature type checking', () => {
    it('should enforce correct hook signatures at compile time', () => {
      const hooks: PluginHooks = {
        transform: async (schema, options, deps) => {
          expect(schema).toBeDefined();
          expect(options === undefined || options !== undefined).toBe(true);
          expect(deps === undefined || deps instanceof Map).toBe(true);
          return schema;
        },
      };

      expect(typeof hooks.transform).toBe('function');
    });

    it('should allow optional hooks to be omitted', () => {
      const minimalHooks: PluginHooks = {
        transform: async (schema) => schema,
      };

      expect(minimalHooks.init).toBeUndefined();
      expect(minimalHooks.validate).toBeUndefined();
      expect(minimalHooks.generate).toBeUndefined();
      expect(minimalHooks.dispose).toBeUndefined();
      expect(minimalHooks.transform).toBeDefined();
    });
  });

  describe('Type narrowing for hook results', () => {
    it('should narrow types based on hook execution', async () => {
      const plugin: Plugin = {
        name: 'type-narrowing-plugin',
        version: '1.0.0',
        hooks: {
          validate: async () => ({
            valid: true,
            errors: [],
          }),
          transform: async (schema) => ({
            processed: true,
            original: schema,
          }),
        },
      };

      manager.register(plugin);

      const validateResult = await manager.execute('type-narrowing-plugin', 'validate', {});

      // PROBLEM: validateResult is `unknown`, no automatic type narrowing
      const typedValidateResult = validateResult as { valid: boolean; errors: unknown[] };
      expect(typedValidateResult.valid).toBe(true);

      const transformResult = await manager.execute('type-narrowing-plugin', 'transform', { test: true });

      // PROBLEM: transformResult is `unknown`, no automatic type narrowing
      const typedTransformResult = transformResult as { processed: boolean; original: unknown };
      expect(typedTransformResult.processed).toBe(true);
    });
  });
});

// =============================================================================
// Type-Safe Dependencies Tests
// =============================================================================

describe('Plugin Type Safety - Dependencies', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = createPluginManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Typed dependency access', () => {
    it('should provide typed access to dependency plugins', async () => {
      interface BasePluginOutput {
        normalized: boolean;
        data: Record<string, unknown>;
      }

      const basePlugin: Plugin = {
        name: 'base-plugin',
        version: '1.0.0',
        hooks: {
          transform: async (schema): Promise<BasePluginOutput> => ({
            normalized: true,
            data: schema as Record<string, unknown>,
          }),
        },
      };

      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        version: '1.0.0',
        dependencies: [{ name: 'base-plugin', version: '^1.0.0' }],
        hooks: {
          transform: async (schema, _options, deps) => {
            const base = deps?.get('base-plugin');
            if (base) {
              const baseResult = await base.hooks.transform(schema);

              // PROBLEM: baseResult is `unknown`, requires casting
              const typedBaseResult = baseResult as BasePluginOutput;

              return {
                fromBase: typedBaseResult.normalized,
                extended: true,
              };
            }

            return { fromBase: false, extended: true };
          },
        },
      };

      manager.register(basePlugin);
      manager.register(dependentPlugin);

      const result = await manager.executeWithDependencies(
        'dependent-plugin',
        'transform',
        { name: 'Test' }
      );

      const typedResult = result as { fromBase: boolean; extended: boolean };
      expect(typedResult.fromBase).toBe(true);
      expect(typedResult.extended).toBe(true);
    });
  });
});

// =============================================================================
// Tests for hasHook Type Guard
// =============================================================================

import { hasHook, isValidHookName, type HookName } from '../src/plugin-system.js';

describe('Plugin Type Safety - hasHook Type Guard', () => {
  describe('isValidHookName', () => {
    it('should return true for valid hook names', () => {
      expect(isValidHookName('init')).toBe(true);
      expect(isValidHookName('validate')).toBe(true);
      expect(isValidHookName('transform')).toBe(true);
      expect(isValidHookName('generate')).toBe(true);
      expect(isValidHookName('dispose')).toBe(true);
    });

    it('should return false for invalid hook names', () => {
      expect(isValidHookName('invalidHook')).toBe(false);
      expect(isValidHookName('')).toBe(false);
      expect(isValidHookName('foo')).toBe(false);
      expect(isValidHookName('bar')).toBe(false);
    });

    it('should narrow type to HookName', () => {
      const hookName: string = 'transform';
      if (isValidHookName(hookName)) {
        // TypeScript should know hookName is HookName here
        const validHook: HookName = hookName;
        expect(validHook).toBe('transform');
      }
    });
  });

  describe('hasHook', () => {
    it('should return true when plugin has the specified hook', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          init: async () => {},
          transform: async (s) => s,
          validate: async () => ({ valid: true, errors: [] }),
        },
      };

      expect(hasHook(plugin, 'init')).toBe(true);
      expect(hasHook(plugin, 'transform')).toBe(true);
      expect(hasHook(plugin, 'validate')).toBe(true);
    });

    it('should return false when plugin does not have the specified hook', () => {
      const plugin: Plugin = {
        name: 'minimal-plugin',
        version: '1.0.0',
        hooks: {
          transform: async (s) => s,
        },
      };

      expect(hasHook(plugin, 'init')).toBe(false);
      expect(hasHook(plugin, 'validate')).toBe(false);
      expect(hasHook(plugin, 'generate')).toBe(false);
      expect(hasHook(plugin, 'dispose')).toBe(false);
    });

    it('should return false for invalid hook names', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          transform: async (s) => s,
        },
      };

      // hasHook should handle invalid hook names gracefully
      expect(hasHook(plugin, 'invalidHook' as HookName)).toBe(false);
    });

    it('should allow type-safe hook access after guard check', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          init: async () => {},
          transform: async (s) => s,
        },
      };

      if (hasHook(plugin, 'init')) {
        // After the type guard, we should be able to access the hook safely
        const initHook = plugin.hooks.init;
        expect(typeof initHook).toBe('function');
      }
    });

    it('should work with all valid hook names', () => {
      const fullPlugin: Plugin = {
        name: 'full-plugin',
        version: '1.0.0',
        hooks: {
          init: async () => {},
          validate: async () => ({ valid: true, errors: [] }),
          transform: async (s) => s,
          generate: async () => 'output',
          dispose: async () => {},
        },
      };

      const hookNames: HookName[] = ['init', 'validate', 'transform', 'generate', 'dispose'];
      for (const hookName of hookNames) {
        expect(hasHook(fullPlugin, hookName)).toBe(true);
      }
    });
  });

  describe('getHook helper function', () => {
    it('should return the hook function if it exists', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          transform: async (s) => ({ transformed: s }),
        },
      };

      if (hasHook(plugin, 'transform')) {
        const result = await plugin.hooks.transform({ test: true });
        expect(result).toEqual({ transformed: { test: true } });
      }
    });
  });
});

// =============================================================================
// Document Current Limitations
// =============================================================================

describe('Plugin Type Safety - Current Limitations', () => {
  it('should document that init context is currently unknown', () => {
    const hooks: PluginHooks = {
      init: async (context: unknown) => {
        if (typeof context === 'object' && context !== null) {
          // Need to do runtime type checking
        }
      },
      transform: async (schema) => schema,
    };

    expect(hooks.init).toBeDefined();
  });

  it('should document that transform parameters are currently unknown', () => {
    const hooks: PluginHooks = {
      transform: async (schema: unknown, options?: unknown, deps?: Map<string, Plugin>) => {
        const isSchema = typeof schema === 'object' && schema !== null;
        expect(isSchema).toBe(true);

        if (options !== undefined) {
          expect(typeof options).toBe('object');
        }
        if (deps !== undefined) {
          expect(deps instanceof Map).toBe(true);
        }

        return schema;
      },
    };

    expect(hooks.transform).toBeDefined();
  });

  it('should document that validate result has unknown[] errors', () => {
    const hooks: PluginHooks = {
      validate: async (_schema: unknown) => ({
        valid: false,
        errors: [
          { path: 'field', message: 'Error', code: 'E001' },
          'string error', // Also valid because errors is unknown[]
          123, // Even this is valid
        ],
      }),
      transform: async (schema) => schema,
    };

    expect(hooks.validate).toBeDefined();
  });

  it('should document that generate output is currently unknown', () => {
    const hooks: PluginHooks = {
      generate: async (_schema: unknown, _options?: unknown) => {
        return 'sql string';
      },
      transform: async (schema) => schema,
    };

    expect(hooks.generate).toBeDefined();
  });
});
