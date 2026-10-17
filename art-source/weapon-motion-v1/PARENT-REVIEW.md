# Parent review of initial weapon-motion code

Please address these before final visual review:

1. **Archery face anchor:** initial bow pose puts nock at approximately `(0.17, -0.03, 1.48)` in Blender world space, while Ranger's cheek is about `z=1.85`. That is a chest-level cross-body draw, not a right-handed cheek anchor. Use a near-right-cheek draw target and a bow/string orientation consistent with the line to the target, with a plausible elbow. Keep the left bow arm extended and right hand briefly recoiling beside the face at release. Check the actual renders, not only hand-to-nock numeric error (two incorrect targets can match exactly).

2. **Locomotion masks:** inspect regex literals carefully. The draft runtime source showed `/thigh\\./` and similar doubled backslashes inside JS regex literals; those do not match `thigh.R`. Use literal-dot matching and test that actual thighs/shins/feet keep moving under bow actions.

   Update: a parent AST/runtime check of the current source confirms both lower-body regexes DO match `thigh.R` and `shin.L`; tool-output escaping made the displayed pattern ambiguous. This is not an outstanding regex bug. Continue checking actual moving-fire leg excursion.

3. **Moving fire:** draft overlay applied Ready only when `!motion.attacking`; that leaves legs planted for the whole shot cooldown. Preserve lower-body Run when Ranger is moving while firing, with consistent pelvis displacement for arm/prop targets. Test a real moving Simulation shot, not only static phase samples.

4. **Complete motion:** show both support grips in actual spear/greatblade renders, and actual string/face relation for bows. Capturing only zero hand-to-socket error is insufficient evidence of anatomical plausibility.

These are review notes from the parent session, not image generation instructions or animation evidence.
