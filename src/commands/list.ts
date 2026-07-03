import * as p from "@clack/prompts";
import { loadTags, tagFidelity } from "../lib/store.js";

function fidelityLabel(fidelity: ReturnType<typeof tagFidelity>): string {
    if (fidelity === "full") return "full";
    if (fidelity === "uid-only") return "uid-only";
    return "";
}

export async function list(options: { json?: boolean } = {}): Promise<boolean> {
    const tags = await loadTags();

    if (options.json) {
        console.log(JSON.stringify(tags, null, 2));
        return true;
    }

    if (tags.length === 0) {
        p.log.info("No saved tags. Use `keyfabe read` or `keyfabe clone` to save one.");
        return true;
    }

    const hasEncoding = tags.some((f) => f.encoding);
    const hasFidelity = tags.some((f) => tagFidelity(f) !== "n/a");

    const cols = {
        name: Math.max(12, ...tags.map((f) => f.name.length + 2)),
        type: Math.max(10, ...tags.map((f) => f.type.length + 2)),
        id: Math.max(16, ...tags.map((f) => f.id.length + 2)),
        encoding: hasEncoding ? Math.max(12, ...tags.map((f) => (f.encoding ?? "").length + 2)) : 0,
        data: hasFidelity ? Math.max(10, ...tags.map((f) => fidelityLabel(tagFidelity(f)).length + 2)) : 0,
    };

    let header = "Name".padEnd(cols.name) + "Type".padEnd(cols.type) + "ID".padEnd(cols.id);
    if (hasEncoding) {
        header += "Encoding".padEnd(cols.encoding);
    }
    if (hasFidelity) {
        header += "Data".padEnd(cols.data);
    }
    header += "Saved";

    const rows: string[] = [];
    for (const tag of tags) {
        const date = tag.savedAt.slice(0, 10);
        let row = tag.name.padEnd(cols.name) + tag.type.padEnd(cols.type) + tag.id.padEnd(cols.id);
        if (hasEncoding) {
            row += (tag.encoding ?? "").padEnd(cols.encoding);
        }
        if (hasFidelity) {
            row += fidelityLabel(tagFidelity(tag)).padEnd(cols.data);
        }
        row += date;
        rows.push(row);
    }

    p.note(`${header}\n${rows.join("\n")}`, `Saved Tags (${tags.length})`);
    return true;
}
