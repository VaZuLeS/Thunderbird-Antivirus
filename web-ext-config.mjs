/**
 * web-ext configuration for Thundy AV.
 *
 * The add-on package must only contain files that are actually loaded at
 * runtime. Tests, developer scripts, documentation and store assets live in the
 * repository but are excluded from the XPI (see store readiness analysis, H2).
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
    'scripts',
    'scripts/**',
    'benchmark_compare.js',
    'form_test.js',
    'vt_test.js',
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
    '.webextignore', // defensive: a stale local copy must never ship
    'web-ext-config.mjs',
    // package metadata / lock files
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'node_modules',
    'build',
    'web-ext-artifacts',
    'Dockerfile',
    '.editorconfig',
  ],
  lint: {
    // Thunderbird-only permissions and APIs are unknown to the Firefox oriented
    // linter; the CI job filters those known false positives.
    warningsAsErrors: false,
  },
  run: {
    // Usage: npx web-ext run --firefox=/path/to/thunderbird
    // (no default binary: Thunderbird must be passed explicitly)
  },
};
