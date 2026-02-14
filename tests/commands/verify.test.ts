import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCard: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    loadFobs: vi.fn().mockResolvedValue([]),
    getFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    selectFob: vi.fn(),
}));

import { verify } from "../../src/commands/verify.js";
import { searchCard } from "../../src/lib/card-ops.js";
import { Pm3Error, requireDevice } from "../../src/lib/pm3.js";
import { getFob, loadFobs } from "../../src/lib/store.js";

const mockSearchCard = vi.mocked(searchCard);
const mockRequireDevice = vi.mocked(requireDevice);
const mockGetFob = vi.mocked(getFob);
const mockLoadFobs = vi.mocked(loadFobs);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("verify", () => {
    it("ID and type match → true", async () => {
        mockGetFob.mockResolvedValueOnce({
            name: "my-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2025-01-01",
        });
        mockSearchCard.mockResolvedValueOnce({ type: "MIFARE Classic 1K", id: "DEADBEEF" });

        expect(await verify("my-tag")).toBe(true);
    });

    it("ID matches but type differs → true (partial match)", async () => {
        mockGetFob.mockResolvedValueOnce({
            name: "my-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2025-01-01",
        });
        mockSearchCard.mockResolvedValueOnce({ type: "ISO 14443-A", id: "DEADBEEF" });

        expect(await verify("my-tag")).toBe(true);
    });

    it("ID mismatch → false", async () => {
        mockGetFob.mockResolvedValueOnce({
            name: "my-tag",
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
            savedAt: "2025-01-01",
        });
        mockSearchCard.mockResolvedValueOnce({ type: "MIFARE Classic 1K", id: "AABBCCDD" });

        expect(await verify("my-tag")).toBe(false);
    });

    it("no tag detected on reader → false", async () => {
        mockGetFob.mockResolvedValueOnce({
            name: "my-tag",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2025-01-01",
        });
        mockSearchCard.mockResolvedValueOnce(null);

        expect(await verify("my-tag")).toBe(false);
    });

    it("no saved tags → false", async () => {
        mockLoadFobs.mockResolvedValueOnce([]);

        expect(await verify()).toBe(false);
        expect(mockSearchCard).not.toHaveBeenCalled();
    });

    it("saved tag not found by name → false", async () => {
        mockGetFob.mockResolvedValueOnce(undefined);

        expect(await verify("nonexistent")).toBe(false);
        expect(mockSearchCard).not.toHaveBeenCalled();
    });

    it("no device → false", async () => {
        mockGetFob.mockResolvedValueOnce({
            name: "my-tag",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2025-01-01",
        });
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await verify("my-tag")).toBe(false);
        expect(mockSearchCard).not.toHaveBeenCalled();
    });

    it("pm3 error during search → false", async () => {
        mockGetFob.mockResolvedValueOnce({
            name: "my-tag",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2025-01-01",
        });
        mockSearchCard.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await verify("my-tag")).toBe(false);
    });
});
