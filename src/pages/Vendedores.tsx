import React, { useMemo, useEffect, useState } from 'react'
import { useVendedores, useEsperaVendedor, useUmblerVendedores } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel, AlertBanner } from '../components/ui'
import { PageHeader, KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct, fmtMinutes, shortName } from '../lib/fmt'
import { RefreshCw, AlertTriangle } from 'lucide-react'

export default function Vendedores() {
  const { data: vendedores, loading: lvend } = useVendedores()
  const { data: espera, loading: lespera } = useEsperaVendedor()
  const { data: umblerVend } = useUmblerVendedores()
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
      window.location.reload()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const idToName = useMemo(() => {
    const m: Record<string, string> = {}
    umblerVend?.forEach(v => { m[v.id_membro_umbler] = shortName(v.nome_vendedor_erp) })
    return m
  }, [umblerVend])

  const ranked = useMemo(() => {
    if (!vendedores) return []
    return [...vendedores]
      .filter(v => v.departamento?.includes('ECOMMERCE'))
      .sort((a, b) => b.faturamento_erp - a.faturamento_erp)
  }, [vendedores])

  const maxFat = ranked[0]?.faturamento_erp ?? 1

  const kpis = useMemo(() => {
    if (!vendedores) return null
    const total = vendedores.reduce((s, v) => s + v.faturamento_erp, 0)
    const leads = vendedores.reduce((s, v) => s + v.leads_atendidos, 0)
    const docs  = vendedores.reduce((s, v) => s + v.qtd_docs, 0)
    const conv  = leads > 0 ? (docs / leads) * 100 : 0
    return { total, leads, docs, conv }
  }, [vendedores])

  // Sellers with tempo > 60 min
  const tempoEspera = useMemo(() => {
    if (!espera) return []
    const map = new Map<string, number>()
    espera.forEach(e => {
      const nome = idToName[e.id_vendedor] || shortName(e.nome_vendedor)
      const cur = map.get(nome) || 0
      map.set(nome, Math.max(cur, e.tempo_medio_min))
    })
    return [...map.entries()]
      .filter(([, t]) => t > 60)
      .sort((a, b) => b[1] - a[1])
  }, [espera, idToName])

  const medals = ['🥇', '🥈', '🥉']

  if (lvend || lespera) return <Spinner />

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <PageHeader title="Vendedores">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
            Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--blue-mid)', background: '#EFF6FF', padding: '4px 10px', borderRadius: 20 }}>
            <RefreshCw size={11} /> Auto 5min
          </span>
        </div>
      </PageHeader>

      <KpiGrid cols={3}>
        <KpiCard label="Faturamento total" value={fmtBRL(kpis?.total)} highlight />
        <KpiCard label="Leads atendidos" value={fmtNum(kpis?.leads)} />
        <KpiCard label="Conversão geral" value={fmtPct(kpis?.conv)} sub={`${fmtNum(kpis?.docs)} pedidos`} />
      </KpiGrid>

      {tempoEspera.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>Atenção — tempo médio alto</SectionLabel>
          {tempoEspera.map(([nome, tempo]) => (
            <AlertBanner key={nome} type="warning">
              <AlertTriangle size={12} color="var(--amber)" />
              <span style={{ fontWeight: 600, color: 'var(--amber)' }}>{nome}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>tempo médio de início: {fmtMinutes(tempo)}</span>
            </AlertBanner>
          ))}
        </div>
      )}

      <Card>
        <CardTitle>Ranking — faturamento ({ranked.length} vendedores)</CardTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {ranked.map((v, i) => {
            const pct = maxFat > 0 ? (v.faturamento_erp / maxFat) * 100 : 0
            const isTop = i === 0
            return (
              <div key={v.id_vendedor_erp} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${isTop ? 'var(--blue-dark)' : 'var(--border)'}`,
                background: isTop ? 'linear-gradient(135deg, #1A3A8F08, #0077CC10)' : 'var(--surface)',
                transition: 'all 0.2s',
              }}>
                <div style={{ width: 32, textAlign: 'center' }}>
                  {i < 3
                    ? <span style={{ fontSize: 20 }}>{medals[i]}</span>
                    : <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-hint)' }}>{i+1}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {shortName(v.nome_vendedor)}
                    {v.qtd_docs === 0 && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 10 }}>sync pendente</span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isTop ? 'var(--blue-dark)' : 'var(--blue-mid)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono', color: isTop ? 'var(--blue-dark)' : 'var(--text-primary)' }}>
                    {fmtBRL(v.faturamento_erp)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {fmtNum(v.qtd_docs)} pedidos · {fmtNum(v.leads_atendidos)} leads
                  </div>
                </div>
                <div style={{ minWidth: 70, textAlign: 'right' }}>
                  <Badge
                    value={fmtPct(Math.min(v.taxa_conversao_perc, 999))}
                    type={v.taxa_conversao_perc >= 20 ? 'ok' : v.taxa_conversao_perc >= 10 ? 'warn' : v.qtd_docs === 0 ? 'neutral' : 'err'}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 3 }}>conversão</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card>
          <CardTitle>Detalhes — tempo médio de resposta</CardTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Vendedor','Leads','Pedidos ERP','Faturamento','Ticket médio','Tempo médio resp.'].map((h,i) => (
                  <th key={i} style={{ textAlign: i<1?'left':'right', padding: '5px 8px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((v, i) => (
                <tr key={i} style={{ borderBottom: i < ranked.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '8px 8px', fontWeight: 500 }}>{shortName(v.nome_vendedor)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtNum(v.leads_atendidos)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtNum(v.qtd_docs)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtBRL(v.faturamento_erp)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtBRL(v.ticket_medio)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'DM Mono', fontWeight: 600, color: v.tempo_medio_horas * 60 > 60 ? 'var(--red)' : v.tempo_medio_horas * 60 > 15 ? 'var(--amber)' : 'var(--green)' }}>
                      {fmtMinutes(v.tempo_medio_horas * 60)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
