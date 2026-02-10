#!/usr/bin/env node
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

program.name("keyfabe").description("CLI tool for Proxmark3 keyfob cloning").version("0.1.0");

program
    .command("doctor")
    .description("Check device connection, firmware, and antenna health")
    .action(withExitCode(doctor));

program.command("read").description("Read and identify a fob on the antenna").action(withExitCode(read));

program.command("clone").description("Interactive guided clone flow (read + write)").action(withExitCode(clone));

program
    .command("write")
    .description("Write a previously-saved identity to a blank fob")
    .argument("<name>", "name of the saved fob identity")
    .action(withExitCode(write));

program
    .command("list")
    .description("List all saved fob identities")
    .option("--json", "output as JSON")
    .action(withExitCode(list));

program
    .command("show")
    .description("Show details of a saved fob identity")
    .argument("<name>", "name of the saved fob identity")
    .action(withExitCode(show));

program
    .command("rename")
    .description("Rename a saved fob identity")
    .argument("<old-name>", "current name")
    .argument("<new-name>", "new name")
    .action(withExitCode(rename));

program
    .command("delete")
    .description("Delete a saved fob identity")
    .argument("<name>", "name of the saved fob identity")
    .action(withExitCode(deleteFob));

program.command("export").description("Export all saved fob identities as JSON").action(withExitCode(exportFobs));

program
    .command("import")
    .description("Import fob identities from a JSON file")
    .argument("<file>", "path to JSON file")
    .action(withExitCode(importFile));

program.command("setup").description("Flash Iceman firmware to a stock Proxmark3 Easy").action(withExitCode(setup));

program.parse();
