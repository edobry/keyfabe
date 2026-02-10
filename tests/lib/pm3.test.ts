import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
    log: {
        error: vi.fn(),
    },
}));

vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
    readdir: vi.fn(),
}));

import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import * as p from "@clack/prompts";
import { detectPort, Pm3Error, pm3Exec, requireDevice } from "../../src/lib/pm3.js";

const mockLogError = vi.mocked(p.log.error);

const mockExecFile = vi.mocked(execFile);
const mockReaddir = vi.mocked(readdir);

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("pm3Exec", () => {
    it("returns stdout and stderr on success", async () => {
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(null, "output data", "err data");
            return {} as any;
        });

        const result = await pm3Exec("hw status");
        expect(result).toEqual({ stdout: "output data", stderr: "err data" });
        expect(mockExecFile).toHaveBeenCalledWith(
            "pm3",
            ["-c", "hw status"],
            expect.objectContaining({ timeout: 30_000 }),
            expect.any(Function),
        );
    });

    it("resolves with output on non-zero exit", async () => {
        const err = new Error("exit code 1") as any;
        err.code = 1;
        err.killed = false;
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(err, "some output", "some error");
            return {} as any;
        });

        const result = await pm3Exec("hw status");
        expect(result).toEqual({ stdout: "some output", stderr: "some error" });
    });

    it("rejects with Pm3Error on ENOENT", async () => {
        const err = new Error("spawn pm3 ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(err, "", "");
            return {} as any;
        });

        await expect(pm3Exec("hw status")).rejects.toThrow(Pm3Error);
        await expect(pm3Exec("hw status")).rejects.toThrow(/not found/);
    });

    it("rejects with Pm3Error on timeout (killed)", async () => {
        const err = new Error("timed out") as any;
        err.killed = true;
        mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
            cb(err, "", "");
            return {} as any;
        });

        await expect(pm3Exec("hw status", 5000)).rejects.toThrow(Pm3Error);
        await expect(pm3Exec("hw status", 5000)).rejects.toThrow(/timed out/);
    });
});

describe("detectPort", () => {
    it("finds tty.usbmodem entry", async () => {
        mockReaddir.mockResolvedValue(["tty.Bluetooth-Incoming-Port", "tty.usbmodem1234", "cu.usbmodem1234"] as any);

        const port = await detectPort();
        expect(port).toBe("/dev/tty.usbmodem1234");
    });

    it("returns null when no match", async () => {
        mockReaddir.mockResolvedValue(["tty.Bluetooth-Incoming-Port"] as any);

        const port = await detectPort();
        expect(port).toBeNull();
    });

    it("returns null on readdir error", async () => {
        mockReaddir.mockRejectedValue(new Error("EACCES"));

        const port = await detectPort();
        expect(port).toBeNull();
    });
});

describe("requireDevice", () => {
    it("returns true when device is connected", async () => {
        mockReaddir.mockResolvedValue(["tty.usbmodem1234"] as any);

        const result = await requireDevice();
        expect(result).toBe(true);
    });

    it("returns false and prints message when no device", async () => {
        mockReaddir.mockResolvedValue(["tty.Bluetooth-Incoming-Port"] as any);

        const result = await requireDevice();
        expect(result).toBe(false);
        expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining("No Proxmark3 detected"));
    });
});
