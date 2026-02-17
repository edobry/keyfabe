import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCardWithDiagnosis: vi.fn(),
    writeAndVerify: vi.fn(),
    detectMagicType: vi.fn(),
}));

vi.mock("../../src/lib/pm3.js", () => ({
    requireDevice: vi.fn().mockResolvedValue(true),
    pm3Exec: vi.fn(),
    Pm3Error: class Pm3Error extends Error {
        stdout: string;
        stderr: string;
        constructor(message: string, stdout: string, stderr: string) {
            super(message);
            this.name = "Pm3Error";
            this.stdout = stdout;
            this.stderr = stderr;
        }
    },
}));

vi.mock("../../src/lib/store.js", () => ({
    saveFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    promptName: vi.fn(),
}));

vi.mock("../../src/lib/mf-ops.js", () => ({
    crackKeys: vi.fn(),
    dumpCard: vi.fn(),
    restoreCard: vi.fn(),
}));

vi.mock("../../src/lib/display.js", () => ({
    printCardInfo: vi.fn(),
    printDetectionHint: vi.fn(),
    printDoctorHint: vi.fn(),
    printFullCardCloneProgress: vi.fn(),
    printNotMagicHint: vi.fn(),
}));

import { clone } from "../../src/commands/clone.js";
import { detectMagicType, searchCardWithDiagnosis, writeAndVerify } from "../../src/lib/card-ops.js";
import { crackKeys, dumpCard, restoreCard } from "../../src/lib/mf-ops.js";
import { Pm3Error, pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockSearchCardWithDiagnosis = vi.mocked(searchCardWithDiagnosis);
const mockRequireDevice = vi.mocked(requireDevice);
const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);
const MockPm3Error = Pm3Error as any;
const mockCrackKeys = vi.mocked(crackKeys);
const mockDumpCard = vi.mocked(dumpCard);
const mockRestoreCard = vi.mocked(restoreCard);
const mockDetectMagicType = vi.mocked(detectMagicType);
const mockPm3Exec = vi.mocked(pm3Exec);

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("clone", () => {
    it("full happy path: read → write → verify → save", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" },
            diagnosis: "none",
        });
        mockWriteAndVerify.mockResolvedValue(true);
        mockPromptName.mockResolvedValue("cloned-fob");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await clone()).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "cloned-fob",
                type: "EM410x",
                id: "1A2B3C4D5E",
            }),
        );
    });

    it("read fails all 3 retries → false", async () => {
        vi.useFakeTimers();

        mockSearchCardWithDiagnosis
            .mockResolvedValueOnce({ card: null, diagnosis: "none" })
            .mockResolvedValueOnce({ card: null, diagnosis: "none" })
            .mockResolvedValueOnce({ card: null, diagnosis: "none" });

        const clonePromise = clone();
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(2000);
        await clonePromise;

        expect(mockSearchCardWithDiagnosis).toHaveBeenCalledTimes(3);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("no device connected → false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await clone()).toBe(false);
        expect(mockSearchCardWithDiagnosis).not.toHaveBeenCalled();
    });

    it("writeAndVerify fails → false", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" },
            diagnosis: "none",
        });
        mockWriteAndVerify.mockResolvedValue(false);

        expect(await clone()).toBe(false);
    });

    it("pm3 not found during read → false", async () => {
        mockSearchCardWithDiagnosis.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await clone()).toBe(false);
    });

    it("LF cards still use UID-only path (regression)", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "EM410x", id: "1A2B3C4D5E" },
            diagnosis: "none",
        });
        mockWriteAndVerify.mockResolvedValue(true);
        mockPromptName.mockResolvedValue("lf-fob");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await clone()).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalled();
        expect(mockCrackKeys).not.toHaveBeenCalled();
    });
});

describe("clone MIFARE Classic full-card", () => {
    it("MIFARE Classic 1K → full-card flow (crack → dump → restore → verify → save)", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });
        mockCrackKeys.mockResolvedValueOnce({
            success: true,
            keyFile: "hf-mf-DEADBEEF-key.bin",
            method: "autopwn",
        });
        mockDumpCard.mockResolvedValueOnce({
            success: true,
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            keyFile: "hf-mf-DEADBEEF-key.bin",
        });
        mockDetectMagicType.mockResolvedValueOnce("Gen1A");
        mockRestoreCard.mockResolvedValueOnce({ success: true, failedBlocks: 0 });
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic 1K",
            stderr: "",
        });
        mockPromptName.mockResolvedValue("mifare-clone");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await clone()).toBe(true);
        expect(mockCrackKeys).toHaveBeenCalledWith("DEADBEEF", "MIFARE Classic 1K");
        expect(mockDumpCard).toHaveBeenCalledWith("DEADBEEF", "MIFARE Classic 1K", "hf-mf-DEADBEEF-key.bin");
        expect(mockRestoreCard).toHaveBeenCalledWith(
            "hf-mf-DEADBEEF-dump.bin",
            "hf-mf-DEADBEEF-key.bin",
            "MIFARE Classic 1K",
        );
        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "mifare-clone",
                type: "MIFARE Classic 1K",
                id: "DEADBEEF",
                dumpFile: "hf-mf-DEADBEEF-dump.bin",
            }),
        );
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("MIFARE Classic 1K with FM11RF08S fallback", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "AABBCCDD" },
            diagnosis: "none",
        });
        mockCrackKeys.mockResolvedValueOnce({
            success: true,
            keyFile: "hf-mf-AABBCCDD-key.bin",
            method: "fm11rf08s",
        });
        mockDumpCard.mockResolvedValueOnce({
            success: true,
            dumpFile: "hf-mf-AABBCCDD-dump.bin",
            keyFile: "hf-mf-AABBCCDD-key.bin",
        });
        mockDetectMagicType.mockResolvedValueOnce("Gen2/CUID");
        mockRestoreCard.mockResolvedValueOnce({ success: true, failedBlocks: 0 });
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+]  UID: AA BB CC DD\n[+] MIFARE Classic 1K",
            stderr: "",
        });
        mockPromptName.mockResolvedValue("fm-clone");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await clone()).toBe(true);
        expect(mockCrackKeys).toHaveBeenCalled();
    });

    it("key cracking fails → false", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });
        mockCrackKeys.mockResolvedValueOnce(null);

        expect(await clone()).toBe(false);
        expect(mockDumpCard).not.toHaveBeenCalled();
    });

    it("dump fails → false", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });
        mockCrackKeys.mockResolvedValueOnce({
            success: true,
            keyFile: "key.bin",
            method: "autopwn",
        });
        mockDumpCard.mockResolvedValueOnce(null);

        expect(await clone()).toBe(false);
        expect(mockRestoreCard).not.toHaveBeenCalled();
    });

    it("target not magic card → false", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });
        mockCrackKeys.mockResolvedValueOnce({
            success: true,
            keyFile: "key.bin",
            method: "autopwn",
        });
        mockDumpCard.mockResolvedValueOnce({
            success: true,
            dumpFile: "dump.bin",
            keyFile: "key.bin",
        });
        mockDetectMagicType.mockResolvedValueOnce("unknown");

        expect(await clone()).toBe(false);
        expect(mockRestoreCard).not.toHaveBeenCalled();
    });

    it("restore fails → false", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });
        mockCrackKeys.mockResolvedValueOnce({
            success: true,
            keyFile: "key.bin",
            method: "autopwn",
        });
        mockDumpCard.mockResolvedValueOnce({
            success: true,
            dumpFile: "dump.bin",
            keyFile: "key.bin",
        });
        mockDetectMagicType.mockResolvedValueOnce("Gen1A");
        mockRestoreCard.mockResolvedValueOnce({ success: false, failedBlocks: 5 });

        expect(await clone()).toBe(false);
    });
});
