import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from 'node:net'
import { execFileSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PORT_API = Number(process.env.PORT) || 3003
const PORT_WEB = 5175

const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

if (!existsSync(VITE_BIN)) {
  console.error('没找到 vite，请先执行 npm install')
  process.exit(1)
}

const children = []

function run(tag, file, args) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })
  const prefix = `[${tag}] `
  const pipe = (stream, out) => {
    stream.setEncoding('utf8')
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split(/\r?\n/)
      buf = lines.pop()
      lines.forEach((l) => out.write(prefix + l + '\n'))
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    console.log(`${prefix}进程退出，code=${code}`)
    children.forEach((c) => !c.killed && c.kill())
    process.exit(code ?? 0)
  })
  children.push(child)
  return child
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const sock = connect({ port, host: '127.0.0.1' })
    const done = (free) => {
      sock.destroy()
      resolve(free)
    }
    sock.setTimeout(800)
    sock.once('connect', () => done(false))
    sock.once('timeout', () => done(true))
    sock.once('error', () => done(true))
  })
}

function whoUses(port) {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
    const line = out
      .split(/\r?\n/)
      .find((l) => l.includes('LISTENING') && new RegExp(`[:.]${port}\\s+`).test(l))
    if (!line) return null
    const pid = line.trim().split(/\s+/).pop()
    return /^\d+$/.test(pid) ? pid : null
  } catch {
    return null
  }
}

function printPortHint(port, label) {
  const pid = whoUses(port)
  console.log('')
  console.log(`  [X] 端口 ${port}（${label}）被占用，起不来。`)
  if (pid) console.log(`      占用它的进程号：${pid}`)
  console.log('      两种解决办法：')
  console.log('      A) 如果你之前已经开着一份，那就不用再开了，')
  console.log(`         直接打开 http://localhost:${PORT_WEB} 看页面就行。`)
  if (pid) {
    console.log('      B) 想关掉旧的再来，先执行这一条（关掉上面那个进程）：')
    console.log(`         taskkill /PID ${pid} /F`)
  } else {
    console.log('      B) 想关掉旧的再来，先在任务管理器里结束对应的 node 进程。')
  }
  console.log('')
}

const busy = []
for (const [port, label] of [
  [PORT_API, '后端'],
  [PORT_WEB, '前端'],
]) {
  if (!(await isPortFree(port))) busy.push([port, label])
}
if (busy.length) {
  busy.forEach(([port, label]) => printPortHint(port, label))
  process.exit(1)
}

console.log(`Photo Waterfall 启动中：后端 ${PORT_API} / 前端 ${PORT_WEB}`)
run('后端', join(ROOT, 'server', 'api-server.js'), [])
run('前端', VITE_BIN, ['--port', String(PORT_WEB)])

process.on('SIGINT', () => {
  children.forEach((c) => !c.killed && c.kill())
  process.exit(0)
})
