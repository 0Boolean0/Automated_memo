import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Path aliases — lets us write:
  //   import { Button } from '@/components/ui/Button'
  // instead of:
  //   import { Button } from '../../../components/ui/Button'
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Development server config
  server: {
    port: 5173,
    host: true, // expose on local network (same as --host flag)

    // API proxy — during development, requests to /api/* are forwarded to FastAPI.
    // This means React and FastAPI can live on different ports during dev,
    // but from React's perspective, the API is on the same origin.
    // This also avoids CORS issues during development.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Uncomment below if you set up local HTTPS for the FastAPI server:
        // secure: false,
      },
    },
  },

  // Preview server (for testing the production build locally)
  preview: {
    port: 5173,
    host: true,
  },

  build: {
    // Output directory — FastAPI will serve files from here in production
    outDir: '../backend/static',
    emptyOutDir: true,
  },
})
