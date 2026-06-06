import React, { useState } from 'react'
import { Home, MessageSquare, Megaphone, ShoppingBag, Users, Settings, Snowflake, ChevronRight } from 'lucide-react'
import HomePg from './pages/Home'
import Atendimento from './pages/Atendimento'
import Campanhas from './pages/Campanhas'
import Marketplace from './pages/Marketplace'
import Vendedores from './pages/Vendedores'
import Configuracoes from './pages/Configuracoes'

type Page = 'home' | 'atendimento' | 'campanhas' | 'marketplace' | 'vendedores' | 'configuracoes'

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'home',          label: 'Home',         icon: <Home size={16} /> },
  { id: 'atendimento',   label: 'Atendimento',  icon: <MessageSquare size={16} /> },
  { id: 'campanhas',     label: 'Campanhas',    icon: <Megaphone size={16} /> },
  { id: 'marketplace',  label: 'Marketplace',  icon: <ShoppingBag size={16} /> },
  { id: 'vendedores',   label: 'Vendedores',   icon: <Users size={16} /> },
  { id: 'configuracoes',label: 'Configurações', icon: <Settings size={16} /> },
]

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [collapsed, setCollapsed] = useState(false)

  const PAGES: Record<Page, React.ReactNode> = {
    home:          <HomePg />,
    atendimento:   <Atendimento />,
    campanhas:     <Campanhas />,
    marketplace:   <Marketplace />,
    vendedores:    <Vendedores />,
    configuracoes: <Configuracoes />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 56 : 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--blue-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Snowflake size={16} color="#ffffff" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue-dark)', letterSpacing: '-0.3px' }}>Stonni</div>
              <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>Ecommerce</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '10px 0' }}>
          {NAV.map(n => {
            const active = page === n.id
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                title={collapsed ? n.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 0' : '10px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  color: active ? 'var(--blue-dark)' : 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  borderLeft: active ? '3px solid var(--blue-dark)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ flexShrink: 0 }}>{n.icon}</span>
                {!collapsed && <span>{n.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            margin: '0 0 12px',
            padding: '8px',
            alignSelf: 'center',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-hint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s',
          }}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          <ChevronRight size={14} />
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
        {PAGES[page]}
      </main>
    </div>
  )
}
