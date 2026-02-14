import * as p from "@clack/prompts";
import { searchCard, writeAndVerify } from "../lib/card-ops.js";
import { cardFrequency } from "../lib/constants.js";
import { printCardInfo, printDoctorHint } from "../lib/display.js";
import type { CardInfo } from "../lib/parsers.js";
import { Pm3Error, requireDevice } from "../lib/pm3.js";
import { promptName, waitForEnter } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

const MAX_READ_RETRIES = 3;
const READ_RETRY_DELAY = 2000;

export async function clone(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Clone Tag");

    // Step 1: Read original
    await waitForEnter("Place your original tag on the antenna.");

    let card: CardInfo | null = null;

    for (let attempt = 1; attempt <= MAX_READ_RETRIES; attempt++) {
        const s = p.spinner();
        s.start(`Reading original (attempt ${attempt}/${MAX_READ_RETRIES})...`);
        try {
            card = await searchCard();
            if (card) {
                s.stop("Original tag read");
                break;
            }
            s.stop("No tag detected.");
            p.log.error("No tag detected.");
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

    if (!card) {
        p.log.error("Failed to read original tag after all attempts.");
        return false;
    }

    printCardInfo(card);

    // Step 2: Write to blank
    const freq = cardFrequency(card.type);
    if (freq === "LF") {
        await waitForEnter("Remove original and place a blank T55x7 tag on the antenna.");
    } else {
        await waitForEnter("Remove original and place the target tag on the antenna.");
    }

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
