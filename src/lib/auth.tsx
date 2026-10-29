import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthResponse, User } from '../../shared/types'
import { api, onUnauthorized, refreshSession, setSession } from './api'

type Status = 'loading' | 'in' | 'out'

interface AuthContextValue {
  status: Status
  user: User | null
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: (everywhere?: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)

  const signedIn = useCallback((auth: AuthResponse) => {
    setSession(auth)
    setUser(auth.user)
    setStatus('in')
  }, [])

  const signedOut = useCallback(() => {
    setSession(null)
    setUser(null)
    setStatus('out')
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    onUnauthorized(signedOut)
    refreshSession().then((auth) => (auth ? signedIn(auth) : signedOut()))
  }, [signedIn, signedOut])

  const value: AuthContextValue = {
    status,
    user,
    login: async (email, password) => {
      signedIn(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }))
    },
    signup: async (name, email, password) => {
      signedIn(await api<AuthResponse>('/auth/signup', { method: 'POST', body: { name, email, password } }))
    },
    logout: async (everywhere = false) => {
      await api(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }).catch(() => {})
      signedOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
