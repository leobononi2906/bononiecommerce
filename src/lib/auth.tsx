import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Mesmo desenho dos apps com login do grupo (bononi-cobranca, bononi-exped):
// a sessão é do Supabase Auth e o acesso vem de user_metadata, que o Hub grava.
// Isto organiza a tela; o que protege o dado é a RLS no banco (ver docs/STATUS.md).
const MODULO = 'ecommerce'
const HUB_URL = 'https://bononi-hub.vercel.app/'

interface AuthState {
  session: Session | null
  carregando: boolean
  nome: string
  email: string
  isAdmin: boolean
  temAcesso: boolean
  /** Token do usuário logado, para chamadas que não passam pelo supabase-js. */
  token: string | null
  logout: () => Promise<void>
  hubUrl: string
}

const Ctx = createContext<AuthState | null>(null)

function lerAcesso(session: Session | null) {
  const meta = (session?.user?.user_metadata || {}) as Record<string, unknown>
  const modulos = Array.isArray(meta.modulos) ? (meta.modulos as string[]) : []
  const adminModulos = Array.isArray(meta.admin_modulos) ? (meta.admin_modulos as string[]) : []
  const adminGeral = meta.admin === true || meta.admin === 'true'
  const isAdmin = adminGeral || adminModulos.includes(MODULO)
  return {
    meta,
    isAdmin,
    temAcesso: isAdmin || modulos.includes(MODULO),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const tentouRenovar = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const { meta, isAdmin, temAcesso } = lerAcesso(session)

  // user_metadata só renova com o token (de hora em hora): quem acabou de ganhar
  // o módulo no Hub ainda não o vê. Uma renovação antes de barrar, uma vez por
  // login, evita mandar a pessoa para "sem acesso" por causa de token velho.
  useEffect(() => {
    if (!session) { tentouRenovar.current = false; return }
    if (temAcesso || tentouRenovar.current) return
    tentouRenovar.current = true
    supabase.auth.refreshSession().then(({ data }) => {
      if (data.session) setSession(data.session)
    })
  }, [session, temAcesso])

  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  const email = session?.user?.email || ''
  const nome = (meta.nome as string) || email.split('@')[0] || ''

  return (
    <Ctx.Provider
      value={{
        session, carregando, nome, email, isAdmin, temAcesso,
        token: session?.access_token ?? null,
        logout, hubUrl: HUB_URL,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
