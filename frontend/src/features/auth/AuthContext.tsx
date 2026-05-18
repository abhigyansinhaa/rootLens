import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken } from '../../api/client'

type User = { id: number; email: string; created_at: string }

type AuthContextValue = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = getToken()
    if (!t) {
      setUser(null)
      return
    }
    try {
      const { data } = await api.get<User>('/auth/me')
      setUser(data)
    } catch {
      setUser(null)
      setToken(null)
      setTok(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!getToken()) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        await refreshUser()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const logout = useCallback(() => {
    setToken(null)
    setTok(null)
    setUser(null)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password })
      setToken(data.access_token)
      setTok(data.access_token)
      await refreshUser()
    },
    [refreshUser],
  )

  const register = useCallback(
    async (email: string, password: string) => {
      await api.post('/auth/register', { email, password })
      await login(email, password)
    },
    [login],
  )

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Hook for auth state; colocated with provider for a single import path. */
// eslint-disable-next-line react-refresh/only-export-components -- Fast Refresh expects hooks separate from providers
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
