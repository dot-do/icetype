# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT create a public GitHub issue** for security vulnerabilities
2. Email security concerns to the maintainers privately
3. Include the following information:
   - Type of vulnerability (e.g., injection, XSS, authentication bypass)
   - Location of the affected code (file path, function name)
   - Step-by-step instructions to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability within 7 days
- **Resolution**: Critical vulnerabilities will be patched within 30 days
- **Disclosure**: We will coordinate disclosure timing with the reporter

---

## CLI Threat Model

The IceType CLI (`@icetype/cli`) processes user-provided file paths and generates code. This section documents the threat model and security controls.

### Threat Categories

#### 1. Path Traversal Attacks (CWE-22)

**Threat**: An attacker could attempt to read or write files outside the project directory using path sequences like `../` or absolute paths.

**Attack Vectors**:
- Schema path: `--schema ../../../etc/passwd`
- Output path: `--output /etc/cron.d/malicious`
- Migration directory: `--output ../../sensitive/dir`

**Mitigations**:
- All paths are validated to be within the project directory
- Path traversal sequences (`..`) are rejected before normalization
- URL-encoded traversal (`%2e%2e`) is detected and rejected
- Unicode variants of dots are normalized before validation

#### 2. Symlink Attacks (CWE-59)

**Threat**: An attacker could create symbolic links that resolve to sensitive files outside the project.

**Attack Vectors**:
- Schema symlink pointing to `/etc/passwd`
- Output directory symlink pointing to system directories

**Mitigations**:
- Symlinks are resolved using `realpathSync()` before access
- The resolved path must be within the project directory
- Both input and output paths are checked for symlink safety

#### 3. Command Injection (CWE-78)

**Threat**: Malicious characters in paths could lead to command injection if paths are used in shell contexts.

**Attack Vectors**:
- Shell metacharacters: `; | & $ \` < > ( )`
- Command substitution: `$(malicious-command)` or `` `malicious` ``
- Null byte injection: `file.ts\x00.sh`

**Mitigations**:
- Dangerous shell characters are rejected: `; | & $ \` < > ( ) ! { } [ ] #`
- Command substitution patterns (`$(` and backticks) are explicitly blocked
- Null bytes are detected and rejected
- Paths are never passed to shell commands unsanitized

#### 4. Extension Bypass (CWE-434)

**Threat**: Attackers could attempt to process or create files with dangerous extensions.

**Attack Vectors**:
- Executable schemas: `schema.sh`, `schema.exe`
- Double extensions: `schema.ts.exe`
- Output to executables: `--output malicious.bat`

**Mitigations**:
- Schema files must have extensions: `.ts`, `.js`, `.mjs`, `.json`
- Output files must have extensions: `.ts`, `.d.ts`, `.js`
- Migration outputs must have extensions: `.sql`, `.json`, `.ts`, `.js`
- Dangerous extensions are explicitly blocked: `.sh`, `.exe`, `.bat`, `.cmd`, etc.
- Double extensions with dangerous intermediate extensions are rejected

#### 5. Resource Exhaustion (CWE-400)

**Threat**: Extremely long paths could cause denial of service or buffer issues.

**Mitigations**:
- Maximum path length: 4096 characters
- Paths exceeding this limit are rejected early

### Security Controls Summary

| Control | Implementation |
|---------|----------------|
| Path traversal prevention | `sanitizePath()` rejects `..` sequences |
| Project boundary enforcement | `isWithinProjectDirectory()` validates paths |
| Symlink safety | `checkSymlinkSafety()` resolves and validates symlinks |
| Extension validation | `hasValidExtension()` enforces allowed extensions |
| Shell character rejection | Regex-based filtering of dangerous characters |
| Length limits | 4096 character maximum path length |

### Commands with Path Validation

The following CLI commands implement path sanitization:

| Command | Validated Paths |
|---------|-----------------|
| `generate` | `--schema`, `--output` |
| `validate` | `--schema` |
| `init` | `--dir` |
| `migrate generate` | `--schema`, `--output` |
| `migrate diff` | Old schema path, new schema path |
| `migrate status` | `--schema`, `--migrations` |
| `migrate run` | `--schema`, `--migrations` |
| `migrate rollback` | `--schema`, `--migrations` |

### Test Mode

For testing purposes, strict path validation (project boundary and symlink checks) can be disabled by setting:

```bash
ICETYPE_SKIP_PATH_SECURITY=1
```

**Warning**: This environment variable should NEVER be set in production environments. It is intended solely for unit tests that need to use mock paths.

---

## Security Measures

### Automated Security Scanning

This project uses automated security scanning to identify vulnerabilities:

- **Dependency Auditing**: `pnpm audit` runs on every PR and weekly on schedule
- **CodeQL Analysis**: Static analysis for JavaScript/TypeScript vulnerabilities
- **Secrets Scanning**: Gitleaks scans for accidentally committed secrets
- **Dependabot**: Automated dependency updates for security patches

### CI/CD Security

- All PRs require passing security audits before merge
- High and critical vulnerabilities fail the build
- Weekly scheduled scans catch newly discovered vulnerabilities

### Development Practices

- Dependencies are pinned with lockfiles (`pnpm-lock.yaml`)
- Third-party dependencies are reviewed before adoption
- Sensitive data should never be committed to the repository

## Dependency Policy

### Adding New Dependencies

When adding new dependencies:

1. Check for known vulnerabilities: `pnpm audit`
2. Review the package's security history
3. Prefer well-maintained packages with active security response
4. Minimize the dependency footprint

### Handling Vulnerabilities

When vulnerabilities are discovered:

1. **Critical/High**: Update immediately, create hotfix release
2. **Medium**: Update in next regular release
3. **Low**: Update when convenient, document in release notes

## Security Best Practices for Contributors

1. **Never commit secrets** (API keys, tokens, passwords)
2. **Use environment variables** for sensitive configuration
3. **Validate all inputs** especially from external sources
4. **Follow the principle of least privilege**
5. **Keep dependencies updated**

## Security-Related Configuration

### Environment Variables

No environment variables contain sensitive data by default. If you extend IceType with database connections or API integrations, use environment variables for credentials.

### File Permissions

Schema files should have appropriate read permissions. Avoid storing sensitive data in schema definitions.

## Changelog

| Date | Description |
|------|-------------|
| 2025-01-21 | Initial security policy created |
