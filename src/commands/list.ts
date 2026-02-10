import * as p from "@clack/prompts";
import { loadFobs } from "../lib/store.js";

export async function list(options: { json?: boolean } = {}): Promise<boolean> {
    const fobs = await loadFobs();

    if (options.json) {
        console.log(JSON.stringify(fobs, null, 2));
        return true;
    }

    if (fobs.length === 0) {
        p.log.info("No saved fobs. Use `keyfabe read` or `keyfabe clone` to save one.");
        return true;
    }

    const hasEncoding = fobs.some((f) => f.encoding);

    const cols = {
        name: Math.max(12, ...fobs.map((f) => f.name.length + 2)),
        type: Math.max(10, ...fobs.map((f) => f.type.length + 2)),
        id: Math.max(16, ...fobs.map((f) => f.id.length + 2)),
        encoding: hasEncoding ? Math.max(12, ...fobs.map((f) => (f.encoding ?? "").length + 2)) : 0,
    };

    let header = "Name".padEnd(cols.name) + "Type".padEnd(cols.type) + "ID".padEnd(cols.id);
    if (hasEncoding) {
        header += "Encoding".padEnd(cols.encoding);
    }
    header += "Saved";

    const rows: string[] = [];
    for (const fob of fobs) {
        const date = fob.savedAt.slice(0, 10);
        let row = fob.name.padEnd(cols.name) + fob.type.padEnd(cols.type) + fob.id.padEnd(cols.id);
        if (hasEncoding) {
            row += (fob.encoding ?? "").padEnd(cols.encoding);
        }
        row += date;
        rows.push(row);
    }

    p.note(`${header}\n${rows.join("\n")}`, `Saved Fobs (${fobs.length})`);
    return true;
}
