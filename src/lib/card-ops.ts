import * as p from "@clack/prompts";
import { buildBlock0 } from "./block0.js";
import {
    CardType,
    cardFrequency,
    DetectionKind,
    type DetectionKindName,
    MagicCardType,
    Pm3Cmd,
    type Pm3Command,
    WriteTarget,
} from "./constants.js";
import { printDoctorHint, printFrequencyMismatchHint, printNotMagicHint } from "./display.js";
import {
    type CardInfo,
    detectBrickedHf,
    parseCloneResult,
    parseHfSearch,
    parseLfSearch,
    parseMagicType,
    parseT55xxDetect,
} from "./parsers.js";
import { Pm3Error, pm3Exec } from "./pm3.js";

export async function searchCard(): Promise<CardInfo | null> {
    const { stdout: lfOut } = await pm3Exec(Pm3Cmd.LF_SEARCH);
    const lfCard = parseLfSearch(lfOut);
    if (lfCard) return lfCard;

    const { stdout: hfOut } = await pm3Exec(Pm3Cmd.HF_SEARCH);
    return parseHfSearch(hfOut);
}

export interface SearchDiagnosis {
    card: CardInfo | null;
    diagnosis: DetectionKindName;
}

export async function searchCardWithDiagnosis(): Promise<SearchDiagnosis> {
    // 1. Normal LF search
    const { stdout: lfOut } = await pm3Exec(Pm3Cmd.LF_SEARCH);
    const lfCard = parseLfSearch(lfOut);
    if (lfCard) return { card: lfCard, diagnosis: DetectionKind.NONE };

    // 2. Normal HF search
    const { stdout: hfOut } = await pm3Exec(Pm3Cmd.HF_SEARCH);
    const hfCard = parseHfSearch(hfOut);
    if (hfCard) return { card: hfCard, diagnosis: DetectionKind.NONE };

    // 3. Neither found — run fallback probes

    // 3a. Check hfOutput for bricked indicators
    if (detectBrickedHf(hfOut)) {
        return { card: null, diagnosis: DetectionKind.BRICKED_HF };
    }

    // 3b. Check for blank T55x7
    try {
        const { stdout: t55Out } = await pm3Exec(Pm3Cmd.LF_T55XX_DETECT);
        const t55 = parseT55xxDetect(t55Out);
        if (t55) {
            return { card: null, diagnosis: DetectionKind.BLANK_T55X7 };
        }
    } catch {
        // Graceful fallback — treat as nothing found
    }

    return { card: null, diagnosis: DetectionKind.NONE };
}

/** Detect magic card type by running hf search and parsing capabilities. */
export async function detectMagicType(): Promise<string> {
    const { stdout } = await pm3Exec(Pm3Cmd.HF_SEARCH);
    return parseMagicType(stdout);
}

function gen1aCloneCommand(card: CardInfo): Pm3Command {
    return Pm3Cmd.HF_MF_CSETUID.arg("-u", card.id);
}

function gen2CloneCommand(card: CardInfo): Pm3Command {
    const block0 = buildBlock0(card.id, card.type);
    return Pm3Cmd.HF_MF_WRBL.arg("--blk", "0").arg("-k", "FFFFFFFFFFFF").arg("-d", block0).arg("--force");
}

function cloneCommand(card: CardInfo, magicType?: string): Pm3Command {
    switch (card.type) {
        case CardType.EM410x:
            return Pm3Cmd.LF_EM_410X_CLONE.arg("--id", card.id);
        case CardType.HID_PROX:
            return Pm3Cmd.LF_HID_CLONE.arg("-r", card.id);
        case CardType.MIFARE_CLASSIC_1K:
        case CardType.MIFARE_CLASSIC_4K:
            if (magicType === MagicCardType.GEN2_CUID) {
                return gen2CloneCommand(card);
            }
            return gen1aCloneCommand(card);
        default:
            throw new Error(`Unsupported card type: ${card.type}`);
    }
}

/** Match clone result patterns for Gen2 wrbl output (e.g. "Write ( ok )"). */
function isWriteSuccess(stdout: string, magicType?: string): boolean {
    if (magicType === MagicCardType.GEN2_CUID) {
        return /write\s*\(\s*ok\s*\)/i.test(stdout);
    }
    return parseCloneResult(stdout).success;
}

function verifyCommand(card: CardInfo): Pm3Command {
    switch (card.type) {
        case CardType.EM410x:
            return Pm3Cmd.LF_EM_410X_READER;
        case CardType.HID_PROX:
            return Pm3Cmd.LF_HID_READER;
        default:
            return Pm3Cmd.HF_SEARCH;
    }
}

function stopWithError(spinner: ReturnType<typeof p.spinner>, message: string) {
    spinner.stop(message);
    p.log.error(message);
}

export async function writeAndVerify(card: CardInfo): Promise<boolean> {
    const freq = cardFrequency(card.type);

    // HF cards other than MIFARE Classic are not yet supported
    if (freq === "HF" && card.type !== CardType.MIFARE_CLASSIC_1K && card.type !== CardType.MIFARE_CLASSIC_4K) {
        p.log.error(`Writing ${card.type} cards is not yet supported.`);
        return false;
    }

    // Detect T55x7 (LF only)
    if (freq === "LF") {
        const detectSpinner = p.spinner();
        detectSpinner.start("Detecting writable card...");
        try {
            const { stdout } = await pm3Exec(Pm3Cmd.LF_T55XX_DETECT);
            const t55 = parseT55xxDetect(stdout);
            if (!t55) {
                stopWithError(detectSpinner, `Card is not a writable T55x7. Use a ${WriteTarget.LF}.`);
                // Check if an HF card is on the antenna instead
                try {
                    const { stdout: hfOut } = await pm3Exec(Pm3Cmd.HF_SEARCH);
                    if (parseHfSearch(hfOut)) {
                        printFrequencyMismatchHint("LF");
                    }
                } catch {
                    // ignore — just a hint
                }
                return false;
            }
            detectSpinner.stop(`Writable card detected (${t55.chipType})`);
        } catch (err) {
            if (err instanceof Pm3Error) {
                stopWithError(detectSpinner, err.message);
                if (err.message.includes("not found")) {
                    printDoctorHint();
                }
            } else {
                stopWithError(detectSpinner, "Failed to detect writable card.");
            }
            return false;
        }
    }

    // Detect magic card type (HF only)
    let magicType: string | undefined;
    if (freq === "HF") {
        const magicSpinner = p.spinner();
        magicSpinner.start("Detecting magic card type...");
        try {
            magicType = await detectMagicType();
            if (magicType === MagicCardType.BRICKED) {
                stopWithError(
                    magicSpinner,
                    "Card has broken anticollision — it may have a corrupted block 0 (bad BCC).",
                );
                p.log.warn("Run `keyfabe repair` to fix it, then try writing again.");
                return false;
            }
            if (magicType === MagicCardType.UNKNOWN) {
                stopWithError(magicSpinner, `Target is not a recognized magic card. Use a ${WriteTarget.HF}.`);
                printNotMagicHint();
                return false;
            }
            magicSpinner.stop(`Magic card detected (${magicType})`);
        } catch (err) {
            if (err instanceof Pm3Error) {
                stopWithError(magicSpinner, err.message);
                if (err.message.includes("not found")) {
                    printDoctorHint();
                }
            } else {
                stopWithError(magicSpinner, "Failed to detect magic card type.");
            }
            return false;
        }
    }

    // Clone
    const cloneSpinner = p.spinner();
    cloneSpinner.start("Writing card data...");
    try {
        const cmd = cloneCommand(card, magicType);
        const { stdout } = await pm3Exec(cmd);
        if (!isWriteSuccess(stdout, magicType)) {
            stopWithError(cloneSpinner, "Write command did not confirm success.");
            if (freq === "HF") {
                p.log.warn(`Make sure the target is a ${WriteTarget.HF}.`);
            }
            return false;
        }
        cloneSpinner.stop("Card data written");
    } catch (err) {
        if (err instanceof Pm3Error) {
            stopWithError(cloneSpinner, err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            stopWithError(cloneSpinner, "Failed to write card data.");
        }
        return false;
    }

    // Verify
    const verifySpinner = p.spinner();
    verifySpinner.start("Verifying readback...");
    try {
        const cmd = verifyCommand(card);
        const { stdout } = await pm3Exec(cmd);
        const readback = freq === "LF" ? parseLfSearch(stdout) : parseHfSearch(stdout);
        if (readback && readback.id === card.id) {
            verifySpinner.stop("Verification passed — IDs match");
            return true;
        }
        const msg = `Verification failed — readback ID ${readback?.id ?? "not found"} doesn't match ${card.id}. Try again.`;
        stopWithError(verifySpinner, msg);
        return false;
    } catch (err) {
        if (err instanceof Pm3Error) {
            stopWithError(verifySpinner, err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            stopWithError(verifySpinner, "Verification readback failed.");
        }
        return false;
    }
}
