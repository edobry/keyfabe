import * as p from "@clack/prompts";
import { writeAndVerify } from "../lib/card-ops.js";
import { cardFrequency } from "../lib/constants.js";
import { printFobNotFound, printNoSavedTags } from "../lib/display.js";
import { requireDevice } from "../lib/pm3.js";
import { selectFob, waitForEnter } from "../lib/prompts.js";
import { getFob, loadFobs } from "../lib/store.js";

export async function write(name?: string): Promise<boolean> {
    p.intro("Write Tag");

    if (!name) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            printNoSavedTags();
            return false;
        }
        name = await selectFob(fobs, "Which tag identity to write?");
    }

    const fob = await getFob(name);
    if (!fob) {
        printFobNotFound(name);
        return false;
    }

    if (!(await requireDevice())) return false;

    p.log.info(`Writing "${fob.name}" (${fob.type} ${fob.id})`);

    const freq = cardFrequency(fob.type);
    if (freq === "LF") {
        await waitForEnter("Place a blank T55x7 tag on the antenna.");
    } else {
        await waitForEnter("Place the target tag on the antenna.");
    }

    const success = await writeAndVerify({ type: fob.type, id: fob.id, encoding: fob.encoding });

    if (success) {
        p.outro("Write successful!");
        return true;
    }
    p.log.error("Write failed.");
    return false;
}
