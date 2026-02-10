import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

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

import { setup } from "../../src/commands/setup.js";
import {
    buildFirmware,
    checkInstalled,
    execCommand,
    findBrewCache,
    flashFirmware,
    waitForDevice,
} from "../../src/lib/firmware.js";
import { detectPort, pm3Exec } from "../../src/lib/pm3.js";
import { confirm } from "../../src/lib/prompts.js";

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
    setupBeforeEach();
});

describe("setup", () => {
    it("happy path: prerequisites pass, firmware needed, build and flash succeed", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValueOnce("/dev/tty.usbmodem1234").mockResolvedValueOnce("/dev/tty.usbmodem1234");

        mockPm3Exec
            .mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" })
            .mockResolvedValueOnce({ stdout: "firmware version: v4.18484 - Iceman", stderr: "" })
            .mockResolvedValueOnce({
                stdout: "# LF antenna:  125.00 kHz:  29.84 V\n# HF antenna:  13.56 MHz:  24.56 V",
                stderr: "",
            });

        mockFindBrewCache.mockResolvedValue("/Users/test/Library/Caches/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(true);
        mockFlashFirmware.mockResolvedValue(undefined);
        mockWaitForDevice.mockResolvedValue("/dev/tty.usbmodem5678");

        expect(await setup()).toBe(true);
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

        expect(await setup()).toBe(true);
        expect(mockBuildFirmware).not.toHaveBeenCalled();
    });

    it("no device → false", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue(null);

        expect(await setup()).toBe(false);
        expect(mockPm3Exec).not.toHaveBeenCalled();
    });

    it("pm3 not installed → false", async () => {
        mockCheckInstalled.mockResolvedValueOnce(false);

        expect(await setup()).toBe(false);
    });

    it("make not installed → false", async () => {
        mockCheckInstalled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        expect(await setup()).toBe(false);
    });

    it("proxmark3 flasher not installed → false", async () => {
        mockCheckInstalled.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        expect(await setup()).toBe(false);
    });

    it("brew cache not found → false", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockRejectedValue(new Error("No available formula"));

        expect(await setup()).toBe(false);
    });

    it("build fails → false, does not attempt flash", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockRejectedValue(new Error("compilation error"));

        expect(await setup()).toBe(false);
        expect(mockFlashFirmware).not.toHaveBeenCalled();
    });

    it("user declines flash → false", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(false);

        expect(await setup()).toBe(false);
        expect(mockFlashFirmware).not.toHaveBeenCalled();
    });

    it("flash fails → false", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(true);
        mockFlashFirmware.mockRejectedValue(new Error("flash error"));

        expect(await setup()).toBe(false);
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

        expect(await setup()).toBe(true);
    });

    it("device does not reappear after flash → false", async () => {
        mockCheckInstalled.mockResolvedValue(true);
        mockDetectPort.mockResolvedValue("/dev/tty.usbmodem1234");
        mockPm3Exec.mockResolvedValueOnce({ stdout: "ERROR: cannot communicate", stderr: "" });
        mockFindBrewCache.mockResolvedValue("/cache/proxmark3.tar.xz");
        mockExecCommand.mockResolvedValue({ stdout: "", stderr: "" });
        mockBuildFirmware.mockResolvedValue(undefined);
        mockConfirm.mockResolvedValue(true);
        mockFlashFirmware.mockResolvedValue(undefined);
        mockWaitForDevice.mockResolvedValue(null);

        expect(await setup()).toBe(false);
    });
});
