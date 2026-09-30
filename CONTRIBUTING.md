# Contributing to Thundy AV (Thunderbird Antivirus)

Thanks for your interest in contributing! Please follow these steps to make contributions easy to review and land:

1. Fork the repo and create a feature branch named `feat/<short-description>` or `fix/<short-description>`.
2. Keep changes small and focused. Open an issue first for larger changes.
3. Write tests for new behavior and ensure existing tests pass: `npm test` (runs all `node:test` files).
4. Before committing, run the local quality gate: `npm run check` (pre-submit checks, all tests, filtered lint,
   package build and content check). Before a store submission also run `npm run gate`, which checks the
   submission criteria from `docs/PROBLEMANALYSE_STORE_READINESS.md` §10.
5. Use conventional commit messages (e.g., `feat: add scanner option`, `fix: handle null pointer`).
6. Push your branch and open a pull request targeting `main`.
7. Link related issues in the PR description and include a short testing guide.

Review process
- Pull requests are reviewed by maintainers; expect constructive feedback.
- Keep commits squashed or allow maintainers to squash during merge.

Developer environment
- See `docs/quickstart.md` for build and run instructions.

Thank you for contributing!
