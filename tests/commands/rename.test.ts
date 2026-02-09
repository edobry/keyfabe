import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/store.js", () => ({
    renameFob: vi.fn(),
}));

import { rename } from "../../src/commands/rename.js";
import { renameFob } from "../../src/lib/store.js";

const mockRenameFob = vi.mocked(renameFob);

beforeEach(() => {
    setupBeforeEach();
});

describe("rename", () => {
    it("renames successfully", async () => {
        mockRenameFob.mockResolvedValue("ok");

        const result = await rename("old-name", "new-name");

        expect(result).toBe(true);
        expect(mockRenameFob).toHaveBeenCalledWith("old-name", "new-name");
        const output = getOutput();
        expect(output).toContain('Renamed "old-name" to "new-name"');
    });

    it("prints error when fob not found", async () => {
        mockRenameFob.mockResolvedValue("not-found");

        const result = await rename("nonexistent", "new-name");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("No saved fob");
    });

    it("prints error when new name is taken", async () => {
        mockRenameFob.mockResolvedValue("name-taken");

        const result = await rename("old-name", "existing");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("already exists");
    });
});
