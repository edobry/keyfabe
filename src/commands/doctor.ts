import * as p from "@clack/prompts";
import chalk from "chalk";
import { Pm3Cmd } from "../lib/constants.js";
import { HF_VOLTAGE_THRESHOLD, LF_VOLTAGE_THRESHOLD, printBrewInstall } from "../lib/display.js";
import { parseHwStatus, parseHwTune } from "../lib/parsers.js";
import { detectPort, Pm3Error, pm3Exec } from "../lib/pm3.js";

export async function doctor(): Promise<boolean> {
    p.intro("Proxmark3 Health Check");

    // 1. Port detection
    const port = await detectPort();
    if (port) {
        p.log.success(`Port: ${port}`);
    } else {
        p.log.error("No Proxmark3 detected. Check USB connection.");
        return false;
    }

    // 2. Communication check
    const s = p.spinner();
    s.start("Checking device communication...");
    try {
        const { stdout } = await pm3Exec(Pm3Cmd.HW_STATUS);
        const status = parseHwStatus(stdout);

        if (status.isStockFirmware) {
            s.stop("Stock firmware detected.");
            p.log.warn("Stock firmware detected. Run `keyfabe setup` to flash Iceman firmware.");
            return false;
        }

        if (!status.connected) {
            s.stop("Cannot communicate with device.");
            p.log.warn("Cannot communicate with device. Check connection and try `keyfabe setup`.");
            return false;
        }

        s.stop("Device communication OK");
        p.log.success(`Firmware: ${status.firmwareVersion}`);
    } catch (err) {
        if (err instanceof Pm3Error) {
            if (err.message.includes("not found")) {
                s.stop("pm3 command not found.");
                printBrewInstall();
            } else {
                s.stop(err.message);
            }
        } else {
            s.stop("Failed to communicate with device.");
        }
        return false;
    }

    // 3. Antenna tuning
    const tuneSpinner = p.spinner();
    tuneSpinner.start("Checking antenna tuning...");
    try {
        const { stdout } = await pm3Exec(Pm3Cmd.HW_TUNE);
        const tune = parseHwTune(stdout);
        tuneSpinner.stop("Antenna tuning complete");

        const lfColor = tune.lfVoltage >= LF_VOLTAGE_THRESHOLD ? chalk.green : chalk.red;
        const hfColor = tune.hfVoltage >= HF_VOLTAGE_THRESHOLD ? chalk.green : chalk.red;

        const voltageLines = [
            lfColor(`LF antenna: ${tune.lfVoltage.toFixed(2)}V (125 kHz)`),
            hfColor(`HF antenna: ${tune.hfVoltage.toFixed(2)}V (13.56 MHz)`),
        ];
        p.note(voltageLines.join("\n"), "Antenna Tuning");

        if (tune.lfVoltage < LF_VOLTAGE_THRESHOLD) {
            p.log.warn("LF antenna reading low. Check antenna connection.");
        }
        if (tune.hfVoltage < HF_VOLTAGE_THRESHOLD) {
            p.log.warn("HF antenna reading low. Check antenna connection.");
        }
    } catch (err) {
        if (err instanceof Pm3Error) {
            tuneSpinner.stop(err.message);
        } else {
            tuneSpinner.stop("Failed to check antenna tuning.");
        }
    }

    p.outro("Device is healthy!");
    return true;
}
