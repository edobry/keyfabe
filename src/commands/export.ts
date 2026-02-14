import { loadFobs } from "../lib/store.js";

export async function exportFobs(): Promise<boolean> {
    const fobs = await loadFobs();

    if (fobs.length === 0) {
        console.error("No saved tags to export.");
        return false;
    }

    // Output clean JSON to stdout for piping
    process.stdout.write(`${JSON.stringify(fobs, null, 2)}\n`);
    console.error(`Exported ${fobs.length} tag(s).`);
    return true;
}
