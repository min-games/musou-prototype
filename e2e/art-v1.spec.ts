import { test, expect, evidencePath } from "./fixtures";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
mkdirSync("evidence/art-v1", { recursive: true });
const art = (page: any) =>
  page.evaluate(() => (window as any).musou.renderer.metadata().characterArt);
async function ready(page: any, url = "/?practice=1&backend=webgl") {
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).musou);
}
test("temple models, all six hand attachments, independent remote rigs and cleanup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page, "/?practice=1&backend=webgl&artCloseup=1");
  await page.evaluate(() => {
    const m = (window as any).musou;
    m.pause(true);
    m.sim.reset(0);
    m.sim.player.yaw = Math.PI;
    m.renderer.render(m.sim, 0, 0.8);
  });
  let metadata = await art(page);
  expect(metadata.states).toEqual({ vanguard: "loaded", ranger: "loaded" });
  expect(metadata.models.vanguard.meshes).toBe(1);
  expect(metadata.models.vanguard.triangles).toBeLessThan(2500);
  // A second render resolves the cloned skeleton world matrices and shader readiness.
  await page.evaluate(() => {
    const m = (window as any).musou;
    m.renderer.render(m.sim, 0, 0.8);
  });
  await page.screenshot({ path: "evidence/art-v1/vanguard-closeup.png" });
  const weapons = await page.evaluate(() => {
    const m = (window as any).musou,
      r = m.renderer,
      s = m.sim;
    return [
      "saber",
      "spear",
      "greatblade",
      "shortbow",
      "longbow",
      "fanbow",
    ].map((weapon) => {
      s.player.hero = ["saber", "spear", "greatblade"].includes(weapon)
        ? "vanguard"
        : "ranger";
      s.player.weapon = weapon;
      r.render(s, 0, 0.8);
      r.render(s, 0, 0.8);
      const mesh = s.player.hero === "ranger" ? r.bow : r.blade;
      return {
        weapon,
        enabled: mesh.isEnabled(),
        position: mesh.position.asArray(),
        actors: r.metadata().characterArt.activeActors,
      };
    });
  });
  for (const w of weapons) {
    expect(w.enabled).toBe(true);
    expect(w.actors).toBe(1);
    expect(w.position.every(Number.isFinite)).toBe(true);
    expect(w.position[1]).toBeGreaterThan(0.4);
  }
  await page.screenshot({ path: "evidence/art-v1/ranger-closeup.png" });
  const sharing = await page.evaluate(() => {
    const m = (window as any).musou,
      s = m.sim,
      r = m.renderer;
    s.player.hero = "vanguard";
    s.player.weapon = "saber";
    s.player.swing = 0;
    for (const id of ["remote-a", "remote-b"])
      s.remotePlayers.set(id, {
        player: {
          ...s.player,
          x: id === "remote-a" ? 2 : -2,
          hero: id === "remote-a" ? "vanguard" : "ranger",
          weapon: id === "remote-a" ? "spear" : "longbow",
          swing: 0.2,
          swingDuration: 0.4,
        },
        combat: new s.combat.constructor(),
      });
    r.render(s, 0, 0.8);
    r.render(s, 0, 0.8);
    const active = r.metadata().characterArt;
    const local = r.characters.instances.get(r.player);
    const remote = r.characters.instances.get(
      r.remoteRigs.get("remote-a").player,
    );
    const sameGeometry =
      local.entries.rootNodes[0].getChildMeshes()[0].geometry ===
      remote.entries.rootNodes[0].getChildMeshes()[0].geometry;
    const sameMaterial =
      local.entries.rootNodes[0].getChildMeshes()[0].material ===
      remote.entries.rootNodes[0].getChildMeshes()[0].material;
    const independent =
      local.entries.skeletons[0] !== remote.entries.skeletons[0] &&
      local.nodes.get("arm.R") !== remote.nodes.get("arm.R");
    const localBefore = local.nodes.get("arm.R").rotationQuaternion.asArray();
    s.remotePlayers.get("remote-a").player.swing = 0.1;
    r.render(s, 0, 0.8);
    const unaffected =
      JSON.stringify(localBefore) ===
      JSON.stringify(local.nodes.get("arm.R").rotationQuaternion.asArray());
    s.remotePlayers.clear();
    r.render(s, 0, 0.8);
    const after = r.metadata().characterArt;
    const remainingMeshes = r.scene.meshes.length,
      remainingSkeletons = r.scene.skeletons.length;
    for (let i = 0; i < 10; i++) {
      s.remotePlayers.set("cycle", {
        player: { ...s.player, x: 3 },
        combat: new s.combat.constructor(),
      });
      r.render(s, 0, 0.8);
      s.remotePlayers.clear();
      r.render(s, 0, 0.8);
    }
    return {
      active,
      after,
      sameGeometry,
      sameMaterial,
      independent,
      unaffected,
      remainingMeshes,
      finalMeshes: r.scene.meshes.length,
      remainingSkeletons,
      finalSkeletons: r.scene.skeletons.length,
    };
  });
  expect(sharing.active.activeActors).toBe(3);
  expect(sharing.after.activeActors).toBe(1);
  for (const key of [
    "sameGeometry",
    "sameMaterial",
    "independent",
    "unaffected",
  ] as const)
    expect(sharing[key]).toBe(true);
  expect(sharing.finalMeshes).toBe(sharing.remainingMeshes);
  expect(sharing.finalSkeletons).toBe(sharing.remainingSkeletons);
  const poses = sharing.active.actors.map((a: any) => a.pose[0].rotation);
  expect(poses[0]).not.toEqual(poses[1]);
  writeFileSync(
    "evidence/art-v1/rig-sharing.json",
    JSON.stringify({ weapons, sharing }, null, 2),
  );
  await page.evaluate(() => {
    const m = (window as any).musou,
      s = m.sim;
    s.player.x = -0.5;
    s.player.swing = 0.2;
    s.player.swingDuration = 0.4;
    s.remotePlayers.set("portrait-partner", {
      player: {
        ...s.player,
        x: 0.8,
        hero: "ranger",
        weapon: "shortbow",
        swing: 0.1,
      },
      combat: new s.combat.constructor(),
    });
    m.renderer.render(s, 0, 0.8);
    m.renderer.render(s, 0, 0.8);
  });
  await page.screenshot({ path: "evidence/art-v1/two-player-poses.png" });
  expect(errors).toEqual([]);
});

test("female Ranger standing reference pose and default gameplay", async ({
  page,
}) => {
  await ready(page, "/?practice=1&backend=webgl");
  expect((await art(page)).states).toEqual({
    vanguard: "loaded",
    ranger: "loaded",
  });
  await page.evaluate(() => {
    const m = (window as any).musou;
    m.pause(true);
    m.sim.reset(20);
    m.sim.player.hero = "ranger";
    m.sim.player.weapon = "longbow";
    m.renderer.render(m.sim, 0, 0.8);
    m.renderer.render(m.sim, 0, 0.8);
  });
  await page.screenshot({ path: "evidence/art-v1/ranger-gameplay.png" });
  await ready(page, "/?practice=1&backend=webgl&artCloseup=1");
  await page.evaluate(() => {
    const m = (window as any).musou,
      r = m.renderer;
    m.pause(true);
    m.sim.reset(0);
    m.sim.player.hero = "ranger";
    m.sim.player.weapon = "longbow";
    m.sim.player.yaw = Math.PI;
    // Evidence-only pose override: keep the shipped ranged combat pose untouched.
    const update = r.characters.animate.bind(r.characters);
    r.characters.animate = (...args: any[]) => {
      const result = update(...args);
      const inst = r.characters.instances.get(r.player);
      if (inst?.hero === "ranger") {
        for (const name of ["arm.L", "arm.R", "forearm.L", "forearm.R"]) {
          const q = inst.nodes.get(name).rotationQuaternion;
          q.set(0, 0, 0, 1);
        }
      }
      return result;
    };
    r.render(m.sim, 0, 0.8);
    r.render(m.sim, 0, 0.8);
    r.bow.visibility = 0;
  });
  await page.screenshot({ path: "evidence/art-v1/ranger-standing-front.png" });
});

test("loaded gameplay and same-session candidate WebGL benchmark", async ({
  page,
}) => {
  test.setTimeout(600000);
  await ready(page);
  expect((await art(page)).states.vanguard).toBe("loaded");
  await page.screenshot({ path: "evidence/art-v1/candidate-gameplay.png" });
  const results = await page.evaluate(() =>
    (window as any).musou.runBenchmark(180),
  );
  expect(results.map((r: any) => r.count)).toEqual([0, 20, 100, 300]);
  for (const r of results) {
    expect(r.frames).toBe(180);
    expect(r.metadata.warmupFrames).toBe(60);
    expect(r.metadata.renderer.characterArt.states.vanguard).toBe("loaded");
    expect(r.metadata.renderer.characterArt.activeActors).toBe(1);
  }
  writeFileSync(
    existsSync("evidence/art-v1/candidate-webgl.json")
      ? evidencePath("candidate-repeat-webgl.json")
      : "evidence/art-v1/candidate-webgl.json",
    JSON.stringify(results, null, 2),
  );
});

test("model errors use bounded playable fallback and legacy A/B makes no model requests", async ({
  page,
}) => {
  await page.route("**/models/**", (route) => route.abort());
  await ready(page);
  expect((await art(page)).states).toEqual({
    vanguard: "fallback",
    ranger: "fallback",
  });
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() => page.evaluate(() => (window as any).musou.sim.player.stage))
    .toBe(1);
  await page.screenshot({ path: "evidence/art-v1/fallback-gameplay.png" });
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/models/")) requests++;
  });
  await ready(page, "/?practice=1&backend=webgl&art=legacy");
  expect((await art(page)).states.vanguard).toBe("legacy");
  expect(requests).toBe(0);
});

test("subpath precaches actual GLB and atlas and loads both kits offline", async ({
  page,
  context,
}) => {
  await ready(page, "/musou/?practice=1&backend=webgl");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).musou);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).musou);
  expect((await art(page)).states).toEqual({
    vanguard: "loaded",
    ranger: "loaded",
  });
  await page.evaluate(() => {
    const m = (window as any).musou;
    m.sim.player.hero = "ranger";
    m.sim.player.weapon = "longbow";
    m.renderer.render(m.sim, 0, 0.8);
  });
  expect((await art(page)).actors[0].hero).toBe("ranger");
  await page.screenshot({ path: "evidence/art-v1/offline-subpath.png" });
  await context.setOffline(false);
});

test("stalled asset requests release readiness after the bounded timeout", async ({
  page,
}) => {
  await page.route("**/models/*.glb", () => {});
  const start = Date.now();
  await ready(page);
  expect(Date.now() - start).toBeLessThan(22000);
  expect((await art(page)).states).toEqual({
    vanguard: "fallback",
    ranger: "fallback",
  });
  await expect(page.locator("#renderer-label")).toContainText("art fallback");
});

test("reduced motion keeps combat poses and suppresses gait and decorative sway", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const m = (window as any).musou,
      s = m.sim,
      r = m.renderer;
    m.pause(true);
    s.reset(0);
    r.render(s, 0, 0.8);
    s.ticks = 6;
    s.player.x = 0.5;
    r.render(s, 0, 0.8);
    const inst = r.characters.instances.get(r.player),
      before = inst.nodes.get("thigh.L").rotationQuaternion.asArray();
    r.setReducedMotion(true);
    s.ticks = 12;
    s.player.x = 1;
    s.player.swing = 0.2;
    s.player.swingDuration = 0.4;
    r.render(s, 0, 0.8);
    return {
      before,
      gait: inst.nodes.get("thigh.L").rotationQuaternion.asArray(),
      sash: inst.nodes.get("sash").rotationQuaternion.asArray(),
      arm: inst.nodes.get("arm.R").rotationQuaternion.asArray(),
    };
  });
  expect(result.before).not.toEqual([0, 0, 0, 1]);
  expect(result.gait).toEqual([0, 0, 0, 1]);
  expect(result.sash).toEqual([0, 0, 0, 1]);
  expect(result.arm).not.toEqual([0, 0, 0, 1]);
});
