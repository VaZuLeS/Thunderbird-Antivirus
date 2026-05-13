1. **Fix CodeQL Security Vulnerability (Insecure URL checks)**
   - The issue is caused by `url.includes('domain.com')` allowing subdomains or domains like `malicious-domain.com?q=virustotal.com`.
   - Update `_injectAuthHeaders` in `api_gateway.js` to parse the URL using `new URL(url)` and check the `hostname` instead of a simple substring match.
   - For example: `const parsedUrl = new URL(url); if (parsedUrl.hostname === 'www.virustotal.com' || parsedUrl.hostname === 'virustotal.com')`
2. **Verify Changes locally**
   - Run existing unit tests (`node --test`) to ensure no logic is broken.
3. **Submit Code**
   - Push branch and run pre-commit if necessary.
