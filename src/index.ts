#!/usr/bin/env node
import { program } from "commander";
import { doctor } from "./commands/doctor.js";
import { read } from "./commands/read.js";
import { clone } from "./commands/clone.js";
import { write } from "./commands/write.js";
import { list } from "./commands/list.js";
import { setup } from "./commands/setup.js";

program
    .name("keyfabe")
    .description("CLI tool for Proxmark3 keyfob cloning")
    .version("0.1.0");

program.command("doctor")
    .description("Check device connection, firmware, and antenna health")
    .action(doctor);

program.command("read")
    .description("Read and identify a fob on the antenna")
    .action(read);

program.command("clone")
    .description("Interactive guided clone flow (read + write)")
    .action(clone);

program.command("write")
    .description("Write a previously-saved identity to a blank fob")
    .argument("<name>", "name of the saved fob identity")
    .action(write);

program.command("list")
    .description("List all saved fob identities")
    .action(list);

program.command("setup")
    .description("Flash Iceman firmware to a stock Proxmark3 Easy")
    .action(setup);

program.parse();
