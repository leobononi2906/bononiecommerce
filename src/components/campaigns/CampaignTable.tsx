import { useState } from 'react'
import { ChevronRight, AlertTriangle, TrendingUp, Pause, Eye } from 'lucide-react'
import { fmtBRL, fmtNum } from '../../lib/fmt'
import type { CampaignAnalysis, CampaignVerdict } from '../../types/campaigns'
import type { CampaignDetail } from '../../hooks/use-campaigns'
import SparklineCell from './SparklineCell'

const VERDICT_CONFIG: Record<CampaignVerdict, { bg: string; fg: string; icon: React.ReactNode; label: string }> = {
  ESCALAR:   { bg: '#DCFCE7', fg: '#16A34A', icon: <TrendingUp size={12} />, label: 'ESCALAR' },
  MANTER:    { bg: '#EFF6FF', fg: '#1A3A8F', icon: <Eye size={12} />,        label: 'MANTER' },
  MONITORAR: { bg: '#FEF3C7', fg: '#D97706', icon: <AlertTriangle size={12} />, label: 'MONITORAR' },
  PAUSAR:    { bg: '#FEE2E2', fg: '#DC2626', icon: <Pause size={12} />,      label: 'PAUSAR' },
}

const FILTERS: { label: string; value: CampaignVerdict | 'TODOS' }[] = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Escalar', value: 'ESCALAR' },
  { label: 'Manter', value: 'MANTER' },
  { label: 'Monitorar', value: 'MONITORAR' },
  { label: 'Pausar', value: 'PAUSAR' },
]

interface Props {
  campaigns: CampaignAnalysis[]
  details: CampaignDetail[]
  summary: { total: number; escalar: number; manter: number; monitorar: number; pausar: number }
}

export default function CampaignTable({ campaigns, details, summary }: Props) {
  const [filter, setFilter] = useState<CampaignVerdict | 'TODOS'>('TODOS')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = filter === 'TODOS' ? campaigns : campaigns.filter(c => c.verdict === filter)
  const maxSpend = Math.max(...campaigns.map(c => c.spend), 1)

  function toggle(campanha: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(campanha) ? next.delete(campanha) : next.add(campanha)
      return next
    })
  }

  function getDetails(campanha: string) {
    // Agrupa por conjunto
    const rows = details.filter(d => d.campanha === campanha)
    const conjuntos = new Map<string, { leads: number; vendas: number; faturamento: number; conv: number; anuncios: CampaignDetail[] }>()
    rows.forEach(r => {
      const cur = conjuntos.get(r.conjunto) || { leads: 0, vendas: 0, faturamento: 0, conv: 0, anuncios: [] }
      cur.leads += r.leads
      cur.vendas += r.vendas
      cur.faturamento += r.faturamento
      cur.anuncios.push(r)
      conjuntos.set(r.conjunto, cur)
    })
    conjuntos.forEach(v => { v.conv = v.leads > 0 ? (v.vendas / v.leads) * 100 : 0 })
    return [...conjuntos.entries()].sort((a, b) => b[1].leads - a[1].leads)
  }

  // Alerta principal: campanhas que precisam de ação urgente
  const urgentes = campaigns.filter(c => c.verdict === 'PAUSAR' && c.spend > 500)

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Alerta urgente */}
      {urgentes.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
          <AlertTriangle size={14} color="#DC2626" />
          <span className="text-[13px] font-semibold" style={{ color: '#DC2626' }}>
            {urgentes.length} campanha{urgentes.length > 1 ? 's' : ''} queimando dinheiro — {urgentes.map(c => c.shortName).join(', ')}
          </span>
        </div>
      )}

      {/* Header com resumo e filtros */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-txt">{summary.total} campanhas</span>
          <div className="flex gap-1">
            {([
              { n: summary.escalar,   v: 'ESCALAR' as CampaignVerdict },
              { n: summary.manter,    v: 'MANTER' as CampaignVerdict },
              { n: summary.monitorar, v: 'MONITORAR' as CampaignVerdict },
              { n: summary.pausar,    v: 'PAUSAR' as CampaignVerdict },
            ]).map(({ n, v }) => {
              const vc = VERDICT_CONFIG[v]
              return (
                <span key={v} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer"
                  style={{ background: vc.bg, color: vc.fg }}
                  onClick={() => setFilter(filter === v ? 'TODOS' : v)}>
                  {vc.icon} {n}
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex gap-0.5 bg-[#F1F5F9] p-0.5 rounded-lg">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                filter === f.value ? 'bg-surface text-blue-dark shadow-sm' : 'text-txt-muted'
              }`} style={{ fontFamily: 'DM Sans', cursor: 'pointer', border: 'none' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#1A3A8F', color: '#fff' }}>
            {['', 'Campanha', 'Investido', 'Leads', 'Vendas', 'Conv.', 'Faturado', 'ROAS', 'CPA', '', 'Veredicto'].map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ textAlign: i === 0 || i === 1 ? 'left' : 'right', fontFamily: 'DM Sans', width: i === 0 ? 28 : undefined }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={11} className="text-center text-txt-muted py-8 text-sm">Nenhuma campanha com esse filtro.</td></tr>
          ) : filtered.map((c) => {
            const vc = VERDICT_CONFIG[c.verdict]
            const barW = (c.spend / maxSpend) * 100
            const isOpen = expanded.has(c.campanha)
            const hasDetails = details.some(d => d.campanha === c.campanha)
            const rowBg = c.verdict === 'PAUSAR' ? '#FEF2F208' : c.verdict === 'ESCALAR' ? '#DCFCE708' : 'transparent'

            return (
              <>
                {/* Campanha row */}
                <tr key={c.campanha}
                  className="border-b border-border hover:bg-[#FAFBFC]"
                  style={{ fontFamily: 'DM Sans', background: rowBg, cursor: hasDetails ? 'pointer' : 'default' }}
                  onClick={() => hasDetails && toggle(c.campanha)}>
                  {/* Expand arrow */}
                  <td className="px-2 py-2.5 text-center" style={{ width: 28 }}>
                    {hasDetails && (
                      <ChevronRight size={14} style={{
                        color: 'var(--text-hint)',
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                      }} />
                    )}
                  </td>
                  {/* Nome + barra */}
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <div className="text-[13px] font-medium text-txt">{c.shortName}</div>
                    {c.subgrupos.length > 0 && (
                      <div className="mt-0.5 flex gap-1 flex-wrap">
                        {c.subgrupos.map(s => (
                          <span key={s} className="text-[10px] font-semibold px-1.5 rounded-full"
                            style={{ background: '#EFF6FF', color: '#1A3A8F' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full" style={{ width: `${barW}%`, background: vc.fg, opacity: 0.4 }} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold">{fmtBRL(c.spend)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px]">{fmtNum(c.leads)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[14px] font-bold"
                    style={{ color: c.vendas > 0 ? '#0F172A' : '#94A3B8' }}>
                    {c.vendas > 0 ? c.vendas : '–'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold"
                    style={{ color: c.conversao >= 1 ? '#16A34A' : c.conversao > 0 ? '#D97706' : '#94A3B8' }}>
                    {c.conversao > 0 ? `${c.conversao.toFixed(1)}%` : '0%'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[14px] font-bold"
                    style={{ color: c.revenue > 0 ? '#1A3A8F' : '#94A3B8' }}>
                    {c.revenue > 0 ? fmtBRL(c.revenue) : '–'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[14px] font-bold"
                    style={{ color: vc.fg }}>
                    {c.roas > 0 ? `${c.roas.toFixed(1)}x` : '–'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]"
                    style={{ color: c.cpa > 5000 ? '#DC2626' : '#64748B' }}>
                    {c.cpa > 0 ? fmtBRL(c.cpa) : '–'}
                  </td>
                  <td className="px-3 py-2.5 text-right"><SparklineCell data={c.sparkline} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: vc.bg, color: vc.fg }}>
                      {vc.icon} {vc.label}
                    </span>
                  </td>
                </tr>

                {/* Expanded: conjunto + anúncio rows */}
                {isOpen && getDetails(c.campanha).map(([conjunto, cj]) => (
                  <>
                    {/* Conjunto row */}
                    <tr key={`${c.campanha}|${conjunto}`} style={{ background: '#F8FAFC', fontFamily: 'DM Sans' }} className="border-b border-border">
                      <td></td>
                      <td className="px-3 py-2 text-[12px] font-semibold" style={{ color: '#1A3A8F', paddingLeft: 28 }}>
                        ┣ {conjunto.replace(/\[[\d\/]+\]\s*/g, '').trim()}
                      </td>
                      <td className="px-3 py-2 text-right text-[12px] text-txt-muted">–</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold">{fmtNum(cj.leads)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-bold"
                        style={{ color: cj.vendas > 0 ? '#0F172A' : '#94A3B8' }}>{cj.vendas || '–'}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px]"
                        style={{ color: cj.conv >= 1 ? '#16A34A' : cj.conv > 0 ? '#D97706' : '#94A3B8' }}>
                        {cj.conv > 0 ? `${cj.conv.toFixed(1)}%` : '0%'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold"
                        style={{ color: cj.faturamento > 0 ? '#1A3A8F' : '#94A3B8' }}>
                        {cj.faturamento > 0 ? fmtBRL(cj.faturamento) : '–'}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                    {/* Anúncio rows */}
                    {cj.anuncios.map((an, ai) => (
                      <tr key={`${c.campanha}|${conjunto}|${ai}`} style={{ background: '#FAFBFC', fontFamily: 'DM Sans' }} className="border-b border-border">
                        <td></td>
                        <td className="px-3 py-1.5 text-[11px] text-txt-muted" style={{ paddingLeft: 44 }}>
                          ┗ {an.anuncio.replace(/\[[\d\/]+\]\s*/g, '').trim()}
                        </td>
                        <td className="px-3 py-1.5 text-right text-[11px] text-txt-hint">–</td>
                        <td className="px-3 py-1.5 text-right font-mono text-[11px]">{fmtNum(an.leads)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold"
                          style={{ color: an.vendas > 0 ? '#0F172A' : '#CBD5E1' }}>{an.vendas || '–'}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-[11px]"
                          style={{ color: an.conversao_perc >= 1 ? '#16A34A' : an.conversao_perc > 0 ? '#D97706' : '#CBD5E1' }}>
                          {an.conversao_perc > 0 ? `${an.conversao_perc.toFixed(1)}%` : '0%'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-[11px]"
                          style={{ color: an.faturamento > 0 ? '#1A3A8F' : '#CBD5E1' }}>
                          {an.faturamento > 0 ? fmtBRL(an.faturamento) : '–'}
                        </td>
                        <td colSpan={4}></td>
                      </tr>
                    ))}
                  </>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
