import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const packageFile = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(await readFile(packageFile, "utf8"));
const output = new URL("../public/maplibre/", import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(
  join(dirname(packageFile), "dist/maplibre-gl-worker.mjs"),
  new URL(`maplibre-gl-worker-${version}.mjs`, output),
);
await copyFile(
  join(dirname(packageFile), "LICENSE.txt"),
  new URL("LICENSE.txt", output),
);
console.log(
  `Prepared MapLibre ${version} worker for both Next.js and Cloudflare.`,
);
