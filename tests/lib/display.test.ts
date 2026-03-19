import { beforeEach, describe, expect, it } from "vitest";
import { mockClack, setupBeforeEach } from "../helpers/mocks.js";

mockClack();

import * as p from "@clack/prompts";
import { DetectionHint, WriteHint } from "../../src/lib/constants.js";
import {
    BREW_INSTALL_CMD,
    printBrewInstall,
    printCardInfo,
    printDetectionHint,
    printDoctorHint,
    printFrequencyMismatchHint,
    printFullCardCloneProgress,
    printNoSavedTags,
    printNotMagicHint,
    printTagNotFound,
} from "../../src/lib/display.js";

const mockNote = p.note as ReturnType<typeof import("vitest").vi.fn>;

beforeEach(() => {
    setupBeforeEach();
});

describe("printBrewInstall", () => {
    it("displays the brew install command via p.note", () => {
        printBrewInstall();
        expect(mockNote).toHaveBeenCalledWith(BREW_INSTALL_CMD, "Install Proxmark3 client");
    });
});

describe("printCardInfo", () => {
    it("displays type and ID", () => {
        printCardInfo({ type: "EM410x", id: "1A2B3C4D5E" });
        expect(mockNote).toHaveBeenCalledWith("Type:     EM410x\nID:       1A2B3C4D5E", "Card Info");
    });

    it("includes encoding when present", () => {
        printCardInfo({ type: "EM410x", id: "1A2B3C4D5E", encoding: "RF/64" });
        const content = (mockNote as ReturnType<typeof import("vitest").vi.fn>).mock.calls[0][0] as string;
        expect(content).toContain("Encoding: RF/64");
    });

    it("omits encoding line when not present", () => {
        printCardInfo({ type: "EM410x", id: "1A2B3C4D5E" });
        const content = (mockNote as ReturnType<typeof import("vitest").vi.fn>).mock.calls[0][0] as string;
        expect(content).not.toContain("Encoding");
    });
});

describe("printDoctorHint", () => {
    it("warns to run keyfabe doctor", () => {
        printDoctorHint();
        expect(p.log.warn).toHaveBeenCalledWith("Run `keyfabe doctor` to diagnose your setup.");
    });
});

describe("printNoSavedTags", () => {
    it("warns about no saved tags", () => {
        printNoSavedTags();
        expect(p.log.warn).toHaveBeenCalledWith("No saved tags. Use `keyfabe read` or `keyfabe clone` first.");
    });
});

describe("printTagNotFound", () => {
    it("logs error with tag name", () => {
        printTagNotFound("front-door");
        expect(p.log.error).toHaveBeenCalledWith(
            'No saved tag named "front-door". Use `keyfabe list` to see saved tags.',
        );
    });
});

describe("printDetectionHint", () => {
    it("warns with blank T55x7 hint", () => {
        printDetectionHint("blank_t55x7");
        expect(p.log.warn).toHaveBeenCalledWith(DetectionHint.blank_t55x7);
    });

    it("warns with bricked HF hint", () => {
        printDetectionHint("bricked_hf");
        expect(p.log.warn).toHaveBeenCalledWith(DetectionHint.bricked_hf);
    });

    it("warns with no detection hint", () => {
        printDetectionHint("none");
        expect(p.log.warn).toHaveBeenCalledWith(DetectionHint.none);
    });
});

describe("printNotMagicHint", () => {
    it("warns with not-magic card message", () => {
        printNotMagicHint();
        expect(p.log.warn).toHaveBeenCalledWith(WriteHint.not_magic);
    });
});

describe("printFrequencyMismatchHint", () => {
    it("warns about LF/HF mismatch when expected LF", () => {
        printFrequencyMismatchHint("LF");
        expect(p.log.warn).toHaveBeenCalledWith(WriteHint.wrong_freq_lf_got_hf);
    });
});

describe("printFullCardCloneProgress", () => {
    it("logs FM11RF08S timing info", () => {
        printFullCardCloneProgress("fm11rf08s");
        expect(p.log.info).toHaveBeenCalledWith("Using FM11RF08S recovery — this takes approximately 28 minutes.");
    });

    it("does not log for autopwn method", () => {
        printFullCardCloneProgress("autopwn");
        expect(p.log.info).not.toHaveBeenCalled();
    });
});
