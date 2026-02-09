import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/card-ops.js", () => ({
    writeAndVerify: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    getFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
}));

import { write } from "../../src/commands/write.js";
import { writeAndVerify } from "../../src/lib/card-ops.js";
import { getFob } from "../../src/lib/store.js";

const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockGetFob = vi.mocked(getFob);

beforeEach(() => {
    setupBeforeEach();
});

describe("write", () => {
    it("fob found, write succeeds", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });

        mockWriteAndVerify.mockResolvedValue(true);

        const result = await write("front-door");

        expect(result).toBe(true);
        const output = getOutput();
        expect(output).toContain("Write successful");
        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
    });

    it("fob not found: prints error", async () => {
        mockGetFob.mockResolvedValue(undefined);

        const result = await write("nonexistent");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("No saved fob");
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("fob found, write fails", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });

        mockWriteAndVerify.mockResolvedValue(false);

        const result = await write("front-door");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("Write failed");
    });
});
