// #created 11/08/2026
import { build } from 'esbuild'
await build({
  entryPoints: ['src/server/index.ts', 'src/server/optimization-worker.ts'],
  outdir: 'dist-server', bundle: true, platform: 'node', target: 'node22',
  format: 'esm', packages: 'external', sourcemap: true
})
