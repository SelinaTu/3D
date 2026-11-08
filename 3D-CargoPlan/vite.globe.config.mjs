// #created 11/08/2026
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  root:fileURLToPath(new URL('./src/knowledge/globe/standalone',import.meta.url)),
  base:'./',plugins:[react()],
  build:{outDir:fileURLToPath(new URL('./globe/dist',import.meta.url)),emptyOutDir:true,sourcemap:false}
})
