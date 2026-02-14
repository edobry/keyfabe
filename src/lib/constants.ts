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

export const Pm3Cmd = {
    LF_SEARCH: "lf search",
    HF_SEARCH: "hf search",
    LF_T55XX_DETECT: "lf t55xx detect",
    LF_EM_410X_READER: "lf em 410x reader",
    LF_HID_READER: "lf hid reader",
    HW_STATUS: "hw status",
    HW_TUNE: "hw tune",
} as const;
