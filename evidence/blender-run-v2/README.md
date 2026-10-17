# Vanguard run v2 — isolated review candidate

Scaffold commit `71ccc6dabfa70bb0220cc40f17a98c56fa5b818a` was cherry-picked as `b84f52e` into **R-20261017071716-47076378 only**. No canonical integration. This is a focused animation/model correction, not production art fidelity. Default shipped art and historical evidence are preserved; preview remains `?art=blender`.

## Review the actual motion

- [Side loop, MP4 at authored 30 fps](right-loop.mp4), [GIF](right-loop.gif): 24 actual Cycles renders, one complete .8-second stride, frames 1–24, endpoint omitted. These are rendered skinned geometry, not generated concept art or joint diagrams.
- [Side contact sheet](right-contact-sheet.png), [front sequence](front-contact-sheet.png). Individual `right-01.png` through `right-24.png` and six `front-*.png` remain available for frame-by-frame inspection.
- `before-glb-right-07.png` / `before-glb-front-07.png`: actual imported previous GLB in the same Blender studio, Run frame 7. `before-glb-axes.json` / `before-glb-joints.json` record original bone axes and world-space positions. Imported glTF terminal bone tails are reconstructed by Blender; joint **heads** and evaluated mesh, rather than reconstructed tail length, are authoritative.
- [Babylon movement loop](browser-loop.mp4); `browser-stride-01.png` through `browser-stride-24.png`: actual Babylon WebGL gameplay movement at 1/30-second intervals. `browser-run.png`, `browser-idle.png`, `browser-attack.png` exercise normal gameplay selection. The browser frames use the existing optional close-up camera, not the orthographic studio camera.

## What changed

The down-pointing thigh/shin bones have local X along world +X. Negative thigh X lifts the knee forward (-Y); positive relative shin X bends the heel backward. The old negative shin rotation compounded the forward thigh rotation. The independent new horizontal foot bones have local X along world **-X**, so their compensation uses the opposite sign.

The run now bakes an analytic two-bone solution with the knee on the forward side of the hip-to-ankle line. A periodic Hermite ankle path defines contact (0), compression (.12), late support (.28), toe-off (.40), heel recovery (.54), forward knee lift (.68–.80), and extension (.92–1). Left/right phases differ by half a stride. Feet travel backward during support in character space, then recover through the air. Pelvis bounce is 5 cm peak-to-peak; the chest leans forward .10 rad, with opposing arms and bent elbows. The exporter slides clips to zero to eliminate the previous one-frame lead-in. Idle/Run/Attack remain authored clips; simulation movement and clip selection are unchanged. The optional Blender runtime now eases Idle/Run changes over 120 ms from the currently displayed joint pose, avoiding a snap into the stronger knee lift; attack timing stays immediate.

Lower trousers end at the knee instead of extending down the shin under rigid thigh binding. A knee articulation bridges the hinge. Boot toes/welts have independent foot weights. Shorter, separated side hip plates follow their thighs; the center plate stays on the pelvis. Removed the old low rigid border crossing the hinge. Face, hair, upper armor, style, references and default GLBs are unchanged.

## Checks and reproduction

From repository root:

```sh
/tmp/blender-4.5.3-linux-x64/blender -b --python-exit-code 1 --python scripts/blender/vanguard.py
/tmp/blender-4.5.3-linux-x64/blender -b --python-exit-code 1 --python scripts/blender/check-run.py
/tmp/blender-4.5.3-linux-x64/blender -b --python-exit-code 1 --python scripts/blender/check-export.py
node scripts/validate-blender.mjs
npm test
npm run build
npm run test:e2e
```

Assemble the rendered sequence at its authored speed with `ffmpeg -y -framerate 30 -i evidence/blender-run-v2/right-%02d.png -c:v libx264 -pix_fmt yuv420p evidence/blender-run-v2/right-loop.mp4`. The same command with `browser-stride-%02d.png` produces the browser loop after the focused browser test.

Use `VANGUARD_CHECK_ONLY=1` for world/geometry validation without rerendering. The editable source is `art-source/vanguard/blender-v1/vanguard.blend`; the optional runtime asset keeps its existing URL `public/models/vanguard-blender-v1.glb`. `scripts/blender/vanguard.py` regenerates both; `scripts/blender/check-run.py` validates and renders the sequence. `e2e/blender-run-v2.spec.ts` checks exported Babylon legs and skinning; the previous candidate tests now write evidence here. `scripts/validate-blender.mjs` also writes here. `src/TempleCharacters.ts` contains only the opt-in locomotion blend. `browser-transitions.json` verifies continuous entry/exit poses, completed easing and unchanged simulation root.

`world-space-checks.json` records 97 evenly spaced samples including subframes: knee excursion ~48 cm, ankle excursion ~64 cm, knee vertical lift ~28 cm, thigh-weighted mesh center lift ~16 cm, minimum boot sole clearance ~3.6 mm. In-place hips deliberately have zero forward drift and 5 cm vertical bounce. Both legs must bend backward throughout, every sole must remain above -3 mm, skinned thigh vertices must agree with actual thigh transforms, and loop positions/velocities must close. Joint endpoint error is zero. Tests inspect evaluated mesh geometry, not only keyframe metadata.

`exported-world-joints.json` independently round-trips the real GLB through Blender and compares all baked hip/knee/ankle positions to the authoring scene; maximum error is 0.000000363 m.

`browser-leg-motion.json` records both legs' actual exported hip/knee/ankle positions through a complete clip, skin displacement for thigh-weighted vertices, and boot sole clearance. Browser assertions cover knee lift, forward excursion, bending direction, floor clearance and loop closure. Idle/Run/Attack selection, remote independence, reduced motion and opt-in/fallback remain covered by the scaffold tests.

The full suite is run once with the production test server and Playwright in the same network context at `http://127.0.0.1:5187`, with local UDP permissions for native WebRTC. `full-run.config.mjs.txt` archives the execution config; it changes no application transport or network policy. Historical test artifacts are restored after validation; current full-suite artifacts are archived here.

## Remaining motion limits

This is a stylized armored jog. Hip extension, torso twist and lateral weight shift remain restrained; cloth/armor are rigid weighted pieces rather than simulated fabric. Feet follow a baked in-place support trajectory, not runtime terrain/speed IK, so sliding can occur at gameplay speeds or during acceleration. Idle/Run transitions now blend, while attack transitions and hand/weapon grip limitations remain. Gameplay movement is unchanged. Face/style remain the reviewed scaffold. Physical GPU/mobile and production art quality are not claimed.

## Actual validation results

- `npm test`: **104 passed** (`npm-test.log`).
- `npm run build`: **passed** (`npm-build.log`); existing Vite large-chunk warning remains.
- `npm run test:e2e -- --config /tmp/vanguard-run-v2.config.mjs`: **35 passed**, including all default benchmark cases and native WebRTC/rooms (`npm-test-e2e.log`, `full-browser-results.json`). One complete full-suite run; no benchmark repeat.
- Final production-build focused follow-up: **4 passed**, covering exported leg skinning, Idle/Run easing, immediate reduced motion, clip/socket/remote behavior, opt-in and fallback (`focused-browser.log`, `focused-browser-results.json`). This follow-up verifies the final runtime blend without rerunning unaffected benchmarks. The added transition regression makes the final suite contain 36 distinct tests; the full run scheduled the preceding 35, and this follow-up covers the new check.
- Khronos GLB validation: **0 errors, warnings, infos or hints**; self-contained, 783,984 bytes, 23,388 triangles, seven material primitives, 17 joints, Idle 2 s / Run .8 s / Attack .8 s (`gltf-validation.json`).
- World-space/evaluated-geometry checks and exported GLB round-trip: **passed** (`world-space-checks.log`, `exported-world-joints.log`).
- Final artifact hashes and unchanged default-asset comparisons: `artifact-manifest.json`. Historical `evidence/art-v1` and `evidence/blender-v1` tracked files have zero diff from the imported scaffold. Current full-suite captures/benchmarks are under `full-suite-artifacts/`.

`validation-summary.json` provides the machine-readable results. Source changes are limited to the authoring/check/export scripts, editable source and opt-in GLB, source README, targeted browser checks and optional runtime locomotion blend; all new evidence is in this directory.
