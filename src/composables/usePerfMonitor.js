import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export function usePerfMonitor() {
  const fps = ref(60)
  const minFps = ref(60)
  const longestFrame = ref(0)
  const domNodes = ref(0)
  const heapMB = ref(null)

  const measuring = ref(false)
  const benchNote = ref('')
  const benchOn = ref(null)
  const benchOff = ref(null)

  let rafId = 0
  let frames = 0
  let winStart = 0
  let lastTs = 0
  let maxGap = 0
  let samples = []

  function sampleStatic() {
    domNodes.value = document.getElementsByTagName('*').length
    if (performance.memory) {
      heapMB.value = Math.round(performance.memory.usedJSHeapSize / 1048576)
    }
  }

  function loop(ts) {
    if (lastTs) {
      const gap = ts - lastTs
      if (gap > maxGap) maxGap = gap
    }
    lastTs = ts
    frames++

    const elapsed = ts - winStart
    if (elapsed >= 500) {
      const cur = Math.round((frames * 1000) / elapsed)
      fps.value = cur
      if (cur < minFps.value) minFps.value = cur
      longestFrame.value = Math.round(maxGap)
      sampleStatic()
      if (measuring.value) samples.push(cur)

      frames = 0
      winStart = ts
      maxGap = 0
    }
    rafId = requestAnimationFrame(loop)
  }

  function resetPeaks() {
    minFps.value = fps.value || 60
    longestFrame.value = 0
  }

  function benchmark(mode) {
    if (measuring.value) return
    samples = []
    measuring.value = true
    minFps.value = 999
    longestFrame.value = 0
    benchNote.value = mode === 'on' ? '测量中：优化开启…' : '测量中：优化关闭…'

    window.scrollTo(0, 0)
    const start = performance.now()
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight - 20

    function step(ts) {
      window.scrollBy(0, 6)
      if (ts - start < 6000 && window.scrollY < maxScroll()) {
        requestAnimationFrame(step)
      } else {
        finish(mode)
      }
    }
    requestAnimationFrame(step)
  }

  function finish(mode) {
    const avg = samples.length
      ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      : 0
    const worst = samples.length ? Math.min(...samples) : 0
    const result = {
      avgFps: avg,
      minFps: worst,
      longestFrame: longestFrame.value,
      domNodes: domNodes.value,
      heapMB: heapMB.value,
      at: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    if (mode === 'on') benchOn.value = result
    else benchOff.value = result

    measuring.value = false
    benchNote.value = mode === 'on' ? '优化开启：测完了' : '优化关闭：测完了'
  }

  const compareText = computed(() => {
    const on = benchOn.value
    const off = benchOff.value
    if (!on || !off) return ''
    const gain = off.avgFps ? Math.round(((on.avgFps - off.avgFps) / off.avgFps) * 100) : 0
    return [
      `测量时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      `优化关闭：平均 ${off.avgFps} FPS / 最低 ${off.minFps} FPS / 最长帧 ${off.longestFrame}ms / DOM ${off.domNodes} 个节点 / 内存 ${off.heapMB ?? '-'} MB`,
      `优化开启：平均 ${on.avgFps} FPS / 最低 ${on.minFps} FPS / 最长帧 ${on.longestFrame}ms / DOM ${on.domNodes} 个节点 / 内存 ${on.heapMB ?? '-'} MB`,
      `提升：平均帧率 ${gain}%`,
    ].join('\n')
  })

  onMounted(() => {
    winStart = performance.now()
    rafId = requestAnimationFrame(loop)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(rafId)
  })

  return {
    fps,
    minFps,
    longestFrame,
    domNodes,
    heapMB,
    measuring,
    benchNote,
    benchOn,
    benchOff,
    compareText,
    benchmark,
    resetPeaks,
  }
}
