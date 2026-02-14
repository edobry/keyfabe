import * as p from "@clack/prompts";
import { CardType, cardFrequency, Pm3Cmd, WriteTarget } from "./constants.js";
import { printDoctorHint } from "./display.js";
import { type CardInfo, parseCloneResult, parseHfSearch, parseLfSearch, parseT55xxDetect } from "./parsers.js";
import { Pm3Error, pm3Exec } from "./pm3.js";

export async function searchCard(): Promise<CardInfo | null> {
    const { stdout: lfOut } = await pm3Exec(Pm3Cmd.LF_SEARCH);
    const lfCard = parseLfSearch(lfOut);
    if (lfCard) return lfCard;

    const { stdout: hfOut } = await pm3Exec(Pm3Cmd.HF_SEARCH);
    return parseHfSearch(hfOut);
}

function cloneCommand(card: CardInfo): string {
    switch (card.type) {
        case CardType.EM410x:
            return `lf em 410x clone --id ${card.id}`;
        case CardType.HID_PROX:
            return `lf hid clone -r ${card.id}`;
        case CardType.MIFARE_CLASSIC_1K:
        case CardType.MIFARE_CLASSIC_4K:
            return `hf mf csetuid -u ${card.id}`;
        default:
            throw new Error(`Unsupported card type: ${card.type}`);
    }
}

function verifyCommand(card: CardInfo): string {
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

    // Clone
    const cloneSpinner = p.spinner();
    cloneSpinner.start("Writing card data...");
    try {
        const cmd = cloneCommand(card);
        const { stdout } = await pm3Exec(cmd);
        const result = parseCloneResult(stdout);
        if (!result.success) {
            stopWithError(cloneSpinner, "Write command did not confirm success.");
            if (freq === "HF") {
                p.log.warn(`Make sure the target is a ${WriteTarget.HF} (Chinese magic backdoor).`);
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
