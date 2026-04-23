import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchNovel } from '../api'

const WORDS_PER_PAGE = 280

/** Split chapter content into pages by word count */
function paginateChapter(content) {
  const words = content.trim().split(/\s+/)
  const pages = []
  for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
    pages.push(words.slice(i, i + WORDS_PER_PAGE).join(' '))
  }
  return pages.length ? pages : ['']
}

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [novel, setNovel] = useState(null)
  const [chapterIdx, setChapterIdx] = useState(0)
  const [pageIdx, setPageIdx] = useState(0)
  const [pages, setPages] = useState([])
  const [direction, setDirection] = useState(1)
  const [showMenu, setShowMenu] = useState(false)
  const touchStart = useRef(null)

  useEffect(() => {
    fetchNovel(id).then((n) => {
      setNovel(n)
      if (n.chapters.length > 0) {
        setPages(paginateChapter(n.chapters[0].content))
      }
    })
  }, [id])

  useEffect(() => {
    if (novel?.chapters?.[chapterIdx]) {
      setPages(paginateChapter(novel.chapters[chapterIdx].content))
      setPageIdx(0)
    }
  }, [chapterIdx, novel])

  if (!novel) return <LoadingScreen />

  const chapters = novel.chapters
  const totalPages = pages.length

  function goNext() {
    setDirection(1)
    if (pageIdx < totalPages - 1) {
      setPageIdx(p => p + 1)
    } else if (chapterIdx < chapters.length - 1) {
      setChapterIdx(c => c + 1)
    }
  }

  function goPrev() {
    setDirection(-1)
    if (pageIdx > 0) {
      setPageIdx(p => p - 1)
    } else if (chapterIdx > 0) {
      setChapterIdx(c => c - 1)
    }
  }

  // Touch swipe
  function onTouchStart(e) { touchStart.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev()
    }
    touchStart.current = null
  }

  // Tap zones: left 40% = prev, right 40% = next, middle = menu
  function onTap(e) {
    const x = e.clientX / window.innerWidth
    if (x < 0.35) goPrev()
    else if (x > 0.65) goNext()
    else setShowMenu(v => !v)
  }

  const isLastPage = pageIdx === totalPages - 1 && chapterIdx === chapters.length - 1
  const isFirstPage = pageIdx === 0 && chapterIdx === 0

  return (
    <div
      style={styles.reader}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onTap}
    >
      {/* Top bar */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            style={styles.topBar}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <button style={styles.backBtn} onClick={(e) => { e.stopPropagation(); navigate(-1) }}>
              ← Library
            </button>
            <span style={styles.chapterTitle}>
              {chapters[chapterIdx]?.title || `Chapter ${chapterIdx + 1}`}
            </span>
            <span style={styles.progress}>{pageIdx + 1}/{totalPages}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`${chapterIdx}-${pageIdx}`}
          style={styles.page}
          custom={direction}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {pageIdx === 0 && (
            <p style={styles.chapterHeading}>
              {chapters[chapterIdx]?.title || `Chapter ${chapterIdx + 1}`}
            </p>
          )}
          <p style={styles.text}>{pages[pageIdx]}</p>

          {isLastPage && (
            <div style={styles.endMarker}>
              <span style={styles.endLine} />
              <span style={styles.endText}>End of Book</span>
              <span style={styles.endLine} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom bar */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            style={styles.bottomBar}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={e => e.stopPropagation()}
          >
            <span style={styles.novelTitle}>{novel.title}</span>
            <ChapterSelector
              chapters={chapters}
              currentIdx={chapterIdx}
              onSelect={(i) => { setChapterIdx(i); setShowMenu(false) }}
            />
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${((chapterIdx * 100 + (pageIdx / totalPages) * 100) / chapters.length).toFixed(1)}%`
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap zone hint (first visit) */}
      {!showMenu && (
        <div style={styles.tapHints}>
          {!isFirstPage && <div style={styles.tapLeft} />}
          {!isLastPage && <div style={styles.tapRight} />}
        </div>
      )}
    </div>
  )
}

function ChapterSelector({ chapters, currentIdx, onSelect }) {
  return (
    <div style={styles.chapterList}>
      {chapters.map((ch, i) => (
        <button
          key={ch.id}
          style={{
            ...styles.chapterBtn,
            ...(i === currentIdx ? styles.chapterBtnActive : {})
          }}
          onClick={() => onSelect(i)}
        >
          {ch.title || `Chapter ${i + 1}`}
        </button>
      ))}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
    </div>
  )
}

const pageVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
}

const styles = {
  reader: {
    position: 'relative',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
    userSelect: 'none',
  },
  topBar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: 'linear-gradient(to bottom, var(--bg) 70%, transparent)',
    gap: 12,
  },
  backBtn: {
    fontSize: '0.82rem',
    color: 'var(--accent)',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  chapterTitle: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progress: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  page: {
    position: 'absolute',
    inset: 0,
    padding: '80px 28px 120px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  chapterHeading: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.4rem',
    fontWeight: 400,
    fontStyle: 'italic',
    color: 'var(--accent)',
    textAlign: 'center',
    marginBottom: 8,
  },
  text: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.18rem',
    lineHeight: 1.85,
    color: 'var(--text)',
    fontWeight: 300,
    textAlign: 'justify',
  },
  endMarker: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    opacity: 0.5,
  },
  endLine: { flex: 1, height: 1, background: 'var(--text-muted)' },
  endText: { fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  bottomBar: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    zIndex: 100,
    padding: '16px 20px 32px',
    background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  novelTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '0.85rem',
    fontStyle: 'italic',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  chapterList: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  chapterBtn: {
    flexShrink: 0,
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid var(--border)',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    whiteSpace: 'nowrap',
  },
  chapterBtnActive: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  progressBar: {
    height: 2,
    background: 'var(--border)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.3s',
  },
  tapHints: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  tapLeft: { width: '35%', height: '100%' },
  tapRight: { width: '35%', height: '100%' },
}
