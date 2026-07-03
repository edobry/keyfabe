import { Pm3Cmd } from "./constants.js";
import { decodeValueBlockBytes, findValueBlocks, type MfDump, sectorKeyA } from "./mf-data.js";
import { parseAutopwn, parseDump, parseFm11rf08sRecovery, parseReadBlock, parseRestore } from "./parsers.js";
import { pm3Exec } from "./pm3.js";

export interface MfCrackResult {
    success: boolean;
    keyFile: string;
    method: "autopwn" | "fm11rf08s";
}

export interface MfDumpResult {
    success: boolean;
    dumpFile: string;
    keyFile: string;
}

export interface MfRestoreResult {
    success: boolean;
    failedBlocks: number;
}

/** Crack all sector keys using autopwn -> fm11rf08s fallback chain. */
export async function crackKeys(_uid: string, _cardType: string): Promise<MfCrackResult | null> {
    const { stdout } = await pm3Exec(Pm3Cmd.HF_MF_AUTOPWN, 120_000);
    const result = parseAutopwn(stdout);

    if (result.success && result.keyFile) {
        return { success: true, keyFile: result.keyFile, method: "autopwn" };
    }

    // If static nonce detected, try fm11rf08s recovery (~28 min)
    if (result.staticNonce) {
        const fmCmd = Pm3Cmd.SCRIPT_RUN.arg("fm11rf08s_recovery");
        const { stdout: fmOut } = await pm3Exec(fmCmd, 2_400_000);
        const fmResult = parseFm11rf08sRecovery(fmOut);
        if (fmResult.success && fmResult.keyFile) {
            return { success: true, keyFile: fmResult.keyFile, method: "fm11rf08s" };
        }
    }

    return null;
}

/** Dump all blocks using recovered keys. */
export async function dumpCard(_uid: string, cardType: string, keyFile: string): Promise<MfDumpResult | null> {
    const sizeFlag = cardType.includes("4K") ? "--4k" : "--1k";
    const cmd = Pm3Cmd.HF_MF_DUMP.arg(sizeFlag).arg("-k", keyFile);
    const { stdout } = await pm3Exec(cmd, 60_000);
    const result = parseDump(stdout);
    if (result.success && result.dumpFile) {
        return { success: true, dumpFile: result.dumpFile, keyFile };
    }
    return null;
}

/** Read a single block with a key and decode it as a value block (null if unreadable or not a value block). */
export async function readValueBlock(block: number, key: string): Promise<number | null> {
    const cmd = Pm3Cmd.HF_MF_RDBL.arg("--blk", String(block)).arg("-k", key);
    const { stdout } = await pm3Exec(cmd);
    const { bytes } = parseReadBlock(stdout);
    return bytes ? decodeValueBlockBytes(Buffer.from(bytes, "hex")) : null;
}

export type ValueOp = "set" | "inc" | "dec";

/** Set / increment / decrement a MIFARE value block via `hf mf value`. Returns false on a reported failure. */
export async function writeValueBlock(block: number, key: string, op: ValueOp, amount: number): Promise<boolean> {
    const flag = op === "set" ? "--set" : op === "inc" ? "--inc" : "--dec";
    const cmd = Pm3Cmd.HF_MF_VALUE.arg("--blk", String(block)).arg("-k", key).arg(flag, String(amount));
    const { stdout } = await pm3Exec(cmd);
    return !/\[-\]|failed|can'?t select|error(?!rate)/i.test(stdout);
}

export interface LiveValueRead {
    blockIndex: number;
    sector: number;
    savedValue: number;
    liveValue: number | null;
    authError: boolean;
}

/**
 * Read the live card's value blocks using the keys from a saved dump, so a deep
 * verify can compare on-card balances rather than just the UID. An auth error on
 * every block means the live card doesn't hold the saved data (a UID-only clone).
 */
export async function readLiveValueBlocks(dump: MfDump): Promise<LiveValueRead[]> {
    const results: LiveValueRead[] = [];
    for (const vb of findValueBlocks(dump)) {
        const key = sectorKeyA(dump, vb.sector);
        if (!key) continue;
        const cmd = Pm3Cmd.HF_MF_RDBL.arg("--blk", String(vb.blockIndex)).arg("-k", key);
        try {
            const { stdout } = await pm3Exec(cmd);
            const { authError, bytes } = parseReadBlock(stdout);
            const liveValue = bytes ? decodeValueBlockBytes(Buffer.from(bytes, "hex")) : null;
            results.push({ blockIndex: vb.blockIndex, sector: vb.sector, savedValue: vb.value, liveValue, authError });
        } catch {
            results.push({
                blockIndex: vb.blockIndex,
                sector: vb.sector,
                savedValue: vb.value,
                liveValue: null,
                authError: true,
            });
        }
    }
    return results;
}

/** Restore all blocks to a blank magic card. */
export async function restoreCard(dumpFile: string, keyFile: string, cardType: string): Promise<MfRestoreResult> {
    const sizeFlag = cardType.includes("4K") ? "--4k" : "--1k";
    const cmd = Pm3Cmd.HF_MF_RESTORE.arg(sizeFlag).arg("-f", dumpFile).arg("-k", keyFile).arg("--force");
    const { stdout } = await pm3Exec(cmd, 60_000);
    const result = parseRestore(stdout);
    return { success: result.success, failedBlocks: result.failedBlocks };
}
