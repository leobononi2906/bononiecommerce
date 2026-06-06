import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import { useCampanhas, useMetaAds, useCampanhaSubgrupos } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col, FunnelBar } from '../components/layout'
import { PeriodSelector } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct } from '../lib/fmt'
import type { Periodo } from '../types'

// Shorten long campaign names
function shortCamp(name: string, maxLen = 30): string {
  const clean = name.replace(/\[[\d\/]+\]\s*/g, '').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean
}

export default function Campanhas() {
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual')
  const { data: campanhas, loading: lcamp } = useCampanhas(periodo)
  const { data: metaAds, loading: lmeta } = useMetaAds(periodo)
  const { data: campSubgrupos } = useCampanhaSubgrupos()

  const kpis = useMemo(() => {
    if (!metaAds) return null
    const invest = metaAds.reduce((s, r) => s + r.investimento, 0)
    const leads  = metaAds.reduce((s, r) => s + r.leads, 0)
    const impres = metaAds.reduce((s, r) => s + r.impressoes, 0)
    const clicks = metaAds.reduce((s, r) => s + r.cliques, 0)
    const cpl    = leads > 0 ? invest / leads : 0
    const ctr    = impres > 0 ? (clicks / impres) * 100 : 0
    return { invest, leads, cpl, ctr, impres, clicks }
  }, [metaAds])

  // Aggregate by campaign name
  const byCampanha = useMemo(() => {
    if (!campanhas) return []
    const map = new Map<string, { invest: number; leads: number; receita: number; impressoes: number; cliques: number }>()
    campanhas.forEach(c => {
      const k = c.campanha
      const cur = map.get(k) || { invest: 0, leads: 0, receita: 0, impressoes: 0, cliques: 0 }
      cur.invest += c.investimento
      cur.leads += c.leads_umbler
      cur.receita += c.receita_gerada
      cur.impressoes += c.impressoes
      cur.cliques += c.cliques
      map.set(k, cur)
    })
    return [...map.entries()].map(([nome, d]) => ({
      nome,
      short: shortCamp(nome),
      invest: d.invest,
      leads: d.leads,
      receita: d.receita,
      roas: d.invest > 0 ? d.receita / d.invest : 0,
      cpl: d.leads > 0 ? d.invest / d.leads : 0,
      ctr: d.impressoes > 0 ? (d.cliques / d.impressoes) * 100 : 0,
    })).sort((a, b) => b.leads - a.leads)
  }, [campanhas])

  // Daily evolution
  const dailyData = useMemo(() => {
    if (!metaAds) return []
    const map = new Map<string, { invest: number; leads: number; impressoes: number; cliques: number }>()
    metaAds.forEach(r => {
      const cur = map.get(r.data) || { invest: 0, leads: 0, impressoes: 0, cliques: 0 }
      cur.invest += r.investimento
      cur.leads += r.leads
      cur.impressoes += r.impressoes
      cur.cliques += r.cliques
      map.set(r.data, cur)
    })
    return [...map.entries()].sort().map(([data, d]) => ({ data: data.slice(5), ...d }))
  }, [metaAds])

  // Campaign x subgroup mapping
  const campSubMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    campSubgrupos?.forEach(cs => {
      if (!m[cs.campanha]) m[cs.campanha] = []
      m[cs.campanha].push(cs.subgrupo_produto)
    })
    return m
  }, [campSubgrupos])

  const badgeType = (roas: number) => roas >= 40 ? 'ok' : roas >= 20 ? 'warn' : 'err'

  if (lcamp || lmeta) return <Spinner />

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <PageHeader title="Campanhas Meta Ads">
        <PeriodSelector value={periodo} onChange={setPeriodo} />
      </PageHeader>

      <SectionLabel>Performance geral</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Investimento" value={fmtBRL(kpis?.invest)} highlight />
        <KpiCard label="Leads gerados" value={fmtNum(kpis?.leads)} sub={`CPL: ${fmtBRL(kpis?.cpl)}`} />
        <KpiCard label="Impressões" value={fmtNum(kpis?.impres)} />
        <KpiCard label="CTR médio" value={fmtPct(kpis?.ctr, 2)} />
      </KpiGrid>

      <Row>
        <Col flex={5}>
          <Card>
            <CardTitle>Funil completo</CardTitle>
            <div style={{ marginTop: 8 }}>
              <FunnelBar label="Impressões" value={kpis?.impres ?? 0} total={kpis?.impres ?? 1} color="#E2E8F0" />
              <FunnelBar label="Cliques" value={kpis?.clicks ?? 0} total={kpis?.impres ?? 1} color="#93C5FD" />
              <FunnelBar label="Leads WA" value={kpis?.leads ?? 0} total={kpis?.impres ?? 1} color="var(--blue-mid)" />
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 600 }}>CTR</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--blue-dark)' }}>{fmtPct(kpis?.ctr, 2)}</div>
              </div>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 600 }}>Lead rate</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--blue-dark)' }}>{fmtPct(kpis?.impres && kpis?.leads ? (kpis.leads / kpis.impres) * 100 : 0, 2)}</div>
              </div>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 600 }}>CPL</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--blue-dark)' }}>{fmtBRL(kpis?.cpl)}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col flex={7}>
          <Card>
            <CardTitle>Investimento × leads diários</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(0, Math.floor(dailyData.length / 8) - 1)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="invest" name="Investimento R$" stroke="var(--blue-dark)" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="var(--blue-light)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <CardTitle>Ranking de campanhas</CardTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Campanha','Produtos vinculados','Investimento','Leads','CPL','CTR','ROAS'].map((h,i) => (
                <th key={i} style={{ textAlign: i<2?'left':'right', padding: '5px 8px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byCampanha.map((c, i) => {
              const subs = campSubMap[c.nome] || []
              return (
                <tr key={i} style={{ borderBottom: i < byCampanha.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '8px 8px', maxWidth: 220 }}>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>{c.short}</div>
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {subs.length > 0
                        ? subs.map(s => <Badge key={s} value={s} type="info" />)
                        : <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>–</span>
                      }
                    </div>
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono', fontSize: 12 }}>{fmtBRL(c.invest)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{c.leads}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{c.cpl > 0 ? fmtBRL(c.cpl) : '–'}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtPct(c.ctr, 2)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                    <Badge value={c.roas > 0 ? `${c.roas.toFixed(1)}x` : '–'} type={c.roas > 0 ? badgeType(c.roas) : 'neutral'} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardTitle>Leads por campanha — comparativo</CardTitle>
        <ResponsiveContainer width="100%" height={Math.max(160, byCampanha.length * 28)}>
          <BarChart data={byCampanha.slice(0,10)} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis type="category" dataKey="short" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={160} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="leads" name="Leads" fill="var(--blue-mid)" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
