import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    importTags: vi.fn(),
}));

import { importFile } from "../../src/commands/import.js";
import { importTags } from "../../src/lib/store.js";

const mockImportTags = vi.mocked(importTags);

let tmpDir: string;

beforeEach(async () => {
    setupBeforeEach();
    tmpDir = await mkdtemp(join(tmpdir(), "keyfabe-import-test-"));
});

afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe("importFile", () => {
    it("imports valid JSON file → true", async () => {
        const filePath = join(tmpDir, "tags.json");
        const tags = [{ name: "test", type: "EM410x", id: "1234567890", savedAt: "2024-01-01" }];
        await writeFile(filePath, JSON.stringify(tags));
        mockImportTags.mockResolvedValue({ added: 1, updated: 0 });

        expect(await importFile(filePath)).toBe(true);
        expect(mockImportTags).toHaveBeenCalledWith(tags);
    });

    it("reports added and updated counts", async () => {
        const filePath = join(tmpDir, "tags.json");
        const tags = [
            { name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" },
            { name: "b", type: "HID Prox", id: "2222222222", savedAt: "2024-01-02" },
        ];
        await writeFile(filePath, JSON.stringify(tags));
        mockImportTags.mockResolvedValue({ added: 1, updated: 1 });

        expect(await importFile(filePath)).toBe(true);
    });

    it("missing file → false", async () => {
        expect(await importFile("/nonexistent/file.json")).toBe(false);
    });

    it("invalid JSON → false", async () => {
        const filePath = join(tmpDir, "bad.json");
        await writeFile(filePath, "not json{{{");

        expect(await importFile(filePath)).toBe(false);
    });

    it("invalid tag format → false", async () => {
        const filePath = join(tmpDir, "bad-format.json");
        await writeFile(filePath, JSON.stringify([{ foo: "bar" }]));

        expect(await importFile(filePath)).toBe(false);
    });
});
