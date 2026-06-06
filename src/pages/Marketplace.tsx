import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useMarketplace } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { fmtBRL, fmtPct, shortName } from '../lib/fmt'
import type { Periodo } from '../types'

interface Props { periodo: Periodo }

export default function Marketplace({ periodo }: Props) {
  const { data: mkt, loading } = useMarketplace(periodo)

  const kpis = useMemo(() => {
    if (!mkt) return null
    const bruto   = mkt.reduce((s,r)=>s+r.faturamento_bruto,0)
    const taxa    = mkt.reduce((s,r)=>s+r.taxa_marketplace,0)
    const liquido = mkt.reduce((s,r)=>s+r.faturamento_liquido,0)
    const custo   = mkt.reduce((s,r)=>s+r.custo_total,0)
    const margem  = liquido>0 ? ((liquido-custo)/liquido)*100 : 0
    return { bruto, taxa, liquido, custo, margem }
  }, [mkt])

  const porVendedor = useMemo(() => {
    if (!mkt) return []
    return [...mkt].sort((a,b)=>b.faturamento_bruto-a.faturamento_bruto)
  }, [mkt])

  const barData = porVendedor.map(v=>({
    nome: shortName(v.nome_vendedor),
    'Fat. bruto': Math.round(v.faturamento_bruto),
    'Fat. líquido': Math.round(v.faturamento_liquido),
    'Taxa': Math.round(v.taxa_marketplace),
  }))

  const badgeMargem = (m:number) => m>=28?'ok':m>=22?'warn':'err'

  if (loading) return <Spinner />

  return (
    <div style={{padding:'24px 28px',maxWidth:1400}}>
      <PageHeader title="Marketplace" />

      <SectionLabel>KPIs marketplace</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Fat. bruto"     value={fmtBRL(kpis?.bruto)}   highlight />
        <KpiCard label="Taxa canal"     value={fmtBRL(kpis?.taxa)}    sub="Custo do canal" trend="down" />
        <KpiCard label="Fat. líquido"   value={fmtBRL(kpis?.liquido)} trend="up" />
        <KpiCard label="Margem líquida" value={fmtPct(kpis?.margem)}  trend={kpis&&kpis.margem>=25?'up':'down'} />
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Bruto vs líquido vs taxa — por vendedor</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{top:0,right:0,left:0,bottom:40}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nome" tick={{fontSize:10,fill:'var(--text-muted)'}} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={72} />
                <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8}} />
                <Legend wrapperStyle={{fontSize:11}} />
                <Bar dataKey="Fat. bruto"    fill="#1A3A8F" radius={[4,4,0,0]} opacity={0.7} />
                <Bar dataKey="Fat. líquido"  fill="#0077CC" radius={[4,4,0,0]} />
                <Bar dataKey="Taxa"          fill="#FCA5A5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Ranking por vendedor</CardTitle>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr>{['Vendedor','Bruto','Líquido','Margem'].map((h,i)=>(
                  <th key={i} style={{textAlign:i<1?'left':'right',padding:'4px 6px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {porVendedor.map((v,i)=>(
                  <tr key={i} style={{borderBottom:i<porVendedor.length-1?'1px solid var(--border)':'none'}}>
                    <td style={{padding:'7px 6px',fontWeight:500}}>{shortName(v.nome_vendedor)}</td>
                    <td style={{padding:'7px 6px',textAlign:'right',fontFamily:'DM Mono',fontSize:12}}>{fmtBRL(v.faturamento_bruto)}</td>
                    <td style={{padding:'7px 6px',textAlign:'right',fontFamily:'DM Mono',fontSize:12}}>{fmtBRL(v.faturamento_liquido)}</td>
                    <td style={{padding:'7px 6px',textAlign:'right'}}><Badge value={fmtPct(v.margem_liquida_perc)} type={badgeMargem(v.margem_liquida_perc)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
