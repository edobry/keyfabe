import * as p from "@clack/prompts";
import { printCardInfo, printDoctorHint } from "../lib/display.js";
import { parseHfSearch, parseLfSearch } from "../lib/parsers.js";
import { Pm3Error, pm3Exec, requireDevice } from "../lib/pm3.js";
import { promptName } from "../lib/prompts.js";
import { saveFob } from "../lib/store.js";

export async function read(): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Read Card");

    let card: ReturnType<typeof parseLfSearch> = null;

    const s = p.spinner();
    s.start("Searching for card (LF)...");
    try {
        const { stdout } = await pm3Exec("lf search");
        card = parseLfSearch(stdout);
    } catch (err) {
        if (err instanceof Pm3Error) {
            s.stop(err.message);
            p.log.error(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
            return false;
        }
    }

    if (!card) {
        s.stop("No LF card found, trying HF...");
        const hf = p.spinner();
        hf.start("Searching for card (HF)...");
        try {
            const { stdout } = await pm3Exec("hf search");
            card = parseHfSearch(stdout);
        } catch (err) {
            if (err instanceof Pm3Error) {
                hf.stop(err.message);
                p.log.error(err.message);
                if (err.message.includes("not found")) {
                    printDoctorHint();
                }
                return false;
            }
        }

        if (!card) {
            hf.stop("No card detected. Make sure the card is flat against the antenna.");
            p.log.error("No card detected. Make sure the card is flat against the antenna.");
            return false;
        }
        hf.stop("Card detected");
    } else {
        s.stop("Card detected");
    }
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
}
