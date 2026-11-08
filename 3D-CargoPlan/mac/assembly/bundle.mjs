// #created 11/08/2026
import { build } from 'esbuild'
import { mkdir, cp, writeFile } from 'node:fs/promises'
const root = process.argv[2]
await mkdir(`${root}/runtime/dist-server`,{recursive:true})
await build({ entryPoints:['src/server/index.ts','src/server/optimization-worker.ts'], outdir:`${root}/runtime/dist-server`,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',target:'node22',format:'esm',banner:{js:"import {createRequire as nativeCreateRequire} from 'node:module';const require=nativeCreateRequire(import.meta.url);"} })
// The worker path is part of the existing server's contract.
await cp(`${root}/runtime/dist-server/optimization-worker.mjs`,`${root}/runtime/dist-server/optimization-worker.js`)
await build({entryPoints:['mac/assembly/repack.mjs'],outfile:`${root}/repack.mjs`,bundle:true,platform:'node',target:'node22',format:'esm'})
await cp('dist',`${root}/runtime/dist`,{recursive:true})
await mkdir(`${root}/runtime/data`,{recursive:true});await cp('data/demo-items.json',`${root}/runtime/data/demo-items.json`)

await writeFile(`${root}/runtime/package.json`,JSON.stringify({type:"module"}))

await build({entryPoints:["mac/assembly/native-io.mjs"],outfile:`${root}/native-io.mjs`,bundle:true,platform:"node",target:"node22",format:"esm",banner:{js:"import {createRequire as ioCreateRequire} from 'node:module';const require=ioCreateRequire(import.meta.url);"}})
