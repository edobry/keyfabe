import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/store.js", () => ({
    loadFobs: vi.fn(),
}));

import { list } from "../../src/commands/list.js";
import { loadFobs } from "../../src/lib/store.js";

const mockLoadFobs = vi.mocked(loadFobs);

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("list", () => {
    it("prints empty message when no fobs", async () => {
        mockLoadFobs.mockResolvedValue([]);
        await list();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No saved fobs"));
    });

    it("prints formatted table when fobs exist", async () => {
        mockLoadFobs.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
            { name: "garage", type: "HID Prox", id: "2004263F88", savedAt: "2024-06-16T12:00:00.000Z" },
        ]);
        await list();
        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("front-door");
        expect(output).toContain("garage");
        expect(output).toContain("EM410x");
        expect(output).toContain("HID Prox");
        expect(output).toContain("2024-06-15");
    });
});
