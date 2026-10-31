import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'data', 'photo-meta.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const QUERIES = [
  'portrait', 'woman', 'man',
  'animal', 'cat', 'dog', 'bird',
  'food', 'coffee', 'dessert',
  'architecture', 'building', 'interior',
  'minimal', 'night', 'neon',
  'street', 'urban',
  'landscape', 'mountain', 'sunset', 'lake', 'forest',
  'travel', 'beach', 'desert',
  'city', 'skyline',
]
const PAGES = [1, 2]
const TARGET = 99999

function fetchPage(q, page) {
  const url = `https://www.pexels.com/search/${encodeURIComponent(q)}/?page=${page}`
  try {
    return execFileSync(
      'curl',
      ['-s', '-m', '30', '-L', '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
  } catch (e) {
    console.log(`  [跳过] ${q} p${page}：${e.message}`)
    return ''
  }
}

const seen = new Map()
if (existsSync(OUT)) {
  for (const it of JSON.parse(readFileSync(OUT, 'utf8'))) seen.set(it.pid, it)
  console.log(`已有 ${seen.size} 条，继续补齐`)
}

outer: for (const q of QUERIES) {
  for (const page of PAGES) {
    if (seen.size >= TARGET) break outer
    const html = fetchPage(q, page)
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!m) {
      console.log(`  [失败] ${q} p${page}`)
      continue
    }
    let list = []
    try {
      list = JSON.parse(m[1]).props?.pageProps?.initialData?.data || []
    } catch {
      console.log(`  [解析失败] ${q} p${page}`)
      continue
    }
    let added = 0
    for (const item of list) {
      const a = item.attributes || {}
      if (!a.id || !a.alt || !a.width || !a.height) continue
      if (a.alt.startsWith('Free stock photo of')) continue
      if (seen.has(a.id)) continue
      const u = a.user || {}
      const base = (a.image && (a.image.large || a.image.medium || a.image.small)) || ''
      if (!base) continue
      seen.set(a.id, {
        pid: a.id,
        img: base.split('?')[0],
        alt: a.alt,
        tags: (a.tags || []).map((t) => t.name).slice(0, 8),
        w: a.width,
        h: a.height,
        author: [u.first_name, u.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
        color: a.main_color || null,
      })
      added++
    }
    console.log(`${q} p${page}：新增 ${added}，累计 ${seen.size}`)
  }
}

const all = [...seen.values()]
writeFileSync(OUT, JSON.stringify(all, null, 1), 'utf8')
console.log(`\n完成：${all.length} 条 -> data/photo-meta.json`)
