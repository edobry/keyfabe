import * as p from "@clack/prompts";
import { printFobNotFound } from "../lib/display.js";
import { confirm, selectFob } from "../lib/prompts.js";
import { loadFobs, removeFob } from "../lib/store.js";

export async function deleteFob(name?: string): Promise<boolean> {
    if (!name) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            p.log.warn("No saved fobs. Use `keyfabe read` or `keyfabe clone` first.");
            return false;
        }
        name = await selectFob(fobs, "Which fob to delete?");
    }

    const shouldDelete = await confirm(`Delete "${name}"?`);
    if (!shouldDelete) {
        p.cancel("Deletion cancelled.");
        return false;
    }

    const removed = await removeFob(name);
    if (!removed) {
        printFobNotFound(name);
        return false;
    }
    p.log.success(`Deleted "${name}".`);
    return true;
}
