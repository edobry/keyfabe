import * as p from "@clack/prompts";
import type { Fob } from "./store.js";

function handleCancel(value: unknown): asserts value is string | boolean {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
    }
}

export async function confirm(message: string): Promise<boolean> {
    const value = await p.confirm({ message });
    handleCancel(value);
    return value as boolean;
}

export async function waitForEnter(message: string): Promise<void> {
    const value = await p.text({ message, placeholder: "Press Enter", defaultValue: "" });
    handleCancel(value);
}

export async function promptName(): Promise<string | null> {
    const value = await p.text({ message: "Save as", placeholder: "name, or Enter to skip", defaultValue: "" });
    handleCancel(value);
    const trimmed = (value as string).trim();
    return trimmed || null;
}

export async function selectFob(fobs: Fob[], message = "Select a tag"): Promise<string> {
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
