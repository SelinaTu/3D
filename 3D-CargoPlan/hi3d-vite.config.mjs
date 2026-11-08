// #created 11/08/2026
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base:'./', plugins:[react()],
  build:{outDir:'../site',emptyOutDir:true,sourcemap:false,
    rolldownOptions:{input:'hi3d-cargoplan.html',output:{entryFileNames:'assets/hi3d-[name]-[hash].js',chunkFileNames:'assets/hi3d-[name]-[hash].js',assetFileNames:'assets/hi3d-[name]-[hash][extname]'}}},
  worker:{rolldownOptions:{output:{entryFileNames:'assets/hi3d-[name]-[hash].js',chunkFileNames:'assets/hi3d-[name]-[hash].js',assetFileNames:'assets/hi3d-[name]-[hash][extname]'}}}
});
