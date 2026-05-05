import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs/checkpoints");

function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR);
    console.log("Created docs directory");
  }
}

function getKapterModules() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith("kapter-")
    )
    .map((entry) => entry.name);
}

function syncFile(moduleName, fileName) {
  const sourcePath = path.join(ROOT, moduleName, fileName);

  if (!fs.existsSync(sourcePath)) return;

  const cleanName = moduleName.replace("kapter-", "");
  const targetName = `${fileName.replace(".md", "")}-${cleanName}.md`;
  const targetPath = path.join(DOCS_DIR, targetName);

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Synced ${moduleName}/${fileName}`);
}

function main() {
  ensureDocsDir();

  const modules = getKapterModules();

  for (const module of modules) {
    syncFile(module, "checkpoint.md");
    syncFile(module, "INSTRUCTION.md");
  }

  console.log("Done syncing.");
}

main();