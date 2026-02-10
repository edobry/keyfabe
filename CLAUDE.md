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

## Testing Philosophy

- **Behavioral over output**: Prefer asserting on return values, function calls, and state mutations — not on display strings. If `expect(result).toBe(false)` already proves the error path ran, don't also assert on the error message text.
- **Mock UI minimally**: `@clack/prompts` is mocked as quiet no-ops via `mockClack()`. Interactive prompts (select/text/confirm) must be mocked since they block on user input. Display functions (log, note, spinner, intro/outro) are silenced — don't pipe them through `console.log`.
- **Assert on mock calls for display-focused tests**: When display IS the feature (e.g., `list` table output, `show` fob details), assert directly on clack mock function calls (`expect(p.note).toHaveBeenCalledWith(...)`) rather than capturing console output.
- **No `getOutput()` for command tests**: The `getOutput()` console.log capture pattern is only for tests that genuinely need raw stdout (e.g., `--json` output). Command tests should not rely on it for clack output assertions.

## Code Style

- Biome handles formatting and linting (see `biome.json`). Run `npx biome check --write` to auto-fix.
- ESM modules with `.js` extensions in imports.
- Avoid duplication — use shared modules in `src/lib/` and shared test helpers in `tests/helpers/`.
