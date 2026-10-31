import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const DATA_FILE = join(DATA_DIR, 'photos.json')
const META_FILE = join(DATA_DIR, 'photo-selected.json')
const TITLE_FILE = join(DATA_DIR, 'photo-titles.json')

const TOTAL = 5000

for (const f of [META_FILE, TITLE_FILE]) {
  if (!existsSync(f)) {
    console.error(`缺少 ${f}，请先跑 node scripts/fetch-pexels-meta.mjs`)
    process.exit(1)
  }
}

const meta = JSON.parse(readFileSync(META_FILE, 'utf8'))
const titles = JSON.parse(readFileSync(TITLE_FILE, 'utf8'))

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261029)

const missing = []
const photos = []
for (const m of meta) {
  const t = titles[m.pid]
  if (!t) {
    missing.push(m.pid)
    continue
  }
  const ratio = Math.round(Math.min(1.5, Math.max(0.6, m.h / m.w)) * 100) / 100
  photos.push({
    pid: m.pid,
    img: m.img,
    ratio,
    title: t[0],
    tag: t[1],
    author: m.author || 'Pexels 摄影师',
  })
}
if (missing.length) {
  console.warn(`[警告] ${missing.length} 张图没有中文标题，已跳过：${missing.join(', ')}`)
}

for (let i = photos.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[photos[i], photos[j]] = [photos[j], photos[i]]
}

const list = []
for (let i = 0; i < TOTAL; i++) {
  const p = photos[i % photos.length]
  list.push({
    id: i + 1,
    pid: p.pid,
    ratio: p.ratio,
    title: p.title,
    tag: p.tag,
    author: p.author,
    likes: 12 + Math.floor(rand() * 8988),
  })
}

const images = {}
for (const p of photos) images[p.pid] = p.img

writeFileSync(
  DATA_FILE,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: TOTAL,
    imgCount: photos.length,
    source: 'Pexels（免费图库；标题由真实画面描述改写，图片由浏览器实时加载）',
    images,
    list,
  }),
  'utf8'
)

const byTag = {}
for (const p of photos) byTag[p.tag] = (byTag[p.tag] || 0) + 1
console.log(`图库：${photos.length} 张真实照片`)
console.log('各标签图片数：', JSON.stringify(byTag))
console.log(`条目：${TOTAL} 条 -> data/photos.json`)
