import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

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
import { Pm3Error, pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockPm3Exec = vi.mocked(pm3Exec);
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
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });
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

        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "no cards", stderr: "" })
            .mockResolvedValueOnce({ stdout: "no cards", stderr: "" })
            .mockResolvedValueOnce({ stdout: "no cards", stderr: "" });

        const clonePromise = clone();
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(2000);
        await clonePromise;

        expect(mockPm3Exec).toHaveBeenCalledTimes(3);
        expect(mockWriteAndVerify).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("no device connected → false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await clone()).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("writeAndVerify fails → false", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });
        mockWriteAndVerify.mockResolvedValue(false);

        expect(await clone()).toBe(false);
    });

    it("pm3 not found during read → false", async () => {
        mockPm3Exec.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await clone()).toBe(false);
    });
});
