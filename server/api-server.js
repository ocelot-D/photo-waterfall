import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, normalize, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = join(ROOT, 'dist')
const DATA_FILE = join(ROOT, 'data', 'photos.json')

const PORT = Number(process.env.PORT) || 3003

let DB = { total: 0, imgCount: 0, list: [] }
try {
  DB = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  console.log(`[后端] 数据已载入：${DB.list.length} 条 / ${DB.imgCount} 张真实图片`)
} catch (e) {
  console.error('[后端] 读 data/photos.json 失败，请先跑 npm run gen：' + e.message)
}

const TAGS = [...new Set(DB.list.map((it) => it.tag))]

const POOL = []
const seenPid = new Set()
for (const it of DB.list) {
  if (!seenPid.has(it.pid)) {
    seenPid.add(it.pid)
    POOL.push(it)
  }
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b]
  return a
}
function pickStep(n) {
  for (const s of [137, 131, 127, 113, 97, 89, 83]) if (gcd(s, n) === 1) return s
  return 1
}


const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function sendJson(res, code, msg, data, status = 200) {
  const body = JSON.stringify({ code, msg, data })
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

function sendFile(res, filePath, immutable = false) {
  const buf = readFileSync(filePath)
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    'Content-Length': buf.length,
    ...(immutable ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {}),
  })
  res.end(buf)
}

function handleMeta(res) {
  sendJson(res, 0, 'ok', {
    tags: TAGS,
    total: DB.total,
    imgCount: DB.imgCount,
    images: DB.images || {},
  })
}

function handlePhotos(res, url) {
  const q = url.searchParams
  const keyword = (q.get('keyword') || '').trim().toLowerCase()
  const tag = (q.get('tag') || '').trim()
  const page = Number(q.get('page')) || 0
  const pageSize = Number(q.get('pageSize')) || 0
  const delay = Math.min(Number(q.get('delay')) || 0, 5000)

  let result = DB.list
  if (tag) result = result.filter((it) => it.tag === tag)
  if (keyword) {
    result = result.filter(
      (it) => it.title.toLowerCase().includes(keyword) || it.author.toLowerCase().includes(keyword)
    )
  }

  const total = result.length
  const list = page > 0 && pageSize > 0 ? result.slice((page - 1) * pageSize, page * pageSize) : result

  const reply = () =>
    sendJson(res, 0, 'ok', {
      list,
      total,
      page: page || 1,
      pageSize: pageSize || total,
      hasMore: !keyword,
    })

  if (delay > 0) setTimeout(reply, delay)
  else reply()
}

function handleMore(res, url) {
  const q = url.searchParams
  const keyword = (q.get('keyword') || '').trim().toLowerCase()
  const tag = (q.get('tag') || '').trim()
  const cursor = Math.max(Number(q.get('cursor')) || 0, 0)
  const count = Math.min(Math.max(Number(q.get('count')) || 500, 1), 2000)

  if (keyword) return sendJson(res, 0, 'ok', { list: [], hasMore: false, cursor })

  const pool = tag ? POOL.filter((it) => it.tag === tag) : POOL
  if (pool.length === 0) return sendJson(res, 0, 'ok', { list: [], hasMore: false, cursor })

  const step = pickStep(pool.length)
  const list = []
  for (let k = 0; k < count; k++) {
    const seq = cursor + k
    const src = pool[(seq * step) % pool.length]
    list.push({
      id: 1000000 + seq,
      pid: src.pid,
      ratio: src.ratio,
      title: src.title,
      tag: src.tag,
      author: src.author,
      likes: src.likes,
    })
  }
  sendJson(res, 0, 'ok', { list, hasMore: true, cursor: cursor + count })
}

function handleStatic(req, res, pathname) {
  if (!existsSync(DIST_DIR)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<h3>还没有前端产物</h3><p>请先在项目目录执行 <code>npm run build</code>，再启动本服务。</p>'
    )
    return
  }

  let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  if (rel === '/' || rel === '\\') rel = '/index.html'
  let filePath = join(DIST_DIR, rel)
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403).end('forbidden')
    return
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath, rel.startsWith('/img/'))
    return
  }

  sendFile(res, join(DIST_DIR, 'index.html'))
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const p = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    })
    res.end()
    return
  }

  try {
    if (p === '/api/health') return sendJson(res, 0, 'ok', { ok: true, pid: process.pid })
    if (p === '/api/meta') return handleMeta(res)
    if (p === '/api/photos') return handlePhotos(res, url)
    if (p === '/api/more') return handleMore(res, url)
    if (p.startsWith('/api/')) return sendJson(res, 404, '接口不存在：' + p, null, 404)
    return handleStatic(req, res, p)
  } catch (e) {
    console.error('[后端] 出错：', e)
    sendJson(res, 500, '服务器内部错误：' + e.message, null, 500)
  }
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('')
    console.error(`[后端] 端口 ${PORT} 已被别的程序占用，本进程退出。`)
    console.error('       多半是你之前已经开着一份 PhotoFeed，或者终端没关干净。')
    console.error(`       想先释放端口：  taskkill /PID <进程号> /F   （进程号用 netstat -ano | findstr :${PORT} 查）`)
    console.error('')
    process.exit(1)
  }
  throw e
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[后端] PhotoFeed 已启动：http://localhost:${PORT}`)
  console.log(`[后端] 接口：/api/meta  /api/photos?keyword=&tag=&page=&pageSize=  /api/more?cursor=&count=`)
  console.log(`[后端] 续接池：${POOL.length} 张去重真实照片（推荐流滚到底时从这里循环取）`)
})
