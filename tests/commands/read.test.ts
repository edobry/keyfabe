import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCardWithDiagnosis: vi.fn(),
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
    saveTag: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    promptName: vi.fn(),
}));

import { read } from "../../src/commands/read.js";
import { searchCardWithDiagnosis } from "../../src/lib/card-ops.js";
import { Pm3Error, requireDevice } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveTag } from "../../src/lib/store.js";

const mockSearchCardWithDiagnosis = vi.mocked(searchCardWithDiagnosis);
const mockRequireDevice = vi.mocked(requireDevice);
const mockSaveTag = vi.mocked(saveTag);
const mockPromptName = vi.mocked(promptName);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("read", () => {
    it("card found, user saves → calls saveTag", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" },
            diagnosis: "none",
        });
        mockPromptName.mockResolvedValue("my-tag");
        mockSaveTag.mockResolvedValue(undefined);

        expect(await read()).toBe(true);
        expect(mockSaveTag).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "my-tag",
                type: "EM410x",
                id: "1A2B3C4D5E",
            }),
        );
    });

    it("HF card found → saves as HF type", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "DEADBEEF" },
            diagnosis: "none",
        });
        mockPromptName.mockResolvedValue("laundry");
        mockSaveTag.mockResolvedValue(undefined);

        expect(await read()).toBe(true);
        expect(mockSaveTag).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "laundry",
                type: "MIFARE Classic 1K",
                id: "DEADBEEF",
            }),
        );
    });

    it("no card detected → false", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({ card: null, diagnosis: "none" });

        expect(await read()).toBe(false);
        expect(mockPromptName).not.toHaveBeenCalled();
    });

    it("blank T55x7 detected → false with blank hint", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({ card: null, diagnosis: "blank_t55x7" });

        expect(await read()).toBe(false);
    });

    it("bricked HF detected → false with repair hint", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({ card: null, diagnosis: "bricked_hf" });

        expect(await read()).toBe(false);
    });

    it("no device connected → false immediately", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await read()).toBe(false);
        expect(mockSearchCardWithDiagnosis).not.toHaveBeenCalled();
    });

    it("user skips save → does not call saveTag", async () => {
        mockSearchCardWithDiagnosis.mockResolvedValueOnce({
            card: { type: "EM410x", id: "1A2B3C4D5E" },
            diagnosis: "none",
        });
        mockPromptName.mockResolvedValue(null);

        expect(await read()).toBe(true);
        expect(mockSaveTag).not.toHaveBeenCalled();
    });

    it("pm3 not found → false", async () => {
        mockSearchCardWithDiagnosis.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await read()).toBe(false);
    });
});
