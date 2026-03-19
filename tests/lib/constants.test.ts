import { describe, expect, it } from "vitest";
import { CardType, cardFrequency, Pm3Cmd, Pm3Command } from "../../src/lib/constants.js";

describe("cardFrequency", () => {
    it("returns LF for EM410x", () => {
        expect(cardFrequency(CardType.EM410x)).toBe("LF");
    });

    it("returns LF for HID Prox", () => {
        expect(cardFrequency(CardType.HID_PROX)).toBe("LF");
    });

    it("returns HF for MIFARE Classic 1K", () => {
        expect(cardFrequency(CardType.MIFARE_CLASSIC_1K)).toBe("HF");
    });

    it("returns HF for MIFARE Classic 4K", () => {
        expect(cardFrequency(CardType.MIFARE_CLASSIC_4K)).toBe("HF");
    });

    it("returns HF for MIFARE Ultralight", () => {
        expect(cardFrequency(CardType.MIFARE_ULTRALIGHT)).toBe("HF");
    });

    it("returns HF for unknown type", () => {
        expect(cardFrequency("SomeUnknownType")).toBe("HF");
    });
});

describe("Pm3Command", () => {
    it("stores parts from constructor", () => {
        const cmd = new Pm3Command("lf", "search");
        expect(cmd.parts).toEqual(["lf", "search"]);
    });

    it("toString joins parts with spaces", () => {
        const cmd = new Pm3Command("lf", "search");
        expect(cmd.toString()).toBe("lf search");
    });

    it("sub creates a new command with appended subcommand", () => {
        const base = new Pm3Command("lf");
        const extended = base.sub("em").sub("410x");
        expect(extended.toString()).toBe("lf em 410x");
        // original is unchanged
        expect(base.toString()).toBe("lf");
    });

    it("arg appends a flag", () => {
        const cmd = new Pm3Command("lf", "em", "410x", "clone").arg("--uid", "AABBCCDDEE");
        expect(cmd.toString()).toBe("lf em 410x clone --uid AABBCCDDEE");
    });

    it("arg appends flag without value when value is undefined", () => {
        const cmd = new Pm3Command("hf", "search").arg("-v");
        expect(cmd.toString()).toBe("hf search -v");
    });

    it("chain joins commands with semicolons", () => {
        const a = new Pm3Command("lf", "search");
        const b = new Pm3Command("hf", "search");
        const chained = Pm3Command.chain(a, b);
        expect(chained.toString()).toBe("lf search ; hf search");
    });

    it("chain with single command has no semicolons", () => {
        const cmd = new Pm3Command("hw", "status");
        const chained = Pm3Command.chain(cmd);
        expect(chained.toString()).toBe("hw status");
    });

    it("sub and arg do not mutate the original", () => {
        const cmd = new Pm3Command("lf", "search");
        cmd.sub("extra");
        cmd.arg("--flag");
        expect(cmd.toString()).toBe("lf search");
    });
});

describe("Pm3Cmd constants", () => {
    it("LF_SEARCH resolves to 'lf search'", () => {
        expect(Pm3Cmd.LF_SEARCH.toString()).toBe("lf search");
    });

    it("HF_MF_AUTOPWN resolves to 'hf mf autopwn'", () => {
        expect(Pm3Cmd.HF_MF_AUTOPWN.toString()).toBe("hf mf autopwn");
    });

    it("LF_EM_410X_CLONE resolves to 'lf em 410x clone'", () => {
        expect(Pm3Cmd.LF_EM_410X_CLONE.toString()).toBe("lf em 410x clone");
    });

    it("HF_14A_CONFIG resolves to 'hf 14a config'", () => {
        expect(Pm3Cmd.HF_14A_CONFIG.toString()).toBe("hf 14a config");
    });
});
