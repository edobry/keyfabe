import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

import * as p from "@clack/prompts";
import { doctor } from "../../src/commands/doctor.js";
import { detectPort, Pm3Error, pm3Exec } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockDetectPort = vi.mocked(detectPort);
const MockPm3Error = Pm3Error as any;
const mockNote = vi.mocked(p.note);

beforeEach(() => {
    setupBeforeEach();
});

describe("doctor", () => {
    it("happy path: port found, connected, good voltages → true", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec
            .mockResolvedValueOnce({
                stdout: "firmware version: v4.18484 - Iceman\nconnected",
                stderr: "",
            })
            .mockResolvedValueOnce({
                stdout: "# LF antenna:  125.00 kHz:  29.84 V\n# HF antenna:  13.56 MHz:  24.56 V",
                stderr: "",
            });

        expect(await doctor()).toBe(true);
        expect(mockNote).toHaveBeenCalledWith(expect.stringContaining("29.84"), "Antenna Tuning");
    });

    it("no port → false, no pm3 calls", async () => {
        mockDetectPort.mockResolvedValue(null);

        expect(await doctor()).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("stock firmware → false", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[!!] unknown command 'hw status'",
            stderr: "",
        });

        expect(await doctor()).toBe(false);
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("communication failure → false", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "ERROR: cannot communicate with device",
            stderr: "",
        });

        expect(await doctor()).toBe(false);
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("pm3 not installed → false", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockRejectedValueOnce(
            new MockPm3Error("pm3 command not found. Install Proxmark3 client: brew install proxmark3", "", ""),
        );

        expect(await doctor()).toBe(false);
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("low antenna voltage: shows warnings", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec
            .mockResolvedValueOnce({
                stdout: "firmware version: v4.18484\nall good",
                stderr: "",
            })
            .mockResolvedValueOnce({
                stdout: "# LF antenna:  125.00 kHz:  5.00 V\n# HF antenna:  13.56 MHz:  3.00 V",
                stderr: "",
            });

        expect(await doctor()).toBe(true);
        const warnCalls = vi.mocked(p.log.warn).mock.calls.map((c) => c[0]);
        expect(warnCalls).toContainEqual(expect.stringContaining("LF antenna reading low"));
        expect(warnCalls).toContainEqual(expect.stringContaining("HF antenna reading low"));
    });
});
