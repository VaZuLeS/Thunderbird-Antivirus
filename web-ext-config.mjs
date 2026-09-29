/**
 * web-ext configuration for Thundy AV.
 *
 * The add-on package must only contain files that are actually loaded at
 * runtime. Tests, developer scripts, documentation and store assets live in the
 * repository but are excluded from the XPI (see store readiness analysis, H2).
 *
 * This file is the single place for the exclude rules: web-ext and
 * addons-linter do not read a `.webextignore` file, so that file was removed
 * (audit M6).
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
    // documentation and store assets (kept in the repository only).
    // The markdown files are listed explicitly (instead of '*.md') so that new
    // repository documents - e.g. a future VENDOR.md - become part of the
    // package again and are looked at deliberately.
    'docs',
    'docs/**',
    'examples',
    'examples/**',
    'README.md',
    'README.de.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    'COMMUNITY.md',
    'FIRST_TIMERS.md',
    'CODEOWNERS',
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
