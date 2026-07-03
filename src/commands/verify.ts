import * as p from "@clack/prompts";
import { searchCardWithDiagnosis } from "../lib/card-ops.js";
import { CardType, DetectionSummary } from "../lib/constants.js";
import { printDetectionHint, printDoctorHint, printNoSavedTags, printTagNotFound } from "../lib/display.js";
import { loadDumpFile, locateDumpFile } from "../lib/mf-data.js";
import { readLiveValueBlocks } from "../lib/mf-ops.js";
import type { CardInfo } from "../lib/parsers.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { selectTag, waitForEnter } from "../lib/prompts.js";
import { getTag, loadTags, type Tag } from "../lib/store.js";

const MIFARE_CLASSIC_TYPES: ReadonlySet<string> = new Set([CardType.MIFARE_CLASSIC_1K, CardType.MIFARE_CLASSIC_4K]);

function formatCents(value: number): string {
    return `$${(value / 100).toFixed(2)}`;
}

/**
 * Beyond a UID match, read the live card's value blocks with the saved dump's
 * keys and compare on-card data. Returns "no-data" when the card is a UID-only
 * clone (nothing readable under the saved keys), "ok" when real data is present,
 * or "skip" when a deep comparison isn't possible.
 */
async function deepVerify(tag: Tag): Promise<"ok" | "no-data" | "skip"> {
    if (!MIFARE_CLASSIC_TYPES.has(tag.type)) return "skip";
    if (!tag.dumpFile) {
        p.log.info("No saved dump for this identity — deep verify needs a full-card dump. Checked UID only.");
        return "skip";
    }

    const dumpPath = await locateDumpFile(tag.id, tag.dumpFile);
    if (!dumpPath) {
        p.log.warn("Saved dump file not found — deep verify skipped.");
        return "skip";
    }

    let dump: Awaited<ReturnType<typeof loadDumpFile>>;
    try {
        dump = await loadDumpFile(dumpPath);
    } catch {
        p.log.warn("Could not read the saved dump — deep verify skipped.");
        return "skip";
    }

    const reads = await readLiveValueBlocks(dump);
    if (reads.length === 0) {
        p.log.info("Saved dump has no value blocks to compare.");
        return "skip";
    }

    const anyData = reads.some((r) => !r.authError && r.liveValue !== null);
    if (!anyData) {
        p.log.error("UID matches, but the card carries no data under the saved keys.");
        p.log.error("This is a UID-only clone — a stored-value reader will reject it as unformatted.");
        return "no-data";
    }

    const lines = reads.map((r) => {
        if (r.authError || r.liveValue === null)
            return `block ${r.blockIndex}: (unreadable)  saved ${formatCents(r.savedValue)}`;
        const drift = r.liveValue === r.savedValue ? "" : `  (dump had ${formatCents(r.savedValue)})`;
        return `block ${r.blockIndex}: ${formatCents(r.liveValue)}${drift}`;
    });
    p.note(lines.join("\n"), "On-card value blocks (live)");
    return "ok";
}

export async function verify(name?: string, options?: { deep?: boolean }): Promise<boolean> {
    p.intro("Verify Tag");

    if (!name) {
        const tags = await loadTags();
        if (tags.length === 0) {
            printNoSavedTags();
            return false;
        }
        name = await selectTag(tags, "Which saved tag to verify against?");
    }

    const tag = await getTag(name);
    if (!tag) {
        printTagNotFound(name);
        return false;
    }

    if (!(await requireDevice())) return false;

    p.log.info(`Verifying against "${tag.name}" (${tag.type} ${tag.id})`);
    await waitForEnter("Place the tag to check on the antenna.");

    const spinner = p.spinner();
    spinner.start("Reading tag...");
    try {
        const { card, diagnosis } = await searchCardWithDiagnosis();
        if (!card) {
            spinner.stop(DetectionSummary[diagnosis]);
            p.log.error(DetectionSummary[diagnosis]);
            printDetectionHint(diagnosis);
            return false;
        }

        spinner.stop(`Read: ${card.type} ${card.id}`);

        const idMatch = card.id === tag.id;
        const typeMatch = card.type === tag.type;

        if (!idMatch) {
            p.log.error(`Mismatch: read ${card.id}, expected ${tag.id}.`);
            return false;
        }

        if (options?.deep && (await deepVerify(tag)) === "no-data") {
            return false;
        }

        return reportUidMatch(card, tag, typeMatch);
    } catch (err) {
        if (err instanceof Pm3Error) {
            spinner.stop(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            spinner.stop("Failed to read tag.");
        }
        return false;
    }
}

function reportUidMatch(card: CardInfo, tag: Tag, typeMatch: boolean): boolean {
    if (typeMatch) {
        p.log.success(`Match! ID ${card.id} matches "${tag.name}".`);
        p.outro("Verification passed.");
        return true;
    }
    p.log.warn(`ID matches (${card.id}) but type differs: read ${card.type}, expected ${tag.type}.`);
    p.outro("Partial match — ID is correct.");
    return true;
}
