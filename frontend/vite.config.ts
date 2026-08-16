import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Dev: teruskan panggilan API ke backend lokal (compose: 127.0.0.1:8010)
      '/api': { target: 'http://127.0.0.1:8010', changeOrigin: true },
    },
  },
})
