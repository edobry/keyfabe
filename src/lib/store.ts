import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const STORE_DIR = process.env.KEYFABE_STORE_PATH
    ? dirname(process.env.KEYFABE_STORE_PATH)
    : join(homedir(), ".keyfabe");
const STORE_PATH = process.env.KEYFABE_STORE_PATH
    ?? join(STORE_DIR, "fobs.json");

export interface Fob {
    name: string;
    type: string;
    id: string;
    encoding?: string;
    savedAt: string;
}

export async function loadFobs(): Promise<Fob[]> {
    try {
        const data = await readFile(STORE_PATH, "utf-8");
        return JSON.parse(data) as Fob[];
    } catch {
        return [];
    }
}

export async function saveFob(fob: Fob): Promise<void> {
    const fobs = await loadFobs();
    const existing = fobs.findIndex(f => f.name === fob.name);
    if (existing >= 0) {
        fobs[existing] = fob;
    } else {
        fobs.push(fob);
    }
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(fobs, null, 2) + "\n");
}

export async function getFob(name: string): Promise<Fob | undefined> {
    const fobs = await loadFobs();
    return fobs.find(f => f.name === name);
}
