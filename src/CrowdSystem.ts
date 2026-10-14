import type { Enemy } from "./EnemyStore";
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
      e.timer = Math.max(0, e.timer - dt);
      const dx = p.x - e.x,
        dz = p.z - e.z,
        d = Math.hypot(dx, dz) || 0.001;
      if (e.state === "stagger") {
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.vx *= 0.88;
        e.vz *= 0.88;
        if (e.timer === 0) e.state = "pursuit";
        continue;
      }
      if (e.state === "windup") {
        if (e.timer === 0) {
          e.state = "attack";
          e.timer = 0.6;
          if (d < 1.8 && combat.damage(p, 9)) {
            p.x += (dx / d) * 0.35;
            p.z += (dz / d) * 0.35;
          }
        }
        continue;
      }
      if (e.state === "attack") {
        if (e.timer === 0) e.state = "pursuit";
        continue;
      }
      if (p.hp <= 0) continue;
      if (d < 1.45) {
        e.state = "windup";
        e.timer = 0.5 + (e.id % 5) * 0.03;
        continue;
      }
      let sx = 0,
        sz = 0;
      for (const n of grid.query(e.x, e.z, 0.85)) {
        if (n.id === e.id) continue;
        const nx = e.x - n.x,
          nz = e.z - n.z,
          nd = Math.hypot(nx, nz);
        if (nd > 0.001) {
          sx += (nx / nd) * (0.85 - nd) * 2;
          sz += (nz / nd) * (0.85 - nd) * 2;
        }
      }
      e.x += ((dx / d) * 2.15 + sx) * dt;
      e.z += ((dz / d) * 2.15 + sz) * dt;
    }
  }
}
