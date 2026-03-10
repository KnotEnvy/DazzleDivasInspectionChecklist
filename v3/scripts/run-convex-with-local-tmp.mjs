import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const backendDir = path.join(projectRoot, "packages", "backend");
const convexTmpDir = path.join(projectRoot, ".convex-tmp");

const convexArgs = process.argv.slice(2);

if (convexArgs.length === 0) {
  console.error("Missing Convex command. Example: node scripts/run-convex-with-local-tmp.mjs dev");
  process.exit(1);
}

await mkdir(convexTmpDir, { recursive: true });

const convexCommand = path.join(
  backendDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "convex.exe" : "convex"
);
const child = spawn(convexCommand, convexArgs, {
  cwd: backendDir,
  env: {
    ...process.env,
    CONVEX_TMPDIR: convexTmpDir,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
