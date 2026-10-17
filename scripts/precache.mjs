import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
const root = process.env.MUSOU_DIST || "dist";
const files = walk(root)
  .filter((f) => !f.endsWith("sw.js"))
  .sort();
const digest = createHash("sha256");
for (const f of files) digest.update(readFileSync(f));
// Keep the review candidate opt-in; include it in the digest so preview caches update.
const assets = files
  .filter((f) => !/\/models\/.*(?:blender|weapon-motion).*\.glb$/.test(f))
  .map((f) => "./" + f.slice(root.length + 1));
const template = readFileSync("public/sw.js", "utf8");
if (
  !template.includes('"__BUILD_VERSION__"') ||
  !template.includes("const PRECACHE = [];")
) {
  throw new Error("Service worker precache placeholders are missing");
}
writeFileSync(
  `${root}/sw.js`,
  template
    .replace(
      '"__BUILD_VERSION__"',
      JSON.stringify("iron-field-" + digest.digest("hex").slice(0, 12)),
    )
    .replace(
      "const PRECACHE = [];",
      `const PRECACHE = ${JSON.stringify(assets)};`,
    ),
);
console.log(`Precached ${assets.length} local assets`);
