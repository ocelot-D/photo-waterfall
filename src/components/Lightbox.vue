<script setup>

import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

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

const imgSrc = computed(() => {
  const base = props.photo.img
  if (!base) return ''
  const h = Math.round(1200 * props.photo.ratio)
  return `${base}?w=1200&h=${h}&fit=crop`
})

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
      <div class="pic">
        <img :src="imgSrc" :alt="photo.title" />
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
  max-width: min(880px, 92vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}

.pic {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  max-height: 68vh;
  overflow: hidden;
}

.pic img {
  max-width: 100%;
  max-height: 68vh;
  display: block;
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
