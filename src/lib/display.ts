import chalk from "chalk";
import type { CardInfo } from "./parsers.js";

export const LF_VOLTAGE_THRESHOLD = 15;
export const HF_VOLTAGE_THRESHOLD = 10;

export const BREW_INSTALL_CMD = "brew tap rfidresearchgroup/proxmark3 && brew install proxmark3";

export function printBrewInstall() {
    console.log(chalk.yellow("  Install Proxmark3 client:"));
    console.log(chalk.yellow(`    ${BREW_INSTALL_CMD}`));
}

export function printCardInfo(card: CardInfo) {
    console.log(chalk.bold(`\n  Type:     ${card.type}`));
    console.log(chalk.bold(`  ID:       ${card.id}`));
    if (card.encoding) {
        console.log(chalk.bold(`  Encoding: ${card.encoding}`));
    }
    console.log();
}

export function printFobNotFound(name: string) {
    console.log(chalk.red(`\nNo saved fob named "${name}". Use \`keyfabe list\` to see saved fobs.\n`));
}
