import chalk from "chalk";
import { removeFob } from "../lib/store.js";

export async function deleteFob(name: string): Promise<boolean> {
    const removed = await removeFob(name);
    if (!removed) {
        console.log(chalk.red(`\nNo saved fob named "${name}". Use \`keyfabe list\` to see saved fobs.\n`));
        return false;
    }
    console.log(chalk.green(`\nDeleted "${name}".\n`));
    return true;
}
