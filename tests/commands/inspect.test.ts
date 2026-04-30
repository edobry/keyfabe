import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

vi.mock("../../src/lib/store.js", () => ({
    getTag: vi.fn(),
    loadTags: vi.fn(),
}));

vi.mock("../../src/lib/prompts.js", () => ({
    selectTag: vi.fn(),
}));

import * as p from "@clack/prompts";
import { inspect } from "../../src/commands/inspect.js";
import { MF_1K_SIZE } from "../../src/lib/mf-data.js";
import { selectTag } from "../../src/lib/prompts.js";
import { getTag, loadTags } from "../../src/lib/store.js";

const mockGetTag = vi.mocked(getTag);
const mockLoadTags = vi.mocked(loadTags);
const mockSelectTag = vi.mocked(selectTag);
const mockNote = vi.mocked(p.note);
const mockLogWarn = vi.mocked(p.log.warn);
const mockLogError = vi.mocked(p.log.error);
const mockLogInfo = vi.mocked(p.log.info);

beforeEach(() => {
    setupBeforeEach();
});

/** Build a 1K dump with sector 4 holding three value blocks: 1150, 0, 2000. */
function buildLaundryDump(): Buffer {
    const buf = Buffer.alloc(MF_1K_SIZE);
    const writeValueBlock = (idx: number, value: number) => {
        const off = idx * 16;
        buf.writeInt32LE(value, off);
        buf.writeInt32LE(~value | 0, off + 4);
        buf.writeInt32LE(value, off + 8);
        buf.writeUInt8(0, off + 12);
        buf.writeUInt8(0xff, off + 13);
        buf.writeUInt8(0, off + 14);
        buf.writeUInt8(0xff, off + 15);
    };
    // Block 1: "UINHOUSELAU"
    Buffer.from("UINHOUSELAU").copy(buf, 16);
    writeValueBlock(16, 1150);
    writeValueBlock(17, 0);
    writeValueBlock(18, 2000);
    return buf;
}

describe("inspect", () => {
    let dir: string;
    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "inspect-"));
    });
    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("no saved tags → false", async () => {
        mockLoadTags.mockResolvedValue([]);
        expect(await inspect()).toBe(false);
        expect(mockLogWarn).toHaveBeenCalled();
    });

    it("named tag not found → false", async () => {
        mockLoadTags.mockResolvedValue([
            { name: "other", type: "MIFARE Classic 1K", id: "AAAA", savedAt: "2024-01-01T00:00:00.000Z" },
        ]);
        mockGetTag.mockResolvedValue(undefined);
        expect(await inspect("missing")).toBe(false);
        expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining("missing"));
    });

    it("non-Classic tag → warns and returns false", async () => {
        const tag = { name: "fob", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-01-01T00:00:00.000Z" };
        mockLoadTags.mockResolvedValue([tag]);
        mockGetTag.mockResolvedValue(tag);
        expect(await inspect("fob")).toBe(false);
        expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining("only MIFARE Classic"));
    });

    it("no Classic tags in interactive picker → warns and returns false", async () => {
        mockLoadTags.mockResolvedValue([
            { name: "fob", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-01-01T00:00:00.000Z" },
        ]);
        expect(await inspect()).toBe(false);
        expect(mockSelectTag).not.toHaveBeenCalled();
        expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining("No saved MIFARE Classic"));
    });

    it("dump file missing → reports clear error", async () => {
        const tag = {
            name: "laundry",
            type: "MIFARE Classic 1K",
            id: "FFFFFFFF",
            savedAt: "2024-01-01T00:00:00.000Z",
        };
        mockLoadTags.mockResolvedValue([tag]);
        mockGetTag.mockResolvedValue(tag);
        expect(await inspect("laundry")).toBe(false);
        expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining("FFFFFFFF"));
        expect(mockLogInfo).toHaveBeenCalledWith(expect.stringContaining("keyfabe clone"));
    });

    it("decodes value blocks and ASCII strings from a real dump", async () => {
        const dumpPath = join(dir, "laundry.bin");
        await writeFile(dumpPath, buildLaundryDump());
        const tag = {
            name: "494 laundry",
            type: "MIFARE Classic 1K",
            id: "815498C5",
            dumpFile: dumpPath,
            savedAt: "2024-01-01T00:00:00.000Z",
        };
        mockLoadTags.mockResolvedValue([tag]);
        mockGetTag.mockResolvedValue(tag);

        expect(await inspect("494 laundry")).toBe(true);

        const noteCalls = mockNote.mock.calls.map(([content, title]) => ({ content: String(content), title }));
        const tagNote = noteCalls.find((n) => n.title === "Tag");
        const valueNote = noteCalls.find((n) => n.title?.toString().startsWith("Value"));
        const asciiNote = noteCalls.find((n) => n.title === "Printable strings");
        const blocksNote = noteCalls.find((n) => n.title === "Blocks");

        expect(tagNote?.content).toContain("815498C5");
        expect(tagNote?.content).toContain("MIFARE Classic 1K");

        expect(valueNote?.content).toContain("1150");
        expect(valueNote?.content).toContain("$11.50");
        expect(valueNote?.content).toContain("2000");
        expect(valueNote?.content).toContain("$20.00");

        expect(asciiNote?.content).toContain("UINHOUSELAU");

        expect(blocksNote?.content).toContain("sector 4");
        expect(blocksNote?.content).toContain("(all zero)");
    });

    it("interactive picker filters to MIFARE Classic tags only", async () => {
        const dumpPath = join(dir, "pick.bin");
        await writeFile(dumpPath, buildLaundryDump());
        const lf = { name: "fob", type: "EM410x", id: "1A2B3C4D5E", savedAt: "2024-01-01T00:00:00.000Z" };
        const hf = {
            name: "laundry",
            type: "MIFARE Classic 1K",
            id: "815498C5",
            dumpFile: dumpPath,
            savedAt: "2024-01-01T00:00:00.000Z",
        };
        mockLoadTags.mockResolvedValue([lf, hf]);
        mockSelectTag.mockResolvedValue("laundry");
        mockGetTag.mockResolvedValue(hf);

        expect(await inspect()).toBe(true);
        const offered = mockSelectTag.mock.calls[0][0];
        expect(offered).toEqual([hf]);
    });
});
