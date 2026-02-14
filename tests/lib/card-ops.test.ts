import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

import { searchCard, writeAndVerify } from "../../src/lib/card-ops.js";
import { Pm3Error, pm3Exec } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
});

describe("searchCard", () => {
    it("returns LF card when found", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });

        const result = await searchCard();
        expect(result).toEqual({ type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" });
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("falls back to HF when LF finds nothing", async () => {
        mockPm3Exec.mockResolvedValueOnce({ stdout: "no known cards", stderr: "" }).mockResolvedValueOnce({
            stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic EV1 1K",
            stderr: "",
        });

        const result = await searchCard();
        expect(result).toEqual({ type: "MIFARE Classic 1K", id: "DEADBEEF" });
        expect(mockPm3Exec).toHaveBeenCalledTimes(2);
    });

    it("returns null when neither LF nor HF finds anything", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "no known cards", stderr: "" })
            .mockResolvedValueOnce({ stdout: "no known HF tags", stderr: "" });

        expect(await searchCard()).toBeNull();
    });

    it("propagates Pm3Error from LF search", async () => {
        mockPm3Exec.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        await expect(searchCard()).rejects.toThrow("pm3 command not found");
    });
});

describe("writeAndVerify", () => {
    const emCard = { type: "EM410x", id: "1A2B3C4D5E" };

    it("LF: T55x7 detected, clone succeeds, verify matches → true", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E", stderr: "" });

        expect(await writeAndVerify(emCard)).toBe(true);
    });

    it("LF: no T55x7 → false", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[!] Could not detect modulation",
            stderr: "",
        });

        expect(await writeAndVerify(emCard)).toBe(false);
    });

    it("LF: clone fails → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[!!] Error writing block", stderr: "" });

        expect(await writeAndVerify(emCard)).toBe(false);
    });

    it("LF: verify mismatch → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] EM 410x Tag ID: 0000000000", stderr: "" });

        expect(await writeAndVerify(emCard)).toBe(false);
    });

    it("LF: pm3 not found in detect step → false", async () => {
        mockPm3Exec.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await writeAndVerify(emCard)).toBe(false);
    });

    it("HF Gen1A: MIFARE Classic 1K write succeeds and verifies → true", async () => {
        const mifareCard = { type: "MIFARE Classic 1K", id: "DEADBEEF" };

        // Step 1: detect magic type (hf search)
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Magic capabilities... Gen 1a", stderr: "" })
            // Step 2: clone (csetuid)
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            // Step 3: verify (hf search)
            .mockResolvedValueOnce({
                stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic EV1 1K",
                stderr: "",
            });

        expect(await writeAndVerify(mifareCard)).toBe(true);
        expect(mockPm3Exec).toHaveBeenCalledTimes(3);
    });

    it("HF Gen2: MIFARE Classic 1K write succeeds and verifies → true", async () => {
        const mifareCard = { type: "MIFARE Classic 1K", id: "DEADBEEF" };

        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Magic capabilities... Gen 2 / CUID", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Write ( ok )", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic EV1 1K",
                stderr: "",
            });

        expect(await writeAndVerify(mifareCard)).toBe(true);
        expect(mockPm3Exec).toHaveBeenCalledTimes(3);
    });

    it("HF: MIFARE Classic 4K write succeeds → true", async () => {
        const mifare4kCard = { type: "MIFARE Classic 4K", id: "01020304" };

        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Magic capabilities... Gen 1a", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[+]  UID: 01 02 03 04\n[+] MIFARE Classic 4K",
                stderr: "",
            });

        expect(await writeAndVerify(mifare4kCard)).toBe(true);
    });

    it("HF: unsupported card type → false", async () => {
        const ultralightCard = { type: "MIFARE Ultralight", id: "04689571FA5C64" };

        expect(await writeAndVerify(ultralightCard)).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("HF: unknown magic type → false", async () => {
        const mifareCard = { type: "MIFARE Classic 1K", id: "DEADBEEF" };

        mockPm3Exec.mockResolvedValueOnce({ stdout: "[+] Valid ISO 14443-A tag found", stderr: "" });

        expect(await writeAndVerify(mifareCard)).toBe(false);
    });

    it("HF: MIFARE Classic verify mismatch → false", async () => {
        const mifareCard = { type: "MIFARE Classic 1K", id: "DEADBEEF" };

        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Magic capabilities... Gen 1a", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[+]  UID: AA BB CC DD\n[+] MIFARE Classic EV1 1K",
                stderr: "",
            });

        expect(await writeAndVerify(mifareCard)).toBe(false);
    });
});
