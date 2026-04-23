import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Catalogue from './pages/Catalogue'
import Reader from './pages/Reader'
import Admin from './pages/Admin'
import './index.css'

function AuthGate({ children }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', gap: 12, flexDirection: 'column' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #2e2820', borderTopColor: '#c8974a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '0.8rem', color: '#7a6e63', letterSpacing: '0.1em' }}>Opening library…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
        <span style={{ fontSize: '3rem' }}>🔒</span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, textAlign: 'center' }}>Private Library</h2>
        <p style={{ color: '#7a6e63', textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.6 }}>
          You need an invite link to access this library.<br />
          Please contact the author.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
        <p style={{ color: '#c85a4a' }}>Connection error. Please try again.</p>
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
          <Routes>
            <Route path="/" element={<Catalogue />} />
            <Route path="/novel/:id" element={<Reader />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  )
}
