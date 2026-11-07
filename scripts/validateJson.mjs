import { readFile } from "node:fs/promises";

// The parser imports Foundry application classes through the shared config.
// Validation itself does not access a world or create any documents.
globalThis.foundry = {
    applications: {api: {ApplicationV2: class {}, HandlebarsApplicationMixin: base => base}}
};
const {sbiJsonParser} = await import("./sbiJsonParser.js");
const files = process.argv.slice(2);
if (!files.length) {
    console.error("Usage: node scripts/validateJson.mjs <file.json> [file.json ...]");
    process.exitCode = 1;
}
for (const file of files) {
    try {
        const {actor} = sbiJsonParser.parseInput(await readFile(file, "utf8"));
        console.log(`${file}: valid (${actor.name})`);
    } catch (error) {
        console.error(`${file}: ${error.message}`);
        process.exitCode = 1;
    }
}
