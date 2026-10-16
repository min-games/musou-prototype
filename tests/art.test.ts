import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// The generator is intentionally runnable without a TS compiler or Babylon/Blender.
// @ts-expect-error dependency-free authoring script
import { character } from "../scripts/generate-characters.mjs";
// @ts-expect-error local Node validation helper
import { validateCharacter } from "../scripts/validate-characters.mjs";
function parse(bytes: Buffer) {
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  const length = bytes.readUInt32LE(12);
  return {
    json: JSON.parse(bytes.subarray(20, 20 + length).toString()),
    bin: bytes.subarray(28 + length),
  };
}
describe("reusable temple art assets", () => {
  for (const hero of ["vanguard", "ranger"])
    it(`${hero} has deterministic compact rigid skinning and safe atlas UVs`, async () => {
      const generated = character(hero);
      const saved = readFileSync(`public/models/${hero}-v1.glb`);
      expect(saved.equals(generated.glb)).toBe(true);
      const report = await validateCharacter(hero);
      expect(
        report.issues.numErrors,
        JSON.stringify(report.issues.messages),
      ).toBe(0);
      expect(report.issues.numWarnings).toBe(0);
      const { json, bin } = parse(saved);
      expect(json.meshes).toHaveLength(1);
      expect(json.meshes[0].primitives).toHaveLength(1);
      expect(json.materials).toHaveLength(1);
      expect(json.extensionsUsed).toContain("EXT_texture_webp");
      expect(json.extensionsRequired).toContain("EXT_texture_webp");
      expect(json.textures[0].extensions.EXT_texture_webp.source).toBe(0);
      for (const node of json.nodes)
        if (node.children) expect(node.children.length).toBeGreaterThan(0);
      expect(json.skins).toHaveLength(1);
      expect(json.skins[0].joints).toHaveLength(16);
      expect(json.extras.triangles).toBeLessThan(2500);
      expect(json.extras.triangles).toBeGreaterThan(1200);
      expect(json.images[0].uri).toBe("material-atlas-v1.webp");
      const accessor = (id: number) => {
        const a = json.accessors[id],
          v = json.bufferViews[a.bufferView];
        const buffer = bin.subarray(v.byteOffset, v.byteOffset + v.byteLength);
        return a.componentType === 5126
          ? new Float32Array(
              buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength,
              ),
            )
          : new Uint16Array(
              buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength,
              ),
            );
      };
      const attrs = json.meshes[0].primitives[0].attributes;
      const positions = accessor(attrs.POSITION),
        uv = accessor(attrs.TEXCOORD_0),
        joints = accessor(attrs.JOINTS_0),
        weights = accessor(attrs.WEIGHTS_0),
        normals = accessor(attrs.NORMAL);
      expect(
        Math.max(...Array.from(positions).filter((_, i) => i % 3 === 1)),
      ).toBeCloseTo(2.128, 2);
      for (let i = 0; i < uv.length; i++) {
        const within = uv[i]! % 0.25;
        expect(within).toBeGreaterThanOrEqual(8 / 1024 - 1e-6);
        expect(within).toBeLessThanOrEqual(0.25 - 8 / 1024 + 1e-6);
      }
      for (let i = 0; i < weights.length; i += 4) {
        expect([...weights.slice(i, i + 4)]).toEqual([1, 0, 0, 0]);
        expect(joints[i]).toBeLessThan(16);
      }
      for (let i = 0; i < normals.length; i += 3)
        expect(Math.hypot(...normals.slice(i, i + 3))).toBeCloseTo(1, 4);
      for (const id of json.skins[0].joints)
        expect(json.nodes[id].name).toBeTruthy();
    });
  it("Ranger has a distinct narrower head and no dark lower-face hair", () => {
    function headGeometry(hero: string) {
      const { json, bin } = parse(character(hero).glb);
      const attrs = json.meshes[0].primitives[0].attributes;
      function values(id: number) {
        const a = json.accessors[id],
          v = json.bufferViews[a.bufferView];
        const data = bin.subarray(v.byteOffset, v.byteOffset + v.byteLength);
        const copy = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        );
        return a.componentType === 5126
          ? new Float32Array(copy)
          : new Uint16Array(copy);
      }
      const positions = values(attrs.POSITION),
        uv = values(attrs.TEXCOORD_0),
        joints = values(attrs.JOINTS_0);
      const head = json.nodes.findIndex((n: any) => n.name === "head");
      const points = [];
      for (let i = 0; i < positions.length / 3; i++)
        if (joints[i * 4] === head)
          points.push({
            x: positions[i * 3]!,
            y: positions[i * 3 + 1]!,
            z: positions[i * 3 + 2]!,
            cell:
              Math.floor(uv[i * 2]! * 4) + Math.floor(uv[i * 2 + 1]! * 4) * 4,
          });
      return points;
    }
    const ranger = headGeometry("ranger"),
      vanguard = headGeometry("vanguard");
    const lowerFace = (p: (typeof ranger)[number]) =>
      p.y > 1.53 && p.y < 1.66 && Math.abs(p.x) < 0.12 && p.z > 0.12;
    expect(
      vanguard.filter((p) => lowerFace(p) && p.cell === 4).length,
    ).toBeGreaterThan(0);
    expect(ranger.filter((p) => lowerFace(p) && p.cell === 4)).toHaveLength(0);
    const cheekWidth = (points: typeof ranger) =>
      Math.max(
        ...points
          .filter((p) => p.cell === 3 && p.y > 1.65 && p.y < 1.8)
          .map((p) => Math.abs(p.x)),
      );
    expect(cheekWidth(ranger)).toBeLessThan(cheekWidth(vanguard) * 0.9);
    expect(ranger.some((p) => p.cell === 4 && p.z < -0.25 && p.y > 1.7)).toBe(
      true,
    );
  });
  it("runtime WebP atlas is exactly 1024 square", () => {
    const webp = readFileSync("public/models/material-atlas-v1.webp");
    expect(webp.toString("ascii", 0, 4)).toBe("RIFF");
    expect(webp.toString("ascii", 8, 16)).toBe("WEBPVP8 ");
    expect(webp.readUInt16LE(26) & 0x3fff).toBe(1024);
    expect(webp.readUInt16LE(28) & 0x3fff).toBe(1024);
  });
});
