/**
 * @icetype/playground
 *
 * Interactive web playground for IceType schemas.
 *
 * Provides a browser-compatible API for:
 * - Schema parsing with real-time validation
 * - TypeScript type generation preview
 * - SQL generation for multiple dialects
 * - Shareable URL generation
 *
 * @example
 * ```typescript
 * import { Playground } from '@icetype/playground';
 *
 * const playground = new Playground();
 *
 * // Parse a schema
 * const result = playground.parseSchema(`{
 *   $type: 'User',
 *   id: 'uuid!',
 *   email: 'string#',
 * }`);
 *
 * if (result.success) {
 *   // Generate TypeScript types
 *   const types = playground.generateTypes(result.schema);
 *   console.log(types.code);
 *
 *   // Generate SQL
 *   const sql = playground.generateSql(result.schema, 'postgres');
 *   console.log(sql.sql);
 * }
 * ```
 *
 * @packageDocumentation
 */

// TODO: Implement in GREEN phase (icetype-pxp.14)
// This is the RED phase - tests are written but implementation is pending

/**
 * Playground class - to be implemented in GREEN phase
 *
 * @throws {Error} Not yet implemented
 */
export class Playground {
  constructor() {
    throw new Error('Playground not yet implemented - see icetype-pxp.14 for GREEN phase');
  }
}
