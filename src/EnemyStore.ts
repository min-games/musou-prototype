export type EnemyState = "pursuit" | "windup" | "attack" | "stagger" | "dead";
export interface Enemy {
  id: number;
  x: number;
  z: number;
  hp: number;
  state: EnemyState;
  timer: number;
  vx: number;
  vz: number;
}
export class EnemyStore {
  enemies: Enemy[] = [];
  private randomState = 42;
  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  spawn(count: number, seed = 42) {
    this.randomState = seed >>> 0;
    this.enemies = Array.from({ length: count }, (_, id) => {
      const a = this.random() * Math.PI * 2,
        r = 4 + this.random() * 16;
      return {
        id,
        x: Math.sin(a) * r,
        z: Math.cos(a) * r,
        hp: 60,
        state: "pursuit",
        timer: 0,
        vx: 0,
        vz: 0,
      };
    });
  }
  advanceRespawns(dt: number, playerX: number, playerZ: number) {
    for (const enemy of this.enemies) {
      if (enemy.state !== "dead") continue;
      enemy.timer = Math.max(0, enemy.timer - dt);
      if (enemy.timer > 0) continue;
      const angle = this.random() * Math.PI * 2;
      const distance = 10 + this.random() * 8;
      Object.assign(enemy, {
        x: Math.max(-23, Math.min(23, playerX + Math.sin(angle) * distance)),
        z: Math.max(-23, Math.min(23, playerZ + Math.cos(angle) * distance)),
        hp: 60,
        state: "pursuit",
        timer: 0,
        vx: 0,
        vz: 0,
      });
    }
  }
}
