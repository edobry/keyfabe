import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/store.js", () => ({
    getFob: vi.fn(),
}));

import { show } from "../../src/commands/show.js";
import { getFob } from "../../src/lib/store.js";

const mockGetFob = vi.mocked(getFob);

beforeEach(() => {
    setupBeforeEach();
});

describe("show", () => {
    it("displays fob details when found", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            encoding: "RF/64",
            savedAt: "2024-06-15T12:00:00.000Z",
        });

        const result = await show("front-door");

        expect(result).toBe(true);
        const output = getOutput();
        expect(output).toContain("front-door");
        expect(output).toContain("EM410x");
        expect(output).toContain("1A2B3C4D5E");
        expect(output).toContain("RF/64");
        expect(output).toContain("2024-06-15");
    });

    it("displays fob without encoding", async () => {
        mockGetFob.mockResolvedValue({
            name: "garage",
            type: "HID Prox",
            id: "2004263F88",
            savedAt: "2024-06-16T12:00:00.000Z",
        });

        const result = await show("garage");

        expect(result).toBe(true);
        const output = getOutput();
        expect(output).toContain("HID Prox");
        expect(output).not.toContain("Encoding");
    });

    it("prints error when fob not found", async () => {
        mockGetFob.mockResolvedValue(undefined);

        const result = await show("nonexistent");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("No saved fob");
    });
});
