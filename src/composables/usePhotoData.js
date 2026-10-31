import { ref, watch, onBeforeUnmount } from 'vue'
import { httpGet } from '../utils/request.js'
import { debounce } from '../utils/debounce.js'
import { resetImageStats } from '../utils/imageStats.js'

export function usePhotoData() {
  const list = ref([])
  const tags = ref([])
  const total = ref(0)

  let imageMap = {}

  const loading = ref(false)
  const error = ref('')

  const hasMore = ref(true)
  const loadingMore = ref(false)
  const moreCount = ref(0)

  const keyword = ref('')
  const activeTag = ref('')

  const cacheHits = ref(0)
  const lastCost = ref(0)
  const fromCache = ref(false)

  const PAGE_SIZE = 500

  const cache = new Map()
  let seq = 0

  let lastMoreFail = 0

  function decorate(rawList) {
    return rawList.map((it) => ({
      ...it,
      ratio: it.ratio || 0.75,
      img: imageMap[it.pid] || '',
    }))
  }

  async function loadMeta() {
    const data = await httpGet('/meta', { key: 'meta' })
    tags.value = data.tags
    total.value = data.total
    imageMap = data.images || {}
  }

  async function load({ force = false } = {}) {
    const key = activeTag.value + '|' + keyword.value.trim()

    if (!force && cache.has(key)) {
      const hit = cache.get(key)
      cacheHits.value++
      list.value = hit.items
      hasMore.value = hit.hasMore
      fromCache.value = true
      lastCost.value = 0
      error.value = ''
      resetImageStats()
      return
    }

    const my = ++seq
    loading.value = true
    error.value = ''
    const start = performance.now()

    try {
      const data = await httpGet('/photos', {
        params: { keyword: keyword.value.trim(), tag: activeTag.value },
      })
      if (my !== seq) return

      const decorated = decorate(data.list)
      hasMore.value = data.hasMore !== false
      cache.set(key, { items: decorated, hasMore: hasMore.value })
      list.value = decorated
      total.value = data.total
      fromCache.value = false
      lastCost.value = Math.round(performance.now() - start)
      resetImageStats()
    } catch (e) {
      if (my !== seq) return
      error.value = e.message
    } finally {
      if (my === seq) loading.value = false
    }
  }

  async function loadMore() {
    if (loadingMore.value || !hasMore.value || loading.value || error.value) return
    if (Date.now() - lastMoreFail < 2000) return

    const cursor = list.value.length
    if (!cursor) return

    const keyAtRequest = activeTag.value + '|' + keyword.value.trim()

    loadingMore.value = true
    try {
      const data = await httpGet('/more', {
        params: {
          cursor,
          count: PAGE_SIZE,
          tag: activeTag.value,
          keyword: keyword.value.trim(),
        },
      })
      if (keyAtRequest !== activeTag.value + '|' + keyword.value.trim()) return

      hasMore.value = data.hasMore !== false
      if (data.list.length) {
        list.value = list.value.concat(decorate(data.list))
        moreCount.value++
        cache.set(keyAtRequest, { items: list.value, hasMore: hasMore.value })
      }
    } catch (e) {
      lastMoreFail = Date.now()
      console.warn('[续接失败]', e.message)
    } finally {
      loadingMore.value = false
    }
  }

  const debouncedLoad = debounce(() => load(), 300)

  watch(keyword, () => debouncedLoad())
  watch(activeTag, () => load())

  onBeforeUnmount(() => debouncedLoad.cancel())

  function toggleTag(tag) {
    activeTag.value = activeTag.value === tag ? '' : tag
  }

  function clearFilter() {
    keyword.value = ''
    activeTag.value = ''
  }

  async function init() {
    try {
      await loadMeta()
    } catch (e) {
      error.value = e.message
      loading.value = false
      return
    }
    await load()
  }

  return {
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
  }
}
