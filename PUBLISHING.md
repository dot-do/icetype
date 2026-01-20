# Publishing Guide

This document outlines the steps for maintainers to publish IceType packages to npm.

## Prerequisites

1. Ensure you have npm publishing rights for the `@icetype` scope
2. Ensure you are logged in to npm: `npm login`
3. Ensure all tests pass: `npm test --workspaces`
4. Ensure all packages build: `npm run build --workspaces`

## Package Dependencies

The packages must be published in order due to workspace dependencies:

1. `@icetype/core` (no dependencies)
2. `@icetype/iceberg` (depends on core)
3. `@icetype/cli` (depends on core, iceberg)
4. `@icetype/adapters` (depends on core, iceberg)
5. `icetype` (depends on core, iceberg, cli)

## Pre-publish Checklist

- [ ] Update version numbers in all package.json files
- [ ] Update CHANGELOG.md with release notes
- [ ] Run tests: `npm test --workspaces`
- [ ] Run build: `npm run build --workspaces`
- [ ] Verify packages: `npm pack --dry-run` in each package directory
- [ ] Commit version bump and changelog updates
- [ ] Create git tag for the release

## Publishing Steps

### 1. Update Versions

Update the version in each package.json. All packages should have the same version number.

```bash
# Example: Update to 0.1.0
npm version 0.1.0 --workspaces --no-git-tag-version
```

### 2. Update Workspace Dependencies

Before publishing, workspace references need to be replaced with actual version numbers.
This is handled automatically by pnpm publish or npm publish with proper configuration.

### 3. Publish Packages

Publish packages in dependency order:

```bash
# Core (no dependencies)
cd packages/core
npm publish --access public

# Iceberg (depends on core)
cd ../iceberg
npm publish --access public

# CLI (depends on core, iceberg)
cd ../cli
npm publish --access public

# Adapters (depends on core, iceberg)
cd ../adapters
npm publish --access public

# Main icetype package (depends on all)
cd ../icetype
npm publish --access public
```

### 4. Create Git Tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Troubleshooting

### Workspace Protocol

If you see errors about `workspace:*` protocol, you need to replace these with actual version numbers before publishing, or use a tool like `pnpm publish` which handles this automatically.

### Scoped Package Access

For first-time publishing of scoped packages, use `--access public`:

```bash
npm publish --access public
```

### Publishing Pre-release Versions

For pre-release versions (alpha, beta, rc):

```bash
npm publish --tag next --access public
```

## Automated Publishing (CI/CD)

For automated publishing via GitHub Actions:

1. Set `NPM_TOKEN` as a repository secret
2. Use the following workflow step:

```yaml
- name: Publish to npm
  run: |
    echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc
    npm publish --access public --workspaces
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Versioning Strategy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Pre-release versions follow the format: `X.Y.Z-rc.N`
