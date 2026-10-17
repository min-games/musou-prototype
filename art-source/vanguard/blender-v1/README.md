# Vanguard Blender v1 — candidate for visual review

This is an editable, script-authored first art pass, requiring parent review. Default Vanguard/Ranger assets remain unchanged. Preview with `npm run dev` and `/?practice=1&backend=webgl&art=blender&artCloseup=1` (omit `artCloseup` for normal gameplay). `?art=legacy` retains the existing primitive fallback.

## Sources and design decisions

The original `../vanguard-front-v2-simple.png`, `../../ART-DIRECTION.md`, and supplied `vanguard-turnaround-v1.png` were visually inspected. The turnaround PNG and exact prompt were copied from `/home/cmwen/dev/min-games-workspace/art-output/vanguard-blender-v1/`; the additional supplied animation pose sheet is design guidance, **not animation evidence**. All three images are packed into the Blender source as image empties in `REFERENCE IMAGES - original and turnaround` beside the character.

Retained: adult male square jaw, short beard and mustache, swept dark hair/topknot, two short red ties, broad torso, charcoal/red/antique gold palette, ivory cloud relief, gold-edged short hip panels, shin guards and fingerless gloves. Anatomical RIGHT is Blender **negative X**, with the character facing **negative Y**; the large guardian-lion pauldron is viewer-left in the front render. Export maps forward to glTF +Z. The opposite shoulder remains smaller and plain. The hip plates preserve the image's longer silhouette but stop above the knee. No cape or exported weapon was added.

## Regeneration

Use Blender **4.5.3 Linux x64**, downloaded from the [official portable archive](https://download.blender.org/release/Blender4.5/blender-4.5.3-linux-x64.tar.xz) to `/tmp/blender-4.5.3-linux-x64` (no system installation). From the repository root:

```sh
/tmp/blender-4.5.3-linux-x64/blender -b --python scripts/blender/vanguard.py
node scripts/validate-blender.mjs
npm test
npm run build
npm run test:e2e
```

The Python script deterministically rebuilds geometry, vertex groups, materials, 15-bone rig, three named NLA tracks, packed reference images and render studio. It writes `vanguard.blend`, `public/models/vanguard-blender-v1.glb` and actual Cycles evidence. In Blender, `Idle` is active for immediate timeline playback; select `Run` or `Attack` in the Action Editor to inspect those actions. NLA tracks are muted in the saved file to prevent stacking. Export temporarily unmutes the tracks. Studio lights/camera/floor and references are excluded from GLB export by explicit selection.

## Scope and limits

This is assembled stylized geometry with individually editable islands in a joined skinned mesh, not a production sculpt or retopologized organic body. Rigid single-joint armor weighting avoids stretching, but shoulders and hip panels still intersect at extreme poses. Hands have simplified separate fingers, no finger rig, grip closure or IK. Run is an in-place authored cycle with visible foot sliding and no ground lock; hip armor remains pelvis-bound. Attack provides anticipation, a forward cross-body arm movement and recovery, not six weapon-specific motion sets. No cloth simulation, facial animation, painterly texture bake, LODs or production skin-weight polish is claimed. The lion is a carved relief interpretation, the cloud simplified geometry, and the hair is visibly chunky.

The self-contained GLB uses solid PBR colors (no runtime textures), seven material primitives, 22,956 triangles and 15 joints. Its 766,988 bytes are suitable for this hero-only preview but exceed the old ~2,500-triangle kit; this pass is not a crowd LOD. The packed references account for much of the editable `.blend` size.

The browser candidate uses cloned **exported animation groups**, sampled at simulation time. Idle and Run use the nominal two-second / 0.8-second authored cycles (exported ranges are 2.0333 / 0.8333 seconds, including Blender’s leading frame); Attack maps its full exported clip to gameplay swing progress. Reduced motion holds Idle at its first frame and keeps Attack. Each remote character gets independent skeleton and groups. Saber/spear/greatblade still use the existing gameplay-defined weapon orientation and length offsets, with position derived from the actual animated `hand.R` socket. This preserves combat readability but does not align the sword rotation to the fist: hand-oriented grips and weapon-specific clips remain follow-up work. The candidate is excluded from unconditional service-worker precaching, so default visitors do not download it. The existing worker can cache it after an explicit preview visit. Failure to load the candidate retains the bounded playable legacy fallback; Ranger still uses its normal asset.

See `../../../evidence/blender-v1/README.md` for validation and evidence details.
