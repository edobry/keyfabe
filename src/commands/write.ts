import * as p from "@clack/prompts";
import { detectMagicType, writeAndVerify } from "../lib/card-ops.js";
import { CardType, cardFrequency, MagicCardType, Pm3Cmd, WriteTarget } from "../lib/constants.js";
import { printNoSavedTags, printNotMagicHint, printTagNotFound } from "../lib/display.js";
import { restoreCard } from "../lib/mf-ops.js";
import { parseHfSearch } from "../lib/parsers.js";
import { pm3Exec, requireDevice } from "../lib/pm3.js";
import { selectTag, waitForEnter } from "../lib/prompts.js";
import type { Tag } from "../lib/store.js";
import { getTag, loadTags } from "../lib/store.js";

export async function write(name?: string): Promise<boolean> {
    p.intro("Write Tag");

    if (!name) {
        const tags = await loadTags();
        if (tags.length === 0) {
            printNoSavedTags();
            return false;
        }
        name = await selectTag(tags, "Which tag identity to write?");
    }

    const tag = await getTag(name);
    if (!tag) {
        printTagNotFound(name);
        return false;
    }

    if (!(await requireDevice())) return false;

    p.log.info(`Writing "${tag.name}" (${tag.type} ${tag.id})`);

    // Full-card restore path
    if (tag.dumpFile && (tag.type === CardType.MIFARE_CLASSIC_1K || tag.type === CardType.MIFARE_CLASSIC_4K)) {
        return writeFullCard(tag);
    }

    if ((tag.type === CardType.MIFARE_CLASSIC_1K || tag.type === CardType.MIFARE_CLASSIC_4K) && !tag.dumpFile) {
        p.log.warn("No saved data dump for this identity — only the UID will be written.");
        p.log.warn(
            "A stored-value card (laundry, transit) needs its data too; re-clone with `keyfabe clone` for a full dump.",
        );
    }

    const freq = cardFrequency(tag.type);
    await waitForEnter(`Place a ${WriteTarget[freq]} on the antenna.`);

    const success = await writeAndVerify({ type: tag.type, id: tag.id, encoding: tag.encoding });

    if (success) {
        p.outro("Write successful!");
        return true;
    }
    p.log.error("Write failed.");
    return false;
}

async function writeFullCard(tag: Tag): Promise<boolean> {
    await waitForEnter(`Place a ${WriteTarget.HF} on the antenna.`);

    // Detect magic card type
    const magicSpinner = p.spinner();
    magicSpinner.start("Detecting magic card type...");
    const magicType = await detectMagicType();
    if (magicType === MagicCardType.UNKNOWN) {
        magicSpinner.stop("Target is not a magic card.");
        printNotMagicHint();
        return false;
    }
    if (magicType === MagicCardType.BRICKED) {
        magicSpinner.stop("Card has broken anticollision.");
        p.log.warn("Run `keyfabe repair` first, then try again.");
        return false;
    }
    magicSpinner.stop(`Magic card detected (${magicType})`);

    // Restore all blocks
    const restoreSpinner = p.spinner();
    restoreSpinner.start("Restoring all blocks to magic card...");
    const restoreResult = await restoreCard(tag.dumpFile!, tag.dumpFile!.replace("-dump.", "-key."), tag.type);
    if (!restoreResult.success) {
        restoreSpinner.stop("Restore failed.");
        p.log.error(`${restoreResult.failedBlocks} block(s) failed to write.`);
        return false;
    }
    restoreSpinner.stop("All blocks restored");

    // Power cycle and verify
    await waitForEnter("Remove the card from the antenna, then place it back.");

    const verifySpinner = p.spinner();
    verifySpinner.start("Verifying clone...");
    const { stdout: verifyOut } = await pm3Exec(Pm3Cmd.HF_SEARCH);
    const readback = parseHfSearch(verifyOut);
    if (readback && readback.id === tag.id) {
        verifySpinner.stop("Verification passed — UIDs match");
    } else {
        verifySpinner.stop("Verification warning — UID readback mismatch");
        p.log.warn("The UID may not have updated yet. Try removing and replacing the card.");
    }

    p.outro("Full-card write successful!");
    return true;
}
