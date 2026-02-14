import { describe, expect, it } from "vitest";
import { buildBlock0, computeBcc, parseBlock0, validateBcc } from "../../src/lib/block0.js";

describe("computeBcc", () => {
    it("computes XOR of 4 UID bytes", () => {
        expect(computeBcc("815498C5")).toBe(0x88);
    });

    it("computes XOR for all-zeros", () => {
        expect(computeBcc("00000000")).toBe(0x00);
    });

    it("computes XOR for DEADBEEF", () => {
        expect(computeBcc("DEADBEEF")).toBe(0xde ^ 0xad ^ 0xbe ^ 0xef);
    });

    it("throws for non-4-byte UID", () => {
        expect(() => computeBcc("AABB")).toThrow("4-byte");
        expect(() => computeBcc("AABBCCDDEEFF")).toThrow("4-byte");
    });
});

describe("validateBcc", () => {
    it("returns true for correct BCC", () => {
        expect(validateBcc("815498C5", 0x88)).toBe(true);
    });

    it("returns false for incorrect BCC", () => {
        expect(validateBcc("815498C5", 0x08)).toBe(false);
    });
});

describe("buildBlock0", () => {
    it("builds block 0 for MIFARE Classic 1K", () => {
        const result = buildBlock0("815498C5", "MIFARE Classic 1K");
        // UID(815498C5) + BCC(88) + SAK(08) + ATQA(0400) + 8 zero bytes
        expect(result).toBe("815498C5880804000000000000000000");
    });

    it("builds block 0 for MIFARE Classic 4K", () => {
        const result = buildBlock0("01020304", "MIFARE Classic 4K");
        // BCC = 01^02^03^04 = 0x04, SAK = 0x18, ATQA = 02 00
        expect(result).toBe("010203040418020000000000000000" + "00");
    });

    it("is case-insensitive for UID", () => {
        const upper = buildBlock0("DEADBEEF", "MIFARE Classic 1K");
        const lower = buildBlock0("deadbeef", "MIFARE Classic 1K");
        expect(upper).toBe(lower);
    });

    it("throws for unsupported card type", () => {
        expect(() => buildBlock0("815498C5", "MIFARE Ultralight")).toThrow("Unsupported");
    });
});

describe("parseBlock0", () => {
    it("parses valid block 0 hex", () => {
        const result = parseBlock0("815498C5880804000000000000000000");
        expect(result).toEqual({
            uid: "815498C5",
            bcc: 0x88,
            sak: 0x08,
            atqa: [0x04, 0x00],
        });
    });

    it("handles spaces in hex", () => {
        const result = parseBlock0("81 54 98 C5 88 08 04 00 00 00 00 00 00 00 00 00");
        expect(result?.uid).toBe("815498C5");
        expect(result?.bcc).toBe(0x88);
    });

    it("returns null for too-short data", () => {
        expect(parseBlock0("8154")).toBeNull();
    });
});
