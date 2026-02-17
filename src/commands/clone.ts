import * as p from "@clack/prompts";
import { detectMagicType, searchCardWithDiagnosis, writeAndVerify } from "../lib/card-ops.js";
import { CardType, cardFrequency, DetectionSummary, MagicCardType, Pm3Cmd, WriteTarget } from "../lib/constants.js";
import {
    printCardInfo,
    printDetectionHint,
    printDoctorHint,
    printFullCardCloneProgress,
    printNotMagicHint,
} from "../lib/display.js";
import { crackKeys, dumpCard, restoreCard } from "../lib/mf-ops.js";
import type { CardInfo } from "../lib/parsers.js";
import { parseHfSearch } from "../lib/parsers.js";
import { Pm3Error, pm3Exec, requireDevice } from "../lib/pm3.js";
import { promptName, waitForEnter } from "../lib/prompts.js";
import { saveTag } from "../lib/store.js";

const MAX_READ_RETRIES = 3;
const READ_RETRY_DELAY = 2000;

export async function clone(options?: { saveAs?: string }): Promise<boolean> {
    if (!(await requireDevice())) return false;

    p.intro("Clone Tag");

    // Step 1: Read original
    await waitForEnter("Place your original tag on the antenna.");

    let card: CardInfo | null = null;

    for (let attempt = 1; attempt <= MAX_READ_RETRIES; attempt++) {
        const s = p.spinner();
        s.start(`Reading original (attempt ${attempt}/${MAX_READ_RETRIES})...`);
        try {
            const result = await searchCardWithDiagnosis();
            if (result.card) {
                card = result.card;
                s.stop("Original tag read");
                break;
            }
            s.stop(DetectionSummary[result.diagnosis]);
            p.log.error(DetectionSummary[result.diagnosis]);
            printDetectionHint(result.diagnosis);
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

    // Route MIFARE Classic to full-card flow
    if (card.type === CardType.MIFARE_CLASSIC_1K || card.type === CardType.MIFARE_CLASSIC_4K) {
        return cloneMifareClassic(card, options);
    }

    // Step 2: Write to blank (UID-only path for LF/simple HF)
    const freq = cardFrequency(card.type);
    await waitForEnter(`Remove original and place a ${WriteTarget[freq]} on the antenna.`);

    const success = await writeAndVerify(card);

    if (success) {
        p.log.success("Clone successful!");
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
        p.outro("Done!");
        return true;
    }
    p.log.error("Clone failed.");
    return false;
}

async function cloneMifareClassic(card: CardInfo, options?: { saveAs?: string }): Promise<boolean> {
    // Step 2a: Crack sector keys
    const crackSpinner = p.spinner();
    crackSpinner.start("Cracking sector keys (this may take a while)...");
    const crackResult = await crackKeys(card.id, card.type);
    if (!crackResult) {
        crackSpinner.stop("Failed to crack sector keys.");
        p.log.error("Could not recover sector keys. The card may use an unsupported encryption method.");
        return false;
    }
    crackSpinner.stop(`Sector keys recovered (${crackResult.method})`);
    printFullCardCloneProgress(crackResult.method);

    // Step 2b: Dump all blocks
    const dumpSpinner = p.spinner();
    dumpSpinner.start("Dumping all card data...");
    const dumpResult = await dumpCard(card.id, card.type, crackResult.keyFile);
    if (!dumpResult) {
        dumpSpinner.stop("Failed to dump card data.");
        p.log.error("Could not dump card data.");
        return false;
    }
    dumpSpinner.stop("Full card dump saved");

    // Step 3: Prompt to place blank magic card
    await waitForEnter(`Remove original and place a ${WriteTarget.HF} on the antenna.`);

    // Step 3a: Detect magic card type on target
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

    // Step 4: Restore all blocks
    const restoreSpinner = p.spinner();
    restoreSpinner.start("Restoring all blocks to magic card...");
    const restoreResult = await restoreCard(dumpResult.dumpFile, dumpResult.keyFile, card.type);
    if (!restoreResult.success) {
        restoreSpinner.stop("Restore failed.");
        p.log.error(`${restoreResult.failedBlocks} block(s) failed to write.`);
        return false;
    }
    restoreSpinner.stop("All blocks restored");

    // Step 5: Power cycle and verify
    await waitForEnter("Remove the card from the antenna, then place it back.");

    const verifySpinner = p.spinner();
    verifySpinner.start("Verifying clone...");
    const { stdout: verifyOut } = await pm3Exec(Pm3Cmd.HF_SEARCH);
    const readback = parseHfSearch(verifyOut);
    if (readback && readback.id === card.id) {
        verifySpinner.stop("Verification passed — UIDs match");
    } else {
        verifySpinner.stop("Verification warning — UID readback mismatch");
        p.log.warn("The UID may not have updated yet. Try removing and replacing the card.");
    }

    // Step 6: Save
    p.log.success("Full-card clone successful!");
    const name = options?.saveAs ?? (await promptName());
    if (name) {
        await saveTag({
            name,
            type: card.type,
            id: card.id,
            dumpFile: dumpResult.dumpFile,
            savedAt: new Date().toISOString(),
        });
        p.log.success(`Saved as "${name}".`);
    }
    p.outro("Done!");
    return true;
}
