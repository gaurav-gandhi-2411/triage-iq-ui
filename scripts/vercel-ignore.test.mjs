import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

/**
 * scripts/vercel-ignore.sh decides whether Vercel builds the Vite SPA (exit 1) or skips the
 * deployment (exit 0). A change that cannot alter `tsc -b && vite build` output (reports/,
 * scripts/, .github/, docs) is skipped; src/, public/, index.html, package*.json, vite/tsconfig
 * or vercel.json builds. On Vercel real clone (shallow, one branch, no origin/main, no previous
 * sha) it inspects the commits it did clone and only fails open when it cannot. Each test builds
 * a throwaway repo and runs the real script. Run: node --test scripts/vercel-ignore.test.mjs
 */

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "vercel-ignore.sh");
const ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...ENV },
  }).trim();
}

function commit(repo, rel, text) {
  const p = join(repo, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, text);
  git(repo, "add", rel);
  git(repo, "commit", "-q", "-m", `change ${rel}`);
  return git(repo, "rev-parse", "HEAD");
}

function run(repo, env = {}) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("VERCEL_")),
  );
  const r = spawnSync("sh", [join(repo, "scripts", "vercel-ignore.sh")], {
    cwd: repo,
    env: { ...clean, ...env },
    encoding: "utf8",
  });
  assert.notEqual(r.status, null, r.stderr);
  return r.status;
}

function tmp() {
  return mkdtempSync(join(tmpdir(), "vignore-"));
}

/** Full (non-shallow) clone with a working origin; HEAD on branch `feature`. */
function fullRepo() {
  const root = tmp();
  const remote = join(root, "remote.git");
  git(root, "init", "-q", "--bare", "-b", "main", remote);
  const work = join(root, "work");
  git(root, "clone", "-q", remote, work);
  git(work, "checkout", "-q", "-b", "main");
  commit(work, "src/App.tsx", "v1");
  commit(work, "README.md", "r1");
  git(work, "push", "-q", "origin", "main");
  mkdirSync(join(work, "scripts"), { recursive: true });
  copyFileSync(SCRIPT, join(work, "scripts", "vercel-ignore.sh"));
  git(work, "checkout", "-q", "-b", "feature");
  return work;
}

/** The clone Vercel makes: --depth=N --branch feature, no origin/main, optionally no origin. */
function vercelClone(depth, keepOrigin, featureFiles) {
  const root = tmp();
  const remote = join(root, "remote.git");
  git(root, "init", "-q", "--bare", "-b", "main", remote);
  const seed = join(root, "seed");
  git(root, "clone", "-q", remote, seed);
  git(seed, "checkout", "-q", "-b", "main");
  commit(seed, "src/App.tsx", "v1");
  commit(seed, "README.md", "r1");
  commit(seed, "src/MainRecent.tsx", "a src change that landed on main just before the PR");
  git(seed, "push", "-q", "origin", "main");
  git(seed, "checkout", "-q", "-b", "feature");
  featureFiles.forEach((f, i) => commit(seed, f, `pr ${i}`));
  git(seed, "push", "-q", "origin", "feature");
  const clone = join(root, "vercel");
  git(root, "clone", "-q", `--depth=${depth}`, "--branch", "feature", pathToFileURL(remote).href, clone);
  assert.equal(git(clone, "rev-parse", "--is-shallow-repository"), "true");
  assert.equal(git(clone, "branch", "-r", "--list", "origin/main"), "");
  mkdirSync(join(clone, "scripts"), { recursive: true });
  copyFileSync(SCRIPT, join(clone, "scripts", "vercel-ignore.sh"));
  if (!keepOrigin) git(clone, "remote", "remove", "origin");
  return { clone, remoteUrl: pathToFileURL(remote).href };
}

test("a docs/reports/.github-only multi-commit PR is skipped", () => {
  const repo = fullRepo();
  commit(repo, "docs/a.md", "1");
  commit(repo, "reports/b.json", "2");
  commit(repo, ".github/workflows/x.yml", "3");
    assert.equal(run(repo), 0);
});

test("a scripts or screenshot-only change is skipped", () => {
  const repo = fullRepo();
  commit(repo, "scripts/gen-og-image.mjs", "1");
  commit(repo, "reports/screenshots/x/after.png", "2");
  commit(repo, "README.md", "3");
  assert.equal(run(repo), 0);
});

for (const rel of [
  "src/new/Page.tsx",
  "src/components/Card.tsx",
  "src/lib/metrics.ts",
  "index.html",
  "public/og.png",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
]) {
  test(`a change to ${rel} builds`, () => {
    const repo = fullRepo();
    commit(repo, rel, "x");
    assert.equal(run(repo), 1);
  });
}

test("a src change followed by a docs-only tip still builds (not just the last commit)", () => {
  const repo = fullRepo();
  commit(repo, "src/Dashboard.tsx", "new");
  commit(repo, "docs/notes.md", "tip is docs only");
  assert.equal(run(repo), 1);
});

test("a previous deployed sha lets a docs push after a built change skip", () => {
  const repo = fullRepo();
  const built = commit(repo, "src/Dashboard.tsx", "new");
  commit(repo, "docs/notes.md", "docs after the deployed commit");
  assert.equal(run(repo, { VERCEL_GIT_PREVIOUS_SHA: built }), 0);
});

test("a docs push on a repo with no usable base fails open when the clone is not shallow", () => {
  const repo = fullRepo();
  commit(repo, "docs/a.md", "1");
  git(repo, "remote", "remove", "origin");
  git(repo, "update-ref", "-d", "refs/remotes/origin/main");
  assert.equal(run(repo), 1);
});

test("shallow clone, origin fetchable: exact base, docs-only PR skipped", () => {
  const { clone } = vercelClone(2, true, ["docs/a.md", "docs/b.md"]);
  assert.equal(run(clone), 0);
});

test("shallow clone, no remote, docs-only window is skipped (the Vercel preview shape)", () => {
  const { clone } = vercelClone(3, false, ["docs/a.md", "docs/b.md"]);
  assert.equal(run(clone), 0);
});

test("shallow clone, no remote, src change in the PR builds", () => {
  const { clone } = vercelClone(3, false, ["docs/a.md", "src/New.tsx"]);
  assert.equal(run(clone), 1);
});

test("shallow clone, no remote, src change on main inside the window over-builds, never skips", () => {
  const { clone } = vercelClone(3, false, ["docs/a.md"]);
  assert.equal(run(clone), 1);
});

test("shallow clone, no origin, public URL gives an exact base and skips docs-only", () => {
  const { clone, remoteUrl } = vercelClone(3, false, ["docs/a.md"]);
  assert.equal(run(clone, { VERCEL_IGNORE_PUBLIC_URL: remoteUrl }), 0);
});

test("shallow clone, no origin, public URL base still builds a real src change", () => {
  const { clone, remoteUrl } = vercelClone(3, false, ["src/New.tsx"]);
  assert.equal(run(clone, { VERCEL_IGNORE_PUBLIC_URL: remoteUrl }), 1);
});

test("depth-1 clone has no window and fails open", () => {
  const { clone } = vercelClone(1, false, ["docs/a.md"]);
  assert.equal(run(clone), 1);
});

test("production never skips on the shallow-window guess", () => {
  const { clone } = vercelClone(3, false, ["docs/a.md", "docs/b.md"]);
  assert.equal(run(clone, { VERCEL_ENV: "production" }), 1);
});
