import * as p from "@clack/prompts";
import { printDoctorHint } from "./display.js";
import { type CardInfo, parseCloneResult, parseLfSearch, parseT55xxDetect } from "./parsers.js";
import { Pm3Error, pm3Exec } from "./pm3.js";

function cloneCommand(card: CardInfo): string {
    switch (card.type) {
        case "EM410x":
            return `lf em 410x clone --id ${card.id}`;
        case "HID Prox":
            return `lf hid clone -r ${card.id}`;
        default:
            throw new Error(`Unsupported card type: ${card.type}`);
    }
}

function verifyCommand(card: CardInfo): string {
    switch (card.type) {
        case "EM410x":
            return "lf em 410x reader";
        case "HID Prox":
            return "lf hid reader";
        default:
            return "lf search";
    }
}

export async function writeAndVerify(card: CardInfo): Promise<boolean> {
    // Detect T55x7
    const detectSpinner = p.spinner();
    detectSpinner.start("Detecting writable card...");
    try {
        const { stdout } = await pm3Exec("lf t55xx detect");
        const t55 = parseT55xxDetect(stdout);
        if (!t55) {
            detectSpinner.stop("Card is not a writable T55x7. Use a blank T55x7 fob.");
            p.log.error("Card is not a writable T55x7. Use a blank T55x7 fob.");
            return false;
        }
        detectSpinner.stop(`Writable card detected (${t55.chipType})`);
    } catch (err) {
        if (err instanceof Pm3Error) {
            detectSpinner.stop(err.message);
            p.log.error(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            detectSpinner.stop("Failed to detect writable card.");
            p.log.error("Failed to detect writable card.");
        }
        return false;
    }

    // Clone
    const cloneSpinner = p.spinner();
    cloneSpinner.start("Writing card data...");
    try {
        const cmd = cloneCommand(card);
        const { stdout } = await pm3Exec(cmd);
        const result = parseCloneResult(stdout);
        if (!result.success) {
            cloneSpinner.stop("Write command did not confirm success.");
            p.log.error("Write command did not confirm success.");
            return false;
        }
        cloneSpinner.stop("Card data written");
    } catch (err) {
        if (err instanceof Pm3Error) {
            cloneSpinner.stop(err.message);
            p.log.error(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            cloneSpinner.stop("Failed to write card data.");
            p.log.error("Failed to write card data.");
        }
        return false;
    }

    // Verify
    const verifySpinner = p.spinner();
    verifySpinner.start("Verifying readback...");
    try {
        const cmd = verifyCommand(card);
        const { stdout } = await pm3Exec(cmd);
        const readback = parseLfSearch(stdout);
        if (readback && readback.id === card.id) {
            verifySpinner.stop("Verification passed — IDs match");
            return true;
        }
        const msg = `Verification failed — readback ID ${readback?.id ?? "not found"} doesn't match ${card.id}. Try again.`;
        verifySpinner.stop(msg);
        p.log.error(msg);
        return false;
    } catch (err) {
        if (err instanceof Pm3Error) {
            verifySpinner.stop(err.message);
            p.log.error(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            verifySpinner.stop("Verification readback failed.");
            p.log.error("Verification readback failed.");
        }
        return false;
    }
}
