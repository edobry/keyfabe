import * as p from "@clack/prompts";
import { buildBlock0, computeBcc, parseBlock0, validateBcc } from "../lib/block0.js";
import { CardType, Pm3Cmd, Pm3Command } from "../lib/constants.js";
import { printDoctorHint } from "../lib/display.js";
import { parseBlock0Data, parseHfSearch } from "../lib/parsers.js";
import { Pm3Error, pm3Exec, requireDevice } from "../lib/pm3.js";
import { waitForEnter } from "../lib/prompts.js";

/** Build a chained command that ignores BCC, writes block 0, then resets config. */
function bccRepairCommand(block0Data: string): Pm3Command {
    const configBypass = Pm3Cmd.HF_14A_CONFIG.arg("--atqa", "force")
        .arg("--bcc", "ignore")
        .arg("--cl2", "skip")
        .arg("--rats", "skip");
    const write = Pm3Cmd.HF_MF_WRBL.arg("--blk", "0").arg("-k", "FFFFFFFFFFFF").arg("-d", block0Data).arg("--force");
    const configReset = Pm3Cmd.HF_14A_CONFIG.arg("--std");

    return Pm3Command.chain(configBypass, write, configReset);
}

/** Read block 0 with BCC bypass enabled. */
function bccBypassReadCommand(): Pm3Command {
    const configBypass = Pm3Cmd.HF_14A_CONFIG.arg("--atqa", "force")
        .arg("--bcc", "ignore")
        .arg("--cl2", "skip")
        .arg("--rats", "skip");
    const read = Pm3Cmd.HF_MF_RDBL.arg("--blk", "0").arg("-k", "FFFFFFFFFFFF");
    const configReset = Pm3Cmd.HF_14A_CONFIG.arg("--std");

    return Pm3Command.chain(configBypass, read, configReset);
}

export async function repair(): Promise<boolean> {
    p.intro("Repair Magic Card");

    if (!(await requireDevice())) return false;

    p.log.info("This command repairs MIFARE Classic magic cards with corrupted block 0.");
    p.log.info('Common symptom: "Card doesn\'t support standard iso14443-3 anticollision"');
    await waitForEnter("Place the broken card on the antenna.");

    // Step 1: Try normal hf search first
    const normalSpinner = p.spinner();
    normalSpinner.start("Checking card state...");
    try {
        const { stdout } = await pm3Exec(Pm3Cmd.HF_SEARCH);
        const card = parseHfSearch(stdout);
        if (card) {
            normalSpinner.stop("Card is readable — anticollision is working.");
            p.log.success(`UID: ${card.id} (${card.type})`);
            p.log.info(
                "This card doesn't appear to need repair. If you're having write issues, try `keyfabe write` instead.",
            );
            return true;
        }
        normalSpinner.stop("Card not readable via normal search.");
    } catch (err) {
        if (err instanceof Pm3Error && err.message.includes("not found")) {
            normalSpinner.stop(err.message);
            printDoctorHint();
            return false;
        }
        normalSpinner.stop("Normal search failed — proceeding with repair.");
    }

    // Step 2: Read block 0 with BCC bypass
    const readSpinner = p.spinner();
    readSpinner.start("Reading block 0 with anticollision bypass...");

    let parsed: ReturnType<typeof parseBlock0>;
    try {
        const { stdout } = await pm3Exec(bccBypassReadCommand());
        const block0Hex = parseBlock0Data(stdout);
        if (!block0Hex) {
            readSpinner.stop("Could not read block 0.");
            p.log.error(
                "Failed to read block 0 even with BCC bypass. The card may not be a MIFARE Classic or the key may have been changed.",
            );
            return false;
        }

        parsed = parseBlock0(block0Hex);
        if (!parsed) {
            readSpinner.stop("Block 0 data too short to parse.");
            return false;
        }

        const bccValid = validateBcc(parsed.uid, parsed.bcc);
        if (bccValid) {
            readSpinner.stop("Block 0 BCC is already correct.");
            p.log.info(`UID: ${parsed.uid}, BCC: 0x${parsed.bcc.toString(16).padStart(2, "0").toUpperCase()} (valid)`);
            p.log.warn(
                "The BCC is correct but the card still isn't readable. The issue may be with ATQA or SAK values.",
            );
        } else {
            const expectedBcc = computeBcc(parsed.uid);
            readSpinner.stop("Found corrupted BCC.");
            p.log.warn(
                `UID: ${parsed.uid}, BCC: 0x${parsed.bcc.toString(16).padStart(2, "0").toUpperCase()} (expected 0x${expectedBcc.toString(16).padStart(2, "0").toUpperCase()})`,
            );
        }
    } catch (err) {
        if (err instanceof Pm3Error) {
            readSpinner.stop(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            readSpinner.stop("Failed to read block 0.");
        }
        return false;
    }

    // Step 3: Determine correct card type from SAK
    let cardType: string;
    if (parsed.sak === 0x18) {
        cardType = CardType.MIFARE_CLASSIC_4K;
    } else {
        cardType = CardType.MIFARE_CLASSIC_1K;
    }

    // Step 4: Build corrected block 0 and write
    const correctedBlock0 = buildBlock0(parsed.uid, cardType);
    p.log.info(`Repairing: ${parsed.uid} as ${cardType}`);
    p.log.info(`Corrected block 0: ${correctedBlock0}`);

    const writeSpinner = p.spinner();
    writeSpinner.start("Writing corrected block 0...");
    try {
        const { stdout: writeOut } = await pm3Exec(bccRepairCommand(correctedBlock0));
        if (!/write\s*\(\s*ok\s*\)/i.test(writeOut)) {
            writeSpinner.stop("Write command did not confirm success.");
            p.log.error("Failed to write corrected block 0. The key may have been changed from default.");
            return false;
        }
        writeSpinner.stop("Corrected block 0 written.");
    } catch (err) {
        if (err instanceof Pm3Error) {
            writeSpinner.stop(err.message);
            if (err.message.includes("not found")) {
                printDoctorHint();
            }
        } else {
            writeSpinner.stop("Failed to write corrected block 0.");
        }
        return false;
    }

    // Step 5: Power cycle and verify
    await waitForEnter("Remove the card from the antenna, then place it back.");

    const verifySpinner = p.spinner();
    verifySpinner.start("Verifying repair...");
    try {
        const { stdout } = await pm3Exec(Pm3Cmd.HF_SEARCH);
        const card = parseHfSearch(stdout);
        if (card) {
            verifySpinner.stop("Card repaired successfully!");
            p.log.success(`UID: ${card.id} (${card.type})`);
            p.outro("Repair complete!");
            return true;
        }
        verifySpinner.stop("Card still not readable after repair.");
        p.log.error("The repair may not have taken effect. Try removing and replacing the card again.");
        return false;
    } catch (err) {
        if (err instanceof Pm3Error) {
            verifySpinner.stop(err.message);
        } else {
            verifySpinner.stop("Verification failed.");
        }
        return false;
    }
}
