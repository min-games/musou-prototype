// Deterministic, dependency-free glTF 2 binary authoring. Geometry is code-authored,
// not reconstructed from the reference image. Coordinates: metres, Y up, +Z face.
import { mkdirSync, writeFileSync } from "node:fs";
export function character(hero = "vanguard") {
  const ranger = hero === "ranger";
  const nodes = [],
    joints = [],
    world = [];
  function joint(name, xyz, parent) {
    const i = nodes.length;
    nodes.push({ name, translation: xyz, children: [] });
    if (parent !== undefined) nodes[parent].children.push(i);
    world[i] = xyz.map(
      (v, k) => v + (parent === undefined ? 0 : world[parent][k]),
    );
    joints.push(i);
    return i;
  }
  const root = joint("pelvis", [0, 0.91, 0]);
  const chest = joint("chest", [0, 0.34, 0], root);
  const head = joint("head", [0, 0.36, 0], chest);
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const a = joint(
      side < 0 ? "arm.L" : "arm.R",
      [side * 0.38, 0.16, 0],
      chest,
    );
    const e = joint(
      side < 0 ? "forearm.L" : "forearm.R",
      [side * 0.11, -0.27, 0],
      a,
    );
    const h = joint(side < 0 ? "hand.L" : "hand.R", [0, -0.25, 0.03], e);
    arms.push([a, e, h]);
    const l = joint(
      side < 0 ? "thigh.L" : "thigh.R",
      [side * 0.18, -0.04, 0],
      root,
    );
    const k = joint(side < 0 ? "shin.L" : "shin.R", [0, -0.37, 0], l);
    const f = joint(side < 0 ? "foot.L" : "foot.R", [0, -0.35, 0.03], k);
    legs.push([l, k, f]);
  }
  const sash = joint("sash", [0.25, 0.02, -0.04], root);
  const pos = [],
    normal = [],
    uv = [],
    ji = [],
    weights = [],
    indices = [];
  // Every face stays 8px within its 256px atlas cell. No cell-edge wrapping.
  function face(points, cell, bone, coordinates) {
    const base = pos.length / 3;
    const a = points[0],
      b = points[1],
      c = points[2];
    const u = b.map((v, i) => v - a[i]),
      v = c.map((v, i) => v - a[i]);
    let n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(...n) || 1;
    n = n.map((v) => v / len);
    const x = cell % 4,
      y = Math.floor(cell / 4),
      inset = 8 / 1024;
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    points.forEach((p, i) => {
      pos.push(...p);
      normal.push(...n);
      const [s, t] = (coordinates ?? corners)[i];
      uv.push(
        x / 4 + inset + s * (0.25 - 2 * inset),
        y / 4 + inset + (1 - t) * (0.25 - 2 * inset),
      );
      ji.push(bone, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    });
    for (let i = 1; i < points.length - 1; i++)
      indices.push(base, base + i, base + i + 1);
  }
  function box(center, size, cell, bone) {
    const [x, y, z] = center,
      [w, h, d] = size.map((v) => v / 2);
    const p = [
      [-w, -h, -d],
      [w, -h, -d],
      [w, h, -d],
      [-w, h, -d],
      [-w, -h, d],
      [w, -h, d],
      [w, h, d],
      [-w, h, d],
    ].map((p) => p.map((v, i) => v + center[i]));
    for (const f of [
      [4, 5, 6, 7],
      [1, 0, 3, 2],
      [0, 4, 7, 3],
      [5, 1, 2, 6],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ])
      face(
        f.map((i) => p[i]),
        cell,
        bone,
      );
  }
  function plaque(c, w, h, cell, bone) {
    const outline = [
      [-0.5, -0.3],
      [-0.3, -0.5],
      [0.3, -0.5],
      [0.5, -0.3],
      [0.5, 0.3],
      [0.3, 0.5],
      [-0.3, 0.5],
      [-0.5, 0.3],
    ];
    face(
      outline.map(([x, y]) => [c[0] + x * w, c[1] + y * h, c[2]]),
      cell,
      bone,
      outline.map(([x, y]) => [x + 0.5, y + 0.5]),
    );
  }
  function oval(c, s, cell, bone, segments = 8, rings = 4) {
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segments; i++) {
        const point = (a, b) => {
          const t = (Math.PI * a) / rings,
            p = (2 * Math.PI * b) / segments;
          return [
            c[0] + (Math.sin(t) * Math.cos(p) * s[0]) / 2,
            c[1] + (Math.cos(t) * s[1]) / 2,
            c[2] + (Math.sin(t) * Math.sin(p) * s[2]) / 2,
          ];
        };
        if (j === 0)
          face([point(j, i), point(j + 1, i + 1), point(j + 1, i)], cell, bone);
        else if (j === rings - 1)
          face([point(j, i), point(j, i + 1), point(j + 1, i)], cell, bone);
        else
          face(
            [
              point(j, i),
              point(j, i + 1),
              point(j + 1, i + 1),
              point(j + 1, i),
            ],
            cell,
            bone,
          );
      }
  }
  const cloth = ranger ? 11 : 1,
    armor = ranger ? 14 : 0;
  // Compact broad torso, layered gold-edged cuirass, cloud breastplate.
  oval([0, 1.22, 0], [ranger ? 0.64 : 0.78, 0.61, 0.43], armor, chest);
  box([0, 1.43, 0.12], [0.64, 0.045, 0.29], 2, chest);
  plaque([0.12, 1.29, 0.221], 0.29, 0.25, 9, chest);
  box([0, 0.99, 0], [0.65, 0.14, 0.46], cloth, root);
  box([0, 0.97, 0.244], [0.17, 0.15, 0.04], 2, root);
  for (const side of [-1, 1]) {
    box([side * 0.25, 0.79, 0.035], [0.28, 0.31, 0.42], 2, root);
    box([side * 0.25, 0.81, 0.065], [0.235, 0.27, 0.425], armor, root);
  }
  box([0, 0.76, 0.25], [0.24, 0.32, 0.045], cloth, root);
  box([0.25, 0.65, 0.22], [0.15, 0.49, 0.055], ranger ? 11 : 10, sash);
  // Neck, angular warm face, dark sculpted hair and readable facial features.
  oval([0, 1.54, 0], [0.2, 0.21, 0.21], 3, head);
  oval([0, 1.73, 0.015], [0.35, 0.43, 0.32], 3, head, 8, 5);
  oval([0, 1.84, -0.045], [0.39, 0.31, 0.34], 4, head);
  for (const side of [-1, 1]) {
    oval([side * 0.17, 1.71, -0.035], [0.1, 0.3, 0.21], 4, head, 6, 3);
    oval([side * 0.178, 1.72, 0.015], [0.08, 0.13, 0.12], 3, head, 6, 3);
    box([side * 0.073, 1.758, 0.166], [0.11, 0.025, 0.017], 4, head);
    box([side * 0.075, 1.728, 0.174], [0.075, 0.028, 0.012], 7, head);
    box([side * 0.075, 1.728, 0.183], [0.031, 0.026, 0.009], 4, head);
  }
  oval([0, 1.69, 0.182], [0.072, 0.09, 0.07], 3, head, 4, 2);
  box([0, 1.624, 0.154], [0.1, 0.018, 0.018], 4, head);
  oval([0, 1.59, 0.075], [0.19, 0.11, 0.17], 4, head, 6, 2);
  oval([0, 2.008, -0.045], [0.2, 0.24, 0.2], 4, head, 6, 3);
  box([0, 1.936, -0.035], [0.23, 0.065, 0.22], cloth, head);
  box([-0.21, 1.94, -0.1], [0.32, 0.065, 0.045], cloth, head);
  for (let i = 0; i < 3; i++)
    oval([-0.115 + i * 0.1, 1.91, 0.045], [0.13, 0.16, 0.19], 4, head, 5, 2);
  arms.forEach(([a, e, h], i) => {
    const side = i === 0 ? -1 : 1;
    oval([side * 0.43, 1.4, 0], [ranger ? 0.27 : 0.4, 0.29, 0.4], 2, a);
    oval(
      [side * 0.43, 1.405, 0.018],
      [ranger ? 0.23 : 0.35, 0.23, 0.37],
      armor,
      a,
    );
    if (i === 0 && !ranger) {
      // Original guardian-lion face decal, raised muzzle, ears and gold mane.
      oval([side * 0.45, 1.43, 0.18], [0.36, 0.33, 0.11], 2, a, 8, 3);
      plaque([side * 0.45, 1.43, 0.244], 0.32, 0.29, 8, a);
      for (const dx of [-0.105, 0.105])
        oval([side * 0.45 + dx, 1.54, 0.19], [0.105, 0.1, 0.07], 2, a, 6, 2);
      oval([side * 0.45, 1.38, 0.244], [0.15, 0.09, 0.06], 2, a, 6, 2);
    }
    oval([side * 0.47, 1.23, 0], [0.27, 0.32, 0.28], cloth, a);
    oval([side * 0.49, 1.08, 0.025], [0.19, 0.18, 0.2], 3, e);
    oval([side * 0.49, 0.995, 0.025], [0.205, 0.22, 0.22], armor, e);
    box([side * 0.49, 1.09, 0.025], [0.22, 0.04, 0.23], 2, e);
    box([side * 0.49, 0.9, 0.025], [0.2, 0.035, 0.22], 2, e);
    oval([side * 0.49, 0.85, 0.05], [0.17, 0.18, 0.19], 3, h);
  });
  legs.forEach(([l, k, f], i) => {
    const x = i === 0 ? -0.18 : 0.18;
    oval([x, 0.69, 0], [0.31, 0.44, 0.35], 5, l);
    oval([x, 0.46, 0.025], [0.25, 0.18, 0.29], 2, k);
    oval([x, 0.295, 0.015], [0.255, 0.36, 0.29], 6, k);
    box([x, 0.29, 0.158], [0.18, 0.29, 0.025], armor, k);
    box([x, 0.46, 0.16], [0.22, 0.045, 0.03], 2, k);
    oval([x, 0.105, 0.09], [0.28, 0.2, 0.45], 6, f);
    box([x, 0.052, 0.11], [0.27, 0.045, 0.4], 2, f);
  });
  // glTF buffer / accessor writer; inverse binds make all vertices rigid to their joints.
  const chunks = [],
    views = [],
    accessors = [];
  let offset = 0;
  function add(array, type, componentType, minmax = false) {
    const data = Buffer.from(array.buffer);
    const pad = (4 - (data.length % 4)) % 4;
    const view = views.length;
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: data.length,
      ...(type === "MAT4" ? {} : { target: type === "SCALAR" ? 34963 : 34962 }),
    });
    chunks.push(data, Buffer.alloc(pad));
    offset += data.length + pad;
    const count =
      array.length / { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const accessor = { bufferView: view, componentType, count, type };
    if (minmax) {
      accessor.min = [0, 1, 2].map((k) =>
        Math.min(...pos.filter((_, i) => i % 3 === k)),
      );
      accessor.max = [0, 1, 2].map((k) =>
        Math.max(...pos.filter((_, i) => i % 3 === k)),
      );
    }
    accessors.push(accessor);
    return accessors.length - 1;
  }
  const attrs = {
    POSITION: add(new Float32Array(pos), "VEC3", 5126, true),
    NORMAL: add(new Float32Array(normal), "VEC3", 5126),
    TEXCOORD_0: add(new Float32Array(uv), "VEC2", 5126),
    JOINTS_0: add(new Uint16Array(ji), "VEC4", 5123),
    WEIGHTS_0: add(new Float32Array(weights), "VEC4", 5126),
  };
  const ind = add(new Uint16Array(indices), "SCALAR", 5123);
  const matrices = joints.flatMap((i) => [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    -world[i][0],
    -world[i][1],
    -world[i][2],
    1,
  ]);
  const bind = add(new Float32Array(matrices), "MAT4", 5126);
  const meshNode = nodes.length;
  nodes.push({ name: hero + "-atlas-skinned", mesh: 0, skin: 0 });
  const gltf = {
    asset: {
      version: "2.0",
      generator: "Iron Field code-authored art slice v1",
    },
    scene: 0,
    scenes: [{ nodes: [root, meshNode] }],
    nodes: nodes.map((n) => {
      const result = { ...n };
      if (result.children?.length === 0) delete result.children;
      return result;
    }),
    extensionsUsed: ["EXT_texture_webp"],
    extensionsRequired: ["EXT_texture_webp"],
    skins: [{ joints, skeleton: root, inverseBindMatrices: bind }],
    meshes: [
      {
        name: hero,
        primitives: [{ attributes: attrs, indices: ind, material: 0 }],
      },
    ],
    materials: [
      {
        name: "temple-atlas",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.88,
        },
        doubleSided: true,
      },
    ],
    textures: [{ extensions: { EXT_texture_webp: { source: 0 } }, sampler: 0 }],
    samplers: [
      { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 },
    ],
    images: [{ uri: "material-atlas-v1.webp" }],
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors,
    extras: {
      hero,
      triangles: indices.length / 3,
      vertices: pos.length / 3,
      joints: joints.length,
      atlas: [1024, 1024],
      uvInsetPixels: 8,
    },
  };
  const jsonRaw = Buffer.from(JSON.stringify(gltf));
  const json = Buffer.concat([
    jsonRaw,
    Buffer.alloc((4 - (jsonRaw.length % 4)) % 4, 32),
  ]);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + bin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(json.length);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return {
    glb: Buffer.concat([header, jh, json, bh, bin]),
    metadata: gltf.extras,
    gltf,
  };
}
if (process.argv[1]?.endsWith("generate-characters.mjs")) {
  mkdirSync("public/models", { recursive: true });
  const report = {};
  for (const hero of ["vanguard", "ranger"]) {
    const { glb, metadata } = character(hero);
    writeFileSync(`public/models/${hero}-v1.glb`, glb);
    report[hero] = { ...metadata, bytes: glb.length };
  }
  writeFileSync(
    "art-source/model-manifest.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
}
