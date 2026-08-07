import React, { createContext, useContext, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import Sidebar from './Sidebar'
import type { Periodo } from '../../types'

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_atual:    'Mês atual',
  mes_anterior: 'Mês anterior',
  '3_meses':    'Últimos 3 meses',
  '6_meses':    'Últimos 6 meses',
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/atendimento': 'Atendimento',
  '/campanhas': 'Campanhas',
  '/parceiros': 'Parceiros',
  '/marketplace': 'Marketplace',
  '/vendedores': 'Vendedores',
  '/relatorios': 'Relatórios',
  '/conferencia': 'Conferência Bling',
  '/configuracoes': 'Configurações',
}

interface PeriodoCtx {
  periodo: Periodo
  setPeriodo: (p: Periodo) => void
}

const PeriodoContext = createContext<PeriodoCtx>({
  periodo: 'mes_atual',
  setPeriodo: () => {},
})

export function usePeriodo() {
  return useContext(PeriodoContext)
}

export default function AppShell() {
  const [periodo, setPeriodo] = useState<Periodo>(
    () => (localStorage.getItem('stonni_periodo_default') as Periodo) || 'mes_atual'
  )
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || ''

  return (
    <PeriodoContext.Provider value={{ periodo, setPeriodo }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{title}</span>
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
            <Outlet />
          </main>
        </div>
      </div>
    </PeriodoContext.Provider>
  )
}
