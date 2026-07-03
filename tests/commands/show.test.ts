import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", async () => ({
    ...(await vi.importActual("../../src/lib/store.js")),
    getTag: vi.fn(),
    loadTags: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    selectTag: vi.fn(),
}));

import * as p from "@clack/prompts";
import { show } from "../../src/commands/show.js";
import { getTag } from "../../src/lib/store.js";

const mockGetTag = vi.mocked(getTag);
const mockNote = vi.mocked(p.note);
const mockLogWarn = vi.mocked(p.log.warn);

beforeEach(() => {
    setupBeforeEach();
});

describe("show", () => {
    it("displays tag details via p.note when found", async () => {
        mockGetTag.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            encoding: "RF/64",
            savedAt: "2024-06-15T12:00:00.000Z",
        });

        expect(await show("front-door")).toBe(true);
        expect(mockNote).toHaveBeenCalledWith(expect.stringContaining("front-door"), "Tag Details");
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).toContain("EM410x");
        expect(noteContent).toContain("1A2B3C4D5E");
        expect(noteContent).toContain("RF/64");
        expect(noteContent).toContain("2024-06-15");
    });

    it("displays tag without encoding", async () => {
        mockGetTag.mockResolvedValue({
            name: "garage",
            type: "HID Prox",
            id: "2004263F88",
            savedAt: "2024-06-16T12:00:00.000Z",
        });

        expect(await show("garage")).toBe(true);
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).not.toContain("Encoding");
    });

    it("tag not found → false", async () => {
        mockGetTag.mockResolvedValue(undefined);

        expect(await show("nonexistent")).toBe(false);
        expect(mockNote).not.toHaveBeenCalled();
    });

    it("MIFARE full-dump identity → shows 'full dump on file', no warning", async () => {
        mockGetTag.mockResolvedValue({
            name: "494 laundry",
            type: "MIFARE Classic 1K",
            id: "815498C5",
            dumpFile: "/d.bin",
            savedAt: "2026-02-14T00:00:00.000Z",
        });

        expect(await show("494 laundry")).toBe(true);
        expect(mockNote.mock.calls[0][0] as string).toContain("full dump on file");
        expect(mockLogWarn).not.toHaveBeenCalled();
    });

    it("MIFARE UID-only identity → shows 'UID only' and warns", async () => {
        mockGetTag.mockResolvedValue({
            name: "laundry 2",
            type: "MIFARE Classic 1K",
            id: "815498C5",
            savedAt: "2026-04-30T00:00:00.000Z",
        });

        expect(await show("laundry 2")).toBe(true);
        expect(mockNote.mock.calls[0][0] as string).toContain("UID only");
        expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining("UID-only identity"));
    });
});
