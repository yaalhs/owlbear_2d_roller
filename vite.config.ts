import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        background: "background.html",
        toast: "roll-toast.html",
      },
    },
  },
});
