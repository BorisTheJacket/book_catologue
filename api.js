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

const BASE_URL = getApiBaseUrl()

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

// ── Public ────────────────────────────────────────────────────────────────────

export const fetchNovels = () => request('/novels/')

export const fetchNovel = (id) => request(`/novels/${id}`)

export const verifyAccess = (initData) =>
  request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  })

// ── Admin ─────────────────────────────────────────────────────────────────────

function adminHeaders(secret) {
  return { 'X-Admin-Secret': secret }
}

export const adminCreateNovel = async (formData) => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels`, {
    method: 'POST',
    body: formData, // FormData — no Content-Type header, let browser set boundary
  })
  if (!res.ok) throw new Error((await res.json()).detail)
  return res.json()
}

export const adminUpdateNovel = async (id, formData) => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels/${id}`, {
    method: 'PUT',
    body: formData,
  })
  if (!res.ok) throw new Error((await res.json()).detail)
  return res.json()
}

export const adminDeleteNovel = (id, secret) =>
  request(`/novels/admin/novels/${id}?x_admin_secret=${secret}`, {
    method: 'DELETE',
  })

export const adminAddChapter = async (novelId, formData) => {
  const res = await fetch(`${BASE_URL}/novels/admin/novels/${novelId}/chapters`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error((await res.json()).detail)
  return res.json()
}

export const adminUpdateChapter = async (chapterId, formData) => {
  const res = await fetch(`${BASE_URL}/novels/admin/chapters/${chapterId}`, {
    method: 'PUT',
    body: formData,
  })
  if (!res.ok) throw new Error((await res.json()).detail)
  return res.json()
}

export const adminDeleteChapter = (chapterId, secret) =>
  request(`/novels/admin/chapters/${chapterId}?x_admin_secret=${secret}`, {
    method: 'DELETE',
  })
