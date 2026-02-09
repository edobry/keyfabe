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
    getFob: vi.fn(),
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
import { getFob } from "../../src/lib/store.js";
import { write } from "../../src/commands/write.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockGetFob = vi.mocked(getFob);

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("write", () => {
    it("fob found, write succeeds", async () => {
        mockGetFob.mockResolvedValue({
            name: "front-door",
            type: "EM410x",
            id: "1A2B3C4D5E",
            savedAt: "2024-01-01",
        });

        // t55xx detect
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[+] Chip Type: T55x7", stderr: "" })
            // clone
            .mockResolvedValueOnce({ stdout: "[+] Done", stderr: "" })
            // verify
            .mockResolvedValueOnce({ stdout: "[+] EM 410x Tag ID: 1A2B3C4D5E", stderr: "" });

        await write("front-door");

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("Write successful");
    });

    it("fob not found: prints error", async () => {
        mockGetFob.mockResolvedValue(undefined);

        await write("nonexistent");

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("No saved fob");
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });
});
