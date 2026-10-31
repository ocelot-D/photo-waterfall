import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({

  plugins: [vue()],

  base: '/',

  server: {
    host: true,

    port: 5175,

    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3003',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',

    emptyOutDir: true,

    chunkSizeWarningLimit: 900,
  },
})
