import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Giao dien web cho bitcoin-raw-trans.
// Khi chay `npm run web:dev`, moi request /api duoc proxy sang server.js
// (cong 3000) — noi thuc su goi vao core trong ../src.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.WEB_PORT || 3000}`,
        changeOrigin: true,
      },
    },
  },
})
