import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/store.js", () => ({
    removeFob: vi.fn(),
}));

import { deleteFob } from "../../src/commands/delete.js";
import { removeFob } from "../../src/lib/store.js";

const mockRemoveFob = vi.mocked(removeFob);

beforeEach(() => {
    setupBeforeEach();
});

describe("deleteFob", () => {
    it("deletes existing fob and returns true", async () => {
        mockRemoveFob.mockResolvedValue(true);

        const result = await deleteFob("front-door");

        expect(result).toBe(true);
        expect(mockRemoveFob).toHaveBeenCalledWith("front-door");
        const output = getOutput();
        expect(output).toContain('Deleted "front-door"');
    });

    it("returns false when fob not found", async () => {
        mockRemoveFob.mockResolvedValue(false);

        const result = await deleteFob("nonexistent");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("No saved fob");
    });
});
