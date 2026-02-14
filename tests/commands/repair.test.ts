import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

vi.mock("../../src/lib/prompts.js", () => ({
    waitForEnter: vi.fn().mockResolvedValue(undefined),
}));

import { repair } from "../../src/commands/repair.js";
import { Pm3Error, pm3Exec, requireDevice } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockRequireDevice = vi.mocked(requireDevice);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
});

describe("repair", () => {
    it("no device → false", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await repair()).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("card already readable → true without repair", async () => {
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[+]  UID: DE AD BE EF\n[+] MIFARE Classic EV1 1K",
            stderr: "",
        });

        expect(await repair()).toBe(true);
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("full repair: corrupted BCC → write corrected → verify → true", async () => {
        // Step 1: normal hf search fails (no card found)
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            // Step 2: BCC bypass read returns block 0 with bad BCC (08 instead of 88)
            .mockResolvedValueOnce({
                stdout: "[=]   0 | 81 54 98 C5 08 08 04 00 00 00 00 00 00 00 00 00 | .T..............",
                stderr: "",
            })
            // Step 4: write corrected block 0
            .mockResolvedValueOnce({ stdout: "[+] Write ( ok )", stderr: "" })
            // Step 5: verify after power cycle
            .mockResolvedValueOnce({
                stdout: "[+]  UID: 81 54 98 C5\n[+] MIFARE Classic EV1 1K",
                stderr: "",
            });

        expect(await repair()).toBe(true);
        expect(mockPm3Exec).toHaveBeenCalledTimes(4);
    });

    it("BCC already correct → still attempts repair (ATQA/SAK issue) → true", async () => {
        // Step 1: normal hf search fails
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            // Step 2: BCC bypass read — BCC is correct (88 = 81^54^98^C5)
            .mockResolvedValueOnce({
                stdout: "[=]   0 | 81 54 98 C5 88 08 04 00 00 00 00 00 00 00 00 00 | .T..............",
                stderr: "",
            })
            // Step 4: write
            .mockResolvedValueOnce({ stdout: "[+] Write ( ok )", stderr: "" })
            // Step 5: verify
            .mockResolvedValueOnce({
                stdout: "[+]  UID: 81 54 98 C5\n[+] MIFARE Classic EV1 1K",
                stderr: "",
            });

        expect(await repair()).toBe(true);
    });

    it("block 0 unreadable → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[!] Auth error", stderr: "" });

        expect(await repair()).toBe(false);
    });

    it("block 0 too short → false", async () => {
        mockPm3Exec.mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" }).mockResolvedValueOnce({
            stdout: "[=]   0 | 81 54 | .T",
            stderr: "",
        });

        expect(await repair()).toBe(false);
    });

    it("write does not confirm success → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[=]   0 | 81 54 98 C5 08 08 04 00 00 00 00 00 00 00 00 00 | .T..............",
                stderr: "",
            })
            .mockResolvedValueOnce({ stdout: "[!] Write failed", stderr: "" });

        expect(await repair()).toBe(false);
    });

    it("verify fails after successful write → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[=]   0 | 81 54 98 C5 08 08 04 00 00 00 00 00 00 00 00 00 | .T..............",
                stderr: "",
            })
            .mockResolvedValueOnce({ stdout: "[+] Write ( ok )", stderr: "" })
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" });

        expect(await repair()).toBe(false);
    });

    it("pm3 not found during initial search → false", async () => {
        mockPm3Exec.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await repair()).toBe(false);
    });

    it("pm3 error during block 0 read → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            .mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await repair()).toBe(false);
    });

    it("pm3 error during write → false", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[=]   0 | 81 54 98 C5 08 08 04 00 00 00 00 00 00 00 00 00 | .T..............",
                stderr: "",
            })
            .mockRejectedValueOnce(new MockPm3Error("pm3 timed out", "", ""));

        expect(await repair()).toBe(false);
    });

    it("SAK 0x18 → repairs as MIFARE Classic 4K", async () => {
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "[!] no known tags found", stderr: "" })
            // Block 0 with SAK=0x18 (byte 5)
            .mockResolvedValueOnce({
                stdout: "[=]   0 | 01 02 03 04 04 18 02 00 00 00 00 00 00 00 00 00 | ................",
                stderr: "",
            })
            .mockResolvedValueOnce({ stdout: "[+] Write ( ok )", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "[+]  UID: 01 02 03 04\n[+] MIFARE Classic 4K",
                stderr: "",
            });

        expect(await repair()).toBe(true);
    });
});
