import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    renameTag: vi.fn(),
    loadTags: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    selectTag: vi.fn(),
}));

import { rename } from "../../src/commands/rename.js";
import { renameTag } from "../../src/lib/store.js";

const mockRenameTag = vi.mocked(renameTag);

beforeEach(() => {
    setupBeforeEach();
});

describe("rename", () => {
    it("renames successfully → true", async () => {
        mockRenameTag.mockResolvedValue("ok");

        expect(await rename("old-name", "new-name")).toBe(true);
        expect(mockRenameTag).toHaveBeenCalledWith("old-name", "new-name");
    });

    it("tag not found → false", async () => {
        mockRenameTag.mockResolvedValue("not-found");

        expect(await rename("nonexistent", "new-name")).toBe(false);
    });

    it("new name taken → false", async () => {
        mockRenameTag.mockResolvedValue("name-taken");

        expect(await rename("old-name", "existing")).toBe(false);
    });
});
