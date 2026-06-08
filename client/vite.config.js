import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

// Generate build timestamp for cache busting
const buildTime = Date.now().toString()

// Plugin to inject build time into service worker
function swVersionPlugin() {
  return {
    name: 'sw-version',
    writeBundle() {
      // Read the service worker from public folder
      const swPath = resolve(__dirname, 'dist/sw.js')
      try {
        let swContent = readFileSync(swPath, 'utf-8')
        // Replace the placeholder with actual build time
        swContent = swContent.replace('__BUILD_TIME__', buildTime)
        writeFileSync(swPath, swContent)
        console.log(`[SW] Injected build version: ${buildTime}`)
      } catch (e) {
        console.log('[SW] No service worker found to update')
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  define: {
    // Make build time available to the app
    '__BUILD_TIME__': JSON.stringify(buildTime)
  }
})
