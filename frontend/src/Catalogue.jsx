import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchNovels } from '../api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Catalogue() {
  const [novels, setNovels] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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
    </div>
  )
}

function NovelCard({ novel, onClick }) {
  const coverUrl = novel.cover_image ? `${BASE_URL}${novel.cover_image}` : null

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
}
