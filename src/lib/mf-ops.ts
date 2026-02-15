import { Pm3Cmd } from "./constants.js";
import { parseAutopwn, parseDump, parseFm11rf08sRecovery, parseRestore } from "./parsers.js";
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

/** Restore all blocks to a blank magic card. */
export async function restoreCard(dumpFile: string, keyFile: string, cardType: string): Promise<MfRestoreResult> {
    const sizeFlag = cardType.includes("4K") ? "--4k" : "--1k";
    const cmd = Pm3Cmd.HF_MF_RESTORE.arg(sizeFlag).arg("-f", dumpFile).arg("-k", keyFile).arg("--force");
    const { stdout } = await pm3Exec(cmd, 60_000);
    const result = parseRestore(stdout);
    return { success: result.success, failedBlocks: result.failedBlocks };
}
