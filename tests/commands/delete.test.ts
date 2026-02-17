import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    removeTag: vi.fn(),
    loadTags: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    confirm: vi.fn().mockResolvedValue(true),
    selectTag: vi.fn(),
}));

import { deleteTag } from "../../src/commands/delete.js";
import { removeTag } from "../../src/lib/store.js";

const mockRemoveTag = vi.mocked(removeTag);

beforeEach(() => {
    setupBeforeEach();
});

describe("deleteTag", () => {
    it("deletes existing tag → true", async () => {
        mockRemoveTag.mockResolvedValue(true);

        expect(await deleteTag("front-door")).toBe(true);
        expect(mockRemoveTag).toHaveBeenCalledWith("front-door");
    });

    it("tag not found → false", async () => {
        mockRemoveTag.mockResolvedValue(false);

        expect(await deleteTag("nonexistent")).toBe(false);
    });
});
