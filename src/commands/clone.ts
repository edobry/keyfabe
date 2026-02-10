import chalk from "chalk";
import ora from "ora";
import { writeAndVerify } from "../lib/card-ops.js";
import { printCardInfo, printDoctorHint } from "../lib/display.js";
import { parseLfSearch } from "../lib/parsers.js";
import { Pm3Error, pm3Exec, requireDevice } from "../lib/pm3.js";
import { promptName, waitForEnter } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

const MAX_READ_RETRIES = 3;
const READ_RETRY_DELAY = 2000;

export async function clone(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    console.log(chalk.bold("\nKeyfob Clone\n"));

    // Step 1: Read original
    await waitForEnter("Place your original keyfob on the antenna.");

    let card: ReturnType<typeof parseLfSearch> = null;

    for (let attempt = 1; attempt <= MAX_READ_RETRIES; attempt++) {
        const spinner = ora(`Reading original (attempt ${attempt}/${MAX_READ_RETRIES})...`).start();
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
                if (err.message.includes("not found")) {
                    printDoctorHint();
                }
            } else {
                spinner.fail("Read failed.");
            }
        }

        if (attempt < MAX_READ_RETRIES) {
            console.log(chalk.dim(`  Retrying in ${READ_RETRY_DELAY / 1000}s...`));
            await new Promise((r) => setTimeout(r, READ_RETRY_DELAY));
        }
    }

    if (!card) {
        console.log(chalk.red("\nFailed to read original card after all attempts."));
        return false;
    }

    printCardInfo(card);

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
    }
    console.log(chalk.red("\nClone failed.\n"));
    return false;
}
