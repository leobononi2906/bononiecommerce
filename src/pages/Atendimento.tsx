import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useLeads, useLeadsRecentes, useTempoResposta, useMetaAds } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col, FunnelBar } from '../components/layout'
import { fmtMinutes, fmtNum } from '../lib/fmt'
import { usePeriodo } from '../components/layout/AppShell'
import FunilVendedores from '../components/atendimento/FunilVendedores'

const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const HORAS = Array.from({ length: 24 }, (_, h) => `${h}h`)

export default function Atendimento() {
  const { periodo } = usePeriodo()
  const { data: leads, loading: lleads } = useLeads(periodo)
  const { data: leads30 } = useLeadsRecentes(30)
  const { data: tempoResp, loading: ltempo } = useTempoResposta(periodo)
  const { data: metaAds, loading: lmeta } = useMetaAds(periodo)

  const totalLeads = leads?.length ?? 0
  const totalInvest = useMemo(() => metaAds?.reduce((s, r) => s + r.investimento, 0) ?? 0, [metaAds])
  const totalLeadsMeta = useMemo(() => metaAds?.reduce((s, r) => s + r.leads, 0) ?? 0, [metaAds])
  const cpl = totalLeadsMeta > 0 ? totalInvest / totalLeadsMeta : 0

  // Tempo de resposta por vendedor (só cadastrados) — vem pronto do hook
  const tempoVendedor = useMemo(() => (tempoResp?.vendedores ?? []).map(v => ({
    nome: v.nome, total: v.total, media: v.media, mediana: v.mediana, min: v.min, max: v.max,
    pct5: v.total > 0 ? (v.a5 / v.total) * 100 : 0,
    pct15: v.total > 0 ? (v.a515 / v.total) * 100 : 0,
    pctAcima: v.total > 0 ? (v.acima / v.total) * 100 : 0,
  })), [tempoResp])

  const medianaGeral = tempoResp?.geralMediana ?? 0

  // Heatmap leads por dia × hora — últimos 30 dias, todas as 24h
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
    leads30?.forEach((l: any) => {
      const d = new Date(l.criado_em)
      const dow = d.getDay()
      const h = d.getHours()
      if (h >= 0 && h < 24) grid[dow][h]++
    })
    return grid
  }, [leads30])

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

  if (lleads || ltempo) return <Spinner />

  return (
    <div className="ecom-page">
      <PageHeader title="Atendimento">
        
      </PageHeader>

      <SectionLabel>KPIs de atendimento</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Leads recebidos" value={fmtNum(totalLeads)} icon="👥" highlight />
        <KpiCard label="Leads Meta Ads" value={fmtNum(totalLeadsMeta)} sub={cpl > 0 ? `CPL: R$ ${cpl.toFixed(2)}` : undefined} />
        <KpiCard label="Tempo de resposta (mediana)" value={fmtMinutes(medianaGeral)} sub="1ª msg → 1ª resposta" />
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
            <CardTitle>Tempo de resposta ao cliente — por vendedor <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— 1ª mensagem do cliente → 1ª resposta do vendedor · só cadastrados</span></CardTitle>
            {ltempo ? <Spinner /> : tempoVendedor.length === 0 ? (
              <div style={{ textAlign:'center', color:'var(--text-muted)', padding:24, fontSize:13 }}>Nenhum atendimento no período selecionado.</div>
            ) : (
              <div className="ecom-scroll-x">
              <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Vendedor','Atend.','Mediana','Média','Mín','Máx','Até 5min','5–15min','+15min'].map((h,i) => (
                      <th key={i} style={{ textAlign: i<2?'left':'right', padding: '4px 6px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tempoVendedor.map((v, i) => (
                    <tr key={i} style={{ borderBottom: i < tempoVendedor.length-1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '7px 6px', fontWeight: 500 }}>{v.nome}</td>
                      <td style={{ padding: '7px 6px' }}>{fmtNum(v.total)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: v.mediana > 60 ? 'var(--red)' : v.mediana > 15 ? 'var(--amber)' : 'var(--green)' }}>{fmtMinutes(v.mediana)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color:'var(--text-muted)' }}>{fmtMinutes(v.media)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{fmtMinutes(v.min)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{fmtMinutes(v.max)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge value={`${v.pct5.toFixed(0)}%`} type={v.pct5 >= 50 ? 'ok' : 'warn'} /></td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge value={`${v.pct15.toFixed(0)}%`} type="neutral" /></td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge value={`${v.pctAcima.toFixed(0)}%`} type={v.pctAcima > 50 ? 'err' : v.pctAcima > 25 ? 'warn' : 'ok'} /></td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ padding: '7px 6px', fontWeight: 700, fontSize: 12 }}>Mediana geral</td>
                    <td style={{ padding: '7px 6px', fontWeight: 600 }}>{fmtNum(tempoVendedor.reduce((s,v) => s+v.total,0))}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtMinutes(medianaGeral)}</td>
                    <td colSpan={6} />
                  </tr>
                </tbody>
              </table>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <CardTitle>Mapa de calor — chegada de leads (dia × hora) <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— últimos 30 dias, todas as horas</span></CardTitle>
        <div className="ecom-scroll-x">
          <div style={{ display: 'flex', gap: 3, marginBottom: 4, paddingLeft: 40, minWidth: 760 }}>
            {HORAS.map(h => (
              <div key={h} style={{ width: 26, textAlign: 'center', fontSize: 9, color: 'var(--text-hint)' }}>{h}</div>
            ))}
          </div>
          {DIAS.map((dia, dow) => (
            <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3, minWidth: 760 }}>
              <div style={{ width: 34, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{dia}</div>
              {heatmap[dow].map((val, col) => {
                const intensity = val / heatMax
                const bg = val === 0
                  ? '#F1F5F9'
                  : `rgba(26, 58, 143, ${0.1 + intensity * 0.9})`
                return (
                  <div key={col} title={`${DIAS[dow]} ${col}h — ${val} leads`} style={{
                    width: 26, height: 22,
                    borderRadius: 3,
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
