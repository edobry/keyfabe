import * as p from "@clack/prompts";
import { printNoSavedTags, printTagNotFound } from "../lib/display.js";
import { promptText, selectTag } from "../lib/prompts.js";
import { loadTags, renameTag } from "../lib/store.js";

export async function rename(oldName?: string, newName?: string): Promise<boolean> {
    if (!oldName) {
        const tags = await loadTags();
        if (tags.length === 0) {
            printNoSavedTags();
            return false;
        }
        oldName = await selectTag(tags, "Which tag to rename?");
    }

    if (!newName) {
        newName = await promptText("New name", "e.g. front-door");
    }

    const result = await renameTag(oldName, newName as string);

    if (result === "not-found") {
        printTagNotFound(oldName);
        return false;
    }

    if (result === "name-taken") {
        p.log.error(`A tag named "${newName}" already exists. Delete it first or choose a different name.`);
        return false;
    }

    p.log.success(`Renamed "${oldName}" to "${newName}".`);
    return true;
}
