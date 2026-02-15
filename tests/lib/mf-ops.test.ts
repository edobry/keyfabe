import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();

import { crackKeys, dumpCard, restoreCard } from "../../src/lib/mf-ops.js";
import { pm3Exec } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);

beforeEach(() => {
    setupBeforeEach();
});

describe("crackKeys", () => {
    it("autopwn succeeds → returns autopwn method", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] Found keys have been saved to file hf-mf-DEADBEEF-key.bin",
            stderr: "",
        });

        const result = await crackKeys("DEADBEEF", "MIFARE Classic 1K");
        expect(result).toEqual({
            success: true,
            keyFile: "hf-mf-DEADBEEF-key.bin",
            method: "autopwn",
        });
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("autopwn fails (static nonce) → falls back to fm11rf08s → returns fm11rf08s method", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({
                stdout: "[!] static encrypted nonce detected",
                stderr: "",
            })
            .mockResolvedValueOnce({
                stdout: "[+] Keys saved to hf-mf-DEADBEEF-key.bin",
                stderr: "",
            });

        const result = await crackKeys("DEADBEEF", "MIFARE Classic 1K");
        expect(result).toEqual({
            success: true,
            keyFile: "hf-mf-DEADBEEF-key.bin",
            method: "fm11rf08s",
        });
        expect(mockPm3Exec).toHaveBeenCalledTimes(2);
    });

    it("autopwn fails (no static nonce) → returns null", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[!] No keys were recovered",
            stderr: "",
        });

        const result = await crackKeys("DEADBEEF", "MIFARE Classic 1K");
        expect(result).toBeNull();
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("both fail → returns null", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({
                stdout: "[!] static encrypted nonce detected",
                stderr: "",
            })
            .mockResolvedValueOnce({
                stdout: "[!] Recovery failed",
                stderr: "",
            });

        const result = await crackKeys("DEADBEEF", "MIFARE Classic 1K");
        expect(result).toBeNull();
        expect(mockPm3Exec).toHaveBeenCalledTimes(2);
    });
});

describe("dumpCard", () => {
    it("success → returns dump file path", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] saved 64 blocks to file hf-mf-DEADBEEF-dump.bin",
            stderr: "",
        });

        const result = await dumpCard("DEADBEEF", "MIFARE Classic 1K", "hf-mf-DEADBEEF-key.bin");
        expect(result).toEqual({
            success: true,
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            keyFile: "hf-mf-DEADBEEF-key.bin",
        });
    });

    it("uses --4k flag for 4K cards", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] saved 256 blocks to file hf-mf-DEADBEEF-dump.bin",
            stderr: "",
        });

        await dumpCard("DEADBEEF", "MIFARE Classic 4K", "key.bin");
        expect(mockPm3Exec.mock.calls[0][0].toString()).toContain("--4k");
    });

    it("failure → returns null", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[!] Error dumping card",
            stderr: "",
        });

        const result = await dumpCard("DEADBEEF", "MIFARE Classic 1K", "key.bin");
        expect(result).toBeNull();
    });
});

describe("restoreCard", () => {
    it("all blocks ok → success", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] Restored 64 blocks. Done.",
            stderr: "",
        });

        const result = await restoreCard("dump.bin", "key.bin", "MIFARE Classic 1K");
        expect(result).toEqual({ success: true, failedBlocks: 0 });
    });

    it("some blocks fail → returns failure count", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] Done. 3 blocks failed to write.",
            stderr: "",
        });

        const result = await restoreCard("dump.bin", "key.bin", "MIFARE Classic 1K");
        expect(result).toEqual({ success: false, failedBlocks: 3 });
    });

    it("uses --4k flag for 4K cards", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] Restored 256 blocks. Done.",
            stderr: "",
        });

        await restoreCard("dump.bin", "key.bin", "MIFARE Classic 4K");
        expect(mockPm3Exec.mock.calls[0][0].toString()).toContain("--4k");
    });
});
