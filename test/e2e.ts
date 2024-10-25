import { execaCommand } from "execa";
import { resolve } from "node:path";

export async function run(pluginCommand) {
  return await execaCommand(`${resolve("bin", "run")} ${pluginCommand}`);
}
