import { defineConfig } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), viteReact()],
});

export default config;
