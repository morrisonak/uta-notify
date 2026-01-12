// app.config.ts
import { defineConfig } from "@tanstack/start/config";
var app_config_default = defineConfig({
  server: {
    preset: "cloudflare-pages",
    rollupConfig: {
      external: ["node:async_hooks"]
    }
  },
  tsr: {
    appDirectory: "app",
    routesDirectory: "app/routes",
    generatedRouteTree: "app/routeTree.gen.ts"
  }
});
export {
  app_config_default as default
};
