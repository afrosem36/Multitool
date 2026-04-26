import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({ fastRefresh: true })],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api/astrology': {
        target: 'https://json.astrologyapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/astrology/, '')
      },
      '/api/ninja': {
        target: 'https://api.api-ninjas.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ninja/, '')
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '^/s/': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
