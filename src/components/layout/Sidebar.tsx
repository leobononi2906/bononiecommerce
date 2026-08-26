import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Home, MessageSquare, Megaphone, ShoppingBag, Users, Settings, Snowflake, ChevronRight, PackageSearch, Handshake, FileText, TrendingUp } from 'lucide-react'

type NavItem = { to: string; label: string; icon: React.ReactNode; sub?: boolean; parent?: string }

const NAV: NavItem[] = [
  { to: '/',              label: 'Home',              icon: <Home size={15} /> },
  { to: '/atendimento',   label: 'Atendimento',       icon: <MessageSquare size={15} /> },
  { to: '/campanhas',     label: 'Marketing',         icon: <Megaphone size={15} /> },
  { to: '/campanhas-roi', label: 'Campanhas — ROI',   icon: <TrendingUp size={15} />, sub: true, parent: '/campanhas' },
  { to: '/parceiros',     label: 'Parceiros',         icon: <Handshake size={15} />, sub: true, parent: '/campanhas' },
  { to: '/marketplace',   label: 'Marketplace',       icon: <ShoppingBag size={15} /> },
  { to: '/vendedores',    label: 'Vendedores',        icon: <Users size={15} /> },
  { to: '/relatorios',    label: 'Relatórios',        icon: <FileText size={15} /> },
  { to: '/conferencia',   label: 'Conferência Bling', icon: <PackageSearch size={15} /> },
  { to: '/configuracoes', label: 'Configurações',     icon: <Settings size={15} /> },
]

const MARKETING_PATHS = ['/campanhas', '/campanhas-roi', '/parceiros']

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const isMarketingActive = MARKETING_PATHS.includes(location.pathname)

  return (
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
          const isSub = !!n.sub
          if (isSub && !isMarketingActive) return null
          return (
            <NavLink key={n.to} to={n.to} title={collapsed ? n.label : undefined}
              end={n.to === '/'}
              style={({ isActive }) => ({
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: collapsed ? '9px 0' : isSub ? '7px 14px 7px 28px' : '9px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                background: isActive ? '#EFF6FF' : 'transparent',
                color: isActive ? 'var(--blue-dark)' : 'var(--text-muted)',
                fontSize: isSub ? 12 : 13,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'DM Sans, sans-serif',
                borderLeft: isActive ? '3px solid var(--blue-dark)' : '3px solid transparent',
                transition: 'all 0.15s',
              })}>
              <span style={{ flexShrink: 0 }}>{n.icon}</span>
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse */}
      <button onClick={() => setCollapsed(c => !c)} style={{ margin: '0 0 10px', padding: '6px', alignSelf: 'center', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--text-hint)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
        <ChevronRight size={13} />
      </button>
    </aside>
  )
}
