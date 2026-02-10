import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, mockOra, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockOra();

vi.mock("../../src/lib/store.js", () => ({
    saveFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    promptName: vi.fn(),
}));

import { read } from "../../src/commands/read.js";
import { pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockRequireDevice = vi.mocked(requireDevice);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("read", () => {
    it("LF card found: displays info, prompts to save", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });
        mockPromptName.mockResolvedValue(null);

        await read();

        const output = getOutput();
        expect(output).toContain("EM410x");
        expect(output).toContain("1A2B3C4D5E");
    });

    it("no card detected: prints error", async () => {
        mockPm3Exec.mockResolvedValueOnce({ stdout: "no known cards", stderr: "" });

        const result = await read();

        expect(result).toBe(false);
        expect(mockPromptName).not.toHaveBeenCalled();
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("user saves: calls saveFob", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E",
            stderr: "",
        });
        mockPromptName.mockResolvedValue("my-fob");
        mockSaveFob.mockResolvedValue(undefined);

        await read();

        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "my-fob",
                type: "EM410x",
                id: "1A2B3C4D5E",
            }),
        );
    });

    it("no device connected: returns false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        const result = await read();

        expect(result).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("user skips save: does not call saveFob", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E",
            stderr: "",
        });
        mockPromptName.mockResolvedValue(null);

        await read();

        expect(mockSaveFob).not.toHaveBeenCalled();
    });
});
