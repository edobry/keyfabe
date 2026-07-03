import * as p from "@clack/prompts";
import { CardType } from "../lib/constants.js";
import { printNoSavedTags, printTagNotFound } from "../lib/display.js";
import {
    type AsciiRun,
    findAsciiStrings,
    findValueBlocks,
    loadDumpFile,
    locateDumpFile,
    type MfBlock,
    type MfDump,
    type ValueBlock,
} from "../lib/mf-data.js";
import { selectTag } from "../lib/prompts.js";
import { getTag, loadTags, type Tag } from "../lib/store.js";

const MIFARE_CLASSIC_TYPES: ReadonlySet<string> = new Set([CardType.MIFARE_CLASSIC_1K, CardType.MIFARE_CLASSIC_4K]);

function formatValue(value: number): string {
    const dollars = (value / 100).toFixed(2);
    return `${value} (= $${dollars} if cents)`;
}

function formatHex(bytes: Buffer): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
}

function isZeroBlock(block: MfBlock): boolean {
    return block.bytes.every((b) => b === 0);
}

/** Render a compact block dump: collapse consecutive zero data blocks. */
function renderBlocks(dump: MfDump): string {
    const lines: string[] = [];
    let lastSector = -1;
    let zeroRunStart = -1;
    const flushZeros = (endBlock: number) => {
        if (zeroRunStart < 0) return;
        if (zeroRunStart === endBlock) {
            lines.push(`${String(zeroRunStart).padStart(3)}: ${"00 ".repeat(16).trim()}`);
        } else {
            lines.push(`${String(zeroRunStart).padStart(3)}-${String(endBlock).padStart(3)}: (all zero)`);
        }
        zeroRunStart = -1;
    };
    for (const block of dump.blocks) {
        if (block.sector !== lastSector) {
            flushZeros(block.index - 1);
            lines.push(`-- sector ${block.sector} --`);
            lastSector = block.sector;
        }
        if (!block.isTrailer && isZeroBlock(block)) {
            if (zeroRunStart < 0) zeroRunStart = block.index;
            continue;
        }
        flushZeros(block.index - 1);
        const suffix = block.isTrailer ? "  (trailer)" : "";
        lines.push(`${String(block.index).padStart(3)}: ${formatHex(block.bytes)}${suffix}`);
    }
    flushZeros(dump.blocks[dump.blocks.length - 1].index);
    return lines.join("\n");
}

function renderValueBlocks(values: ValueBlock[]): string {
    const header = "block  sector  value";
    const rows = values.map(
        (v) => `${String(v.blockIndex).padStart(5)}  ${String(v.sector).padStart(6)}  ${formatValue(v.value)}`,
    );
    return [header, ...rows].join("\n");
}

function renderAsciiRuns(runs: AsciiRun[]): string {
    return runs
        .map((r) => `block ${String(r.blockIndex).padStart(3)} @${String(r.offset).padStart(2)}:  ${r.text}`)
        .join("\n");
}

export async function inspect(name?: string): Promise<boolean> {
    const tags = await loadTags();
    if (tags.length === 0) {
        printNoSavedTags();
        return false;
    }

    let target: Tag | undefined;
    if (name) {
        target = await getTag(name);
        if (!target) {
            printTagNotFound(name);
            return false;
        }
    } else {
        const candidates = tags.filter((t) => MIFARE_CLASSIC_TYPES.has(t.type));
        if (candidates.length === 0) {
            p.log.warn("No saved MIFARE Classic tags. Inspection requires a Classic dump.");
            return false;
        }
        const picked = await selectTag(candidates, "Which tag to inspect?");
        target = await getTag(picked);
        if (!target) {
            printTagNotFound(picked);
            return false;
        }
    }

    if (!MIFARE_CLASSIC_TYPES.has(target.type)) {
        p.log.warn(`"${target.name}" is ${target.type} — only MIFARE Classic dumps can be inspected.`);
        return false;
    }

    const dumpPath = await locateDumpFile(target.id, target.dumpFile);
    if (!dumpPath) {
        p.log.error(`No dump file found for ${target.id}.`);
        p.log.info(`Looked for hf-mf-${target.id}-dump.bin in ~ and the current directory.`);
        p.log.info("Run `keyfabe clone` to create one (it will crack keys and dump all blocks).");
        return false;
    }

    let dump: MfDump;
    try {
        dump = await loadDumpFile(dumpPath);
    } catch (err) {
        p.log.error(`Failed to read dump: ${(err as Error).message}`);
        return false;
    }

    const valueBlocks = findValueBlocks(dump);
    const asciiRuns = findAsciiStrings(dump, 4);

    p.note(
        [
            `Name:  ${target.name}`,
            `Type:  ${target.type}`,
            `UID:   ${target.id}`,
            `Dump:  ${dumpPath}`,
            `Size:  ${dump.sizeBytes} bytes (${dump.blocks.length} blocks)`,
        ].join("\n"),
        "Tag",
    );

    if (valueBlocks.length > 0) {
        p.note(renderValueBlocks(valueBlocks), "Value Blocks (likely balances/counters)");
    } else {
        p.log.info("No MIFARE value blocks detected.");
    }

    if (asciiRuns.length > 0) {
        p.note(renderAsciiRuns(asciiRuns), "Printable strings");
    }

    p.note(renderBlocks(dump), "Blocks");

    return true;
}
