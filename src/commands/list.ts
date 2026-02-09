import chalk from "chalk";
import { loadFobs } from "../lib/store.js";

export async function list(): Promise<boolean> {
    const fobs = await loadFobs();

    if (fobs.length === 0) {
        console.log(chalk.dim("\nNo saved fobs. Use `keyfabe read` or `keyfabe clone` to save one.\n"));
        return true;
    }

    const cols = {
        name: Math.max(12, ...fobs.map((f) => f.name.length + 2)),
        type: Math.max(10, ...fobs.map((f) => f.type.length + 2)),
        id: Math.max(16, ...fobs.map((f) => f.id.length + 2)),
    };

    console.log();
    console.log(
        chalk.bold("Name".padEnd(cols.name)) +
            chalk.bold("Type".padEnd(cols.type)) +
            chalk.bold("ID".padEnd(cols.id)) +
            chalk.bold("Saved"),
    );

    for (const fob of fobs) {
        const date = fob.savedAt.slice(0, 10);
        console.log(fob.name.padEnd(cols.name) + fob.type.padEnd(cols.type) + fob.id.padEnd(cols.id) + date);
    }
    console.log();
    return true;
}
