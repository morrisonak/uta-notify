import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
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
            "cloudflare:workers",
            /^node:/,
          ],
        },
      },
    },
  },
});
