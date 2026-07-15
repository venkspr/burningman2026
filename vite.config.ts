import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Project Pages URL: https://venkspr.github.io/burningman2026/
  // Direct publish: commit the `docs/` build, then set Pages → main → /docs
  base: "/burningman2026/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
});
