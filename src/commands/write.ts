import chalk from "chalk";
import { writeAndVerify } from "../lib/card-ops.js";
import { printFobNotFound } from "../lib/display.js";
import { waitForEnter } from "../lib/prompts.js";
import { getFob } from "../lib/store.js";

export async function write(name: string): Promise<boolean> {
    const fob = await getFob(name);
    if (!fob) {
        printFobNotFound(name);
        return false;
    }

    console.log(chalk.bold(`\nWriting "${fob.name}" (${fob.type} ${fob.id})\n`));

    await waitForEnter("Place a blank T55x7 fob on the antenna.");

    const success = await writeAndVerify({ type: fob.type, id: fob.id, encoding: fob.encoding });

    if (success) {
        console.log(chalk.green("\nWrite successful!\n"));
        return true;
    }
    console.log(chalk.red("\nWrite failed.\n"));
    return false;
}
