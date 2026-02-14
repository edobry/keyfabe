# Magic Card Reference

This document captures protocol-level knowledge about writable MIFARE Classic "magic" cards, learned through real-world testing with keyfabe and the Proxmark3.

## Magic Card Types

| Type | Backdoor | Write Method | Block 0 | Notes |
|------|----------|-------------|---------|-------|
| Gen1A | WUPC (magic wake-up) | `hf mf csetuid -u <UID>` | Automatic | Card responds to proprietary wake-up command; pm3 handles BCC/SAK/ATQA |
| Gen2 / CUID | None (direct write) | `hf mf wrbl --blk 0 --force` | Manual | Allows authenticated write to block 0; requires manual block 0 construction |
| Gen3 | UID-only | `hf mf gen3uid` | Partial | Can change UID without touching manufacturer data |
| Gen4 GTU | Password-protected | `hf mf gsetblk` | Manual | Requires access password (default `00000000`) |
| Gen4 GDM | Config block | `hf mf gdmsetblk` | Manual | Has separate config block for card behavior |

**How to identify**: Run `hf search` — the pm3 output includes a line like `Magic capabilities... Gen 2 / CUID` or `Magic capabilities... Gen 1a`.

## Buying Magic Cards

Regular MIFARE Classic cards have their UID burned in at the factory and permanently locked at the silicon level. No software can override this — it's physically fused by NXP (the chip manufacturer). Magic cards are clones made by third-party manufacturers with writable block 0, purpose-built for UID cloning.

### What to Look For

**Must-haves:**
- **"UID changeable"** or **"UID writable"** — the key phrase that distinguishes magic cards from regular ones. Without this, you're buying a normal card.
- **Correct chip type** — must match what you're cloning:
  - MIFARE Classic 1K for most access cards/fobs
  - MIFARE Classic 4K if the original is 4K
- **4-byte UID** — some cards offer 7-byte UIDs, which won't match a 4-byte original. Most access systems use 4-byte UIDs.
- **13.56 MHz / ISO 14443A** — the HF protocol. All MIFARE Classic cards use this.

**Red flags (wrong product):**
- **"MIFARE Ultralight"**, **"NTAG"**, or **"DESFire"** — different chip types entirely, won't work for Classic cloning
- **"125 kHz"** — LF frequency, completely wrong (those are for EM410x/HID Prox cloning, which uses T55x7 cards instead)
- **"Read-only"** or no mention of UID changeable — probably a regular card

**Good to know:**
- Gen1A and Gen2/CUID are both fine — keyfabe supports both automatically
- Cards come in various form factors (ISO card, fob, sticker, wristband) — pick whatever matches your use case
- Available on Amazon, AliExpress, etc. for a few dollars each. Search "MIFARE Classic 1K UID changeable" or "magic MIFARE card".
- OBO HANDS is a commonly available brand with compatible cards

### Example Compatible Product Specs

A product listing with these specs will work:
```
Frequency:    13.56 MHz
Protocol:     ISO/IEC 14443A
Chip:         MIFARE Classic 1K compatible
UID:          4-byte, changeable/writable
Memory:       1K byte, 16 sectors × 4 blocks
Rewrite:      100,000+ cycles
```

## Block 0 Format (4-byte UID MIFARE Classic)

Block 0 is the manufacturer block. On genuine cards it's read-only; on magic cards it's writable.

```
Byte:  0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
       ├─UID (4B)──┤ BCC SAK ├ATQA┤ ├──Manufacturer Data──┤
```

| Field | Bytes | Description |
|-------|-------|-------------|
| UID | 0-3 | 4-byte card identifier |
| BCC | 4 | Block Check Character = XOR of bytes 0-3 |
| SAK | 5 | Select Acknowledge — encodes card type |
| ATQA | 6-7 | Answer To Request Type A — **stored in reverse byte order** |
| Manufacturer | 8-15 | Manufacturer data (can be zeroed on clones) |

### BCC Calculation

The BCC is the XOR of all 4 UID bytes:

```
UID:  81 54 98 C5
BCC:  0x81 ^ 0x54 ^ 0x98 ^ 0xC5 = 0x88
```

An incorrect BCC will break ISO14443-3 anticollision — the card will respond to WUPA but readers cannot select it, effectively bricking it for normal use.

### SAK Values

| SAK | Card Type |
|-----|-----------|
| `0x08` | MIFARE Classic 1K |
| `0x18` | MIFARE Classic 4K |
| `0x00` | MIFARE Ultralight / NTAG |
| `0x20` | MIFARE Plus / DESFire |

### ATQA Byte Order

**Critical**: ATQA is stored in block 0 in **reverse byte order** from how it appears in `hf search` output.

| Card Type | `hf search` shows | Block 0 bytes 6-7 |
|-----------|-------------------|-------------------|
| MIFARE Classic 1K | `ATQA: 00 04` | `04 00` |
| MIFARE Classic 4K | `ATQA: 00 02` | `02 00` |

If ATQA bytes are stored in the wrong order, the card will fail anticollision even with correct BCC.

### Example Block 0

For UID `815498C5`, MIFARE Classic 1K:
```
81 54 98 C5 88 08 04 00 00 00 00 00 00 00 00 00
├─UID──────┤ │  │  ├──┤
             │  │  ATQA (00 04 reversed)
             │  SAK (Classic 1K)
             BCC (81^54^98^C5)
```

## Write Procedures by Card Type

### Gen1A

Gen1A cards have a magic backdoor (WUPC command) that allows direct UID changes. The pm3 handles block 0 construction automatically:

```sh
pm3 -c "hf mf csetuid -u 815498C5"
```

The command computes BCC, sets SAK/ATQA based on card configuration, and writes block 0 in one step. **This is the safest write method.**

### Gen2 / CUID

Gen2 cards allow writing to block 0 via normal authenticated write. You must construct block 0 manually:

```sh
# Block 0 data: UID(815498C5) + BCC(88) + SAK(08) + ATQA(0400) + padding
pm3 -c "hf mf wrbl --blk 0 -k FFFFFFFFFFFF -d 815498C5880804000000000000000000 --force"
```

**Risks**:
- Writing incorrect BCC will brick the card's anticollision
- Writing incorrect ATQA byte order will also brick anticollision
- The card must be power-cycled (removed and replaced) after block 0 write for changes to take effect

## Recovery: BCC-Bricked CUID Cards

If a Gen2/CUID card has an incorrect BCC in block 0, standard commands cannot select it. Recovery is possible using the pm3's anticollision bypass:

```sh
# 1. Configure pm3 to ignore BCC during anticollision
# 2. Write corrected block 0
# 3. Reset pm3 config to standard
pm3 -c "hf 14a config --atqa force --bcc ignore --cl2 skip --rats skip; hf mf wrbl --blk 0 -k FFFFFFFFFFFF -d <corrected-block0> --force; hf 14a config --std"
```

After writing, remove the card from the reader and place it back to power-cycle the chip. The anticollision registers are loaded from block 0 at power-up.

### Diagnosing a Bricked Card

Symptoms:
- `hf search` shows `Card doesn't support standard iso14443-3 anticollision`
- `hf 14a reader` shows `ATQA: 00 00` or garbled ATQA
- `hf mf wrbl` fails with `Auth error`
- `hf mf csetuid` fails with `wupC1 error` (expected for CUID, not a brick indicator)

Verification with raw commands:
```sh
# These work even with broken BCC:
pm3 -c "hf 14a raw -a -k -b 7 52"    # WUPA — should get ATQA response
pm3 -c "hf 14a raw -k 93 20"          # ANTICOLL — shows UID + bad BCC
```

### Automated Recovery (keyfabe)

```sh
keyfabe repair
```

The repair command automates the full recovery process: detects the issue, reads current block 0 data, computes the correct BCC, writes the fix, and verifies after power-cycle.
