import * as p from "@clack/prompts";
import { loadDumpFile, locateDumpFile, sectorKeyA, sectorOf } from "../lib/mf-data.js";
import { readValueBlock, type ValueOp, writeValueBlock } from "../lib/mf-ops.js";
import { requireDevice } from "../lib/pm3.js";
import { confirm } from "../lib/prompts.js";
import { getTag } from "../lib/store.js";

export interface ValueOptions {
    block?: string;
    get?: boolean;
    set?: string;
    inc?: string;
    dec?: string;
    key?: string;
}

function formatValue(v: number): string {
    return `${v} (= $${(v / 100).toFixed(2)} if cents)`;
}

/** Resolve the sector key for a block: an explicit --key, else Key A from a saved identity's dump. */
async function resolveKey(name: string | undefined, block: number, explicitKey?: string): Promise<string | null> {
    if (explicitKey) return explicitKey.toUpperCase();
    if (!name) return null;
    const tag = await getTag(name);
    if (!tag?.dumpFile) return null;
    const dumpPath = await locateDumpFile(tag.id, tag.dumpFile);
    if (!dumpPath) return null;
    try {
        const dump = await loadDumpFile(dumpPath);
        return sectorKeyA(dump, sectorOf(block));
    } catch {
        return null;
    }
}

export async function value(name?: string, options: ValueOptions = {}): Promise<boolean> {
    p.intro("Value Block");

    const writeOps = (["set", "inc", "dec"] as const).filter((k) => options[k] !== undefined);
    if (writeOps.length > 1) {
        p.log.error("Choose only one of --set, --inc, or --dec.");
        return false;
    }
    const op = writeOps[0] as ValueOp | undefined;

    if (options.block === undefined) {
        p.log.error("Specify the value block with --block <n>.");
        return false;
    }
    const block = Number(options.block);
    if (!Number.isInteger(block) || block < 0) {
        p.log.error(`Invalid block number: ${options.block}`);
        return false;
    }

    let amount = 0;
    if (op) {
        amount = Number(options[op]);
        if (!Number.isInteger(amount)) {
            p.log.error(`Invalid value for --${op}: ${options[op]}`);
            return false;
        }
    }

    const key = await resolveKey(name, block, options.key);
    if (!key) {
        p.log.error("No key available. Pass --key <hex>, or name a saved MIFARE identity that has a full dump.");
        return false;
    }

    if (!(await requireDevice())) return false;

    if (!op) {
        const current = await readValueBlock(block, key);
        if (current === null) {
            p.log.error(`Could not read a value block at block ${block} with that key.`);
            return false;
        }
        p.log.info(`Block ${block}: ${formatValue(current)}`);
        p.outro("Done.");
        return true;
    }

    p.log.warn("This writes a balance directly onto the card on the antenna.");
    p.log.warn(
        "Only meaningful on a card you own — systems with server reconciliation or a MAC/counter may reject or revert it.",
    );

    const before = await readValueBlock(block, key);
    if (before !== null) p.log.info(`Current block ${block}: ${formatValue(before)}`);

    const proceed = await confirm(`${op} block ${block} ${op === "set" ? "to" : "by"} ${amount}?`);
    if (!proceed) {
        p.cancel("Aborted — card unchanged.");
        return false;
    }

    const spinner = p.spinner();
    spinner.start("Writing value block...");
    const ok = await writeValueBlock(block, key, op, amount);
    if (!ok) {
        spinner.stop("Write reported failure.");
        p.log.error("pm3 did not confirm the value write. Make sure the right card is on the antenna.");
        return false;
    }
    spinner.stop("Value block written");

    const after = await readValueBlock(block, key);
    if (after === null) {
        p.log.warn("Wrote the value, but could not read it back to confirm.");
        return true;
    }
    p.log.success(`Block ${block} is now ${formatValue(after)}.`);
    p.outro("Done.");
    return true;
}
