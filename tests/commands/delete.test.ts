import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/store.js", () => ({
    removeFob: vi.fn(),
}));

import { deleteFob } from "../../src/commands/delete.js";
import { removeFob } from "../../src/lib/store.js";

const mockRemoveFob = vi.mocked(removeFob);

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("deleteFob", () => {
    it("deletes existing fob and returns true", async () => {
        mockRemoveFob.mockResolvedValue(true);

        const result = await deleteFob("front-door");

        expect(result).toBe(true);
        expect(mockRemoveFob).toHaveBeenCalledWith("front-door");
        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
        const output = calls.join("\n");
        expect(output).toContain('Deleted "front-door"');
    });

    it("returns false when fob not found", async () => {
        mockRemoveFob.mockResolvedValue(false);

        const result = await deleteFob("nonexistent");

        expect(result).toBe(false);
        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("No saved fob");
    });
});
