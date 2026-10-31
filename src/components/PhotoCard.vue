<script setup>

import { computed } from 'vue'
import LazyImg from './LazyImg.vue'

const props = defineProps({
  pos: { type: Object, required: true },
  photo: { type: Object, required: true },
  eager: { type: Boolean, default: false },
})

const emit = defineEmits(['open'])

const imgUrl = (base, w, h, extra = '') => (base ? `${base}?w=${w}&h=${h}&fit=crop${extra}` : '')

const IMG_W = 400
const imgH = computed(() => Math.round(IMG_W * props.photo.ratio))

const imgSrc = computed(() => imgUrl(props.photo.img, IMG_W, imgH.value))

const lqipSrc = computed(() => imgUrl(props.photo.img, 24, 32, '&blur=200'))

const BIG_W = 1000
const bigCache = new Set()

function prefetchBig() {
  const base = props.photo.img
  if (!base || bigCache.has(base)) return
  bigCache.add(base)
  const img = new Image()
  img.src = `${base}?w=${BIG_W}&h=${Math.round(BIG_W * (props.photo.ratio || 0.75))}&fit=crop`
}

const cardStyle = computed(() => ({
  width: props.pos.w + 'px',
  height: props.pos.h + 'px',
  transform: `translate3d(${props.pos.x}px, ${props.pos.y}px, 0)`,
}))

const likesText = computed(() => {
  const n = props.photo.likes
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
})
</script>

<template>
  <article
    class="card"
    :style="cardStyle"
    role="button"
    tabindex="0"
    :aria-label="`查看 ${photo.title}，作者 ${photo.author}`"
    @click="emit('open', photo)"
    @mouseenter="prefetchBig"
    @focus="prefetchBig"
    @keydown.enter.prevent="emit('open', photo)"
    @keydown.space.prevent="emit('open', photo)"
  >
    <div class="card-img" :style="{ height: pos.imgH + 'px' }">
      <LazyImg :src="imgSrc" :lqip="lqipSrc" :alt="photo.title" :eager="eager" />
      <span class="card-tag">{{ photo.tag }}</span>
    </div>

    <div class="card-meta">
      <h3 class="card-title">{{ photo.title }}</h3>
      <div class="card-sub">
        <span class="card-author">{{ photo.author }}</span>
        <span class="card-likes">♥ {{ likesText }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: absolute;
  top: 0;
  left: 0;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: box-shadow 0.18s ease;
  will-change: transform;
  contain: layout paint;
}

.card:hover {
  box-shadow: 0 2px 4px rgba(24, 22, 18, 0.08), 0 10px 24px rgba(24, 22, 18, 0.1);
}

.card-img {
  position: relative;
  width: 100%;
  background: #eceae5;
}

.card-tag {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 8px;
  font-size: 11px;
  color: #fff;
  background: rgba(20, 18, 16, 0.55);
  border-radius: 20px;
  backdrop-filter: blur(2px);
}

.card-meta {
  height: 62px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-title {
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-sub {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--ink3);
}

.card-likes {
  color: var(--accent);
}
</style>
