import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();

import { MF_1K_SIZE, parseMfDump } from "../../src/lib/mf-data.js";
import { crackKeys, dumpCard, readLiveValueBlocks, restoreCard } from "../../src/lib/mf-ops.js";
import { pm3Exec } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);

beforeEach(() => {
    setupBeforeEach();
});

/** A 1K dump with one value block (2000) at block 16 and Key A EC195D46D55D on sector 4's trailer. */
function buildDumpWithValueBlock() {
    const buf = Buffer.alloc(MF_1K_SIZE);
    const v = 16 * 16;
    buf.writeInt32LE(2000, v);
    buf.writeInt32LE(~2000 | 0, v + 4);
    buf.writeInt32LE(2000, v + 8);
    buf.writeUInt8(0, v + 12);
    buf.writeUInt8(0xff, v + 13);
    buf.writeUInt8(0, v + 14);
    buf.writeUInt8(0xff, v + 15);
    const t = 19 * 16;
    [0xec, 0x19, 0x5d, 0x46, 0xd5, 0x5d].forEach((b, i) => {
        buf.writeUInt8(b, t + i);
    });
    return parseMfDump(buf);
}

describe("readLiveValueBlocks", () => {
    it("reads the live value block with the saved sector key", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[=]  16 | E1 00 00 00 1E FF FF FF E1 00 00 00 00 FF 00 FF | ................",
            stderr: "",
        });

        const res = await readLiveValueBlocks(buildDumpWithValueBlock());
        expect(res).toEqual([{ blockIndex: 16, sector: 4, savedValue: 2000, liveValue: 225, authError: false }]);
        expect(mockPm3Exec.mock.calls[0][0].toString()).toContain("EC195D46D55D");
    });

    it("flags an auth error when the live card rejects the saved key (UID-only clone)", async () => {
        mockPm3Exec.mockResolvedValueOnce({ stdout: "[#] Auth error", stderr: "" });

        const res = await readLiveValueBlocks(buildDumpWithValueBlock());
        expect(res).toEqual([{ blockIndex: 16, sector: 4, savedValue: 2000, liveValue: null, authError: true }]);
    });

    it("treats a thrown pm3 error as an unreadable block", async () => {
        mockPm3Exec.mockRejectedValueOnce(new Error("boom"));

        const res = await readLiveValueBlocks(buildDumpWithValueBlock());
        expect(res[0].authError).toBe(true);
        expect(res[0].liveValue).toBeNull();
    });
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
