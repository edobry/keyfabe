import * as p from "@clack/prompts";
import { writeAndVerify } from "../lib/card-ops.js";
import { printCardInfo, printDoctorHint } from "../lib/display.js";
import { parseHfSearch, parseLfSearch } from "../lib/parsers.js";
import { Pm3Error, pm3Exec, requireDevice } from "../lib/pm3.js";
import { promptName, waitForEnter } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

const MAX_READ_RETRIES = 3;
const READ_RETRY_DELAY = 2000;

export async function clone(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Keyfob Clone");

    // Step 1: Read original
    await waitForEnter("Place your original keyfob on the antenna.");

    let card: ReturnType<typeof parseLfSearch> = null;

    for (let attempt = 1; attempt <= MAX_READ_RETRIES; attempt++) {
        const s = p.spinner();
        s.start(`Reading original (attempt ${attempt}/${MAX_READ_RETRIES})...`);
        try {
            const { stdout } = await pm3Exec("lf search");
            card = parseLfSearch(stdout);
            if (card) {
                s.stop("Original card read");
                break;
            }
            s.stop("No card detected.");
            p.log.error("No card detected.");
        } catch (err) {
            if (err instanceof Pm3Error) {
                s.stop(err.message);
                p.log.error(err.message);
                if (err.message.includes("not found")) {
                    printDoctorHint();
                }
            } else {
                s.stop("Read failed.");
                p.log.error("Read failed.");
            }
        }

        if (attempt < MAX_READ_RETRIES) {
            p.log.info(`Retrying in ${READ_RETRY_DELAY / 1000}s...`);
            await new Promise((r) => setTimeout(r, READ_RETRY_DELAY));
        }
    }

    // If LF search failed, try HF
    if (!card) {
        const hfSpinner = p.spinner();
        hfSpinner.start("No LF card found, trying HF...");
        try {
            const { stdout } = await pm3Exec("hf search");
            const hfCard = parseHfSearch(stdout);
            if (hfCard) {
                hfSpinner.stop("HF card detected");
                printCardInfo(hfCard);
                p.log.warn(
                    `HF card cloning (${hfCard.type}) is not yet supported. Only LF keyfobs (EM410x, HID Prox) can be cloned.`,
                );
                return false;
            }
        } catch (err) {
            if (err instanceof Pm3Error) {
                hfSpinner.stop(err.message);
            } else {
                hfSpinner.stop("HF search failed.");
            }
        }
        if (!card) {
            p.log.error("Failed to read original card after all attempts.");
            return false;
        }
    }

    printCardInfo(card);

    // Step 2: Write to blank
    await waitForEnter("Remove original and place a blank T55x7 fob on the antenna.");

    const success = await writeAndVerify(card);

    if (success) {
        p.log.success("Clone successful!");
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
        p.outro("Done!");
        return true;
    }
    p.log.error("Clone failed.");
    return false;
}
