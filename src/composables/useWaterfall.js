import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const BREAKPOINTS = [
  { min: 1560, cols: 6 },
  { min: 1200, cols: 5 },
  { min: 900, cols: 4 },
  { min: 600, cols: 3 },
  { min: 0, cols: 2 },
]

export function useWaterfall(options) {
  const {
    items,
    containerWidth,
    canvasEl,
    optimize,
    gap = 14,
    metaHeight = 62,
    overscan = 400,
  } = options

  const visible = shallowRef([])
  const canvasHeight = ref(0)
  const columnCount = ref(4)
  const columnWidth = ref(0)

  let layout = { cols: 0, positions: [], columns: [], height: 0, colW: 0 }
  let colHeights = []
  let laidOut = 0
  let prevFirst = null
  let canvasTop = 0
  let ticking = false

  const renderedCount = computed(() => visible.value.length)

  function pickCols(width) {
    for (const bp of BREAKPOINTS) if (width >= bp.min) return bp.cols
    return 2
  }

  function place(i, list) {
    const cols = layout.cols
    let c = 0
    for (let j = 1; j < cols; j++) {
      if (colHeights[j] < colHeights[c]) c = j
    }
    const ratio = list[i].ratio || 0.75
    const imgH = Math.round(layout.colW * ratio)
    const h = imgH + metaHeight

    layout.positions[i] = {
      i,
      x: c * (layout.colW + gap),
      y: colHeights[c],
      w: layout.colW,
      h,
      imgH,
    }
    layout.columns[c].push(i)
    colHeights[c] += h + gap
  }

  function resetLayout() {
    layout = { cols: 0, positions: [], columns: [], height: 0, colW: 0 }
    colHeights = []
    laidOut = 0
    prevFirst = null
    canvasHeight.value = 0
    visible.value = []
  }

  function computeLayout() {
    const list = items.value
    const width = containerWidth.value

    if (!width || !list || list.length === 0) {
      resetLayout()
      return
    }

    const cols = pickCols(width)
    const colW = Math.floor((width - gap * (cols - 1)) / cols)

    colHeights = new Array(cols).fill(0)
    layout = {
      cols,
      colW,
      positions: new Array(list.length),
      columns: Array.from({ length: cols }, () => []),
      height: 0,
    }

    for (let i = 0; i < list.length; i++) place(i, list)

    laidOut = list.length
    prevFirst = list[0]
    layout.height = Math.max(...colHeights) - gap
    canvasHeight.value = layout.height
    columnCount.value = cols
    columnWidth.value = colW
  }

  function appendLayout() {
    const list = items.value
    for (let i = laidOut; i < list.length; i++) place(i, list)

    laidOut = list.length
    layout.height = Math.max(...colHeights) - gap
    canvasHeight.value = layout.height
  }

  function shouldAppend() {
    const list = items.value
    if (!layout.positions.length) return false
    if (!containerWidth.value) return false
    if (list.length <= laidOut) return false
    if (layout.positions.length !== laidOut) return false
    if (list[0] !== prevFirst) return false
    return true
  }

  function measureTop() {
    if (!canvasEl.value) return
    const rect = canvasEl.value.getBoundingClientRect()
    canvasTop = rect.top + window.scrollY
  }

  function lowerBound(arr, top) {
    let lo = 0
    let hi = arr.length - 1
    let ans = arr.length
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const p = layout.positions[arr[mid]]
      if (p.y + p.h >= top) {
        ans = mid
        hi = mid - 1
      } else {
        lo = mid + 1
      }
    }
    return ans
  }

  function updateVisible() {
    if (!layout.positions.length) {
      if (visible.value.length) visible.value = []
      return
    }

    if (!optimize.value) {
      if (visible.value.length !== layout.positions.length) {
        visible.value = layout.positions.slice()
      }
      return
    }

    const vh = window.innerHeight
    const top = window.scrollY - canvasTop - overscan
    const bottom = window.scrollY - canvasTop + vh + overscan

    const out = []
    for (let c = 0; c < layout.columns.length; c++) {
      const arr = layout.columns[c]
      let k = lowerBound(arr, top)
      for (; k < arr.length; k++) {
        const p = layout.positions[arr[k]]
        if (p.y > bottom) break
        out.push(p)
      }
    }
    visible.value = out
  }

  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      updateVisible()
    })
  }

  function onResize() {
    measureTop()
    computeLayout()
    updateVisible()
  }

  watch([items, containerWidth], () => {
    if (shouldAppend()) appendLayout()
    else computeLayout()
    requestAnimationFrame(() => {
      measureTop()
      updateVisible()
    })
  })

  watch(optimize, () => {
    requestAnimationFrame(() => {
      measureTop()
      updateVisible()
    })
  })

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
  })

  function refresh() {
    computeLayout()
    measureTop()
    updateVisible()
  }

  return {
    visible,
    canvasHeight,
    columnCount,
    columnWidth,
    renderedCount,
    refresh,
  }
}
