import { describe, expect, it } from "vitest";
import {
    parseCloneResult,
    parseHfSearch,
    parseHwStatus,
    parseHwTune,
    parseLfSearch,
    parseT55xxDetect,
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
        expect(result.isStockFirmware).toBe(false);
    });

    it("detects error output", () => {
        const output = `[!!] ERROR: cannot communicate with the Proxmark3`;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(false);
        expect(result.isStockFirmware).toBe(false);
    });

    it("detects cannot communicate", () => {
        const output = `[!!] cannot communicate with device`;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(false);
        expect(result.isStockFirmware).toBe(false);
    });

    it("detects stock firmware via unknown command", () => {
        const output = `[!!] unknown command 'hw status'`;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(false);
        expect(result.isStockFirmware).toBe(true);
    });

    it("parses FPGA mode line as firmware", () => {
        const output = `[#]   mode.................... fpga_pm3_hf.ncd image 2s30vq100 11-09-2025 14:31:08`;
        const result = parseHwStatus(output);
        expect(result.connected).toBe(true);
        expect(result.firmwareVersion).toBe("fpga_pm3_hf.ncd image 2s30vq100 11-09-2025 14:31:08");
        expect(result.isStockFirmware).toBe(false);
    });

    it("returns unknown firmware when no match", () => {
        const output = `connected, no version info`;
        const result = parseHwStatus(output);
        expect(result.firmwareVersion).toBe("unknown");
        expect(result.isStockFirmware).toBe(false);
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

    it("parses dotted separator format", () => {
        const output = `
[+] 125.00 kHz ........... 23.83 V
[+] 13.56 MHz............. 15.36 V
        `;
        const result = parseHwTune(output);
        expect(result.lfVoltage).toBeCloseTo(23.83);
        expect(result.hfVoltage).toBeCloseTo(15.36);
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

describe("parseHfSearch", () => {
    it("parses MIFARE Classic 1K", () => {
        const output = `
[+]  UID: DE AD BE EF
[+] ATQA: 00 04
[+]  SAK: 08 [2]
[+] Possible types:
[+]    MIFARE Classic EV1 1K
        `;
        const result = parseHfSearch(output);
        expect(result).toEqual({
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
        });
    });

    it("parses MIFARE Classic 4K", () => {
        const output = `
[+]  UID: 01 02 03 04
[+]  SAK: 18
[+] MIFARE Classic 4K
        `;
        const result = parseHfSearch(output);
        expect(result).toEqual({
            type: "MIFARE Classic 4K",
            id: "01020304",
        });
    });

    it("parses MIFARE Ultralight with 7-byte UID", () => {
        const output = `
[+]  UID: 04 68 95 71 FA 5C 64
[+] ATQA: 00 44
[+]  SAK: 00
[+] MIFARE Ultralight
        `;
        const result = parseHfSearch(output);
        expect(result).toEqual({
            type: "MIFARE Ultralight",
            id: "04689571FA5C64",
        });
    });

    it("parses MIFARE DESFire", () => {
        const output = `
[+]  UID: 04 A1 B2 C3 D4 E5 F6
[+] MIFARE DESFire EV1
        `;
        const result = parseHfSearch(output);
        expect(result).toEqual({
            type: "MIFARE DESFire",
            id: "04A1B2C3D4E5F6",
        });
    });

    it("parses generic ISO 14443-A with UID", () => {
        const output = `
[+]  UID: AB CD EF 01
[+] ATQA: 00 04
[+]  SAK: 20
        `;
        const result = parseHfSearch(output);
        expect(result).toEqual({
            type: "ISO 14443-A",
            id: "ABCDEF01",
        });
    });

    it("parses UID with bracket size notation", () => {
        const output = `
[+]  UID[4]: AA BB CC DD
[+] MIFARE Classic 1K
        `;
        const result = parseHfSearch(output);
        expect(result).toEqual({
            type: "MIFARE Classic 1K",
            id: "AABBCCDD",
        });
    });

    it("returns null when no HF card found", () => {
        const output = `[!] No known/supported 13.56 MHz tags found`;
        const result = parseHfSearch(output);
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
