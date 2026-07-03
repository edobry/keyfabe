import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

vi.mock("../../src/lib/mf-ops.js", () => ({
    readValueBlock: vi.fn(),
    writeValueBlock: vi.fn(),
}));

vi.mock("../../src/lib/mf-data.js", () => ({
    loadDumpFile: vi.fn(),
    locateDumpFile: vi.fn(),
    sectorKeyA: vi.fn(),
    sectorOf: vi.fn((b: number) => Math.floor(b / 4)),
}));

vi.mock("../../src/lib/store.js", () => ({
    getTag: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    confirm: vi.fn().mockResolvedValue(true),
}));

import * as p from "@clack/prompts";
import { value } from "../../src/commands/value.js";
import { loadDumpFile, locateDumpFile, sectorKeyA } from "../../src/lib/mf-data.js";
import { readValueBlock, writeValueBlock } from "../../src/lib/mf-ops.js";
import { requireDevice } from "../../src/lib/pm3.js";
import { confirm } from "../../src/lib/prompts.js";
import { getTag } from "../../src/lib/store.js";

const mockReadValueBlock = vi.mocked(readValueBlock);
const mockWriteValueBlock = vi.mocked(writeValueBlock);
const mockGetTag = vi.mocked(getTag);
const mockConfirm = vi.mocked(confirm);
const mockRequireDevice = vi.mocked(requireDevice);
const mockLocateDumpFile = vi.mocked(locateDumpFile);
const mockLoadDumpFile = vi.mocked(loadDumpFile);
const mockSectorKeyA = vi.mocked(sectorKeyA);
const mockLogSuccess = vi.mocked(p.log.success);

const KEY = "EC195D46D55D";

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
    mockConfirm.mockResolvedValue(true);
});

describe("value", () => {
    it("no --block → false", async () => {
        expect(await value(undefined, { key: KEY, get: true })).toBe(false);
    });

    it("more than one write op → false", async () => {
        expect(await value(undefined, { block: "16", key: KEY, set: "10", inc: "5" })).toBe(false);
    });

    it("no resolvable key → false", async () => {
        expect(await value(undefined, { block: "16", get: true })).toBe(false);
        expect(mockReadValueBlock).not.toHaveBeenCalled();
    });

    it("--get reads and reports the value", async () => {
        mockReadValueBlock.mockResolvedValueOnce(225);
        expect(await value(undefined, { block: "16", key: KEY })).toBe(true);
        expect(mockReadValueBlock).toHaveBeenCalledWith(16, KEY);
    });

    it("--get on an unreadable block → false", async () => {
        mockReadValueBlock.mockResolvedValueOnce(null);
        expect(await value(undefined, { block: "16", key: KEY, get: true })).toBe(false);
    });

    it("--set writes after confirm and reports the read-back value", async () => {
        mockReadValueBlock.mockResolvedValueOnce(225).mockResolvedValueOnce(1000);
        mockWriteValueBlock.mockResolvedValueOnce(true);

        expect(await value(undefined, { block: "16", key: KEY, set: "1000" })).toBe(true);
        expect(mockWriteValueBlock).toHaveBeenCalledWith(16, KEY, "set", 1000);
        expect(mockLogSuccess).toHaveBeenCalledWith(expect.stringContaining("1000"));
    });

    it("declining the confirmation leaves the card unchanged → false", async () => {
        mockReadValueBlock.mockResolvedValueOnce(225);
        mockConfirm.mockResolvedValueOnce(false);

        expect(await value(undefined, { block: "16", key: KEY, set: "1000" })).toBe(false);
        expect(mockWriteValueBlock).not.toHaveBeenCalled();
    });

    it("a failed write → false", async () => {
        mockReadValueBlock.mockResolvedValueOnce(225);
        mockWriteValueBlock.mockResolvedValueOnce(false);

        expect(await value(undefined, { block: "16", key: KEY, dec: "50" })).toBe(false);
    });

    it("resolves the key from a saved identity's dump when --key is omitted", async () => {
        mockGetTag.mockResolvedValueOnce({
            name: "494 laundry",
            type: "MIFARE Classic 1K",
            id: "815498C5",
            dumpFile: "/d.bin",
            savedAt: "2026-02-14",
        });
        mockLocateDumpFile.mockResolvedValueOnce("/d.bin");
        mockLoadDumpFile.mockResolvedValueOnce({ blocks: [], sizeBytes: 1024 });
        mockSectorKeyA.mockReturnValueOnce(KEY);
        mockReadValueBlock.mockResolvedValueOnce(225);

        expect(await value("494 laundry", { block: "16" })).toBe(true);
        expect(mockReadValueBlock).toHaveBeenCalledWith(16, KEY);
    });

    it("no device → false", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);
        expect(await value(undefined, { block: "16", key: KEY, get: true })).toBe(false);
    });
});
