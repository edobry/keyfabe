import * as p from "@clack/prompts";
import { printBrewInstall } from "../lib/display.js";
import {
    buildFirmware,
    checkInstalled,
    execCommand,
    findBrewCache,
    flashFirmware,
    waitForDevice,
} from "../lib/firmware.js";
import { parseHwStatus, parseHwTune } from "../lib/parsers.js";
import { detectPort, Pm3Error, pm3Exec } from "../lib/pm3.js";
import { confirm } from "../lib/prompts.js";

export async function setup(): Promise<boolean> {
    p.intro("Proxmark3 Firmware Setup");

    // Step 1: Prerequisites
    p.log.step("Step 1: Checking prerequisites...");

    const hasPm3 = await checkInstalled("pm3");
    if (!hasPm3) {
        p.log.error("pm3 not found.");
        printBrewInstall();
        return false;
    }
    p.log.success("pm3: installed");

    const hasMake = await checkInstalled("make");
    if (!hasMake) {
        p.log.error("make not found. Install Xcode Command Line Tools: xcode-select --install");
        return false;
    }
    p.log.success("make: installed");

    const hasProxmark3 = await checkInstalled("proxmark3");
    if (!hasProxmark3) {
        p.log.error("proxmark3 flasher not found.");
        printBrewInstall();
        return false;
    }
    p.log.success("proxmark3: installed");

    const port = await detectPort();
    if (!port) {
        p.log.error("No Proxmark3 detected. Plug in your device and try again.");
        return false;
    }
    p.log.success(`device: ${port}`);

    // Step 2: Diagnose current state
    p.log.step("Step 2: Checking current firmware...");

    const diagSpinner = p.spinner();
    diagSpinner.start("Running hw status...");
    try {
        const { stdout } = await pm3Exec("hw status");
        const status = parseHwStatus(stdout);

        if (status.connected) {
            diagSpinner.stop("Firmware is already working.");
            p.log.success(`Firmware: ${status.firmwareVersion}`);
            p.log.success("No action needed. Device is ready to use.");
            return true;
        }

        diagSpinner.stop("Device found but firmware is incompatible. Proceeding with flash.");
        p.log.warn("Device found but firmware is incompatible. Proceeding with flash.");
    } catch (err) {
        if (err instanceof Pm3Error && err.message.includes("not found")) {
            diagSpinner.stop("pm3 command failed.");
            return false;
        }
        diagSpinner.stop("Cannot communicate with device. Proceeding with flash.");
        p.log.warn("Cannot communicate with device. Proceeding with flash.");
    }

    // Step 3: Locate source
    p.log.step("Step 3: Locating Proxmark3 source...");

    let tarball: string;
    const sourceSpinner = p.spinner();
    sourceSpinner.start("Finding Homebrew cache...");
    try {
        tarball = await findBrewCache();
        sourceSpinner.stop(`Found: ${tarball}`);
    } catch {
        sourceSpinner.stop("Proxmark3 not installed via Homebrew.");
        printBrewInstall();
        return false;
    }

    // Step 4: Build firmware
    p.log.step("Step 4: Building firmware...");

    const suffix = Math.random().toString(36).slice(2, 8);
    const sourceDir = `/tmp/pm3build-${suffix}`;

    const extractSpinner = p.spinner();
    extractSpinner.start("Extracting source...");
    try {
        await execCommand("mkdir", ["-p", sourceDir]);
        await execCommand("tar", ["xf", tarball, "-C", sourceDir, "--strip-components=1"]);
        extractSpinner.stop("Source extracted.");
    } catch (err) {
        extractSpinner.stop(`Failed to extract source: ${(err as Error).message}`);
        return false;
    }

    const buildSpinner = p.spinner();
    buildSpinner.start("Building firmware (this may take ~30s)...");
    try {
        await buildFirmware(sourceDir);
        buildSpinner.stop("Firmware built successfully.");
    } catch (err) {
        buildSpinner.stop(`Build failed: ${(err as Error).message}`);
        return false;
    }

    // Step 5: Flash
    p.log.step("Step 5: Flashing firmware...");

    const shouldFlash = await confirm(
        "Ready to flash firmware. This will overwrite the device's current firmware. Continue?",
    );
    if (!shouldFlash) {
        p.log.warn(`Flash cancelled. Build artifacts remain at: ${sourceDir}`);
        return false;
    }

    const currentPort = await detectPort();
    if (!currentPort) {
        p.log.error("Device disconnected. Plug it back in and try again.");
        return false;
    }

    const flashSpinner = p.spinner();
    flashSpinner.start("Flashing firmware...");
    try {
        await flashFirmware(currentPort, sourceDir);
        flashSpinner.stop("Firmware flashed successfully.");
    } catch (err) {
        flashSpinner.stop(`Flash failed: ${(err as Error).message}`);
        p.log.warn("If flash was interrupted, hold the button while plugging in to enter recovery mode.");
        return false;
    }

    // Step 6: Post-flash verification
    p.log.step("Step 6: Verifying...");

    const waitSpinner = p.spinner();
    waitSpinner.start("Waiting for device to reappear...");
    const newPort = await waitForDevice(15_000);
    if (!newPort) {
        waitSpinner.stop("Device did not reappear after flash.");
        p.log.warn("Try unplugging and re-plugging the device.");
        p.log.warn("If it still doesn't work, hold the button while plugging in for recovery mode.");
        return false;
    }
    waitSpinner.stop(`Device found at ${newPort}`);

    const verifySpinner = p.spinner();
    verifySpinner.start("Checking communication...");
    try {
        const { stdout } = await pm3Exec("hw status");
        const status = parseHwStatus(stdout);

        if (!status.connected) {
            verifySpinner.stop("Communication still failing after flash.");
            p.log.warn("Try running `keyfabe setup` again.");
            return false;
        }

        verifySpinner.stop("Communication OK");
        p.log.success(`Firmware: ${status.firmwareVersion}`);
    } catch {
        verifySpinner.stop("Failed to verify communication.");
        return false;
    }

    const tuneSpinner = p.spinner();
    tuneSpinner.start("Checking antenna tuning...");
    try {
        const { stdout } = await pm3Exec("hw tune");
        const tune = parseHwTune(stdout);
        tuneSpinner.stop("Antenna check complete");
        p.log.success(`LF antenna: ${tune.lfVoltage.toFixed(2)}V (125 kHz)`);
        p.log.success(`HF antenna: ${tune.hfVoltage.toFixed(2)}V (13.56 MHz)`);
    } catch {
        tuneSpinner.stop("Failed to check antenna tuning.");
    }

    p.outro("Setup complete! Device is ready to use.");
    return true;
}
