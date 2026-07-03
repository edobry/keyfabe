import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClack, mockPm3Module, setupBeforeEach } from "../helpers/mocks.js";

mockPm3Module();
mockClack();

vi.mock("../../src/lib/card-ops.js", () => ({
    searchCardWithDiagnosis: vi.fn(),
    probeMifareDataFidelity: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
    loadTags: vi.fn().mockResolvedValue([]),
}));

import * as p from "@clack/prompts";
import { identify } from "../../src/commands/identify.js";
import { probeMifareDataFidelity, searchCardWithDiagnosis } from "../../src/lib/card-ops.js";
import { Pm3Error, requireDevice } from "../../src/lib/pm3.js";
import { loadTags } from "../../src/lib/store.js";

const mockSearch = vi.mocked(searchCardWithDiagnosis);
const mockProbe = vi.mocked(probeMifareDataFidelity);
const mockRequireDevice = vi.mocked(requireDevice);
const mockLoadTags = vi.mocked(loadTags);
const mockNote = vi.mocked(p.note);
const mockLogWarn = vi.mocked(p.log.warn);
const mockLogSuccess = vi.mocked(p.log.success);
const MockPm3Error = Pm3Error as any;

const mifareTag = {
    name: "494 laundry",
    type: "MIFARE Classic 1K",
    id: "815498C5",
    dumpFile: "/home/u/hf-mf-815498C5-current-dump.bin",
    savedAt: "2026-02-14",
};

beforeEach(() => {
    setupBeforeEach();
    mockRequireDevice.mockResolvedValue(true);
    mockLoadTags.mockResolvedValue([]);
});

describe("identify", () => {
    it("no device → false, does not read", async () => {
        mockRequireDevice.mockResolvedValueOnce(false);

        expect(await identify()).toBe(false);
        expect(mockSearch).not.toHaveBeenCalled();
    });

    it("no tag detected → false", async () => {
        mockSearch.mockResolvedValueOnce({ card: null, diagnosis: "none" });

        expect(await identify()).toBe(false);
        expect(mockProbe).not.toHaveBeenCalled();
    });

    it("LF card matching a saved identity → true, no MIFARE fidelity probe", async () => {
        mockSearch.mockResolvedValueOnce({
            card: { type: "EM410x", id: "040064DACA", encoding: "RF/64" },
            diagnosis: "none",
        });
        mockLoadTags.mockResolvedValueOnce([{ name: "mckibbin", type: "EM410x", id: "040064DACA", savedAt: "x" }]);

        expect(await identify()).toBe(true);
        expect(mockNote).toHaveBeenCalledWith(expect.stringContaining("mckibbin"), "Matches saved identity");
        expect(mockProbe).not.toHaveBeenCalled();
    });

    it("MIFARE full clone (custom keys) → true, reports real data", async () => {
        mockSearch.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "815498C5" },
            diagnosis: "none",
        });
        mockLoadTags.mockResolvedValueOnce([mifareTag]);
        mockProbe.mockResolvedValueOnce("custom-keys");

        expect(await identify()).toBe(true);
        expect(mockProbe).toHaveBeenCalled();
        expect(mockLogSuccess).toHaveBeenCalledWith(expect.stringContaining("custom keys"));
    });

    it("MIFARE UID-only clone (blank data) → true, warns it will be rejected", async () => {
        mockSearch.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "815498C5" },
            diagnosis: "none",
        });
        mockLoadTags.mockResolvedValueOnce([mifareTag]);
        mockProbe.mockResolvedValueOnce("blank-default");

        expect(await identify()).toBe(true);
        expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining("UID-only clone"));
    });

    it("no saved identity matches → true, warns unknown card", async () => {
        mockSearch.mockResolvedValueOnce({
            card: { type: "MIFARE Classic 1K", id: "13929131" },
            diagnosis: "none",
        });
        mockLoadTags.mockResolvedValueOnce([mifareTag]);
        mockProbe.mockResolvedValueOnce("blank-default");

        expect(await identify()).toBe(true);
        expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining("No saved identity matches"));
        expect(mockNote).not.toHaveBeenCalledWith(expect.anything(), "Matches saved identity");
    });

    it("pm3 error during read → false", async () => {
        mockSearch.mockRejectedValueOnce(new MockPm3Error("pm3 command not found", "", ""));

        expect(await identify()).toBe(false);
    });
});
