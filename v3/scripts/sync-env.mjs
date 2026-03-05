import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const backendEnvPath = join(root, "packages", "backend", ".env.local");
const webEnvPath = join(root, "apps", "web", ".env.local");

if (!existsSync(backendEnvPath)) {
  console.error(`[sync:env] Missing ${backendEnvPath}`);
  process.exit(1);
}

const backendEnv = readFileSync(backendEnvPath, "utf8");
const match = backendEnv.match(/^CONVEX_URL=(.+)$/m);

if (!match?.[1]) {
  console.error("[sync:env] CONVEX_URL is missing in packages/backend/.env.local");
  process.exit(1);
}

const convexUrl = match[1].trim();
writeFileSync(webEnvPath, `VITE_CONVEX_URL=${convexUrl}\n`, "utf8");
console.log(`[sync:env] Wrote ${webEnvPath}`);