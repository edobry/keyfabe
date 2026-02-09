# Claude Code Instructions

## Workflow

- **Commit and push** after completing each logical unit of work, once lint/tests/build pass.
- Don't wait for the user to ask — commit proactively when the work is done and verified.

## Commit Messages

This repo uses **conventional commits** with **semantic-release** for automated versioning and publishing.

Every commit message must follow this format:

```
<type>: <description>
```

Types and their effects:
- `feat: ...` — new feature (triggers **minor** version bump, e.g. 0.1.0 → 0.2.0)
- `fix: ...` — bug fix (triggers **patch** version bump, e.g. 0.1.0 → 0.1.1)
- `feat!: ...` or body contains `BREAKING CHANGE:` — breaking change (triggers **major** bump)
- `chore: ...` — maintenance, deps, CI (no release)
- `refactor: ...` — code restructuring (no release)
- `docs: ...` — documentation only (no release)
- `test: ...` — test changes only (no release)

Use the type that best describes the change. Only `feat` and `fix` trigger npm releases.

## Development

- Run `npm run lint` (biome), `npm test` (vitest), and `npm run build` (tsc) to verify changes.
- The pre-commit hook runs all three automatically — if it fails, fix the issue and create a new commit.
- Tests live in `tests/` mirroring `src/` structure. Use shared helpers from `tests/helpers/mocks.ts`.
- All commands return `Promise<boolean>` and are wrapped with `withExitCode` in `src/index.ts`.

## Code Style

- Biome handles formatting and linting (see `biome.json`). Run `npx biome check --write` to auto-fix.
- ESM modules with `.js` extensions in imports.
- Avoid duplication — use shared modules in `src/lib/` and shared test helpers in `tests/helpers/`.
