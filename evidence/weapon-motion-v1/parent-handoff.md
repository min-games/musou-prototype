# Parent review — required before final candidate

The parent session inspected actual `preview-SpearAttack.png`, `preview-GreatbladeAttack.png`, and `preview-LongbowReady.png` during this run. Please read `art-source/weapon-motion-v1/PARENT-VISUAL-REVIEW.md` and address the spear grip inside the breastplate and the generic rearward elbow pole for front-held melee weapons. Current source still has the spear primary ready target `(0,-.10,1.25)` behind the cuirass front at approximately `y=-.20`; the support hand target may be aligned numerically while the hands/shaft pass through the torso.

This is a scoped correction to the existing requested attack/grip work. Keep reach assertions strict; use attainable outside-torso targets, appropriate shoulder/torso orientation and weapon-specific elbow poles. Verify real geometry and two-hand visibility, then regenerate affected clips/evidence and rerun focused motion checks. Do not repeat unaffected benchmark tests solely for evidence changes.

The original regex concern in the earlier parent notes was checked against the parsed TypeScript source and is resolved: actual lower-body regexes do match thigh.R and shin.L. Do not spend time changing valid regexes based on escaped log output.

Please do not integrate or push; report a clean review candidate after validation. This parent handoff can be archived under the evidence review notes rather than left at the repository root.
