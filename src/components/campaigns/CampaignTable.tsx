import React, { useState } from 'react'
import { ChevronRight, AlertTriangle, TrendingUp, Pause, Eye } from 'lucide-react'
import { fmtBRL, fmtNum } from '../../lib/fmt'
import type { CampaignAnalysis, CampaignVerdict } from '../../types/campaigns'
import type { CampaignDetail } from '../../hooks/use-campaigns'
import SparklineCell from './SparklineCell'

const font = { fontFamily: 'DM Sans, sans-serif' }
const mono = { fontFamily: 'DM Mono, monospace' }

const VC: Record<CampaignVerdict, { bg: string; fg: string; icon: React.ReactNode }> = {
  ESCALAR:   { bg: 'var(--green-bg)', fg: 'var(--green)', icon: <TrendingUp size={11} /> },
  MANTER:    { bg: '#EFF6FF',         fg: 'var(--blue-dark)', icon: <Eye size={11} /> },
  MONITORAR: { bg: 'var(--amber-bg)', fg: 'var(--amber)', icon: <AlertTriangle size={11} /> },
  PAUSAR:    { bg: 'var(--red-bg)',   fg: 'var(--red)', icon: <Pause size={11} /> },
}

const FILTERS: (CampaignVerdict | 'TODOS')[] = ['TODOS', 'ESCALAR', 'MANTER', 'MONITORAR', 'PAUSAR']

interface Props {
  campaigns: CampaignAnalysis[]
  details: CampaignDetail[]
  summary: { total: number; escalar: number; manter: number; monitorar: number; pausar: number }
}

const th: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', background: 'var(--blue-dark)', color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap', ...font }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, ...font }
const tdM: React.CSSProperties = { ...td, textAlign: 'right', fontWeight: 600, ...mono }

export default function CampaignTable({ campaigns, details, summary }: Props) {
  const [filter, setFilter] = useState<CampaignVerdict | 'TODOS'>('TODOS')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = filter === 'TODOS' ? campaigns : campaigns.filter(c => c.verdict === filter)
  const maxSpend = Math.max(...campaigns.map(c => c.spend), 1)
  const urgentes = campaigns.filter(c => c.verdict === 'PAUSAR' && c.spend > 500)

  function toggle(camp: string) {
    setExpanded(p => { const n = new Set(p); n.has(camp) ? n.delete(camp) : n.add(camp); return n })
  }

  function getDetails(camp: string) {
    const rows = details.filter(d => d.campanha === camp)
    const cjs = new Map<string, { leads: number; vendas: number; fat: number; conv: number; ans: CampaignDetail[] }>()
    rows.forEach(r => {
      const c = cjs.get(r.conjunto) || { leads: 0, vendas: 0, fat: 0, conv: 0, ans: [] }
      c.leads += r.leads; c.vendas += r.vendas; c.fat += r.faturamento; c.ans.push(r)
      cjs.set(r.conjunto, c)
    })
    cjs.forEach(v => { v.conv = v.leads > 0 ? (v.vendas / v.leads) * 100 : 0 })
    return [...cjs.entries()].sort((a, b) => b[1].leads - a[1].leads)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
      {/* Alerta urgente */}
      {urgentes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--red-bg)', borderBottom: '1px solid #FECACA', fontSize: 13, fontWeight: 600, color: 'var(--red)', ...font }}>
          <AlertTriangle size={14} />
          {urgentes.length} campanha{urgentes.length > 1 ? 's' : ''} queimando dinheiro — {urgentes.map(c => c.shortName).join(', ')}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, ...font }}>{summary.total} campanhas</span>
          {(['ESCALAR', 'MANTER', 'MONITORAR', 'PAUSAR'] as CampaignVerdict[]).map(v => {
            const n = summary[v.toLowerCase() as keyof typeof summary] as number
            const vc = VC[v]
            return <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: vc.bg, color: vc.fg, cursor: 'pointer', ...font }} onClick={() => setFilter(filter === v ? 'TODOS' : v)}>{vc.icon} {n}</span>
          })}
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f ? 'var(--surface)' : 'transparent', color: filter === f ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', ...font }}>
              {f === 'TODOS' ? 'Todos' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'center', width: 28 }}></th>
            <th style={{ ...th, textAlign: 'left' }}>Campanha</th>
            <th style={th}>Investido</th>
            <th style={th}>Leads</th>
            <th style={th}>Vendas</th>
            <th style={th}>Conv.</th>
            <th style={th}>Faturado</th>
            <th style={th}>ROAS</th>
            <th style={th}>CPA</th>
            <th style={{ ...th, width: 70 }}></th>
            <th style={th}>Veredicto</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Nenhuma campanha com esse filtro.</td></tr>
          ) : filtered.map(c => {
            const vc = VC[c.verdict]
            const barW = (c.spend / maxSpend) * 100
            const isOpen = expanded.has(c.campanha)
            const has = details.some(d => d.campanha === c.campanha)
            const rowBg = c.verdict === 'PAUSAR' ? 'var(--red-bg)' : undefined

            return (
              <React.Fragment key={c.campanha}>
                <tr style={{ background: rowBg, cursor: has ? 'pointer' : 'default', borderBottom: '1px solid var(--border)' }} onClick={() => has && toggle(c.campanha)}>
                  <td style={{ ...td, textAlign: 'center', width: 28, padding: '8px 4px' }}>
                    {has && <ChevronRight size={13} style={{ color: 'var(--text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />}
                  </td>
                  <td style={{ ...td, textAlign: 'left', maxWidth: 220 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.shortName}</div>
                    {c.subgrupos.length > 0 && (
                      <div style={{ marginTop: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {c.subgrupos.map(s => <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: '0 6px', borderRadius: 20, background: '#EFF6FF', color: 'var(--blue-dark)' }}>{s}</span>)}
                      </div>
                    )}
                    <div style={{ height: 3, marginTop: 4, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${barW}%`, background: vc.fg, opacity: 0.4 }} />
                    </div>
                  </td>
                  <td style={tdM}>{fmtBRL(c.spend)}</td>
                  <td style={{ ...tdM, fontWeight: 400 }}>{fmtNum(c.leads)}</td>
                  <td style={{ ...tdM, fontSize: 14, color: c.vendas > 0 ? 'var(--text-primary)' : 'var(--text-hint)' }}>{c.vendas || '–'}</td>
                  <td style={{ ...tdM, fontSize: 12, color: c.conversao >= 1 ? 'var(--green)' : c.conversao > 0 ? 'var(--amber)' : 'var(--text-hint)' }}>{c.conversao > 0 ? `${c.conversao.toFixed(1)}%` : '0%'}</td>
                  <td style={{ ...tdM, fontSize: 14, color: c.revenue > 0 ? 'var(--blue-dark)' : 'var(--text-hint)' }}>{c.revenue > 0 ? fmtBRL(c.revenue) : '–'}</td>
                  <td style={{ ...tdM, fontSize: 14, color: vc.fg }}>{c.roas > 0 ? `${c.roas.toFixed(1)}x` : '–'}</td>
                  <td style={{ ...tdM, fontSize: 12, color: c.cpa > 5000 ? 'var(--red)' : 'var(--text-muted)' }}>{c.cpa > 0 ? fmtBRL(c.cpa) : '–'}</td>
                  <td style={{ ...td, textAlign: 'right' }}><SparklineCell data={c.sparkline} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: vc.bg, color: vc.fg, whiteSpace: 'nowrap', ...font }}>{vc.icon} {c.verdict}</span>
                  </td>
                </tr>

                {/* Expanded rows */}
                {isOpen && getDetails(c.campanha).map(([cj, d]) => (
                  <React.Fragment key={`${c.campanha}|${cj}`}>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                      <td style={td}></td>
                      <td style={{ ...td, textAlign: 'left', paddingLeft: 24, fontSize: 12, fontWeight: 600, color: 'var(--blue-dark)' }}>┣ {cj.replace(/\[[\d\/]+\]\s*/g, '').trim()}</td>
                      <td style={{ ...tdM, fontSize: 12, color: 'var(--text-hint)' }}>–</td>
                      <td style={{ ...tdM, fontSize: 12 }}>{fmtNum(d.leads)}</td>
                      <td style={{ ...tdM, fontSize: 12, color: d.vendas > 0 ? 'var(--text-primary)' : 'var(--text-hint)' }}>{d.vendas || '–'}</td>
                      <td style={{ ...tdM, fontSize: 11, color: d.conv >= 1 ? 'var(--green)' : d.conv > 0 ? 'var(--amber)' : 'var(--text-hint)' }}>{d.conv > 0 ? `${d.conv.toFixed(1)}%` : '0%'}</td>
                      <td style={{ ...tdM, fontSize: 12, color: d.fat > 0 ? 'var(--blue-dark)' : 'var(--text-hint)' }}>{d.fat > 0 ? fmtBRL(d.fat) : '–'}</td>
                      <td colSpan={4} style={td}></td>
                    </tr>
                    {d.ans.map((an, ai) => (
                      <tr key={`${c.campanha}|${cj}|${ai}`} style={{ background: '#FAFBFC', borderBottom: '1px solid var(--border)' }}>
                        <td style={td}></td>
                        <td style={{ ...td, textAlign: 'left', paddingLeft: 40, fontSize: 11, color: 'var(--text-muted)' }}>┗ {an.anuncio.replace(/\[[\d\/]+\]\s*/g, '').trim()}</td>
                        <td style={{ ...tdM, fontSize: 11, color: 'var(--text-hint)' }}>–</td>
                        <td style={{ ...tdM, fontSize: 11 }}>{fmtNum(an.leads)}</td>
                        <td style={{ ...tdM, fontSize: 11, color: an.vendas > 0 ? 'var(--text-primary)' : '#CBD5E1' }}>{an.vendas || '–'}</td>
                        <td style={{ ...tdM, fontSize: 10, color: an.conversao_perc >= 1 ? 'var(--green)' : an.conversao_perc > 0 ? 'var(--amber)' : '#CBD5E1' }}>{an.conversao_perc > 0 ? `${an.conversao_perc.toFixed(1)}%` : '0%'}</td>
                        <td style={{ ...tdM, fontSize: 11, color: an.faturamento > 0 ? 'var(--blue-dark)' : '#CBD5E1' }}>{an.faturamento > 0 ? fmtBRL(an.faturamento) : '–'}</td>
                        <td colSpan={4} style={td}></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
