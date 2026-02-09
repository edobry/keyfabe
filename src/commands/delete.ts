import chalk from "chalk";
import { printFobNotFound } from "../lib/display.js";
import { removeFob } from "../lib/store.js";

export async function deleteFob(name: string): Promise<boolean> {
    const removed = await removeFob(name);
    if (!removed) {
        printFobNotFound(name);
        return false;
    }
    console.log(chalk.green(`\nDeleted "${name}".\n`));
    return true;
}
