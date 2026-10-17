import { test, expect } from "./fixtures";
import { mkdirSync, writeFileSync } from "node:fs";
test.use({ serviceWorkers: "block" });
mkdirSync("evidence/weapon-motion-v1/validated-run", { recursive: true });
test("exported Run lifts skinned thighs, folds knees backward and closes the stride", async ({
  page,
}) => {
  await page.goto("/?practice=1&backend=webgl&art=blender&artCloseup=1");
  await page.waitForFunction(() => !!(window as any).musou);
  const result = await page.evaluate(() => {
    const m = (window as any).musou;
    m.pause(true);
    const s = m.sim,
      r = m.renderer;
    s.reset(0);
    s.player.yaw = Math.PI;
    r.render(s, 0, 0.8);
    const i = r.characters.instances.get(r.player);
    const g = i.entries.animationGroups.find((a: any) =>
      a.name.endsWith(":Run"),
    );
    for (const a of i.entries.animationGroups) a.stop();
    g.start(false);
    g.pause();
    const samples: any[] = [];
    for (let f = 0; f <= 24; f++) {
      g.goToFrame(g.from + ((g.to - g.from) * f) / 24);
      for (const n of i.root.getChildTransformNodes(false))
        n.computeWorldMatrix(true);
      const inv = i.root.getWorldMatrix().clone().invert();
      const local = (n: any) => {
        const v = n.getAbsolutePosition();
        return v.constructor.TransformCoordinates(v, inv).asArray();
      };
      const legs = Object.fromEntries(
        ["R", "L"].map((side) => [
          side,
          {
            hip: local(i.nodes.get("thigh." + side)),
            knee: local(i.nodes.get("shin." + side)),
            ankle: local(i.nodes.get("foot." + side)),
          },
        ]),
      );
      // Force CPU skin evaluation on the actual exported mesh, rather than just
      // checking animation metadata. Bounds/selected positions must change.
      const meshes = i.root.getChildMeshes().filter((a: any) => a.skeleton);
      let soleMinY = Infinity;
      const skin = meshes
        .map((mesh: any) => {
          mesh.skeleton.prepare(true);
          const p = Array.from(mesh.getPositionData(true, true)) as number[];
          const indices = mesh.getVerticesData("matricesIndices");
          const weights = mesh.getVerticesData("matricesWeights");
          const selected: number[] = [];
          for (let v = 0; v < p.length / 3; v++) {
            const bone = mesh.skeleton.bones[indices[v * 4]];
            if (bone?.name.includes("thigh.") && weights[v * 4] > 0.99)
              selected.push(p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!);
            if (bone?.name.includes("foot.") && weights[v * 4] > 0.99) {
              const q = i.nodes.get("foot.R").getAbsolutePosition().clone();
              q.set(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
              const world = q.constructor.TransformCoordinates(
                q,
                mesh.getWorldMatrix(),
              );
              soleMinY = Math.min(
                soleMinY,
                q.constructor.TransformCoordinates(world, inv).y,
              );
            }
          }
          return selected;
        })
        .flat();
      samples.push({ f, legs, skin, soleMinY });
    }
    const skinMotion = Math.max(
      ...samples[0].skin.map((p: number, k: number) =>
        Math.abs(p - samples[8].skin[k]),
      ),
    );
    return {
      from: g.from,
      to: g.to,
      skinMotion,
      samples: samples.map(({ skin, ...row }) => row),
    };
  });
  for (const side of ["R", "L"]) {
    const legs = result.samples.map((s: any) => s.legs[side]);
    const range = (joint: string, axis: number) =>
      Math.max(...legs.map((l) => l[joint][axis])) -
      Math.min(...legs.map((l) => l[joint][axis]));
    expect(range("knee", 1)).toBeGreaterThan(0.22);
    expect(range("knee", 2)).toBeGreaterThan(0.4);
    expect(range("ankle", 2)).toBeGreaterThan(0.55);
    for (const l of legs) {
      expect(l.ankle[1]).toBeGreaterThan(0.085);
      // glTF front is +Z, up +Y; knee must remain on forward side of hip/ankle line.
      const [h, k, a] = [l.hip, l.knee, l.ankle];
      expect(
        (k[2] - h[2]) * (a[1] - k[1]) - (k[1] - h[1]) * (a[2] - k[2]),
      ).toBeLessThan(-0.02);
    }
    for (const joint of ["hip", "knee", "ankle"])
      expect(
        Math.hypot(
          ...legs[0][joint].map(
            (v: number, k: number) => v - legs[24][joint][k],
          ),
        ),
      ).toBeLessThan(0.0001);
  }
  for (const sample of result.samples)
    expect(sample.soleMinY).toBeGreaterThan(-0.003);
  expect(result.to - result.from).toBeCloseTo(48, 3); // .8 s at Babylon's imported 60 fps
  expect(result.skinMotion).toBeGreaterThan(0.2);
  writeFileSync(
    "evidence/weapon-motion-v1/validated-run/browser-leg-motion.json",
    JSON.stringify(result, null, 2),
  );
  // Warm locomotion so the evidence starts after the Idle/Run blend.
  await page.evaluate(() => {
    const m = (window as any).musou;
    for (const [ticks, x] of [
      [90, -0.3],
      [108, -0.1],
    ]) {
      m.sim.ticks = ticks;
      m.sim.player.x = x;
      m.sim.player.swing = 0;
      m.renderer.render(m.sim, 0, 0.8);
      m.renderer.render(m.sim, 0, 0.8);
    }
  });
  // Gameplay selects Run while the player moves. Capture 24 actual runtime poses.
  for (let f = 0; f < 24; f++) {
    const clip = await page.evaluate((f) => {
      const m = (window as any).musou;
      m.sim.ticks = 120 + f * 2;
      m.sim.player.x = f * 0.035;
      m.sim.player.swing = 0;
      m.renderer.render(m.sim, 0, 0.8);
      m.renderer.render(m.sim, 0, 0.8);
      return m.renderer.characters.instances.get(m.renderer.player).clip;
    }, f);
    expect(clip).toBe("Run");
    await page.screenshot({
      path: `evidence/weapon-motion-v1/validated-run/browser-stride-${String(f + 1).padStart(2, "0")}.png`,
    });
  }
});

test("lifted Run eases into and out of Idle without moving the simulation root", async ({
  page,
}) => {
  await page.goto("/?practice=1&backend=webgl&art=blender&artCloseup=1");
  await page.waitForFunction(() => !!(window as any).musou);
  const poses = await page.evaluate(() => {
    const m = (window as any).musou;
    m.pause(true);
    m.sim.reset(0);
    const sample = (ticks: number, x: number) => {
      m.sim.ticks = ticks;
      m.sim.player.x = x;
      m.renderer.render(m.sim, 0, 0.8);
      m.renderer.render(m.sim, 0, 0.8);
      const i = m.renderer.characters.instances.get(m.renderer.player);
      return {
        clip: i.clip,
        x: m.sim.player.x,
        pose: [
          "pelvis",
          "thigh.R",
          "shin.R",
          "foot.R",
          "thigh.L",
          "shin.L",
          "foot.L",
        ].flatMap((n) => [
          ...i.nodes.get(n).rotationQuaternion.asArray(),
          ...i.nodes.get(n).position.asArray(),
        ]),
      };
    };
    const idle = sample(0, 0),
      entry = sample(12, 0.2),
      middle = sample(15, 0.25),
      run = sample(24, 0.4),
      stop = sample(30, 0.4),
      settled = sample(42, 0.4);
    return { idle, entry, middle, run, stop, settled };
  });
  const distance = (a: any, b: any) =>
    Math.max(...a.pose.map((v: number, i: number) => Math.abs(v - b.pose[i])));
  expect(poses.entry.clip).toBe("Run");
  expect(distance(poses.idle, poses.entry)).toBeLessThan(0.000001);
  expect(distance(poses.entry, poses.middle)).toBeGreaterThan(0.01);
  expect(poses.stop.clip).toBe("Idle");
  expect(distance(poses.run, poses.stop)).toBeLessThan(0.000001);
  expect(distance(poses.stop, poses.settled)).toBeGreaterThan(0.01);
  expect(poses.stop.x).toBe(0.4);
  expect(poses.settled.x).toBe(0.4);
  writeFileSync(
    "evidence/weapon-motion-v1/validated-run/browser-transitions.json",
    JSON.stringify(poses, null, 2),
  );
});
