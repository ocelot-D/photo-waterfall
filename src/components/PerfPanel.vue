<script setup>

import { ref } from 'vue'

const props = defineProps({
  fps: { type: Number, default: 60 },
  minFps: { type: Number, default: 60 },
  longestFrame: { type: Number, default: 0 },
  domNodes: { type: Number, default: 0 },
  heapMB: { type: Number, default: null },
  rendered: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  columns: { type: Number, default: 0 },
  imageRequested: { type: Number, default: 0 },
  cacheHits: { type: Number, default: 0 },
  lastCost: { type: Number, default: 0 },
  fromCache: { type: Boolean, default: false },
  optimize: { type: Boolean, default: true },
  measuring: { type: Boolean, default: false },
  benchNote: { type: String, default: '' },
  benchOn: { type: Object, default: null },
  benchOff: { type: Object, default: null },
  compareText: { type: String, default: '' },
})

const emit = defineEmits(['measure', 'reset-peaks'])

const collapsed = ref(false)
const copied = ref(false)

async function copyCompare() {
  if (!props.compareText) return
  try {
    await navigator.clipboard.writeText(props.compareText)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    copied.value = false
  }
}

function fpsColor(v) {
  if (v >= 50) return '#2f7a4d'
  if (v >= 30) return '#b45309'
  return '#c0392b'
}
</script>

<template>
  <div class="panel" :class="{ 'is-collapsed': collapsed }">
    <header class="panel-head">
      <span class="dot" :style="{ background: optimize ? '#2f7a4d' : '#c0392b' }"></span>
      <strong class="panel-title">性能面板</strong>
      <span class="panel-mode">{{ optimize ? '优化开启' : '优化关闭' }}</span>
      <button class="fold" @click="collapsed = !collapsed">
        {{ collapsed ? '展开' : '收起' }}
      </button>
    </header>

    <div v-show="!collapsed" class="panel-body">
      <div class="grid">
        <div class="cell">
          <span class="k">FPS</span>
          <span class="v" :style="{ color: fpsColor(fps) }">{{ fps }}</span>
        </div>
        <div class="cell">
          <span class="k">最低 FPS</span>
          <span class="v">{{ minFps > 900 ? '—' : minFps }}</span>
        </div>
        <div class="cell">
          <span class="k">最长帧</span>
          <span class="v">{{ longestFrame }}<i>ms</i></span>
        </div>
        <div class="cell">
          <span class="k">DOM 节点</span>
          <span class="v">{{ domNodes }}</span>
        </div>
        <div class="cell">
          <span class="k">内存</span>
          <span class="v">{{ heapMB === null ? '不支持' : heapMB + ' MB' }}</span>
        </div>
        <div class="cell">
          <span class="k">渲染卡片</span>
          <span class="v">{{ rendered }}<i>/{{ total }}</i></span>
        </div>
        <div class="cell">
          <span class="k">已取图</span>
          <span class="v">{{ imageRequested }}<i>张</i></span>
        </div>
        <div class="cell">
          <span class="k">列数</span>
          <span class="v">{{ columns }}</span>
        </div>
        <div class="cell">
          <span class="k">数据耗时</span>
          <span class="v">
            {{ fromCache ? '缓存 0' : lastCost }}<i>{{ fromCache ? '' : 'ms' }}</i>
          </span>
        </div>
        <div class="cell">
          <span class="k">缓存命中</span>
          <span class="v">{{ cacheHits }}<i>次</i></span>
        </div>
      </div>

      <div class="bench">
        <button class="btn primary" :disabled="measuring" @click="emit('measure')">
          {{ measuring ? '测量中…' : '测 6 秒（自动滚动）' }}
        </button>
        <button class="btn" @click="emit('reset-peaks')">重置峰值</button>
        <p v-if="benchNote" class="note">{{ benchNote }}</p>

        <div v-if="benchOff" class="row">
          <span>优化关闭</span>
          <b>{{ benchOff.avgFps }} FPS · 最低 {{ benchOff.minFps }} · DOM {{ benchOff.domNodes }}</b>
        </div>
        <div v-if="benchOn" class="row">
          <span>优化开启</span>
          <b>{{ benchOn.avgFps }} FPS · 最低 {{ benchOn.minFps }} · DOM {{ benchOn.domNodes }}</b>
        </div>

        <button v-if="compareText" class="btn ghost" @click="copyCompare">
          {{ copied ? '已复制到剪贴板' : '复制对比结果' }}
        </button>
        <p class="tip">两种模式各测一次，数字才是可复现的</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 60;
  width: 268px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(24, 22, 18, 0.14);
  backdrop-filter: blur(6px);
  font-size: 12px;
  overflow: hidden;
}

.panel.is-collapsed {
  width: 200px;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}

.panel.is-collapsed .panel-head {
  border-bottom: none;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.panel-title {
  font-size: 12.5px;
}

.panel-mode {
  color: var(--ink3);
  font-size: 11px;
}

.fold {
  margin-left: auto;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--ink2);
}

.panel-body {
  padding: 8px 10px 10px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
}

.cell {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px dashed #eee;
}

.k {
  color: var(--ink3);
}

.v {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--ink);
}

.v i {
  font-style: normal;
  font-weight: 400;
  font-size: 10.5px;
  color: var(--ink3);
  margin-left: 2px;
}

.bench {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.btn {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink2);
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 11.5px;
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  margin-right: 6px;
}

.btn.ghost {
  width: 100%;
  margin-top: 6px;
  color: var(--accent);
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.note {
  margin: 6px 0 0;
  color: var(--accent);
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-top: 5px;
  color: var(--ink2);
}

.row b {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.tip {
  margin: 6px 0 0;
  color: var(--ink3);
  font-size: 11px;
}
</style>
