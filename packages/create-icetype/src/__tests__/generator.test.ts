/**
 * create-icetype Generator Tests
 *
 * Tests for the project scaffolding CLI that creates new IceType projects.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 *
 * Expected usage:
 *   npx create-icetype my-app
 *   npx create-icetype my-app --template with-postgres
 *   npx create-icetype my-app --template with-drizzle
 *
 * Coverage targets:
 * - Test creates directory with project name
 * - Test generates package.json with icetype dependency
 * - Test generates tsconfig.json
 * - Test generates example schema.ts
 * - Test generates .gitignore
 * - Test --template flag (basic, with-postgres, with-drizzle)
 * - Test interactive prompts for missing args
 * - Test error handling for existing directory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createProject, promptForOptions, main, type CreateOptions } from '../index.js'

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
  }
})

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

// =============================================================================
// Directory Creation Tests
// =============================================================================

describe('create-icetype', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // Directory Creation Tests
  // ===========================================================================

  describe('directory creation', () => {
    it('should create a directory with the project name', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('my-app'),
        expect.objectContaining({ recursive: true })
      )
      expect(result.success).toBe(true)
      expect(result.projectPath).toContain('my-app')
    })

    it('should create nested directories when path contains slashes', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'projects/nested/my-app',
        template: 'basic',
      })

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('projects/nested/my-app'),
        expect.objectContaining({ recursive: true })
      )
      expect(result.success).toBe(true)
    })

    it('should fail if directory already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['some-file.txt'] as unknown as fs.Dirent[])

      const result = await createProject({
        projectName: 'existing-dir',
        template: 'basic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('should allow creating project in empty existing directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([])
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'empty-dir',
        template: 'basic',
      })

      expect(result.success).toBe(true)
    })
  })

  // ===========================================================================
  // package.json Generation Tests
  // ===========================================================================

  describe('package.json generation', () => {
    it('should generate package.json with icetype dependency', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      expect(packageJsonCall).toBeDefined()
      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.dependencies).toHaveProperty('@icetype/core')
    })

    it('should set project name in package.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-awesome-app',
        template: 'basic',
      })

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.name).toBe('my-awesome-app')
    })

    it('should set type: module in package.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.type).toBe('module')
    })

    it('should include typescript as devDependency', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.devDependencies).toHaveProperty('typescript')
    })

    it('should include build and dev scripts', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.scripts).toHaveProperty('build')
      expect(content.scripts).toHaveProperty('dev')
    })
  })

  // ===========================================================================
  // tsconfig.json Generation Tests
  // ===========================================================================

  describe('tsconfig.json generation', () => {
    it('should generate tsconfig.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const tsconfigCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('tsconfig.json')
      )

      expect(tsconfigCall).toBeDefined()
      expect(result.filesCreated).toContain('tsconfig.json')
    })

    it('should set target to ES2022 in tsconfig.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const tsconfigCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('tsconfig.json')
      )

      const content = JSON.parse(String(tsconfigCall?.[1]))
      expect(content.compilerOptions.target).toBe('ES2022')
    })

    it('should set module to NodeNext in tsconfig.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const tsconfigCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('tsconfig.json')
      )

      const content = JSON.parse(String(tsconfigCall?.[1]))
      expect(content.compilerOptions.module).toBe('NodeNext')
    })

    it('should enable strict mode in tsconfig.json', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const tsconfigCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('tsconfig.json')
      )

      const content = JSON.parse(String(tsconfigCall?.[1]))
      expect(content.compilerOptions.strict).toBe(true)
    })
  })

  // ===========================================================================
  // schema.ts Generation Tests
  // ===========================================================================

  describe('schema.ts generation', () => {
    it('should generate example schema.ts', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const schemaCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('schema.ts')
      )

      expect(schemaCall).toBeDefined()
      expect(result.filesCreated).toContain('schema.ts')
    })

    it('should import from @icetype/core in schema.ts', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const schemaCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('schema.ts')
      )

      const content = String(schemaCall?.[1])
      expect(content).toContain('@icetype/core')
    })

    it('should include example User schema', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const schemaCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('schema.ts')
      )

      const content = String(schemaCall?.[1])
      expect(content).toContain('User')
    })

    it('should include example Post schema', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const schemaCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('schema.ts')
      )

      const content = String(schemaCall?.[1])
      expect(content).toContain('Post')
    })

    it('should include IceType field modifiers in schema example', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const schemaCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('schema.ts')
      )

      const content = String(schemaCall?.[1])
      // Should include field modifiers like ! for required, ? for optional
      expect(content).toMatch(/[!?#]/)
    })
  })

  // ===========================================================================
  // .gitignore Generation Tests
  // ===========================================================================

  describe('.gitignore generation', () => {
    it('should generate .gitignore', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const gitignoreCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('.gitignore')
      )

      expect(gitignoreCall).toBeDefined()
      expect(result.filesCreated).toContain('.gitignore')
    })

    it('should include node_modules in .gitignore', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const gitignoreCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('.gitignore')
      )

      const content = String(gitignoreCall?.[1])
      expect(content).toContain('node_modules')
    })

    it('should include dist in .gitignore', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const gitignoreCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('.gitignore')
      )

      const content = String(gitignoreCall?.[1])
      expect(content).toContain('dist')
    })

    it('should include .env in .gitignore', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const gitignoreCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('.gitignore')
      )

      const content = String(gitignoreCall?.[1])
      expect(content).toContain('.env')
    })
  })

  // ===========================================================================
  // Template Flag Tests
  // ===========================================================================

  describe('--template flag', () => {
    describe('basic template', () => {
      it('should use basic template by default', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'basic',
        })

        const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('package.json')
        )

        const content = JSON.parse(String(packageJsonCall?.[1]))
        // Basic template should include icetype/core
        expect(content.dependencies).toHaveProperty('@icetype/core')
        // Basic template should NOT include postgres adapter
        expect(content.dependencies).not.toHaveProperty('@icetype/postgres')
      })

      it('should include @icetype/sqlite in basic template', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'basic',
        })

        const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('package.json')
        )

        const content = JSON.parse(String(packageJsonCall?.[1]))
        expect(content.dependencies).toHaveProperty('@icetype/sqlite')
      })
    })

    describe('with-postgres template', () => {
      it('should include @icetype/postgres dependency', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'with-postgres',
        })

        const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('package.json')
        )

        const content = JSON.parse(String(packageJsonCall?.[1]))
        expect(content.dependencies).toHaveProperty('@icetype/postgres')
      })

      it('should include postgres connection example in schema', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'with-postgres',
        })

        const schemaCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('schema.ts')
        )

        const content = String(schemaCall?.[1])
        expect(content).toContain('@icetype/postgres')
      })

      it('should generate .env.example with DATABASE_URL', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        const result = await createProject({
          projectName: 'my-app',
          template: 'with-postgres',
        })

        const envCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('.env.example')
        )

        expect(envCall).toBeDefined()
        const content = String(envCall?.[1])
        expect(content).toContain('DATABASE_URL')
        expect(result.filesCreated).toContain('.env.example')
      })
    })

    describe('with-drizzle template', () => {
      it('should include @icetype/drizzle dependency', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'with-drizzle',
        })

        const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('package.json')
        )

        const content = JSON.parse(String(packageJsonCall?.[1]))
        expect(content.dependencies).toHaveProperty('@icetype/drizzle')
      })

      it('should include drizzle-orm dependency', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'with-drizzle',
        })

        const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('package.json')
        )

        const content = JSON.parse(String(packageJsonCall?.[1]))
        expect(content.dependencies).toHaveProperty('drizzle-orm')
      })

      it('should include drizzle-kit as devDependency', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await createProject({
          projectName: 'my-app',
          template: 'with-drizzle',
        })

        const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('package.json')
        )

        const content = JSON.parse(String(packageJsonCall?.[1]))
        expect(content.devDependencies).toHaveProperty('drizzle-kit')
      })

      it('should generate drizzle.config.ts', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        const result = await createProject({
          projectName: 'my-app',
          template: 'with-drizzle',
        })

        const drizzleConfigCall = vi.mocked(fs.writeFileSync).mock.calls.find(
          (call) => String(call[0]).includes('drizzle.config.ts')
        )

        expect(drizzleConfigCall).toBeDefined()
        expect(result.filesCreated).toContain('drizzle.config.ts')
      })
    })
  })

  // ===========================================================================
  // Interactive Prompts Tests
  // ===========================================================================

  describe('interactive prompts', () => {
    it('should prompt for project name when not provided', async () => {
      const options = await promptForOptions({})

      expect(options.projectName).toBeDefined()
      expect(typeof options.projectName).toBe('string')
    })

    it('should prompt for template when not provided', async () => {
      const options = await promptForOptions({
        projectName: 'my-app',
      })

      expect(options.template).toBeDefined()
      expect(['basic', 'with-postgres', 'with-drizzle']).toContain(options.template)
    })

    it('should use provided projectName without prompting', async () => {
      const options = await promptForOptions({
        projectName: 'provided-name',
        template: 'basic',
      })

      expect(options.projectName).toBe('provided-name')
    })

    it('should use provided template without prompting', async () => {
      const options = await promptForOptions({
        projectName: 'my-app',
        template: 'with-postgres',
      })

      expect(options.template).toBe('with-postgres')
    })

    it('should default to basic template when interactive is false', async () => {
      const options = await promptForOptions({
        projectName: 'my-app',
        interactive: false,
      })

      expect(options.template).toBe('basic')
    })
  })

  // ===========================================================================
  // CLI Main Function Tests
  // ===========================================================================

  describe('main CLI function', () => {
    it('should parse project name from positional argument', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await main(['my-cli-app'])

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('my-cli-app'),
        expect.any(Object)
      )
    })

    it('should parse --template flag', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await main(['my-app', '--template', 'with-postgres'])

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.dependencies).toHaveProperty('@icetype/postgres')
    })

    it('should parse -t short flag for template', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await main(['my-app', '-t', 'with-drizzle'])

      const packageJsonCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('package.json')
      )

      const content = JSON.parse(String(packageJsonCall?.[1]))
      expect(content.dependencies).toHaveProperty('@icetype/drizzle')
    })

    it('should show help with --help flag', async () => {
      await main(['--help'])

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('create-icetype')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage')
      )
    })

    it('should show version with --version flag', async () => {
      await main(['--version'])

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d+\.\d+\.\d+/)
      )
    })

    it('should print success message after project creation', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await main(['my-app'])

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Successfully created')
      )
    })

    it('should print next steps instructions', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await main(['my-app'])

      // Check that next steps includes the project name and install command
      // The output may include ANSI color codes, so we check for key parts
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('my-app')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('npm install')
      )
    })
  })

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should handle permission denied when creating directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      const result = await createProject({
        projectName: '/root/protected-dir',
        template: 'basic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('permission')
    })

    it('should handle permission denied when writing files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('permission')
    })

    it('should handle disk full error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device')
      })

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('space')
    })

    it('should validate template name', async () => {
      const result = await createProject({
        projectName: 'my-app',
        // @ts-expect-error - testing invalid template
        template: 'invalid-template',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('template')
    })

    it('should validate project name format', async () => {
      const result = await createProject({
        projectName: '',
        template: 'basic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('name')
    })

    it('should reject project names with invalid characters', async () => {
      const result = await createProject({
        projectName: 'my<app>',
        template: 'basic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('invalid')
    })
  })

  // ===========================================================================
  // File List Tests
  // ===========================================================================

  describe('file list', () => {
    it('should return list of created files', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      expect(result.filesCreated).toContain('package.json')
      expect(result.filesCreated).toContain('tsconfig.json')
      expect(result.filesCreated).toContain('schema.ts')
      expect(result.filesCreated).toContain('.gitignore')
    })

    it('should include template-specific files in list', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'with-drizzle',
      })

      expect(result.filesCreated).toContain('drizzle.config.ts')
    })
  })

  // ===========================================================================
  // README Generation Tests
  // ===========================================================================

  describe('README generation', () => {
    it('should generate README.md', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      const result = await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const readmeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('README.md')
      )

      expect(readmeCall).toBeDefined()
      expect(result.filesCreated).toContain('README.md')
    })

    it('should include project name in README', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'awesome-project',
        template: 'basic',
      })

      const readmeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('README.md')
      )

      const content = String(readmeCall?.[1])
      expect(content).toContain('awesome-project')
    })

    it('should include getting started instructions', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})

      await createProject({
        projectName: 'my-app',
        template: 'basic',
      })

      const readmeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
        (call) => String(call[0]).includes('README.md')
      )

      const content = String(readmeCall?.[1])
      expect(content).toContain('npm install')
      expect(content).toContain('Getting Started')
    })
  })
})
