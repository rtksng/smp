/* global console, process */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectTestFiles(path);
      }

      return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
    })
  );

  return files.flat();
}

const files = (await collectTestFiles(join(process.cwd(), "test")))
  .map((file) => relative(process.cwd(), file))
  .sort();

if (files.length === 0) {
  console.error("No worker test files were found.");
  process.exit(1);
}

const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const child = spawn(
  process.execPath,
  [tsxCli, "--tsconfig", "tsconfig.json", "--test", ...files],
  {
    stdio: "inherit"
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
