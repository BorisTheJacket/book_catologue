import { createContext, useContext, useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { verifyAccess } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading') // loading | granted | denied | error

  useEffect(() => {
    async function check() {
      try {
        WebApp.ready()
        const initData = WebApp.initData

        // Dev fallback when running outside Telegram
        if (!initData && import.meta.env.DEV) {
          setStatus('granted')
          return
        }

        await verifyAccess(initData)
        setStatus('granted')
      } catch (e) {
        setStatus(e.message?.includes('403') ? 'denied' : 'error')
      }
    }
    check()
  }, [])

  return (
    <AuthContext.Provider value={{ status }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
