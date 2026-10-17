# Blender Vanguard first-pass evidence

Candidate only; no integration or default-model replacement. Review the [source and limitations](../../art-source/vanguard/blender-v1/README.md) alongside these images. Reference/pose sheet images are AI-generated design guidance; every image in this evidence directory is an actual Blender render or browser capture, and the GIFs assemble actual rendered frames.

## Visual evidence

- [Front](front.png), [anatomical right side](right.png), [back](back.png): actual Cycles orthographic renders, neutral action frame 1.
- [Idle frame 16](idle-16.png), [Run frame 7](run-7.png), [Attack frame 13](attack-13.png): actual skinned action renders, consistent three-quarter camera, no weapon exported.
- Run frames [1](run-1.png), [7](run-7.png), [13](run-13.png), [19](run-19.png), and [sampled loop](run-sampled.gif).
- Attack frames [6](attack-6.png), [13](attack-13.png), [20](attack-20.png), and [sampled sequence](attack-sampled.gif). These sparse samples demonstrate motion; they are not a smooth final animation capture. The attack GIF loops the sampled middle section, not its rest-to-rest recovery.
- [Browser Idle](browser-idle.png), [Run](browser-run.png), [Attack](browser-attack.png), [load failure fallback](browser-fallback.png): actual WebGL2 gameplay captures with the optional close-up camera. Weapon orientation is still gameplay-authored; the visible hand/grip mismatch is a known limitation, not a finished attachment claim.

The model has the large lion relief on anatomical right, adult beard/mustache and topknot, charcoal armor, red cloth, gold borders and ivory cloud. The face/hair and shoulder volumes remain visibly simplified. Neutral clipping was corrected after inspecting the first render. Rigid hip plates can intersect the run legs and the shoulder pivots need further art/weighting review. Studio lighting differs from the existing arena's untextured low-light environment.

## Structural and browser checks

`gltf-validation.json` records Khronos glTF Validator output: **zero errors, warnings, infos or hints**. The self-contained GLB is 766,988 bytes, one glTF mesh with seven material primitives (Babylon reports seven meshes), 22,956 triangles, 15 joints, and named Idle, Run, Attack clips. There are no external texture or buffer dependencies. `blender-author.log` records real Blender 4.5.3 export/render execution.

`browser-animation.json` records actual clip selection, sampled frames, quaternion changes and world-space animated hand positions. The focused browser test asserts Idle → Run → Attack, distinct run/attack poses, moving hand socket, independent remote skeletons and animation groups, saber/spear/greatblade placement, and reduced motion. `browser-fallback.json` records failure of the candidate only, normal Ranger loading, and playable primitive Vanguard. The second test also verifies that the default URL requests no Blender candidate. `focused-browser.log` records both checks passing against Vite bound to loopback; an initial dev-server attempt using `0.0.0.0` hit the sandbox's `uv_interface_addresses` restriction, then the explicit loopback server worked without a system change.

The full suite also covers unchanged legacy/default assets, offline/subpath loading, gameplay, controller input, multiplayer and existing benchmark scenarios. Benchmark measurements in this suite use the **default art**; no performance claim about this higher-detail candidate is inferred from them. Physical GPU, mobile hardware and production animation quality remain unverified.

## Reproduce evidence

Run the authoring script and validation commands in the source README. Then run `npm run test:e2e -- e2e/blender-v1.spec.ts` to regenerate the browser evidence. Optional sparse GIF assembly (ImageMagick):

```sh
magick -delay 20 evidence/blender-v1/run-1.png evidence/blender-v1/run-7.png evidence/blender-v1/run-13.png evidence/blender-v1/run-19.png -resize 400x480 -loop 0 evidence/blender-v1/run-sampled.gif
magick -delay 25 evidence/blender-v1/attack-6.png evidence/blender-v1/attack-13.png evidence/blender-v1/attack-20.png -resize 400x480 -loop 0 evidence/blender-v1/attack-sampled.gif
```

Source turnaround copy hashes (identical to the parent art-output files): PNG `20a7bb38b09b4f9b037945020e7fc76a3777c00ccd60b8fae5535c748d429687`; exact prompt `3ea32a78c21882a6bbc57f0a3e8fe600a9fe0782f0f662496d85e22b7292b91f`.

## Validation run results

- `npm test`: **104 passed** (`npm-test.log`).
- `npm run build`: **passed** (`npm-build.log`); the existing Vite bundle-size warning remains. `precache.log` verifies 124 precached files and that the review candidate is excluded while default GLBs remain included. Candidate bytes still contribute to the cache version digest.
- `npm run test:e2e`: completed with **30 passed, 4 failed** in the process sandbox (`npm-test-e2e.log`, `full-browser-results.json`). All four failures were native connection checks waiting for ICE/room connection. The full run included both Blender checks and all default-art benchmark scenarios.
- Latest production build follow-up: **4 passed** — candidate animation/fallback plus both subpath/offline checks (`production-browser.log`, `production-browser-results.json`). This also verifies the final screenshot capture states: time stays monotonic and each capture asserts its actual clip. Service workers are blocked for candidate route-abort tests so fallback assertions reach the network; separate subpath checks retain normal service workers.

Native checks were rerun with local UDP access, using an explicitly started production server at the required `http://127.0.0.1:5187` origin. The first alternate-port attempt passed manual WebRTC but failed room signaling because the fixture permits port 5187 and asserts that invite origin; its log/report are retained as `native-alternate-port-attempt.log`. Automatic server probing also stalled outside the process sandbox, so the final run starts `MUSOU_DIST=test-dist node scripts/serve.mjs` explicitly. The final native config is archived as `native-run.config.mjs.txt` (with this worktree's absolute paths); the production follow-up config is archived similarly. These are validation execution changes, with no application transport or signaling changes.

The current default-art benchmark outputs are retained in `default-benchmarks/`; current native overhead data is in `native-overhead.json`. Historical `evidence/art-v1` captures and reports are restored after validation. `artifact-manifest.json` identifies the editable source, script, candidate and preserved runtime assets by hash.

Final native UDP rerun: **5 passed** (`native-browser.log`, `native-browser-results.json`), covering all four failed full-suite checks plus the room UI check. `validation-summary.json` verifies **all 34 unique browser checks covered by passing results across the two environments**; this does not relabel the original failing full run. The latest production follow-up adds four passing confirmations. The standalone native reporter resolved its relative output under `/tmp/evidence/`; that completed report was copied here.
