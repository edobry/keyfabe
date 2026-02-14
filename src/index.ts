#!/usr/bin/env node
import * as p from "@clack/prompts";
import { program } from "commander";
import { clone } from "./commands/clone.js";
import { deleteFob } from "./commands/delete.js";
import { doctor } from "./commands/doctor.js";
import { exportFobs } from "./commands/export.js";
import { importFile } from "./commands/import.js";
import { list } from "./commands/list.js";
import { read } from "./commands/read.js";
import { rename } from "./commands/rename.js";
import { setup } from "./commands/setup.js";
import { show } from "./commands/show.js";
import { write } from "./commands/write.js";

function withExitCode(fn: (...args: any[]) => Promise<boolean>) {
    return async (...args: any[]) => {
        const ok = await fn(...args);
        if (!ok) process.exitCode = 1;
    };
}

program.name("keyfabe").description("CLI tool for Proxmark3 tag cloning").version("0.1.0");

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

program.command("read").description("Read and identify a tag on the antenna").action(withExitCode(read));

program
    .command("clone")
    .description("Interactive guided clone flow (read + write + verify)")
    .action(withExitCode(clone));

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
    .action(withExitCode(deleteFob));

program.command("export").description("Export all saved tag identities as JSON").action(withExitCode(exportFobs));

program
    .command("import")
    .description("Import tag identities from a JSON file")
    .argument("<file>", "path to JSON file")
    .action(withExitCode(importFile));

program.command("setup").description("Flash Iceman firmware to a stock Proxmark3 Easy").action(withExitCode(setup));

program.parse();
