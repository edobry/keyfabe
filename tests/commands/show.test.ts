import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    getFob: vi.fn(),
    loadFobs: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    selectFob: vi.fn(),
}));

import * as p from "@clack/prompts";
import { show } from "../../src/commands/show.js";
import { getFob } from "../../src/lib/store.js";

const mockGetFob = vi.mocked(getFob);
const mockNote = vi.mocked(p.note);

beforeEach(() => {
    setupBeforeEach();
});

describe("show", () => {
    it("displays fob details via p.note when found", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            encoding: "RF/64",
            savedAt: "2024-06-15T12:00:00.000Z",
        });

        expect(await show("front-door")).toBe(true);
        expect(mockNote).toHaveBeenCalledWith(expect.stringContaining("front-door"), "Fob Details");
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).toContain("EM410x");
        expect(noteContent).toContain("1A2B3C4D5E");
        expect(noteContent).toContain("RF/64");
        expect(noteContent).toContain("2024-06-15");
    });

    it("displays fob without encoding", async () => {
        mockGetFob.mockResolvedValue({
            name: "garage",
            type: "HID Prox",
            id: "2004263F88",
            savedAt: "2024-06-16T12:00:00.000Z",
        });

        expect(await show("garage")).toBe(true);
        const noteContent = mockNote.mock.calls[0][0] as string;
        expect(noteContent).not.toContain("Encoding");
    });

    it("fob not found → false", async () => {
        mockGetFob.mockResolvedValue(undefined);

        expect(await show("nonexistent")).toBe(false);
        expect(mockNote).not.toHaveBeenCalled();
    });
});
