import chalk from "chalk";
import ora from "ora";
import { HF_VOLTAGE_THRESHOLD, LF_VOLTAGE_THRESHOLD, printBrewInstall } from "../lib/display.js";
import { parseHwStatus, parseHwTune } from "../lib/parsers.js";
import { detectPort, Pm3Error, pm3Exec } from "../lib/pm3.js";

export async function doctor(): Promise<boolean> {
    console.log(chalk.bold("\nProxmark3 Health Check\n"));

    // 1. Port detection
    const port = await detectPort();
    if (port) {
        console.log(chalk.green(`  Port:     ${port}`));
    } else {
        console.log(chalk.red("  Port:     No Proxmark3 detected. Check USB connection."));
        return false;
    }

    // 2. Communication check
    const spinner = ora("Checking device communication...").start();
    try {
        const { stdout } = await pm3Exec("hw status");
        const status = parseHwStatus(stdout);

        if (status.isStockFirmware) {
            spinner.fail("Stock firmware detected.");
            console.log(
                chalk.yellow("  Firmware: Stock firmware detected. Run `keyfabe setup` to flash Iceman firmware."),
            );
            return false;
        }

        if (!status.connected) {
            spinner.fail("Cannot communicate with device.");
            console.log(chalk.yellow("  Cannot communicate with device. Check connection and try `keyfabe setup`."));
            return false;
        }

        spinner.succeed("Device communication OK");
        console.log(chalk.green(`  Firmware: ${status.firmwareVersion}`));
    } catch (err) {
        if (err instanceof Pm3Error) {
            if (err.message.includes("not found")) {
                spinner.fail("pm3 command not found.");
                printBrewInstall();
            } else {
                spinner.fail(err.message);
            }
        } else {
            spinner.fail("Failed to communicate with device.");
        }
        return false;
    }

    // 3. Antenna tuning
    const tuneSpinner = ora("Checking antenna tuning...").start();
    try {
        const { stdout } = await pm3Exec("hw tune");
        const tune = parseHwTune(stdout);
        tuneSpinner.succeed("Antenna tuning complete");

        const lfColor = tune.lfVoltage >= LF_VOLTAGE_THRESHOLD ? chalk.green : chalk.red;
        const hfColor = tune.hfVoltage >= HF_VOLTAGE_THRESHOLD ? chalk.green : chalk.red;

        console.log(lfColor(`  LF antenna: ${tune.lfVoltage.toFixed(2)}V (125 kHz)`));
        console.log(hfColor(`  HF antenna: ${tune.hfVoltage.toFixed(2)}V (13.56 MHz)`));

        if (tune.lfVoltage < LF_VOLTAGE_THRESHOLD) {
            console.log(chalk.yellow("  ⚠ LF antenna reading low. Check antenna connection."));
        }
        if (tune.hfVoltage < HF_VOLTAGE_THRESHOLD) {
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
    return true;
}
