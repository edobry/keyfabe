import chalk from "chalk";
import { waitForEnter } from "../lib/prompts.js";
import { getFob } from "../lib/store.js";
import { writeAndVerify } from "./clone.js";

export async function write(name: string): Promise<boolean> {
    const fob = await getFob(name);
    if (!fob) {
        console.log(chalk.red(`\nNo saved fob named "${name}". Use \`keyfabe list\` to see saved fobs.\n`));
        return false;
    }

    console.log(chalk.bold(`\nWriting "${fob.name}" (${fob.type} ${fob.id})\n`));

    await waitForEnter("Place a blank T55x7 fob on the antenna.");

    const success = await writeAndVerify({ type: fob.type, id: fob.id, encoding: fob.encoding });

    if (success) {
        console.log(chalk.green("\nWrite successful!\n"));
        return true;
    } else {
        console.log(chalk.red("\nWrite failed.\n"));
        return false;
    }
}
