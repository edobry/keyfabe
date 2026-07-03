# Stored-Value MIFARE Cards (Laundry, Vending, Transit)

This document captures protocol- and system-level knowledge about MIFARE Classic cards that store a **balance on the card itself**, learned through real-world debugging with keyfabe and a Proxmark3.

## Two families of card systems

| Family | Where the balance lives | What the card must carry | Clone requirement |
|--------|-------------------------|--------------------------|-------------------|
| **Offline stored-value** | On the card, in MIFARE value blocks | UID **+ sector keys + value blocks + vendor data** | Full-card clone |
| **Online / account-based** | On a server, keyed by UID | Just the UID (sometimes a card number) | UID-only clone may suffice |

A quick way to tell which one you have: dump the card and look for **value blocks** with plausible dollar amounts (see below). If they're present and change as you spend, it's an offline stored-value system — the money is on the card.

## MIFARE value block format

A MIFARE Classic value block is a 16-byte block with a specific, self-checking layout:

```
value (4B LE) | ~value (4B LE) | value (4B LE) | addr | ~addr | addr | ~addr
```

- The value is stored three times: twice straight and once bitwise-inverted, so a reader can detect corruption.
- The trailing 4 bytes are an address and its complement, repeated.

keyfabe decodes these in `inspect` and `verify --deep` (`parseValueBlock` / `decodeValueBlockBytes` in `src/lib/mf-data.ts`). A block only counts as a value block if it passes the redundancy invariants — random data won't be misread as a balance.

Example, a real laundry card's balance block (`$2.25`):

```
E1 00 00 00 1E FF FF FF E1 00 00 00 00 FF 00 FF
└─ 0x000000E1 = 225 ─┘  └ ~225 ┘  └ 225 ┘  addr bytes
```

## Full clone vs UID-only clone — the trap

There are two very different things people call "cloning" a MIFARE card:

- **Full clone** — copy the UID **and** every sector (keys + data + value blocks). Requires cracking the card's sector keys, dumping all blocks, and restoring them to a magic card. This is what `keyfabe clone` does for MIFARE Classic, and what makes a working stored-value card.
- **UID-only clone** — copy just the UID onto a magic card, leaving factory-default keys and empty data. This is all that's needed for a UID/account-based system, but for a stored-value card it produces a **hollow card**.

A UID-only clone is dangerous precisely because it *looks* right:

| | Full clone | UID-only clone |
|---|---|---|
| UID | correct | correct |
| Sector keys | custom (operator's) | factory default `FFFFFFFFFFFF` |
| Value blocks / vendor data | present | all zero |
| `keyfabe verify` (UID only) | ✅ passes | ✅ **passes (misleading)** |
| At a stored-value reader | works | **"format error"** |

The reader authenticates its data sector with the operator's keys and expects its format there. A UID-only clone has default keys and empty blocks, so the reader can't find its structure → a generic **format error** (not "insufficient funds").

### Telling them apart

- `keyfabe identify` — reads the card, matches it against all saved identities, and probes data fidelity (`probeMifareDataFidelity`): reading a data block with the default key. A default-key rejection means custom keys → real data; an all-zero read means a blank/UID-only clone.
- `keyfabe verify --deep <name>` — for an identity with a saved dump, reads the live value blocks with the saved keys and reports the current balance; **fails** if nothing is readable under those keys.
- `keyfabe list` / `show` — flag a saved identity as `full` or `uid-only` based on whether a dump is on file.

## Why a card that "worked yesterday" can fail

If a card that genuinely worked now throws a format error and its data still looks valid, the problem usually isn't the card — the system changed its mind about it. Even a **perfect** full clone can be rejected by systems that do:

- **Originality signatures** — genuine NXP silicon answers a challenge that magic clones can't reproduce.
- **Transaction MAC / counter** — a cryptographic signature or monotonic counter over the balance; a restored older snapshot fails validation or reads as a rollback.
- **Server-side reconciliation** — a networked reader compares the card's balance/counter against the last value it recorded for that UID and rejects mismatches.

**keyfabe cannot defeat these, and shouldn't be expected to.** For stored-value/transit cards, treat a working clone as best-effort, and expect that writing an old balance back (via full restore or `keyfabe value`) may be caught by a system that tracks state off-card.

## Working with the balance directly

`keyfabe value <name> --block <n> [--get | --set X | --inc X | --dec X]` reads or writes a value block directly (wrapping pm3's `hf mf value`). It sources the sector key from the named identity's saved dump, or takes an explicit `--key`.

This is a tool for **your own card** — restoring or correcting a balance you own. On a naive offline system a `--set` sticks; on any system with the protections above it will likely be rejected or reverted. keyfabe warns and asks for confirmation before writing.

## Related

- `docs/magic-cards.md` — magic card types and how the UID/block 0 gets written.
- `src/lib/mf-data.ts` — value-block parsing, dump loading, sector-key extraction.
- `src/lib/mf-ops.ts` — key cracking, full dump/restore, live value-block reads.
