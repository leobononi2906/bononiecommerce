import React, { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ShoppingBag } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useMarketplaceCanais, useMarketplace6Meses, useMarketplaceProdutos6Meses, MKT_CANAIS } from '../hooks/useData'
import type { MktCanal } from '../hooks/useData'
import { KpiCard, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import SparklineCell from '../components/campaigns/SparklineCell'
import { fmtBRL, fmtNum } from '../lib/fmt'
import { usePeriodo } from '../components/layout/AppShell'
import type { Periodo } from '../types'

const PERIODO_LABEL: Record<Periodo, string> = {
  mes_atual: 'mês atual', mes_anterior: 'mês anterior',
  '3_meses': 'últimos 3 meses', '6_meses': 'últimos 6 meses',
}
const PERIODO_ANT: Record<Periodo, string> = {
  mes_atual: 'mês anterior', mes_anterior: 'mês retrasado',
  '3_meses': '3 meses anteriores', '6_meses': '6 meses anteriores',
}

// Nome curto e amigável para o canal
function labelCanal(nome: string): string {
  return nome
    .replace(/^ML BONONI FULL$/, 'ML Full')
    .replace(/^ML BONONI$/, 'ML Bononi')
    .replace(/^ML BATTOGO$/, 'ML Battogo')
    .replace(/^SHOPEE BRASIL$/, 'Shopee')
    .replace(/^ML /, 'ML ')
}

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function mesInfo(iso: string): { label: string; sortKey: string } {
  const d = new Date(iso + 'T12:00:00')
  const label = MESES_ABREV[d.getMonth()] + '/' + String(d.getFullYear()).slice(2)
  return { label, sortKey: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
}

// Últimos 6 meses (incluindo o atual), como colunas fixas da tabela de produtos.
function last6Months(): { sortKey: string; label: string }[] {
  const now = new Date()
  const out: { sortKey: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ sortKey: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: MESES_ABREV[m.getMonth()] + '/' + String(m.getFullYear()).slice(2) })
  }
  return out
}

// ▲ +R$ 12k (+8%)  /  ▼ -R$ 5k (-12%)  /  – sem base
function DeltaTag({ deltaRs, deltaPct, ant }: { deltaRs: number; deltaPct: number | null; ant: number }) {
  if (ant === 0 && deltaRs === 0) return <span style={{ color: 'var(--text-hint)', fontSize: 12 }}>–</span>
  const up = deltaRs >= 0
  const color = up ? 'var(--green)' : 'var(--red)'
  const Icon = deltaRs === 0 ? Minus : up ? TrendingUp : TrendingDown
  const sinal = up ? '+' : '−'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontWeight: 600, fontSize: 12.5, fontFamily: 'DM Mono, monospace' }}>
      <Icon size={13} />
      {sinal}{fmtBRL(Math.abs(deltaRs))}
      {deltaPct != null && <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}>({sinal}{Math.abs(deltaPct).toFixed(0)}%)</span>}
      {ant === 0 && <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}>(novo)</span>}
    </span>
  )
}

const COLORS = ['#1A3A8F', '#0077CC', '#00AAEE', '#60A5FA', '#93C5FD', '#C7DBF5']

export default function Marketplace() {
  const { periodo } = usePeriodo()
  const { data, loading, error } = useMarketplaceCanais(periodo)
  const { data: seis, loading: l6 } = useMarketplace6Meses()
  const { data: prodRows, loading: lprod } = useMarketplaceProdutos6Meses()
  const [canalSel, setCanalSel] = useState<number | 'ALL'>('ALL')
  const [metric, setMetric] = useState<'fat' | 'qtd'>('fat')

  const canais: MktCanal[] = data?.canais ?? []
  const totalAtual = data?.totalAtual ?? 0
  const totalAnt = data?.totalAnt ?? 0
  const deltaTotal = totalAtual - totalAnt
  const pctTotal = totalAnt > 0 ? (deltaTotal / totalAnt) * 100 : null
  const pedidosTotal = canais.reduce((s, c) => s + c.pedidosAtual, 0)
  const devTotal = canais.reduce((s, c) => s + c.devAtual, 0)

  // Maior alta / maior queda por impacto em R$
  const comBase = canais.filter(c => c.fatAnt > 0 || c.fatAtual > 0)
  const maiorAlta = [...comBase].sort((a, b) => b.deltaRs - a.deltaRs)[0]
  const maiorQueda = [...comBase].sort((a, b) => a.deltaRs - b.deltaRs)[0]

  // Aviso de mês em andamento: comparar mês parcial com mês cheio distorce o "cai"
  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const mesParcial = periodo === 'mes_atual' && diaAtual < diasNoMes

  // Série mensal por canal (6 meses) + sparkline por canal
  const { chartData, chartCanais, sparkByCanal } = useMemo(() => {
    if (!seis) return { chartData: [] as any[], chartCanais: [] as string[], sparkByCanal: new Map<string, number[]>() }
    const byMes = new Map<string, { label: string; canais: Record<string, number> }>()
    const totCanal = new Map<string, number>()
    seis.forEach(r => {
      const { label, sortKey } = mesInfo(r.data_faturamento)
      if (!byMes.has(sortKey)) byMes.set(sortKey, { label, canais: {} })
      const e = byMes.get(sortKey)!
      e.canais[r.canal] = (e.canais[r.canal] || 0) + r.fat
      totCanal.set(r.canal, (totCanal.get(r.canal) || 0) + r.fat)
    })
    const sortKeys = [...byMes.keys()].sort()
    const chartCanais = [...totCanal.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    const chartData = sortKeys.map(k => {
      const e = byMes.get(k)!
      const row: any = { mes: e.label }
      chartCanais.forEach(c => { row[labelCanal(c)] = e.canais[c] || 0 })
      return row
    })
    const sparkByCanal = new Map<string, number[]>()
    chartCanais.forEach(c => sparkByCanal.set(c, sortKeys.map(k => byMes.get(k)!.canais[c] || 0)))
    return { chartData, chartCanais, sparkByCanal }
  }, [seis])

  // Tabela de produtos: pivô produto × últimos 6 meses (filtrado por canal + métrica)
  const meses6 = useMemo(() => last6Months(), [])
  const produtos = useMemo(() => {
    const rows = (prodRows ?? []).filter(r => canalSel === 'ALL' || r.canalId === canalSel)
    const map = new Map<string, { referencia: string; produto: string; porMes: Record<string, number>; total: number }>()
    rows.forEach(r => {
      const val = metric === 'fat' ? r.fat : r.qtd
      const e = map.get(r.referencia) || { referencia: r.referencia, produto: r.produto, porMes: {}, total: 0 }
      e.porMes[r.mes] = (e.porMes[r.mes] || 0) + val
      e.total += val
      if ((!e.produto || e.produto === '—') && r.produto) e.produto = r.produto
      map.set(r.referencia, e)
    })
    return [...map.values()].filter(p => p.total > 0).sort((a, b) => b.total - a.total)
  }, [prodRows, canalSel, metric])

  const fmtVal = (v: number) => metric === 'fat' ? fmtBRL(v) : fmtNum(v)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
      <PageHeader title="Marketplace">
        <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>
          Desempenho por canal · {PERIODO_LABEL[periodo]} vs {PERIODO_ANT[periodo]}
        </span>
      </PageHeader>

      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #F5C2C2', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
          Erro ao carregar dados: {error}
        </div>
      )}

      {mesParcial && !loading && canais.length > 0 && (
        <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid #FCE3B0', borderRadius: 'var(--radius)', padding: '9px 14px', marginBottom: 14, fontSize: 12.5 }}>
          📅 Mês em andamento ({diaAtual}/{diasNoMes} dias) — a comparação é com o mês anterior <strong>cheio</strong>, então as quedas são esperadas. Para comparar meses fechados, escolha "Mês anterior" no filtro.
        </div>
      )}

      {loading ? <Spinner /> : canais.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: 13 }}>
          <ShoppingBag size={26} color="var(--text-hint)" style={{ marginBottom: 8 }} /><br />
          Nenhuma venda de marketplace no período selecionado.
        </div>
      ) : (
        <>
          <SectionLabel>Resumo — {PERIODO_LABEL[periodo]}</SectionLabel>
          <KpiGrid cols={4}>
            <KpiCard label="Total Marketplace (líq.)" value={fmtBRL(totalAtual)} highlight
              sub={devTotal > 0
                ? `líquido · devol. ${fmtBRL(devTotal)}` + (pctTotal != null ? ` · ${deltaTotal >= 0 ? '+' : '−'}${Math.abs(pctTotal).toFixed(0)}% vs ant.` : '')
                : (pctTotal != null ? `${deltaTotal >= 0 ? '+' : '−'}${fmtBRL(Math.abs(deltaTotal))} (${deltaTotal >= 0 ? '+' : '−'}${Math.abs(pctTotal).toFixed(0)}%) vs anterior` : 'sem base anterior')}
              trend={deltaTotal > 0 ? 'up' : deltaTotal < 0 ? 'down' : 'neutral'} />
            <KpiCard label="Pedidos (período)" value={fmtNum(pedidosTotal)} />
            <KpiCard label="Maior alta" value={maiorAlta && maiorAlta.deltaRs > 0 ? labelCanal(maiorAlta.nome) : '–'}
              sub={maiorAlta && maiorAlta.deltaRs > 0 ? `+${fmtBRL(maiorAlta.deltaRs)}` : 'nenhum canal subiu'}
              trend={maiorAlta && maiorAlta.deltaRs > 0 ? 'up' : 'neutral'} />
            <KpiCard label="Maior queda" value={maiorQueda && maiorQueda.deltaRs < 0 ? labelCanal(maiorQueda.nome) : '–'}
              sub={maiorQueda && maiorQueda.deltaRs < 0 ? `−${fmtBRL(Math.abs(maiorQueda.deltaRs))}` : 'nenhum canal caiu'}
              trend={maiorQueda && maiorQueda.deltaRs < 0 ? 'down' : 'neutral'} />
          </KpiGrid>

          <SectionLabel>Por canal — o que cresce e o que cai</SectionLabel>
          <Card style={{ marginBottom: 16 }}>
            <div className="ecom-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                <thead><tr>
                  {['Canal', 'Faturamento (líq.)', 'Devolução', 'Pedidos', 'Ticket', 'vs anterior', 'Tendência 6m'].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 0 ? 'left' : (h === 'vs anterior' || h === 'Tendência 6m') ? 'center' : 'right', padding: '6px 10px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {canais.map((c, i) => (
                    <tr key={c.nome} style={{ borderBottom: i < canais.length - 1 ? '1px solid var(--border)' : 'none', background: c.deltaRs > 0 ? 'rgba(22,163,74,0.04)' : c.deltaRs < 0 ? 'rgba(220,38,38,0.04)' : 'transparent' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--blue-dark)' }}>{labelCanal(c.nome)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{fmtBRL(c.fatAtual)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: c.devAtual > 0 ? 'var(--red)' : 'var(--text-hint)' }}>{c.devAtual > 0 ? '− ' + fmtBRL(c.devAtual) : '–'}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{fmtNum(c.pedidosAtual)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{fmtBRL(c.ticketAtual)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}><DeltaTag deltaRs={c.deltaRs} deltaPct={c.deltaPct} ant={c.fatAnt} /></td>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <SparklineCell data={sparkByCanal.get(c.nome) ?? []} width={72} height={22} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtBRL(totalAtual)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: devTotal > 0 ? 'var(--red)' : 'var(--text-hint)' }}>{devTotal > 0 ? '− ' + fmtBRL(devTotal) : '–'}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{fmtNum(pedidosTotal)}</td>
                    <td />
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}><DeltaTag deltaRs={deltaTotal} deltaPct={pctTotal} ant={totalAnt} /></td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <SectionLabel>Faturamento por canal — últimos 6 meses</SectionLabel>
          <Row>
            <Col flex={1}>
              <Card>
                <CardTitle>Evolução mensal por marketplace</CardTitle>
                {l6 ? <Spinner /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={72} />
                      <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartCanais.map((c, i) => (
                        <Bar key={c} dataKey={labelCanal(c)} stackId="a" fill={COLORS[i % COLORS.length]}
                          radius={i === chartCanais.length - 1 ? [4, 4, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
          </Row>

          {/* ─── Vendas por produto ─────────────────────────── */}
          <SectionLabel>Vendas por produto — últimos 6 meses <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-hint)' }}>(bruto, sem descontar devolução)</span></SectionLabel>
          <Card>
            {/* Filtros: canal + métrica */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[{ v: 'ALL' as const, l: 'Todos' }, ...MKT_CANAIS.map(c => ({ v: c.id, l: c.label }))].map(opt => {
                  const active = canalSel === opt.v
                  return (
                    <button key={String(opt.v)} onClick={() => setCanalSel(opt.v)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${active ? 'var(--blue-dark)' : 'var(--border)'}`, background: active ? 'var(--blue-dark)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      {opt.l}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 3, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
                {([['fat', 'R$'], ['qtd', 'Qtd']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setMetric(v)}
                    style={{ padding: '4px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: metric === v ? 'var(--surface)' : 'transparent', color: metric === v ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: metric === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontFamily: 'DM Sans, sans-serif' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {lprod ? <Spinner /> : produtos.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>
                Nenhuma venda de produto neste canal nos últimos 6 meses.
              </div>
            ) : (
              <div className="ecom-scroll-x">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', position: 'sticky', left: 0, background: 'var(--surface)' }}>Produto</th>
                    {meses6.map(m => (
                      <th key={m.sortKey} style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{m.label}</th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '6px 10px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 700, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {produtos.map((p, i) => (
                      <tr key={p.referencia} style={{ borderBottom: i < produtos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '8px 10px', maxWidth: 260, position: 'sticky', left: 0, background: 'var(--surface)' }}>
                          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.produto}>{p.produto}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-hint)', fontFamily: 'DM Mono, monospace' }}>{p.referencia}</div>
                        </td>
                        {meses6.map(m => {
                          const v = p.porMes[m.sortKey] || 0
                          return <td key={m.sortKey} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: v > 0 ? 'var(--text-primary)' : 'var(--text-hint)' }}>{v > 0 ? fmtVal(v) : '·'}</td>
                        })}
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtVal(p.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F8FAFC' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, position: 'sticky', left: 0, background: '#F8FAFC' }}>Total ({produtos.length} produtos)</td>
                      {meses6.map(m => {
                        const tot = produtos.reduce((s, p) => s + (p.porMes[m.sortKey] || 0), 0)
                        return <td key={m.sortKey} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{tot > 0 ? fmtVal(tot) : '·'}</td>
                      })}
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtVal(produtos.reduce((s, p) => s + p.total, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
