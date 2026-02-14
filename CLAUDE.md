# Claude Code Instructions

## Workflow

### Branching

- **Work on feature branches**, not directly on `main`. This prevents pushes from triggering semantic-release mid-work and avoids local/remote divergence.
  - Branch from `main`: `git checkout -b feat/short-description`
  - Commit and push to the feature branch freely.
  - When done, merge to `main` (or open a PR). The merge to `main` is the single event that triggers a release.
- Branch naming: `feat/...`, `fix/...`, `refactor/...`, `docs/...` — matching the commit type.
- **Pull `main` before branching**: Always `git pull --rebase` on `main` before creating a feature branch. This picks up any CI-generated release commits.

### Committing

- **Commit and push** after completing each logical unit of work, once lint/tests/build pass.
- Don't wait for the user to ask — commit proactively when the work is done and verified.
- **Housekeeping after feature work**: After completing a feature or significant change, proactively check and fix:
  - README accuracy — do usage examples, command signatures, and descriptions still match the code?
  - package.json metadata — repository, homepage, description, keywords up to date?
  - .gitignore — any new artifacts that should be ignored?
  - GitHub repo metadata — topics, description match the current state?
  - Stale docs or comments referencing old behavior?
  Don't wait to be asked — surface and fix these as part of finishing the work.

## Versioning (semantic-release)

This repo uses **conventional commits** with **semantic-release** for automated versioning and publishing. The version is a **derived artifact** — CI is the single source of truth.

### How it works

When a `feat:` or `fix:` commit lands on `main` (via merge or direct push), CI runs semantic-release, which:
1. Analyzes commit messages since the last release to determine the next version
2. Updates `package.json` version and `CHANGELOG.md`
3. Creates a git tag and pushes a `chore(release)` commit back to `main`
4. Publishes to npm

This means **after a release-triggering merge to `main`, the remote advances by one commit** (the release commit). This is why we work on feature branches — it keeps your work isolated from CI's commits to `main`.

### Rules

- **Never manually edit** `version` in `package.json` — semantic-release owns it.
- **Never manually edit** `CHANGELOG.md` — semantic-release generates it.
- **Pull before starting new work** to pick up any release commits CI has pushed.
- If a merge conflict involves the `version` field, **always take the remote's version**. Semantic-release will set the correct next version on the next release.

### Commit message types

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
- **User-facing strings** (card type names, pm3 commands, target card descriptions) live in `src/lib/constants.ts`. When adding new user-facing text that appears in more than one place, add it to constants first, don't duplicate inline strings.

## Hardware & Protocol Knowledge

This project interacts with real RFID hardware. Protocol-level knowledge (card types, command formats, byte layouts, failure modes) is hard-won through testing and should be preserved.

- **Document learnings in `docs/`** whenever working with hardware protocols reveals non-obvious behavior — byte order issues, card type quirks, recovery procedures, etc.
- Reference docs exist:
  - `docs/magic-cards.md` — magic card types, block 0 format, BCC calculation, ATQA byte order, recovery procedures
- When adding support for new card types or write methods, update the relevant doc alongside the code.
- If a hardware interaction fails in an unexpected way, document the root cause and fix in the appropriate doc before moving on.

## Quality & Coverage

After completing any feature, fix, or refactor, proactively check for:
- **Test coverage gaps**: Every source file in `src/` should have a corresponding test file in `tests/`. Every public function and code path should be tested. If you add a new file, add its tests in the same branch.
- **Code quality issues**: Shared try/catch blocks covering unrelated spinners/resources, unreachable code, unused imports, missing error handling at system boundaries.
- **Consistency**: New code should follow the same patterns as existing code (mock setup, assertion style, constant usage).

Don't wait to be asked — identify and fix these as part of finishing the work.

## Maintaining These Instructions

These instructions are a living document. Update CLAUDE.md as part of the work whenever:
- A new pattern or convention is established (e.g., a new shared module, a new constant category)
- A mistake reveals a gap in the instructions (e.g., missing workflow step, unclear rule)
- A decision is made about how something should be done going forward
- Hardware/protocol testing reveals non-obvious behavior that should be documented in `docs/`

Don't wait until the end — update the instructions at the point the learning happens, in the same commit or branch as the related work.
