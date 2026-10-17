import { test, expect } from "./fixtures";
import { writeFileSync } from "node:fs";
// Route-abort checks must reach the network rather than a controlling worker cache.
test.use({ serviceWorkers: "block" });
const url = "/?practice=1&backend=webgl&art=blender&artCloseup=1";
async function ready(page: any, path = url) {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as any).musou);
}
test("Blender candidate samples authored clips, independent skins and hand sockets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const result = await page.evaluate(() => {
    const m = (window as any).musou,
      s = m.sim,
      r = m.renderer;
    m.pause(true);
    s.reset(0);
    s.player.yaw = Math.PI;
    const sample = (ticks: number, x: number, swing: number) => {
      s.ticks = ticks;
      s.player.x = x;
      s.player.swing = swing;
      s.player.swingDuration = 0.4;
      r.render(s, 0, 0.8);
      r.render(s, 0, 0.8);
      const i = r.characters.instances.get(r.player);
      return {
        clip: i.clip,
        frame: i.clipFrame,
        pose: i.nodes.get("arm.R").rotationQuaternion.asArray(),
        hand: i.nodes.get("hand.R").getAbsolutePosition().asArray(),
        weapon: r.blade.position.asArray(),
        meta: r.metadata().characterArt,
      };
    };
    const idle = sample(0, 0, 0),
      idleLater = sample(30, 0, 0),
      run = sample(36, 0.2, 0),
      runLater = sample(42, 0.4, 0),
      attack = sample(48, 0.4, 0.2),
      recovery = sample(54, 0.4, 0.05);
    const weapons = ["saber", "spear", "greatblade"].map((weapon) => {
      s.player.weapon = weapon;
      sample(60, 0.4, 0.2);
      return {
        weapon,
        position: r.blade.position.asArray(),
        enabled: r.blade.isEnabled(),
      };
    });
    s.remotePlayers.set("candidate-peer", {
      player: { ...s.player, x: 2, swing: 0 },
      combat: new s.combat.constructor(),
    });
    sample(66, 0.4, 0.2);
    const a = r.characters.instances.get(r.player),
      b = r.characters.instances.get(r.remoteRigs.get("candidate-peer").player);
    const independent =
      a.entries.skeletons[0] !== b.entries.skeletons[0] &&
      a.entries.animationGroups[0] !== b.entries.animationGroups[0];
    const remoteClip = b.clip;
    s.remotePlayers.clear();
    r.render(s, 0, 0.8);
    r.setReducedMotion(true);
    const reduced = sample(72, 0.8, 0);
    const reducedAttack = sample(78, 1, 0.2);
    return {
      idle,
      idleLater,
      run,
      runLater,
      attack,
      recovery,
      weapons,
      independent,
      remoteClip,
      reduced,
      reducedAttack,
    };
  });
  expect(result.idle.clip).toBe("Idle");
  expect(result.run.clip).toBe("Run");
  expect(result.attack.clip).toBe("Attack");
  expect(result.run.pose).not.toEqual(result.runLater.pose);
  expect(result.attack.pose).not.toEqual(result.recovery.pose);
  expect(result.attack.hand).not.toEqual(result.recovery.hand);
  expect(result.independent).toBe(true);
  expect(result.remoteClip).toBe("Idle");
  expect(result.reduced.clip).toBe("Idle");
  expect(result.reducedAttack.clip).toBe("Attack");
  expect(result.idle.meta.models.vanguard.file).toBe("vanguard-blender-v1.glb");
  expect(
    result.idle.meta.models.vanguard.animations.map((a: any) => a.name).sort(),
  ).toEqual(["Attack", "Idle", "Run"]);
  for (const w of result.weapons) {
    expect(w.enabled).toBe(true);
    expect(w.position.every(Number.isFinite)).toBe(true);
    expect(w.position[1]).toBeGreaterThan(0.4);
  }
  writeFileSync(
    "evidence/blender-v1/browser-animation.json",
    JSON.stringify(result, null, 2),
  );
  // Keep evidence time monotonic, settle movement, and assert the captured clip.
  await page.evaluate(() => {
    const m = (window as any).musou;
    m.sim.player.x = 0;
    m.sim.player.swing = 0;
    for (const ticks of [120, 126]) {
      m.sim.ticks = ticks;
      m.renderer.render(m.sim, 0, 0.8);
    }
  });
  for (const [name, ticks, x, swing] of [
    ["idle", 132, 0, 0],
    ["run", 138, 0.2, 0],
    ["attack", 144, 0.2, 0.2],
  ] as const) {
    const capturedClip = await page.evaluate(
      ({ ticks, x, swing }) => {
        const m = (window as any).musou;
        m.renderer.setReducedMotion(false);
        m.sim.ticks = ticks;
        m.sim.player.x = x;
        m.sim.player.swing = swing;
        m.sim.player.weapon = "saber";
        m.renderer.render(m.sim, 0, 0.8);
        m.renderer.render(m.sim, 0, 0.8);
        return m.renderer.characters.instances
          .get(m.renderer.player)
          .clip.toLowerCase();
      },
      { ticks, x, swing },
    );
    expect(capturedClip).toBe(name);
    await page.screenshot({ path: `evidence/blender-v1/browser-${name}.png` });
  }
  expect(errors).toEqual([]);
});
test("Blender is opt-in and failed candidate loads retain playable fallback", async ({
  page,
}) => {
  let candidateRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("vanguard-blender")) candidateRequests++;
  });
  await ready(page, "/?practice=1&backend=webgl");
  expect(candidateRequests).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (window as any).musou.renderer.metadata().characterArt.models.vanguard
          .file,
    ),
  ).toBe("vanguard-v1.glb");
  await page.route("**/vanguard-blender-v1.glb", (r) => r.abort());
  await ready(page);
  const meta = await page.evaluate(
    () => (window as any).musou.renderer.metadata().characterArt,
  );
  expect(meta.states).toEqual({ vanguard: "fallback", ranger: "loaded" });
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() => page.evaluate(() => (window as any).musou.sim.player.stage))
    .toBe(1);
  await page.screenshot({ path: "evidence/blender-v1/browser-fallback.png" });
  writeFileSync(
    "evidence/blender-v1/browser-fallback.json",
    JSON.stringify(meta, null, 2),
  );
});
