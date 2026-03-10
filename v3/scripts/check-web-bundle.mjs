import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, "apps", "web", "dist", "assets");
const maxMainChunkBytes = Number(process.env.MAX_WEB_MAIN_CHUNK_BYTES ?? 400 * 1024);

const assetNames = await readdir(assetsDir);
const mainChunkName = assetNames.find((name) => /^index-.*\.js$/.test(name));

if (!mainChunkName) {
  console.error("Bundle budget check failed: could not find the main web chunk in dist/assets.");
  process.exit(1);
}

const mainChunkPath = path.join(assetsDir, mainChunkName);
const mainChunkSize = (await stat(mainChunkPath)).size;

if (mainChunkSize > maxMainChunkBytes) {
  console.error(
    `Bundle budget check failed: ${mainChunkName} is ${mainChunkSize} bytes, over the ${maxMainChunkBytes} byte limit.`
  );
  process.exit(1);
}

console.log(
  `Bundle budget check passed: ${mainChunkName} is ${mainChunkSize} bytes (limit ${maxMainChunkBytes}).`
);
