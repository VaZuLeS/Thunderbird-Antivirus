# CodeQL Security Scan Results

## Summary

- **Scan Timestamp:** 2026-05-10T22:28:26.999Z
- **Total Issues Found:** 4

## Security Issues Found

### background.test.js

1. **js/unused-local-variable**
   - Description: Unused variable before.
   - Severity: warning
   - Line: 4

### fix_content_script.js

1. **js/unused-local-variable**
   - Description: Unused variable content.
   - Severity: warning
   - Line: 3

### test_disarm.js

1. **js/unused-local-variable**
   - Description: Unused variable JSDOM.
   - Severity: warning
   - Line: 1

### api.js

1. **js/automatic-semicolon-insertion**
   - Description: Avoid automated semicolon insertion (93% of all statements in [the enclosing function](1) have an explicit semicolon).
   - Severity: warning
   - Line: 100


## Scan Information

- **Scanned Directory:** /app
- **CodeQL Database:** /app/.qlscan-cache/db
- **Analysis Type:** JavaScript Security Scan