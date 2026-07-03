import * as p from "@clack/prompts";
import { type MifareDataFidelity, probeMifareDataFidelity, searchCardWithDiagnosis } from "../lib/card-ops.js";
import { CardType, DetectionSummary } from "../lib/constants.js";
import { printCardInfo, printDetectionHint, printDoctorHint } from "../lib/display.js";
import type { CardInfo } from "../lib/parsers.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { loadTags, type Tag } from "../lib/store.js";

const MIFARE_CLASSIC_TYPES: ReadonlySet<string> = new Set([CardType.MIFARE_CLASSIC_1K, CardType.MIFARE_CLASSIC_4K]);

/** Render the matched saved identities (or lack thereof) for the card on the reader. */
function reportMatches(card: CardInfo, matches: Tag[]): void {
    if (matches.length === 0) {
        p.log.warn("No saved identity matches this UID — unknown or blank card.");
        return;
    }
    const lines = matches.map((t) => {
        const typeNote = t.type === card.type ? "" : `  (saved as ${t.type})`;
        const dumpNote = t.dumpFile ? "  [full dump on file]" : "";
        return `• ${t.name}${typeNote}${dumpNote}`;
    });
    p.note(lines.join("\n"), matches.length === 1 ? "Matches saved identity" : "Matches saved identities");
}

/** Report what a MIFARE Classic card's sectors reveal about whether it carries real data. */
function reportFidelity(fidelity: MifareDataFidelity, matches: Tag[]): void {
    switch (fidelity) {
        case "custom-keys":
            p.log.success("Data sectors use custom keys — this card carries real data (full clone or genuine card).");
            if (matches.some((t) => t.dumpFile)) {
                p.log.info("Run `keyfabe inspect <name>` to decode its saved value blocks / balance.");
            }
            break;
        case "blank-default":
            p.log.warn("Data sectors are blank with factory-default keys — a UID-only clone or unwritten card.");
            p.log.warn(
                "Even though the UID matches, a stored-value reader (e.g. laundry) will reject it as unformatted.",
            );
            break;
        case "data-default":
            p.log.info("Data sectors are populated but still use factory-default keys.");
            break;
        default:
            p.log.info("Could not determine data fidelity (sector keys unknown).");
    }
}

export async function identify(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Identify Tag");

    const spinner = p.spinner();
    spinner.start("Reading tag...");

    let card: CardInfo;
    try {
        const { card: found, diagnosis } = await searchCardWithDiagnosis();
        if (!found) {
            spinner.stop(DetectionSummary[diagnosis]);
            p.log.error(DetectionSummary[diagnosis]);
            printDetectionHint(diagnosis);
            return false;
        }
        card = found;
        spinner.stop(`Read: ${card.type} ${card.id}`);
    } catch (err) {
        if (err instanceof Pm3Error) {
            spinner.stop(err.message);
            if (err.message.includes("not found")) printDoctorHint();
        } else {
            spinner.stop("Failed to read tag.");
        }
        return false;
    }

    printCardInfo(card);

    const tags = await loadTags();
    const matches = tags.filter((t) => t.id === card.id);
    reportMatches(card, matches);

    if (MIFARE_CLASSIC_TYPES.has(card.type)) {
        const fidelity = await probeMifareDataFidelity();
        reportFidelity(fidelity, matches);
    }

    p.outro("Done.");
    return true;
}
