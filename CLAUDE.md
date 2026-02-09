# Claude Code Instructions

## Workflow

- **Commit and push** after completing each logical unit of work, once lint/tests/build pass.
- Don't wait for the user to ask — commit proactively when the work is done and verified.
- Write clear, concise commit messages that explain the "why" not the "what".

## Development

- Run `npm run lint` (biome), `npm test` (vitest), and `npm run build` (tsc) to verify changes.
- The pre-commit hook runs all three automatically — if it fails, fix the issue and create a new commit.
- Tests live in `tests/` mirroring `src/` structure. Use shared helpers from `tests/helpers/mocks.ts`.
- All commands return `Promise<boolean>` and are wrapped with `withExitCode` in `src/index.ts`.

## Code Style

- Biome handles formatting and linting (see `biome.json`). Run `npx biome check --write` to auto-fix.
- ESM modules with `.js` extensions in imports.
- Avoid duplication — use shared modules in `src/lib/` and shared test helpers in `tests/helpers/`.
