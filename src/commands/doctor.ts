import chalk from "chalk";
import ora from "ora";
import { pm3Exec, detectPort, Pm3Error } from "../lib/pm3.js";
import { parseHwStatus, parseHwTune } from "../lib/parsers.js";

export async function doctor(): Promise<void> {
    console.log(chalk.bold("\nProxmark3 Health Check\n"));

    // 0. Check pm3 is installed
    let pm3Installed = true;

    // 1. Port detection
    const port = await detectPort();
    if (port) {
        console.log(chalk.green(`  Port:     ${port}`));
    } else {
        console.log(chalk.red("  Port:     No Proxmark3 detected. Check USB connection."));
        return;
    }

    // 2. Communication check
    const spinner = ora("Checking device communication...").start();
    try {
        const { stdout } = await pm3Exec("hw status");
        const status = parseHwStatus(stdout);

        if (!status.connected) {
            spinner.fail("Cannot communicate with device.");
            console.log(chalk.yellow("  Device found but firmware is incompatible. Run `keyfabe setup` to flash Iceman firmware."));
            return;
        }

        spinner.succeed("Device communication OK");
        console.log(chalk.green(`  Firmware: ${status.firmwareVersion}`));
    } catch (err) {
        if (err instanceof Pm3Error) {
            if (err.message.includes("not found")) {
                spinner.fail("pm3 command not found.");
                console.log(chalk.yellow("  Install Proxmark3 client:"));
                console.log(chalk.yellow("    brew tap rfidresearchgroup/proxmark3 && brew install proxmark3"));
            } else {
                spinner.fail(err.message);
            }
        } else {
            spinner.fail("Failed to communicate with device.");
        }
        return;
    }

    // 3. Antenna tuning
    const tuneSpinner = ora("Checking antenna tuning...").start();
    try {
        const { stdout } = await pm3Exec("hw tune");
        const tune = parseHwTune(stdout);
        tuneSpinner.succeed("Antenna tuning complete");

        const lfColor = tune.lfVoltage >= 15 ? chalk.green : chalk.red;
        const hfColor = tune.hfVoltage >= 10 ? chalk.green : chalk.red;

        console.log(lfColor(`  LF antenna: ${tune.lfVoltage.toFixed(2)}V (125 kHz)`));
        console.log(hfColor(`  HF antenna: ${tune.hfVoltage.toFixed(2)}V (13.56 MHz)`));

        if (tune.lfVoltage < 15) {
            console.log(chalk.yellow("  ⚠ LF antenna reading low. Check antenna connection."));
        }
        if (tune.hfVoltage < 10) {
            console.log(chalk.yellow("  ⚠ HF antenna reading low. Check antenna connection."));
        }
    } catch (err) {
        if (err instanceof Pm3Error) {
            tuneSpinner.fail(err.message);
        } else {
            tuneSpinner.fail("Failed to check antenna tuning.");
        }
    }

    console.log();
}
