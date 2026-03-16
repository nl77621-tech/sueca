import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: { allowedHosts: true },
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true, rewriteWsOrigin: true }
    }
  },
})
