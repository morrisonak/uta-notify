import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [
    // Only include devtools in development
    !isProduction && devtools(),
    // Cloudflare Workers support
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // Path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    // Tailwind CSS v4
    tailwindcss(),
    // TanStack Start
    tanstackStart(),
    // React
    viteReact(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      external: ["node:stream", "node:stream/web", "node:async_hooks"],
    },
  },
});
