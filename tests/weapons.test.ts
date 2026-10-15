import { describe, expect, it } from "vitest";
import { WEAPONS, weaponStats, type WeaponId } from "../src/Weapons";
import { Simulation, idleInput, GameLoop } from "../src/GameLoop";
import { RunDirector, UPGRADES } from "../src/RunDirector";
function setup(id: WeaponId, count = 1) {
  const s = new Simulation(count);
  s.player.hero = WEAPONS[id].hero;
  s.player.weapon = id;
  s.enemies.enemies.forEach((e) => {
    e.x = 0;
    e.z = 1;
    e.hp = 1e9;
    e.maxHp = 1e9;
  });
  s.grid.rebuild(s.enemies.enemies);
  return s;
}
function tick(s: Simulation, attack = false) {
  s.combat.step(s.player, s.grid, attack, 1 / 60);
  s.combat.advanceArrows(s.player, s.grid, 1 / 60);
}
describe("authoritative weapon statistics", () => {
  for (const id of Object.keys(WEAPONS) as WeaponId[])
    it(`${id}: advertised ideal DPS matches sustained actual damage at 60Hz`, () => {
      const s = setup(id),
        stats = weaponStats(s.player);
      const attacks = s.player.hero === "ranger" ? 60 : 30;
      const ticks = Math.round(stats.period * 60) * attacks;
      for (let i = 0; i < ticks; i++) tick(s, true);
      if (s.player.hero === "ranger") for (let i = 0; i < 120; i++) tick(s);
      expect(s.player.attacks).toBe(attacks);
      expect(s.player.hits).toBe(attacks);
      const damage = 1e9 - s.enemies.enemies[0]!.hp;
      expect(damage / (ticks / 60)).toBeCloseTo(stats.dps, 8);
    });
  it("speed upgrades change firing cadence, not only the displayed number", () => {
    const normal = setup("shortbow"),
      fast = setup("shortbow");
    fast.player.attackSpeedMult = 1.6;
    for (let i = 0; i < 120; i++) {
      tick(normal, true);
      tick(fast, true);
    }
    expect(fast.player.attacks).toBeGreaterThan(normal.player.attacks);
    expect(fast.player.attacks).toBe(
      Math.ceil(120 / Math.round(weaponStats(fast.player).period * 60)),
    );
  });
  it("reach upgrades extend real melee queries and spear keeps a narrower arc", () => {
    const a = setup("saber"),
      b = setup("saber");
    b.player.rangeMult = 1.15;
    for (const s of [a, b]) {
      s.enemies.enemies[0]!.z = 3.2;
      s.grid.rebuild(s.enemies.enemies);
      tick(s, true);
      for (let i = 0; i < 20; i++) tick(s);
    }
    expect(a.player.hits).toBe(0);
    expect(b.player.hits).toBe(1);
    const spear = setup("spear", 2);
    spear.enemies.enemies[0]!.z = 4.4;
    spear.enemies.enemies[1]!.x = 3;
    spear.enemies.enemies[1]!.z = 1;
    spear.grid.rebuild(spear.enemies.enemies);
    tick(spear, true);
    for (let i = 0; i < 25; i++) tick(spear);
    expect(spear.enemies.enemies[0]!.hp).toBe(1e9 - 34);
    expect(spear.enemies.enemies[1]!.hp).toBe(1e9);
  });
  it("longbow and reach upgrades extend arrow travel beyond the shortbow", () => {
    for (const [id, mult, hit] of [
      ["shortbow", 1, false],
      ["longbow", 1, true],
      ["shortbow", 1.3, true],
    ] as const) {
      const s = setup(id);
      s.player.rangeMult = mult;
      s.enemies.enemies[0]!.z = 22;
      s.grid.rebuild(s.enemies.enemies);
      tick(s, true);
      for (let i = 0; i < 100; i++) tick(s);
      expect(s.player.hits > 0).toBe(hit);
    }
  });
  it("caps stat upgrades and never shrinks an active melee window below a fixed tick", () => {
    const s = setup("saber");
    s.player.attackSpeedMult = 100;
    s.player.rangeMult = 100;
    s.player.extraArrows = 100;
    expect(weaponStats(s.player).period).toBeGreaterThanOrEqual(6 / 60);
    expect(weaponStats(s.player).range).toBe(2.8 * 1.75);
    tick(s, true);
    for (let i = 0; i < 12; i++) tick(s);
    expect(s.player.hits).toBe(1);
    s.player.hero = "ranger";
    s.player.weapon = "fanbow";
    expect(weaponStats(s.player).arrows).toBe(7);
    for (let i = 0; i < 30; i++) {
      UPGRADES.find((u) => u.id === "haste")!.apply(s);
      UPGRADES.find((u) => u.id === "reach")!.apply(s);
    }
    expect(s.player.attackSpeedMult).toBe(2.5);
    expect(s.player.rangeMult).toBe(1.75);
  });
});
describe("multishot and run loadouts", () => {
  it("fires a symmetrical fan and damages three separate targets", () => {
    const s = setup("fanbow", 3);
    s.enemies.enemies.forEach((e, i) => {
      e.z = 10;
      e.x = i === 0 ? 0 : i === 1 ? -1.6 : 1.6;
    });
    s.grid.rebuild(s.enemies.enemies);
    s.combat.step(s.player, s.grid, true, 1 / 60);
    expect(s.combat.arrows).toHaveLength(3);
    expect(s.combat.arrows[0]!.vx).toBeCloseTo(-s.combat.arrows[2]!.vx);
    for (let i = 0; i < 60; i++) tick(s);
    expect(s.player.hits).toBe(3);
    expect(s.player.charge).toBe(30);
    expect(s.enemies.enemies.map((e) => e.hp)).toEqual([
      1e9 - 23,
      1e9 - 23,
      1e9 - 23,
    ]);
  });
  it("deduplicates a point-blank target across all arrows in a volley", () => {
    const s = setup("fanbow");
    s.player.extraArrows = 4;
    tick(s, true);
    for (let i = 0; i < 60; i++) tick(s);
    expect(s.player.hits).toBe(1);
    expect(s.player.charge).toBe(10);
    expect(s.enemies.enemies[0]!.hp).toBe(1e9 - 23);
  });
  it("combines fan coverage with piercing while keeping one damage event per target", () => {
    const s = setup("fanbow", 6);
    s.player.pierce = 1;
    s.enemies.enemies.forEach((e, i) => {
      const beam = (i % 3) - 1;
      e.z = i < 3 ? 6 : 10;
      e.x = Math.tan(beam * 0.16) * e.z;
    });
    // Aim at the middle lane instead of letting assist turn toward an outer lane.
    s.enemies.enemies[0]!.x = 0;
    s.enemies.enemies[1]!.x = -Math.tan(0.16) * 6;
    s.grid.rebuild(s.enemies.enemies);
    tick(s, true);
    for (let i = 0; i < 60; i++) tick(s);
    expect(s.player.hits).toBe(6);
  });
  it("starts the chosen weapon, preserves it through waves and resets its upgrades on retry", () => {
    const s = new Simulation(0),
      run = new RunDirector(s);
    run.start("ranger", "fanbow");
    s.player.extraArrows = 4;
    s.player.attackSpeedMult = 1.4;
    s.player.rangeMult = 1.3;
    for (const e of s.enemies.enemies)
      s.combat.applyHit(s.player, e, 10000, true);
    for (let i = 0; i < 61; i++) run.step(idleInput);
    run.choose(0);
    expect(s.player.weapon).toBe("fanbow");
    expect(s.player.extraArrows).toBe(4);
    run.start("ranger", "fanbow");
    expect(s.player.extraArrows).toBe(0);
    expect(s.player.attackSpeedMult).toBe(1);
    expect(s.player.rangeMult).toBe(1);
    run.start("vanguard", "longbow");
    expect(s.player.weapon).toBe("saber");
  });
  it("remains deterministic with seven arrows, speed, reach and piercing at different render cadences", () => {
    const a = setup("fanbow", 20),
      b = setup("fanbow", 20),
      la = new GameLoop(),
      lb = new GameLoop();
    for (const s of [a, b]) {
      s.player.extraArrows = 4;
      s.player.attackSpeedMult = 2;
      s.player.rangeMult = 1.5;
      s.player.pierce = 2;
    }
    for (let i = 0; i < 120; i++)
      la.advance(1 / 60, () => a.step({ ...idleInput, attackHeld: true }));
    for (let i = 0; i < 40; i++)
      lb.advance(0.05, () => b.step({ ...idleInput, attackHeld: true }));
    expect(a).toEqual(b);
  });
});

it("keeps the Ranger special's targeting reach independent of bow upgrades", () => {
  const s = setup("longbow");
  s.player.rangeMult = 1.75;
  s.player.charge = 100;
  s.enemies.enemies[0]!.z = 22;
  s.grid.rebuild(s.enemies.enemies);
  expect(s.combat.aim(s.player, s.grid)?.id).toBe(0);
  s.combat.step(s.player, s.grid, false, 1 / 60, true);
  expect(s.player.specialZ).toBe(8);
});

it("allows safe rearming between waves while preserving bonuses and forbids combat swaps", () => {
  const s = new Simulation(0),
    run = new RunDirector(s);
  run.start("vanguard", "saber");
  s.player.attackSpeedMult = 1.3;
  s.player.rangeMult = 1.15;
  s.player.damageMult = 1.2;
  expect(run.equip("spear")).toBe(false);
  expect(s.player.weapon).toBe("saber");
  for (const e of s.enemies.enemies)
    s.combat.applyHit(s.player, e, 10000, true);
  for (let i = 0; i < 61; i++) run.step(idleInput);
  expect(run.equip("longbow")).toBe(false);
  expect(run.equip("spear")).toBe(true);
  expect(s.player.weapon).toBe("spear");
  expect(s.player.attackSpeedMult).toBe(1.3);
  expect(s.player.rangeMult).toBe(1.15);
  expect(s.player.damageMult).toBeGreaterThan(1.2);
  expect(s.player.kills).toBe(20);
  expect(run.wave).toBe(1);
  expect(run.state).toBe("upgrade");
  const offers = run.choices.map((u) => u.id);
  run.equip("spear");
  expect(run.choices.map((u) => u.id)).toEqual(offers);
});
it("keeps upgraded melee DPS tied to actual combo damage and quantized attack speed", () => {
  const s = setup("saber");
  s.player.damageMult = 1.12;
  s.player.attackSpeedMult = 1.3;
  const stats = weaponStats(s.player),
    ticks = Math.round(stats.period * 60) * 30;
  for (let i = 0; i < ticks; i++) tick(s, true);
  expect((1e9 - s.enemies.enemies[0]!.hp) / (ticks / 60)).toBeCloseTo(
    stats.dps,
    8,
  );
});
it("matches upgraded seven-arrow crowd DPS when every lane hits an unarmored target", () => {
  const s = setup("fanbow", 14);
  s.player.extraArrows = 4;
  s.player.pierce = 1;
  s.player.rangeMult = 1.3;
  s.player.damageMult = 1.12;
  s.player.attackSpeedMult = 1.3;
  const lanes = [0, -3, -2, -1, 1, 2, 3];
  s.enemies.enemies.forEach((e, i) => {
    e.kind = "grunt";
    e.z = i < 7 ? 8 : 12;
    e.x = Math.tan(lanes[i % 7]! * 0.16) * e.z;
  });
  s.grid.rebuild(s.enemies.enemies);
  const stats = weaponStats(s.player),
    ticks = Math.round(stats.period * 60) * 60;
  for (let i = 0; i < ticks; i++) tick(s, true);
  for (let i = 0; i < 120; i++) tick(s);
  const total = s.enemies.enemies.reduce((sum, e) => sum + 1e9 - e.hp, 0);
  expect(s.player.attacks).toBe(60);
  expect(s.player.hits).toBe(840);
  expect(total / (ticks / 60)).toBeCloseTo(stats.crowdDps, 8);
});
