import { readFileSync, writeFileSync } from "node:fs";
import { validateBytes } from "gltf-validator";
const path = "public/models/vanguard-blender-v1.glb";
const bytes = readFileSync(path);
const gltf = JSON.parse(
  bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
const report = await validateBytes(new Uint8Array(bytes), { uri: path });
const summary = {
  bytes: bytes.length,
  meshes: gltf.meshes.length,
  primitives: gltf.meshes.reduce((n, m) => n + m.primitives.length, 0),
  triangles: gltf.meshes.reduce(
    (n, m) =>
      n +
      m.primitives.reduce((v, p) => v + gltf.accessors[p.indices].count / 3, 0),
    0,
  ),
  materials: gltf.materials.length,
  joints: gltf.skins[0].joints.length,
  animations: gltf.animations.map((a) => ({
    name: a.name,
    channels: a.channels.length,
    seconds: Math.max(...a.samplers.map((s) => gltf.accessors[s.input].max[0])),
  })),
  externalResources: gltf.buffers.filter((b) => b.uri),
  issues: report.issues,
};
writeFileSync(
  "evidence/blender-v1/gltf-validation.json",
  JSON.stringify({ summary, report }, null, 2) + "\n",
);
console.log(JSON.stringify(summary, null, 2));
if (
  report.issues.numErrors ||
  !["Idle", "Run", "Attack"].every((n) =>
    gltf.animations.some((a) => a.name === n),
  )
)
  process.exitCode = 1;
