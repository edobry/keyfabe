import * as p from "@clack/prompts";
import { DetectionHint, type DetectionKindName, WriteHint } from "./constants.js";
import type { CardInfo } from "./parsers.js";

export const LF_VOLTAGE_THRESHOLD = 15;
export const HF_VOLTAGE_THRESHOLD = 10;

export const BREW_INSTALL_CMD = "brew tap rfidresearchgroup/proxmark3 && brew install proxmark3";

export function printBrewInstall() {
    p.note(BREW_INSTALL_CMD, "Install Proxmark3 client");
}

export function printCardInfo(card: CardInfo) {
    const lines = [`Type:     ${card.type}`, `ID:       ${card.id}`];
    if (card.encoding) {
        lines.push(`Encoding: ${card.encoding}`);
    }
    p.note(lines.join("\n"), "Card Info");
}

export function printDoctorHint() {
    p.log.warn("Run `keyfabe doctor` to diagnose your setup.");
}

export function printNoSavedTags() {
    p.log.warn("No saved tags. Use `keyfabe read` or `keyfabe clone` first.");
}

export function printFobNotFound(name: string) {
    p.log.error(`No saved tag named "${name}". Use \`keyfabe list\` to see saved tags.`);
}

export function printDetectionHint(diagnosis: DetectionKindName) {
    p.log.warn(DetectionHint[diagnosis]);
}

export function printNotMagicHint() {
    p.log.warn(WriteHint.not_magic);
}

export function printFrequencyMismatchHint(expected: "LF") {
    if (expected === "LF") {
        p.log.warn(WriteHint.wrong_freq_lf_got_hf);
    }
}

export function printFullCardCloneProgress(method: string) {
    if (method === "fm11rf08s") {
        p.log.info("Using FM11RF08S recovery — this takes approximately 28 minutes.");
    }
}
