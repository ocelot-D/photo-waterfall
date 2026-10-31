import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2] || 'http://localhost:5175/'

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean)
const CHROME = CANDIDATES.find((p) => existsSync(p))
if (!CHROME) {
  console.error('没找到 Chrome，请设置环境变量 CHROME_PATH')
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
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails
    throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text)
  }
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await sleep(11000)

const SNAP = `(() => {
  const stat = document.querySelector('.stat')?.innerText.replace(/\\s+/g, ' ').trim() || '';
  const foot = document.querySelector('.feed-foot')?.innerText.replace(/\\s+/g, ' ').trim() || '';
  const m = stat.match(/(\\d+)/);
  const firstCard = document.querySelector('article.card');
  return {
    loaded: m ? Number(m[1]) : 0,
    stat,
    foot,
    cards: document.querySelectorAll('article.card').length,
    dom: document.getElementsByTagName('*').length,
    docH: document.documentElement.scrollHeight,
    y: Math.round(window.scrollY),
    firstCardTop: firstCard ? firstCard.style.transform : '',
  };
})()`

const snaps = []
async function snap(tag) {
  const s = await evaluate(SNAP)
  s.tag = tag
  snaps.push(s)
  return s
}

await snap('首屏')

const diag = await evaluate(`({
  title: document.title,
  inputs: [...document.querySelectorAll('input')].map(i => i.type),
  text: (document.body.innerText || '').slice(0, 200).replace(/\\s+/g, ' '),
})`)
console.log('[诊断] 页面标题：', diag.title)
console.log('[诊断] input 数量：', diag.inputs.length, diag.inputs)
console.log('[诊断] 正文开头：', diag.text)

for (let i = 1; i <= 4; i++) {
  await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
  await sleep(2000)
  await snap('续接第 ' + i + ' 次')
}

console.log('')
console.log('══════ 触底续接验证 ══════')
for (const s of snaps) {
  console.log(
    `${s.tag.padEnd(14, '　')} 已加载 ${String(s.loaded).padStart(5)} 条 | ` +
      `卡片 ${String(s.cards).padStart(3)} 个 | DOM ${String(s.dom).padStart(5)} | ` +
      `文档高 ${s.docH}`
  )
  console.log(`                 状态栏：${s.stat}`)
  if (s.foot) console.log(`                 底部条：${s.foot}`)
}

await evaluate(`window.scrollTo(0, 0)`)
await sleep(1500)
const back = await snap('回顶部核对')
const firstSnap = snaps[0]
console.log('')
console.log(`首屏第一张卡片定位：${firstSnap.firstCardTop || '（空）'}`)
console.log(`续接 4 次后回顶部：${back.firstCardTop || '（空）'}`)
console.log(
  `→ ${firstSnap.firstCardTop === back.firstCardTop ? '完全一致，已有卡片没有被重排' : '不一致，说明被重排了'}`
)

try {
  await evaluate(`(() => {
    const input = document.querySelector('.search input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '鹿');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await sleep(1500)
  await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
  await sleep(2000)
  await snap('搜索"鹿"后到底')
  const s = snaps[snaps.length - 1]
  console.log(`搜索"鹿"后到底  已加载 ${s.loaded} 条 | 底部条：${s.foot || '（空）'}`)
} catch (e) {
  console.log('[搜索态验证跳过]', e.message)
}

const first = snaps[0]
const last = snaps.find((s) => s.tag === '续接第 4 次') || snaps[snaps.length - 1]
console.log('')
console.log('结论：')
console.log(`  首屏条数是否仍为 5000：${first.loaded === 5000 ? '是' : '否（' + first.loaded + '）'}`)
console.log(`  续接后条数是否增长：${last.loaded > first.loaded ? '是（' + first.loaded + ' → ' + last.loaded + '）' : '否'}`)
console.log(
  `  续接后卡片数是否稳定：${
    Math.abs(last.cards - first.cards) <= 6 ? '是（' + first.cards + ' → ' + last.cards + '）' : '否（' + first.cards + ' → ' + last.cards + '）'
  }`
)

ws.close()
chrome.kill()
