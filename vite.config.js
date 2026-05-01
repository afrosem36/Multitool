import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({ fastRefresh: true }), cloudflare()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('\\react\\') || id.includes('/react/')) {
            return 'vendor-react';
          }

          if (id.includes('pdf-lib') || id.includes('pdfjs-dist') || id.includes('jspdf')) {
            return 'vendor-pdf';
          }

          if (id.includes('html2pdf.js') || id.includes('html2canvas')) {
            return 'vendor-html-export';
          }

          if (id.includes('heic2any')) {
            return 'vendor-heic';
          }

          if (id.includes('xlsx')) {
            return 'vendor-xlsx';
          }

          if (id.includes('recharts')) {
            return 'vendor-charts';
          }

          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }

          if (id.includes('mammoth') || id.includes('docx')) {
            return 'vendor-docs';
          }

          return undefined;
        },
      },
    },
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
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '^/s/': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})