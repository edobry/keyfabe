import * as p from "@clack/prompts";
import { searchCardWithDiagnosis } from "../lib/card-ops.js";
import { DetectionSummary } from "../lib/constants.js";
import { printDetectionHint, printDoctorHint, printNoSavedTags, printTagNotFound } from "../lib/display.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { selectTag, waitForEnter } from "../lib/prompts.js";
import { getTag, loadTags } from "../lib/store.js";

export async function verify(name?: string): Promise<boolean> {
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

        if (idMatch && typeMatch) {
            p.log.success(`Match! ID ${card.id} matches "${tag.name}".`);
            p.outro("Verification passed.");
            return true;
        }

        if (idMatch) {
            p.log.warn(`ID matches (${card.id}) but type differs: read ${card.type}, expected ${tag.type}.`);
            p.outro("Partial match — ID is correct.");
            return true;
        }

        p.log.error(`Mismatch: read ${card.id}, expected ${tag.id}.`);
        return false;
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
