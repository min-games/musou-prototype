import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const root = "evidence/art-v1";
const baseline = JSON.parse(readFileSync(`${root}/baseline-webgl.json`));
const candidate = JSON.parse(readFileSync(`${root}/candidate-webgl.json`));
const f = (n) => n.toFixed(2);
const table = baseline
  .map((r, i) => {
    const c = candidate[i];
    if (
      r.count !== c.count ||
      r.frames !== c.frames ||
      r.metadata.scenario !== c.metadata.scenario
    )
      throw new Error("Benchmark scenarios differ");
    for (const key of [
      "userAgent",
      "viewport",
      "dpr",
      "hardwareConcurrency",
      "warmupFrames",
      "scenario",
      "camera",
    ]) {
      if (JSON.stringify(r.metadata[key]) !== JSON.stringify(c.metadata[key]))
        throw new Error(`Benchmark environment differs: ${key}`);
    }
    for (const key of [
      "width",
      "height",
      "engineVersion",
      "renderer",
      "hardwareScaling",
    ]) {
      if (
        JSON.stringify(r.metadata.renderer[key]) !==
        JSON.stringify(c.metadata.renderer[key])
      )
        throw new Error(`Renderer environment differs: ${key}`);
    }
    return `| ${r.count} | ${f(r.frameMs.p50)} / ${f(r.frameMs.p95)} | ${f(c.frameMs.p50)} / ${f(c.frameMs.p95)} | ${f(r.drawCalls)} | ${f(c.drawCalls)} |`;
  })
  .join("\n");
const assets = ["vanguard-v1.glb", "ranger-v1.glb", "material-atlas-v1.webp"];
const totalBytes = assets.reduce(
  (n, name) => n + readFileSync(`public/models/${name}`).length,
  0,
);
const sizes = assets
  .map((name) => {
    const data = readFileSync(`public/models/${name}`);
    return `| ${name} | ${data.length.toLocaleString("en-US")} | ${gzipSync(data).length.toLocaleString("en-US")} |`;
  })
  .join("\n");
writeFileSync(
  `${root}/README.md`,
  `# Art slice v1 validation

The baseline was captured before renderer modifications in this isolated worktree, then the loaded candidate was measured in the same session. Raw results: [baseline](baseline-webgl.json), [candidate](candidate-webgl.json). Capture times and adapter details are in each JSON. The baseline capture source is archived in [art-source](../../art-source/baseline-capture.spec.ts.txt).

Both runs use Chromium 156, Babylon 8.56.2, 1280×720 viewport, DPR/scaling 1, WebGL2 through ANGLE SwiftShader, seed 4242, the existing weapon-crowd-v1-saber workload, 60 warmup + 180 measured frames per crowd, one simulation step per sample, and the same fixed camera orbit. Candidate metadata verifies both GLBs loaded, actual 1024-square texture, one mesh and 16 joints per hero; one new-art hero is active throughout. Hundreds of enemies retain their old geometry.

| Enemies | Baseline p50 / p95 ms | Candidate p50 / p95 ms | Baseline mean draws | Candidate mean draws |
| ---: | ---: | ---: | ---: | ---: |
${table}

The merged hero saves three mean draw calls in each workload. This is a single pair of runs; assess the measured medians and tails in the table without treating it as a repeated-trial result. Skinning/PBR/material complexity and software renderer/scheduling variability can contribute; there is no repeated-trial attribution or performance gain claim. RAF wall intervals include browser/scheduling work, not GPU timer queries. These results do not predict physical GPU FPS. The full suite also exports matching WebGL/auto and Ranger/stress scenarios into [validation](validation/). The baseline and final candidate form the matched sandbox pair; subsequent candidate repeats are saved separately. The earlier export iteration is retained as candidate-first-webgl.json. Native WebRTC required running the final browser suite outside the process network sandbox: [ICE diagnostic summary](ice-diagnostic.json) shows zero candidates inside versus two candidates per mode outside, for both legacy and new art. Do not mix the differently permissioned benchmark repeats into this pair.

## Runtime transfer sizes

| Asset | Raw bytes | gzip bytes (local estimate) |
| --- | ---: | ---: |
${sizes}

Both GLBs and one atlas total ${totalBytes.toLocaleString("en-US")} raw bytes (about 587 KiB); gzip estimates assume server compression for GLB responses and are not a measured production transfer. WebP should be served directly. Each GLB references the same WebP URL, permitting ordinary HTTP caching; within each hero, local/remote actors share the actual geometry and material. Loader JavaScript is additional and the Babylon bundle still triggers Vite's size warning. Source/reference PNGs and prompts are excluded from precache/deployment.

## Validation

- 103 unit/integration checks: [log](unit-test.log).
- Strict TypeScript and production PWA build: [log](build.log).
- Both GLBs pass Khronos validation with zero errors/warnings/hints: [Vanguard](gltf-validation-vanguard.json), [Ranger](gltf-validation-ranger.json). Their one informational notice describes the intentionally shared external atlas.
- All 31 Playwright checks pass across three disjoint runs: [26 gameplay/native WebRTC checks](browser-gameplay.log), [four benchmark suites](browser-benchmarks.log), [final candidate benchmark](browser-art-benchmark.log). [Combined report](browser-results.json) is generated by a script that rejects duplicate IDs, missing checks and failures. The long all-in-one external process was terminated; the split runs exercise the full suite on the final assets.

## Browser evidence

- [Baseline gameplay](baseline-gameplay.png), [loaded candidate gameplay](candidate-gameplay.png).
- [Vanguard actual model close-up](vanguard-closeup.png), [teal Ranger actual model close-up](ranger-closeup.png).
- [Two-player independent poses](two-player-poses.png).
- [Request-failure fallback](fallback-gameplay.png), [both assets loaded offline at /musou/](offline-subpath.png).
- [Rig sharing/independence and six attachment checks](rig-sharing.json): one local + two remote actors across both kits, identical geometry/material objects for matching heroes, distinct skeleton/joint objects and poses, remote pose changes leave local joints unchanged. Ten add/remove cycles return mesh and skeleton counts to their prior values. This verifies remote resources and cleanup rather than claiming a measured two-player rendering-overhead number.
- [Full browser report](browser-results.json) and current [visual references](references/). Existing keyboard, controller, menus, hero/weapon switching, native two-browser WebRTC, offline root/subpath and benchmark checks remain exercised. Historical screenshot/result files are retained at their old locations; current captures are isolated here.

The screenshots were inspected during implementation. Facing, faceted normals, UV mapping and the shape of the lion medallion were corrected before the final capture. Vanguard is visibly geometric and simplifies the approved illustration. Ranger shares its head/rig, with reduced shoulders/slimmer torso and teal materials. Weapons, arena, enemies and effects remain procedural prototype art. See [pipeline and exact limitations](../../docs/ART-PIPELINE.md).
`,
);
console.log("Wrote art-v1 comparison report");
