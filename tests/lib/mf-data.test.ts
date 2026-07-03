import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    decodeValueBlockBytes,
    findAsciiStrings,
    findValueBlocks,
    isSectorTrailer,
    loadDumpFile,
    locateDumpFile,
    MF_1K_BLOCKS,
    MF_1K_SIZE,
    MF_4K_SIZE,
    parseMfDump,
    parseValueBlock,
    sectorKeyA,
    sectorOf,
} from "../../src/lib/mf-data.js";

/** Build a MIFARE Classic value block for `value` and `addr`. */
function makeValueBlock(value: number, addr = 0): Buffer {
    const b = Buffer.alloc(16);
    b.writeInt32LE(value, 0);
    b.writeInt32LE(~value | 0, 4);
    b.writeInt32LE(value, 8);
    b.writeUInt8(addr, 12);
    b.writeUInt8(~addr & 0xff, 13);
    b.writeUInt8(addr, 14);
    b.writeUInt8(~addr & 0xff, 15);
    return b;
}

function makeBlock(...bytes: number[]): Buffer {
    return Buffer.from(bytes);
}

/** Construct a 1K dump where the caller can inject specific blocks by index. */
function build1KDump(overrides: Record<number, Buffer> = {}): Buffer {
    const buf = Buffer.alloc(MF_1K_SIZE);
    for (const [idx, blk] of Object.entries(overrides)) {
        const i = parseInt(idx, 10);
        blk.copy(buf, i * 16);
    }
    return buf;
}

describe("sectorKeyA", () => {
    it("returns Key A from a sector's trailer block", () => {
        // Sector 4's trailer is block 19; Key A is the first 6 bytes.
        const trailer = makeBlock(0xec, 0x19, 0x5d, 0x46, 0xd5, 0x5d, 0xff, 0x07, 0x80, 0x69, 0, 0, 0, 0, 0, 0);
        const dump = parseMfDump(build1KDump({ 19: trailer }));
        expect(sectorKeyA(dump, 4)).toBe("EC195D46D55D");
    });

    it("returns null for a sector with no trailer in the dump", () => {
        const dump = parseMfDump(build1KDump());
        // sector 99 does not exist in a 1K dump
        expect(sectorKeyA(dump, 99)).toBeNull();
    });
});

describe("decodeValueBlockBytes", () => {
    it("decodes a valid value block", () => {
        expect(decodeValueBlockBytes(makeValueBlock(225))).toBe(225);
        expect(decodeValueBlockBytes(makeValueBlock(2000))).toBe(2000);
    });

    it("returns null for a non-value block", () => {
        expect(decodeValueBlockBytes(makeBlock(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16))).toBeNull();
    });

    it("returns null for wrong-length input", () => {
        expect(decodeValueBlockBytes(Buffer.alloc(8))).toBeNull();
    });
});

describe("sectorOf / isSectorTrailer", () => {
    it("maps 1K blocks to 16 sectors of 4 blocks", () => {
        expect(sectorOf(0)).toBe(0);
        expect(sectorOf(3)).toBe(0);
        expect(sectorOf(4)).toBe(1);
        expect(sectorOf(63)).toBe(15);
    });

    it("flags every 4th block as a sector trailer in 1K range", () => {
        expect(isSectorTrailer(3)).toBe(true);
        expect(isSectorTrailer(7)).toBe(true);
        expect(isSectorTrailer(63)).toBe(true);
        expect(isSectorTrailer(0)).toBe(false);
        expect(isSectorTrailer(16)).toBe(false);
    });

    it("handles 4K extended sectors (16-block sectors past block 128)", () => {
        expect(sectorOf(128)).toBe(32);
        expect(sectorOf(143)).toBe(32);
        expect(sectorOf(144)).toBe(33);
        expect(isSectorTrailer(143)).toBe(true);
        expect(isSectorTrailer(159)).toBe(true);
        expect(isSectorTrailer(128)).toBe(false);
    });
});

describe("parseMfDump", () => {
    it("parses a 1K dump into 64 blocks", () => {
        const dump = parseMfDump(Buffer.alloc(MF_1K_SIZE));
        expect(dump.sizeBytes).toBe(MF_1K_SIZE);
        expect(dump.blocks).toHaveLength(MF_1K_BLOCKS);
        expect(dump.blocks[3].isTrailer).toBe(true);
    });

    it("parses a 4K dump", () => {
        const dump = parseMfDump(Buffer.alloc(MF_4K_SIZE));
        expect(dump.sizeBytes).toBe(MF_4K_SIZE);
        expect(dump.blocks).toHaveLength(256);
    });

    it("rejects unexpected sizes", () => {
        expect(() => parseMfDump(Buffer.alloc(512))).toThrow(/Unexpected dump size/);
    });
});

describe("parseValueBlock", () => {
    it("decodes a valid value block", () => {
        // Block 16 from the real laundry card dump: value=1150, addr=0
        const buf = build1KDump({
            16: makeBlock(
                0x7e,
                0x04,
                0x00,
                0x00,
                0x81,
                0xfb,
                0xff,
                0xff,
                0x7e,
                0x04,
                0x00,
                0x00,
                0x00,
                0xff,
                0x00,
                0xff,
            ),
        });
        const dump = parseMfDump(buf);
        const vb = parseValueBlock(dump.blocks[16]);
        expect(vb).toEqual({ blockIndex: 16, sector: 4, value: 1150, addr: 0 });
    });

    it("decodes value=2000 (laundry block 18)", () => {
        const buf = build1KDump({
            18: makeBlock(
                0xd0,
                0x07,
                0x00,
                0x00,
                0x2f,
                0xf8,
                0xff,
                0xff,
                0xd0,
                0x07,
                0x00,
                0x00,
                0x00,
                0xff,
                0x00,
                0xff,
            ),
        });
        const dump = parseMfDump(buf);
        const vb = parseValueBlock(dump.blocks[18]);
        expect(vb?.value).toBe(2000);
    });

    it("recognizes value=0 with valid integrity", () => {
        const buf = build1KDump({
            17: makeBlock(
                0x00,
                0x00,
                0x00,
                0x00,
                0xff,
                0xff,
                0xff,
                0xff,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0xff,
                0x00,
                0xff,
            ),
        });
        const dump = parseMfDump(buf);
        expect(parseValueBlock(dump.blocks[17])?.value).toBe(0);
    });

    it("rejects blocks that fail value integrity", () => {
        const buf = build1KDump({ 16: Buffer.alloc(16, 0x42) });
        const dump = parseMfDump(buf);
        expect(parseValueBlock(dump.blocks[16])).toBeNull();
    });

    it("rejects sector trailers even if data looks like a value block", () => {
        const buf = build1KDump({ 3: makeValueBlock(42) });
        const dump = parseMfDump(buf);
        expect(parseValueBlock(dump.blocks[3])).toBeNull();
    });
});

describe("findValueBlocks", () => {
    it("finds all three value blocks in the laundry sector 4", () => {
        const buf = build1KDump({
            16: makeValueBlock(1150),
            17: makeValueBlock(0),
            18: makeValueBlock(2000),
        });
        const found = findValueBlocks(parseMfDump(buf));
        expect(found.map((v) => v.value)).toEqual([1150, 0, 2000]);
        expect(found.every((v) => v.sector === 4)).toBe(true);
    });
});

describe("findAsciiStrings", () => {
    it("extracts the UINHOUSELAU marker from block 1", () => {
        // 55 49 4E 48 4F 55 53 45 4C 41 55 = "UINHOUSELAU"
        const buf = build1KDump({
            1: makeBlock(0x55, 0x49, 0x4e, 0x48, 0x4f, 0x55, 0x53, 0x45, 0x4c, 0x41, 0x55, 0, 0, 0, 0x06, 0x08),
        });
        const runs = findAsciiStrings(parseMfDump(buf), 4);
        expect(runs).toHaveLength(1);
        expect(runs[0].text).toBe("UINHOUSELAU");
        expect(runs[0].blockIndex).toBe(1);
    });

    it("ignores runs shorter than minLength", () => {
        const buf = build1KDump({
            1: makeBlock(0x41, 0x42, 0, 0x43, 0x44, 0x45, 0x46, 0x47, 0, 0, 0, 0, 0, 0, 0, 0),
        });
        const runs = findAsciiStrings(parseMfDump(buf), 4);
        expect(runs.map((r) => r.text)).toEqual(["CDEFG"]);
    });

    it("does not scan sector trailers (they hold keys, not text)", () => {
        // Block 3 is a trailer; even if it has ASCII bytes, skip it.
        const buf = build1KDump({
            3: makeBlock(
                0x41,
                0x42,
                0x43,
                0x44,
                0x45,
                0x46,
                0xff,
                0x07,
                0x80,
                0x69,
                0x47,
                0x48,
                0x49,
                0x4a,
                0x4b,
                0x4c,
            ),
        });
        const runs = findAsciiStrings(parseMfDump(buf), 4);
        expect(runs).toEqual([]);
    });
});

describe("locateDumpFile + loadDumpFile", () => {
    let dir: string;
    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "mfdata-"));
    });
    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("returns explicit path when provided and exists", async () => {
        const path = join(dir, "explicit.bin");
        await writeFile(path, Buffer.alloc(MF_1K_SIZE));
        expect(await locateDumpFile("DEADBEEF", path)).toBe(path);
    });

    it("returns null when no dump exists anywhere", async () => {
        // A UID nothing on disk should match
        expect(await locateDumpFile("ZZZZZZZZ-NOPE")).toBeNull();
    });

    it("loadDumpFile reads a binary dump", async () => {
        const path = join(dir, "load.bin");
        const buf = build1KDump({ 16: makeValueBlock(1150) });
        await writeFile(path, buf);
        const dump = await loadDumpFile(path);
        expect(dump.blocks).toHaveLength(MF_1K_BLOCKS);
        expect(findValueBlocks(dump)[0].value).toBe(1150);
    });
});
