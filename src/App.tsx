import React, { useState } from 'react'
import { Home, MessageSquare, Megaphone, ShoppingBag, Users, Settings, Snowflake, ChevronRight, PackageSearch } from 'lucide-react'
import HomePg from './pages/Home'
import Atendimento from './pages/Atendimento'
import Campanhas from './pages/Campanhas'
import Marketplace from './pages/Marketplace'
import Vendedores from './pages/Vendedores'
import Configuracoes from './pages/Configuracoes'
import ConferenciaBling from './pages/ConferenciaBling'
import type { Periodo } from './types'

type Page = 'home' | 'atendimento' | 'campanhas' | 'marketplace' | 'vendedores' | 'conferencia' | 'configuracoes'

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'home',          label: 'Home',              icon: <Home size={15} /> },
  { id: 'atendimento',   label: 'Atendimento',       icon: <MessageSquare size={15} /> },
  { id: 'campanhas',     label: 'Campanhas',         icon: <Megaphone size={15} /> },
  { id: 'marketplace',   label: 'Marketplace',       icon: <ShoppingBag size={15} /> },
  { id: 'vendedores',    label: 'Vendedores',        icon: <Users size={15} /> },
  { id: 'conferencia',   label: 'Conferência Bling', icon: <PackageSearch size={15} /> },
  { id: 'configuracoes', label: 'Configurações',     icon: <Settings size={15} /> },
]

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_atual:    'Mês atual',
  mes_anterior: 'Mês anterior',
  '3_meses':    'Últimos 3 meses',
  '6_meses':    'Últimos 6 meses',
}

export default function App() {
  const [page, setPage]       = useState<Page>('home')
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
    conferencia:   <ConferenciaBling periodo={periodo} />,
    configuracoes: <Configuracoes periodo={periodo} />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? 52 : 210,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 0' : '16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Snowflake size={14} color="#fff" />
          </div>
          {!collapsed && <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-dark)' }}>Stonni</div><div style={{ fontSize: 10, color: 'var(--text-hint)' }}>Ecommerce</div></div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(n => {
            const active = page === n.id
            return (
              <button key={n.id} onClick={() => setPage(n.id)} title={collapsed ? n.label : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '9px 0' : '9px 14px', justifyContent: collapsed ? 'center' : 'flex-start', border: 'none', background: active ? '#EFF6FF' : 'transparent', color: active ? 'var(--blue-dark)' : 'var(--text-muted)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', borderLeft: active ? '3px solid var(--blue-dark)' : '3px solid transparent', transition: 'all 0.15s' }}>
                <span style={{ flexShrink: 0 }}>{n.icon}</span>
                {!collapsed && <span>{n.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Collapse */}
        <button onClick={() => setCollapsed(c => !c)} style={{ margin: '0 0 10px', padding: '6px', alignSelf: 'center', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--text-hint)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
          <ChevronRight size={13} />
        </button>
      </aside>

      {/* ── Right side ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {NAV.find(n => n.id === page)?.label}
          </span>
          <div style={{ display: 'flex', gap: 3, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
            {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                style={{ padding: '4px 11px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: periodo === p ? 'var(--surface)' : 'transparent', color: periodo === p ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: periodo === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                {PERIODO_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <main style={{ flex: 1, overflow: 'auto' }}>
          {PAGES[page]}
        </main>
      </div>
    </div>
  )
}
