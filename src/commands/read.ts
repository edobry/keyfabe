import * as p from "@clack/prompts";
import { searchCardWithDiagnosis } from "../lib/card-ops.js";
import { DetectionSummary } from "../lib/constants.js";
import { printCardInfo, printDetectionHint, printDoctorHint } from "../lib/display.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { promptName } from "../lib/prompts.js";
import { saveTag } from "../lib/store.js";

export async function read(options?: { saveAs?: string }): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Read Tag");

    const s = p.spinner();
    s.start("Searching for tag...");
    try {
        const { card, diagnosis } = await searchCardWithDiagnosis();
        if (!card) {
            s.stop(DetectionSummary[diagnosis]);
            p.log.error(DetectionSummary[diagnosis]);
            printDetectionHint(diagnosis);
            return false;
        }
        s.stop("Tag detected");
        printCardInfo(card);

        // Prompt to save
        const name = options?.saveAs ?? (await promptName());
        if (name) {
            await saveTag({
                name,
                type: card.type,
                id: card.id,
                encoding: card.encoding,
                savedAt: new Date().toISOString(),
            });
            p.log.success(`Saved as "${name}".`);
        }
        return true;
    } catch (err) {
        if (err instanceof Pm3Error) {
            s.stop(err.message);
            p.log.error(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            s.stop("Search failed.");
            p.log.error("Search failed.");
        }
        return false;
    }
}
