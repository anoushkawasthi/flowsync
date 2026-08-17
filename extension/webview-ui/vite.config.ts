import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Emit relative asset URLs. With the default ('/'), the bundled @font-face
  // rules come out as url(/assets/archivo-latin.woff2), which inside a VS Code
  // webview resolves against the webview CDN origin rather than the extension's
  // localResourceRoots — so the fonts 404 and the panel silently falls back to
  // a system face. './' makes them resolve next to index.css, which is already
  // inside webview-ui/build and therefore inside localResourceRoots.
  base: './',
  build: {
    outDir: 'build',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      output: {
        // Deterministic filenames (no hashes) so the extension can reference them
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
