import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useLeads, useEsperaVendedor, useMetaAds, useUmblerVendedores } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col, FunnelBar } from '../components/layout'
import { PeriodSelector } from '../components/layout'
import { fmtMinutes, fmtNum, shortName } from '../lib/fmt'
import { usePeriodo } from '../components/layout/AppShell'
import FunilVendedores from '../components/atendimento/FunilVendedores'

const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const HORAS = ['8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h']

export default function Atendimento() {
  const { periodo } = usePeriodo()
  const { data: leads, loading: lleads } = useLeads(periodo)
  const { data: espera, loading: lespera } = useEsperaVendedor(periodo)
  const { data: metaAds, loading: lmeta } = useMetaAds(periodo)
  const { data: umblerVend } = useUmblerVendedores()

  // Map umbler id -> nome
  const idToName = useMemo(() => {
    const m: Record<string, string> = {}
    umblerVend?.forEach(v => { m[v.id_membro_umbler] = shortName(v.nome_vendedor_erp) })
    return m
  }, [umblerVend])

  const totalLeads = leads?.length ?? 0
  const totalInvest = useMemo(() => metaAds?.reduce((s, r) => s + r.investimento, 0) ?? 0, [metaAds])
  const totalLeadsMeta = useMemo(() => metaAds?.reduce((s, r) => s + r.leads, 0) ?? 0, [metaAds])
  const cpl = totalLeadsMeta > 0 ? totalInvest / totalLeadsMeta : 0

  // Tempo médio por vendedor (agregar espera)
  const tempoVendedor = useMemo(() => {
    if (!espera) return []
    const map = new Map<string, { total: number; count: number; min: number; max: number; a5: number; a15: number; acima: number }>()
    espera.forEach(e => {
      const nome = idToName[e.id_vendedor] || shortName(e.nome_vendedor)
      const cur = map.get(nome) || { total: 0, count: 0, min: Infinity, max: -Infinity, a5: 0, a15: 0, acima: 0 }
      cur.total += e.tempo_medio_min * e.total_atendidos
      cur.count += e.total_atendidos
      cur.min = Math.min(cur.min, e.tempo_min_min)
      cur.max = Math.max(cur.max, e.tempo_max_min)
      cur.a5 += e.atendidos_em_5min
      cur.a15 += e.atendidos_5_15min
      cur.acima += e.atendidos_acima_15min
      map.set(nome, cur)
    })
    return [...map.entries()].map(([nome, d]) => ({
      nome,
      media: d.count > 0 ? d.total / d.count : 0,
      min: d.min === Infinity ? 0 : d.min,
      max: d.max === -Infinity ? 0 : d.max,
      total: d.count,
      pct5: d.count > 0 ? (d.a5 / d.count) * 100 : 0,
      pct15: d.count > 0 ? (d.a15 / d.count) * 100 : 0,
      pctAcima: d.count > 0 ? (d.acima / d.count) * 100 : 0,
    })).sort((a, b) => a.media - b.media)
  }, [espera, idToName])

  const mediaGeral = useMemo(() => {
    if (!tempoVendedor.length) return 0
    const total = tempoVendedor.reduce((s, v) => s + v.media * v.total, 0)
    const count = tempoVendedor.reduce((s, v) => s + v.total, 0)
    return count > 0 ? total / count : 0
  }, [tempoVendedor])

  // Heatmap leads por dia × hora
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(11).fill(0))
    leads?.forEach((l: any) => {
      const d = new Date(l.criado_em)
      const dow = d.getDay()
      const h = d.getHours()
      const col = h - 8
      if (col >= 0 && col < 11) grid[dow][col]++
    })
    return grid
  }, [leads])

  const heatMax = useMemo(() => Math.max(...heatmap.flat(), 1), [heatmap])

  // Leads por dia para o gráfico
  const leadsPorDia = useMemo(() => {
    if (!leads) return []
    const map = new Map<string, number>()
    leads.forEach((l: any) => {
      const dia = l.criado_em.slice(0, 10)
      map.set(dia, (map.get(dia) || 0) + 1)
    })
    return [...map.entries()].sort().slice(-30).map(([data, qtd]) => ({ data: data.slice(5), qtd }))
  }, [leads])

  const totalImpress = useMemo(() => metaAds?.reduce((s, r) => s + r.impressoes, 0) ?? 0, [metaAds])
  const totalCliques = useMemo(() => metaAds?.reduce((s, r) => s + r.cliques, 0) ?? 0, [metaAds])

  if (lleads || lespera) return <Spinner />

  return (
    <div className="ecom-page">
      <PageHeader title="Atendimento">
        
      </PageHeader>

      <SectionLabel>KPIs de atendimento</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Leads recebidos" value={fmtNum(totalLeads)} icon="👥" highlight />
        <KpiCard label="Leads Meta Ads" value={fmtNum(totalLeadsMeta)} sub={cpl > 0 ? `CPL: R$ ${cpl.toFixed(2)}` : undefined} />
        <KpiCard label="Tempo médio resposta" value={fmtMinutes(mediaGeral)} sub="Horário comercial" />
        <KpiCard label="Vendedores ativos" value={String(tempoVendedor.length)} />
      </KpiGrid>

      <div style={{ marginBottom: 16 }}>
        <FunilVendedores periodo={periodo} />
      </div>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Leads Umbler recebidos por dia <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— conversas iniciadas na Umbler</span></CardTitle>
            {lleads ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={leadsPorDia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="qtd" name="Leads" fill="var(--blue-mid)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Funil de atendimento</CardTitle>
            {lmeta ? <Spinner /> : (
              <div style={{ marginTop: 8 }}>
                <FunnelBar label="Impressões" value={totalImpress} total={totalImpress} color="#E2E8F0" />
                <FunnelBar label="Cliques" value={totalCliques} total={totalImpress} color="#93C5FD" />
                <FunnelBar label="Leads WA" value={totalLeadsMeta} total={totalImpress} color="var(--blue-mid)" />
                <FunnelBar label="Atendidos" value={totalLeads} total={totalImpress} color="var(--blue-dark)" />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row>
        <Col flex={1}>
          <Card>
            <CardTitle>Tempo médio para início do atendimento — por vendedor (horário comercial)</CardTitle>
            {lespera ? <Spinner /> : (
              <div className="ecom-scroll-x">
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Vendedor','Leads','Média','Mínimo','Máximo','Até 5min','5–15min','+15min'].map((h,i) => (
                      <th key={i} style={{ textAlign: i<2?'left':'right', padding: '4px 6px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tempoVendedor.map((v, i) => (
                    <tr key={i} style={{ borderBottom: i < tempoVendedor.length-1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '7px 6px', fontWeight: 500 }}>{v.nome}</td>
                      <td style={{ padding: '7px 6px' }}>{fmtNum(v.total)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: v.media > 60 ? 'var(--red)' : v.media > 15 ? 'var(--amber)' : 'var(--green)' }}>{fmtMinutes(v.media)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{fmtMinutes(v.min)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{fmtMinutes(v.max)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge value={`${v.pct5.toFixed(0)}%`} type={v.pct5 >= 50 ? 'ok' : 'warn'} /></td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge value={`${v.pct15.toFixed(0)}%`} type="neutral" /></td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge value={`${v.pctAcima.toFixed(0)}%`} type={v.pctAcima > 50 ? 'err' : v.pctAcima > 25 ? 'warn' : 'ok'} /></td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ padding: '7px 6px', fontWeight: 700, fontSize: 12 }}>Média geral</td>
                    <td style={{ padding: '7px 6px', fontWeight: 600 }}>{fmtNum(tempoVendedor.reduce((s,v) => s+v.total,0))}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtMinutes(mediaGeral)}</td>
                    <td colSpan={5} />
                  </tr>
                </tbody>
              </table>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <CardTitle>Mapa de calor — chegada de leads (dia × hora)</CardTitle>
        <div className="ecom-scroll-x">
          <div style={{ display: 'flex', gap: 6, marginBottom: 4, paddingLeft: 40, minWidth: 460 }}>
            {HORAS.map(h => (
              <div key={h} style={{ width: 32, textAlign: 'center', fontSize: 10, color: 'var(--text-hint)' }}>{h}</div>
            ))}
          </div>
          {DIAS.map((dia, dow) => (
            <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, minWidth: 460 }}>
              <div style={{ width: 34, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{dia}</div>
              {heatmap[dow].map((val, col) => {
                const intensity = val / heatMax
                const bg = val === 0
                  ? '#F1F5F9'
                  : `rgba(26, 58, 143, ${0.1 + intensity * 0.9})`
                return (
                  <div key={col} title={`${val} leads`} style={{
                    width: 32, height: 24,
                    borderRadius: 4,
                    background: bg,
                    cursor: 'default',
                    transition: 'background 0.2s',
                  }} />
                )
              })}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 40 }}>
            <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>Menos</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
              <div key={i} style={{ width: 14, height: 10, borderRadius: 2, background: `rgba(26,58,143,${i})` }} />
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>Mais leads</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
