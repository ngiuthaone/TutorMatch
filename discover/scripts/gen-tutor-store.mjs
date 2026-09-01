import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const storePath = join(root, "data", "published-tutors.json");
const outPath = join(root, "public", "tutor-store-data.js");
if (!existsSync(storePath)) {
  console.log("skipped: data/published-tutors.json is absent; keeping committed public/tutor-store-data.js");
  process.exit(0);
}
const data = JSON.parse(readFileSync(storePath, "utf8"));
writeFileSync(outPath, `window.TUTORIA_STORE = ${JSON.stringify(data, null, 2)};\n`);
console.log(`wrote public/tutor-store-data.js (${data.length} tutors)`);