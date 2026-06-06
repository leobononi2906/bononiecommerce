import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { useVendedores, useSubgrupos, useLeads, useFaturamento6Meses } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { PeriodSelector } from '../components/layout'
import { fmtBRL, fmtPct, fmtNum, mesAbrev, shortName } from '../lib/fmt'
import type { Periodo } from '../types'

export default function Home() {
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual')
  const { data: vendedores, loading: lvend } = useVendedores(periodo)
  const { data: subgrupos, loading: lsub } = useSubgrupos(periodo)
  const { data: leads, loading: lleads } = useLeads(periodo)
  const { data: fatRaw, loading: lfat } = useFaturamento6Meses()

  const kpis = useMemo(() => {
    if (!vendedores) return null
    const fat = vendedores.reduce((s, v) => s + v.faturamento_erp, 0)
    const docs = vendedores.reduce((s, v) => s + v.qtd_docs, 0)
    const ticket = docs > 0 ? fat / docs : 0
    return { fat, docs, ticket }
  }, [vendedores])

  const leadCount = leads?.length ?? 0

  const topSubgrupos = useMemo(() => {
    if (!subgrupos) return []
    const map = new Map<string, number>()
    subgrupos.forEach(s => map.set(s.subgrupo, (map.get(s.subgrupo) || 0) + s.faturamento))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, fat]) => ({ nome, fat }))
  }, [subgrupos])

  const topVendedores = useMemo(() => {
    if (!vendedores) return []
    return [...vendedores].sort((a, b) => b.faturamento_erp - a.faturamento_erp).slice(0, 5)
  }, [vendedores])

  // 6-month fat by vendor
  const fat6Vendedor = useMemo(() => {
    if (!fatRaw) return []
    const byMesVend: Record<string, Record<string, number>> = {}
    const meses = new Set<string>()
    const vendors = new Set<string>()
    fatRaw.forEach((r: any) => {
      const mes = mesAbrev(r.data_faturamento)
      const vend = shortName(r.nome_vendedor || '')
      meses.add(mes)
      vendors.add(vend)
      if (!byMesVend[mes]) byMesVend[mes] = {}
      byMesVend[mes][vend] = (byMesVend[mes][vend] || 0) + Number(r.faturamento_doc)
    })
    const mesesArr = [...meses].sort()
    return mesesArr.map(mes => ({ mes, ...byMesVend[mes] }))
  }, [fatRaw])

  const top5Vend = useMemo(() => {
    if (!fatRaw) return []
    const map = new Map<string, number>()
    fatRaw.forEach((r: any) => {
      const k = shortName(r.nome_vendedor || '')
      map.set(k, (map.get(k) || 0) + Number(r.faturamento_doc))
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)
  }, [fatRaw])

  const COLORS = ['#1A3A8F', '#0077CC', '#00AAEE', '#60A5FA', '#93C5FD']

  const fat6Depto = useMemo(() => {
    if (!fatRaw) return []
    const map: Record<string, Record<string, number>> = {}
    const meses = new Set<string>()
    fatRaw.forEach((r: any) => {
      const mes = mesAbrev(r.data_faturamento)
      meses.add(mes)
      const depto = (r.departamento as string) || 'Outros'
      if (!map[mes]) map[mes] = {}
      map[mes][depto] = (map[mes][depto] || 0) + Number(r.faturamento_doc)
    })
    return [...meses].sort().map(mes => ({ mes, ...map[mes] }))
  }, [fatRaw])

  const deptos = useMemo(() => {
    const s = new Set<string>()
    fatRaw?.forEach((r: any) => s.add((r.departamento as string) || 'Outros'))
    return [...s]
  }, [fatRaw])

  const DEPTO_COLORS: Record<string, string> = {
    'ECOMMERCE': '#1A3A8F',
    'ECOMMERCE MKT PLACE': '#0077CC',
    'ECOMMERCE SITE': '#00AAEE',
    'ADMINISTRATIVO': '#60A5FA',
    'DISTRIBUIDOR': '#93C5FD',
    'Outros': '#CBD5E1',
  }

  if (lvend || lsub || lleads) return <Spinner />

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <PageHeader title="Visão Geral">
        <PeriodSelector value={periodo} onChange={setPeriodo} />
      </PageHeader>

      <SectionLabel>KPIs de faturamento</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Faturamento total" value={fmtBRL(kpis?.fat)} icon="💰" highlight />
        <KpiCard label="Pedidos (ERP)" value={fmtNum(kpis?.docs)} icon="📦" />
        <KpiCard label="Ticket médio" value={fmtBRL(kpis?.ticket)} icon="🎫" />
        <KpiCard label="Leads (período)" value={fmtNum(leadCount)} icon="👥" />
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Top subgrupos — faturamento</CardTitle>
            {lsub ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topSubgrupos} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={70} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Bar dataKey="fat" name="Faturamento" fill="var(--blue-mid)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Top vendedores</CardTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['#','Vendedor','Fat.','Conv.%'].map((h,i) => (
                    <th key={i} style={{ textAlign: i<2?'left':'right', padding: '4px 6px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topVendedores.map((v, i) => (
                  <tr key={i} style={{ borderBottom: i < topVendedores.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '7px 6px', color: 'var(--text-hint)', fontSize: 11 }}>{i+1}</td>
                    <td style={{ padding: '7px 6px', fontWeight: 500 }}>{shortName(v.nome_vendedor)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{fmtBRL(v.faturamento_erp)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>
                      <Badge value={fmtPct(v.taxa_conversao_perc)} type={v.taxa_conversao_perc >= 20 ? 'ok' : v.taxa_conversao_perc >= 10 ? 'warn' : 'err'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>

      <SectionLabel>Faturamento — últimos 6 meses</SectionLabel>

      <Row>
        <Col flex={1}>
          <Card>
            <CardTitle>Por vendedor</CardTitle>
            {lfat ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fat6Vendedor} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={72} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {top5Vend.map((v, i) => (
                    <Bar key={v} dataKey={v} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === top5Vend.length-1 ? [4,4,0,0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Row>
        <Col flex={1}>
          <Card>
            <CardTitle>Por departamento</CardTitle>
            {lfat ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fat6Depto} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={72} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {deptos.map((d, i) => (
                    <Bar key={d} dataKey={d} stackId="b" fill={DEPTO_COLORS[d] || COLORS[i % COLORS.length]} radius={i === deptos.length-1 ? [4,4,0,0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
