/**
 * web-ext configuration for Thundy AV.
 *
 * The add-on package must only contain files that are actually loaded at
 * runtime. Tests, developer scripts, documentation and store assets live in the
 * repository but are excluded from the XPI (see docs/PROBLEMANALYSE_STORE_READINESS.md, P0-6).
 *
 * NOTE: web-ext does not read a `.webextignore` file (verified: `grep -r webextignore
 * node_modules/web-ext/lib` finds nothing; `web-ext build --no-config-discovery` packs
 * 60+ files). Therefore this list is the single source of truth for packaging.
 */
export default {
  build: {
    overwriteDest: true,
  },
  ignoreFiles: [
    // tests and developer tooling
    '**/*.test.js',
    '**/*_test.js',
    'test',
    'test/**',
    'tools',
    'tools/**',
    'scripts',
    'scripts/**',
    // reviewer test data (kept in the repository only)
    'testdata',
    'testdata/**',
    // documentation and store assets (kept in the repository only)
    'docs',
    'docs/**',
    'examples',
    'examples/**',
    '*.md',
    'CODEOWNERS',
    'LICENSE/**',
    // repository configuration
    '.github',
    '.github/**',
    '.jules',
    '.Jules',
    '.Jules/**',
    '.gitignore',
    'web-ext-config.mjs',
    // package metadata / lock files
    'package.json',
    'package-lock.json',
    'node_modules',
    'build',
    'web-ext-artifacts',
    'Dockerfile',
    '.editorconfig',
  ],
  lint: {
    // Thunderbird-only permissions and APIs are unknown to the Firefox oriented
    // linter; scripts/filter-lint-warnings.js checks every warning against a
    // curated allow-list and fails on anything unexpected.
    warningsAsErrors: false,
  },
  run: {
    // Usage: npx web-ext run --firefox=/path/to/thunderbird
    // (no default binary: Thunderbird must be passed explicitly)
  },
};
