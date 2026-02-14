import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import * as p from "@clack/prompts";
import type { Pm3Command } from "./constants.js";

const DEFAULT_TIMEOUT = 30_000;

export class Pm3Error extends Error {
    stdout: string;
    stderr: string;
    constructor(message: string, stdout: string, stderr: string) {
        super(message);
        this.name = "Pm3Error";
        this.stdout = stdout;
        this.stderr = stderr;
    }
}

export interface Pm3Result {
    stdout: string;
    stderr: string;
}

export async function pm3Exec(command: Pm3Command, timeout = DEFAULT_TIMEOUT): Promise<Pm3Result> {
    return new Promise((resolve, reject) => {
        const _proc = execFile("pm3", ["-c", command.toString()], { timeout }, (error, stdout, stderr) => {
            const out = stdout?.toString() ?? "";
            const err = stderr?.toString() ?? "";
            if (error) {
                // Still return output on non-zero exit — pm3 often exits non-zero
                // but only reject on actual execution failures (ENOENT, timeout)
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    reject(
                        new Pm3Error(
                            "pm3 command not found. Install Proxmark3 client: brew install proxmark3",
                            out,
                            err,
                        ),
                    );
                    return;
                }
                if (error.killed) {
                    reject(new Pm3Error(`pm3 command timed out after ${timeout}ms`, out, err));
                    return;
                }
                // Non-zero exit but we got output — return it
                resolve({ stdout: out, stderr: err });
                return;
            }
            resolve({ stdout: out, stderr: err });
        });
    });
}

export async function requireDevice(): Promise<boolean> {
    const port = await detectPort();
    if (!port) {
        p.log.error("No Proxmark3 detected. Check USB connection.");
        return false;
    }
    return true;
}

export async function detectPort(): Promise<string | null> {
    try {
        const entries = await readdir("/dev");
        const match = entries.find((e) => e.startsWith("tty.usbmodem"));
        return match ? `/dev/${match}` : null;
    } catch {
        return null;
    }
}
