import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/web/src"),
      "convex/_generated": path.resolve(
        __dirname,
        "./packages/backend/convex/_generated"
      ),
    },
  },
  test: {
    environment: "node",
    include: ["apps/web/src/**/*.test.ts", "packages/backend/**/*.test.ts"],
  },
});
