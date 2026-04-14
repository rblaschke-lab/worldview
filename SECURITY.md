# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Worldview, please report it responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email: dev@worldview.local (or use GitHub private vulnerability reporting)
3. Include steps to reproduce, expected vs actual behavior, and impact assessment

## Architecture

Worldview is a **static client-side application** hosted on GitHub Pages:

- **No backend server** — all processing happens in the browser
- **No user authentication** — no accounts, no passwords
- **No database** — data is fetched directly from public APIs
- **No cookies** — only `localStorage` for language preference and data cache
- **No user data collection** — GDPR-compliant by design

## Security Measures

| Measure | Status |
|---------|--------|
| Content Security Policy (CSP) | ✅ Implemented |
| HTML output escaping (XSS prevention) | ✅ Implemented |
| Subresource Integrity (SRI) | 🔄 Planned |
| No inline script execution | ✅ CSP blocks `unsafe-inline` scripts |
| API key protection | ✅ Key field empty by default, not committed |
| Debug exposure removed | ✅ No `window.__wv` in production |

## Supported Versions

| Version | Supported |
|---------|-----------|
| 9.0     | ✅ Current |
| < 9.0   | ❌ No longer maintained |
