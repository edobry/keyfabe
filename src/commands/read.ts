import chalk from "chalk";
import ora from "ora";
import { pm3Exec, Pm3Error } from "../lib/pm3.js";
import { parseLfSearch, type CardInfo } from "../lib/parsers.js";
import { saveFob } from "../lib/store.js";
import { promptName } from "../lib/prompts.js";

export async function read(): Promise<void> {
    let card: CardInfo | null = null;

    // Try LF search
    const spinner = ora("Searching for card (LF)...").start();
    try {
        const { stdout } = await pm3Exec("lf search");
        card = parseLfSearch(stdout);
    } catch (err) {
        if (err instanceof Pm3Error) {
            spinner.fail(err.message);
            return;
        }
    }

    // Fallback to HF search
    if (!card) {
        spinner.text = "No LF card found. Trying HF...";
        try {
            const { stdout } = await pm3Exec("hf search");
            // For now we only parse LF types; HF can be added later
            card = parseLfSearch(stdout);
        } catch {
            // ignore
        }
    }

    if (!card) {
        spinner.fail("No card detected. Make sure the fob is flat against the antenna.");
        return;
    }

    spinner.succeed("Card detected");
    console.log(chalk.bold(`\n  Type:     ${card.type}`));
    console.log(chalk.bold(`  ID:       ${card.id}`));
    if (card.encoding) {
        console.log(chalk.bold(`  Encoding: ${card.encoding}`));
    }
    console.log();

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
}
