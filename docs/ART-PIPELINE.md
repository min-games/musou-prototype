# Taiwanese Temple Fantasy — art slice v1

This candidate replaces the playable capsule-like hero with actual reusable GLB characters. The 3D mesh, UVs, bind transforms and animation are **code-authored from the approved reference**. The reference and material sheet are AI-generated artwork supplied by the parent run. This is not automatic reconstruction, and uses no image-to-3D service, API key or Blender.

## Inputs and regeneration

- Approved image: `art-source/vanguard/vanguard-front-v2-simple.png`, copied from the workspace art directory. Its exact generation prompt is alongside it.
- Ranger reference: `art-source/ranger/ranger-front-v1-simple.png` and its exact `.prompt.txt`, supplied by the parent and preserving the original female Ranger identity.
- Direction: `art-source/ART-DIRECTION.md` — Taiwanese Temple Fantasy; original guardian motifs, no direct sacred figure reproduction.
- Atlas: `art-source/vanguard/material-atlas-v1.source.png` and `.prompt.txt`. The requested 1024-square sheet actually arrived at **1254×1254**. The original is retained; an optimized 1024-square version is used at runtime.
- Generator: `scripts/generate-characters.mjs`. Plain Node, no rendering context or external authoring dependency. `art-source/model-manifest.json` records exact geometry and file sizes.

From repository root:

```sh
npm ci
npm run art:generate
npm run art:validate
# Only needed when recreating the optimized atlas from its supplied original:
magick art-source/vanguard/material-atlas-v1.source.png -resize 1024x1024 -strip -define png:compression-level=9 art-source/vanguard/material-atlas-v1.1024.png
cwebp -q 85 art-source/vanguard/material-atlas-v1.1024.png -o public/models/material-atlas-v1.webp
npm test
npm run build
npm run test:e2e
npm run art:report
```

ImageMagick and libwebp are only needed for the optional image optimization step. The checked-in runtime atlas is sufficient to regenerate and use the GLBs. Exact PNG/WebP encoding can vary by tool version; model output is byte-for-byte checked by unit tests.

## Runtime contract

The standard `EXT_texture_webp` extension is required for the shared WebP atlas; consumers need that extension (the source PNG is available for other import pipelines). See [Khronos WebP extension](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_texture_webp) and [node schema](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/node.schema.json). Leaf nodes omit empty child arrays. `npm run art:validate` runs the Khronos validator locally with the actual atlas: both models report zero errors/warnings/hints and one informational notice that the GLB references an external image. That dependency is intentional so the heroes share one atlas.

Each GLB contains one merged mesh, one PBR atlas material, one skin and 16 joints with rigid weights. All faces stay eight pixels inside their atlas cell at 1024 resolution. This avoids sampling neighboring cells at ordinary gameplay mip levels; extremely small mip levels can still blend cells. The atlas is equal 4×4 cells, left to right:

| Row | 1              | 2            | 3             | 4              |
| --- | -------------- | ------------ | ------------- | -------------- |
| 1   | charcoal armor | red cloth    | antique gold  | warm skin      |
| 2   | hair           | trousers     | boot leather  | ivory          |
| 3   | original lion  | cloud emblem | festival sash | teal silk      |
| 4   | steel          | wood         | teal bronze   | plain charcoal |

The authored height is about 2.13 world units, with feet at ground level and shoulders about one unit wide. Gameplay collision, reach, health and simulation are unchanged. Vanguard uses facial geometry for eyes/brows, nose, beard and hair/topknot, a shaped lion medallion, shoulder armor, cuirass, sash, skirt plates, arms, legs and boots. Ranger has a separate slimmer angular adult female face without facial hair, distinct eyes/brows and a compact high ponytail built from a few broad dark forms. Small plain dark shoulder guards, ivory sleeves, charcoal chest armor, teal scarf and sash, and a small jade/teal buckle follow the supplied reference. The same 16-joint rig contract and shared atlas are retained without extra textures or shaders.

`TempleCharacters` uses Babylon's official glTF loader with document-relative `BASE_URL` asset paths. Templates remain outside the scene. Instantiation shares geometry and materials and clones the skeleton and linked joint nodes. Remote clones exclude local model children, then instantiate their own character rig. Disconnect and hero changes dispose only actor-owned nodes and skeletons; renderer disposal releases templates/materials/textures. Models finish loading before renderer creation resolves, which also gates `window.musou`, input and benchmarks. The page is inert with a short loading notice until all control handlers are installed; early multiplayer clicks therefore wait for readiness. Shader warmup remains inside the existing 60 benchmark warmup frames. Per-model failure or a 12-second loading timeout chooses the original primitive hero, logs its cause, and marks the HUD/metadata as fallback. Late-resolving timed-out assets are disposed.

The existing six procedural weapons/effects retain their shapes. Weapon handles follow the actual cloned hand position; blade sweep/reach and bow pose remain procedural. Poses cover breathing, walking, arms/forearms during melee or bow fire, torso lean during dodge and sash motion. Reduced motion removes decorative breathing, gait, sash sway and torso twist, while retaining necessary attack/dodge poses and the existing reduced-effects policy. No authored clips, IK, finger animation, cloth physics or enemy art replacement are claimed.

`?art=legacy` skips model loading and preserves the original appearance for A/B inspection. `?artCloseup=1` changes only the non-benchmark camera distance; face toward the camera for front inspection. Neither query is serialized or influences gameplay/network state. Renderer metadata records actual loaded/fallback states, loaded mesh/index/joint counts, texture dimensions, active actor IDs, shared geometry/material IDs and independent skeleton IDs/poses. Benchmark JSON nests this under `metadata.renderer.characterArt`.

The build precaches only `public/` and compiled chunks. It includes both GLBs and the WebP, including at `/musou/`. Reference PNGs, prompts, generator and documents stay outside the deployed runtime.

## Validation and evidence

The baseline was captured before renderer modifications in the original first-candidate worktree/session with the original deterministic benchmark. Its capture source is archived at `art-source/baseline-capture.spec.ts.txt`; do not execute it against this candidate as a new baseline. Existing historical evidence and screenshot files remain intact. Current screenshot references are under `evidence/art-v1/references`; existing browser tests now write their evidence into `evidence/art-v1/validation`.

See [same-session measurements and screenshots](../evidence/art-v1/README.md). The candidate benchmark verifies actual loaded model state. These are single-machine Chromium **SwiftShader software WebGL2** RAF intervals, not physical GPU FPS or GPU timer measurements. Hundreds of benchmark enemies still use the original procedural enemy meshes. Only the playable/remote heroes use the new art.

Unit tests check exact reproducibility, binary structure, one mesh/material, compact triangle counts, 16 joints, normalized normals, rigid skin weights, ground-compatible height and UV cell inset. New browser tests check both loaded assets, all six attachments, independent remote joint/skeleton instances with shared geometry/materials, repeated disconnect cleanup, playable request-failure fallback, the loading timeout, legacy A/B, default and close-up captures, reduced-motion joint poses, and both kits loading offline at a repository subpath. The existing browser suite covers real keyboard/gamepad combat, both hero/loadout flows, effects, native two-browser WebRTC rooms, cleanup and offline root/subpath.

The slice is intentionally visibly low-poly. The face is geometric, shoulder ornament uses a textured medallion with modest raised geometry, silhouettes and textures simplify the approved illustration, and Ranger preserves a distinct female head and costume using the shared rig contract. This is an early code-authored slice, not a production sculpt. The stock weapons and arena/enemies remain a visual mismatch for a later slice.

Native WebRTC validation requires local UDP/ICE access: in this managed process sandbox, both legacy and new-art modes gathered zero host candidates. The same no-server diagnostic outside the process sandbox gathered candidates in both modes; native multiplayer gameplay checks therefore run there. The baseline and final candidate performance JSON are a matched sandbox pair; the earlier candidate export is retained as `candidate-first-webgl.json`; subsequent benchmark repeats are written separately. The long all-in-one external process was terminated by the execution environment, so final coverage is split into `MUSOU_REPORT_SUFFIX=-gameplay npm run test:e2e -- --grep-invert benchmark` (outside the process sandbox), `MUSOU_REPORT_SUFFIX=-benchmarks npm run benchmark`, and `MUSOU_REPORT_SUFFIX=-art-benchmark npm run test:e2e -- e2e/art-v1.spec.ts --grep benchmark` (benchmark-only runs inside). `node scripts/merge-art-reports.mjs` checks disjoint IDs and all 31 checks passing before writing the combined report. This changes test execution permissions, not app network policy or transport behavior.

Physical GPUs, mobile performance and hardware WebGPU require separate testing. The Babylon bundle still emits Vite's size warning.

The Ranger identity correction reruns only unit tests, production build, glTF validation, art-v1 browser checks excluding benchmark, and the Ranger storm/Fan Bow screenshot scenarios. See the updated evidence report for current hashes/counts and logs. Original 31-check results and every timing JSON remain historical evidence. Performance tables measure unchanged Vanguard and old-art enemies; exact current Ranger performance was not rebenchmarked.
