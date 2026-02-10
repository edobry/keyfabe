import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    loadFobs: vi.fn(),
}));

import * as p from "@clack/prompts";
import { list } from "../../src/commands/list.js";
import { loadFobs } from "../../src/lib/store.js";

const mockLoadFobs = vi.mocked(loadFobs);
const mockNote = vi.mocked(p.note);

beforeEach(() => {
    setupBeforeEach();
});

describe("list", () => {
    it("empty store → info message, no note", async () => {
        mockLoadFobs.mockResolvedValue([]);

        expect(await list()).toBe(true);
        expect(mockNote).not.toHaveBeenCalled();
    });

    it("fobs exist → displays table via p.note", async () => {
        mockLoadFobs.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
            { name: "garage", type: "HID Prox", id: "2004263F88", savedAt: "2024-06-16T12:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        expect(mockNote).toHaveBeenCalledWith(expect.stringContaining("front-door"), "Saved Fobs (2)");
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).toContain("garage");
        expect(noteContent).toContain("EM410x");
        expect(noteContent).toContain("HID Prox");
        expect(noteContent).toContain("2024-06-15");
    });

    it("--json flag → outputs valid JSON to console.log", async () => {
        const fobs = [{ name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" }];
        mockLoadFobs.mockResolvedValue(fobs);

        expect(await list({ json: true })).toBe(true);
        const output = getOutput();
        expect(JSON.parse(output)).toEqual(fobs);
    });

    it("--json with empty store → empty array", async () => {
        mockLoadFobs.mockResolvedValue([]);

        expect(await list({ json: true })).toBe(true);
        const output = getOutput();
        expect(JSON.parse(output)).toEqual([]);
    });

    it("shows encoding column when fobs have encoding", async () => {
        mockLoadFobs.mockResolvedValue([
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

    it("omits encoding column when no fobs have encoding", async () => {
        mockLoadFobs.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
        ]);

        expect(await list()).toBe(true);
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).not.toContain("Encoding");
    });
});
