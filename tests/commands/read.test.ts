import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCard: vi.fn(),
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
    promptName: vi.fn(),
}));

import { read } from "../../src/commands/read.js";
import { searchCard } from "../../src/lib/card-ops.js";
import { Pm3Error, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockSearchCard = vi.mocked(searchCard);
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
        mockSearchCard.mockResolvedValueOnce({
            type: "EM410x",
            id: "1A2B3C4D5E",
            encoding: "RF/64",
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

    it("HF card found → saves as HF type", async () => {
        mockSearchCard.mockResolvedValueOnce({
            type: "MIFARE Classic 1K",
            id: "DEADBEEF",
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

    it("no card detected → false", async () => {
        mockSearchCard.mockResolvedValueOnce(null);

        expect(await read()).toBe(false);
        expect(mockPromptName).not.toHaveBeenCalled();
    });

    it("no device connected → false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await read()).toBe(false);
        expect(mockSearchCard).not.toHaveBeenCalled();
    });

    it("user skips save → does not call saveFob", async () => {
        mockSearchCard.mockResolvedValueOnce({
            type: "EM410x",
            id: "1A2B3C4D5E",
        });
        mockPromptName.mockResolvedValue(null);

        expect(await read()).toBe(true);
        expect(mockSaveFob).not.toHaveBeenCalled();
    });

    it("pm3 not found → false", async () => {
        mockSearchCard.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await read()).toBe(false);
    });
});
