import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/poly-api': {
        target: 'https://api.poly.pizza',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/poly-api/, '')
      },
      '/poly-static': {
        target: 'https://static.poly.pizza',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/poly-static/, '')
      }
    }
  }
})
