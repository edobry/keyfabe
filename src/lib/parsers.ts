import { CardType, MagicCardType, type MagicCardTypeName } from "./constants.js";

export interface HwStatus {
    connected: boolean;
    firmwareVersion: string;
    isStockFirmware: boolean;
}

export interface HwTune {
    lfVoltage: number;
    hfVoltage: number;
}

export interface CardInfo {
    type: string;
    id: string;
    encoding?: string;
}

export interface T55xxInfo {
    chipType: string;
    passwordSet: boolean;
}

export interface CloneResult {
    success: boolean;
}

export function parseHwStatus(output: string): HwStatus {
    const isStockFirmware = output.includes("unknown command");
    const connected = !isStockFirmware && !output.includes("cannot communicate") && !output.includes("ERROR");
    const fwMatch =
        output.match(/firmware[^:]*:\s*(.+)/i) ??
        output.match(/os:\s*(.+)/i) ??
        output.match(/bootrom:\s*(.+)/i) ??
        output.match(/mode\.+\s*(.+)/i);
    const firmwareVersion = fwMatch?.[1]?.trim() ?? "unknown";
    return { connected, firmwareVersion, isStockFirmware };
}

export function parseHwTune(output: string): HwTune {
    const lfMatch = output.match(/125(?:\.00)?\s*kHz[^\d]*([\d.]+)\s*V/i);
    const hfMatch = output.match(/13\.56\s*MHz[^\d]*([\d.]+)\s*V/i);
    return {
        lfVoltage: lfMatch ? parseFloat(lfMatch[1]) : 0,
        hfVoltage: hfMatch ? parseFloat(hfMatch[1]) : 0,
    };
}

export function parseLfSearch(output: string): CardInfo | null {
    // EM410x
    const emMatch = output.match(/EM\s*410x\s*(?:ID|Tag ID)\s*[:\s]*([0-9A-Fa-f]{10})/i);
    if (emMatch) {
        const encodingMatch = output.match(/RF\/(\d+)/);
        return {
            type: CardType.EM410x,
            id: emMatch[1].toUpperCase(),
            encoding: encodingMatch ? `RF/${encodingMatch[1]}` : undefined,
        };
    }

    // HID Prox
    const hidMatch = output.match(/HID\s*Prox\s*(?:TAG\s*)?ID\s*[:\s]*([0-9A-Fa-f]+)/i);
    if (hidMatch) {
        return {
            type: CardType.HID_PROX,
            id: hidMatch[1].toUpperCase(),
        };
    }

    return null;
}

export function parseT55xxDetect(output: string): T55xxInfo | null {
    const chipMatch = output.match(/Chip\s*Type\s*[:\s]*(T55\w+)/i) ?? output.match(/(T55\w+)\s*(?:found|detected)/i);
    if (!chipMatch) {
        // Also check for general detection success
        if (!output.includes("T55") && !output.includes("t55")) {
            return null;
        }
    }

    const passwordSet = /password\s*(?:is\s*)?set/i.test(output) || /password\s*[:\s]*yes/i.test(output);

    return {
        chipType: chipMatch?.[1] ?? "T55x7",
        passwordSet,
    };
}

export function parseHfSearch(output: string): CardInfo | null {
    // Extract UID — formats: "UID: AB CD EF 01" or "UID: ABCDEF01" or "UID[4]: AB CD EF 01"
    const uidMatch = output.match(/UID\s*(?:\[\d+\])?\s*[:=]\s*([0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})*)/i);
    if (!uidMatch) return null;

    const uid = uidMatch[1].replace(/\s+/g, "").toUpperCase();

    // Determine card type from SAK, ATQA, or text
    let type: string = CardType.ISO_14443A;

    if (/MIFARE\s*Classic.*4K/i.test(output)) {
        type = CardType.MIFARE_CLASSIC_4K;
    } else if (/MIFARE\s*Classic/i.test(output)) {
        type = CardType.MIFARE_CLASSIC_1K;
    } else if (/MIFARE\s*Ultralight|NTAG/i.test(output)) {
        type = CardType.MIFARE_ULTRALIGHT;
    } else if (/MIFARE\s*DESFire/i.test(output)) {
        type = CardType.MIFARE_DESFIRE;
    }

    return { type, id: uid };
}

/** Check if hf search output shows a card present but with broken anticollision. */
export function detectBrickedHf(output: string): boolean {
    return /anticollision|can'?t select/i.test(output);
}

export function parseMagicType(output: string): MagicCardTypeName {
    if (/Gen\s*1\s*a|magic\s*backdoor/i.test(output)) return MagicCardType.GEN1A;
    if (/Gen\s*2|CUID/i.test(output)) return MagicCardType.GEN2_CUID;
    if (/anticollision|can'?t select/i.test(output)) return MagicCardType.BRICKED;
    return MagicCardType.UNKNOWN;
}

export function parseBlock0Data(output: string): string | null {
    // Matches rdbl output: "0 | 81 54 98 C5 88 08 04 00 ..."
    const match = output.match(/\|\s*([0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2}){15})\s*\|/);
    if (!match) return null;
    return match[1].replace(/\s+/g, "").toUpperCase();
}

export interface ReadBlockResult {
    authError: boolean;
    bytes: string | null;
}

/** Parse `hf mf rdbl` output: extract the 16 data bytes, or flag an authentication failure. */
export function parseReadBlock(output: string): ReadBlockResult {
    const authError = /auth\s*error|can'?t\s*read|cannot\s*read|read\s*block\s*failed|error=/i.test(output);
    const bytes = parseBlock0Data(output);
    return { authError, bytes };
}

export function parseCloneResult(output: string): CloneResult {
    const hasError = /error/i.test(output) && !/errorrate/i.test(output);
    const hasDone =
        /done/i.test(output) || /written/i.test(output) || /cloned/i.test(output) || /verified/i.test(output);
    return { success: !hasError && hasDone };
}

export interface AutopwnResult {
    success: boolean;
    keyFile: string | null;
    staticNonce: boolean;
}

export function parseAutopwn(output: string): AutopwnResult {
    const staticNonce = /static encrypted nonce/i.test(output);
    const keyFileMatch =
        output.match(/saved\s+to\s+(?:file\s+)?(\S+\.bin)/i) ??
        output.match(/keys\s+(?:saved|dumped)\s+(?:to\s+)?(\S+\.bin)/i) ??
        output.match(/(\S+hf-mf-[0-9A-Fa-f]+-key\.bin)/i);
    const keyFile = keyFileMatch?.[1] ?? null;
    const success = keyFile !== null && !staticNonce;
    return { success, keyFile, staticNonce };
}

export interface DumpResult {
    success: boolean;
    dumpFile: string | null;
}

export function parseDump(output: string): DumpResult {
    const dumpFileMatch =
        output.match(/saved\s+(?:\d+\s+blocks?\s+)?to\s+(?:file\s+)?(\S+\.bin)/i) ??
        output.match(/(\S+hf-mf-[0-9A-Fa-f]+-dump\.bin)/i);
    const dumpFile = dumpFileMatch?.[1] ?? null;
    const hasError = /error/i.test(output) && !/errorrate/i.test(output);
    return { success: dumpFile !== null && !hasError, dumpFile };
}

export interface RestoreResult {
    success: boolean;
    failedBlocks: number;
}

export function parseRestore(output: string): RestoreResult {
    const failedMatch = output.match(/(\d+)\s+blocks?\s+failed/i);
    const failedBlocks = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const hasError = /error/i.test(output) && !/errorrate/i.test(output);
    const hasDone = /done/i.test(output) || /restored/i.test(output) || /wrote/i.test(output);
    const success = !hasError && hasDone && failedBlocks === 0;
    return { success, failedBlocks };
}

export interface Fm11rf08sResult {
    success: boolean;
    keyFile: string | null;
}

export function parseFm11rf08sRecovery(output: string): Fm11rf08sResult {
    const keyFileMatch =
        output.match(/saved\s+to\s+(?:file\s+)?(\S+\.bin)/i) ??
        output.match(/keys\s+(?:saved|dumped)\s+(?:to\s+)?(\S+\.bin)/i) ??
        output.match(/(\S+hf-mf-[0-9A-Fa-f]+-key\.bin)/i);
    const keyFile = keyFileMatch?.[1] ?? null;
    const hasError = /error/i.test(output) && !/errorrate/i.test(output);
    return { success: keyFile !== null && !hasError, keyFile };
}
