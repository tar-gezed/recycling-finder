import { fileURLToPath, URL } from "url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/recycling-finder/",
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      mode: "development",
      base: "/recycling-finder/",
      // srcDir: "src",
      // filename: "sw.ts",
      includeAssets: ["/favicon.ico", "/recycling-finder/favicon.ico"],
      // strategies: "injectManifest",
      manifest: {
        name: "Recycling Finder",
        short_name: "RF",
        description: "An application to find recycling centers thanks to OpenStreetMap",
        icons: [
          {
            src: "/recycling-finder/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/recycling-finder/android-chrome-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
        ],
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/recycling-finder/",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
