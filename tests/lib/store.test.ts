import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("renameFob", () => {
    it("renames existing fob", async () => {
        const { saveFob, renameFob, getFob } = await importStore();
        await saveFob({ name: "old-name", type: "EM410x", id: "AABBCCDDEE", savedAt: "2024-01-01" });

        const result = await renameFob("old-name", "new-name");
        expect(result).toBe("ok");

        const fob = await getFob("new-name");
        expect(fob).toBeDefined();
        expect(fob!.id).toBe("AABBCCDDEE");

        const oldFob = await getFob("old-name");
        expect(oldFob).toBeUndefined();
    });

    it("returns not-found for unknown name", async () => {
        const { renameFob } = await importStore();
        const result = await renameFob("nonexistent", "new-name");
        expect(result).toBe("not-found");
    });

    it("returns name-taken when new name exists", async () => {
        const { saveFob, renameFob } = await importStore();
        await saveFob({ name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" });
        await saveFob({ name: "b", type: "EM410x", id: "2222222222", savedAt: "2024-01-02" });

        const result = await renameFob("a", "b");
        expect(result).toBe("name-taken");
    });
});

describe("importFobs", () => {
    it("adds new fobs", async () => {
        const { importFobs, loadFobs } = await importStore();
        const result = await importFobs([
            { name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" },
            { name: "b", type: "HID Prox", id: "2222222222", savedAt: "2024-01-02" },
        ]);

        expect(result).toEqual({ added: 2, updated: 0 });
        const fobs = await loadFobs();
        expect(fobs).toHaveLength(2);
    });

    it("updates existing fobs by name", async () => {
        const { saveFob, importFobs, getFob } = await importStore();
        await saveFob({ name: "a", type: "EM410x", id: "OLD_ID", savedAt: "2024-01-01" });

        const result = await importFobs([{ name: "a", type: "EM410x", id: "NEW_ID", savedAt: "2024-01-02" }]);

        expect(result).toEqual({ added: 0, updated: 1 });
        const fob = await getFob("a");
        expect(fob!.id).toBe("NEW_ID");
    });

    it("mixes adds and updates", async () => {
        const { saveFob, importFobs, loadFobs } = await importStore();
        await saveFob({ name: "existing", type: "EM410x", id: "OLD", savedAt: "2024-01-01" });

        const result = await importFobs([
            { name: "existing", type: "EM410x", id: "UPDATED", savedAt: "2024-01-02" },
            { name: "new-one", type: "HID Prox", id: "FRESH", savedAt: "2024-01-03" },
        ]);

        expect(result).toEqual({ added: 1, updated: 1 });
        const fobs = await loadFobs();
        expect(fobs).toHaveLength(2);
    });
});

describe("removeFob", () => {
    it("removes existing fob and returns true", async () => {
        const { saveFob, removeFob, loadFobs } = await importStore();
        await saveFob({ name: "to-delete", type: "EM410x", id: "AABBCCDDEE", savedAt: "2024-01-01" });
        await saveFob({ name: "keep", type: "EM410x", id: "1122334455", savedAt: "2024-01-02" });

        const result = await removeFob("to-delete");
        expect(result).toBe(true);

        const fobs = await loadFobs();
        expect(fobs).toHaveLength(1);
        expect(fobs[0].name).toBe("keep");
    });

    it("returns false for unknown name", async () => {
        const { removeFob } = await importStore();
        const result = await removeFob("nonexistent");
        expect(result).toBe(false);
    });
});
