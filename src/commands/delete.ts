import * as p from "@clack/prompts";
import { printNoSavedTags, printTagNotFound } from "../lib/display.js";
import { confirm, selectTag } from "../lib/prompts.js";
import { loadTags, removeTag } from "../lib/store.js";

export async function deleteTag(name?: string): Promise<boolean> {
    if (!name) {
        const tags = await loadTags();
        if (tags.length === 0) {
            printNoSavedTags();
            return false;
        }
        name = await selectTag(tags, "Which tag to delete?");
    }

    const shouldDelete = await confirm(`Delete "${name}"?`);
    if (!shouldDelete) {
        p.cancel("Deletion cancelled.");
        return false;
    }

    const removed = await removeTag(name);
    if (!removed) {
        printTagNotFound(name);
        return false;
    }
    p.log.success(`Deleted "${name}".`);
    return true;
}
