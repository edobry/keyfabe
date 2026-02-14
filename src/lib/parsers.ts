import { CardType } from "./constants.js";

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

export function parseCloneResult(output: string): CloneResult {
    const hasError = /error/i.test(output) && !/errorrate/i.test(output);
    const hasDone =
        /done/i.test(output) || /written/i.test(output) || /cloned/i.test(output) || /verified/i.test(output);
    return { success: !hasError && hasDone };
}
