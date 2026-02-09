import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

vi.mock("../../src/lib/pm3.js", () => ({
    detectPort: vi.fn(),
}));

import { execFile } from "node:child_process";
import {
    buildFirmware,
    checkInstalled,
    execCommand,
    findBrewCache,
    flashFirmware,
    waitForDevice,
} from "../../src/lib/firmware.js";
import { detectPort } from "../../src/lib/pm3.js";

const mockExecFile = vi.mocked(execFile);
const mockDetectPort = vi.mocked(detectPort);

beforeEach(() => {
    vi.resetAllMocks();
});

describe("execCommand", () => {
    it("resolves with stdout and stderr on success", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(null, "hello", "");
            return {} as any;
        });

        const result = await execCommand("echo", ["hello"]);
        expect(result).toEqual({ stdout: "hello", stderr: "" });
    });

    it("rejects on error", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(new Error("fail"), "", "some error");
            return {} as any;
        });

        await expect(execCommand("bad", [])).rejects.toThrow("bad failed: fail");
    });
});

describe("checkInstalled", () => {
    it("returns true when binary is found", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(null, "/usr/local/bin/pm3", "");
            return {} as any;
        });

        expect(await checkInstalled("pm3")).toBe(true);
    });

    it("returns false when binary is not found", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(new Error("not found"), "", "");
            return {} as any;
        });

        expect(await checkInstalled("pm3")).toBe(false);
    });
});

describe("findBrewCache", () => {
    it("returns the cache path", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(null, "/Users/test/Library/Caches/Homebrew/downloads/abc--proxmark3.tar.xz\n", "");
            return {} as any;
        });

        const path = await findBrewCache();
        expect(path).toBe("/Users/test/Library/Caches/Homebrew/downloads/abc--proxmark3.tar.xz");
    });

    it("rejects when brew command fails", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(new Error("No available formula"), "", "");
            return {} as any;
        });

        await expect(findBrewCache()).rejects.toThrow();
    });
});

describe("buildFirmware", () => {
    it("calls make clean then make with correct flags", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(null, "", "");
            return {} as any;
        });

        await buildFirmware("/tmp/pm3build");

        expect(mockExecFile).toHaveBeenCalledTimes(2);

        // First call: make clean
        const [cmd1, args1, opts1] = mockExecFile.mock.calls[0];
        expect(cmd1).toBe("make");
        expect(args1).toEqual(["clean"]);
        expect(opts1).toEqual(expect.objectContaining({ cwd: "/tmp/pm3build" }));

        // Second call: make build
        const [cmd2, args2, opts2] = mockExecFile.mock.calls[1];
        expect(cmd2).toBe("make");
        expect(args2).toContain("-j4");
        expect(args2).toContain("bootrom");
        expect(args2).toContain("fullimage");
        expect(args2).toContain("PLATFORM=PM3GENERIC");
        expect(args2).toContain("PLATFORM_SIZE=256");
        expect(args2).toContain("SKIP_HITAG=1");
        expect(opts2).toEqual(expect.objectContaining({ cwd: "/tmp/pm3build" }));
    });

    it("rejects when build fails", async () => {
        // make clean succeeds, make build fails
        mockExecFile
            .mockImplementationOnce((_cmd, _args, _opts, cb: any) => {
                cb(null, "", "");
                return {} as any;
            })
            .mockImplementationOnce((_cmd, _args, _opts, cb: any) => {
                cb(new Error("compilation error"), "", "Error: build failed");
                return {} as any;
            });

        await expect(buildFirmware("/tmp/pm3build")).rejects.toThrow("make failed");
    });
});

describe("flashFirmware", () => {
    it("calls proxmark3 with correct arguments", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(null, "Flashing...\nDone.", "");
            return {} as any;
        });

        await flashFirmware("/dev/tty.usbmodem1234", "/tmp/pm3build");

        expect(mockExecFile).toHaveBeenCalledTimes(1);
        const [cmd, args] = mockExecFile.mock.calls[0];
        expect(cmd).toBe("proxmark3");
        expect(args).toContain("/dev/tty.usbmodem1234");
        expect(args).toContain("--flash");
        expect(args).toContain("--unlock-bootloader");
        expect(args).toContain("--image");
        expect(args).toContain("/tmp/pm3build/bootrom/obj/bootrom.elf");
        expect(args).toContain("/tmp/pm3build/armsrc/obj/fullimage.elf");
    });

    it("rejects when flash fails", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(new Error("flash failed"), "", "");
            return {} as any;
        });

        await expect(flashFirmware("/dev/tty.usbmodem1234", "/tmp/pm3build")).rejects.toThrow();
    });
});

describe("waitForDevice", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("finds port on retry", async () => {
        mockDetectPort
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce("/dev/tty.usbmodem5678");

        const promise = waitForDevice(10_000);

        // Advance past two polling intervals
        await vi.advanceTimersByTimeAsync(1_000);
        await vi.advanceTimersByTimeAsync(1_000);

        const port = await promise;
        expect(port).toBe("/dev/tty.usbmodem5678");
    });

    it("returns null on timeout", async () => {
        mockDetectPort.mockResolvedValue(null);

        const promise = waitForDevice(3_000);

        // Advance past the timeout
        await vi.advanceTimersByTimeAsync(4_000);

        const port = await promise;
        expect(port).toBeNull();
    });

    afterEach(() => {
        vi.useRealTimers();
    });
});
