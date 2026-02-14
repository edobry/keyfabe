export const CardType = {
    EM410x: "EM410x",
    HID_PROX: "HID Prox",
    MIFARE_CLASSIC_1K: "MIFARE Classic 1K",
    MIFARE_CLASSIC_4K: "MIFARE Classic 4K",
    MIFARE_ULTRALIGHT: "MIFARE Ultralight",
    MIFARE_DESFIRE: "MIFARE DESFire",
    ISO_14443A: "ISO 14443-A",
} as const;

export type CardTypeName = (typeof CardType)[keyof typeof CardType];

export function cardFrequency(type: string): "LF" | "HF" {
    switch (type) {
        case CardType.EM410x:
        case CardType.HID_PROX:
            return "LF";
        default:
            return "HF";
    }
}

export const WriteTarget = {
    LF: "blank T55x7 tag",
    HF: "Gen1A magic card",
} as const;

export class Pm3Command {
    readonly parts: readonly string[];

    constructor(...parts: string[]) {
        this.parts = parts;
    }

    arg(flag: string, value?: string): Pm3Command {
        return value !== undefined ? new Pm3Command(...this.parts, flag, value) : new Pm3Command(...this.parts, flag);
    }

    toString(): string {
        return this.parts.join(" ");
    }
}

export const Pm3Cmd = {
    LF_SEARCH: new Pm3Command("lf", "search"),
    HF_SEARCH: new Pm3Command("hf", "search"),
    LF_T55XX_DETECT: new Pm3Command("lf", "t55xx", "detect"),
    LF_EM_410X_READER: new Pm3Command("lf", "em", "410x", "reader"),
    LF_EM_410X_CLONE: new Pm3Command("lf", "em", "410x", "clone"),
    LF_HID_READER: new Pm3Command("lf", "hid", "reader"),
    LF_HID_CLONE: new Pm3Command("lf", "hid", "clone"),
    HF_MF_CSETUID: new Pm3Command("hf", "mf", "csetuid"),
    HW_STATUS: new Pm3Command("hw", "status"),
    HW_TUNE: new Pm3Command("hw", "tune"),
} as const;
