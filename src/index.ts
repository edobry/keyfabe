#!/usr/bin/env node
import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import { program } from "commander";
import { clone } from "./commands/clone.js";
import { deleteTag } from "./commands/delete.js";
import { doctor } from "./commands/doctor.js";
import { exportTags } from "./commands/export.js";
import { importFile } from "./commands/import.js";
import { inspect } from "./commands/inspect.js";
import { list } from "./commands/list.js";
import { read } from "./commands/read.js";
import { rename } from "./commands/rename.js";
import { repair } from "./commands/repair.js";
import { setup } from "./commands/setup.js";
import { show } from "./commands/show.js";
import { verify } from "./commands/verify.js";
import { write } from "./commands/write.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

function withExitCode(fn: (...args: any[]) => Promise<boolean>) {
    return async (...args: any[]) => {
        const ok = await fn(...args);
        if (!ok) process.exitCode = 1;
    };
}

program.name("keyfabe").description("CLI tool for Proxmark3 tag cloning").version(version);

program.action(
    withExitCode(async () => {
        if (!process.stdout.isTTY) {
            program.help();
            return true;
        }

        p.intro("keyfabe");

        const action = await p.select({
            message: "What would you like to do?",
            options: [
                { value: "clone", label: "Clone a tag", hint: "read + write + verify" },
                { value: "read", label: "Read a tag", hint: "identify and save" },
                { value: "write", label: "Write a saved identity", hint: "write to blank tag" },
                { value: "verify", label: "Verify a tag", hint: "compare to saved identity" },
                { value: "inspect", label: "Inspect tag data", hint: "decode value blocks (e.g. laundry balance)" },
                { value: "list", label: "List saved tags" },
                { value: "doctor", label: "Health check", hint: "diagnose device" },
                { value: "setup", label: "Firmware setup", hint: "flash Iceman firmware" },
            ],
        });

        if (p.isCancel(action)) {
            p.cancel("Goodbye!");
            return true;
        }

        switch (action) {
            case "clone":
                return clone();
            case "read":
                return read();
            case "write":
                return write();
            case "verify":
                return verify();
            case "inspect":
                return inspect();
            case "list":
                return list();
            case "doctor":
                return doctor();
            case "setup":
                return setup();
            default:
                return true;
        }
    }),
);

program
    .command("doctor")
    .description("Check device connection, firmware, and antenna health")
    .action(withExitCode(doctor));

program
    .command("read")
    .description("Read and identify a tag on the antenna")
    .option("--save-as <name>", "save the tag with this name")
    .action(withExitCode((opts: { saveAs?: string }) => read(opts)));

program
    .command("clone")
    .description("Interactive guided clone flow (read + write + verify)")
    .option("--save-as <name>", "save the cloned tag with this name")
    .action(withExitCode((opts: { saveAs?: string }) => clone(opts)));

program
    .command("write")
    .description("Write a previously-saved identity to a blank tag")
    .argument("[name]", "name of the saved tag identity")
    .action(withExitCode(write));

program
    .command("list")
    .description("List all saved tag identities")
    .option("--json", "output as JSON")
    .action(withExitCode(list));

program
    .command("show")
    .description("Show details of a saved tag identity")
    .argument("[name]", "name of the saved tag identity")
    .action(withExitCode(show));

program
    .command("rename")
    .description("Rename a saved tag identity")
    .argument("[old-name]", "current name")
    .argument("[new-name]", "new name")
    .action(withExitCode(rename));

program
    .command("delete")
    .description("Delete a saved tag identity")
    .argument("[name]", "name of the saved tag identity")
    .action(withExitCode(deleteTag));

program.command("export").description("Export all saved tag identities as JSON").action(withExitCode(exportTags));

program
    .command("import")
    .description("Import tag identities from a JSON file")
    .argument("<file>", "path to JSON file")
    .action(withExitCode(importFile));

program.command("setup").description("Flash Iceman firmware to a stock Proxmark3 Easy").action(withExitCode(setup));

program
    .command("verify")
    .description("Read a tag and compare it against a saved identity")
    .argument("[name]", "name of the saved tag identity")
    .action(withExitCode(verify));

program
    .command("repair")
    .description("Repair a bricked magic card with corrupted block 0 (bad BCC)")
    .action(withExitCode(repair));

program
    .command("inspect")
    .description("Decode the data on a saved MIFARE Classic tag's dump (value blocks, ASCII strings, hex)")
    .argument("[name]", "name of the saved tag identity")
    .action(withExitCode(inspect));

program.parse();
