import * as p from "@clack/prompts";
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
