import type { Player } from "./CombatSystem";
import { weaponStats } from "./Weapons";
/** Pure visual sampling contract. Ranged phase zero is the real projectile event;
 * the rest of the clip is follow-through/redraw over the simulation cooldown. */
export function weaponMotion(
  p: Player,
  moving: boolean,
  reduced: boolean,
  time: number,
) {
  const { weapon, period } = weaponStats(p);
  const title = weapon.id.charAt(0).toUpperCase() + weapon.id.slice(1);
  const attacking = p.hero === "ranger" ? p.shotCooldown > 0 : p.swing > 0;
  const clip = attacking
    ? p.hero === "ranger"
      ? `${title}Shot`
      : weapon.id === "saber"
        ? `Saber${Math.max(1, Math.min(3, p.stage))}`
        : `${title}Attack`
    : (moving || p.dashTimer > 0) && !reduced
      ? "Run"
      : "Idle";
  return {
    weapon: weapon.id,
    clip,
    ready:
      weapon.id === "saber" &&
      !attacking &&
      p.comboWindow > 0 &&
      p.stage < 3 &&
      p.stage > 0
        ? `SaberRecover${p.stage}`
        : `${title}Ready`,
    readyPhase:
      weapon.id === "saber" && p.comboWindow > 0
        ? Math.min(1, Math.max(0, 1 - p.comboWindow / 0.28))
        : 0,
    attacking,
    phase: attacking
      ? Math.min(
          1,
          Math.max(
            0,
            1 -
              (p.hero === "ranger"
                ? p.shotCooldown / period
                : p.swing / p.swingDuration),
          ),
        )
      : reduced
        ? 0
        : (time % (clip === "Run" ? 0.8 : 2)) / (clip === "Run" ? 0.8 : 2),
    releasePhase: p.hero === "ranger" ? 0 : undefined,
    stage: p.stage,
  };
}
