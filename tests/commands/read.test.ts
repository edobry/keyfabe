import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/pm3.js", () => ({
    pm3Exec: vi.fn(),
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

vi.mock("ora", () => ({
    default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: "",
    }),
}));

import { read } from "../../src/commands/read.js";
import { pm3Exec } from "../../src/lib/pm3.js";
import { promptName } from "../../src/lib/prompts.js";
import { saveFob } from "../../src/lib/store.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("read", () => {
    it("LF card found: displays info, prompts to save", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
            stderr: "",
        });
        mockPromptName.mockResolvedValue(null);

        await read();

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("EM410x");
        expect(output).toContain("1A2B3C4D5E");
    });

    it("LF miss, HF fallback tries hf search", async () => {
        mockPm3Exec.mockResolvedValueOnce({ stdout: "no known cards", stderr: "" }).mockResolvedValueOnce({
            stdout: "[+] EM 410x Tag ID: AABBCCDDEE",
            stderr: "",
        });
        mockPromptName.mockResolvedValue(null);

        await read();

        expect(mockPm3Exec).toHaveBeenCalledTimes(2);
        expect(mockPm3Exec).toHaveBeenNthCalledWith(1, "lf search");
        expect(mockPm3Exec).toHaveBeenNthCalledWith(2, "hf search");
    });

    it("no card at all: prints error", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "no known cards", stderr: "" })
            .mockResolvedValueOnce({ stdout: "no known cards", stderr: "" });

        await read();

        expect(mockPromptName).not.toHaveBeenCalled();
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
