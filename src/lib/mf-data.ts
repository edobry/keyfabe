import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const MF_BLOCK_SIZE = 16;
export const MF_1K_BLOCKS = 64;
export const MF_4K_BLOCKS = 256;
export const MF_1K_SIZE = MF_1K_BLOCKS * MF_BLOCK_SIZE;
export const MF_4K_SIZE = MF_4K_BLOCKS * MF_BLOCK_SIZE;

export interface MfBlock {
    index: number;
    sector: number;
    isTrailer: boolean;
    bytes: Buffer;
}

export interface MfDump {
    blocks: MfBlock[];
    sizeBytes: number;
}

export interface ValueBlock {
    blockIndex: number;
    sector: number;
    value: number;
    addr: number;
}

export interface AsciiRun {
    blockIndex: number;
    offset: number;
    text: string;
}

/** MIFARE Classic 1K has 16 sectors of 4 blocks. 4K has 32×4 + 8×16 sectors. */
export function sectorOf(block: number): number {
    if (block < 128) return Math.floor(block / 4);
    return 32 + Math.floor((block - 128) / 16);
}

export function isSectorTrailer(block: number): boolean {
    if (block < 128) return block % 4 === 3;
    return (block - 128) % 16 === 15;
}

export function parseMfDump(buf: Buffer): MfDump {
    if (buf.length !== MF_1K_SIZE && buf.length !== MF_4K_SIZE) {
        throw new Error(`Unexpected dump size: ${buf.length} bytes (expected ${MF_1K_SIZE} or ${MF_4K_SIZE})`);
    }
    const blocks: MfBlock[] = [];
    const totalBlocks = buf.length / MF_BLOCK_SIZE;
    for (let i = 0; i < totalBlocks; i++) {
        const start = i * MF_BLOCK_SIZE;
        blocks.push({
            index: i,
            sector: sectorOf(i),
            isTrailer: isSectorTrailer(i),
            bytes: buf.subarray(start, start + MF_BLOCK_SIZE),
        });
    }
    return { blocks, sizeBytes: buf.length };
}

/**
 * MIFARE Classic value block layout:
 *   value (4B LE) | ~value (4B LE) | value (4B LE) | addr | ~addr | addr | ~addr
 *
 * Returns null if the block does not satisfy the integrity invariants.
 * Skips trailers (which contain keys, not data).
 */
export function parseValueBlock(block: MfBlock): ValueBlock | null {
    if (block.isTrailer) return null;
    const b = block.bytes;
    const v1 = b.readInt32LE(0);
    const v2 = b.readInt32LE(4);
    const v3 = b.readInt32LE(8);
    const a1 = b.readUInt8(12);
    const a2 = b.readUInt8(13);
    const a3 = b.readUInt8(14);
    const a4 = b.readUInt8(15);

    const valueOk = v1 === v3 && (~v1 | 0) === v2;
    const addrOk = a1 === a3 && a2 === a4 && a1 === (~a2 & 0xff);
    if (!valueOk || !addrOk) return null;

    return { blockIndex: block.index, sector: block.sector, value: v1, addr: a1 };
}

export function findValueBlocks(dump: MfDump): ValueBlock[] {
    const out: ValueBlock[] = [];
    for (const block of dump.blocks) {
        const vb = parseValueBlock(block);
        if (vb) out.push(vb);
    }
    return out;
}

/** Find printable ASCII runs of length >= minLength. Skips sector trailers. */
export function findAsciiStrings(dump: MfDump, minLength = 4): AsciiRun[] {
    const runs: AsciiRun[] = [];
    for (const block of dump.blocks) {
        if (block.isTrailer) continue;
        const b = block.bytes;
        let start = -1;
        for (let i = 0; i <= b.length; i++) {
            const ch = i < b.length ? b[i] : 0;
            const printable = ch >= 0x20 && ch <= 0x7e;
            if (printable) {
                if (start < 0) start = i;
            } else {
                if (start >= 0 && i - start >= minLength) {
                    runs.push({
                        blockIndex: block.index,
                        offset: start,
                        text: b.subarray(start, i).toString("ascii"),
                    });
                }
                start = -1;
            }
        }
    }
    return runs;
}

/**
 * Locate a dump file for the given UID. Search order:
 *   1. explicitPath (from tag.dumpFile, if set)
 *   2. ~/hf-mf-<UID>-dump.bin (pm3 default save path)
 *   3. CWD/hf-mf-<UID>-dump.bin
 */
export async function locateDumpFile(uid: string, explicitPath?: string): Promise<string | null> {
    const candidates: string[] = [];
    if (explicitPath) candidates.push(explicitPath);
    candidates.push(join(homedir(), `hf-mf-${uid}-dump.bin`));
    candidates.push(join(process.cwd(), `hf-mf-${uid}-dump.bin`));
    for (const path of candidates) {
        try {
            await access(path);
            return path;
        } catch {
            // try next
        }
    }
    return null;
}

export async function loadDumpFile(path: string): Promise<MfDump> {
    const buf = await readFile(path);
    return parseMfDump(buf);
}
