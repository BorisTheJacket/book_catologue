import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { API_BASE_URL, fetchNovels } from '../api'
import { useAuth } from './useAuth'

/** Covers are served from FastAPI at /static/... on the public origin, not under /api. */
function publicOriginForStatic() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return API_BASE_URL.replace(/\/api\/?$/, '')
}

export default function Catalogue() {
  const [novels, setNovels] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { telegramId, matchesAdminTelegramId, adminTelegramIdConfigured } = useAuth()

  useEffect(() => {
    fetchNovels()
      .then(setNovels)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.subtitle}>Library</p>
        <h1 style={styles.title}>Your Novels</h1>
        <div style={styles.divider} />
      </header>

      {novels.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>📖</span>
          <p>No novels yet.</p>
          <p style={styles.emptyHint}>
            The library is empty until you add titles. Open{' '}
            <Link to="/admin" style={styles.inlineLink}>Admin</Link>
            {' '}and enter <code style={styles.code}>ADMIN_SECRET</code> from{' '}
            <code style={styles.code}>backend/.env</code> (this is separate from{' '}
            <code style={styles.code}>ADMIN_TELEGRAM_ID</code>, which is only for the Telegram bot).
          </p>
        </div>
      ) : (
        <motion.div
          style={styles.grid}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {novels.map((novel) => (
            <NovelCard key={novel.id} novel={novel} onClick={() => navigate(`/novel/${novel.id}`)} />
          ))}
        </motion.div>
      )}

      {telegramId != null && (
        <footer style={styles.debugFooter}>
          <p style={styles.debugLine}>
            Your Telegram user ID: <code style={styles.code}>{telegramId}</code>
          </p>
          {adminTelegramIdConfigured ? (
            <p style={styles.debugLine}>
              <code style={styles.code}>ADMIN_TELEGRAM_ID</code> on the server{' '}
              {matchesAdminTelegramId ? (
                <strong style={{ color: 'var(--accent)' }}>matches</strong>
              ) : (
                <strong style={{ color: 'var(--danger)' }}>does not match</strong>
              )}{' '}
              this ID (used for bot owner / invite tooling, not for creating novels).
            </p>
          ) : (
            <p style={styles.debugLine}>
              <code style={styles.code}>ADMIN_TELEGRAM_ID</code> is not set in{' '}
              <code style={styles.code}>backend/.env</code> on the server.
            </p>
          )}
        </footer>
      )}
    </div>
  )
}

function NovelCard({ novel, onClick }) {
  const coverUrl = novel.cover_image
    ? `${publicOriginForStatic()}${novel.cover_image}`
    : null

  return (
    <motion.div
      style={styles.card}
      onClick={onClick}
      variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
      whileTap={{ scale: 0.97 }}
    >
      <div style={styles.cover}>
        {coverUrl
          ? <img src={coverUrl} alt={novel.title} style={styles.coverImg} />
          : <div style={styles.coverPlaceholder}><span style={styles.coverIcon}>📖</span></div>
        }
      </div>
      <div style={styles.cardInfo}>
        <h2 style={styles.cardTitle}>{novel.title}</h2>
        <p style={styles.cardAuthor}>{novel.author}</p>
        {novel.description && (
          <p style={styles.cardDesc}>
            {novel.description.length > 80
              ? novel.description.slice(0, 80) + '…'
              : novel.description}
          </p>
        )}
        <span style={styles.chapterBadge}>{novel.chapter_count} chapters</span>
      </div>
    </motion.div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <motion.div
        style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '0 0 40px',
  },
  header: {
    padding: '48px 24px 32px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 24,
  },
  subtitle: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.7rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '2.4rem',
    fontWeight: 300,
    letterSpacing: '-0.01em',
    lineHeight: 1.1,
  },
  divider: {
    width: 40,
    height: 2,
    background: 'var(--accent)',
    marginTop: 16,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 16px',
  },
  card: {
    display: 'flex',
    gap: 16,
    padding: '16px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-card)',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    transition: 'border-color 0.2s',
  },
  cover: {
    width: 72,
    height: 108,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
    background: 'var(--bg-elevated)',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverIcon: { fontSize: '2rem' },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.2rem',
    fontWeight: 400,
    lineHeight: 1.2,
  },
  cardAuthor: {
    fontSize: '0.8rem',
    color: 'var(--accent)',
    letterSpacing: '0.05em',
  },
  cardDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginTop: 4,
  },
  chapterBadge: {
    marginTop: 'auto',
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    paddingTop: 80,
    color: 'var(--text-muted)',
  },
  emptyIcon: { fontSize: '3rem' },
  emptyHint: {
    maxWidth: 420,
    textAlign: 'center',
    fontSize: '0.82rem',
    lineHeight: 1.55,
    marginTop: 8,
    padding: '0 20px',
  },
  inlineLink: {
    color: 'var(--accent)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  code: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.78em',
    background: 'var(--bg-elevated)',
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--border)',
  },
  debugFooter: {
    marginTop: 'auto',
    padding: '24px 20px 32px',
    borderTop: '1px solid var(--border)',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  debugLine: { marginBottom: 8 },
}
