import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    removeFob: vi.fn(),
    loadFobs: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    confirm: vi.fn().mockResolvedValue(true),
    selectFob: vi.fn(),
}));

import { deleteFob } from "../../src/commands/delete.js";
import { removeFob } from "../../src/lib/store.js";

const mockRemoveFob = vi.mocked(removeFob);

beforeEach(() => {
    setupBeforeEach();
});

describe("deleteFob", () => {
    it("deletes existing fob → true", async () => {
        mockRemoveFob.mockResolvedValue(true);

        expect(await deleteFob("front-door")).toBe(true);
        expect(mockRemoveFob).toHaveBeenCalledWith("front-door");
    });

    it("fob not found → false", async () => {
        mockRemoveFob.mockResolvedValue(false);

        expect(await deleteFob("nonexistent")).toBe(false);
    });
});
