import { test, expect } from "./fixtures";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "evidence/weapon-motion-v1";
mkdirSync(out, { recursive: true });
test.use({ serviceWorkers: "block" });
const url = "/?practice=1&backend=webgl&art=blender&artCloseup=1";
test("all exported weapons keep calibrated grips, real skinned props and distinct planted poses", async ({
  page,
}) => {
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).musou);
  const results = await page.evaluate(() => {
    const m = (window as any).musou,
      s = m.sim,
      r = m.renderer;
    m.pause(true);
    s.reset(0);
    s.player.yaw = Math.PI;
    let ticks = 0;
    const rows: any[] = [];
    for (const weapon of [
      "saber",
      "spear",
      "greatblade",
      "shortbow",
      "longbow",
      "fanbow",
    ])
      for (const stage of weapon === "saber" ? [1, 2, 3] : [1]) {
        s.player.hero = weapon.includes("bow") ? "ranger" : "vanguard";
        s.player.weapon = weapon;
        s.player.stage = stage;
        const period = (
          {
            saber: 0.38,
            spear: 0.5,
            greatblade: 0.68,
            shortbow: 20 / 60,
            longbow: 38 / 60,
            fanbow: 32 / 60,
          } as any
        )[weapon];
        const samples: any[] = [];
        for (let k = 0; k < 65; k++) {
          const phase = k / 65;
          s.ticks = ticks++;
          s.player.swingDuration = period;
          s.player.swing = period * (1 - phase);
          s.player.shotCooldown = period * (1 - phase);
          r.render(s, 0, 0.8);
          r.render(s, 0, 0.8);
          const i = r.characters.instances.get(r.player);
          const pos = (name: string) => i.nodes.get(name).getAbsolutePosition();
          const grip = pos("grip." + (s.player.hero === "ranger" ? "L" : "R")),
            socket = pos("socket." + weapon);
          const a = i.nodes
              .get("grip." + (s.player.hero === "ranger" ? "L" : "R"))
              .getWorldMatrix(),
            b = i.nodes.get("socket." + weapon).getWorldMatrix();
          const orientation = Math.max(
            ...[0, 1, 2].map((axis) => {
              const av = a.getRow(axis),
                bv = b.getRow(axis);
              return Math.hypot(av.x - bv.x, av.y - bv.y, av.z - bv.z);
            }),
          );
          const support =
            weapon === "spear" || weapon === "greatblade"
              ? pos("grip.L")
                  .subtract(pos("support." + weapon))
                  .length()
              : null;
          const string =
            s.player.hero === "ranger"
              ? pos("grip.R")
                  .subtract(pos("stringpoint." + weapon))
                  .length()
              : null;
          let propSupportSkin = Infinity,
            handSkin = Infinity,
            propSkin = Infinity,
            sole = Infinity;
          if (k % 8 === 0) {
            for (const mesh of i.root
              .getChildMeshes()
              .filter((n: any) => n.skeleton)) {
              mesh.computeWorldMatrix(true);
              mesh.skeleton.prepare(true);
              const p = mesh.getPositionData(true, true),
                indices = mesh.getVerticesData("matricesIndices"),
                weights = mesh.getVerticesData("matricesWeights");
              const isProp = mesh.name.includes("prop." + weapon);
              for (let v = 0; v < p.length / 3; v++) {
                const bone = mesh.skeleton.bones[indices[v * 4]],
                  point = socket.clone();
                point.set(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
                const world = point.constructor.TransformCoordinates(
                  point,
                  mesh.getWorldMatrix(),
                );
                if (
                  bone?.name.includes(
                    "hand." + (s.player.hero === "ranger" ? "L" : "R"),
                  ) &&
                  weights[v * 4] > 0.99
                )
                  handSkin = Math.min(handSkin, world.subtract(grip).length());
                if (isProp && mesh.isEnabled() && support !== null)
                  propSupportSkin = Math.min(
                    propSupportSkin,
                    world.subtract(pos("grip.L")).length(),
                  );
                if (isProp && mesh.isEnabled())
                  propSkin = Math.min(
                    propSkin,
                    world.subtract(socket).length(),
                  );
                if (bone?.name.includes("foot.") && weights[v * 4] > 0.99)
                  sole = Math.min(sole, world.y);
              }
            }
          }
          samples.push({
            phase,
            clip: i.clip,
            primary: grip.subtract(socket).length(),
            orientation,
            support,
            string,
            handSkin: Number.isFinite(handSkin) ? handSkin : null,
            propSkin: Number.isFinite(propSkin) ? propSkin : null,
            propSupportSkin: Number.isFinite(propSupportSkin)
              ? propSupportSkin
              : null,
            sole: Number.isFinite(sole) ? sole : null,
            hands: { R: pos("grip.R").asArray(), L: pos("grip.L").asArray() },
            knees: { R: pos("shin.R").asArray(), L: pos("shin.L").asArray() },
            hips: pos("pelvis").asArray(),
            enabled: [...i.nodes]
              .filter(
                ([n, node]: any) =>
                  /^prop\.[a-z]+$/.test(n) && node.isEnabled(),
              )
              .map(([n]: any) => n),
          });
        }
        rows.push({ weapon, stage, samples });
      }
    return rows;
  });
  writeFileSync(
    `${out}/browser-world-grips.json`,
    JSON.stringify(results, null, 2),
  );
  for (const row of results)
    for (const s of row.samples) {
      expect(s.primary, `${row.weapon} grip at ${s.phase}`).toBeLessThan(0.002);
      expect(
        s.orientation,
        `${row.weapon} rotation at ${s.phase}`,
      ).toBeLessThan(0.012);
      if (s.support !== null) expect(s.support).toBeLessThan(0.003);
      if (s.string !== null && (s.phase === 0 || s.phase >= 0.34))
        expect(s.string).toBeLessThan(0.003);
      expect(s.enabled).toEqual([`prop.${row.weapon}`]);
      if (s.handSkin !== null) {
        expect(s.handSkin).toBeLessThan(0.055);
        expect(s.propSkin).toBeLessThan(0.04);
        if (s.propSupportSkin !== null)
          expect(s.propSupportSkin).toBeLessThan(0.04);
        expect(s.sole).toBeGreaterThan(-0.006);
      }
    }
  const midpoint = results
    .filter((r: any) => r.stage === 1)
    .map((r: any) => r.samples[32]);
  expect(new Set(midpoint.map((s: any) => JSON.stringify(s.hands))).size).toBe(
    6,
  );
  expect(new Set(midpoint.map((s: any) => JSON.stringify(s.knees))).size).toBe(
    6,
  );
  for (const [weapon, stage, phase] of [
    ["saber", 1, 0.15],
    ["saber", 2, 0.5],
    ["saber", 3, 0.5],
    ["spear", 1, 0.5],
    ["greatblade", 1, 0.18],
    ["greatblade", 1, 0.55],
    ["shortbow", 1, 0],
    ["longbow", 1, 0.12],
    ["fanbow", 1, 0.6],
  ] as const) {
    await page.evaluate(
      ({ weapon, stage, phase }) => {
        const m = (window as any).musou,
          p = m.sim.player;
        p.hero = weapon.includes("bow") ? "ranger" : "vanguard";
        p.weapon = weapon;
        p.stage = stage;
        p.swingDuration = 1;
        p.swing = 1 - phase;
        p.shotCooldown =
          ({ shortbow: 20 / 60, longbow: 38 / 60, fanbow: 32 / 60 } as any)[
            weapon
          ] *
          (1 - phase);
        m.sim.ticks += 2;
        m.renderer.render(m.sim, 0, 0.8);
        m.renderer.render(m.sim, 0, 0.8);
      },
      { weapon, stage, phase },
    );
    await page.screenshot({
      path: `${out}/babylon-${weapon}-${stage}-${phase}.png`,
    });
  }
});

test("real projectile events release immediately, moving fire keeps skinned legs, remote rigs clean up", async ({
  page,
}) => {
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).musou);
  const result = await page.evaluate(() => {
    const m = (window as any).musou,
      s = m.sim,
      r = m.renderer;
    m.pause(true);
    s.reset(0);
    const shots: any[] = [];
    for (const weapon of ["shortbow", "longbow", "fanbow"]) {
      s.player.hero = "ranger";
      s.player.weapon = weapon;
      s.player.shotCooldown = 0;
      s.player.swing = 0;
      s.player.recovery = 0;
      s.player.dashTimer = 0;
      s.combat.arrows = [];
      s.combat.step(s.player, s.grid, true, 1 / 60);
      r.render(s, 0, 0.8);
      const i = r.characters.instances.get(r.player);
      const first = {
        arrows: s.combat.arrows.length,
        phase: i.motion.phase,
        clip: i.clip,
        grip: i.nodes.get("grip.R").getAbsolutePosition().asArray(),
        face: i.nodes.get("head").getAbsolutePosition().asArray(),
        drawDistance: i.nodes
          .get("stringpoint." + weapon)
          .getAbsolutePosition()
          .subtract(i.nodes.get("grip.L").getAbsolutePosition())
          .length(),
      };
      const knees: any[] = [];
      let release: any;
      for (let k = 0; k < 60; k++) {
        s.advancePlayer(
          s.player,
          s.combat,
          {
            x: 0.7,
            z: 0,
            attack: false,
            attackHeld: true,
            dodge: false,
            special: false,
            bomb: false,
          },
          1 / 60,
        );
        s.ticks++;
        r.render(s, 0, 0.8);
        r.render(s, 0, 0.8);
        const j = r.characters.instances.get(r.player);
        if (k === 0)
          release = {
            drawDistance: j.nodes
              .get("stringpoint." + weapon)
              .getAbsolutePosition()
              .subtract(j.nodes.get("grip.L").getAbsolutePosition())
              .length(),
            followThrough: j.nodes
              .get("grip.R")
              .getAbsolutePosition()
              .subtract(
                j.nodes.get("stringpoint." + weapon).getAbsolutePosition(),
              )
              .length(),
          };
        knees.push(
          j.nodes
            .get("shin.R")
            .getAbsolutePosition()
            .subtract(j.root.getAbsolutePosition())
            .asArray(),
        );
      }
      shots.push({ weapon, first, release, knees });
    }
    s.remotePlayers.set("ranger-a", {
      player: { ...s.player, weapon: "shortbow", x: 2, shotCooldown: 0.2 },
      combat: new s.combat.constructor(),
    });
    s.remotePlayers.set("ranger-b", {
      player: { ...s.player, weapon: "fanbow", x: -2, shotCooldown: 0.4 },
      combat: new s.combat.constructor(),
    });
    r.render(s, 0, 0.8);
    const actors = [...r.characters.instances.values()] as any[];
    const independent =
      new Set(actors.map((i) => i.entries.skeletons[0].uniqueId)).size === 3 &&
      new Set(actors.map((i) => i.entries.animationGroups[0])).size === 3;
    const props = actors.map((i) =>
      [...i.nodes]
        .filter(
          ([n, node]: any) => /^prop\.[a-z]+$/.test(n) && node.isEnabled(),
        )
        .map(([n]: any) => n),
    );
    s.remotePlayers.clear();
    r.render(s, 0, 0.8);
    const cleaned = r.characters.metadata().activeActors;
    const old = r.characters.instances.get(r.player);
    s.player.hero = "vanguard";
    s.player.weapon = "greatblade";
    s.player.swing = 0;
    r.render(s, 0, 0.8);
    const changed =
      old.root.isDisposed() && r.characters.metadata().activeActors === 1;
    r.setReducedMotion(true);
    s.player.hero = "ranger";
    s.player.weapon = "longbow";
    s.player.shotCooldown = 0.4;
    s.player.x += 1;
    s.ticks++;
    r.render(s, 0, 0.8);
    const reduced = r.characters.instances.get(r.player).clip;
    s.player.shotCooldown = 0;
    s.player.swing = 0;
    s.ticks++;
    s.player.x += 1;
    r.render(s, 0, 0.8);
    const still = r.characters.instances.get(r.player).clip;
    return { shots, independent, props, cleaned, changed, reduced, still };
  });
  writeFileSync(
    `${out}/browser-event-lifecycle.json`,
    JSON.stringify(result, null, 2),
  );
  for (const shot of result.shots) {
    expect(shot.first.arrows).toBe(shot.weapon === "fanbow" ? 3 : 1);
    expect(shot.first.phase).toBe(0);
    expect(shot.release.drawDistance).toBeLessThan(
      shot.first.drawDistance - 0.035,
    );
    expect(shot.release.followThrough).toBeGreaterThan(0.04);
    expect(shot.first.clip).toMatch(/Shot$/);
    expect(shot.first.grip[1]).toBeGreaterThan(1.7);
    const ys = shot.knees.map((k: any) => k[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.2);
  }
  expect(result.independent).toBe(true);
  expect(result.props.map((p: any) => p[0]).sort()).toEqual([
    "prop.fanbow",
    "prop.fanbow",
    "prop.shortbow",
  ]);
  expect(result.cleaned).toBe(1);
  expect(result.changed).toBe(true);
  expect(result.reduced).toBe("LongbowShot");
  expect(result.still).toBe("Idle");
});

test("Ranger candidate is opt-in and its failure retains playable fallback", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("weapon-motion")) requests++;
  });
  await page.goto("/?practice=1&backend=webgl");
  await page.waitForFunction(() => !!(window as any).musou);
  expect(requests).toBe(0);
  await page.route("**/ranger-weapon-motion-v1.glb", (r) => r.abort());
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).musou);
  const state = await page.evaluate(() => {
    const m = (window as any).musou;
    m.sim.player.hero = "ranger";
    m.sim.player.weapon = "shortbow";
    m.sim.combat.step(m.sim.player, m.sim.grid, true, 1 / 60);
    m.renderer.render(m.sim, 0, 0.8);
    return {
      state: m.renderer.metadata().characterArt.states.ranger,
      arrows: m.sim.combat.arrows.length,
    };
  });
  expect(state).toEqual({ state: "fallback", arrows: 1 });
});
