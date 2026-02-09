import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/pm3.js", () => ({
    pm3Exec: vi.fn(),
    detectPort: vi.fn(),
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

vi.mock("ora", () => ({
    default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: "",
    }),
}));

import { pm3Exec, detectPort, Pm3Error } from "../../src/lib/pm3.js";
import { doctor } from "../../src/commands/doctor.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockDetectPort = vi.mocked(detectPort);
const MockPm3Error = Pm3Error as any;

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
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

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("tty.usbmodem1234");
        expect(output).toContain("29.84");
    });

    it("no port: prints error and returns early", async () => {
        mockDetectPort.mockResolvedValue(null);

        await doctor();

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("No Proxmark3 detected");
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("communication failure: hw status shows error, suggests keyfabe setup", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({
            stdout: "ERROR: cannot communicate with device",
            stderr: "",
        });

        await doctor();

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("keyfabe setup");
        expect(output).toContain("firmware is incompatible");
        // Should not attempt hw tune
        expect(mockPm3Exec).toHaveBeenCalledTimes(1);
    });

    it("pm3 not installed: prints brew install instructions", async () => {
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockRejectedValueOnce(
            new MockPm3Error("pm3 command not found. Install Proxmark3 client: brew install proxmark3", "", ""),
        );

        await doctor();

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
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

        const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        const output = calls.join("\n");
        expect(output).toContain("LF antenna reading low");
        expect(output).toContain("HF antenna reading low");
    });
});
