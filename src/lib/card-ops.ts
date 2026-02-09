import ora from "ora";
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
    const detectSpinner = ora("Detecting writable card...").start();
    try {
        const { stdout } = await pm3Exec("lf t55xx detect");
        const t55 = parseT55xxDetect(stdout);
        if (!t55) {
            detectSpinner.fail("Card is not a writable T55x7. Use a blank T55x7 fob.");
            return false;
        }
        detectSpinner.succeed(`Writable card detected (${t55.chipType})`);
    } catch (err) {
        if (err instanceof Pm3Error) {
            detectSpinner.fail(err.message);
        } else {
            detectSpinner.fail("Failed to detect writable card.");
        }
        return false;
    }

    // Clone
    const cloneSpinner = ora("Writing card data...").start();
    try {
        const cmd = cloneCommand(card);
        const { stdout } = await pm3Exec(cmd);
        const result = parseCloneResult(stdout);
        if (!result.success) {
            cloneSpinner.fail("Write command did not confirm success.");
            return false;
        }
        cloneSpinner.succeed("Card data written");
    } catch (err) {
        if (err instanceof Pm3Error) {
            cloneSpinner.fail(err.message);
        } else {
            cloneSpinner.fail("Failed to write card data.");
        }
        return false;
    }

    // Verify
    const verifySpinner = ora("Verifying readback...").start();
    try {
        const cmd = verifyCommand(card);
        const { stdout } = await pm3Exec(cmd);
        const readback = parseLfSearch(stdout);
        if (readback && readback.id === card.id) {
            verifySpinner.succeed("Verification passed — IDs match");
            return true;
        }
        verifySpinner.fail(
            `Verification failed — readback ID ${readback?.id ?? "not found"} doesn't match ${card.id}. Try again.`,
        );
        return false;
    } catch (err) {
        if (err instanceof Pm3Error) {
            verifySpinner.fail(err.message);
        } else {
            verifySpinner.fail("Verification readback failed.");
        }
        return false;
    }
}
