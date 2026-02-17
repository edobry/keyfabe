import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/store.js", () => ({
    loadTags: vi.fn(),
}));

import { exportTags } from "../../src/commands/export.js";
import { loadTags } from "../../src/lib/store.js";

const mockLoadTags = vi.mocked(loadTags);

beforeEach(() => {
    setupBeforeEach();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

describe("exportTags", () => {
    it("exports tags as JSON to stdout", async () => {
        const tags = [
            { name: "front-door", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-06-15T12:00:00.000Z" },
            { name: "garage", type: "HID Prox", id: "2004263F88", savedAt: "2024-06-16T12:00:00.000Z" },
        ];
        mockLoadTags.mockResolvedValue(tags);

        expect(await exportTags()).toBe(true);
        const written = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const parsed = JSON.parse(written);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].name).toBe("front-door");
    });

    it("returns false when no tags", async () => {
        mockLoadTags.mockResolvedValue([]);

        expect(await exportTags()).toBe(false);
        expect(process.stdout.write).not.toHaveBeenCalled();
    });
});
