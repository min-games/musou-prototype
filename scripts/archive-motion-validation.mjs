// Preserve pre-existing evidence while retaining exact candidate suite reports.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  rmSync,
} from "node:fs";
import { dirname } from "node:path";
const root = "evidence/weapon-motion-v1",
  temp = "/tmp/weapon-motion-evidence-baseline";
const tag = process.argv[3] || "full-suite";
const suffix = tag === "full-suite" ? "weapon-motion" : "weapon-motion-final";
const files = execFileSync("git", ["ls-files", "-z", "evidence"])
  .toString()
  .split("\0")
  .filter(Boolean)
  .filter((p) => !p.startsWith(root + "/"));
if (process.argv[2] === "before") {
  for (const p of files) {
    mkdirSync(dirname(`${temp}/${p}`), { recursive: true });
    writeFileSync(`${temp}/${p}`, readFileSync(p));
  }
  writeFileSync(`${temp}/files.json`, JSON.stringify(files));
} else {
  const changed = [];
  for (const p of JSON.parse(readFileSync(`${temp}/files.json`, "utf8"))) {
    const old = readFileSync(`${temp}/${p}`);
    if (!existsSync(p) || !readFileSync(p).equals(old)) {
      if (existsSync(p)) {
        const dest = `${root}/${tag}-artifacts/${p}`;
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(p, dest);
      }
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, old);
      changed.push(p);
    }
  }
  for (const [src, dest] of [
    [
      `evidence/art-v1/browser-results-${suffix}.json`,
      `${root}/${tag}-results.json`,
    ],
    [`evidence/playwright-report-${suffix}`, `${root}/${tag}-report`],
  ]) {
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
      rmSync(src, { recursive: true, force: true });
    }
  }
  writeFileSync(
    `${root}/${tag}-restored-evidence.json`,
    JSON.stringify({ restored: changed, baselineFiles: files.length }, null, 2),
  );
}
