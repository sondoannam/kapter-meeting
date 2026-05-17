import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, "reports", "tests");
const logsDir = path.join(reportsDir, "logs", "latest");
const isCiMode = process.argv.includes("--ci") || process.env.CI === "true";

function commandName(base) {
  return base;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeLabel(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

function toPosixRelative(targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  return relativePath ? relativePath.split(path.sep).join("/") : ".";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return "n/a";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
}

function summarizeStatus(commandResults) {
  if (commandResults.length === 0) {
    return "not-run";
  }

  return commandResults.every((result) => result.status === "passed")
    ? "passed"
    : "failed";
}

function collectFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          "dist",
          "build",
          ".git",
          ".venv",
          ".pytest_cache",
          ".pytest-runs",
          ".test-dist",
        ].includes(entry.name)
      ) {
        continue;
      }

      collectFiles(entryPath, predicate, results);
      continue;
    }

    if (predicate(entryPath)) {
      results.push(entryPath);
    }
  }

  return results;
}

function countRegexMatches(text, expression) {
  const matches = text.match(expression);
  return matches ? matches.length : 0;
}

const nodeTestDeclarationPattern = /(?:^|[\s(;])(?:void\s+)?(?:it|test)\(/gm;

function discoverBackendInventory(moduleRoot) {
  const files = collectFiles(
    path.join(moduleRoot, "src"),
    (entryPath) => entryPath.endsWith(".spec.ts") || entryPath.endsWith(".test.ts"),
  );
  const caseCount = files.reduce((sum, filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    return sum + countRegexMatches(content, nodeTestDeclarationPattern);
  }, 0);

  return {
    testFileCount: files.length,
    testCaseCount: caseCount,
    runnerType: "node-test-compiled",
    notes:
      "Compiled Node test runner via kapter-backend/scripts/run-tests.mjs.",
  };
}

function discoverExtensionInventory(moduleRoot) {
  const files = collectFiles(
    moduleRoot,
    (entryPath) =>
      entryPath.endsWith(".spec.ts") ||
      entryPath.endsWith(".test.ts") ||
      entryPath.endsWith(".test.mjs"),
  );
  const caseCount = files.reduce((sum, filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    return sum + countRegexMatches(content, nodeTestDeclarationPattern);
  }, 0);

  return {
    testFileCount: files.length,
    testCaseCount: caseCount,
    runnerType: "node-test-direct",
    notes:
      "Direct Node test runner for the auth spec plus packaging verification.",
  };
}

function discoverWorkerInventory(moduleRoot) {
  const files = collectFiles(
    path.join(moduleRoot, "tests"),
    (entryPath) =>
      path.basename(entryPath).startsWith("test_") && entryPath.endsWith(".py"),
  );
  const caseCount = files.reduce((sum, filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    return sum + countRegexMatches(content, /^def test_/gm);
  }, 0);

  return {
    testFileCount: files.length,
    testCaseCount: caseCount,
    runnerType: "pytest-wrapper",
    notes:
      "Pytest regression and endpoint tests via kapter-ai-worker/scripts/run_tests.py.",
  };
}

function discoverWebappInventory() {
  return {
    testFileCount: 0,
    testCaseCount: 0,
    runnerType: "none",
    notes:
      "No automated frontend tests are configured; validation relies on lint, typecheck, build, and manual feature checks.",
  };
}

function resolveWorkerPython(root) {
  const candidates = process.platform === "win32"
    ? [
        path.join(root, "kapter-ai-worker", ".venv", "Scripts", "python.exe"),
        "python",
        "py",
      ]
    : [
        path.join(root, "kapter-ai-worker", ".venv", "bin", "python"),
        "python3",
        "python",
      ];

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    return candidate;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function tailExcerpt(output, maxLines = 40) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= maxLines) {
    return lines.join("\n");
  }

  return lines.slice(-maxLines).join("\n");
}

function createModuleConfigs() {
  const workerPython = resolveWorkerPython(rootDir);

  return [
    {
      id: "backend",
      name: "kapter-backend",
      cwd: path.join(rootDir, "kapter-backend"),
      validationPosture: "lint + typecheck + build + automated specs",
      ciNotes: "Backend CI enforces lint, typecheck, build, and test.",
      manualOnly: false,
      discoverInventory: discoverBackendInventory,
      commands: [
        {
          label: "lint",
          kind: "lint",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-backend", "lint"],
            cwd: rootDir,
          }),
        },
        {
          label: "typecheck",
          kind: "typecheck",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-backend", "typecheck"],
            cwd: rootDir,
          }),
        },
        {
          label: "build",
          kind: "build",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-backend", "build"],
            cwd: rootDir,
          }),
        },
        {
          label: "test",
          kind: "test",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-backend", "test"],
            cwd: rootDir,
          }),
        },
      ],
    },
    {
      id: "webapp",
      name: "kapter-webapp",
      cwd: path.join(rootDir, "kapter-webapp"),
      validationPosture:
        "lint + typecheck + build + manual feature validation",
      ciNotes: "Webapp CI enforces lint, typecheck, and build only.",
      manualOnly: true,
      discoverInventory: discoverWebappInventory,
      commands: [
        {
          label: "lint",
          kind: "lint",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-webapp", "lint"],
            cwd: rootDir,
          }),
        },
        {
          label: "typecheck",
          kind: "typecheck",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-webapp", "typecheck"],
            cwd: rootDir,
          }),
        },
        {
          label: "build",
          kind: "build",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-webapp", "build"],
            cwd: rootDir,
          }),
        },
      ],
    },
    {
      id: "extension",
      name: "kapter-extension",
      cwd: path.join(rootDir, "kapter-extension"),
      validationPosture:
        "lint + typecheck + build + auth spec + packaging test",
      ciNotes:
        "Extension CI enforces lint, typecheck, build, auth test, and packaging test.",
      manualOnly: false,
      discoverInventory: discoverExtensionInventory,
      commands: [
        {
          label: "lint",
          kind: "lint",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-extension", "lint"],
            cwd: rootDir,
          }),
        },
        {
          label: "typecheck",
          kind: "typecheck",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-extension", "typecheck"],
            cwd: rootDir,
          }),
        },
        {
          label: "build",
          kind: "build",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-extension", "build"],
            cwd: rootDir,
          }),
        },
        {
          label: "test",
          kind: "test",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-extension", "test"],
            cwd: rootDir,
          }),
        },
        {
          label: "test-package",
          kind: "test",
          ciEnforced: true,
          resolve: () => ({
            command: commandName("pnpm"),
            args: ["--filter", "./kapter-extension", "test:package"],
            cwd: rootDir,
          }),
        },
      ],
    },
    {
      id: "ai-worker",
      name: "kapter-ai-worker",
      cwd: path.join(rootDir, "kapter-ai-worker"),
      validationPosture: "automated pytest regressions and endpoint tests",
      ciNotes: "AI worker CI enforces the maintained pytest suite.",
      manualOnly: false,
      discoverInventory: discoverWorkerInventory,
      commands: [
        {
          label: "test",
          kind: "test",
          ciEnforced: true,
          resolve: () => ({
            command: workerPython,
            args: ["scripts/run_tests.py"],
            cwd: path.join(rootDir, "kapter-ai-worker"),
          }),
        },
      ],
    },
  ];
}

const workspaceCommands = [
  {
    label: "build-contracts",
    kind: "report-only",
    ciEnforced: true,
    resolve: () => ({
      command: commandName("pnpm"),
      args: ["--filter", "@kapter/contracts", "build"],
      cwd: rootDir,
    }),
  },
];

function spawnCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let child;

    try {
      child = spawn(command, args, {
        cwd,
        env: process.env,
        shell: process.platform === "win32",
      });
    } catch (error) {
      resolve({
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        stdout: "",
        stderr: String(error),
      });
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      resolve({
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}${stderr ? "\n" : ""}${String(error)}`,
      });
    });

    child.once("close", (code) => {
      resolve({
        status: code === 0 ? "passed" : "failed",
        exitCode: code,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

async function executeCommand(scopeId, commandConfig) {
  const resolved = commandConfig.resolve();
  const result = await spawnCommand(
    resolved.command,
    resolved.args,
    resolved.cwd,
  );
  const logPath = path.join(
    logsDir,
    `${sanitizeLabel(scopeId)}-${sanitizeLabel(commandConfig.label)}.log`,
  );
  const combinedOutput = [
    `$ ${resolved.command} ${resolved.args.join(" ")}`,
    result.stdout,
    result.stderr,
  ]
    .filter(Boolean)
    .join("\n\n");

  fs.writeFileSync(logPath, combinedOutput, "utf8");

  return {
    label: commandConfig.label,
    kind: commandConfig.kind,
    status: result.status,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    ciEnforced: commandConfig.ciEnforced,
    cwd: toPosixRelative(resolved.cwd),
    command: `${resolved.command} ${resolved.args.join(" ")}`,
    logPath: toPosixRelative(logPath),
    excerpt: tailExcerpt([result.stdout, result.stderr].filter(Boolean).join("\n")),
  };
}

async function readGitMetadata() {
  async function execGit(args) {
    const result = await spawnCommand(commandName("git"), args, rootDir);
    return result.status === "passed" ? result.stdout.trim() : null;
  }

  return {
    branch: await execGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    commitSha: await execGit(["rev-parse", "HEAD"]),
  };
}

function buildGapFlags(moduleConfig, inventory) {
  const flags = [];
  const testCommands = moduleConfig.commands.filter((command) => command.kind === "test");

  if (inventory.testFileCount === 0) {
    flags.push("no automated tests");
  }

  if (inventory.testFileCount > 0 && testCommands.length === 0) {
    flags.push("exists but not wired");
  }

  if (
    inventory.testFileCount > 0 &&
    testCommands.length > 0 &&
    testCommands.some((command) => !command.ciEnforced)
  ) {
    flags.push("CI disabled");
  }

  if (moduleConfig.manualOnly) {
    flags.push("manual-only");
  }

  return flags;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Test Validation Report");
  lines.push("");
  lines.push(
    `Generated: ${report.run.generatedAt} | Mode: ${report.run.mode} | Branch: ${report.git.branch ?? "unknown"} | Commit: ${report.git.commitSha ?? "unknown"}`,
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Module | Status | Automated Tests | Inventory | Gaps |");
  lines.push("| --- | --- | --- | --- | --- |");

  for (const module of report.modules) {
    lines.push(
      `| ${module.name} | ${module.summary.status} | ${
        module.summary.automatedTestPresence ? "yes" : "no"
      } | ${module.inventory.testFileCount} files / ${module.inventory.testCaseCount} cases | ${
        module.summary.gapFlags.length > 0
          ? module.summary.gapFlags.join(", ")
          : "none"
      } |`,
    );
  }

  if (report.workspace.commands.length > 0) {
    lines.push("");
    lines.push("## Workspace Preconditions");
    lines.push("");
    for (const command of report.workspace.commands) {
      lines.push(
        `- \`${command.label}\`: ${command.status} (${formatDuration(command.durationMs)})`,
      );
      lines.push(`  Command: \`${command.command}\``);
      lines.push(`  Log: \`${command.logPath}\``);
    }
  }

  lines.push("");
  lines.push("## Module Details");
  lines.push("");

  for (const module of report.modules) {
    lines.push(`### ${module.name}`);
    lines.push("");
    lines.push(`- Validation posture: ${module.validationPosture}`);
    lines.push(
      `- Inventory: ${module.inventory.testFileCount} files / ${module.inventory.testCaseCount} cases (${module.inventory.runnerType})`,
    );
    lines.push(`- Notes: ${module.inventory.notes}`);
    lines.push(`- CI: ${module.ciNotes}`);
    lines.push(
      `- Gaps: ${module.summary.gapFlags.length > 0 ? module.summary.gapFlags.join(", ") : "none"}`,
    );
    lines.push("");
    lines.push("| Command | Kind | Status | CI | Duration |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const command of module.commands) {
      lines.push(
        `| ${command.label} | ${command.kind} | ${command.status} | ${
          command.ciEnforced ? "enforced" : "not enforced"
        } | ${formatDuration(command.durationMs)} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderHtml(report) {
  const moduleCards = report.modules
    .map((module) => {
      const commandRows = module.commands
        .map(
          (command) => `
            <tr>
              <td>${escapeHtml(command.label)}</td>
              <td>${escapeHtml(command.kind)}</td>
              <td class="${escapeHtml(command.status)}">${escapeHtml(command.status)}</td>
              <td>${command.ciEnforced ? "enforced" : "not enforced"}</td>
              <td>${escapeHtml(formatDuration(command.durationMs))}</td>
            </tr>`,
        )
        .join("");

      const gapFlags =
        module.summary.gapFlags.length > 0
          ? module.summary.gapFlags.map((flag) => `<span class="flag">${escapeHtml(flag)}</span>`).join(" ")
          : '<span class="flag ok">none</span>';

      return `
        <section class="card">
          <h2>${escapeHtml(module.name)}</h2>
          <p><strong>Status:</strong> <span class="${escapeHtml(module.summary.status)}">${escapeHtml(module.summary.status)}</span></p>
          <p><strong>Validation posture:</strong> ${escapeHtml(module.validationPosture)}</p>
          <p><strong>Inventory:</strong> ${module.inventory.testFileCount} files / ${module.inventory.testCaseCount} cases (${escapeHtml(module.inventory.runnerType)})</p>
          <p><strong>Notes:</strong> ${escapeHtml(module.inventory.notes)}</p>
          <p><strong>CI:</strong> ${escapeHtml(module.ciNotes)}</p>
          <div class="flags">${gapFlags}</div>
          <table>
            <thead>
              <tr>
                <th>Command</th>
                <th>Kind</th>
                <th>Status</th>
                <th>CI</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>${commandRows}</tbody>
          </table>
        </section>`;
    })
    .join("");

  const workspaceItems = report.workspace.commands
    .map(
      (command) => `
        <li>
          <strong>${escapeHtml(command.label)}</strong>:
          <span class="${escapeHtml(command.status)}">${escapeHtml(command.status)}</span>
          (${escapeHtml(formatDuration(command.durationMs))})
        </li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kapter Test Validation Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --card: #fffdf7;
        --text: #1f2933;
        --muted: #56606b;
        --border: #d8d2c4;
        --passed: #1f7a47;
        --failed: #b54708;
        --flag: #efe6d1;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background: linear-gradient(180deg, #ece6d8 0%, var(--bg) 100%);
        color: var(--text);
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      h1, h2 { margin: 0 0 12px; }
      p, li { color: var(--muted); line-height: 1.5; }
      .meta {
        margin-bottom: 24px;
        padding: 16px 18px;
        background: rgba(255, 253, 247, 0.86);
        border: 1px solid var(--border);
        border-radius: 16px;
      }
      .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 12px 24px rgba(31, 41, 51, 0.06);
      }
      .flags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0 16px;
      }
      .flag {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--flag);
        color: var(--text);
        font-size: 13px;
      }
      .flag.ok {
        background: #ddeee3;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      th, td {
        padding: 10px 8px;
        border-top: 1px solid var(--border);
        text-align: left;
      }
      th { color: var(--muted); }
      .passed { color: var(--passed); font-weight: 600; }
      .failed { color: var(--failed); font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <section class="meta">
        <h1>Kapter Test Validation Report</h1>
        <p>Generated: ${escapeHtml(report.run.generatedAt)}</p>
        <p>Mode: ${escapeHtml(report.run.mode)} | Branch: ${escapeHtml(report.git.branch ?? "unknown")} | Commit: ${escapeHtml(report.git.commitSha ?? "unknown")}</p>
        ${
          report.workspace.commands.length > 0
            ? `<h2>Workspace Preconditions</h2><ul>${workspaceItems}</ul>`
            : ""
        }
      </section>
      <section class="grid">
        ${moduleCards}
      </section>
    </main>
  </body>
</html>`;
}

async function main() {
  ensureDirectory(logsDir);

  const git = await readGitMetadata();
  const moduleConfigs = createModuleConfigs();

  const workspaceResults = [];
  for (const commandConfig of workspaceCommands) {
    workspaceResults.push(await executeCommand("workspace", commandConfig));
  }

  const modules = [];
  for (const moduleConfig of moduleConfigs) {
    const inventory = moduleConfig.discoverInventory(moduleConfig.cwd);
    const gapFlags = buildGapFlags(moduleConfig, inventory);
    const commandResults = [];

    for (const commandConfig of moduleConfig.commands) {
      commandResults.push(await executeCommand(moduleConfig.id, commandConfig));
    }

    modules.push({
      id: moduleConfig.id,
      name: moduleConfig.name,
      validationPosture: moduleConfig.validationPosture,
      ciNotes: moduleConfig.ciNotes,
      inventory,
      summary: {
        automatedTestPresence: inventory.testFileCount > 0,
        gapFlags,
        status: summarizeStatus(commandResults),
      },
      commands: commandResults,
    });
  }

  const report = {
    run: {
      generatedAt: new Date().toISOString(),
      mode: isCiMode ? "ci" : "local",
      host: process.platform,
    },
    git,
    workspace: {
      commands: workspaceResults,
    },
    modules,
    summary: {
      status:
        workspaceResults.every((command) => command.status === "passed") &&
        modules.every((module) => module.summary.status === "passed")
          ? "passed"
          : "failed",
      moduleCount: modules.length,
      failedCommands:
        workspaceResults.filter((command) => command.status !== "passed").length +
        modules.reduce(
          (sum, module) =>
            sum +
            module.commands.filter((command) => command.status !== "passed").length,
          0,
        ),
    },
  };

  ensureDirectory(reportsDir);
  fs.writeFileSync(
    path.join(reportsDir, "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(reportsDir, "latest.md"), renderMarkdown(report), "utf8");
  fs.writeFileSync(path.join(reportsDir, "latest.html"), renderHtml(report), "utf8");

  if (report.summary.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
