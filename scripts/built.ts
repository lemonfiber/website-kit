/**
 * `dist/` is what a site runs, and it is committed, because a site installs
 * this repository by commit with its install scripts off. This builds it again
 * into a scratch directory and refuses a committed `dist/` that differs, naming
 * each file, so the code a site runs is the code reviewed here.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const COMMITTED = join(ROOT, "dist");
const scratch = mkdtempSync(join(tmpdir(), "website-kit-built-"));

const built = spawnSync(
  process.execPath,
  [
    join(ROOT, "node_modules/typescript/bin/tsc"),
    "-p",
    join(ROOT, "tsconfig.build.json"),
    "--outDir",
    scratch,
  ],
  { stdio: "inherit" },
);
if (built.status !== 0) {
  rmSync(scratch, { recursive: true, force: true });
  console.error("built: the build failed, so dist/ could not be compared");
  process.exit(1);
}

const files = (dir: string): string[] => {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
      .sort();
  } catch {
    return [];
  }
};

const want = files(scratch);
const have = new Set(files(COMMITTED));
const differ: string[] = [];
for (const path of want) {
  if (!have.has(path)) differ.push(`${path}: not committed`);
  else if (
    readFileSync(join(scratch, path), "utf8") !==
    readFileSync(join(COMMITTED, path), "utf8")
  )
    differ.push(`${path}: differs from what the source builds`);
  have.delete(path);
}
for (const path of have)
  differ.push(`${path}: nothing in the source builds it`);
rmSync(scratch, { recursive: true, force: true });

if (differ.length > 0) {
  console.error(`built: dist/ is not what the source builds\n`);
  for (const one of differ) console.error(`  dist/${one}`);
  console.error("\nRun `npm run build` and commit dist/.");
  process.exit(1);
}
console.log(
  `built: dist/ is what the source builds (${String(want.length)} files)`,
);
