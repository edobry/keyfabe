import * as p from "@clack/prompts";
import { printFobNotFound } from "../lib/display.js";
import { selectFob } from "../lib/prompts.js";
import { getFob, loadFobs } from "../lib/store.js";

export async function show(name?: string): Promise<boolean> {
    if (!name) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            p.log.warn("No saved fobs. Use `keyfabe read` or `keyfabe clone` first.");
            return false;
        }
        name = await selectFob(fobs, "Which fob to show?");
    }

    const fob = await getFob(name);
    if (!fob) {
        printFobNotFound(name);
        return false;
    }

    const lines = [
        `Name:     ${fob.name}`,
        `Type:     ${fob.type}`,
        `ID:       ${fob.id}`,
        ...(fob.encoding ? [`Encoding: ${fob.encoding}`] : []),
        `Saved:    ${fob.savedAt.slice(0, 10)}`,
    ];
    p.note(lines.join("\n"), "Fob Details");
    return true;
}
