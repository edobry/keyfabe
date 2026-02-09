import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockOra, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockOra();

import { writeAndVerify } from "../../src/lib/card-ops.js";
import { pm3Exec } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);

beforeEach(() => {
    setupBeforeEach();
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
