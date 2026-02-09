import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOutput, setupBeforeEach } from "../helpers/mocks.js";

vi.mock("../../src/lib/store.js", () => ({
    importFobs: vi.fn(),
}));

import { importFile } from "../../src/commands/import.js";
import { importFobs } from "../../src/lib/store.js";

const mockImportFobs = vi.mocked(importFobs);

let tmpDir: string;

beforeEach(async () => {
    setupBeforeEach();
    tmpDir = await mkdtemp(join(tmpdir(), "keyfabe-import-test-"));
});

afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe("importFile", () => {
    it("imports valid JSON file", async () => {
        const filePath = join(tmpDir, "fobs.json");
        const fobs = [{ name: "test", type: "EM410x", id: "1234567890", savedAt: "2024-01-01" }];
        await writeFile(filePath, JSON.stringify(fobs));
        mockImportFobs.mockResolvedValue({ added: 1, updated: 0 });

        const result = await importFile(filePath);

        expect(result).toBe(true);
        expect(mockImportFobs).toHaveBeenCalledWith(fobs);
        const output = getOutput();
        expect(output).toContain("Imported 1 new");
    });

    it("reports updated count", async () => {
        const filePath = join(tmpDir, "fobs.json");
        const fobs = [
            { name: "a", type: "EM410x", id: "1111111111", savedAt: "2024-01-01" },
            { name: "b", type: "HID Prox", id: "2222222222", savedAt: "2024-01-02" },
        ];
        await writeFile(filePath, JSON.stringify(fobs));
        mockImportFobs.mockResolvedValue({ added: 1, updated: 1 });

        const result = await importFile(filePath);

        expect(result).toBe(true);
        const output = getOutput();
        expect(output).toContain("1 new");
        expect(output).toContain("1 existing");
    });

    it("returns false for missing file", async () => {
        const result = await importFile("/nonexistent/file.json");

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("Cannot read file");
    });

    it("returns false for invalid JSON", async () => {
        const filePath = join(tmpDir, "bad.json");
        await writeFile(filePath, "not json{{{");

        const result = await importFile(filePath);

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("Invalid JSON");
    });

    it("returns false for invalid fob format", async () => {
        const filePath = join(tmpDir, "bad-format.json");
        await writeFile(filePath, JSON.stringify([{ foo: "bar" }]));

        const result = await importFile(filePath);

        expect(result).toBe(false);
        const output = getOutput();
        expect(output).toContain("Invalid format");
    });
});
