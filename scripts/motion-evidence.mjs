// Build review videos and labeled contact sheets from real Blender render frames.
import {
  readdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = "evidence/weapon-motion-v1";
const temp = "/tmp/weapon-motion-labels";
mkdirSync(temp, { recursive: true });
const clips = [
  "Saber1",
  "Saber2",
  "Saber3",
  "SpearAttack",
  "GreatbladeAttack",
  "ShortbowShot",
  "LongbowShot",
  "FanbowShot",
];
const run = (args) => {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "inherit" },
  );
  if (r.status) throw Error(`ffmpeg failed ${r.status}`);
};
for (const clip of clips) {
  const bow = clip.endsWith("Shot");
  const labels = bow
    ? [
        "READY / actual projectile event",
        "RELEASE / follow-through",
        "REDRAW",
        "READY",
      ]
    : ["ANTICIPATION", "STRIKE", "RECOVERY", "END / combo link"];
  const phases = bow ? [0, 4, 21, 32] : [0, 15, 25, 32];
  const subtitle = `${clip} | 33 Blender frames | slowed`;
  run([
    "-framerate",
    "30",
    "-i",
    `${root}/${clip}/%03d.png`,
    "-vf",
    "format=yuv420p",
    "-metadata",
    `title=${subtitle}`,
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    `${root}/${clip}.mp4`,
  ]);
  // This ffmpeg build omits drawtext. ImageMagick adds explicit annotations
  // to a separate contact sheet; source evidence frames remain unmodified.
  const panels = phases.map((f, i) => {
    const path = `${temp}/${clip}-${i}.png`;
    execFileSync("magick", [
      `${root}/${clip}/${String(f).padStart(3, "0")}.png`,
      "-resize",
      "300x360",
      "-background",
      "#10151a",
      "-gravity",
      "North",
      "-splice",
      "0x30",
      "-gravity",
      "South",
      "-splice",
      "0x34",
      "-font",
      "DejaVu-Sans",
      "-fill",
      "white",
      "-pointsize",
      "12",
      "-gravity",
      "NorthWest",
      "-annotate",
      "+8+6",
      `${clip} - phase ${(f / 32).toFixed(3)}`,
      "-pointsize",
      "11",
      "-gravity",
      "SouthWest",
      "-annotate",
      "+8+10",
      labels[i],
      path,
    ]);
    return path;
  });
  execFileSync("magick", [...panels, "+append", `${root}/${clip}-phases.png`]);
}
const artifacts = [
  ...clips.flatMap((c) => [`${root}/${c}.mp4`, `${root}/${c}-phases.png`]),
  ...["ranger", "vanguard"].flatMap((h) => [
    `public/models/${h}-weapon-motion-v1.glb`,
    `art-source/${h}/blender-weapon-motion-v1/${h}.blend`,
  ]),
];
writeFileSync(
  `${root}/artifact-manifest.json`,
  JSON.stringify(
    {
      provenance:
        "Real Blender renders and source/GLB hashes. AI concept sheets are guidance only.",
      clips: clips.map((clip) => ({
        clip,
        frames: 33,
        phaseRange: [0, 1],
        reviewFps: 30,
        renderFrames: readdirSync(`${root}/${clip}`).filter((n) =>
          n.endsWith(".png"),
        ).length,
      })),
      artifacts: artifacts.map((path) => ({
        path,
        bytes: statSync(path).size,
        sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
      })),
    },
    null,
    2,
  ),
);
