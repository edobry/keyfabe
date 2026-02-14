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
keyfabe clone

# read and identify a tag without cloning
keyfabe read

# write a previously-saved identity to a blank tag
keyfabe write [name]

# list saved identities
keyfabe list

# show details of a saved identity
keyfabe show [name]

# rename a saved identity
keyfabe rename [old-name] [new-name]

# delete a saved identity
keyfabe delete [name]

# export all saved identities as JSON
keyfabe export > fobs.json

# import identities from a JSON file
keyfabe import fobs.json
```

Commands that take `[name]` arguments are fully optional — when omitted, you'll get an interactive tag picker.

## Commands

### `keyfabe doctor`

Pre-flight check. Verifies device port, firmware communication, and antenna tuning. Gives specific guidance if something is wrong (missing pm3, incompatible firmware, low antenna voltage).

### `keyfabe setup`

Interactive wizard for flashing Iceman firmware to a stock Proxmark3 Easy. Handles prerequisites check, source extraction from Homebrew cache, building with 256KB size constraints, flashing with bootloader unlock, and post-flash verification.

### `keyfabe clone`

Guided clone flow: reads the original tag (LF and HF), writes the ID to a blank card, and verifies the readback. Optionally saves the identity for later use.

### `keyfabe read`

Reads and identifies whatever tag is on the antenna. Searches LF first, then falls back to HF. Supports EM410x, HID Prox, MIFARE Classic, MIFARE Ultralight, MIFARE DESFire, and ISO 14443-A. Optionally saves the identity.

### `keyfabe write [name]`

Writes a previously-saved identity to a blank tag. Without a name, presents an interactive picker.

### `keyfabe list`

Lists all saved tag identities from `~/.keyfabe/fobs.json`.

### `keyfabe show [name]`

Displays full details of a saved tag identity (type, ID, encoding, save date). Without a name, presents an interactive picker.

### `keyfabe rename [old-name] [new-name]`

Renames a saved tag identity. Missing arguments are prompted interactively.

### `keyfabe delete [name]`

Deletes a saved tag identity. Without a name, presents an interactive picker.

### `keyfabe export`

Exports all saved tag identities as JSON to stdout. Pipe to a file for backup: `keyfabe export > fobs.json`.

### `keyfabe import <file>`

Imports tag identities from a JSON file. New names are added, existing names are updated.

## Supported Card Types

| Type | Frequency | Read | Clone | Notes |
|------|-----------|------|-------|-------|
| EM410x | LF (125 kHz) | yes | yes | Most common LF keyfob |
| HID Prox | LF (125 kHz) | yes | yes | Uses `lf hid clone` |
| MIFARE Classic 1K/4K | HF (13.56 MHz) | yes | yes | Requires Gen1A magic card (`hf mf csetuid`) |
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
    list.ts             # list saved identities
    show.ts             # show saved identity details
    rename.ts           # rename saved identity
    delete.ts           # delete saved identity
    export.ts           # export identities as JSON
    import.ts           # import identities from JSON
  lib/
    pm3.ts              # spawns pm3 process, sends commands
    firmware.ts         # build/flash subprocess helpers
    parsers.ts          # parse pm3 output (card type, ID, voltages)
    store.ts            # read/write ~/.keyfabe/fobs.json
    constants.ts        # shared card type and pm3 command constants
    card-ops.ts         # search, write-and-verify logic shared by commands
    display.ts          # shared display helpers and constants
    prompts.ts          # interactive user prompts
```
