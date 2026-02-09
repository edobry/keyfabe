import { describe, it, expect } from "vitest";
import {
    parseHwStatus,
    parseHwTune,
    parseLfSearch,
    parseT55xxDetect,
    parseCloneResult,
} from "../../src/lib/parsers.js";

describe("parseHwStatus", () => {
    it("parses connected device output", () => {
        const output = `
[#] Communication with Proxmark3 device OK
firmware version: v4.18484 - Iceman
        `;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(true);
        expect(result.firmwareVersion).toBe("v4.18484 - Iceman");
    });

    it("detects error output", () => {
        const output = `[!!] ERROR: cannot communicate with the Proxmark3`;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(false);
    });

    it("detects cannot communicate", () => {
        const output = `[!!] cannot communicate with device`;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(false);
    });

    it("returns unknown firmware when no match", () => {
        const output = `connected, no version info`;
        const result = parseHwStatus(output);
        expect(result.firmwareVersion).toBe("unknown");
    });
});

describe("parseHwTune", () => {
    it("parses normal voltages", () => {
        const output = `
# LF antenna:  125.00 kHz:  29.84 V
# HF antenna:  13.56 MHz:  24.56 V
        `;
        const result = parseHwTune(output);
        expect(result.lfVoltage).toBeCloseTo(29.84);
        expect(result.hfVoltage).toBeCloseTo(24.56);
    });

    it("returns zero for missing values", () => {
        const output = `no antenna data here`;
        const result = parseHwTune(output);
        expect(result.lfVoltage).toBe(0);
        expect(result.hfVoltage).toBe(0);
    });
});

describe("parseLfSearch", () => {
    it("parses EM410x with encoding", () => {
        const output = `
[+] EM 410x Tag ID: 1A2B3C4D5E
[+] RF/64
        `;
        const result = parseLfSearch(output);
        expect(result).toEqual({
            type: "EM410x",
            id: "1A2B3C4D5E",
            encoding: "RF/64",
        });
    });

    it("parses EM410x without encoding", () => {
        const output = `[+] EM 410x ID: 1122334455`;
        const result = parseLfSearch(output);
        expect(result).toEqual({
            type: "EM410x",
            id: "1122334455",
            encoding: undefined,
        });
    });

    it("parses HID Prox", () => {
        const output = `[+] HID Prox TAG ID: 2004263f88`;
        const result = parseLfSearch(output);
        expect(result).toEqual({
            type: "HID Prox",
            id: "2004263F88",
        });
    });

    it("returns null when no card found", () => {
        const output = `[!] No known LF cards found`;
        const result = parseLfSearch(output);
        expect(result).toBeNull();
    });
});

describe("parseT55xxDetect", () => {
    it("parses T55x7 detected", () => {
        const output = `[+] Chip Type: T55x7`;
        const result = parseT55xxDetect(output);
        expect(result).toEqual({ chipType: "T55x7", passwordSet: false });
    });

    it("detects password set", () => {
        const output = `[+] Chip Type: T55x7\n[+] password is set`;
        const result = parseT55xxDetect(output);
        expect(result).toEqual({ chipType: "T55x7", passwordSet: true });
    });

    it("returns null when no chip found", () => {
        const output = `[!] Could not detect modulation automatically`;
        const result = parseT55xxDetect(output);
        expect(result).toBeNull();
    });
});

describe("parseCloneResult", () => {
    it("detects success (Done)", () => {
        const result = parseCloneResult("[+] Done");
        expect(result.success).toBe(true);
    });

    it("detects failure (error)", () => {
        const result = parseCloneResult("[!!] Error writing block");
        expect(result.success).toBe(false);
    });

    it("does not treat errorrate as error", () => {
        const result = parseCloneResult("[+] Done, errorrate: 0%");
        expect(result.success).toBe(true);
    });

    it("detects failure when no done/written/cloned", () => {
        const result = parseCloneResult("[+] some other output");
        expect(result.success).toBe(false);
    });
});
