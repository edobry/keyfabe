# keyfabe

A TypeScript CLI tool that wraps the Proxmark3 client to provide an ergonomic keyfob cloning workflow.

## What it does

- Automates the multi-step read/detect/clone/verify process into a single guided flow
- Detects and surfaces common problems (device not found, firmware mismatch, antenna issues)
- Stores cloned fob identities for later re-use
- Walks you through flashing Iceman firmware on a stock Proxmark3 Easy

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
npm install
npm run build
npm link   # makes `keyfabe` available globally
```

## Usage

```sh
# check device connection, firmware, and antenna health
keyfabe doctor

# flash Iceman firmware to a stock Proxmark3 Easy
keyfabe setup

# guided interactive clone flow (read original → write to blank)
keyfabe clone

# read and identify a fob without cloning
keyfabe read

# write a previously-saved identity to a blank fob
keyfabe write <name>

# list saved identities
keyfabe list

# delete a saved identity
keyfabe delete <name>
```

## Commands

### `keyfabe doctor`

Pre-flight check. Verifies device port, firmware communication, and antenna tuning. Gives specific guidance if something is wrong (missing pm3, incompatible firmware, low antenna voltage).

### `keyfabe setup`

Interactive wizard for flashing Iceman firmware to a stock Proxmark3 Easy. Handles prerequisites check, source extraction from Homebrew cache, building with 256KB size constraints, flashing with bootloader unlock, and post-flash verification.

### `keyfabe clone`

Guided clone flow: reads the original fob, detects a blank T55x7, writes the ID, and verifies the readback. Optionally saves the identity for later use.

### `keyfabe read`

Reads and identifies whatever fob is on the antenna. Supports EM410x and HID Prox. Optionally saves the identity.

### `keyfabe write <name>`

Writes a previously-saved identity to a blank T55x7 fob.

### `keyfabe list`

Lists all saved fob identities from `~/.keyfabe/fobs.json`.

### `keyfabe delete <name>`

Deletes a saved fob identity.

## Supported Card Types

| Type | Read | Clone | Notes |
|------|------|-------|-------|
| EM410x | yes | yes | Most common LF keyfob |
| HID Prox | yes | yes | Uses `lf hid clone` |
| T55x7 | detect | n/a | Target writable card |

## Development

```sh
npm run dev         # run directly with tsx
npm run lint        # check lint + formatting (Biome)
npm run lint:fix    # auto-fix lint + formatting
npm test            # run tests
npm run build       # compile TypeScript
```

A pre-commit hook runs lint, test, and build automatically on every commit. CI does the same on push/PR via GitHub Actions.

## Architecture

```
src/
  index.ts              # entry point, CLI arg parsing (commander)
  commands/
    doctor.ts           # device health check
    setup.ts            # firmware flash wizard
    read.ts             # read fob
    clone.ts            # guided clone flow
    write.ts            # write saved identity
    list.ts             # list saved identities
    delete.ts           # delete saved identity
  lib/
    pm3.ts              # spawns pm3 process, sends commands
    firmware.ts         # build/flash subprocess helpers
    parsers.ts          # parse pm3 output (card type, ID, voltages)
    store.ts            # read/write ~/.keyfabe/fobs.json
    prompts.ts          # interactive user prompts
```
