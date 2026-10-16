import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { validateBytes } from "gltf-validator";
export async function validateCharacter(hero) {
  const uri = `${hero}-v1.glb`;
  return validateBytes(new Uint8Array(readFileSync(`public/models/${uri}`)), {
    uri,
    externalResourceFunction: async (resource) => {
      if (resource !== "material-atlas-v1.webp")
        throw new Error(`Unexpected external resource: ${resource}`);
      return new Uint8Array(readFileSync(`public/models/${resource}`));
    },
  });
}
if (process.argv[1]?.endsWith("validate-characters.mjs")) {
  mkdirSync("evidence/art-v1", { recursive: true });
  for (const hero of ["vanguard", "ranger"]) {
    const report = await validateCharacter(hero);
    writeFileSync(
      `evidence/art-v1/gltf-validation-${hero}.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(hero, report.issues);
    if (report.issues.numErrors) process.exitCode = 1;
  }
}
