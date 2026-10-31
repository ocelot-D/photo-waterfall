<script setup>

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { usePhotoFeed } from './composables/usePhotoFeed.js'
import { useWaterfall } from './composables/useWaterfall.js'
import { usePerfMonitor } from './composables/usePerfMonitor.js'
import { imageStats } from './utils/imageStats.js'
import PhotoCard from './components/PhotoCard.vue'
import PerfPanel from './components/PerfPanel.vue'
import Lightbox from './components/Lightbox.vue'

const {
  list,
  tags,
  total,
  loading,
  error,
  hasMore,
  loadingMore,
  moreCount,
  keyword,
  activeTag,
  cacheHits,
  lastCost,
  fromCache,
  init,
  load,
  loadMore,
  toggleTag,
  clearFilter,
} = usePhotoFeed()

const {
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
} = usePerfMonitor()

const optParam = new URLSearchParams(location.search).get('opt')
const optimize = ref(optParam !== '0' && optParam !== 'off')
const wrapEl = ref(null)
const canvasEl = ref(null)
const containerWidth = ref(0)

const { visible, canvasHeight, columnCount, renderedCount } = useWaterfall({
  items: list,
  containerWidth,
  canvasEl,
  optimize,
})

const lightboxIndex = ref(-1)
const currentPhoto = computed(() =>
  lightboxIndex.value >= 0 ? list.value[lightboxIndex.value] : null
)

function openLightbox(photo) {
  const idx = list.value.indexOf(photo)
  if (idx >= 0) lightboxIndex.value = idx
}

function stepLightbox(d) {
  const n = list.value.length
  if (!n || lightboxIndex.value < 0) return
  lightboxIndex.value = (lightboxIndex.value + d + n) % n
}

function setTag(tag) {
  activeTag.value = tag
}

function onMeasure() {
  benchmark(optimize.value ? 'on' : 'off')
}

function retry() {
  load({ force: true })
}

const PREFETCH_PX = 1200
let scrollTicking = false

function onWindowScroll() {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    scrollTicking = false
    if (measuring.value) return
    if (loading.value || loadingMore.value || !hasMore.value) return
    const doc = document.documentElement
    const rest = doc.scrollHeight - (window.scrollY + window.innerHeight)
    if (rest < PREFETCH_PX) loadMore()
  })
}

let ro = null

onMounted(async () => {
  if (wrapEl.value) {
    ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width)
      if (w > 0) containerWidth.value = w
    })
    ro.observe(wrapEl.value)
  }
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  await init()
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('scroll', onWindowScroll)
})
</script>

<template>
  <header class="top">
    <div class="top-row">
      <div class="brand">
        <span class="logo">PhotoFeed</span>
        <span class="sub">图片瀑布流社区 · 性能优化演示 · 照片来自 Pexels 免费图库</span>
      </div>

      <div class="search">
        <input
          v-model="keyword"
          type="search"
          placeholder="搜标题或作者（防抖 300ms）"
          aria-label="搜索图片"
        />
      </div>

      <label class="switch" :class="{ off: !optimize }">
        <input v-model="optimize" type="checkbox" />
        <span class="track"><span class="knob"></span></span>
        <span class="switch-text">
          性能优化
          <b>{{ optimize ? '已开启' : '已关闭' }}</b>
        </span>
      </label>
    </div>

    <div class="chips">
      <button class="chip" :class="{ on: activeTag === '' }" @click="setTag('')">全部</button>
      <button
        v-for="t in tags"
        :key="t"
        class="chip"
        :class="{ on: activeTag === t }"
        @click="toggleTag(t)"
      >
        {{ t }}
      </button>

      <span class="stat">
        <template v-if="keyword.trim()">搜索到 {{ list.length }} 张</template>
        <template v-else>已加载 {{ list.length }} 张</template>
        · 渲染 <b>{{ renderedCount }}</b> 张 · {{ columnCount }} 列
        <em v-if="loading">搜索中…</em>
        <em v-else-if="loadingMore">正在加载下一批…</em>
      </span>
    </div>
  </header>

  <div v-if="!optimize && list.length" class="warnbar">
    当前是「朴素渲染」：{{ list.length }} 张卡片一次性全渲染，没有虚拟滚动、没有懒加载，这就是优化前的状态。
    5000 张时实测 DOM 节点约 5.5 万个、首屏图片请求近万条、JS 堆约 105 MB；
    切到「已开启」后分别降到约 380 个 / 125 条 / 6 MB —— 帧率两边都是 60fps，差别在内存和布局耗时（7.1s → 0.09s）。
  </div>

  <main class="page">
    <div ref="wrapEl" class="wrap">
      <div v-if="loading && !list.length" class="state">
        <div class="sk-list">
          <div v-for="n in 10" :key="n" class="sk"></div>
        </div>
        <p class="state-text">正在加载 {{ total }} 条数据…</p>
      </div>

      <div v-else-if="error" class="state">
        <p class="state-title">数据没取到</p>
        <p class="state-text">{{ error }}</p>
        <button class="btn primary" @click="retry">重试</button>
      </div>

      <div v-else-if="!list.length" class="state">
        <p class="state-title">没有符合条件的图片</p>
        <p class="state-text">换个关键词，或者点「全部」看所有图片</p>
        <button class="btn" @click="clearFilter">清除筛选</button>
      </div>

      <div v-else ref="canvasEl" class="canvas" :style="{ height: canvasHeight + 'px' }">
        <PhotoCard
          v-for="p in visible"
          :key="p.i"
          :pos="p"
          :photo="list[p.i]"
          :eager="!optimize"
          @open="openLightbox"
        />
      </div>
    </div>

    <div v-if="list.length" class="feed-foot">
      <span v-if="loadingMore">正在加载下一批…</span>
      <span v-else-if="!hasMore">已经到底了 · 共 {{ list.length }} 张</span>
      <span v-else>继续下滑，自动加载更多</span>
    </div>
  </main>

  <PerfPanel
    :fps="fps"
    :min-fps="minFps"
    :longest-frame="longestFrame"
    :dom-nodes="domNodes"
    :heap-m-b="heapMB"
    :rendered="renderedCount"
    :total="list.length"
    :columns="columnCount"
    :image-requested="imageStats.requested"
    :cache-hits="cacheHits"
    :last-cost="lastCost"
    :from-cache="fromCache"
    :optimize="optimize"
    :measuring="measuring"
    :bench-note="benchNote"
    :bench-on="benchOn"
    :bench-off="benchOff"
    :compare-text="compareText"
    @measure="onMeasure"
    @reset-peaks="resetPeaks"
  />

  <Lightbox
    v-if="currentPhoto"
    :photo="currentPhoto"
    :index="lightboxIndex"
    :total="list.length"
    @close="lightboxIndex = -1"
    @prev="stepLightbox(-1)"
    @next="stepLightbox(1)"
  />
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(245, 245, 247, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.top-row {
  max-width: 1720px;
  margin: 0 auto;
  padding: 12px 20px 8px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.logo {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--accent);
}

.sub {
  font-size: 12px;
  color: var(--ink3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search {
  flex: 1;
  max-width: 420px;
  margin-left: auto;
}

.search input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13.5px;
  color: var(--ink);
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.search input:focus {
  outline: none;
  border-color: var(--accent);
}

.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  width: 40px;
  height: 22px;
  border-radius: 20px;
  background: var(--accent);
  position: relative;
  transition: background 0.18s;
}

.switch.off .track {
  background: #c0392b;
}

.knob {
  position: absolute;
  top: 3px;
  left: 21px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.18s;
}

.switch.off .knob {
  left: 3px;
}

.switch-text {
  font-size: 12.5px;
  color: var(--ink2);
}

.switch-text b {
  color: var(--ink);
}

.chips {
  max-width: 1720px;
  margin: 0 auto;
  padding: 0 20px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink2);
  border-radius: 20px;
  padding: 3px 11px;
  font-size: 12.5px;
}

.chip.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.stat {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink3);
  font-variant-numeric: tabular-nums;
}

.stat b {
  color: var(--accent);
}

.stat em {
  font-style: normal;
  color: var(--accent);
  margin-left: 6px;
}

.warnbar {
  max-width: 1720px;
  margin: 10px auto 0;
  padding: 8px 14px;
  font-size: 12.5px;
  color: #8a2c0b;
  background: #fdece5;
  border: 1px solid #f6cfc1;
  border-radius: 8px;
}

.page {
  max-width: 1720px;
  margin: 0 auto;
  padding: 16px 20px 80px;
}

.wrap {
  width: 100%;
}

.canvas {
  position: relative;
  width: 100%;
}

.feed-foot {
  padding: 30px 0 10px;
  text-align: center;
  font-size: 12.5px;
  color: var(--ink3);
  letter-spacing: 0.02em;
}

.state {
  padding: 60px 0;
  text-align: center;
}

.state-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px;
}

.state-text {
  font-size: 13px;
  color: var(--ink2);
  margin: 0 0 14px;
}

.sk-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.sk {
  height: 220px;
  border-radius: var(--radius);
  background: linear-gradient(100deg, #eceae5 30%, #f6f5f2 50%, #eceae5 70%);
  background-size: 300% 100%;
  animation: sk 1.1s infinite linear;
}

@keyframes sk {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

.btn {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink2);
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

@media (max-width: 720px) {
  .top-row {
    flex-wrap: wrap;
    gap: 10px;
  }
  .search {
    order: 3;
    max-width: none;
    flex-basis: 100%;
  }
  .sub {
    display: none;
  }
}
</style>
