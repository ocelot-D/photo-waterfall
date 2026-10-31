<script setup>

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { imageStats } from '../utils/imageStats.js'

const props = defineProps({
  src: { type: String, required: true },
  lqip: { type: String, default: '' },
  alt: { type: String, default: '' },
  eager: { type: Boolean, default: false },
})

const rootEl = ref(null)
const inView = ref(false)
const loaded = ref(false)
const failed = ref(false)
const retryTick = ref(0)

let observer = null
const callbacks = new WeakMap()

function getObserver() {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue
        const cb = callbacks.get(en.target)
        if (cb) cb()
        observer.unobserve(en.target)
      }
    },
    {
      rootMargin: '300px 0px',
      threshold: 0,
    }
  )
  return observer
}

function enterView() {
  if (inView.value) return
  inView.value = true
  imageStats.requested++
}

function onLoad() {
  loaded.value = true
}

function onError() {
  failed.value = true
}

function retry() {
  retryTick.value++
  failed.value = false
  loaded.value = false
}

onMounted(() => {
  if (props.eager) {
    enterView()
    return
  }
  if (!rootEl.value) return
  callbacks.set(rootEl.value, enterView)
  getObserver().observe(rootEl.value)
})

onBeforeUnmount(() => {
  if (rootEl.value && observer) observer.unobserve(rootEl.value)
})
</script>

<template>
  <div ref="rootEl" class="lazy">
    <img v-if="inView && lqip" class="lqip" :src="lqip" alt="" aria-hidden="true" />

    <img
      v-if="inView"
      class="full"
      :class="{ 'is-loaded': loaded }"
      :src="retryTick ? src + '&r=' + retryTick : src"
      :alt="alt"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />

    <div
      v-if="failed"
      class="failed"
      role="button"
      tabindex="0"
      @click="retry"
      @keydown.enter.prevent="retry"
    >
      <span>图片加载失败</span>
      <small>点击重试</small>
    </div>
  </div>
</template>

<style scoped>
.lazy {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(135deg, #eceae5 0%, #dedbd4 50%, #e8e6e1 100%);
}

.lqip,
.full {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lqip {
  z-index: 0;
  filter: blur(6px);
  transform: scale(1.06);
}

.full {
  z-index: 1;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.full.is-loaded {
  opacity: 1;
}

.failed {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--ink3);
  background: #f0eee9;
  font-size: 12px;
}

.failed small {
  font-size: 10.5px;
  color: #a8a59e;
}
</style>
