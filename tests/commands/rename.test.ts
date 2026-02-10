import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    renameFob: vi.fn(),
    loadFobs: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    selectFob: vi.fn(),
}));

import { rename } from "../../src/commands/rename.js";
import { renameFob } from "../../src/lib/store.js";

const mockRenameFob = vi.mocked(renameFob);

beforeEach(() => {
    setupBeforeEach();
});

describe("rename", () => {
    it("renames successfully → true", async () => {
        mockRenameFob.mockResolvedValue("ok");

        expect(await rename("old-name", "new-name")).toBe(true);
        expect(mockRenameFob).toHaveBeenCalledWith("old-name", "new-name");
    });

    it("fob not found → false", async () => {
        mockRenameFob.mockResolvedValue("not-found");

        expect(await rename("nonexistent", "new-name")).toBe(false);
    });

    it("new name taken → false", async () => {
        mockRenameFob.mockResolvedValue("name-taken");

        expect(await rename("old-name", "existing")).toBe(false);
    });
});
