import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2]
const waitMs = Number(process.argv[3] || 12000)
if (!url) {
  console.error('用法：node scripts/measure-perf.mjs <url> [等待毫秒]')
  process.exit(1)
}

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean)
const CHROME = CANDIDATES.find((p) => existsSync(p))
if (!CHROME) {
  console.error('没找到 Chrome，请设置环境变量 CHROME_PATH 指向 chrome 可执行文件')
  process.exit(1)
}

const port = 9500 + Math.floor(Math.random() * 300)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await r.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(200)
  }
  throw new Error('Chrome 没起来')
}

const ws = new WebSocket(await getWsUrl())
let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
await new Promise((r) => ws.addEventListener('open', r))

function send(method, params = {}) {
  const myId = ++id
  ws.send(JSON.stringify({ id: myId, method, params }))
  return new Promise((res) => pending.set(myId, res))
}

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  return r.result?.result?.value
}

const readMetrics = async () => {
  const r = await send('Performance.getMetrics')
  const map = {}
  for (const m of r.result?.metrics || []) map[m.name] = m.value
  return map
}

await send('Page.enable')
await send('Network.enable')
await send('Performance.enable')
await send('Page.navigate', { url })
await sleep(waitMs)

const before = await readMetrics()

await evaluate(`new Promise((resolve) => {
  window.scrollTo(0, 0)
  const start = performance.now()
  function step(ts) {
    window.scrollBy(0, 6)
    const max = document.documentElement.scrollHeight - window.innerHeight - 20
    if (ts - start < 6000 && window.scrollY < max) requestAnimationFrame(step)
    else resolve(true)
  }
  requestAnimationFrame(step)
})`)
await sleep(1200)

const after = await readMetrics()

const dom = await evaluate(`({
  dom: document.getElementsByTagName('*').length,
  cards: document.querySelectorAll('article.card').length,
  imgs: document.querySelectorAll('img.full').length,
  loaded: [...document.querySelectorAll('img.full')].filter(i => i.classList.contains('is-loaded')).length,
  failed: document.querySelectorAll('.failed').length,
})`)

const d = (k) => Math.round(((after[k] || 0) - (before[k] || 0)) * 1000) / 1000
const layoutCount = d('LayoutCount')
const out = {
  url,
  dom: dom.dom,
  cards: dom.cards,
  imgs: dom.imgs,
  loaded: dom.loaded,
  failed: dom.failed,
  load: {
    layoutSec: Math.round((after.LayoutDuration || 0) * 1000) / 1000,
    recalcStyleSec: Math.round((after.RecalcStyleDuration || 0) * 1000) / 1000,
    taskSec: Math.round((after.TaskDuration || 0) * 1000) / 1000,
    nodes: Math.round(after.Nodes || 0),
    heapMB: Math.round(((after.JSHeapUsedSize || 0) / 1048576) * 10) / 10,
  },
  scroll: {
    layoutCount,
    layoutSec: d('LayoutDuration'),
    recalcStyleSec: d('RecalcStyleDuration'),
    msPerLayout: layoutCount ? Math.round((d('LayoutDuration') / layoutCount) * 1000 * 100) / 100 : 0,
    taskSec: d('TaskDuration'),
    scriptSec: d('ScriptDuration'),
  },
}
console.log(JSON.stringify(out, null, 1))
ws.close()
chrome.kill()
