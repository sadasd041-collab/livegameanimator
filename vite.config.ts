import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const apiProxy = {
  '/api': 'http://127.0.0.1:8787',
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
