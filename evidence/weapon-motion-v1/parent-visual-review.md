# Parent visual review of first rendered attacks

Inspected actual `preview-LongbowReady.png`, `preview-SpearAttack.png`, `preview-GreatbladeAttack.png`.

Please fix/verify before final:

- **Spear primary grip intersects torso:** the initial primary target `(0, -.10, 1.25)` is behind the cuirass front (roughly `y=-.20`). Even zero hand-to-grip error can put both hands/shaft inside the chest. Move the primary grip outside the breastplate with clearance, keeping the support hand reachable through the full thrust. Use torso orientation/shoulder reach if needed; do not merely relax unreachable-target assertions.
- **Vanguard elbow poles:** the generic arm pole `(+/- .8, +.8, -.55)` places elbows behind the body while holding a weapon in front. That can route forearms through the cuirass. Use weapon-specific anatomical elbow poles and inspect arm/torso clearance through each cut/thrust. A rearward pole can be right for Ranger's drawing elbow, but not for every gripping arm.
- **Greatblade visibility:** current preview shows only a thin edge across the torso, with hands occluded. Supply a camera/phase that exposes the broad blade, two hands on the hilt and body-driven cut. Confirm the blade actually reads as a heavy blade in multiple views rather than judging only socket error.
- Ranger remains a stylized scaffold. Do not describe it as matching the concept at production quality; verify that the cheek anchor and bow arm are now anatomically plausible from side and front.

Keep final evidence honest about remaining geometric intersections. The deliverable is coherent motions and grips for all six styles, not a decorative screenshot with hidden hand problems.
