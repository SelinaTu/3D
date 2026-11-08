// #created 11/08/2026
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export async function runDesktopSmoke(window, servicePid) {
  const results = { servicePid, checks: [], consoleErrors: [], checkedAt: new Date().toISOString() }
  window.webContents.on('console-message', (_event, ...args) => { results.consoleErrors.push(args.map(String).join(' ')) })
  const js = code => window.webContents.executeJavaScript(code)
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
      if (await js(expression)) return
      await sleep(200)
    }
    await writeFile(path.join(dir, 'smoke-failure.json'), JSON.stringify({ ...results, body: await js('document.body.innerText') },null,2))
    throw new Error(`界面等待超时: ${expression}`)
  }
  const dir = path.resolve('output/desktop')
  await mkdir(dir, { recursive: true })
  await waitFor("document.body.innerText.includes('装箱工作台') && document.querySelector('canvas') !== null")
  assert.equal(await js('location.origin'), 'cargoplan://app')
  assert.equal(await js("typeof require"), 'undefined')
  assert.equal(await js("!!document.createElement('canvas').getContext('webgl2')"), true)
  results.checks.push('stable-app-origin', 'isolated-renderer', 'webgl2', 'demo-canvas')
  await writeFile(path.join(dir, 'desktop-workbench.png'), (await window.webContents.capturePage()).toPNG())
  const api = await js(`(async()=>{
    const health=await(await fetch('/api/health')).json();
    const config=(await(await fetch('/api/config')).json()).config;
    const demo=await(await fetch('/api/load-demo')).json();
    const item={id:'desktop-test',name:'桌面计算测试',category:'箱',dimensions:{length:100,width:100,height:100},weight:10,quantity:1,allowedOrientations:['standing'],canStackOnTop:true,hasGlass:false,canOffsetStack:false,colorTag:'蓝色',rawData:{}};
    const created=await(await fetch('/api/optimize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[item],config:{...config,algorithm:'greedy',timeLimit:1000}})})).json();
    for(let i=0;i<100;i++){
      const job=await(await fetch('/api/jobs/'+created.jobId)).json();
      if(['completed','failed','cancelled'].includes(job.status)) return {health:health.status,demo:demo.total,status:job.status,valid:job.solutions?.[0]?.validation?.valid,error:job.error};
      await new Promise(r=>setTimeout(r,100));
    }throw new Error('计算超时');
  })()`)
  assert.equal(api.health,'running');assert.ok(api.demo > 1196);assert.equal(api.status,'completed',api.error);assert.equal(api.valid,true)
  results.api=api;results.checks.push('bundled-demo-data','backend-worker-compute')
  await js(`(()=>{const select=document.querySelector('select[aria-label="多站验证场景"]');select.value='training';select.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='① 生成题目').click()`)
  await waitFor("document.querySelector('.route-problem-summary') !== null")
  await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='② 求解当前题').click()`)
  await waitFor("document.querySelector('.route-test-status.complete') !== null")
  assert.ok((await js("document.querySelector('.route-test-status').innerText")).includes('5 站全部任务完成'))
  results.checks.push('browser-worker-five-stop-generation-solve-replay')
  window.webContents.send('workspace:navigate','ports')
  await waitFor("document.body.innerText.includes('11,835') && document.querySelector('.atlas-canvas canvas') !== null")
  results.checks.push('native-menu-navigation','knowledge-globe-assets')
  await writeFile(path.join(dir, 'desktop-globe.png'), (await window.webContents.capturePage()).toPNG())
  await writeFile(path.join(dir, 'smoke.json'), JSON.stringify(results,null,2)+'\n')
  console.log('DESKTOP_SMOKE_PASS', JSON.stringify(results))
}
