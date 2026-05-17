import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

const packageRoot = path.resolve(import.meta.dirname, "..");
const testDistDir = path.join(packageRoot, ".test-dist");
const testSrcDir = path.join(testDistDir, "src");
const testBootstrapFile = path.join(packageRoot, "scripts", "test-bootstrap.cjs");

function commandName(base) {
  return base;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} exited from signal ${signal}.`
            : `${command} exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

function collectSpecFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSpecFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".spec.js")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

async function main() {
  fs.rmSync(testDistDir, { recursive: true, force: true });

  await run(commandName("pnpm"), [
    "exec",
    "tsc",
    "-p",
    "tsconfig.test.json",
  ]);

  const specFiles = collectSpecFiles(testSrcDir);
  if (specFiles.length === 0) {
    throw new Error("No compiled backend spec files were found in .test-dist.");
  }

  const env = {
    ...process.env,
    NODE_PATH: [testDistDir, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
  };

  await run(
    process.execPath,
    [
      "--require",
      testBootstrapFile,
      "--test",
      "--test-concurrency=1",
      ...specFiles,
    ],
    { env },
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
