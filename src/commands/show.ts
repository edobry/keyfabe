import chalk from "chalk";
import { printFobNotFound } from "../lib/display.js";
import { getFob } from "../lib/store.js";

export async function show(name: string): Promise<boolean> {
    const fob = await getFob(name);
    if (!fob) {
        printFobNotFound(name);
        return false;
    }

    console.log(chalk.bold(`\n  Name:     ${fob.name}`));
    console.log(chalk.bold(`  Type:     ${fob.type}`));
    console.log(chalk.bold(`  ID:       ${fob.id}`));
    if (fob.encoding) {
        console.log(chalk.bold(`  Encoding: ${fob.encoding}`));
    }
    console.log(chalk.bold(`  Saved:    ${fob.savedAt.slice(0, 10)}`));
    console.log();
    return true;
}
