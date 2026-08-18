import { execa, parseCommandString } from "execa";
import { resolve } from "node:path";

export async function run(pluginCommand) {
  return await execa(
    resolve("bin", "run.js"),
    parseCommandString(pluginCommand)
  );
}
