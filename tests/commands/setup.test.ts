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

vi.mock("../../src/lib/firmware.js", () => ({
    checkInstalled: vi.fn(),
    findBrewCache: vi.fn(),
    buildFirmware: vi.fn(),
    flashFirmware: vi.fn(),
    waitForDevice: vi.fn(),
    execCommand: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    confirm: vi.fn(),
}));

vi.mock("ora", () => ({
    default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        warn: vi.fn().mockReturnThis(),
        text: "",
    }),
}));

import { pm3Exec, detectPort, Pm3Error } from "../../src/lib/pm3.js";
import {
    checkInstalled,
    findBrewCache,
    buildFirmware,
    flashFirmware,
    waitForDevice,
    execCommand,
} from "../../src/lib/firmware.js";
import { confirm } from "../../src/lib/prompts.js";
import { setup } from "../../src/commands/setup.js";

const mockPm3Exec = vi.mocked(pm3Exec);
const mockDetectPort = vi.mocked(detectPort);
const mockCheckInstalled = vi.mocked(checkInstalled);
const mockFindBrewCache = vi.mocked(findBrewCache);
const mockBuildFirmware = vi.mocked(buildFirmware);
const mockFlashFirmware = vi.mocked(flashFirmware);
const mockWaitForDevice = vi.mocked(waitForDevice);
const mockExecCommand = vi.mocked(execCommand);
const mockConfirm = vi.mocked(confirm);

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

function getOutput(): string {
    return (console.log as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]).join("\n");
}

describe("setup", () => {
    it("happy path: prerequisites pass, firmware needed, build and flash succeed", async () => {
        // Prerequisites all pass
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort
            .mockResolvedValueOnce("/dev/tty.usbmodem1234")  // initial detection
            .mockResolvedValueOnce("/dev/tty.usbmodem1234"); // pre-flash detection

        // hw status shows incompatible firmware
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" })
            // post-flash hw status
            .mockResolvedValueOnce({ stdout: "firmware version: v4.18484 - Iceman", stderr: "" })
            // post-flash hw tune
            .mockResolvedValueOnce({
                stdout: "# LF antenna:  125.00 kHz:  29.84 V\n# HF antenna:  13.56 MHz:  24.56 V",
                stderr: "",
            });

        // Brew cache found
        mockFindBrewCache.mockResolvedValue("/Users/test/Library/Caches/proxmark3.tar.xz");

        // Extract succeeds
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });

        // Build succeeds
        mockBuildFirmware.mockResolvedValue(undefined);

        // User confirms flash
        mockConfirm.mockResolvedValue(true);

        // Flash succeeds
        mockFlashFirmware.mockResolvedValue(undefined);

        // Device reappears
        mockWaitForDevice.mockResolvedValue("/dev/tty.usbmodem5678");

        await setup();

        const output = getOutput();
        expect(output).toContain("Setup complete");
        expect(mockBuildFirmware).toHaveBeenCalled();
        expect(mockFlashFirmware).toHaveBeenCalled();
    });

    it("already up to date: hw status works, exits early", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");

        mockPm3Exec.mockResolvedValueOnce({
            stdout: "firmware version: v4.18484 - Iceman\nall good",
            stderr: "",
        });

        await setup();

        const output = getOutput();
        expect(output).toContain("No action needed");
        expect(mockBuildFirmware).not.toHaveBeenCalled();
    });

    it("no device: prints plug-in message", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue(null);

        await setup();

        const output = getOutput();
        expect(output).toContain("No Proxmark3 detected");
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("pm3 not installed: prints brew install instructions", async () => {
        mockCheckInstalled.mockResolvedValueOnce(false); // pm3

        await setup();

        const output = getOutput();
        expect(output).toContain("pm3 not found");
        expect(output).toContain("brew tap rfidresearchgroup/proxmark3");
    });

    it("make not installed: prints install instructions", async () => {
        mockCheckInstalled
            .mockResolvedValueOnce(true)   // pm3
            .mockResolvedValueOnce(false);  // make

        await setup();

        const output = getOutput();
        expect(output).toContain("make not found");
        expect(output).toContain("xcode-select");
    });

    it("proxmark3 flasher not installed: prints install instructions", async () => {
        mockCheckInstalled
            .mockResolvedValueOnce(true)   // pm3
            .mockResolvedValueOnce(true)   // make
            .mockResolvedValueOnce(false);  // proxmark3

        await setup();

        const output = getOutput();
        expect(output).toContain("proxmark3 flasher not found");
    });

    it("brew cache not found: prints install instructions", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockRejectedValue(new Error("No available formula"));

        await setup();

        const output = getOutput();
        expect(output).toContain("Install first");
        expect(output).toContain("brew tap rfidresearchgroup/proxmark3");
    });

    it("build fails: prints error, does not attempt flash", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockRejectedValue(new Error("compilation error"));

        await setup();

        expect(mockFlashFirmware).not.toHaveBeenCalled();
    });

    it("user declines flash: exits gracefully", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(false);

        await setup();

        const output = getOutput();
        expect(output).toContain("Flash cancelled");
        expect(mockFlashFirmware).not.toHaveBeenCalled();
    });

    it("flash fails: prints error and recovery instructions", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(true);
        mockFlashFirmware.mockRejectedValue(new Error("flash error"));

        await setup();

        const output = getOutput();
        expect(output).toContain("recovery mode");
    });

    it("device reappears after flash: verification passes", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" })
            .mockResolvedValueOnce({ stdout: "firmware version: v4.18484 - Iceman", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "# LF antenna:  125.00 kHz:  29.84 V\n# HF antenna:  13.56 MHz:  24.56 V",
                stderr: "",
            });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(true);
        mockFlashFirmware.mockResolvedValue(undefined);
        mockWaitForDevice.mockResolvedValue("/dev/tty.usbmodem5678");

        await setup();

        const output = getOutput();
        expect(output).toContain("Setup complete");
        expect(output).toContain("29.84");
    });

    it("device does not reappear after flash: prints troubleshooting", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(true);
        mockFlashFirmware.mockResolvedValue(undefined);
        mockWaitForDevice.mockResolvedValue(null);

        await setup();

        const output = getOutput();
        expect(output).toContain("re-plugging");
        expect(output).toContain("recovery mode");
    });
});
