import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/store.js", () => ({
    loadFobs: vi.fn(),
}));

import { list } from "../../src/commands/list.js";
import { loadFobs } from "../../src/lib/store.js";

const mockLoadFobs = vi.mocked(loadFobs);

beforeEach(() => {
    setupBeforeEach();
});

describe("list", () => {
    it("prints empty message when no fobs", async () => {
        mockLoadFobs.mockResolvedValue([]);

        const result = await list();

        expect(result).toBe(true);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No saved fobs"));
    });

    it("prints formatted table when fobs exist", async () => {
        mockLoadFobs.mockResolvedValue([
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
            { name: "garage", type: "HID Prox", id: "2004263F88", savedAt: "2024-06-16T12:00:00.000Z" },
        ]);

        const result = await list();

        expect(result).toBe(true);
        const output = getOutput();
        expect(output).toContain("front-door");
        expect(output).toContain("garage");
        expect(output).toContain("EM410x");
        expect(output).toContain("HID Prox");
        expect(output).toContain("2024-06-15");
    });
});
