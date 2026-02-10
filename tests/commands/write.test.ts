import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    writeAndVerify: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    getFob: vi.fn(),
    loadFobs: vi.fn(),
}));

vi.mock("../../src/lib/pm3.js", () => ({
    requireDevice: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    selectFob: vi.fn(),
}));

import { write } from "../../src/commands/write.js";
import { writeAndVerify } from "../../src/lib/card-ops.js";
import { requireDevice } from "../../src/lib/pm3.js";
import { getFob } from "../../src/lib/store.js";

const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockGetFob = vi.mocked(getFob);
const mockRequireDevice = vi.mocked(requireDevice);

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("write", () => {
    it("fob found, write succeeds → true", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(true);

        expect(await write("front-door")).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
    });

    it("fob not found → false", async () => {
        mockGetFob.mockResolvedValue(undefined);

        expect(await write("nonexistent")).toBe(false);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("no device connected → false", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await write("front-door")).toBe(false);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();
    });

    it("fob found, write fails → false", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });
        mockWriteAndVerify.mockResolvedValue(false);

        expect(await write("front-door")).toBe(false);
    });
});
