import chalk from "chalk";
import { printFobNotFound } from "../lib/display.js";
import { renameFob } from "../lib/store.js";

export async function rename(oldName: string, newName: string): Promise<boolean> {
    const result = await renameFob(oldName, newName);

    if (result === "not-found") {
        printFobNotFound(oldName);
        return false;
    }

    if (result === "name-taken") {
        console.log(
            chalk.red(`\nA fob named "${newName}" already exists. Delete it first or choose a different name.\n`),
        );
        return false;
    }

    console.log(chalk.green(`\nRenamed "${oldName}" to "${newName}".\n`));
    return true;
}
