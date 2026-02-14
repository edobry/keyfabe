import * as p from "@clack/prompts";
import { searchCard } from "../lib/card-ops.js";
import { printCardInfo, printDoctorHint } from "../lib/display.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { promptName } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

export async function read(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Read Tag");

    const s = p.spinner();
    s.start("Searching for tag...");
    try {
        const card = await searchCard();
        if (!card) {
            s.stop("No tag detected. Make sure the tag is flat against the antenna.");
            p.log.error("No tag detected. Make sure the tag is flat against the antenna.");
            return false;
        }
        s.stop("Tag detected");
        printCardInfo(card);

        // Prompt to save
        const name = await promptName();
        if (name) {
            await saveFob({
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
