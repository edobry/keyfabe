import { loadTags } from "../lib/store.js";

export async function exportTags(): Promise<boolean> {
    const tags = await loadTags();

    if (tags.length === 0) {
        console.error("No saved tags to export.");
        return false;
    }

    // Output clean JSON to stdout for piping
    process.stdout.write(`${JSON.stringify(tags, null, 2)}\n`);
    console.error(`Exported ${tags.length} tag(s).`);
    return true;
}
