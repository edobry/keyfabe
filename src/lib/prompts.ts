import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

function createRl() {
    return createInterface({ input: stdin, output: stdout });
}

export async function prompt(message: string): Promise<string> {
    const rl = createRl();
    try {
        return await rl.question(message);
    } finally {
        rl.close();
    }
}

export async function confirm(message: string): Promise<boolean> {
    const answer = await prompt(`${message} [y/N] `);
    return answer.toLowerCase().startsWith("y");
}

export async function waitForEnter(message: string): Promise<void> {
    await prompt(`${message} [Press Enter] `);
}

export async function promptName(): Promise<string | null> {
    const name = await prompt("Save as (name, or empty to skip): ");
    const trimmed = name.trim();
    return trimmed || null;
}
