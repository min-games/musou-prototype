import { ENEMY_TYPES, type Enemy } from "./EnemyStore";
import type { Player } from "./CombatSystem";
import { CombatSystem } from "./CombatSystem";
import { SpatialGrid } from "./SpatialGrid";
export class CrowdSystem {
  step(
    enemies: Enemy[],
    p: Player,
    combat: CombatSystem,
    grid: SpatialGrid,
    dt: number,
  ) {
    for (const e of enemies) {
      if (e.state === "dead") continue;
      const type = ENEMY_TYPES[e.kind];
      e.timer = Math.max(0, e.timer - dt);
      const dx = p.x - e.x,
        dz = p.z - e.z,
        d = Math.hypot(dx, dz) || 0.001;
      if (e.state === "stagger") {
        e.x = Math.max(-23, Math.min(23, e.x + e.vx * dt));
        e.z = Math.max(-23, Math.min(23, e.z + e.vz * dt));
        e.vx *= 0.88;
        e.vz *= 0.88;
        if (e.timer === 0) e.state = "pursuit";
        continue;
      }
      if (e.state === "windup") {
        if (e.timer === 0) {
          e.state = "attack";
          e.timer = type.recovery;
          const facing =
            (dx * Math.sin(e.attackYaw) + dz * Math.cos(e.attackYaw)) / d;
          if (
            d < type.range &&
            facing > Math.cos(0.8) &&
            combat.damage(p, type.damage)
          ) {
            p.x = Math.max(-23, Math.min(23, p.x + (dx / d) * 0.35));
            p.z = Math.max(-23, Math.min(23, p.z + (dz / d) * 0.35));
          }
        }
        continue;
      }
      if (e.state === "attack") {
        if (e.timer === 0) e.state = "pursuit";
        continue;
      }
      if (p.hp <= 0) continue;
      if (d < type.reach) {
        e.state = "windup";
        e.timer = type.windup + (e.id % 3) * 0.02;
        e.attackYaw = Math.atan2(dx, dz);
        continue;
      }
      let sx = 0,
        sz = 0;
      for (const n of grid.query(e.x, e.z, 0.85)) {
        if (n.id === e.id || n.state === "dead") continue;
        const nx = e.x - n.x,
          nz = e.z - n.z,
          nd = Math.hypot(nx, nz);
        if (nd > 0.001) {
          sx += (nx / nd) * (0.85 - nd) * 2;
          sz += (nz / nd) * (0.85 - nd) * 2;
        }
      }
      const side =
        e.kind === "flanker" && d > 3 ? (e.id % 2 === 0 ? 0.65 : -0.65) : 0;
      const mx = (dx * Math.cos(side) - dz * Math.sin(side)) / d;
      const mz = (dz * Math.cos(side) + dx * Math.sin(side)) / d;
      e.x = Math.max(-23, Math.min(23, e.x + (mx * type.speed + sx) * dt));
      e.z = Math.max(-23, Math.min(23, e.z + (mz * type.speed + sz) * dt));
    }
  }
}
