<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  photo: { type: Object, required: true },
  index: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'prev', 'next'])

const closeBtn = ref(null)
let lastFocused = null
let prevOverflow = ''
let prevPadding = ''

const THUMB_W = 400
const BIG_W = 1000

function buildUrl(w) {
  const base = props.photo.img
  if (!base) return ''
  const h = Math.round(w * (props.photo.ratio || 0.75))
  return `${base}?w=${w}&h=${h}&fit=crop`
}

const thumbSrc = computed(() => buildUrl(THUMB_W))
const bigSrc = computed(() => buildUrl(BIG_W))

const loaded = ref(false)
const failed = ref(false)
const tick = ref(0)

function reset() {
  loaded.value = false
  failed.value = false
  tick.value = 0
}

watch(() => props.photo, reset)

function retry() {
  tick.value++
  loaded.value = false
  failed.value = false
}

const picStyle = computed(() => ({
  aspectRatio: `1 / ${props.photo.ratio || 0.75}`,
}))

function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft') emit('prev')
  else if (e.key === 'ArrowRight') emit('next')
}

onMounted(() => {
  lastFocused = document.activeElement

  const sbw = window.innerWidth - document.documentElement.clientWidth
  prevOverflow = document.body.style.overflow
  prevPadding = document.body.style.paddingRight
  document.body.style.overflow = 'hidden'
  if (sbw > 0) document.body.style.paddingRight = sbw + 'px'

  window.addEventListener('keydown', onKey)
  if (closeBtn.value) closeBtn.value.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = prevOverflow
  document.body.style.paddingRight = prevPadding
  if (lastFocused && lastFocused.focus) lastFocused.focus()
})
</script>

<template>
  <div
    class="mask"
    role="dialog"
    aria-modal="true"
    :aria-label="`${photo.title} 大图`"
    @click.self="emit('close')"
  >
    <button ref="closeBtn" class="close" aria-label="关闭大图" @click="emit('close')">✕</button>

    <button class="nav prev" aria-label="上一张" @click="emit('prev')">‹</button>
    <button class="nav next" aria-label="下一张" @click="emit('next')">›</button>

    <figure class="box">
      <div class="pic" :style="picStyle">
        <img v-if="thumbSrc" class="thumb" :class="{ 'is-dim': loaded }" :src="thumbSrc" alt="" aria-hidden="true" />

        <img
          v-if="bigSrc && !failed"
          class="full"
          :class="{ 'is-loaded': loaded }"
          :src="tick ? bigSrc + '&r=' + tick : bigSrc"
          :alt="photo.title"
          decoding="async"
          fetchpriority="high"
          @load="loaded = true"
          @error="failed = true"
        />

        <div v-if="!loaded && !failed" class="hint">
          <span class="spin" aria-hidden="true"></span>
          <span>正在加载大图…</span>
        </div>

        <div v-if="failed" class="err" role="button" tabindex="0" @click="retry" @keydown.enter.prevent="retry">
          <span>大图加载失败</span>
          <small>点击重试</small>
        </div>
      </div>

      <figcaption class="cap">
        <h3>{{ photo.title }}</h3>
        <p>
          <span class="tag">{{ photo.tag }}</span>
          <span>{{ photo.author }}</span>
          <span class="likes">♥ {{ photo.likes }}</span>
          <span class="idx">{{ index + 1 }} / {{ total }}</span>
        </p>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(18, 17, 15, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  animation: fade 0.16s ease;
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

.box {
  margin: 0;
  width: min(880px, 92vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}

.pic {
  position: relative;
  width: 100%;
  max-height: 68vh;
  background: #201e1a;
  overflow: hidden;
}

.pic img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.thumb {
  object-fit: cover;
  filter: blur(16px);
  transform: scale(1.08);
  transition: opacity 0.3s ease;
}

.thumb.is-dim {
  opacity: 0;
}

.full {
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.full.is-loaded {
  opacity: 1;
}

.hint,
.err {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12.5px;
  color: #ded9cf;
}

.hint {
  background: rgba(24, 22, 19, 0.45);
}

.spin {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(160, 155, 145, 0.35);
  border-top-color: #8a8579;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.err {
  background: #2a2722;
  color: #ded9cf;
  cursor: pointer;
}

.err small {
  font-size: 10.5px;
  color: #9d988d;
}

.cap {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--line);
}

.cap h3 {
  font-size: 15px;
  margin-bottom: 6px;
}

.cap p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
  color: var(--ink2);
}

.tag {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 20px;
  padding: 2px 8px;
}

.likes {
  color: var(--accent);
}

.idx {
  margin-left: auto;
  color: var(--ink3);
}

.close,
.nav {
  position: absolute;
  border: none;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-radius: 50%;
  width: 42px;
  height: 42px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close {
  top: 18px;
  right: 20px;
}

.nav {
  top: 50%;
  transform: translateY(-50%);
  width: 46px;
  height: 46px;
  font-size: 26px;
}

.prev {
  left: 18px;
}

.next {
  right: 18px;
}

.close:hover,
.nav:hover {
  background: rgba(255, 255, 255, 0.26);
}
</style>
