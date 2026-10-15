import { Simulation, type InputFrame } from "./GameLoop";
import type { Hero } from "./CombatSystem";
export const WAVES = [20, 24, 28, 32, 40] as const;
export const UPGRADES = [
  {
    id: "edge",
    name: "Keen edge",
    description: "All damage +20%",
    apply: (s: Simulation) => {
      s.player.damageMult += 0.2;
    },
  },
  {
    id: "heart",
    name: "Second wind",
    description: "Maximum health +25; heal 35",
    apply: (s: Simulation) => {
      s.player.maxHp += 25;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 35);
    },
  },
  {
    id: "stride",
    name: "Fleet foot",
    description: "Movement speed +12%",
    apply: (s: Simulation) => {
      s.player.speedMult += 0.12;
    },
  },
  {
    id: "sun",
    name: "Overcharge",
    description: "Special and bomb damage +30%; gain 50 charge",
    apply: (s: Simulation) => {
      s.player.specialMult += 0.3;
      s.player.charge = Math.min(100, s.player.charge + 50);
    },
  },
  {
    id: "leech",
    name: "Life siphon",
    description: "Every defeat restores 3 health",
    apply: (s: Simulation) => {
      s.player.lifesteal += 3;
    },
  },
  {
    id: "supply",
    name: "Demolition kit",
    description: "Gain 2 bombs (carry up to 3)",
    apply: (s: Simulation) => {
      s.player.bombs = Math.min(3, s.player.bombs + 2);
    },
  },
  {
    id: "pierce",
    name: "Split shaft",
    description: "Arrows pierce one more enemy; all damage +10%",
    apply: (s: Simulation) => {
      s.player.pierce++;
      s.player.damageMult += 0.1;
    },
  },
];
export class RunDirector {
  state: "select" | "fighting" | "upgrade" | "victory" | "defeat" = "select";
  wave = 0;
  choices: typeof UPGRADES = [];
  build: string[] = [];
  message = "Collect glowing field drops by walking near them.";
  private claimed = new Set<number>();
  private dropId = 0;
  private rewardedKills = 0;
  private clearTime = 0;
  constructor(
    readonly sim: Simulation,
    public seed = 4242,
  ) {}
  start(hero: Hero) {
    this.sim.reset(0);
    this.sim.respawning = false;
    this.sim.pickups = [];
    this.sim.player.hero = hero;
    this.sim.player.bombs = 1;
    this.sim.player.charge = 50;
    if (hero === "ranger") {
      this.sim.player.maxHp = 85;
      this.sim.player.hp = 85;
    }
    this.wave = 0;
    this.build = [];
    this.dropId = 0;
    this.rewardedKills = 0;
    this.message =
      "Clear five waves. F / RB spends a bomb. Walk over drops to collect.";
    this.nextWave();
  }
  private nextWave() {
    this.wave++;
    this.state = "fighting";
    this.clearTime = 0;
    this.claimed.clear();
    const s = this.sim,
      p = s.player;
    s.combat.reset();
    p.swing = 0;
    p.buffer = 0;
    p.specialTimer = 0;
    s.enemies.spawn(WAVES[this.wave - 1]!, this.seed + this.wave * 997);
    for (const e of s.enemies.enemies) {
      if (Math.hypot(e.x - p.x, e.z - p.z) < 8) {
        e.x = Math.max(
          -22,
          Math.min(22, p.x + (p.x > 0 ? -1 : 1) * (8 + (e.id % 5))),
        );
        e.z = Math.max(
          -22,
          Math.min(22, p.z + (p.z > 0 ? -1 : 1) * (5 + (e.id % 4))),
        );
      }
    }
  }
  choose(index: number) {
    if (this.state !== "upgrade") return;
    const upgrade = this.choices[index];
    if (!upgrade) return;
    upgrade.apply(this.sim);
    this.build.push(upgrade.name);
    this.sim.player.hp = Math.min(
      this.sim.player.maxHp,
      this.sim.player.hp + 20,
    );
    this.message = upgrade.name + " acquired · +20 health between waves";
    this.nextWave();
  }
  private collect(kind: Simulation["pickups"][number]["kind"]) {
    const p = this.sim.player;
    if (kind === "health") {
      p.hp = Math.min(p.maxHp, p.hp + 22);
      this.message = "Vitality · +22 health";
    }
    if (kind === "charge") {
      p.charge = Math.min(100, p.charge + 25);
      this.message = "Energy · +25 special charge";
    }
    if (kind === "power") {
      p.damageMult += 0.04;
      this.message = "Power shard · +4% damage for this run";
    }
    if (kind === "bomb") {
      p.bombs = Math.min(3, p.bombs + 1);
      this.message = "Bomb collected · F / RB · carry up to 3";
    }
  }
  step(input: InputFrame, dt = 1 / 60) {
    if (this.state !== "fighting") return;
    // Restart is a menu action in run mode; simulation reset remains available in practice.
    this.sim.step({ ...input, respawn: false }, dt);
    if (this.sim.player.hp <= 0) {
      this.state = "defeat";
      return;
    }
    for (const e of this.sim.enemies.enemies) {
      if (e.state !== "dead" || this.claimed.has(e.id)) continue;
      this.claimed.add(e.id);
      const n = ++this.rewardedKills;
      const kind =
        n % 9 === 0
          ? "bomb"
          : n % 5 === 0
            ? "health"
            : n % 3 === 0
              ? "charge"
              : "power";
      this.sim.pickups.push({ id: this.dropId++, x: e.x, z: e.z, kind });
    }
    const p = this.sim.player;
    this.sim.pickups = this.sim.pickups.filter((item) => {
      if (Math.hypot(item.x - p.x, item.z - p.z) > 2) return true;
      if (
        (item.kind === "health" && p.hp >= p.maxHp) ||
        (item.kind === "bomb" && p.bombs >= 3) ||
        (item.kind === "charge" && p.charge >= 100)
      )
        return true;
      this.collect(item.kind);
      return false;
    });
    if (this.sim.enemies.enemies.every((e) => e.state === "dead")) {
      this.clearTime += dt;
      if (this.clearTime < 1) return;
      // Sweep remaining rewards before the choice so the final drop cannot be lost.
      for (const item of this.sim.pickups) this.collect(item.kind);
      this.sim.pickups = [];
      if (this.wave === WAVES.length) {
        this.state = "victory";
        return;
      }
      this.state = "upgrade";
      const pool = UPGRADES.filter(
        (u) => p.hero === "ranger" || u.id !== "pierce",
      );
      let rng = (this.seed + this.wave * 7919) >>> 0;
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        const j = rng % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      this.choices = shuffled.slice(0, 3);
    }
  }
}
