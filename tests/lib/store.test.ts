import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Fob } from "../../src/lib/store.js";

let tmpDir: string;
let storePath: string;

async function importStore() {
    vi.resetModules();
    const mod = await import("../../src/lib/store.js");
    return mod;
}

beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "keyfabe-test-"));
    storePath = join(tmpDir, "fobs.json");
    process.env.KEYFABE_STORE_PATH = storePath;
});

afterEach(async () => {
    delete process.env.KEYFABE_STORE_PATH;
    await rm(tmpDir, { recursive: true, force: true });
});

describe("loadFobs", () => {
    it("returns [] for missing file", async () => {
        const { loadFobs } = await importStore();
        const fobs = await loadFobs();
        expect(fobs).toEqual([]);
    });

    it("returns parsed array from valid JSON", async () => {
        const data: Fob[] = [{ name: "test", type: "EM410x", id: "1234567890", savedAt: "2024-01-01" }];
        await writeFile(storePath, JSON.stringify(data));

        const { loadFobs } = await importStore();
        const fobs = await loadFobs();
        expect(fobs).toEqual(data);
    });
});

describe("saveFob", () => {
    it("creates dir and file on first save", async () => {
        await rm(tmpDir, { recursive: true, force: true });
        const subDir = join(tmpDir, "sub");
        const subPath = join(subDir, "fobs.json");
        process.env.KEYFABE_STORE_PATH = subPath;

        const { saveFob } = await importStore();
        await saveFob({
            name: "first",
            type: "EM410x",
            id: "AABBCCDDEE",
            savedAt: "2024-01-01T00:00:00.000Z",
        });

        const content = JSON.parse(await readFile(subPath, "utf-8"));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe("first");
    });

    it("appends to existing fobs", async () => {
        const { saveFob } = await importStore();
        await saveFob({ name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" });
        await saveFob({ name: "b", type: "HID Prox", id: "2222222222", savedAt: "2024-01-02" });

        const { loadFobs } = await importStore();
        const fobs = await loadFobs();
        expect(fobs).toHaveLength(2);
        expect(fobs[0].name).toBe("a");
        expect(fobs[1].name).toBe("b");
    });

    it("overwrites fob with same name", async () => {
        const { saveFob } = await importStore();
        await saveFob({ name: "dup", type: "EM410x", id: "AAAAAAAAAA", savedAt: "2024-01-01" });
        await saveFob({ name: "dup", type: "EM410x", id: "BBBBBBBBBB", savedAt: "2024-01-02" });

        const { loadFobs } = await importStore();
        const fobs = await loadFobs();
        expect(fobs).toHaveLength(1);
        expect(fobs[0].id).toBe("BBBBBBBBBB");
    });
});

describe("getFob", () => {
    it("returns matching fob", async () => {
        const { saveFob, getFob } = await importStore();
        await saveFob({ name: "target", type: "EM410x", id: "1234567890", savedAt: "2024-01-01" });

        const fob = await getFob("target");
        expect(fob).toBeDefined();
        expect(fob!.id).toBe("1234567890");
    });

    it("returns undefined for unknown name", async () => {
        const { getFob } = await importStore();
        const fob = await getFob("nonexistent");
        expect(fob).toBeUndefined();
    });
});
