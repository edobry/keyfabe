# keyfabe

A TypeScript CLI tool that wraps the Proxmark3 client to provide an ergonomic RFID tag cloning workflow.

<p align="center">
  <img src="demo.gif" alt="keyfabe demo" width="800" />
</p>

## What it does

- Automates the multi-step read/detect/clone/verify process into a single guided flow
- Detects and surfaces common problems (device not found, firmware mismatch, antenna issues)
- Stores cloned tag identities for later re-use
- Walks you through flashing Iceman firmware on a stock Proxmark3 Easy
- Export/import tag identities for backup and sharing

## Prerequisites

- [Proxmark3 Iceman firmware](https://github.com/RfidResearchGroup/proxmark3) installed via Homebrew:
  ```sh
  brew tap rfidresearchgroup/proxmark3
  brew install proxmark3
  ```
- A Proxmark3 Easy (or compatible) device

If your device has stock firmware, `keyfabe setup` will handle building and flashing the correct firmware for you.

## Install

```sh
npm install -g keyfabe
```

Or run without installing:

```sh
npx keyfabe
```

## Usage

Running `keyfabe` with no arguments launches an interactive wizard menu that guides you through all available actions.

```sh
# launch interactive wizard
keyfabe

# check device connection, firmware, and antenna health
keyfabe doctor

# flash Iceman firmware to a stock Proxmark3 Easy
keyfabe setup

# guided interactive clone flow (read original → write to blank)
keyfabe clone [--save-as <name>]

# read and identify a tag without cloning
keyfabe read [--save-as <name>]

# write a previously-saved identity to a blank tag
keyfabe write [name]

# verify a tag against a saved identity
keyfabe verify [name]

# list saved identities
keyfabe list

# show details of a saved identity
keyfabe show [name]

# rename a saved identity
keyfabe rename [old-name] [new-name]

# delete a saved identity
keyfabe delete [name]

# export all saved identities as JSON
keyfabe export > tags.json

# import identities from a JSON file
keyfabe import tags.json

# repair a bricked magic card (bad BCC/anticollision)
keyfabe repair
```

Commands that take `[name]` arguments are fully optional — when omitted, you'll get an interactive tag picker.

### Scripting / Non-Interactive Mode

keyfabe auto-detects non-interactive mode when stdin is not a TTY (e.g., piped input, cron jobs, called from another process). No flags needed — interactive prompts are automatically skipped or replaced with sensible defaults:

- **Pause prompts** (`waitForEnter`) — logged and skipped (scripted callers handle card placement themselves)
- **Save prompts** (`promptName`) — skipped (use `--save-as` to save)
- **Confirmation prompts** — auto-yes (you explicitly invoked the command)
- **Selection prompts** — exit with error (provide the name as a CLI argument instead)

```sh
# read a tag and save it non-interactively
keyfabe read --save-as front-door < /dev/null

# clone and save in one shot
keyfabe clone --save-as lobby-key < /dev/null

# write a saved identity (already non-interactive with name arg)
keyfabe write front-door < /dev/null

# verify a tag against a saved identity
keyfabe verify front-door < /dev/null

# export/import work without changes
keyfabe export > backup.json
keyfabe import backup.json

# list and show work without changes
keyfabe list --json
keyfabe show front-door
```

Commands that require interactive selection (e.g., `keyfabe delete` without a name argument) will exit with a clear error message when run non-interactively.

## Commands

### `keyfabe doctor`

Pre-flight check. Verifies device port, firmware communication, and antenna tuning. Gives specific guidance if something is wrong (missing pm3, incompatible firmware, low antenna voltage).

### `keyfabe setup`

Interactive wizard for flashing Iceman firmware to a stock Proxmark3 Easy. Handles prerequisites check, source extraction from Homebrew cache, building with 256KB size constraints, flashing with bootloader unlock, and post-flash verification.

### `keyfabe clone`

Guided clone flow: reads the original tag (LF and HF), writes to a blank card, and verifies the readback. Optionally saves the identity for later use. Use `--save-as <name>` to save without prompting.

- **LF cards** (EM410x, HID Prox): writes the UID to a blank T55x7
- **MIFARE Classic**: full-card clone — automatically cracks all sector keys, dumps all blocks, and restores them onto a magic card. Supports standard chips via `autopwn` and FM11RF08S chips via automatic fallback recovery (~28 min)

### `keyfabe read`

Reads and identifies whatever tag is on the antenna. Searches LF first, then falls back to HF. Supports EM410x, HID Prox, MIFARE Classic, MIFARE Ultralight, MIFARE DESFire, and ISO 14443-A. Optionally saves the identity. Use `--save-as <name>` to save without prompting.

### `keyfabe write [name]`

Writes a previously-saved identity to a blank tag. Without a name, presents an interactive picker. For MIFARE Classic identities with a saved full-card dump, restores all blocks (not just UID).

### `keyfabe verify [name]`

Reads whatever tag is on the antenna and compares its ID against a saved identity. Reports match, partial match (ID matches but type differs), or mismatch. Without a name, presents an interactive picker.

### `keyfabe list`

Lists all saved tag identities from `~/.keyfabe/tags.json`. Use `--json` for machine-readable output.

### `keyfabe show [name]`

Displays full details of a saved tag identity (type, ID, encoding, save date). Without a name, presents an interactive picker.

### `keyfabe rename [old-name] [new-name]`

Renames a saved tag identity. Missing arguments are prompted interactively.

### `keyfabe delete [name]`

Deletes a saved tag identity. Without a name, presents an interactive picker.

### `keyfabe export`

Exports all saved tag identities as JSON to stdout. Pipe to a file for backup: `keyfabe export > tags.json`.

### `keyfabe import <file>`

Imports tag identities from a JSON file. New names are added, existing names are updated.

### `keyfabe repair`

Repairs a bricked magic card that has a corrupted block 0 (bad BCC, broken anticollision). Automates the recovery process: bypasses the broken anticollision, reads the current block 0, computes and writes the correct BCC, then verifies after power-cycle. See [Magic Card Reference](docs/magic-cards.md) for details.

## Supported Card Types

For detailed information on magic card types, block 0 format, and recovery procedures, see the [Magic Card Reference](docs/magic-cards.md).

| Type | Frequency | Read | Clone | Notes |
|------|-----------|------|-------|-------|
| EM410x | LF (125 kHz) | yes | yes | Most common LF tag |
| HID Prox | LF (125 kHz) | yes | yes | Uses `lf hid clone` |
| MIFARE Classic 1K/4K | HF (13.56 MHz) | yes | yes | Full-card clone (all sectors + keys) to Gen1A or Gen2/CUID magic cards |
| MIFARE Ultralight | HF (13.56 MHz) | yes | no | Read-only support |
| MIFARE DESFire | HF (13.56 MHz) | yes | no | Read-only support |
| ISO 14443-A | HF (13.56 MHz) | yes | no | Generic HF detection |
| T55x7 | LF (125 kHz) | detect | n/a | Target writable card |

## Development

```sh
npm run dev         # run directly with tsx
npm run lint        # check lint + formatting (Biome)
npm run lint:fix    # auto-fix lint + formatting
npm test            # run tests
npm run build       # compile TypeScript
```

A pre-commit hook runs lint, test, and build automatically on every commit. CI does the same on push/PR via GitHub Actions. Publishing to npm is handled by a separate workflow triggered by GitHub releases.

## Architecture

```
src/
  index.ts              # entry point, CLI arg parsing (commander)
  commands/
    doctor.ts           # device health check
    setup.ts            # firmware flash wizard
    read.ts             # read tag
    clone.ts            # guided clone flow
    write.ts            # write saved identity
    verify.ts           # verify tag against saved identity
    list.ts             # list saved identities
    show.ts             # show saved identity details
    rename.ts           # rename saved identity
    delete.ts           # delete saved identity
    export.ts           # export identities as JSON
    import.ts           # import identities from JSON
    repair.ts           # repair bricked magic cards
  lib/
    pm3.ts              # spawns pm3 process, sends commands
    firmware.ts         # build/flash subprocess helpers
    parsers.ts          # parse pm3 output (card type, ID, voltages)
    block0.ts           # MIFARE Classic block 0 utilities (BCC, builder)
    store.ts            # read/write ~/.keyfabe/tags.json
    constants.ts        # shared card type and pm3 command constants
    card-ops.ts         # search, write-and-verify logic shared by commands
    mf-ops.ts           # MIFARE Classic full-card operations (crack, dump, restore)
    display.ts          # shared display helpers and constants
    prompts.ts          # interactive user prompts (auto-detects non-interactive mode)
```
