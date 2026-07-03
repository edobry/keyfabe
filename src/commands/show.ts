import * as p from "@clack/prompts";
import { printNoSavedTags, printTagNotFound } from "../lib/display.js";
import { selectTag } from "../lib/prompts.js";
import { getTag, loadTags, tagFidelity } from "../lib/store.js";

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

    const fidelity = tagFidelity(tag);
    const lines = [
        `Name:     ${tag.name}`,
        `Type:     ${tag.type}`,
        `ID:       ${tag.id}`,
        ...(tag.encoding ? [`Encoding: ${tag.encoding}`] : []),
        ...(fidelity !== "n/a"
            ? [`Data:     ${fidelity === "full" ? "full dump on file" : "UID only (no dump)"}`]
            : []),
        `Saved:    ${tag.savedAt.slice(0, 10)}`,
    ];
    p.note(lines.join("\n"), "Tag Details");

    if (fidelity === "uid-only") {
        p.log.warn("UID-only identity — writing it copies just the UID, not the card's data or balance.");
        p.log.warn(
            "Re-clone the original with `keyfabe clone` to capture a full dump for a working stored-value card.",
        );
    }
    return true;
}
