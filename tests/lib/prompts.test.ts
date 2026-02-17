import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

import * as p from "@clack/prompts";
import { confirm, isInteractive, promptName, promptText, selectFob, waitForEnter } from "../../src/lib/prompts.js";

const mockText = vi.mocked(p.text);
const mockConfirm = vi.mocked(p.confirm);
const mockSelect = vi.mocked(p.select);
class ExitError extends Error {
    code: number;
    constructor(code: number) {
        super(`process.exit(${code})`);
        this.code = code;
    }
}

const mockExit = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new ExitError(code ?? 0);
});

let originalIsTTY: boolean | undefined;

beforeEach(() => {
    setupBeforeEach();
    originalIsTTY = process.stdin.isTTY;
    mockExit.mockClear();
});

afterEach(() => {
    process.stdin.isTTY = originalIsTTY;
});

describe("isInteractive", () => {
    it("returns true when stdin is a TTY", () => {
        process.stdin.isTTY = true;
        expect(isInteractive()).toBe(true);
    });

    it("returns false when stdin is not a TTY", () => {
        process.stdin.isTTY = undefined;
        expect(isInteractive()).toBe(false);
    });
});

describe("non-interactive mode", () => {
    beforeEach(() => {
        process.stdin.isTTY = undefined;
    });

    it("waitForEnter resolves immediately without calling p.text", async () => {
        await waitForEnter("Place your tag");
        expect(mockText).not.toHaveBeenCalled();
        expect(p.log.info).toHaveBeenCalledWith("Place your tag");
    });

    it("promptName returns null without calling p.text", async () => {
        const result = await promptName();
        expect(result).toBeNull();
        expect(mockText).not.toHaveBeenCalled();
    });

    it("confirm returns true without calling p.confirm", async () => {
        const result = await confirm("Are you sure?");
        expect(result).toBe(true);
        expect(mockConfirm).not.toHaveBeenCalled();
    });

    it("selectFob exits with code 1", async () => {
        const fobs = [{ name: "test", type: "EM410x" as const, id: "1234567890", savedAt: "2024-01-01" }];
        await expect(selectFob(fobs)).rejects.toThrow(ExitError);
        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it("promptText exits with code 1", async () => {
        await expect(promptText("New name", "e.g. front-door")).rejects.toThrow(ExitError);
        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockText).not.toHaveBeenCalled();
    });
});

describe("interactive mode", () => {
    beforeEach(() => {
        process.stdin.isTTY = true;
    });

    it("waitForEnter calls p.text", async () => {
        mockText.mockResolvedValue("");
        await waitForEnter("Place your tag");
        expect(mockText).toHaveBeenCalled();
    });

    it("promptName returns trimmed name from p.text", async () => {
        mockText.mockResolvedValue("  my-tag  ");
        const result = await promptName();
        expect(result).toBe("my-tag");
    });

    it("promptName returns null for empty input", async () => {
        mockText.mockResolvedValue("");
        const result = await promptName();
        expect(result).toBeNull();
    });

    it("confirm delegates to p.confirm", async () => {
        mockConfirm.mockResolvedValue(true);
        const result = await confirm("Are you sure?");
        expect(result).toBe(true);
        expect(mockConfirm).toHaveBeenCalledWith({ message: "Are you sure?" });
    });

    it("selectFob delegates to p.select", async () => {
        const fobs = [{ name: "test", type: "EM410x" as const, id: "1234567890", savedAt: "2024-01-01" }];
        mockSelect.mockResolvedValue("test");
        const result = await selectFob(fobs);
        expect(result).toBe("test");
        expect(mockSelect).toHaveBeenCalled();
    });

    it("promptText delegates to p.text", async () => {
        mockText.mockResolvedValue("new-name");
        const result = await promptText("New name", "e.g. front-door");
        expect(result).toBe("new-name");
        expect(mockText).toHaveBeenCalledWith({ message: "New name", placeholder: "e.g. front-door" });
    });
});
