import { access, rename as fsRename, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CardType } from "./constants.js";

const STORE_DIR = process.env.KEYFABE_STORE_PATH
    ? dirname(process.env.KEYFABE_STORE_PATH)
    : join(homedir(), ".keyfabe");
const STORE_PATH = process.env.KEYFABE_STORE_PATH ?? join(STORE_DIR, "tags.json");
const OLD_STORE_PATH = join(STORE_DIR, "fobs.json");

export interface Tag {
    name: string;
    type: string;
    id: string;
    encoding?: string;
    dumpFile?: string;
    savedAt: string;
}

export type TagFidelity = "full" | "uid-only" | "n/a";

/**
 * How completely a saved identity can be reproduced.
 *   - "full"     : MIFARE Classic with a saved dump — write restores all data.
 *   - "uid-only" : MIFARE Classic without a dump — write copies only the UID.
 *   - "n/a"      : LF/simple cards where the UID *is* the whole identity.
 */
export function tagFidelity(tag: Tag): TagFidelity {
    if (tag.type !== CardType.MIFARE_CLASSIC_1K && tag.type !== CardType.MIFARE_CLASSIC_4K) return "n/a";
    return tag.dumpFile ? "full" : "uid-only";
}

async function migrateStore(): Promise<void> {
    try {
        await access(OLD_STORE_PATH);
        // Old file exists — check if new file already exists
        try {
            await access(STORE_PATH);
            // Both exist — don't overwrite, user can resolve manually
        } catch {
            // Only old exists — rename it
            await fsRename(OLD_STORE_PATH, STORE_PATH);
        }
    } catch {
        // Old file doesn't exist — nothing to migrate
    }
}

export async function loadTags(): Promise<Tag[]> {
    await migrateStore();
    try {
        const data = await readFile(STORE_PATH, "utf-8");
        return JSON.parse(data) as Tag[];
    } catch {
        return [];
    }
}

export async function saveTag(tag: Tag): Promise<void> {
    const tags = await loadTags();
    const existing = tags.findIndex((f) => f.name === tag.name);
    if (existing >= 0) {
        tags[existing] = tag;
    } else {
        tags.push(tag);
    }
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_PATH, `${JSON.stringify(tags, null, 2)}\n`);
}

export async function getTag(name: string): Promise<Tag | undefined> {
    const tags = await loadTags();
    return tags.find((f) => f.name === name);
}

export async function renameTag(oldName: string, newName: string): Promise<"ok" | "not-found" | "name-taken"> {
    const tags = await loadTags();
    const index = tags.findIndex((f) => f.name === oldName);
    if (index < 0) return "not-found";
    if (tags.some((f) => f.name === newName)) return "name-taken";
    tags[index].name = newName;
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_PATH, `${JSON.stringify(tags, null, 2)}\n`);
    return "ok";
}

export async function importTags(incoming: Tag[]): Promise<{ added: number; updated: number }> {
    const tags = await loadTags();
    let added = 0;
    let updated = 0;
    for (const tag of incoming) {
        const existing = tags.findIndex((f) => f.name === tag.name);
        if (existing >= 0) {
            tags[existing] = tag;
            updated++;
        } else {
            tags.push(tag);
            added++;
        }
    }
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_PATH, `${JSON.stringify(tags, null, 2)}\n`);
    return { added, updated };
}

export async function removeTag(name: string): Promise<boolean> {
    const tags = await loadTags();
    const index = tags.findIndex((f) => f.name === name);
    if (index < 0) return false;
    tags.splice(index, 1);
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_PATH, `${JSON.stringify(tags, null, 2)}\n`);
    return true;
}
