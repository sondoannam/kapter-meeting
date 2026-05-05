import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AdmZip from "adm-zip";

export async function createExtensionArchive({
  projectRoot,
  distPath = path.join(projectRoot, "dist"),
  artifactsPath = path.join(projectRoot, "artifacts"),
  packageJsonPath = path.join(projectRoot, "package.json"),
} = {}) {
  if (!projectRoot) {
    throw new Error("projectRoot is required.");
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Build output was not found at '${distPath}'. Run 'pnpm build' before packaging.`,
    );
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const archiveName = `kapter-extension-${packageJson.version}.zip`;
  const archivePath = path.join(artifactsPath, archiveName);

  fs.mkdirSync(artifactsPath, { recursive: true });

  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, { force: true });
  }

  const archive = new AdmZip();
  archive.addLocalFolder(distPath, "dist");
  archive.writeZip(archivePath);

  return archivePath;
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
  const archivePath = await createExtensionArchive({ projectRoot });
  console.log(`Created extension archive: ${archivePath}`);
}
