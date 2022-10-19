import execa from "execa";
import { resolve } from "node:path";

export async function run(pluginCommand) {
  return await execa.command(`${resolve("bin", "run")} ${pluginCommand}`);
}
