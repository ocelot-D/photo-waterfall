const pending = new Map()

export async function httpGet(path, { params = {}, timeout = 15000, key = '' } = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) qs.append(k, String(v))
  })
  const query = qs.toString()
  const url = '/api' + path + (query ? '?' + query : '')

  const cancelKey = key || url
  if (pending.has(cancelKey)) pending.get(cancelKey).abort()

  const ctrl = new AbortController()
  pending.set(cancelKey, ctrl)

  const timer = setTimeout(() => ctrl.abort(), timeout)

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('接口返回状态码 ' + res.status)
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.msg || '接口返回未知错误')
    return json.data
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('请求超时或已取消，请重试')
    throw new Error('网络异常：' + e.message)
  } finally {
    clearTimeout(timer)
    if (pending.get(cancelKey) === ctrl) pending.delete(cancelKey)
  }
}
