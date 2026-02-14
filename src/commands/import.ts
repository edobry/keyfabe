import { readFile } from "node:fs/promises";
import * as p from "@clack/prompts";
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
        p.log.error(`Cannot read file: ${filePath}`);
        return false;
    }

    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        p.log.error("Invalid JSON.");
        return false;
    }

    if (!validateFobs(data)) {
        p.log.error("Invalid format. Expected an array of tag objects with name, type, id, and savedAt.");
        return false;
    }

    const { added, updated } = await importFobs(data);
    p.log.success(`Imported ${added} new, updated ${updated} existing.`);
    return true;
}
