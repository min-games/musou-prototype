import { readFileSync, writeFileSync } from "node:fs";
import { validateBytes } from "gltf-validator";
for (const hero of ["vanguard", "ranger"]) {
  const path = `public/models/${hero}-weapon-motion-v1.glb`,
    bytes = readFileSync(path);
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  const report = await validateBytes(new Uint8Array(bytes), { uri: path });
  const summary = {
    bytes: bytes.length,
    triangles: gltf.meshes.reduce(
      (sum, m) =>
        sum +
        m.primitives.reduce(
          (n, p) => n + gltf.accessors[p.indices].count / 3,
          0,
        ),
      0,
    ),
    materials: gltf.materials.length,
    joints: gltf.skins[0].joints.length,
    meshes: gltf.meshes.map((m) => m.name),
    animations: gltf.animations.map((a) => a.name),
    external: gltf.buffers.filter((b) => b.uri),
    issues: report.issues,
  };
  writeFileSync(
    `evidence/weapon-motion-v1/gltf-${hero}.json`,
    JSON.stringify({ summary, report }, null, 2),
  );
  console.log(hero, JSON.stringify(summary));
  if (report.issues.numErrors || summary.joints < 17 || summary.external.length)
    process.exitCode = 1;
}
