import chalk from "chalk";
import ora from "ora";
import { printCardInfo } from "../lib/display.js";
import { parseLfSearch } from "../lib/parsers.js";
import { Pm3Error, pm3Exec, requireDevice } from "../lib/pm3.js";
import { promptName } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

export async function read(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    let card: ReturnType<typeof parseLfSearch> = null;

    const spinner = ora("Searching for card (LF)...").start();
    try {
        const { stdout } = await pm3Exec("lf search");
        card = parseLfSearch(stdout);
    } catch (err) {
        if (err instanceof Pm3Error) {
            spinner.fail(err.message);
            return false;
        }
    }

    if (!card) {
        spinner.fail("No card detected. Make sure the fob is flat against the antenna.");
        return false;
    }

    spinner.succeed("Card detected");
    printCardInfo(card);

    // Prompt to save
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
