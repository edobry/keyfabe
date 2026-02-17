import * as p from "@clack/prompts";
import { printNoSavedTags, printTagNotFound } from "../lib/display.js";
import { selectTag } from "../lib/prompts.js";
import { getTag, loadTags } from "../lib/store.js";

export async function show(name?: string): Promise<boolean> {
    if (!name) {
        const tags = await loadTags();
        if (tags.length === 0) {
            printNoSavedTags();
            return false;
        }
        name = await selectTag(tags, "Which tag to show?");
    }

    const tag = await getTag(name);
    if (!tag) {
        printTagNotFound(name);
        return false;
    }

    const lines = [
        `Name:     ${tag.name}`,
        `Type:     ${tag.type}`,
        `ID:       ${tag.id}`,
        ...(tag.encoding ? [`Encoding: ${tag.encoding}`] : []),
        `Saved:    ${tag.savedAt.slice(0, 10)}`,
    ];
    p.note(lines.join("\n"), "Tag Details");
    return true;
}
