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
 * Mock factory for ora — all spinner methods are no-ops that return `this`.
 */
export function mockOra() {
    vi.mock("ora", () => ({
        default: () => ({
            start: vi.fn().mockReturnThis(),
            succeed: vi.fn().mockReturnThis(),
            fail: vi.fn().mockReturnThis(),
            warn: vi.fn().mockReturnThis(),
            text: "",
        }),
    }));
}

/**
 * Standard beforeEach: reset mocks + silence console.log.
 * Call this inside your beforeEach or at module level.
 */
export function setupBeforeEach() {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
}

/**
 * Collect everything printed via console.log into a single string.
 */
export function getOutput(): string {
    return (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join("\n");
}
