import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  define: {
    "import.meta.env.VITE_KEYCLOAK_BASE_URL": JSON.stringify(
      process.env.VITE_KEYCLOAK_BASE_URL ?? process.env.KEYCLOAK_BASE_URL ?? ""
    ),
    "import.meta.env.VITE_KEYCLOAK_REALM": JSON.stringify(
      process.env.VITE_KEYCLOAK_REALM ?? process.env.KEYCLOAK_REALM ?? ""
    ),
    "import.meta.env.VITE_KEYCLOAK_CLIENT_ID": JSON.stringify(
      process.env.VITE_KEYCLOAK_CLIENT_ID ?? process.env.KEYCLOAK_CLIENT_ID ?? ""
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      "scanner.ministryoftravel.com.au",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
