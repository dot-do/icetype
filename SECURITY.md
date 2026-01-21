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
