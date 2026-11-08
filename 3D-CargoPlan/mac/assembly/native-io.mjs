// #created 11/08/2026
import fs from 'node:fs'
import { parseExcelBuffer } from '../../src/core/data-parser.ts'
import { buildCargoTemplateWorkbook, buildSolutionWorkbook } from '../../src/core/export-utils.ts'
import XLSX from '../../src/core/xlsx-adapter.ts'
const [mode,input,output] = process.argv.slice(2)
if(mode==='import') {
 const buffer=fs.readFileSync(input)
 const items=parseExcelBuffer(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength))
 if(!items.length)throw new Error('未识别到货物，请检查导入模板与单位')
 fs.writeFileSync(output,JSON.stringify(items));console.log(JSON.stringify({items:items.length}))
} else if(mode==='template')fs.writeFileSync(output,XLSX.write(buildCargoTemplateWorkbook(),{type:'buffer',bookType:'xlsx'}))
else if(mode==='export') {
 const scene=JSON.parse(fs.readFileSync(input));if(!scene.seed)throw new Error('请先重新计算，再导出已校验方案')
 fs.writeFileSync(output,XLSX.write(buildSolutionWorkbook(scene.seed),{type:'buffer',bookType:'xlsx'}))
} else throw new Error('未知文件操作')
