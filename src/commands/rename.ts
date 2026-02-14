import * as p from "@clack/prompts";
import { printFobNotFound, printNoSavedTags } from "../lib/display.js";
import { promptText, selectFob } from "../lib/prompts.js";
import { loadFobs, renameFob } from "../lib/store.js";

export async function rename(oldName?: string, newName?: string): Promise<boolean> {
    if (!oldName) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            printNoSavedTags();
            return false;
        }
        oldName = await selectFob(fobs, "Which tag to rename?");
    }

    if (!newName) {
        newName = await promptText("New name", "e.g. front-door");
    }

    const result = await renameFob(oldName, newName as string);

    if (result === "not-found") {
        printFobNotFound(oldName);
        return false;
    }

    if (result === "name-taken") {
        p.log.error(`A tag named "${newName}" already exists. Delete it first or choose a different name.`);
        return false;
    }

    p.log.success(`Renamed "${oldName}" to "${newName}".`);
    return true;
}
