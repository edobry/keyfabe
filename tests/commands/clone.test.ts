import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCard: vi.fn(),
    writeAndVerify: vi.fn(),
}));

vi.mock("../../src/lib/pm3.js", () => ({
    requireDevice: vi.fn().mockResolvedValue(true),
    Pm3Error: class Pm3Error extends Error {
        stdout: string;
        stderr: string;
        constructor(message: string, stdout: string, stderr: string) {
            super(message);
            this.name = "Pm3Error";
            this.stdout = stdout;
            this.stderr = stderr;
        }
    },
}));

vi.mock("../../src/lib/store.js", () => ({
    saveFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    promptName: vi.fn(),
}));

import { clone } from "../../src/commands/clone.js";
import { searchCard, writeAndVerify } from "../../src/lib/card-ops.js";
import { Pm3Error, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockSearchCard = vi.mocked(searchCard);
const mockRequireDevice = vi.mocked(requireDevice);
const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("clone", () => {
    it("full happy path: read → write → verify → save", async () => {
        mockSearchCard.mockResolvedValueOnce({ type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" });
        mockWriteAndVerify.mockResolvedValue(true);
        mockPromptName.mockResolvedValue("cloned-fob");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await clone()).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "cloned-fob",
                type: "EM410x",
                id: "1A2B3C4D5E",
            }),
        );
    });

    it("read fails all 3 retries → false", async () => {
        vi.useFakeTimers();

        mockSearchCard.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        const clonePromise = clone();
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(2000);
        await clonePromise;

        expect(mockSearchCard).toHaveBeenCalledTimes(3);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("HF card found → clone proceeds with writeAndVerify", async () => {
        mockSearchCard.mockResolvedValueOnce({ type: "MIFARE Classic 1K", id: "DEADBEEF" });
        mockWriteAndVerify.mockResolvedValue(true);
        mockPromptName.mockResolvedValue("hf-clone");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await clone()).toBe(true);
        expect(mockWriteAndVerify).toHaveBeenCalledWith(
            expect.objectContaining({ type: "MIFARE Classic 1K", id: "DEADBEEF" }),
        );
    });

    it("no device connected → false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await clone()).toBe(false);
        expect(mockSearchCard).not.toHaveBeenCalled();
    });

    it("writeAndVerify fails → false", async () => {
        mockSearchCard.mockResolvedValueOnce({ type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" });
        mockWriteAndVerify.mockResolvedValue(false);

        expect(await clone()).toBe(false);
    });

    it("pm3 not found during read → false", async () => {
        mockSearchCard.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await clone()).toBe(false);
    });
});
