import React, { createContext, useContext, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Outlet, useLocation } from 'react-router'
import Sidebar from './Sidebar'
import { periodoLabel } from '../../lib/query'
import type { Periodo, PeriodoFixo } from '../../types'

const PERIODOS_FIXOS: PeriodoFixo[] = ['mes_atual', 'mes_anterior', '3_meses', '6_meses']

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
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const salvo = localStorage.getItem('stonni_periodo_default')
    return (PERIODOS_FIXOS as string[]).includes(salvo || '') ? (salvo as PeriodoFixo) : 'mes_atual'
  })
  const isPersonalizado = typeof periodo === 'object'
  const [popoverAberto, setPopoverAberto] = useState(false)
  const [inicioForm, setInicioForm] = useState('')
  const [fimForm, setFimForm] = useState('')
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || ''

  function abrirPopover() {
    // Reabre com o recorte atual pré-preenchido, se já estiver num personalizado — facilita ajustar.
    if (isPersonalizado) { setInicioForm(periodo.inicio); setFimForm(periodo.fim) }
    setPopoverAberto(o => !o)
  }
  function aplicarPersonalizado() {
    if (!inicioForm || !fimForm || inicioForm > fimForm) return
    setPeriodo({ tipo: 'personalizado', inicio: inicioForm, fim: fimForm })
    setPopoverAberto(false)
  }

  return (
    <PeriodoContext.Provider value={{ periodo, setPeriodo }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{title}</span>
            <div style={{ position: 'relative', display: 'flex', gap: 3, background: 'var(--surface-sunken)', padding: 3, borderRadius: 8 }}>
              {PERIODOS_FIXOS.map(p => (
                <button key={p} onClick={() => setPeriodo(p)}
                  style={{ padding: '4px 11px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: periodo === p ? 'var(--surface)' : 'transparent', color: periodo === p ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: periodo === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                  {periodoLabel(p)}
                </button>
              ))}
              <button onClick={abrirPopover}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: isPersonalizado ? 'var(--surface)' : 'transparent', color: isPersonalizado ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: isPersonalizado ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                <Calendar size={12} />
                {isPersonalizado ? periodoLabel(periodo) : 'Personalizado'}
              </button>

              {popoverAberto && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 20, minWidth: 240 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Período personalizado
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                    Início
                    <input type="date" value={inicioForm} onChange={e => setInicioForm(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                    Fim
                    <input type="date" value={fimForm} min={inicioForm || undefined} onChange={e => setFimForm(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, fontFamily: 'var(--font-sans)' }} />
                  </label>
                  {inicioForm && fimForm && inicioForm > fimForm && (
                    <span style={{ fontSize: 11, color: 'var(--red)' }}>O início precisa ser antes do fim.</span>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setPopoverAberto(false)}
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Cancelar
                    </button>
                    <button onClick={aplicarPersonalizado} disabled={!inicioForm || !fimForm || inicioForm > fimForm}
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--action-primary-bg)', color: 'var(--action-primary-fg)', fontSize: 12, fontWeight: 600, cursor: (!inicioForm || !fimForm || inicioForm > fimForm) ? 'not-allowed' : 'pointer', opacity: (!inicioForm || !fimForm || inicioForm > fimForm) ? 0.5 : 1, fontFamily: 'var(--font-sans)' }}>
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
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
