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
    HF: "magic card (Gen1A or Gen2/CUID)",
} as const;

export const DetectionKind = {
    BLANK_T55X7: "blank_t55x7",
    BRICKED_HF: "bricked_hf",
    NONE: "none",
} as const;

export type DetectionKindName = (typeof DetectionKind)[keyof typeof DetectionKind];

export const DetectionSummary = {
    blank_t55x7: "Blank T55x7 detected (no cloned data).",
    bricked_hf: "Card detected but anticollision failed.",
    none: "No tag detected.",
} as const;

export const DetectionHint = {
    blank_t55x7: "This is a blank T55x7 — it has no data yet. Use `keyfabe write` to program an LF identity onto it.",
    bricked_hf:
        "An HF card was detected but anticollision failed — it may have a corrupted block 0.\nRun `keyfabe repair` to fix it.",
    none: "Make sure the tag is flat against the antenna.",
} as const;

export const WriteHint = {
    not_magic:
        'This is a regular MIFARE Classic card with a factory-locked UID.\nOnly "magic" cards (Gen1A or Gen2/CUID) allow UID changes.',
    wrong_freq_lf_got_hf:
        "Detected an HF card, but this identity requires a blank T55x7 (LF) tag.\nRemove this card and place a T55x7 on the antenna.",
} as const;

export const MagicCardType = {
    GEN1A: "Gen1A",
    GEN2_CUID: "Gen2/CUID",
    BRICKED: "bricked",
    UNKNOWN: "unknown",
} as const;

export type MagicCardTypeName = (typeof MagicCardType)[keyof typeof MagicCardType];

export class Pm3Command {
    readonly parts: readonly string[];

    constructor(...parts: string[]) {
        this.parts = parts;
    }

    /** Extend this command path with a subcommand. */
    sub(name: string): Pm3Command {
        return new Pm3Command(...this.parts, name);
    }

    /** Append a flag (and optional value) as runtime arguments. */
    arg(flag: string, value?: string): Pm3Command {
        return value !== undefined ? new Pm3Command(...this.parts, flag, value) : new Pm3Command(...this.parts, flag);
    }

    /** Chain multiple commands into a single pm3 session (separated by `;`). */
    static chain(...commands: Pm3Command[]): Pm3Command {
        const parts: string[] = [];
        for (let i = 0; i < commands.length; i++) {
            if (i > 0) parts.push(";");
            parts.push(...commands[i].parts);
        }
        return new Pm3Command(...parts);
    }

    toString(): string {
        return this.parts.join(" ");
    }
}

// Shared command path segments — each string appears exactly once
const lf = new Pm3Command("lf");
const hf = new Pm3Command("hf");
const hw = new Pm3Command("hw");

const em410x = lf.sub("em").sub("410x");
const hid = lf.sub("hid");
const mf = hf.sub("mf");

const hf14a = hf.sub("14a");

export const Pm3Cmd = {
    LF_SEARCH: lf.sub("search"),
    HF_SEARCH: hf.sub("search"),
    LF_T55XX_DETECT: lf.sub("t55xx").sub("detect"),
    LF_EM_410X_READER: em410x.sub("reader"),
    LF_EM_410X_CLONE: em410x.sub("clone"),
    LF_HID_READER: hid.sub("reader"),
    LF_HID_CLONE: hid.sub("clone"),
    HF_MF_CSETUID: mf.sub("csetuid"),
    HF_MF_WRBL: mf.sub("wrbl"),
    HF_MF_RDBL: mf.sub("rdbl"),
    HF_14A_CONFIG: hf14a.sub("config"),
    HW_STATUS: hw.sub("status"),
    HW_TUNE: hw.sub("tune"),
} as const;
