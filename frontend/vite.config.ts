import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor estable en chunks separados: descarga paralela en el móvil
        // y caché entre deploys (los hashes de los vendors no cambian).
        advancedChunks: {
          groups: [
            { name: 'vendor-stellar', test: /node_modules\/@stellar\// },
            { name: 'vendor-kit', test: /node_modules\/@creit\.tech\// },
            {
              name: 'vendor-react',
              test: /node_modules\/(react|react-dom|zustand|@tanstack)\//,
            },
          ],
        },
      },
    },
  },
})
