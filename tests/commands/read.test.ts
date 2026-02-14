import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

vi.mock("../../src/lib/store.js", () => ({
    saveFob: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    promptName: vi.fn(),
}));

import { read } from "../../src/commands/read.js";
import { Pm3Error, pm3Exec, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockRequireDevice = vi.mocked(requireDevice);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("read", () => {
    it("card found, user saves → calls saveFob", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });
        mockPromptName.mockResolvedValue("my-fob");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await read()).toBe(true);
        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "my-fob",
                type: "EM410x",
                id: "1A2B3C4D5E",
            }),
        );
    });

    it("HF card found when LF fails → saves as HF type", async () => {
        // LF search returns nothing
        mockPm3Exec.mockResolvedValueOnce({ stdout: "no known cards", stderr: "" });
        // HF search finds MIFARE Classic
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic EV1 1K",
            stderr: "",
        });
        mockPromptName.mockResolvedValue("laundry");
        mockSaveFob.mockResolvedValue(undefined);

        expect(await read()).toBe(true);
        expect(mockSaveFob).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "laundry",
                type: "MIFARE Classic 1K",
                id: "DEADBEEF",
            }),
        );
    });

    it("no card detected on LF or HF → false", async () => {
        mockPm3Exec.mockResolvedValueOnce({ stdout: "no known cards", stderr: "" });
        mockPm3Exec.mockResolvedValueOnce({ stdout: "no known HF tags", stderr: "" });

        expect(await read()).toBe(false);
        expect(mockPromptName).not.toHaveBeenCalled();
    });

    it("no device connected → false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await read()).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("user skips save → does not call saveFob", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E",
            stderr: "",
        });
        mockPromptName.mockResolvedValue(null);

        expect(await read()).toBe(true);
        expect(mockSaveFob).not.toHaveBeenCalled();
    });

    it("pm3 not found → false", async () => {
        mockPm3Exec.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await read()).toBe(false);
    });
});
