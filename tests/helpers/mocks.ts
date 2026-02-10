import { vi } from "vitest";

/**
 * Mock factory for pm3.js — call vi.mock() with this before imports.
 * Includes pm3Exec, detectPort stubs and a working Pm3Error class.
 */
export function mockPm3Module() {
    vi.mock("../../src/lib/pm3.js", () => ({
        pm3Exec: vi.fn(),
        detectPort: vi.fn(),
        requireDevice: vi.fn().mockResolvedValue(true),
        Pm3Error: class Pm3Error extends Error {
            stdout: string;
            stderr: string;
            constructor(message: string, stdout: string, stderr: string) {
                super(message);
                this.name = "Pm3Error";
                this.stdout = stdout;
                this.stderr = stderr;
            }
        },
    }));
}

/**
 * Mock factory for @clack/prompts — quiet no-ops.
 * Interactive prompts (select/text/confirm) are vi.fn() stubs that tests
 * configure with mockResolvedValue. Display functions are silenced.
 */
export function mockClack() {
    vi.mock("@clack/prompts", () => ({
        intro: vi.fn(),
        outro: vi.fn(),
        cancel: vi.fn(),
        isCancel: vi.fn().mockReturnValue(false),
        spinner: vi.fn().mockReturnValue({
            start: vi.fn(),
            stop: vi.fn(),
            error: vi.fn(),
            message: vi.fn(),
        }),
        text: vi.fn(),
        confirm: vi.fn(),
        select: vi.fn(),
        note: vi.fn(),
        log: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            success: vi.fn(),
            step: vi.fn(),
            message: vi.fn(),
        },
    }));
}

/**
 * Standard beforeEach: clear mock call history + silence console.log.
 */
export function setupBeforeEach() {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
}

/**
 * Collect everything printed via console.log into a single string.
 * Use only for tests that need raw stdout (e.g., --json output).
 */
export function getOutput(): string {
    return (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join("\n");
}
