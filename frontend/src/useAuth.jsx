import { createContext, useContext, useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { verifyAccess } from '../api'

const AuthContext = createContext({
  status: 'loading',
  telegramId: null,
  matchesAdminTelegramId: false,
  adminTelegramIdConfigured: false,
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState({
    status: 'loading',
    telegramId: null,
    matchesAdminTelegramId: false,
    adminTelegramIdConfigured: false,
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
          })
          return
        }

        const data = await verifyAccess(initData)
        setSession({
          status: 'granted',
          telegramId: data.telegram_id ?? null,
          matchesAdminTelegramId: Boolean(data.matches_admin_telegram_id),
          adminTelegramIdConfigured: Boolean(data.admin_telegram_id_configured),
        })
      } catch (e) {
        setSession((s) => ({
          ...s,
          status: e.message?.includes('403') ? 'denied' : 'error',
        }))
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
