import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", async () => ({
    ...(await vi.importActual("../../src/lib/store.js")),
    loadTags: vi.fn(),
}));

import * as p from "@clack/prompts";
import { list } from "../../src/commands/list.js";
import { loadTags } from "../../src/lib/store.js";

const mockLoadTags = vi.mocked(loadTags);
const mockNote = vi.mocked(p.note);

beforeEach(() => {
    setupBeforeEach();
});

describe("list", () => {
    it("empty store → info message, no note", async () => {
        mockLoadTags.mockResolvedValue([]);

        expect(await list()).toBe(true);
        expect(mockNote).not.toHaveBeenCalled();
    });

    it("tags exist → displays table via p.note", async () => {
        mockLoadTags.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
            { name: "garage", type: "HID Prox", id: "2004263F88", savedAt: "2024-06-16T12:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        expect(mockNote).toHaveBeenCalledWith(expect.stringContaining("front-door"), "Saved Tags (2)");
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).toContain("garage");
        expect(noteContent).toContain("EM410x");
        expect(noteContent).toContain("HID Prox");
        expect(noteContent).toContain("2024-06-15");
    });

    it("--json flag → outputs valid JSON to console.log", async () => {
        const tags = [{ name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" }];
        mockLoadTags.mockResolvedValue(tags);

        expect(await list({ json: true })).toBe(true);
        const output = getOutput();
        expect(JSON.parse(output)).toEqual(tags);
    });

    it("--json with empty store → empty array", async () => {
        mockLoadTags.mockResolvedValue([]);

        expect(await list({ json: true })).toBe(true);
        const output = getOutput();
        expect(JSON.parse(output)).toEqual([]);
    });

    it("shows encoding column when tags have encoding", async () => {
        mockLoadTags.mockResolvedValue([
            {
                name: "front-door",
                type: "EM410x",
                id: "1A2B3C4D5E",
                encoding: "RF/64",
                savedAt: "2024-06-15T12:00:00.000Z",
            },
            { name: "garage", type: "HID Prox", id: "2004263F88", savedAt: "2024-06-16T12:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).toContain("Encoding");
        expect(noteContent).toContain("RF/64");
    });

    it("omits encoding column when no tags have encoding", async () => {
        mockLoadTags.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).not.toContain("Encoding");
    });

    it("shows Data column with fidelity for MIFARE Classic tags", async () => {
        mockLoadTags.mockResolvedValue([
            {
                name: "494 laundry",
                type: "MIFARE Classic 1K",
                id: "815498C5",
                dumpFile: "/d.bin",
                savedAt: "2026-02-14T00:00:00.000Z",
            },
            { name: "laundry 2", type: "MIFARE Classic 1K", id: "815498C5", savedAt: "2026-04-30T00:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).toContain("Data");
        expect(noteContent).toContain("full");
        expect(noteContent).toContain("uid-only");
    });

    it("omits Data column when no MIFARE Classic tags present", async () => {
        mockLoadTags.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        expect(mockNote.mock.calls[0][0] as string).not.toContain("Data");
    });
});
