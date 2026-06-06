import React, { useState } from 'react'
import { Home, MessageSquare, Megaphone, ShoppingBag, Users, Settings, Snowflake, ChevronRight } from 'lucide-react'
import HomePg from './pages/Home'
import Atendimento from './pages/Atendimento'
import Campanhas from './pages/Campanhas'
import Marketplace from './pages/Marketplace'
import Vendedores from './pages/Vendedores'
import Configuracoes from './pages/Configuracoes'
import type { Periodo } from './types'

type Page = 'home' | 'atendimento' | 'campanhas' | 'marketplace' | 'vendedores' | 'configuracoes'

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'home',          label: 'Home',         icon: <Home size={16} /> },
  { id: 'atendimento',   label: 'Atendimento',  icon: <MessageSquare size={16} /> },
  { id: 'campanhas',     label: 'Campanhas',    icon: <Megaphone size={16} /> },
  { id: 'marketplace',   label: 'Marketplace',  icon: <ShoppingBag size={16} /> },
  { id: 'vendedores',    label: 'Vendedores',   icon: <Users size={16} /> },
  { id: 'configuracoes', label: 'Configurações',icon: <Settings size={16} /> },
]

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_atual:    'Mês atual',
  mes_anterior: 'Mês anterior',
  '3_meses':    'Últimos 3 meses',
  '6_meses':    'Últimos 6 meses',
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [collapsed, setCollapsed] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>(
    () => (localStorage.getItem('stonni_periodo_default') as Periodo) || 'mes_atual'
  )

  const PAGES: Record<Page, React.ReactNode> = {
    home:          <HomePg periodo={periodo} />,
    atendimento:   <Atendimento periodo={periodo} />,
    campanhas:     <Campanhas periodo={periodo} />,
    marketplace:   <Marketplace periodo={periodo} />,
    vendedores:    <Vendedores periodo={periodo} />,
    configuracoes: <Configuracoes periodo={periodo} />,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Top header bar ── */}
      <header style={{
        height: 52,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Snowflake size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue-dark)' }}>Stonni</span>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {NAV.map(n => {
            const active = page === n.id
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px',
                  border: 'none',
                  borderRadius: 7,
                  background: active ? '#EFF6FF' : 'transparent',
                  color: active ? 'var(--blue-dark)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {n.icon}
                <span>{n.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 3, background: '#F1F5F9', padding: 3, borderRadius: 8, flexShrink: 0 }}>
          {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              style={{
                padding: '4px 11px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                background: periodo === p ? 'var(--surface)' : 'transparent',
                color: periodo === p ? 'var(--blue-dark)' : 'var(--text-muted)',
                boxShadow: periodo === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
                fontFamily: 'DM Sans, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {PAGES[page]}
      </main>
    </div>
  )
}
