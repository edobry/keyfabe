import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tag } from "../../src/lib/store.js";

let tmpDir: string;
let storePath: string;

async function importStore() {
    vi.resetModules();
    const mod = await import("../../src/lib/store.js");
    return mod;
}

beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "keyfabe-test-"));
    storePath = join(tmpDir, "tags.json");
    process.env.KEYFABE_STORE_PATH = storePath;
});

afterEach(async () => {
    delete process.env.KEYFABE_STORE_PATH;
    await rm(tmpDir, { recursive: true, force: true });
});

describe("loadTags", () => {
    it("returns [] for missing file", async () => {
        const { loadTags } = await importStore();
        const tags = await loadTags();
        expect(tags).toEqual([]);
    });

    it("returns parsed array from valid JSON", async () => {
        const data: Tag[] = [{ name: "test", type: "EM410x", id: "1234567890", savedAt: "2024-01-01" }];
        await writeFile(storePath, JSON.stringify(data));

        const { loadTags } = await importStore();
        const tags = await loadTags();
        expect(tags).toEqual(data);
    });
});

describe("saveTag", () => {
    it("creates dir and file on first save", async () => {
        await rm(tmpDir, { recursive: true, force: true });
        const subDir = join(tmpDir, "sub");
        const subPath = join(subDir, "tags.json");
        process.env.KEYFABE_STORE_PATH = subPath;

        const { saveTag } = await importStore();
        await saveTag({
            name: "first",
            type: "EM410x",
            id: "AABBCCDDEE",
            savedAt: "2024-01-01T00:00:00.000Z",
        });

        const content = JSON.parse(await readFile(subPath, "utf-8"));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe("first");
    });

    it("appends to existing tags", async () => {
        const { saveTag } = await importStore();
        await saveTag({ name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" });
        await saveTag({ name: "b", type: "HID Prox", id: "2222222222", savedAt: "2024-01-02" });

        const { loadTags } = await importStore();
        const tags = await loadTags();
        expect(tags).toHaveLength(2);
        expect(tags[0].name).toBe("a");
        expect(tags[1].name).toBe("b");
    });

    it("overwrites tag with same name", async () => {
        const { saveTag } = await importStore();
        await saveTag({ name: "dup", type: "EM410x", id: "AAAAAAAAAA", savedAt: "2024-01-01" });
        await saveTag({ name: "dup", type: "EM410x", id: "BBBBBBBBBB", savedAt: "2024-01-02" });

        const { loadTags } = await importStore();
        const tags = await loadTags();
        expect(tags).toHaveLength(1);
        expect(tags[0].id).toBe("BBBBBBBBBB");
    });
});

describe("getTag", () => {
    it("returns matching tag", async () => {
        const { saveTag, getTag } = await importStore();
        await saveTag({ name: "target", type: "EM410x", id: "1234567890", savedAt: "2024-01-01" });

        const tag = await getTag("target");
        expect(tag).toBeDefined();
        expect(tag!.id).toBe("1234567890");
    });

    it("returns undefined for unknown name", async () => {
        const { getTag } = await importStore();
        const tag = await getTag("nonexistent");
        expect(tag).toBeUndefined();
    });
});

describe("renameTag", () => {
    it("renames existing tag", async () => {
        const { saveTag, renameTag, getTag } = await importStore();
        await saveTag({ name: "old-name", type: "EM410x", id: "AABBCCDDEE", savedAt: "2024-01-01" });

        const result = await renameTag("old-name", "new-name");
        expect(result).toBe("ok");

        const tag = await getTag("new-name");
        expect(tag).toBeDefined();
        expect(tag!.id).toBe("AABBCCDDEE");

        const oldTag = await getTag("old-name");
        expect(oldTag).toBeUndefined();
    });

    it("returns not-found for unknown name", async () => {
        const { renameTag } = await importStore();
        const result = await renameTag("nonexistent", "new-name");
        expect(result).toBe("not-found");
    });

    it("returns name-taken when new name exists", async () => {
        const { saveTag, renameTag } = await importStore();
        await saveTag({ name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" });
        await saveTag({ name: "b", type: "EM410x", id: "2222222222", savedAt: "2024-01-02" });

        const result = await renameTag("a", "b");
        expect(result).toBe("name-taken");
    });
});

describe("importTags", () => {
    it("adds new tags", async () => {
        const { importTags, loadTags } = await importStore();
        const result = await importTags([
            { name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" },
            { name: "b", type: "HID Prox", id: "2222222222", savedAt: "2024-01-02" },
        ]);

        expect(result).toEqual({ added: 2, updated: 0 });
        const tags = await loadTags();
        expect(tags).toHaveLength(2);
    });

    it("updates existing tags by name", async () => {
        const { saveTag, importTags, getTag } = await importStore();
        await saveTag({ name: "a", type: "EM410x", id: "OLD_ID", savedAt: "2024-01-01" });

        const result = await importTags([{ name: "a", type: "EM410x", id: "NEW_ID", savedAt: "2024-01-02" }]);

        expect(result).toEqual({ added: 0, updated: 1 });
        const tag = await getTag("a");
        expect(tag!.id).toBe("NEW_ID");
    });

    it("mixes adds and updates", async () => {
        const { saveTag, importTags, loadTags } = await importStore();
        await saveTag({ name: "existing", type: "EM410x", id: "OLD", savedAt: "2024-01-01" });

        const result = await importTags([
            { name: "existing", type: "EM410x", id: "UPDATED", savedAt: "2024-01-02" },
            { name: "new-one", type: "HID Prox", id: "FRESH", savedAt: "2024-01-03" },
        ]);

        expect(result).toEqual({ added: 1, updated: 1 });
        const tags = await loadTags();
        expect(tags).toHaveLength(2);
    });
});

describe("removeTag", () => {
    it("removes existing tag and returns true", async () => {
        const { saveTag, removeTag, loadTags } = await importStore();
        await saveTag({ name: "to-delete", type: "EM410x", id: "AABBCCDDEE", savedAt: "2024-01-01" });
        await saveTag({ name: "keep", type: "EM410x", id: "1122334455", savedAt: "2024-01-02" });

        const result = await removeTag("to-delete");
        expect(result).toBe(true);

        const tags = await loadTags();
        expect(tags).toHaveLength(1);
        expect(tags[0].name).toBe("keep");
    });

    it("returns false for unknown name", async () => {
        const { removeTag } = await importStore();
        const result = await removeTag("nonexistent");
        expect(result).toBe(false);
    });
});

describe("tagFidelity", () => {
    it("MIFARE Classic with a saved dump → full", async () => {
        const { tagFidelity } = await importStore();
        expect(tagFidelity({ name: "x", type: "MIFARE Classic 1K", id: "AA", dumpFile: "/d.bin", savedAt: "x" })).toBe(
            "full",
        );
    });

    it("MIFARE Classic without a dump → uid-only", async () => {
        const { tagFidelity } = await importStore();
        expect(tagFidelity({ name: "x", type: "MIFARE Classic 4K", id: "AA", savedAt: "x" })).toBe("uid-only");
    });

    it("LF/simple card → n/a (UID is the whole identity)", async () => {
        const { tagFidelity } = await importStore();
        expect(tagFidelity({ name: "x", type: "EM410x", id: "AA", savedAt: "x" })).toBe("n/a");
    });
});
