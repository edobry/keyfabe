# Proxmark3 Easy: Keyfob Cloning Session Log

## Hardware

- **Device:** Proxmark3 Easy (256KB flash, PM3GENERIC)
- **Host:** macOS (Apple Silicon)
- **Connection:** USB-C via hub

## Software Setup

Installed the Iceman/RRG Proxmark3 client via Homebrew:

```sh
brew tap rfidresearchgroup/proxmark3
brew install proxmark3
```

## Pitfall 1: Firmware Mismatch

The Proxmark3 Easy ships with stock/factory firmware that is incompatible with the Iceman client. Connecting with `pm3 -c "hw status"` produces:

```
unknown command:: 0x61334d50
ERROR: cannot communicate with the Proxmark3
```

**Fix:** Flash the Iceman firmware onto the device (see below).

## Pitfall 2: Firmware Too Large for 256KB Flash

The default Homebrew build targets the Proxmark3 RDV4 which has 512KB flash. The Proxmark3 Easy only has 256KB. Attempting to flash produces:

```
Error: PHDR is not contained in Flash
Firmware is probably too big for your device
```

Homebrew offers a `--with-small` flag:

```sh
brew reinstall --with-generic --with-small rfidresearchgroup/proxmark3/proxmark3
```

However, as of v4.20728 this flag has a bug — the formula passes `PLATFORM_SIZE=256` inside a multiline string that `make` doesn't parse correctly, so the firmware is still built at 512KB size.

**Fix:** Build the firmware from source with explicit flags.

## Building 256KB Firmware from Source

Extract the source from Homebrew's cache and build manually:

```sh
# find the cached tarball
TARBALL=$(brew --cache rfidresearchgroup/proxmark3/proxmark3)

# extract
mkdir -p /tmp/pm3build && cd /tmp/pm3build
tar xzf "$TARBALL" --strip-components=1

# clean and build firmware only (not the client)
make clean PLATFORM=PM3GENERIC PLATFORM_SIZE=256

make -j4 bootrom fullimage \
  PLATFORM=PM3GENERIC \
  PLATFORM_SIZE=256 \
  SKIP_HITAG=1 \
  SKIP_LEGICRF=1 \
  SKIP_EM4x50=1 \
  SKIP_EM4x70=1 \
  SKIP_ICLASS=1 \
  SKIP_FELICA=1 \
  SKIP_HFPLOT=1 \
  SKIP_HFSNIFF=1 \
  SKIP_NFCBARCODE=1 \
  SKIP_ZX8211=1 \
  SKIP_ISO15693=1 \
  SKIP_ISO14443b=1
```

This strips unnecessary protocols to fit within 256KB while retaining EM410x and core LF/HF support.

## Flashing

```sh
proxmark3 /dev/tty.usbmodem21401 --flash --unlock-bootloader \
  --image /tmp/pm3build/bootrom/obj/bootrom.elf \
  --image /tmp/pm3build/armsrc/obj/fullimage.elf
```

- `--unlock-bootloader` is required when coming from stock firmware
- The serial port name changes after flashing (e.g. `/dev/tty.usbmodemiceman1`)
- If flash is interrupted, hold the button while plugging in to enter recovery mode

## Verifying the Device

```sh
# check communication
pm3 -c "hw status"

# test antenna tuning (no card on antenna)
pm3 -c "hw tune"
```

LF antenna should read >15V at 125 kHz. HF antenna should read >10V at 13.56 MHz.

## Cloning an EM410x Keyfob

### 1. Read the original

Place original keyfob on the LF antenna (large coil side, opposite USB port):

```sh
pm3 -c "lf search"
```

This identifies the card type and ID. For EM410x it outputs something like:

```
EM 410x ID 040064DACA
```

### 2. Detect the blank

Swap to a blank T55x7 card/fob:

```sh
pm3 -c "lf t55xx detect"
```

Confirms it's a writable T55x7 with no password set.

### 3. Clone

```sh
pm3 -c "lf em 410x clone --id 040064DACA"
```

### 4. Verify

```sh
pm3 -c "lf em 410x reader"
```

Should read back the same ID as the original.
