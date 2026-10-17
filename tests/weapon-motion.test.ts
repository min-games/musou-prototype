import { describe, it, expect } from "vitest";
import { weaponMotion } from "../src/WeaponMotion";
import { newPlayer } from "../src/CombatSystem";
import { WEAPONS, weaponStats } from "../src/Weapons";
import { readFileSync, existsSync } from "node:fs";
describe("authored weapon motion sampling", () => {
  for (const weapon of Object.values(WEAPONS))
    for (const stage of [1, 2, 3]) {
      it(`${weapon.id} stage ${stage} follows simulation timing`, () => {
        const p = {
          ...newPlayer(),
          hero: weapon.hero,
          weapon: weapon.id,
          stage,
        };
        const period = weaponStats(p).period;
        p.swingDuration = period;
        p.swing = period * 0.6;
        p.shotCooldown = period * 0.6;
        const sample = weaponMotion(p, false, false, 13);
        expect(sample.clip).toBe(
          weapon.hero === "ranger"
            ? weapon.id.charAt(0).toUpperCase() + weapon.id.slice(1) + "Shot"
            : weapon.id === "saber"
              ? `Saber${stage}`
              : weapon.id.charAt(0).toUpperCase() +
                weapon.id.slice(1) +
                "Attack",
        );
        expect(sample.phase).toBeCloseTo(0.4);
        p.swing = 0;
        if (weapon.hero === "ranger")
          expect(weaponMotion(p, false, false, 13).clip).toBe(sample.clip);
        p.shotCooldown = 0;
        expect(weaponMotion(p, true, false, 13).clip).toBe("Run");
        expect(weaponMotion(p, true, true, 13).clip).toBe("Idle");
      });
    }
  it("release begins at projectile creation and redraw ends at the next legal shot", () => {
    for (const speed of [0.5, 1, 2.5])
      for (const weapon of ["shortbow", "longbow", "fanbow"] as const) {
        const p = {
          ...newPlayer(),
          hero: "ranger" as const,
          weapon,
          attackSpeedMult: speed,
        };
        const period = weaponStats(p).period;
        p.shotCooldown = period;
        expect(weaponMotion(p, false, false, 0).phase).toBe(0);
        expect(weaponMotion(p, false, false, 0).releasePhase).toBe(0);
        p.swing = 0;
        p.shotCooldown = period * 0.1;
        expect(weaponMotion(p, false, true, 0).phase).toBeCloseTo(0.9);
        p.shotCooldown = 0;
        expect(weaponMotion(p, false, false, 0).ready).toMatch(/Ready$/);
      }
  });
});
describe("self-contained two-job candidate artifacts", () => {
  for (const hero of ["ranger", "vanguard"])
    it(`${hero} exports rig, physical props and authored clips`, () => {
      const b = readFileSync(`public/models/${hero}-weapon-motion-v1.glb`);
      const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
      expect(g.skins[0].joints.length).toBeGreaterThanOrEqual(19);
      expect(g.buffers.every((b: any) => !b.uri)).toBe(true);
      expect(g.nodes.some((n: any) => n.name === "grip.R")).toBe(true);
      for (const w of Object.values(WEAPONS).filter((w) => w.hero === hero)) {
        expect(g.nodes.some((n: any) => n.name === `prop.${w.id}`)).toBe(true);
        expect(
          g.animations.some(
            (a: any) =>
              a.name === w.id.charAt(0).toUpperCase() + w.id.slice(1) + "Ready",
          ),
        ).toBe(true);
      }
      expect(
        existsSync(`art-source/${hero}/blender-weapon-motion-v1/${hero}.blend`),
      ).toBe(true);
      if (hero === "ranger")
        expect(
          g.nodes.some((n: any) =>
            n.extras?.identity?.includes("adult female Ranger; ponytail"),
          ),
        ).toBe(true);
    });
});

it("Ranger has independently narrower skinned torso, head and legs than Vanguard", () => {
  function bounds(hero: string, bone: string) {
    const bytes = readFileSync(`public/models/${hero}-weapon-motion-v1.glb`);
    const jsonLength = bytes.readUInt32LE(12);
    const g = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const bin = bytes.subarray(28 + jsonLength);
    const node = g.nodes.find(
      (n: any) =>
        n.mesh !== undefined &&
        n.skin !== undefined &&
        !/^(prop|string)\./.test(n.name),
    );
    const skin = g.skins[node.skin];
    const points: number[] = [];
    function at(
      index: number,
      vertex: number,
      component: number,
      width: number,
    ) {
      const a = g.accessors[index],
        v = g.bufferViews[a.bufferView];
      const size =
        a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
      const offset =
        (v.byteOffset || 0) +
        (a.byteOffset || 0) +
        vertex * (v.byteStride || size * width) +
        component * size;
      return a.componentType === 5126
        ? bin.readFloatLE(offset)
        : a.componentType === 5123
          ? bin.readUInt16LE(offset)
          : bin.readUInt8(offset);
    }
    for (const p of g.meshes[node.mesh].primitives) {
      for (let v = 0; v < g.accessors[p.attributes.POSITION].count; v++) {
        const joint = at(p.attributes.JOINTS_0, v, 0, 4);
        if (
          g.nodes[skin.joints[joint]].name === bone &&
          at(p.attributes.WEIGHTS_0, v, 0, 4) > 0.99
        )
          points.push(at(p.attributes.POSITION, v, 0, 3));
      }
    }
    expect(points.length).toBeGreaterThan(20);
    return Math.max(...points) - Math.min(...points);
  }
  expect(bounds("ranger", "chest")).toBeLessThan(
    bounds("vanguard", "chest") * 0.82,
  );
  expect(bounds("ranger", "head")).toBeLessThan(
    bounds("vanguard", "head") * 0.95,
  );
  expect(bounds("ranger", "thigh.R")).toBeLessThan(
    bounds("vanguard", "thigh.R") * 0.9,
  );
});
