import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, mockOra, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockOra();

vi.mock("../../src/lib/card-ops.js", () => ({
    writeAndVerify: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    saveFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
    promptName: vi.fn(),
}));

import { clone } from "../../src/commands/clone.js";
import { writeAndVerify } from "../../src/lib/card-ops.js";
import { pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockRequireDevice = vi.mocked(requireDevice);
const mockWriteAndVerify = vi.mocked(writeAndVerify);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("clone", () => {
    it("full happy path: read → write → verify → save", async () => {
        // lf search (read original)
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });

        // writeAndVerify succeeds
        mockWriteAndVerify.mockResolvedValue(true);

        mockPromptName.mockResolvedValue("cloned-fob");
        mockSaveFob.mockResolvedValue(undefined);

        await clone();

        expect(mockWriteAndVerify).toHaveBeenCalledWith(expect.objectContaining({ type: "EM410x", id: "1A2B3C4D5E" }));
        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "cloned-fob",
                type: "EM410x",
                id: "1A2B3C4D5E",
            }),
        );
    });

    it("read fails all 3 retries", async () => {
        vi.useFakeTimers();

        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "no cards", stderr: "" })
            .mockResolvedValueOnce({ stdout: "no cards", stderr: "" })
            .mockResolvedValueOnce({ stdout: "no cards", stderr: "" });

        const clonePromise = clone();

        // Advance past the two retry delays (2s each)
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(2000);

        await clonePromise;

        const output = getOutput();
        expect(output).toContain("Failed to read original card");
        expect(mockPm3Exec).toHaveBeenCalledTimes(3);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("no device connected: returns false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        const result = await clone();

        expect(result).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("writeAndVerify fails: prints clone failed", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });

        mockWriteAndVerify.mockResolvedValue(false);

        const result = await clone();

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("Clone failed");
    });
});
