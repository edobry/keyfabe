import * as p from "@clack/prompts";
import { searchCard } from "../lib/card-ops.js";
import { printDoctorHint, printFobNotFound, printNoSavedTags } from "../lib/display.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { selectFob, waitForEnter } from "../lib/prompts.js";
import { getFob, loadFobs } from "../lib/store.js";

export async function verify(name?: string): Promise<boolean> {
    p.intro("Verify Tag");

    if (!name) {
        const fobs = await loadFobs();
        if (fobs.length === 0) {
            printNoSavedTags();
            return false;
        }
        name = await selectFob(fobs, "Which saved tag to verify against?");
    }

    const fob = await getFob(name);
    if (!fob) {
        printFobNotFound(name);
        return false;
    }

    if (!(await requireDevice())) return false;

    p.log.info(`Verifying against "${fob.name}" (${fob.type} ${fob.id})`);
    await waitForEnter("Place the tag to check on the antenna.");

    const spinner = p.spinner();
    spinner.start("Reading tag...");
    try {
        const card = await searchCard();
        if (!card) {
            spinner.stop("No tag detected.");
            p.log.error("Could not read a tag. Make sure it's on the antenna.");
            return false;
        }

        spinner.stop(`Read: ${card.type} ${card.id}`);

        const idMatch = card.id === fob.id;
        const typeMatch = card.type === fob.type;

        if (idMatch && typeMatch) {
            p.log.success(`Match! ID ${card.id} matches "${fob.name}".`);
            p.outro("Verification passed.");
            return true;
        }

        if (idMatch) {
            p.log.warn(`ID matches (${card.id}) but type differs: read ${card.type}, expected ${fob.type}.`);
            p.outro("Partial match — ID is correct.");
            return true;
        }

        p.log.error(`Mismatch: read ${card.id}, expected ${fob.id}.`);
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
