import { createContext, useContext, useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { verifyAccess } from '../api'

const AuthContext = createContext({
  status: 'loading',
  telegramId: null,
  matchesAdminTelegramId: false,
  adminTelegramIdConfigured: false,
  lastAuthError: null,
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState({
    status: 'loading',
    telegramId: null,
    matchesAdminTelegramId: false,
    adminTelegramIdConfigured: false,
    lastAuthError: null,
  })

  useEffect(() => {
    async function check() {
      try {
        WebApp.ready()
        const initData = WebApp.initData

        if (!initData && import.meta.env.DEV) {
          setSession({
            status: 'granted',
            telegramId: null,
            matchesAdminTelegramId: false,
            adminTelegramIdConfigured: false,
            lastAuthError: null,
          })
          return
        }

        // Regular browser: no Telegram session — do not call /auth/verify with empty initData (401 → misleading "error")
        if (!initData) {
          setSession({
            status: 'need_telegram',
            telegramId: null,
            matchesAdminTelegramId: false,
            adminTelegramIdConfigured: false,
            lastAuthError: null,
          })
          return
        }

        const data = await verifyAccess(initData)
        setSession({
          status: 'granted',
          telegramId: data.telegram_id ?? null,
          matchesAdminTelegramId: Boolean(data.matches_admin_telegram_id),
          adminTelegramIdConfigured: Boolean(data.admin_telegram_id_configured),
          lastAuthError: null,
        })
      } catch (e) {
        const msg = e.message || String(e)
        const denied =
          e.status === 403 ||
          msg.includes('403') ||
          msg.toLowerCase().includes('access denied')
        const needTg = e.status === 401 || msg.toLowerCase().includes('invalid telegram')
        setSession({
          status: denied ? 'denied' : needTg ? 'need_telegram' : 'error',
          telegramId: null,
          matchesAdminTelegramId: false,
          adminTelegramIdConfigured: false,
          lastAuthError: denied || needTg ? null : msg,
        })
      }
    }
    check()
  }, [])

  return (
    <AuthContext.Provider value={session}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
