import WebApp from '@twa-dev/sdk'

/**
 * API base URL.
 * - Set VITE_API_URL at build time when needed (e.g. http://localhost:8001).
 * - In production builds, if unset, use same origin + /api (host nginx must proxy /api/ -> FastAPI).
 */
function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).trim().replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8000'
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`
  }
  return 'http://localhost:8000'
}

export const API_BASE_URL = getApiBaseUrl()
const BASE_URL = API_BASE_URL

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const fetchNovels = () => request('/novels/')

export const fetchNovel = (id) => request(`/novels/${id}`)

export const verifyAccess = (initData) =>
  request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  })

/** ADMIN_SECRET and/or Telegram Mini App initData (for users in ADMIN_TELEGRAM_ID). */
export function adminFetchHeaders(secret = '') {
  const h = {}
  if (secret && String(secret).trim()) {
    h['X-Admin-Secret'] = String(secret).trim()
  }
  const init = WebApp?.initData
  if (init) {
    h['X-Telegram-Init-Data'] = init
  }
  return h
}

async function adminErrorMessage(res) {
  const j = await res.json().catch(() => ({}))
  const d = j.detail
  if (Array.isArray(d)) {
    return d.map((x) => x.msg || JSON.stringify(x)).join('; ')
  }
  if (typeof d === 'string') return d
  return res.statusText || 'Request failed'
}

/** Full novel list for admin (includes drafts). */
export const fetchAdminNovels = async (secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/catalog`, {
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}

export const adminCreateNovel = async (formData, secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels`, {
    method: 'POST',
    body: formData,
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}

export const adminUpdateNovel = async (id, formData, secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels/${id}`, {
    method: 'PUT',
    body: formData,
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}

export const adminDeleteNovel = async (id, secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels/${id}`, {
    method: 'DELETE',
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}

export const adminAddChapter = async (novelId, formData, secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels/${novelId}/chapters`, {
    method: 'POST',
    body: formData,
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}

export const adminUpdateChapter = async (chapterId, formData, secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/chapters/${chapterId}`, {
    method: 'PUT',
    body: formData,
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}

export const adminDeleteChapter = async (chapterId, secret = '') => {
  const res = await fetch(`${BASE_URL}/novels/admin/chapters/${chapterId}`, {
    method: 'DELETE',
    headers: adminFetchHeaders(secret),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res))
  return res.json()
}
