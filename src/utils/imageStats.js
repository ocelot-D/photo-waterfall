import { reactive } from 'vue'

export const imageStats = reactive({
  requested: 0,
  loaded: 0,
})

export function resetImageStats() {
  imageStats.requested = 0
  imageStats.loaded = 0
}
