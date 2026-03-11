import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        "apps/web/src/lib/draftHydration.test.ts",
        "apps/web/src/lib/offlineOutbox.test.ts",
        "apps/web/src/lib/offlineReplay.test.ts",
        "apps/web/src/lib/offlineInspectionState.test.ts",
        "apps/web/src/lib/runtimeConfig.test.ts",
        "packages/backend/convex/lib/jobLifecycle.test.ts",
        "packages/backend/convex/lib/inspectionMetrics.test.ts",
        "packages/backend/convex/lib/inspectionReporting.test.ts",
      ],
    },
  })
);
