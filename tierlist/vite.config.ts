import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the app from https://<user>.github.io/<repo>/, so every
// asset URL has to be prefixed with the repo name. `VITE_BASE` lets the Pages
// workflow (or a custom domain) override it without touching this file.
const base = process.env.VITE_BASE ?? '/mawster/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { outDir: 'dist', sourcemap: false },
})
