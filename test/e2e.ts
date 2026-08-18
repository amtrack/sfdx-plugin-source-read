import { execa, parseCommandString } from "execa";
import { resolve } from "node:path";

export async function run(pluginCommand) {
  return await execa(
    resolve("bin", "run.js"),
    parseCommandString(pluginCommand)
  );
}

export async function runJson<T = unknown>(pluginCommand: string): Promise<T> {
  const { stdout } = await execa(
    resolve("bin", "run.js"),
    parseCommandString(`${pluginCommand} --json`)
  );
  return JSON.parse(stdout).result as T;
}
