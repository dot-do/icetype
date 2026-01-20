/**
 * Schema Loader
 *
 * Utility for loading IceType schema files (.ts, .js, .json).
 * Uses jiti for TypeScript loading without requiring pre-compilation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IceTypeSchema } from '@icetype/core';

export interface LoadedSchema {
  name: string;
  schema: IceTypeSchema;
}

export interface LoadResult {
  schemas: LoadedSchema[];
  errors: string[];
}

/**
 * Check if a value looks like an IceTypeSchema
 */
function isIceTypeSchema(value: unknown): value is IceTypeSchema {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.version === 'number' &&
    obj.fields instanceof Map &&
    typeof obj.directives === 'object'
  );
}

/**
 * Load schemas from a JavaScript/TypeScript module
 */
async function loadFromModule(filePath: string): Promise<LoadResult> {
  const schemas: LoadedSchema[] = [];
  const errors: string[] = [];

  try {
    // Try native ESM import first
    const fileUrl = pathToFileURL(resolve(filePath)).href;
    const module = await import(fileUrl);

    // Extract all IceTypeSchema exports
    for (const [exportName, exportValue] of Object.entries(module)) {
      if (isIceTypeSchema(exportValue)) {
        schemas.push({
          name: exportName,
          schema: exportValue,
        });
      }
    }

    if (schemas.length === 0) {
      errors.push(`No IceTypeSchema exports found in ${filePath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // If native import failed for .ts files, suggest using tsx
    if (filePath.endsWith('.ts')) {
      errors.push(
        `Failed to load TypeScript file: ${filePath}\n` +
          `  Error: ${message}\n` +
          `  Tip: Run with 'npx tsx' or compile to .js first:\n` +
          `    npx tsx node_modules/.bin/ice validate --schema ${filePath}\n` +
          `    # or compile first:\n` +
          `    npx tsc ${filePath} && ice validate --schema ${filePath.replace('.ts', '.js')}`
      );
    } else {
      errors.push(`Failed to load module: ${filePath}\n  Error: ${message}`);
    }
  }

  return { schemas, errors };
}

/**
 * Load schemas from a JSON file
 */
async function loadFromJson(filePath: string): Promise<LoadResult> {
  const schemas: LoadedSchema[] = [];
  const errors: string[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // JSON can be a single schema or an object with multiple schemas
    if (isIceTypeSchema(data)) {
      schemas.push({
        name: data.name,
        schema: data,
      });
    } else if (typeof data === 'object' && data !== null) {
      // Check if it's an object containing schemas
      for (const [key, value] of Object.entries(data)) {
        if (isIceTypeSchema(value)) {
          schemas.push({
            name: key,
            schema: value,
          });
        }
      }
    }

    if (schemas.length === 0) {
      errors.push(`No valid IceTypeSchema found in ${filePath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to parse JSON: ${filePath}\n  Error: ${message}`);
  }

  return { schemas, errors };
}

/**
 * Load IceType schemas from a file.
 *
 * Supports:
 * - .ts files (requires tsx runtime or pre-compilation)
 * - .js/.mjs files (native ESM import)
 * - .json files (parsed directly)
 *
 * @param filePath - Path to the schema file
 * @returns LoadResult with schemas and any errors
 */
export async function loadSchemaFile(filePath: string): Promise<LoadResult> {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    return {
      schemas: [],
      errors: [`File not found: ${filePath}`],
    };
  }

  const ext = extname(absolutePath).toLowerCase();

  switch (ext) {
    case '.json':
      return loadFromJson(absolutePath);

    case '.ts':
    case '.js':
    case '.mjs':
      return loadFromModule(absolutePath);

    default:
      return {
        schemas: [],
        errors: [`Unsupported file extension: ${ext}. Use .ts, .js, .mjs, or .json`],
      };
  }
}

/**
 * Load a single schema from a file (first export or only schema).
 *
 * @param filePath - Path to the schema file
 * @returns The first schema found, or throws an error
 */
export async function loadSingleSchema(filePath: string): Promise<IceTypeSchema> {
  const result = await loadSchemaFile(filePath);

  if (result.errors.length > 0) {
    throw new Error(result.errors.join('\n'));
  }

  const firstSchema = result.schemas[0];
  if (!firstSchema) {
    throw new Error(`No schemas found in ${filePath}`);
  }

  return firstSchema.schema;
}

/**
 * Load all schemas from a file.
 *
 * @param filePath - Path to the schema file
 * @returns Array of loaded schemas
 */
export async function loadAllSchemas(filePath: string): Promise<IceTypeSchema[]> {
  const result = await loadSchemaFile(filePath);

  if (result.errors.length > 0) {
    throw new Error(result.errors.join('\n'));
  }

  return result.schemas.map((s) => s.schema);
}
