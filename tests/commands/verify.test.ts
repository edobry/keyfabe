import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCardWithDiagnosis: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    loadTags: vi.fn().mockResolvedValue([]),
    getTag: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    selectTag: vi.fn(),
}));

vi.mock("../../src/lib/mf-ops.js", () => ({
    readLiveValueBlocks: vi.fn(),
}));

vi.mock("../../src/lib/mf-data.js", () => ({
    locateDumpFile: vi.fn(),
    loadDumpFile: vi.fn(),
}));

import { verify } from "../../src/commands/verify.js";
import { searchCardWithDiagnosis } from "../../src/lib/card-ops.js";
import { loadDumpFile, locateDumpFile } from "../../src/lib/mf-data.js";
import { readLiveValueBlocks } from "../../src/lib/mf-ops.js";
import { Pm3Error, requireDevice } from "../../src/lib/pm3.js";
import { getTag, loadTags } from "../../src/lib/store.js";

const mockSearchCardWithDiagnosis = vi.mocked(searchCardWithDiagnosis);
const mockRequireDevice = vi.mocked(requireDevice);
const mockGetTag = vi.mocked(getTag);
const mockLoadTags = vi.mocked(loadTags);
const mockReadLiveValueBlocks = vi.mocked(readLiveValueBlocks);
const mockLocateDumpFile = vi.mocked(locateDumpFile);
const mockLoadDumpFile = vi.mocked(loadDumpFile);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("verify", () => {
    it("ID and type match → true", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "my-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2025-01-01",
        });
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });

        expect(await verify("my-tag")).toBe(true);
    });

    it("ID matches but type differs → true (partial match)", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "my-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2025-01-01",
        });
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "ISO 14443-A", id: "DEADBEEF" },
            diagnosis: "none",
        });

        expect(await verify("my-tag")).toBe(true);
    });

    it("ID mismatch → false", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "my-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2025-01-01",
        });
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "AABBCCDD" },
            diagnosis: "none",
        });

        expect(await verify("my-tag")).toBe(false);
    });

    it("no tag detected on reader → false", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "my-tag",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2025-01-01",
        });
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({ card: null, diagnosis: "none" });

        expect(await verify("my-tag")).toBe(false);
    });

    it("no saved tags → false", async () => {
        mockLoadTags.mockResolvedValueOnce([]);

        expect(await verify()).toBe(false);
        expect(mockSearchCardWithDiagnosis).not.toHaveBeenCalled();
    });

    it("saved tag not found by name → false", async () => {
        mockGetTag.mockResolvedValueOnce(undefined);

        expect(await verify("nonexistent")).toBe(false);
        expect(mockSearchCardWithDiagnosis).not.toHaveBeenCalled();
    });

    it("no device → false", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "my-tag",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2025-01-01",
        });
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await verify("my-tag")).toBe(false);
        expect(mockSearchCardWithDiagnosis).not.toHaveBeenCalled();
    });

    it("pm3 error during search → false", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "my-tag",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2025-01-01",
        });
        mockSearchCardWithDiagnosis.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await verify("my-tag")).toBe(false);
    });
});

describe("verify --deep", () => {
    const laundryTag = {
        name: "494 laundry",
        type: "MIFARE Classic 1K",
        id: "815498C5",
        dumpFile: "/home/u/hf-mf-815498C5-current-dump.bin",
        savedAt: "2026-02-14",
    };

    function placeMatchingCard() {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "815498C5" },
            diagnosis: "none",
        });
    }

    it("full clone (data readable under saved keys) → true", async () => {
        mockGetTag.mockResolvedValueOnce(laundryTag);
        placeMatchingCard();
        mockLocateDumpFile.mockResolvedValueOnce("/home/u/hf-mf-815498C5-current-dump.bin");
        mockLoadDumpFile.mockResolvedValueOnce({ blocks: [], sizeBytes: 1024 });
        mockReadLiveValueBlocks.mockResolvedValueOnce([
            { blockIndex: 16, sector: 4, savedValue: 2000, liveValue: 225, authError: false },
        ]);

        expect(await verify("494 laundry", { deep: true })).toBe(true);
        expect(mockReadLiveValueBlocks).toHaveBeenCalled();
    });

    it("UID-only clone (all blocks auth-fail under saved keys) → false", async () => {
        mockGetTag.mockResolvedValueOnce(laundryTag);
        placeMatchingCard();
        mockLocateDumpFile.mockResolvedValueOnce("/home/u/hf-mf-815498C5-current-dump.bin");
        mockLoadDumpFile.mockResolvedValueOnce({ blocks: [], sizeBytes: 1024 });
        mockReadLiveValueBlocks.mockResolvedValueOnce([
            { blockIndex: 16, sector: 4, savedValue: 2000, liveValue: null, authError: true },
        ]);

        expect(await verify("494 laundry", { deep: true })).toBe(false);
    });

    it("no saved dump → skips deep compare, still passes on UID", async () => {
        mockGetTag.mockResolvedValueOnce({ ...laundryTag, dumpFile: undefined });
        placeMatchingCard();

        expect(await verify("494 laundry", { deep: true })).toBe(true);
        expect(mockReadLiveValueBlocks).not.toHaveBeenCalled();
    });

    it("without --deep, does not read value blocks", async () => {
        mockGetTag.mockResolvedValueOnce(laundryTag);
        placeMatchingCard();

        expect(await verify("494 laundry")).toBe(true);
        expect(mockReadLiveValueBlocks).not.toHaveBeenCalled();
    });
});
