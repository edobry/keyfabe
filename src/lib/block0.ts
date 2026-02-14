import { CardType } from "./constants.js";

/** SAK byte values for MIFARE Classic card types. */
const SAK: Record<string, number> = {
    [CardType.MIFARE_CLASSIC_1K]: 0x08,
    [CardType.MIFARE_CLASSIC_4K]: 0x18,
};

/** ATQA bytes as stored in block 0 (reversed from on-wire order). */
const ATQA: Record<string, [number, number]> = {
    [CardType.MIFARE_CLASSIC_1K]: [0x04, 0x00],
    [CardType.MIFARE_CLASSIC_4K]: [0x02, 0x00],
};

/** Compute BCC (XOR of all UID bytes). */
export function computeBcc(uid: string): number {
    const bytes = uid.match(/.{2}/g);
    if (!bytes || bytes.length !== 4) {
        throw new Error(`BCC requires a 4-byte (8 hex char) UID, got: ${uid}`);
    }
    return bytes.reduce((xor, b) => xor ^ Number.parseInt(b, 16), 0);
}

/** Validate that a BCC byte matches the UID. */
export function validateBcc(uid: string, bcc: number): boolean {
    return computeBcc(uid) === bcc;
}

function toHex(byte: number): string {
    return byte.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Build a 16-byte block 0 for a 4-byte UID MIFARE Classic card.
 * Returns 32 hex characters (16 bytes).
 */
export function buildBlock0(uid: string, cardType: string): string {
    const sak = SAK[cardType];
    const atqa = ATQA[cardType];
    if (sak === undefined || !atqa) {
        throw new Error(`Unsupported card type for block 0: ${cardType}`);
    }

    const bcc = computeBcc(uid);
    const uidUpper = uid.toUpperCase();

    return `${uidUpper}${toHex(bcc)}${toHex(sak)}${toHex(atqa[0])}${toHex(atqa[1])}${"00".repeat(8)}`;
}

/**
 * Parse block 0 hex data and extract UID, BCC, SAK, ATQA.
 * Returns null if data is too short.
 */
export function parseBlock0(hex: string): { uid: string; bcc: number; sak: number; atqa: [number, number] } | null {
    const clean = hex.replace(/\s+/g, "").toUpperCase();
    if (clean.length < 16) return null; // need at least 8 bytes (UID+BCC+SAK+ATQA)

    const uid = clean.slice(0, 8);
    const bcc = Number.parseInt(clean.slice(8, 10), 16);
    const sak = Number.parseInt(clean.slice(10, 12), 16);
    const atqa: [number, number] = [Number.parseInt(clean.slice(12, 14), 16), Number.parseInt(clean.slice(14, 16), 16)];

    return { uid, bcc, sak, atqa };
}
