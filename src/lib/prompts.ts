import * as p from "@clack/prompts";
import type { Fob } from "./store.js";

function handleCancel(value: unknown): asserts value is string | boolean {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
    }
}

export function isInteractive(): boolean {
    return !!process.stdin.isTTY;
}

export async function confirm(message: string): Promise<boolean> {
    if (!isInteractive()) return true;
    const value = await p.confirm({ message });
    handleCancel(value);
    return value as boolean;
}

export async function waitForEnter(message: string): Promise<void> {
    if (!isInteractive()) {
        p.log.info(message);
        return;
    }
    const value = await p.text({ message, placeholder: "Press Enter", defaultValue: "" });
    handleCancel(value);
}

export async function promptName(): Promise<string | null> {
    if (!isInteractive()) return null;
    const value = await p.text({ message: "Save as", placeholder: "name, or Enter to skip", defaultValue: "" });
    handleCancel(value);
    const trimmed = (value as string).trim();
    return trimmed || null;
}

export async function selectFob(fobs: Fob[], message = "Select a tag"): Promise<string> {
    if (!isInteractive()) {
        p.log.error("Tag name must be provided as a CLI argument in non-interactive mode.");
        process.exit(1);
    }
    const value = await p.select({
        message,
        options: fobs.map((f) => ({
            value: f.name,
            label: f.name,
            hint: `${f.type} ${f.id}`,
        })),
    });
    handleCancel(value);
    return value as string;
}

export async function promptText(message: string, placeholder?: string): Promise<string> {
    if (!isInteractive()) {
        p.log.error(`"${message}" must be provided as a CLI argument in non-interactive mode.`);
        process.exit(1);
    }
    const value = await p.text({ message, placeholder });
    handleCancel(value);
    return value as string;
}
