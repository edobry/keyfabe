import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    writeAndVerify: vi.fn(),
    detectMagicType: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    getTag: vi.fn(),
    loadTags: vi.fn(),
}));

vi.mock("../../src/lib/pm3.js", () => ({
    requireDevice: vi.fn().mockResolvedValue(true),
    pm3Exec: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    selectTag: vi.fn(),
}));

vi.mock("../../src/lib/mf-ops.js", () => ({
    restoreCard: vi.fn(),
}));

vi.mock("../../src/lib/display.js", () => ({
    printTagNotFound: vi.fn(),
    printNoSavedTags: vi.fn(),
    printNotMagicHint: vi.fn(),
}));

import * as p from "@clack/prompts";
import { write } from "../../src/commands/write.js";
import { detectMagicType, writeAndVerify } from "../../src/lib/card-ops.js";
import { restoreCard } from "../../src/lib/mf-ops.js";
import { pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { getTag } from "../../src/lib/store.js";

const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockGetTag = vi.mocked(getTag);
const mockRequireDevice = vi.mocked(requireDevice);
const mockRestoreCard = vi.mocked(restoreCard);
const mockDetectMagicType = vi.mocked(detectMagicType);
const mockPm3Exec = vi.mocked(pm3Exec);
const mockLogWarn = vi.mocked(p.log.warn);

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("write", () => {
    it("tag found, write succeeds → true", async () => {
        mockGetTag.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(true);

        expect(await write("front-door")).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
    });

    it("tag not found → false", async () => {
        mockGetTag.mockResolvedValue(undefined);

        expect(await write("nonexistent")).toBe(false);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("no device connected → false", async () => {
        mockGetTag.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await write("front-door")).toBe(false);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("tag found, write fails → false", async () => {
        mockGetTag.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(false);

        expect(await write("front-door")).toBe(false);
    });

    it("tag without dumpFile → existing UID-only path (regression) + warns it carries no data", async () => {
        mockGetTag.mockResolvedValue({
            name: "mifare-uid",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(true);

        expect(await write("mifare-uid")).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalled();
        expect(mockRestoreCard).not.toHaveBeenCalled();
        expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining("only the UID will be written"));
    });
});

describe("write full-card", () => {
    it("tag with dumpFile → full-card restore path", async () => {
        mockGetTag.mockResolvedValue({
            name: "laundry-tag",
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

        expect(await write("laundry-tag")).toBe(true);
        expect(mockRestoreCard).toHaveBeenCalled();
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("target not magic card → false", async () => {
        mockGetTag.mockResolvedValue({
            name: "laundry-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            savedAt: "2024-01-01",
        });
        mockDetectMagicType.mockResolvedValueOnce("unknown");

        expect(await write("laundry-tag")).toBe(false);
    });

    it("restore fails → false", async () => {
        mockGetTag.mockResolvedValue({
            name: "laundry-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            dumpFile: "hf-mf-DEADBEEF-dump.bin",
            savedAt: "2024-01-01",
        });
        mockDetectMagicType.mockResolvedValueOnce("Gen1A");
        mockRestoreCard.mockResolvedValueOnce({ success: false, failedBlocks: 3 });

        expect(await write("laundry-tag")).toBe(false);
    });
});
