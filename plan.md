1. **Optimize `getMainDomain` in `background.js` and `test_risk_score.js`**:
   - Replace the `O(N)` loop (`for (let brand of KNOWN_BRANDS) ... endsWith`) with a precompiled regular expression matching exact domains or subdomains.
   - Example optimization logic:
     ```javascript
     const KNOWN_BRANDS_REGEX = new RegExp(`(?:^|\\.)(${KNOWN_BRANDS.map(b => b.replace(/\./g, '\\.')).join('|')})$`, 'i');

     function getMainDomain(domain) {
         const match = domain.match(KNOWN_BRANDS_REGEX);
         if (match) return match[1].toLowerCase();

         const dParts = domain.split('.');
         if (dParts.length >= 2) {
             return dParts.slice(-2).join('.');
         }
         return domain;
     }
     ```
   - This optimization turns the complexity from `O(N)` string iterations inside hot loops (like evaluating multiple URLs in emails) to a single `O(1)` regex execution.

2. **Run tests**:
   - Verify `background.test.js` passes.
   - Verify `test_risk_score.js` passes.
   - Ensure `npm test` works perfectly.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**

4. **Submit changes**:
   - Use the submit tool with branch `bolt-optimizations` and a commit message detailing the `getMainDomain` optimization.
