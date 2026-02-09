import chalk from "chalk";
import ora from "ora";
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
    console.log(chalk.bold("\nProxmark3 Firmware Setup Wizard\n"));

    // Step 1: Prerequisites
    console.log(chalk.bold("Step 1: Checking prerequisites...\n"));

    const hasPm3 = await checkInstalled("pm3");
    if (!hasPm3) {
        console.log(chalk.red("  pm3 not found."));
        console.log(chalk.yellow("  Install Proxmark3 client:"));
        console.log(chalk.yellow("    brew tap rfidresearchgroup/proxmark3 && brew install proxmark3"));
        return false;
    }
    console.log(chalk.green("  pm3:        installed"));

    const hasMake = await checkInstalled("make");
    if (!hasMake) {
        console.log(chalk.red("  make not found. Install Xcode Command Line Tools: xcode-select --install"));
        return false;
    }
    console.log(chalk.green("  make:       installed"));

    const hasProxmark3 = await checkInstalled("proxmark3");
    if (!hasProxmark3) {
        console.log(chalk.red("  proxmark3 flasher not found."));
        console.log(chalk.yellow("  Install Proxmark3 client:"));
        console.log(chalk.yellow("    brew tap rfidresearchgroup/proxmark3 && brew install proxmark3"));
        return false;
    }
    console.log(chalk.green("  proxmark3:  installed"));

    const port = await detectPort();
    if (!port) {
        console.log(chalk.red("\n  No Proxmark3 detected. Plug in your device and try again."));
        return false;
    }
    console.log(chalk.green(`  device:     ${port}`));

    // Step 2: Diagnose current state
    console.log(chalk.bold("\nStep 2: Checking current firmware...\n"));

    const diagSpinner = ora("Running hw status...").start();
    try {
        const { stdout } = await pm3Exec("hw status");
        const status = parseHwStatus(stdout);

        if (status.connected) {
            diagSpinner.succeed("Firmware is already working.");
            console.log(chalk.green(`  Firmware: ${status.firmwareVersion}`));
            console.log(chalk.green("\n  No action needed. Device is ready to use."));
            return true;
        }

        diagSpinner.warn("Device found but firmware is incompatible. Proceeding with flash.");
    } catch (err) {
        if (err instanceof Pm3Error && err.message.includes("not found")) {
            diagSpinner.fail("pm3 command failed.");
            return false;
        }
        diagSpinner.warn("Cannot communicate with device. Proceeding with flash.");
    }

    // Step 3: Locate source
    console.log(chalk.bold("\nStep 3: Locating Proxmark3 source...\n"));

    let tarball: string;
    const sourceSpinner = ora("Finding Homebrew cache...").start();
    try {
        tarball = await findBrewCache();
        sourceSpinner.succeed(`Found: ${tarball}`);
    } catch {
        sourceSpinner.fail("Proxmark3 not installed via Homebrew.");
        console.log(chalk.yellow("  Install first:"));
        console.log(chalk.yellow("    brew tap rfidresearchgroup/proxmark3 && brew install proxmark3"));
        return false;
    }

    // Step 4: Build firmware
    console.log(chalk.bold("\nStep 4: Building firmware...\n"));

    const suffix = Math.random().toString(36).slice(2, 8);
    const sourceDir = `/tmp/pm3build-${suffix}`;

    const extractSpinner = ora("Extracting source...").start();
    try {
        await execCommand("mkdir", ["-p", sourceDir]);
        await execCommand("tar", ["xf", tarball, "-C", sourceDir, "--strip-components=1"]);
        extractSpinner.succeed("Source extracted.");
    } catch (err) {
        extractSpinner.fail(`Failed to extract source: ${(err as Error).message}`);
        return false;
    }

    const buildSpinner = ora("Building firmware (this may take ~30s)...").start();
    try {
        await buildFirmware(sourceDir);
        buildSpinner.succeed("Firmware built successfully.");
    } catch (err) {
        buildSpinner.fail(`Build failed: ${(err as Error).message}`);
        return false;
    }

    // Step 5: Flash
    console.log(chalk.bold("\nStep 5: Flashing firmware...\n"));

    const shouldFlash = await confirm(
        "Ready to flash firmware. This will overwrite the device's current firmware. Continue?",
    );
    if (!shouldFlash) {
        console.log(chalk.yellow(`  Flash cancelled. Build artifacts remain at: ${sourceDir}`));
        return false;
    }

    const currentPort = await detectPort();
    if (!currentPort) {
        console.log(chalk.red("  Device disconnected. Plug it back in and try again."));
        return false;
    }

    const flashSpinner = ora("Flashing firmware...").start();
    try {
        await flashFirmware(currentPort, sourceDir);
        flashSpinner.succeed("Firmware flashed successfully.");
    } catch (err) {
        flashSpinner.fail(`Flash failed: ${(err as Error).message}`);
        console.log(
            chalk.yellow("  If flash was interrupted, hold the button while plugging in to enter recovery mode."),
        );
        return false;
    }

    // Step 6: Post-flash verification
    console.log(chalk.bold("\nStep 6: Verifying...\n"));

    const waitSpinner = ora("Waiting for device to reappear...").start();
    const newPort = await waitForDevice(15_000);
    if (!newPort) {
        waitSpinner.fail("Device did not reappear after flash.");
        console.log(chalk.yellow("  Try unplugging and re-plugging the device."));
        console.log(chalk.yellow("  If it still doesn't work, hold the button while plugging in for recovery mode."));
        return false;
    }
    waitSpinner.succeed(`Device found at ${newPort}`);

    const verifySpinner = ora("Checking communication...").start();
    try {
        const { stdout } = await pm3Exec("hw status");
        const status = parseHwStatus(stdout);

        if (!status.connected) {
            verifySpinner.fail("Communication still failing after flash.");
            console.log(chalk.yellow("  Try running `keyfabe setup` again."));
            return false;
        }

        verifySpinner.succeed("Communication OK");
        console.log(chalk.green(`  Firmware: ${status.firmwareVersion}`));
    } catch {
        verifySpinner.fail("Failed to verify communication.");
        return false;
    }

    const tuneSpinner = ora("Checking antenna tuning...").start();
    try {
        const { stdout } = await pm3Exec("hw tune");
        const tune = parseHwTune(stdout);
        tuneSpinner.succeed("Antenna check complete");
        console.log(chalk.green(`  LF antenna: ${tune.lfVoltage.toFixed(2)}V (125 kHz)`));
        console.log(chalk.green(`  HF antenna: ${tune.hfVoltage.toFixed(2)}V (13.56 MHz)`));
    } catch {
        tuneSpinner.fail("Failed to check antenna tuning.");
    }

    console.log(chalk.bold.green("\n  Setup complete! Device is ready to use.\n"));
    return true;
}
