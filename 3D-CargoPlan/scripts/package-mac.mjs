// #created 11/08/2026
import { execFileSync } from 'node:child_process'
import { mkdtemp, symlink, rm, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
if (process.platform !== 'darwin') throw new Error('请在 macOS 上制作 Mac 安装包')
const { version } = JSON.parse(await readFile('package.json','utf8'))
const root=path.resolve('output/desktop/release'), source=path.join(root,`mac-${process.arch}`,'CargoPlan.app')
const stage=await mkdtemp(path.join(os.tmpdir(),'cargoplan-dmg-'))
try {
  execFileSync('ditto',[source,path.join(stage,'CargoPlan.app')])
  await symlink('/Applications',path.join(stage,'Applications'))
  const zip=path.join(root,`CargoPlan-${version}-mac-${process.arch}.zip`)
  const dmg=path.join(root,`CargoPlan-${version}-mac-${process.arch}.dmg`)
  execFileSync('ditto',['-c','-k','--sequesterRsrc','--keepParent',source,zip],{stdio:'inherit'})
  execFileSync('hdiutil',['create','-volname','CargoPlan','-srcfolder',stage,'-ov','-format','UDZO',dmg],{stdio:'inherit'})
  for(const file of [zip,dmg]) {
    const hash=createHash('sha256').update(await readFile(file)).digest('hex')
    await writeFile(`${file}.sha256`,`${hash}  ${path.basename(file)}\n`)
  }
} finally { await rm(stage,{recursive:true,force:true}) }
