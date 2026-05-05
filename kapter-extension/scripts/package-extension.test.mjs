import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";

import { createExtensionArchive } from "./package-extension.mjs";

test("createExtensionArchive packages dist under a dist/ directory", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "kapter-extension-package-"),
  );
  const projectRoot = path.join(tempRoot, "project");
  const distPath = path.join(projectRoot, "dist");
  const artifactsPath = path.join(projectRoot, "artifacts");
  const packageJsonPath = path.join(projectRoot, "package.json");

  fs.mkdirSync(distPath, { recursive: true });
  fs.writeFileSync(
    path.join(distPath, "manifest.json"),
    '{"manifest_version":3}',
    "utf8",
  );
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ version: "1.2.3" }),
    "utf8",
  );

  const archivePath = await createExtensionArchive({
    projectRoot,
    distPath,
    artifactsPath,
    packageJsonPath,
  });
  const archive = new AdmZip(archivePath);
  const entryNames = archive.getEntries().map((entry) => entry.entryName);

  assert.equal(path.basename(archivePath), "kapter-extension-1.2.3.zip");
  assert.equal(fs.existsSync(archivePath), true);
  assert.equal(entryNames.includes("dist/manifest.json"), true);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
