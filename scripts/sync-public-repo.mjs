import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = resolveRepoRoot();

function printHelp() {
  console.log(
    `Usage: node scripts/sync-public-repo.mjs [--target <dir>]\n\n` +
      `Sync staged files from this repo to a separate public repo directory.\n\n` +
      `Configuration:\n` +
      `  1. Set target repo locally:\n` +
      `     git config --local kapter.publicRepoDir "C:/path/to/public-repo"\n` +
      `  2. Optional branch mapping settings:\n` +
      `     git config --local kapter.publicRepoBranchPrefix "sync/"\n` +
      `     git config --local kapter.publicRepoBaseBranch "main"\n` +
      `  2. Copy public-sync.config.example.json to public-sync.config.json\n` +
      `     and define which paths are allowed to sync.\n\n` +
      `Options:\n` +
      `  --target <dir>   Override the configured public repo directory for one run\n` +
      `  --help           Show this message\n`,
  );
}

function fail(message) {
  console.error(`[public-sync] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const stderr = String(result.stderr ?? "").trim();
    const detail = stderr ? `: ${stderr}` : "";
    fail(`${command} ${args.join(" ")} failed${detail}`);
  }

  return result.stdout;
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim(),
  };
}

function resolveRepoRoot() {
  const result = tryRun("git", ["rev-parse", "--show-toplevel"], {
    cwd: __dirname,
  });

  if (!result.ok || !result.stdout) {
    fail("Unable to resolve the current Git repository root.");
  }

  return path.resolve(result.stdout);
}

function parseArgs(argv) {
  const parsed = {
    target: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--target") {
      parsed.target = argv[index + 1] ?? "";
      if (!parsed.target) {
        fail("--target requires a directory path.");
      }
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function normalizeRelativePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function escapeForRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(glob) {
  let pattern = "";

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];

    if (char === "*") {
      if (next === "*") {
        const nextAfter = glob[index + 2];
        const isDirectoryWildcard = nextAfter === "/";
        pattern += isDirectoryWildcard ? "(?:.*/)?" : ".*";
        index += isDirectoryWildcard ? 2 : 1;
      } else {
        pattern += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      pattern += ".";
      continue;
    }

    pattern += escapeForRegExp(char);
  }

  return new RegExp(`^${pattern}$`);
}

function compilePatterns(patterns) {
  return patterns.map((pattern) => ({
    source: pattern,
    regex: globToRegExp(pattern),
  }));
}

function matchesAny(filePath, patterns) {
  return patterns.some(({ regex }) => regex.test(filePath));
}

async function loadConfig(rootDir, targetConfigured) {
  const configPath = path.join(rootDir, "public-sync.config.json");

  try {
    const configText = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(configText);
    const include = Array.isArray(parsed.include) ? parsed.include : [];
    const exclude = Array.isArray(parsed.exclude) ? parsed.exclude : [];

    if (include.length === 0) {
      fail(
        "public-sync.config.json must declare at least one include pattern.",
      );
    }

    return {
      include: compilePatterns(include.map(normalizeRelativePath)),
      exclude: compilePatterns(exclude.map(normalizeRelativePath)),
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      if (targetConfigured) {
        fail(
          "public-sync.config.json is missing. Copy public-sync.config.example.json and define an allowlist.",
        );
      }

      return null;
    }

    fail(`Failed to load public-sync.config.json: ${error.message}`);
  }
}

function resolveTargetRepo(rootDir, overrideTarget) {
  const configuredTarget =
    overrideTarget ||
    process.env.KAPTER_PUBLIC_REPO_DIR ||
    tryRun("git", ["config", "--local", "--get", "kapter.publicRepoDir"])
      .stdout;

  if (!configuredTarget) {
    console.log("[public-sync] No public repo configured; skipping.");
    return "";
  }

  const resolvedTarget = path.resolve(rootDir, configuredTarget);
  const root = path.resolve(rootDir);

  if (resolvedTarget === root) {
    fail("The public repo directory cannot point to the current private repo.");
  }

  const gitCheck = tryRun("git", ["rev-parse", "--show-toplevel"], {
    cwd: resolvedTarget,
  });

  if (!gitCheck.ok || !gitCheck.stdout) {
    fail(`Configured public repo is not a Git repository: ${resolvedTarget}`);
  }

  return path.resolve(gitCheck.stdout);
}

function getBranchName(cwd) {
  const branchName = tryRun("git", ["branch", "--show-current"], {
    cwd,
  }).stdout;

  if (branchName) {
    return branchName;
  }

  const shortSha = tryRun("git", ["rev-parse", "--short", "HEAD"], {
    cwd,
  }).stdout;
  if (shortSha) {
    return `detached-${shortSha}`;
  }

  fail(`Unable to determine current branch for repository: ${cwd}`);
}

function getRepoConfig(key, fallback = "") {
  return (
    process.env[key] ||
    tryRun("git", ["config", "--local", "--get", key], { cwd: repoRoot })
      .stdout ||
    fallback
  );
}

function branchExists(cwd, branchName) {
  return tryRun(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
    {
      cwd,
    },
  ).ok;
}

function getWorkingTreeStatus(cwd) {
  return tryRun("git", ["status", "--short"], { cwd }).stdout;
}

function resolvePublicBranchName() {
  const privateBranch = getBranchName(repoRoot);
  const branchPrefix =
    getRepoConfig("KAPTER_PUBLIC_REPO_BRANCH_PREFIX", "") ||
    getRepoConfig("kapter.publicRepoBranchPrefix", "sync/");

  return {
    privateBranch,
    publicBranch: `${branchPrefix}${privateBranch}`,
  };
}

function resolvePublicBaseBranch() {
  return (
    getRepoConfig("KAPTER_PUBLIC_REPO_BASE_BRANCH", "") ||
    getRepoConfig("kapter.publicRepoBaseBranch", "main")
  );
}

function ensureTargetBranch(targetRoot, targetBranch) {
  const currentTargetBranch = getBranchName(targetRoot);
  if (currentTargetBranch === targetBranch) {
    return;
  }

  const workingTreeStatus = getWorkingTreeStatus(targetRoot);
  if (workingTreeStatus) {
    fail(
      `Public repo has uncommitted changes on branch ${currentTargetBranch}. Commit or stash them before syncing to ${targetBranch}.`,
    );
  }

  if (branchExists(targetRoot, targetBranch)) {
    run("git", ["switch", targetBranch], { cwd: targetRoot });
    return;
  }

  const baseBranch = resolvePublicBaseBranch();
  if (
    branchExists(targetRoot, baseBranch) &&
    currentTargetBranch !== baseBranch
  ) {
    run("git", ["switch", baseBranch], { cwd: targetRoot });
  }

  if (branchExists(targetRoot, baseBranch)) {
    run("git", ["switch", "-c", targetBranch, baseBranch], { cwd: targetRoot });
    return;
  }

  run("git", ["switch", "-c", targetBranch], { cwd: targetRoot });
}

function parseStagedEntries(output) {
  const fields = output.split("\u0000").filter(Boolean);
  const entries = [];

  for (let index = 0; index < fields.length; ) {
    const statusToken = fields[index];
    const code = statusToken[0];
    index += 1;

    if (code === "R" || code === "C") {
      const from = fields[index];
      const to = fields[index + 1];
      index += 2;
      entries.push({ status: code, from, to });
      continue;
    }

    const filePath = fields[index];
    index += 1;
    entries.push({ status: code, path: filePath });
  }

  return entries;
}

function getStagedEntries() {
  const output = run("git", [
    "diff",
    "--cached",
    "--name-status",
    "-z",
    "--diff-filter=ACMRD",
  ]);

  return parseStagedEntries(output);
}

function shouldSync(filePath, config) {
  const normalizedPath = normalizeRelativePath(filePath);

  if (!matchesAny(normalizedPath, config.include)) {
    return false;
  }

  if (matchesAny(normalizedPath, config.exclude)) {
    return false;
  }

  return true;
}

function resolveTargetFile(targetRoot, relativePath) {
  const resolved = path.resolve(targetRoot, relativePath);
  const normalizedRoot = path.resolve(targetRoot);
  const expectedPrefix = `${normalizedRoot}${path.sep}`;

  if (resolved !== normalizedRoot && !resolved.startsWith(expectedPrefix)) {
    fail(`Refusing to write outside the public repo: ${relativePath}`);
  }

  return resolved;
}

function readBlobFromIndex(relativePath) {
  return run("git", ["show", `:${relativePath}`], {
    encoding: null,
  });
}

function stageTargetPath(targetRoot, relativePath, mode = "write") {
  const normalizedPath = normalizeRelativePath(relativePath);
  const args =
    mode === "delete"
      ? ["add", "-A", "--", normalizedPath]
      : ["add", "--", normalizedPath];

  run("git", args, { cwd: targetRoot });
}

async function writeTargetFile(targetRoot, relativePath) {
  const targetFile = resolveTargetFile(targetRoot, relativePath);
  const content = readBlobFromIndex(relativePath);

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, content);
  stageTargetPath(targetRoot, relativePath, "write");
}

async function removeTargetFile(targetRoot, relativePath) {
  const targetFile = resolveTargetFile(targetRoot, relativePath);
  await fs.rm(targetFile, { force: true });
  stageTargetPath(targetRoot, relativePath, "delete");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetRoot = resolveTargetRepo(repoRoot, args.target);

  if (!targetRoot) {
    return;
  }

  const { privateBranch, publicBranch } = resolvePublicBranchName();
  ensureTargetBranch(targetRoot, publicBranch);

  const config = await loadConfig(repoRoot, Boolean(targetRoot));
  if (!config) {
    return;
  }

  const stagedEntries = getStagedEntries();

  if (stagedEntries.length === 0) {
    console.log("[public-sync] No staged changes to sync.");
    return;
  }

  console.log(
    `[public-sync] Syncing private branch ${privateBranch} to public branch ${publicBranch}.`,
  );

  let copiedCount = 0;
  let deletedCount = 0;

  for (const entry of stagedEntries) {
    if (entry.status === "A" || entry.status === "M") {
      if (!shouldSync(entry.path, config)) {
        continue;
      }

      await writeTargetFile(targetRoot, entry.path);
      copiedCount += 1;
      continue;
    }

    if (entry.status === "D") {
      if (!shouldSync(entry.path, config)) {
        continue;
      }

      await removeTargetFile(targetRoot, entry.path);
      deletedCount += 1;
      continue;
    }

    if (entry.status === "R") {
      if (shouldSync(entry.from, config)) {
        await removeTargetFile(targetRoot, entry.from);
        deletedCount += 1;
      }

      if (shouldSync(entry.to, config)) {
        await writeTargetFile(targetRoot, entry.to);
        copiedCount += 1;
      }
      continue;
    }

    if (entry.status === "C") {
      if (!shouldSync(entry.to, config)) {
        continue;
      }

      await writeTargetFile(targetRoot, entry.to);
      copiedCount += 1;
    }
  }

  console.log(
    `[public-sync] Synced ${copiedCount} file(s), removed ${deletedCount} file(s).`,
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
