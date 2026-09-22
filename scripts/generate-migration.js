import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

let name = await readline.question("Migration name: ");
readline.close();

name = name.trim().replaceAll(" ", "_").toLowerCase();
console.log(`Using migration name: ${name}`);

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["exec", "drizzle-kit", "generate", "--name", name],
  {
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
