import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    writeAndVerify: vi.fn(),
    detectMagicType: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    getFob: vi.fn(),
    loadFobs: vi.fn(),
}));

vi.mock("../../src/lib/pm3.js", () => ({
    requireDevice: vi.fn().mockResolvedValue(true),
    pm3Exec: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    selectFob: vi.fn(),
}));

vi.mock("../../src/lib/mf-ops.js", () => ({
    restoreCard: vi.fn(),
}));

vi.mock("../../src/lib/display.js", () => ({
    printFobNotFound: vi.fn(),
    printNoSavedTags: vi.fn(),
    printNotMagicHint: vi.fn(),
}));

import { write } from "../../src/commands/write.js";
import { detectMagicType, writeAndVerify } from "../../src/lib/card-ops.js";
import { restoreCard } from "../../src/lib/mf-ops.js";
import { pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { getFob } from "../../src/lib/store.js";

const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockGetFob = vi.mocked(getFob);
const mockRequireDevice = vi.mocked(requireDevice);
const mockRestoreCard = vi.mocked(restoreCard);
const mockDetectMagicType = vi.mocked(detectMagicType);
const mockPm3Exec = vi.mocked(pm3Exec);

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("write", () => {
    it("fob found, write succeeds → true", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(true);

        expect(await write("front-door")).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
    });

    it("fob not found → false", async () => {
        mockGetFob.mockResolvedValue(undefined);

        expect(await write("nonexistent")).toBe(false);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("no device connected → false", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await write("front-door")).toBe(false);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("fob found, write fails → false", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(false);

        expect(await write("front-door")).toBe(false);
    });

    it("fob without dumpFile → existing UID-only path (regression)", async () => {
        mockGetFob.mockResolvedValue({
            name: "mifare-uid",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(true);

        expect(await write("mifare-uid")).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalled();
        expect(mockRestoreCard).not.toHaveBeenCalled();
    });
});

describe("write full-card", () => {
    it("fob with dumpFile → full-card restore path", async () => {
        mockGetFob.mockResolvedValue({
            name: "laundry-fob",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            savedAt: "2024-01-01",
        });
        mockDetectMagicType.mockResolvedValueOnce("Gen1A");
        mockRestoreCard.mockResolvedValueOnce({ success: true, failedBlocks: 0 });
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic 1K",
            stderr: "",
        });

        expect(await write("laundry-fob")).toBe(true);
        expect(mockRestoreCard).toHaveBeenCalled();
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("target not magic card → false", async () => {
        mockGetFob.mockResolvedValue({
            name: "laundry-fob",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            savedAt: "2024-01-01",
        });
        mockDetectMagicType.mockResolvedValueOnce("unknown");

        expect(await write("laundry-fob")).toBe(false);
    });

    it("restore fails → false", async () => {
        mockGetFob.mockResolvedValue({
            name: "laundry-fob",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            savedAt: "2024-01-01",
        });
        mockDetectMagicType.mockResolvedValueOnce("Gen1A");
        mockRestoreCard.mockResolvedValueOnce({ success: false, failedBlocks: 3 });

        expect(await write("laundry-fob")).toBe(false);
    });
});
