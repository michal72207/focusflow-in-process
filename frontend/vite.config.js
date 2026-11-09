import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      // COOP is safe and doesn't break anything.
      // COEP is intentionally removed: it blocks YouTube iframes and other
      // cross-origin embeds. onnxruntime-web single-threaded WASM works
      // without SharedArrayBuffer (no COEP required).
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  preview: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  optimizeDeps: {
    exclude: ['onnxruntime-web', '@mediapipe/tasks-vision'],
  },
})
