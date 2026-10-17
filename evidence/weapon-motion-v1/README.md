# Two-job / six-weapon Blender preview

Preview: `/?practice=1&backend=webgl&art=blender&artCloseup=1`. Use the existing hero/loadout controls. Omit `artCloseup` for gameplay. Default art, old GLBs, committed Blender run-v2 evidence, combat statistics, collision queries, network payloads and projectile creation timing are preserved. The Blender art remains an opt-in preview; its editable sources and generated assets ship with the game.

## Review evidence

- `ranger-front.png`, `ranger-right.png`, `ranger-back.png`: real studio renders of the editable Ranger, without weapons so costume/identity are visible.
- `Saber1/`, `Saber2/`, `Saber3/`, `SpearAttack/`, `GreatbladeAttack/`, `ShortbowShot/`, `LongbowShot/`, `FanbowShot/`: 33 rendered samples per clip, phase 0 through 1, real Blender geometry with the actual exported props. Extra `*-grips-{front,right}-*.png` views expose the two-hand spear/greatblade holds. MP4s and labeled phase sheets are generated from these images. They are intentionally slowed for review; runtime remaps normalized clip phase to the real attack period or remaining shot cooldown. No AI sheet is animation evidence.
- `babylon-*.png`: real Babylon screenshots from the production build. `validated-run/`: refreshed browser run checks, separate from the immutable historical `blender-run-v2` directory.
- `world-grip-checks.json`: 513 subframe samples per attack. Hand grip point is local `(0,.065,0)`, using measured hand rest axes; prop origin is its grip. Includes actual joint positions, planted ankles, primary position/orientation, support-hand and string errors. The bow draw hand deliberately separates from the released string during phases `(0,.34)`; the report distinguishes this follow-through gap from draw-contact error.
- `geometry-clearance.json`: actual evaluated-triangle overlap checks at 33 phases per attack against chest/pelvis geometry. Weapon and forearm/hand overlaps are asserted absent in these sampled poses; this is not a whole-character or arbitrary-blend collision guarantee.
- `exported-world-checks.json`: actual GLB reimport, sampled world grip markers/orientations and both jobs' Run knees/ankles. `browser-world-grips.json` also checks CPU-skinned hand/prop geometry, sole clearance and actual prop visibility; these checks go beyond names and arm quaternions.
- `browser-event-lifecycle.json`: real CombatSystem projectile events, moving fire over a full stride, independent remote skeletons/props, disconnect cleanup, hero replacement and reduced motion.
- `gltf-{ranger,vanguard}.json`: Khronos validator reports for self-contained GLBs.

## Motion gallery

| Motion | Actual rendered phases | MP4 (slowed review) |
| --- | --- | --- |
| Saber1 | [Phase sheet](Saber1-phases.png) | [Video](Saber1.mp4) |
| Saber2 | [Phase sheet](Saber2-phases.png) | [Video](Saber2.mp4) |
| Saber3 | [Phase sheet](Saber3-phases.png) | [Video](Saber3.mp4) |
| SpearAttack | [Phase sheet](SpearAttack-phases.png) | [Video](SpearAttack.mp4) |
| GreatbladeAttack | [Phase sheet](GreatbladeAttack-phases.png) | [Video](GreatbladeAttack.mp4) |
| ShortbowShot | [Phase sheet](ShortbowShot-phases.png) | [Video](ShortbowShot.mp4) |
| LongbowShot | [Phase sheet](LongbowShot-phases.png) | [Video](LongbowShot.mp4) |
| FanbowShot | [Phase sheet](FanbowShot-phases.png) | [Video](FanbowShot.mp4) |

Ranger identity: [front](ranger-front.png), [right](ranger-right.png), [back](ranger-back.png). Grip views: [spear front](spear-grips-front-0.5.png), [spear side](spear-grips-right-0.5.png), [greatblade windup](greatblade-grips-front-0.png), [greatblade cut](greatblade-grips-front-0.5.png), [greatblade side](greatblade-grips-right-0.5.png).

## Authoring and runtime contract

Editable sources are `art-source/{ranger,vanguard}/blender-weapon-motion-v1/{hero}.blend`. The original approved Vanguard geometry and ankle-path Run are reused from the checked-in source without modifying it. Ranger body, face, ponytail and costume are independently constructed. There are 34 Ranger joints and 24 Vanguard joints, including explicit hand-grip/prop/support/string markers. Both export authored Idle and Run plus weapon-specific Ready and attack clips.

Saber stages select `Saber1`, `Saber2`, `Saber3`: opposing lateral cuts and a raised descending finisher. Stage-specific recoveries bridge the combo window. Spear uses a forward, level two-hand thrust with a braced split stance. Greatblade uses a deeper/wider planted stance and two-hand raised windup, descending cut and recovery. Shortbow has a quick redraw, longbow a deeper draw with later redraw, and fanbow a wide crouch and canted triple-limb bow. These are different baked poses and foot targets, not renamed or sped-up copies.

Ranger is already drawn before input. `CombatSystem` creates the real projectile(s) at phase zero; the string releases immediately, the right hand follows through beside the cheek, then reacquires/redraws by the next legal shot. Sampling uses `shotCooldown / weaponStats.period` including speed upgrades, not the shorter cosmetic `swing`. While firing on the move, the validated Run lower body is retained and the same pelvis displacement moves the upper body and every prop/string target. Preview projectile height follows the authored arrow line; authoritative X/Z trajectories, damage and timing are unchanged.

All props have an authored grip origin and full socket rotation. They are separate skinned meshes inside each self-contained GLB, using the same calibrated transforms in Blender and Babylon. Heavy-weapon support grips and bowstring control points are baked from the same world-space hand targets. Each actor clones its skeleton, animation groups and prop nodes; geometry/materials remain immutable shared resources. Hero replacement/disconnect disposes the previous instance. Reduced motion holds locomotion at Idle but preserves attack/release timing. Missing candidate assets retain playable legacy fallback. Preview GLBs are excluded from unconditional service-worker precaching.

## Exact regeneration

From this isolated repository root, with Blender 4.5.3 portable and Node 24:

```sh
npm ci --offline
/tmp/blender-4.5.3-linux-x64/blender -b -t 4 --python-exit-code 1 --python scripts/blender/weapon-motion.py
CHECK_ONLY=1 /tmp/blender-4.5.3-linux-x64/blender -b -t 4 --python-exit-code 1 --python scripts/blender/check-weapon-motion.py
/tmp/blender-4.5.3-linux-x64/blender -b -t 4 --python-exit-code 1 --python scripts/blender/check-motion-export.py
/tmp/blender-4.5.3-linux-x64/blender -b -t 4 --python-exit-code 1 --python scripts/blender/check-clearance.py
node scripts/validate-weapon-motion.mjs
/tmp/blender-4.5.3-linux-x64/blender -b -t 4 --python-exit-code 1 --python scripts/blender/check-weapon-motion.py
node scripts/motion-evidence.mjs
npm test
npm run build
MUSOU_REPORT_SUFFIX=-weapon-motion npm run test:e2e
```

The browser suite starts its production static server at `127.0.0.1:5187`; native multiplayer checks require local UDP access. The full suite’s benchmark timing is environment-dependent (including concurrent evidence rendering) and is not presented as a performance improvement. Exact reports from the required full suite are archived here; pre-existing generated evidence is restored after archiving. Later changes are checked with focused tests rather than repeating unchanged benchmark suites.

## Validation

- Final unit suite: 126 tests passed.
- Production build passed; Vite reports its existing large-chunk advisory.
- Both new GLBs: zero glTF validator errors or warnings.
- Source grip, GLB round-trip and sampled geometry-clearance checks report no errors.
- Full browser run: 38/39 passed. Its sole failure compared two identical held saber poses; the assertion now compares anticipation against follow-through. All 7 Blender regression tests then passed, including that corrected test. Thus every one of the 39 browser cases has passed on the final runtime code. Exact reports: `final-suite-results.json`, `final-animation-results.json`, and their logs. Earlier partial/focused reports remain intermediate evidence.

## Remaining limitations

This is a procedural stylized preview, not production character art. Separate rigid-weighted islands remain visible, especially shoulder/ivory sleeve bends, elbow seams, hip panels and ponytail strands. The face is a simplified geometric interpretation, with no facial animation, organic retopology or painterly texture bake. Fingers are closed static grip forms, without finger joints or a string pinch pose. No runtime IK, terrain adaptation, cloth, quiver/arrow-nocking hand simulation, bow limb flex or foot-speed adaptation is claimed. Hand/prop alignment is substantially more constrained than anatomy; collision-free skin/cloth across every possible blended pose is not guaranteed. Late buffered saber inputs can re-enter an authored anticipation pose after the recovery has begun. Motion is authored for the existing front-facing aim and movement system; extreme strafing can slide feet. The three fan limbs indicate volley equipment; only the authoritative gameplay arrows represent fired ammunition. Review the real images and videos before accepting the art.
