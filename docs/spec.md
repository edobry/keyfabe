# keyfabe CLI — Spec

A TypeScript CLI tool that wraps the Proxmark3 client to provide an ergonomic tag cloning workflow.

## Goals

- Automate the multi-step read/detect/clone/verify process into a single guided flow
- Detect and surface common problems (device not found, firmware mismatch, antenna issues)
- Store cloned tag identities for later re-use
- Keep it simple — thin wrapper over `pm3`, not a reimplementation

## Usage

```sh
# guided interactive clone flow
keyfabe clone

# read and identify a tag without cloning
keyfabe read

# write a previously-saved identity to a blank tag
keyfabe write <name>

# list saved identities
keyfabe list

# check device connection, firmware, and antenna health
keyfabe doctor
```

## Commands

### `keyfabe doctor`

Pre-flight check. Verifies everything is working before the user attempts a clone.

1. Look for a Proxmark3 serial port (`/dev/tty.usbmodem*`)
2. Run `hw status` — verify client/firmware communication
3. Run `hw tune` — check LF and HF antenna voltage, warn if below thresholds (LF < 15V, HF < 10V)
4. Print a summary: device port, firmware version, antenna health

If the device is not found or communication fails, print actionable guidance (check USB, reflash firmware, etc).

### `keyfabe read`

Read and identify whatever is on the antenna.

1. Run `lf search`
2. Parse the output for known card types (EM410x, HID Prox, etc.)
3. Display: card type, ID, and any decoded formats (facility code, card number)
4. Prompt to save with a name (e.g. "front-door") → writes to `~/.keyfabe/tags.json`

If nothing is detected on LF, automatically try `hf search` as a fallback.

### `keyfabe clone`

Interactive guided flow combining read + write.

1. Prompt: "Place your original tag on the antenna"
2. Wait for a successful read (poll `lf search` with retries)
3. Display the detected card info
4. Prompt: "Remove original and place a blank T55x7 tag on the antenna"
5. Run `lf t55xx detect` to confirm writable card is present
6. Clone the ID (e.g. `lf em 410x clone --id <id>`)
7. Verify by reading back (`lf em 410x reader`)
8. Report success/failure
9. Prompt to save the identity

### `keyfabe write <name>`

Write a previously-saved identity to a blank tag.

1. Look up `<name>` in `~/.keyfabe/tags.json`
2. Prompt: "Place a blank T55x7 tag on the antenna"
3. Detect the blank card
4. Write the stored identity
5. Verify readback

### `keyfabe list`

Print all saved identities from `~/.keyfabe/tags.json` as a table:

```
Name         Type      ID              Saved
front-door   EM410x    040064DACA      2026-02-08
garage       EM410x    0500128ABB      2026-02-07
```

## Data Model

Saved in `~/.keyfabe/tags.json`:

```json
[
  {
    "name": "front-door",
    "type": "EM410x",
    "id": "040064DACA",
    "encoding": "RF/64",
    "raw": "ff81200313ba628e",
    "savedAt": "2026-02-08T04:52:00Z"
  }
]
```

## Architecture

```
src/
  index.ts          # entry point, arg parsing
  commands/
    doctor.ts       # device health check
    read.ts         # read tag
    clone.ts        # guided clone flow
    write.ts        # write saved identity
    list.ts         # list saved identities
  lib/
    pm3.ts          # spawns pm3 process, sends commands, parses output
    parsers.ts      # parse pm3 output (card type, ID, tune voltages, etc)
    store.ts        # read/write ~/.keyfabe/tags.json
    prompts.ts      # interactive user prompts (waiting, confirmation)
```

### `lib/pm3.ts`

Core interface to the Proxmark3. Spawns `pm3 -c "<command>"` as a child process for each command. Responsibilities:

- Auto-detect the serial port (glob `/dev/tty.usbmodem*`, pick the first match)
- Execute a command and return stdout/stderr
- Timeout handling (default 30s, configurable)
- Throw typed errors for known failure modes (no device, no card, write failed)

### `lib/parsers.ts`

Regex-based parsers for pm3 text output:

- `parseHwStatus(output)` → `{ connected: boolean, firmwareVersion: string }`
- `parseHwTune(output)` → `{ lfVoltage: number, hfVoltage: number }`
- `parseLfSearch(output)` → `{ type: string, id: string, encoding: string } | null`
- `parseT55xxDetect(output)` → `{ chipType: string, passwordSet: boolean } | null`
- `parseCloneResult(output)` → `{ success: boolean, raw: string }`

## Dependencies

- **commander** or **yargs** — CLI arg parsing
- **chalk** — terminal colors
- **ora** — spinners for waiting states
- No Proxmark3 library — just shell out to `pm3`

## Supported Card Types (initial)

| Type | Read | Clone | Notes |
|------|------|-------|-------|
| EM410x | yes | yes | Most common LF tag |
| HID Prox | yes | yes | Uses `lf hid clone` |
| T55x7 | detect | n/a | Target writable card |

Additional types (MIFARE, iCLASS, etc.) can be added later as new parser + clone command pairs.

## Error Handling

Every step in the flow should fail gracefully with a human-readable message:

| Failure | Message |
|---------|---------|
| No serial port found | "No Proxmark3 detected. Check USB connection." |
| `hw status` fails | "Can't communicate with device. Firmware may need reflashing — see session-log.md." |
| LF voltage low | "LF antenna reading low ({v}V). Check antenna connection." |
| No card detected | "No card detected. Make sure the tag is flat against the antenna." |
| Blank not T55x7 | "Card is not a writable T55x7. Use a blank T55x7 tag." |
| Clone verify mismatch | "Verification failed — readback ID doesn't match. Try again." |
