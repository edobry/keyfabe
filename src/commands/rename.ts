import * as p from "@clack/prompts";
import { printFobNotFound } from "../lib/display.js";
import { selectFob } from "../lib/prompts.js";
import { loadFobs, renameFob } from "../lib/store.js";

function handleCancel(value: unknown): asserts value is string {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
    }
}

export async function rename(oldName?: string, newName?: string): Promise<boolean> {
    if (!oldName) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            p.log.warn("No saved fobs. Use `keyfabe read` or `keyfabe clone` first.");
            return false;
        }
        oldName = await selectFob(fobs, "Which fob to rename?");
    }

    if (!newName) {
        const value = await p.text({ message: "New name", placeholder: "e.g. front-door" });
        handleCancel(value);
        newName = value as string;
    }

    const result = await renameFob(oldName, newName as string);

    if (result === "not-found") {
        printFobNotFound(oldName);
        return false;
    }

    if (result === "name-taken") {
        p.log.error(`A fob named "${newName}" already exists. Delete it first or choose a different name.`);
        return false;
    }

    p.log.success(`Renamed "${oldName}" to "${newName}".`);
    return true;
}
