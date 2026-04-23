import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fetchNovels,
  adminCreateNovel,
  adminUpdateNovel,
  adminDeleteNovel,
  adminAddChapter,
  adminUpdateChapter,
  adminDeleteChapter,
} from '../api'

export default function Admin() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [novels, setNovels] = useState([])
  const [selectedNovel, setSelectedNovel] = useState(null)
  const [view, setView] = useState('list') // list | edit | chapters | add

  const login = () => {
    if (secret.trim()) setAuthed(true)
  }

  useEffect(() => {
    if (authed) loadNovels()
  }, [authed])

  async function loadNovels() {
    const data = await fetchNovels()
    setNovels(data)
  }

  if (!authed) return <LoginScreen secret={secret} setSecret={setSecret} onLogin={login} />

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Admin Panel</h1>
        <button style={styles.addBtn} onClick={() => setView('add')}>+ New Novel</button>
      </header>

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div key="list" {...fadeAnim}>
            <NovelList
              novels={novels}
              secret={secret}
              onEdit={(n) => { setSelectedNovel(n); setView('edit') }}
              onChapters={(n) => { setSelectedNovel(n); setView('chapters') }}
              onDelete={async (id) => {
                if (!confirm('Delete this novel?')) return
                await adminDeleteNovel(id, secret)
                loadNovels()
              }}
            />
          </motion.div>
        )}

        {view === 'add' && (
          <motion.div key="add" {...fadeAnim}>
            <NovelForm
              secret={secret}
              onSave={async (fd) => { await adminCreateNovel(fd); loadNovels(); setView('list') }}
              onCancel={() => setView('list')}
            />
          </motion.div>
        )}

        {view === 'edit' && selectedNovel && (
          <motion.div key="edit" {...fadeAnim}>
            <NovelForm
              novel={selectedNovel}
              secret={secret}
              onSave={async (fd) => { await adminUpdateNovel(selectedNovel.id, fd); loadNovels(); setView('list') }}
              onCancel={() => setView('list')}
            />
          </motion.div>
        )}

        {view === 'chapters' && selectedNovel && (
          <motion.div key="chapters" {...fadeAnim}>
            <ChapterManager
              novel={selectedNovel}
              secret={secret}
              onBack={() => setView('list')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ secret, setSecret, onLogin }) {
  return (
    <div style={styles.login}>
      <h2 style={styles.loginTitle}>Admin Access</h2>
      <input
        type="password"
        placeholder="Enter admin secret"
        value={secret}
        onChange={e => setSecret(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onLogin()}
        style={styles.input}
      />
      <button style={styles.primaryBtn} onClick={onLogin}>Enter</button>
    </div>
  )
}

// ── Novel List ────────────────────────────────────────────────────────────────

function NovelList({ novels, onEdit, onChapters, onDelete }) {
  if (!novels.length) return <p style={{ color: 'var(--text-muted)', padding: 24 }}>No novels yet.</p>
  return (
    <div style={styles.list}>
      {novels.map(n => (
        <div key={n.id} style={styles.novelRow}>
          <div style={styles.novelMeta}>
            <span style={styles.novelRowTitle}>{n.title}</span>
            <span style={styles.novelRowSub}>{n.author} · {n.chapter_count} ch.</span>
          </div>
          <div style={styles.rowActions}>
            <button style={styles.smBtn} onClick={() => onChapters(n)}>Chapters</button>
            <button style={styles.smBtn} onClick={() => onEdit(n)}>Edit</button>
            <button style={{ ...styles.smBtn, color: 'var(--danger)' }} onClick={() => onDelete(n.id)}>Del</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Novel Form ────────────────────────────────────────────────────────────────

function NovelForm({ novel, secret, onSave, onCancel }) {
  const [title, setTitle] = useState(novel?.title || '')
  const [author, setAuthor] = useState(novel?.author || '')
  const [desc, setDesc] = useState(novel?.description || '')
  const [cover, setCover] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const fd = new FormData()
    fd.append('title', title)
    fd.append('author', author)
    fd.append('description', desc)
    fd.append('x_admin_secret', secret)
    if (cover) fd.append('cover', cover)
    try { await onSave(fd) }
    finally { setSaving(false) }
  }

  return (
    <div style={styles.form}>
      <h2 style={styles.formTitle}>{novel ? 'Edit Novel' : 'New Novel'}</h2>
      <label style={styles.label}>Title</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={styles.input} />
      <label style={styles.label}>Author</label>
      <input value={author} onChange={e => setAuthor(e.target.value)} style={styles.input} />
      <label style={styles.label}>Description</label>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} style={{ ...styles.input, resize: 'vertical' }} />
      <label style={styles.label}>Cover Image</label>
      <input type="file" accept="image/*" onChange={e => setCover(e.target.files[0])} style={{ ...styles.input, padding: '8px' }} />
      <div style={styles.formActions}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Chapter Manager ───────────────────────────────────────────────────────────

function ChapterManager({ novel, secret, onBack }) {
  const [chapters, setChapters] = useState(novel.chapters || [])
  const [editing, setEditing] = useState(null) // chapter being edited
  const [adding, setAdding] = useState(false)

  async function handleDelete(id) {
    if (!confirm('Delete chapter?')) return
    await adminDeleteChapter(id, secret)
    setChapters(prev => prev.filter(c => c.id !== id))
  }

  async function handleSaveChapter(chapterId, fd) {
    if (chapterId) {
      const updated = await adminUpdateChapter(chapterId, fd)
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, ...updated } : c))
    } else {
      const created = await adminAddChapter(novel.id, fd)
      setChapters(prev => [...prev, created])
    }
    setEditing(null)
    setAdding(false)
  }

  return (
    <div style={styles.form}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <button style={{ ...styles.ghostBtn, padding: '4px 0', fontSize: '0.82rem' }} onClick={onBack}>← Back</button>
          <h2 style={{ ...styles.formTitle, marginTop: 4, marginBottom: 0 }}>Chapters: {novel.title}</h2>
        </div>
        <button style={styles.addBtn} onClick={() => { setAdding(true); setEditing(null) }}>+ Add</button>
      </div>

      {(adding || editing) && (
        <ChapterForm
          chapter={editing || null}
          novelId={novel.id}
          secret={secret}
          onSave={(fd) => handleSaveChapter(editing?.id || null, fd)}
          onCancel={() => { setAdding(false); setEditing(null) }}
        />
      )}

      {chapters.map((ch, i) => (
        <div key={ch.id} style={styles.chapterRow}>
          <span style={styles.chapterNum}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: '0.9rem' }}>{ch.title}</span>
          <div style={styles.rowActions}>
            <button style={styles.smBtn} onClick={() => { setEditing(ch); setAdding(false) }}>Edit</button>
            <button style={{ ...styles.smBtn, color: 'var(--danger)' }} onClick={() => handleDelete(ch.id)}>Del</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChapterForm({ chapter, novelId, secret, onSave, onCancel }) {
  const [title, setTitle] = useState(chapter?.title || '')
  const [content, setContent] = useState(chapter?.content || '')
  const [order, setOrder] = useState(chapter?.order ?? 0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const fd = new FormData()
    fd.append('title', title)
    fd.append('content', content)
    fd.append('order', order)
    fd.append('x_admin_secret', secret)
    try { await onSave(fd) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ ...styles.form, background: 'var(--bg-elevated)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <label style={styles.label}>Chapter Title</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={styles.input} />
      <label style={styles.label}>Order</label>
      <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} style={{ ...styles.input, width: 80 }} />
      <label style={styles.label}>Content (plain text)</label>
      <textarea value={content} onChange={e => setContent(e.target.value)} rows={10} style={{ ...styles.input, resize: 'vertical' }} />
      <div style={styles.formActions}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fadeAnim = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.18 }
}

const styles = {
  page: { padding: '0 0 60px', minHeight: '100vh' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '40px 20px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16,
  },
  title: { fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 300 },
  addBtn: {
    padding: '8px 16px', borderRadius: 20,
    background: 'var(--accent-soft)', border: '1px solid var(--accent)',
    color: 'var(--accent)', fontSize: '0.82rem', letterSpacing: '0.05em',
  },
  login: {
    display: 'flex', flexDirection: 'column', gap: 16,
    padding: 32, maxWidth: 340, margin: '80px auto',
  },
  loginTitle: { fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: 300, marginBottom: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 16px' },
  novelRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', borderRadius: 8, background: 'var(--bg-card)',
    border: '1px solid var(--border)',
  },
  novelMeta: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  novelRowTitle: { fontSize: '0.95rem', fontFamily: 'var(--font-serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  novelRowSub: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  rowActions: { display: 'flex', gap: 8, flexShrink: 0 },
  smBtn: { fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)' },
  form: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  formTitle: { fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 300, marginBottom: 8 },
  label: { fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: -4 },
  input: { /* from global */ },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  primaryBtn: {
    padding: '10px 24px', borderRadius: 8,
    background: 'var(--accent)', color: '#0e0c0a',
    fontSize: '0.88rem', fontWeight: 500,
  },
  ghostBtn: {
    padding: '10px 16px', borderRadius: 8,
    border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.88rem',
  },
  chapterRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 0', borderBottom: '1px solid var(--border)',
  },
  chapterNum: {
    width: 24, height: 24, borderRadius: '50%',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0,
  },
}
