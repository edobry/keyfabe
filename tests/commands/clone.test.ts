import { describe, it, expect, vi, beforeEach } from "vitest";

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
    waitForEnter: vi.fn().mockResolvedValue(undefined),
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

import { pm3Exec } from "../../src/lib/pm3.js";
import { saveFob } from "../../src/lib/store.js";
import { promptName } from "../../src/lib/prompts.js";
import { writeAndVerify, clone } from "../../src/commands/clone.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockSaveFob = vi.mocked(saveFob);
const mockPromptName = vi.mocked(promptName);

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("writeAndVerify", () => {
    const card = { type: "EM410x", id: "1A2B3C4D5E" };

    it("T55x7 detected, clone succeeds, verify matches → true", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E", stderr: "" });

        const result = await writeAndVerify(card);
        expect(result).toBe(true);
    });

    it("no T55x7 → false", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[!] Could not detect modulation",
            stderr: "",
        });

        const result = await writeAndVerify(card);
        expect(result).toBe(false);
    });

    it("clone fails → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[!!] Error writing block", stderr: "" });

        const result = await writeAndVerify(card);
        expect(result).toBe(false);
    });

    it("verify mismatch → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[+] EM 410x Tag ID: 0000000000", stderr: "" });

        const result = await writeAndVerify(card);
        expect(result).toBe(false);
    });
});

describe("clone", () => {
    it("full happy path: read → write → verify → save", async () => {
        // lf search (read original)
        mockPm3Exec
            .mockResolvedValueOnce({
                stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E\n[+] RF/64",
                stderr: "",
            })
            // t55xx detect
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            // clone command
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            // verify readback
            .mockResolvedValueOnce({ stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E", stderr: "" });

        mockPromptName.mockResolvedValue("cloned-fob");
        mockSaveFob.mockResolvedValue(undefined);

        await clone();

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

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("Failed to read original card");
        expect(mockPm3Exec).toHaveBeenCalledTimes(3);

        vi.useRealTimers();
    });
});
