import { readFile } from "node:fs/promises";
import chalk from "chalk";
import type { Fob } from "../lib/store.js";
import { importFobs } from "../lib/store.js";

function validateFobs(data: unknown): data is Fob[] {
    if (!Array.isArray(data)) return false;
    return data.every(
        (item) =>
            typeof item === "object" &&
            item !== null &&
            typeof item.name === "string" &&
            typeof item.type === "string" &&
            typeof item.id === "string" &&
            typeof item.savedAt === "string",
    );
}

export async function importFile(filePath: string): Promise<boolean> {
    let raw: string;
    try {
        raw = await readFile(filePath, "utf-8");
    } catch {
        console.log(chalk.red(`\nCannot read file: ${filePath}\n`));
        return false;
    }

    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        console.log(chalk.red("\nInvalid JSON.\n"));
        return false;
    }

    if (!validateFobs(data)) {
        console.log(
            chalk.red("\nInvalid format. Expected an array of fob objects with name, type, id, and savedAt.\n"),
        );
        return false;
    }

    const { added, updated } = await importFobs(data);
    console.log(chalk.green(`\nImported ${added} new, updated ${updated} existing.\n`));
    return true;
}
