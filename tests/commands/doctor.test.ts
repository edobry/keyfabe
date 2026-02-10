import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, mockOra, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockOra();

import { doctor } from "../../src/commands/doctor.js";
import { detectPort, Pm3Error, pm3Exec } from "../../src/lib/pm3.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockDetectPort = vi.mocked(detectPort);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    setupBeforeEach();
});

describe("doctor", () => {
    it("happy path: port found, connected, good voltages", async () => {
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

        await doctor();

        const output = getOutput();
        expect(output).toContain("tty.usbmodem1234");
        expect(output).toContain("29.84");
    });

    it("no port: prints error and returns early", async () => {
        mockDetectPort.mockResolvedValue(null);

        await doctor();

        const output = getOutput();
        expect(output).toContain("No Proxmark3 detected");
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("stock firmware: detects unknown command and suggests keyfabe setup", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "[!!] unknown command 'hw status'",
            stderr: "",
        });

        const result = await doctor();

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("Stock firmware detected");
        expect(output).toContain("keyfabe setup");
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("communication failure: hw status shows error, suggests keyfabe setup", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "ERROR: cannot communicate with device",
            stderr: "",
        });

        await doctor();

        const output = getOutput();
        expect(output).toContain("keyfabe setup");
        expect(output).toContain("Cannot communicate with device");
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("pm3 not installed: prints brew install instructions", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockRejectedValueOnce(
            new MockPm3Error("pm3 command not found. Install Proxmark3 client: brew install proxmark3", "", ""),
        );

        await doctor();

        const output = getOutput();
        expect(output).toContain("brew tap rfidresearchgroup/proxmark3");
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("low antenna voltage: prints warnings", async () => {
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

        await doctor();

        const output = getOutput();
        expect(output).toContain("LF antenna reading low");
        expect(output).toContain("HF antenna reading low");
    });
});
