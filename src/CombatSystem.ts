import { ENEMY_TYPES, type Enemy } from "./EnemyStore";
import { SpatialGrid } from "./SpatialGrid";
export const SPECIAL = {
  cost: 100,
  duration: 0.85,
  impactAt: 0.16,
  radius: 6.5,
  damage: 80,
} as const;
export type Hero = "vanguard" | "ranger";
export interface Player {
  hero: Hero;
  maxHp: number;
  damageMult: number;
  speedMult: number;
  specialMult: number;
  pierce: number;
  lifesteal: number;
  bombs: number;
  bombTimer: number;
  bombX: number;
  bombZ: number;
  shotCooldown: number;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  recovery: number;
  stage: number;
  swing: number;
  buffer: number;
  comboWindow: number;
  kills: number;
  hitFlash: number;
  charge: number;
  specialTimer: number;
  specialX: number;
  specialZ: number;
  specials: number;
  hits: number;
  impact: number;
  dashTimer: number;
  dashCooldown: number;
  dashX: number;
  dashZ: number;
}
export const newPlayer = (): Player => ({
  hero: "vanguard",
  maxHp: 100,
  damageMult: 1,
  speedMult: 1,
  specialMult: 1,
  pierce: 0,
  lifesteal: 0,
  bombs: 0,
  bombTimer: 0,
  bombX: 0,
  bombZ: 0,
  shotCooldown: 0,
  x: 0,
  z: 0,
  yaw: 0,
  hp: 100,
  recovery: 0,
  stage: 0,
  swing: 0,
  buffer: 0,
  comboWindow: 0,
  kills: 0,
  hitFlash: 0,
  charge: 0,
  specialTimer: 0,
  specialX: 0,
  specialZ: 0,
  specials: 0,
  hits: 0,
  impact: 0,
  dashTimer: 0,
  dashCooldown: 0,
  dashX: 0,
  dashZ: 1,
});
export interface Arrow {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  remaining: number;
  hit: Set<number>;
}
export class CombatSystem {
  arrows: Arrow[] = [];
  aim(p: Player, grid: SpatialGrid) {
    return grid
      .query(p.x, p.z, 18)
      .filter((e) => {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        return (
          e.state !== "dead" &&
          (d < 1 ||
            ((e.x - p.x) * Math.sin(p.yaw) + (e.z - p.z) * Math.cos(p.yaw)) /
              d >
              0.5)
        );
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z) ||
          a.id - b.id,
      )[0];
  }
  advanceArrows(p: Player, grid: SpatialGrid, dt: number) {
    if (p.hp <= 0) {
      this.arrows = [];
      return;
    }
    for (const a of this.arrows) {
      const travel = Math.min(dt, a.life);
      const dx = a.vx * travel,
        dz = a.vz * travel,
        length2 = dx * dx + dz * dz;
      const hits = grid
        .query(a.x + dx / 2, a.z + dz / 2, Math.sqrt(length2) / 2 + 0.65)
        .map((e) => {
          const t = length2
            ? Math.max(
                0,
                Math.min(1, ((e.x - a.x) * dx + (e.z - a.z) * dz) / length2),
              )
            : 0;
          const projection = length2
            ? ((e.x - a.x) * dx + (e.z - a.z) * dz) / length2
            : 0;
          const perpendicular2 =
            (e.x - a.x) ** 2 + (e.z - a.z) ** 2 - projection ** 2 * length2;
          const entry = length2
            ? Math.max(
                0,
                projection -
                  Math.sqrt(Math.max(0, 0.65 ** 2 - perpendicular2) / length2),
              )
            : 0;
          return {
            e,
            t: entry,
            d: Math.hypot(e.x - a.x - dx * t, e.z - a.z - dz * t),
          };
        })
        .filter(
          (h) => h.d <= 0.65 && h.e.state !== "dead" && !a.hit.has(h.e.id),
        )
        .sort((a, b) => a.t - b.t || a.e.id - b.e.id);
      for (const { e } of hits) {
        a.hit.add(e.id);
        this.applyHit(p, e, 32 * ENEMY_TYPES[e.kind].armor, false);
        if (--a.remaining <= 0) break;
      }
      a.x += dx;
      a.z += dz;
      a.life -= dt;
    }
    this.arrows = this.arrows.filter(
      (a) =>
        a.life > 0 &&
        a.remaining > 0 &&
        Math.abs(a.x) < 24 &&
        Math.abs(a.z) < 24,
    );
  }
  private hit = new Set<number>();
  private specialFired = false;
  reset() {
    this.hit.clear();
    this.arrows = [];
    this.specialFired = false;
  }
  damage(p: Player, amount: number) {
    if (p.hp <= 0 || p.recovery > 0 || p.specialTimer > 0 || p.dashTimer > 0)
      return false;
    p.hp = Math.max(0, p.hp - amount);
    p.recovery = 0.65;
    p.hitFlash = 0.2;
    return true;
  }
  step(
    p: Player,
    grid: SpatialGrid,
    attack: boolean,
    dt: number,
    special = false,
  ) {
    p.shotCooldown = Math.max(0, p.shotCooldown - dt);
    p.bombTimer = Math.max(0, p.bombTimer - dt);
    p.recovery = Math.max(0, p.recovery - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.impact = Math.max(0, p.impact - dt);
    p.comboWindow = Math.max(0, p.comboWindow - dt);
    if (p.hp <= 0) {
      p.swing = 0;
      p.specialTimer = 0;
      p.buffer = 0;
      return;
    }
    if (
      special &&
      p.charge >= SPECIAL.cost &&
      p.specialTimer <= 0 &&
      p.dashTimer <= 0
    ) {
      p.charge -= SPECIAL.cost;
      p.specialTimer = SPECIAL.duration;
      p.specialX = p.x;
      p.specialZ = p.z;
      if (p.hero === "ranger") {
        const target = this.aim(p, grid);
        p.specialX = Math.max(
          -23,
          Math.min(23, target?.x ?? p.x + Math.sin(p.yaw) * 8),
        );
        p.specialZ = Math.max(
          -23,
          Math.min(23, target?.z ?? p.z + Math.cos(p.yaw) * 8),
        );
      }
      p.specials++;
      p.swing = 0;
      p.buffer = 0;
      p.comboWindow = 0;
      p.stage = 0;
      this.specialFired = false;
    }
    if (p.specialTimer > 0) {
      p.specialTimer = Math.max(0, p.specialTimer - dt);
      if (
        !this.specialFired &&
        SPECIAL.duration - p.specialTimer >= SPECIAL.impactAt
      ) {
        this.specialFired = true;
        for (const enemy of grid.query(
          p.specialX,
          p.specialZ,
          p.hero === "ranger" ? 4.5 : SPECIAL.radius,
        ))
          this.applyHit(
            p,
            enemy,
            p.hero === "ranger" ? 105 : SPECIAL.damage,
            true,
          );
        p.impact = 0.3;
      }
      return;
    }
    if (p.dashTimer > 0) {
      p.buffer = 0;
      return;
    }
    if (p.hero === "ranger") {
      if (attack && p.shotCooldown <= 0 && p.recovery <= 0) {
        const target = this.aim(p, grid);
        if (target) p.yaw = Math.atan2(target.x - p.x, target.z - p.z);
        this.arrows.push({
          x: p.x,
          z: p.z,
          vx: Math.sin(p.yaw) * 24,
          vz: Math.cos(p.yaw) * 24,
          life: 0.8,
          remaining: 1 + p.pierce,
          hit: new Set(),
        });
        p.shotCooldown = 0.32;
        p.swing = 0.18;
        p.stage = 1;
      }
      p.swing = Math.max(0, p.swing - dt);
      return;
    }
    if (attack) p.buffer = 0.22;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.swing <= 0 && p.buffer > 0 && p.recovery <= 0) {
      p.stage = p.comboWindow > 0 ? (p.stage % 3) + 1 : 1;
      p.swing = 0.38;
      p.buffer = 0;
      this.hit.clear();
    }
    if (p.swing > 0) {
      p.swing = Math.max(0, p.swing - dt);
      if (p.swing <= 0.29 && p.swing >= 0.1) {
        for (const e of grid.query(p.x, p.z, 2.8)) {
          const dx = e.x - p.x,
            dz = e.z - p.z,
            d = Math.hypot(dx, dz);
          if (
            d < 0.01 ||
            (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d >
              Math.cos(Math.PI * 0.42)
          )
            this.strike(p, e);
        }
      }
      if (p.swing === 0) p.comboWindow = 0.28;
    }
  }
  strike(p: Player, e: Enemy) {
    if (p.hp <= 0 || this.hit.has(e.id) || e.state === "dead") return false;
    this.hit.add(e.id);
    const damage =
      p.stage === 3 ? 40 : Math.ceil(25 * ENEMY_TYPES[e.kind].armor);
    this.applyHit(p, e, damage, false);
    return true;
  }
  applyHit(p: Player, e: Enemy, damage: number, special: boolean) {
    if (e.state === "dead") return;
    const scaledDamage = damage * p.damageMult * (special ? p.specialMult : 1);
    // Decimal stat stacks can drift just above an integer (e.g. 28.000000000004).
    e.hp = Math.max(0, e.hp - Math.ceil(scaledDamage - 1e-9));
    e.flash = 0.18;
    p.hits++;
    p.impact = 0.1;
    const distance = Math.hypot(e.x - p.x, e.z - p.z);
    const x = distance > 0.01 ? (e.x - p.x) / distance : Math.sin(p.yaw);
    const z = distance > 0.01 ? (e.z - p.z) / distance : Math.cos(p.yaw);
    const armored = e.kind === "armored" && !special && p.stage < 3;
    const force = special ? 14 : armored ? 2 : p.stage === 3 ? 10 : 7;
    e.vx = x * force;
    e.vz = z * force;
    if (e.hp === 0) {
      e.state = "dead";
      e.timer = 5;
      p.kills++;
      p.hp = Math.min(p.maxHp, p.hp + p.lifesteal);
    } else if (!(armored && e.state === "windup")) {
      e.state = "stagger";
      e.timer = special ? 0.8 : armored ? 0.18 : 0.4;
    }
    if (!special)
      p.charge = Math.min(SPECIAL.cost, p.charge + 10 + (e.hp === 0 ? 10 : 0));
  }
}
