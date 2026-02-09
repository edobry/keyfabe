import chalk from "chalk";
import ora from "ora";
import { type CardInfo, parseCloneResult, parseLfSearch, parseT55xxDetect } from "../lib/parsers.js";
import { Pm3Error, pm3Exec } from "../lib/pm3.js";
import { promptName, waitForEnter } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

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
        } else {
            verifySpinner.fail(
                `Verification failed — readback ID ${readback?.id ?? "not found"} doesn't match ${card.id}. Try again.`,
            );
            return false;
        }
    } catch (err) {
        if (err instanceof Pm3Error) {
            verifySpinner.fail(err.message);
        } else {
            verifySpinner.fail("Verification readback failed.");
        }
        return false;
    }
}

export async function clone(): Promise<boolean> {
    console.log(chalk.bold("\nKeyfob Clone\n"));

    // Step 1: Read original
    await waitForEnter("Place your original keyfob on the antenna.");

    let card: CardInfo | null = null;
    const maxRetries = 3;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const spinner = ora(`Reading original (attempt ${attempt}/${maxRetries})...`).start();
        try {
            const { stdout } = await pm3Exec("lf search");
            card = parseLfSearch(stdout);
            if (card) {
                spinner.succeed("Original card read");
                break;
            }
            spinner.fail("No card detected.");
        } catch (err) {
            if (err instanceof Pm3Error) {
                spinner.fail(err.message);
            } else {
                spinner.fail("Read failed.");
            }
        }

        if (attempt < maxRetries) {
            console.log(chalk.dim(`  Retrying in ${retryDelay / 1000}s...`));
            await new Promise((r) => setTimeout(r, retryDelay));
        }
    }

    if (!card) {
        console.log(chalk.red("\nFailed to read original card after all attempts."));
        return false;
    }

    console.log(chalk.bold(`\n  Type:     ${card.type}`));
    console.log(chalk.bold(`  ID:       ${card.id}`));
    if (card.encoding) {
        console.log(chalk.bold(`  Encoding: ${card.encoding}`));
    }
    console.log();

    // Step 2: Write to blank
    await waitForEnter("Remove original and place a blank T55x7 fob on the antenna.");

    const success = await writeAndVerify(card);

    if (success) {
        console.log(chalk.green("\nClone successful!\n"));
        const name = await promptName();
        if (name) {
            await saveFob({
                name,
                type: card.type,
                id: card.id,
                encoding: card.encoding,
                savedAt: new Date().toISOString(),
            });
            console.log(chalk.green(`Saved as "${name}".`));
        }
        return true;
    } else {
        console.log(chalk.red("\nClone failed.\n"));
        return false;
    }
}
