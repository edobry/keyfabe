import * as p from "@clack/prompts";
import { writeAndVerify } from "../lib/card-ops.js";
import { printFobNotFound } from "../lib/display.js";
import { requireDevice } from "../lib/pm3.js";
import { selectFob, waitForEnter } from "../lib/prompts.js";
import { getFob, loadFobs } from "../lib/store.js";

export async function write(name?: string): Promise<boolean> {
    p.intro("Write Fob");

    if (!name) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            p.log.warn("No saved fobs. Use `keyfabe read` or `keyfabe clone` first.");
            return false;
        }
        name = await selectFob(fobs, "Which fob identity to write?");
    }

    const fob = await getFob(name);
    if (!fob) {
        printFobNotFound(name);
        return false;
    }

    if (!(await requireDevice())) return false;

    p.log.info(`Writing "${fob.name}" (${fob.type} ${fob.id})`);

    await waitForEnter("Place a blank T55x7 fob on the antenna.");

    const success = await writeAndVerify({ type: fob.type, id: fob.id, encoding: fob.encoding });

    if (success) {
        p.outro("Write successful!");
        return true;
    }
    p.log.error("Write failed.");
    return false;
}
