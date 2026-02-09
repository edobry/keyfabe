import { execFile } from "node:child_process";
import { detectPort } from "./pm3.js";

const BUILD_FLAGS = [
    "PLATFORM=PM3GENERIC",
    "PLATFORM_SIZE=256",
    "SKIP_HITAG=1",
    "SKIP_LEGICRF=1",
    "SKIP_EM4x50=1",
    "SKIP_EM4x70=1",
    "SKIP_ICLASS=1",
    "SKIP_FELICA=1",
    "SKIP_HFPLOT=1",
    "SKIP_HFSNIFF=1",
    "SKIP_NFCBARCODE=1",
    "SKIP_ZX8211=1",
    "SKIP_ISO15693=1",
    "SKIP_ISO14443b=1",
];

export interface ExecResult {
    stdout: string;
    stderr: string;
}

export async function execCommand(
    cmd: string,
    args: string[],
    opts?: { timeout?: number; cwd?: string },
): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
        execFile(
            cmd,
            args,
            {
                timeout: opts?.timeout ?? 120_000,
                cwd: opts?.cwd,
            },
            (error, stdout, stderr) => {
                const out = stdout?.toString() ?? "";
                const err = stderr?.toString() ?? "";
                if (error) {
                    const e = new Error(`${cmd} failed: ${error.message}`) as Error & {
                        stdout: string;
                        stderr: string;
                    };
                    e.stdout = out;
                    e.stderr = err;
                    reject(e);
                    return;
                }
                resolve({ stdout: out, stderr: err });
            },
        );
    });
}

export async function checkInstalled(binary: string): Promise<boolean> {
    try {
        await execCommand("which", [binary], { timeout: 5_000 });
        return true;
    } catch {
        return false;
    }
}

export async function findBrewCache(): Promise<string> {
    const { stdout } = await execCommand("brew", ["--cache", "rfidresearchgroup/proxmark3/proxmark3"], {
        timeout: 10_000,
    });
    const path = stdout.trim();
    if (!path) {
        throw new Error("Proxmark3 not installed via Homebrew.");
    }
    return path;
}

export async function buildFirmware(sourceDir: string): Promise<void> {
    await execCommand("make", ["clean"], { cwd: sourceDir, timeout: 30_000 });
    await execCommand("make", ["-j4", "bootrom", "fullimage", ...BUILD_FLAGS], { cwd: sourceDir, timeout: 120_000 });
}

export async function flashFirmware(port: string, sourceDir: string): Promise<void> {
    const bootrom = `${sourceDir}/bootrom/obj/bootrom.elf`;
    const fullimage = `${sourceDir}/armsrc/obj/fullimage.elf`;

    await execCommand("proxmark3", [port, "--flash", "--unlock-bootloader", "--image", bootrom, "--image", fullimage], {
        timeout: 60_000,
    });
}

export async function waitForDevice(timeoutMs = 15_000): Promise<string | null> {
    const start = Date.now();
    const interval = 1_000;

    while (Date.now() - start < timeoutMs) {
        const port = await detectPort();
        if (port) return port;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return null;
}
