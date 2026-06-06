import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useMarketplace } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { PeriodSelector } from '../components/layout'
import { fmtBRL, fmtPct, shortName } from '../lib/fmt'
import type { Periodo } from '../types'

export default function Marketplace() {
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual')
  const { data: mkt, loading } = useMarketplace(periodo)

  const kpis = useMemo(() => {
    if (!mkt) return null
    const bruto    = mkt.reduce((s, r) => s + r.faturamento_bruto, 0)
    const taxa     = mkt.reduce((s, r) => s + (r.taxa_total ?? r.taxa_marketplace ?? 0), 0)
    const liquido  = mkt.reduce((s, r) => s + r.faturamento_liquido, 0)
    const custo    = mkt.reduce((s, r) => s + r.custo_total, 0)
    const margem   = liquido > 0 ? ((liquido - custo) / liquido) * 100 : 0
    return { bruto, taxa, liquido, custo, margem }
  }, [mkt])

  const porVendedor = useMemo(() => {
    if (!mkt) return []
    const map = new Map<string, { bruto: number; taxa: number; liquido: number; custo: number }>()
    mkt.forEach(r => {
      const k = shortName(r.nome_vendedor)
      const cur = map.get(k) || { bruto: 0, taxa: 0, liquido: 0, custo: 0 }
      cur.bruto += r.faturamento_bruto
      cur.taxa += r.taxa_marketplace
      cur.liquido += r.faturamento_liquido
      cur.custo += r.custo_total
      map.set(k, cur)
    })
    return [...map.entries()].map(([nome, d]) => ({
      nome,
      bruto: d.bruto,
      taxa: d.taxa,
      liquido: d.liquido,
      margem: d.liquido > 0 ? ((d.liquido - d.custo) / d.liquido) * 100 : 0,
    })).sort((a, b) => b.bruto - a.bruto)
  }, [mkt])

  const barData = porVendedor.map(v => ({
    nome: v.nome,
    'Fat. bruto': Math.round(v.bruto),
    'Fat. líquido': Math.round(v.liquido),
    'Taxa': Math.round(v.taxa),
  }))

  const badgeMargem = (m: number) => m >= 28 ? 'ok' : m >= 22 ? 'warn' : 'err'

  if (loading) return <Spinner />

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <PageHeader title="Marketplace">
        <PeriodSelector value={periodo} onChange={setPeriodo} />
      </PageHeader>

      <SectionLabel>KPIs marketplace</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Fat. bruto" value={fmtBRL(kpis?.bruto)} highlight />
        <KpiCard label="Taxa canal" value={fmtBRL(kpis?.taxa)} sub="Custo do canal" trend="down" />
        <KpiCard label="Fat. líquido" value={fmtBRL(kpis?.liquido)} trend="up" />
        <KpiCard label="Margem líquida" value={fmtPct(kpis?.margem)} trend={kpis && kpis.margem >= 25 ? 'up' : 'down'} />
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Bruto vs líquido vs taxa — por vendedor</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={72} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Fat. bruto" fill="#1A3A8F" radius={[4,4,0,0]} opacity={0.7} />
                <Bar dataKey="Fat. líquido" fill="#0077CC" radius={[4,4,0,0]} />
                <Bar dataKey="Taxa" fill="#FCA5A5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Ranking por vendedor</CardTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Vendedor','Bruto','Líquido','Margem'].map((h,i) => (
                    <th key={i} style={{ textAlign: i<1?'left':'right', padding: '4px 6px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porVendedor.map((v, i) => (
                  <tr key={i} style={{ borderBottom: i < porVendedor.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '7px 6px', fontWeight: 500 }}>{v.nome}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono', fontSize: 12 }}>{fmtBRL(v.bruto)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono', fontSize: 12 }}>{fmtBRL(v.liquido)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>
                      <Badge value={fmtPct(v.margem)} type={badgeMargem(v.margem)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardTitle>Todos os registros — detalhe completo</CardTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Vendedor','Fat. bruto','Taxa 22%','Fat. líquido','Custo produtos','Margem líq.','Margem %'].map((h,i) => (
                  <th key={i} style={{ textAlign: i<1?'left':'right', padding: '5px 8px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mkt?.map((r, i) => (
                <tr key={i} style={{ borderBottom: i < (mkt.length-1) ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 500 }}>{shortName(r.nome_vendedor)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtBRL(r.faturamento_bruto)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'DM Mono', color: 'var(--red)' }}>{fmtBRL(r.taxa_marketplace)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtBRL(r.faturamento_liquido)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtBRL(r.custo_total)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'DM Mono' }}>{fmtBRL(r.margem_liquida)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                    <Badge value={fmtPct(r.margem_liquida_perc)} type={badgeMargem(r.margem_liquida_perc)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
