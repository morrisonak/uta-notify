import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// Plugin to stub cloudflare:workers for client build
function cloudflareWorkersStub(): Plugin {
  const stubPath = path.resolve(__dirname, "src/utils/cloudflare-stub.ts");
  return {
    name: "cloudflare-workers-stub",
    applyToEnvironment(environment) {
      // Only apply to client environment
      return environment.name === "client";
    },
    resolveId(id) {
      if (id === "cloudflare:workers") {
        return stubPath;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    cloudflareWorkersStub(),
    tailwindcss(),
    tsconfigPaths(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    conditions: ["browser", "module", "jsnext:main", "jsnext"],
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          external: [
            /^node:/,
          ],
        },
      },
    },
  },
});
