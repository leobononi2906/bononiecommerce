import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useFaturamentoPeriodo, useSubgrupos, getCanal } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { fmtBRL, fmtPct, shortName } from '../lib/fmt'
import type { Periodo } from '../types'

interface Props { periodo: Periodo }

export default function Marketplace({ periodo }: Props) {
  const { data: fatP, loading: lfp } = useFaturamentoPeriodo(periodo)
  const { data: subs, loading: lsub } = useSubgrupos(periodo)

  // Apenas docs de marketplace
  const mktDocs = useMemo(() => {
    if (!fatP) return []
    return fatP.filter((r:any) => getCanal(r.nome_vendedor||'') === 'marketplace')
  }, [fatP])

  const kpis = useMemo(() => {
    const bruto   = mktDocs.reduce((s,r:any)=>s+Number(r.faturamento_doc),0)
    const taxa    = mktDocs.reduce((s,r:any)=>s+Number(r.taxa_marketplace||0),0)
    const liquido = mktDocs.reduce((s,r:any)=>s+Number(r.faturamento_liquido||0),0)
    const custo   = mktDocs.reduce((s,r:any)=>s+Number(r.custo_doc||0),0)
    const margem  = liquido>0 ? ((liquido-custo)/liquido)*100 : 0
    return { bruto, taxa, liquido, custo, margem }
  }, [mktDocs])

  const porVendedor = useMemo(() => {
    const map = new Map<string,{bruto:number;taxa:number;liquido:number;custo:number}>()
    mktDocs.forEach((r:any) => {
      const k = shortName(r.nome_vendedor)
      const c = map.get(k)||{bruto:0,taxa:0,liquido:0,custo:0}
      c.bruto   += Number(r.faturamento_doc)
      c.taxa    += Number(r.taxa_marketplace||0)
      c.liquido += Number(r.faturamento_liquido||0)
      c.custo   += Number(r.custo_doc||0)
      map.set(k,c)
    })
    return [...map.entries()].map(([nome,d])=>({nome,...d,margem:d.liquido>0?((d.liquido-d.custo)/d.liquido)*100:0})).sort((a,b)=>b.bruto-a.bruto)
  }, [mktDocs])

  // Lucratividade por subgrupo (todos os subgrupos do periodo — não filtra só mkt)
  const topSubgrupos = useMemo(() => {
    if (!subs) return []
    const map = new Map<string,{fat:number;custo:number;margem:number;qtd:number}>()
    subs.forEach(s => {
      const c = map.get(s.subgrupo)||{fat:0,custo:0,margem:0,qtd:0}
      c.fat    += s.faturamento
      c.custo  += s.custo_total
      c.margem += s.margem_total
      c.qtd    += s.qtd_vendida
      map.set(s.subgrupo, c)
    })
    return [...map.entries()].map(([nome,d])=>({nome,...d,margem_pct:d.fat>0?(d.margem/d.fat)*100:0})).sort((a,b)=>b.fat-a.fat).slice(0,15)
  }, [subs])

  const badgeMargem = (m:number) => m>=50?'ok':m>=35?'warn':'err'

  if (lfp) return <Spinner />

  return (
    <div style={{padding:'20px 24px',maxWidth:1400}}>
      <PageHeader title="Marketplace"/>

      <SectionLabel>KPIs marketplace</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Fat. bruto"     value={fmtBRL(kpis.bruto)}   highlight />
        <KpiCard label="Taxa canal"     value={fmtBRL(kpis.taxa)}    sub="Custo do canal" trend="down"/>
        <KpiCard label="Fat. líquido"   value={fmtBRL(kpis.liquido)} trend="up"/>
        <KpiCard label="Margem líquida" value={fmtPct(kpis.margem)}  trend={kpis.margem>=25?'up':'down'}/>
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Bruto vs líquido por vendedor</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porVendedor.map(v=>({nome:v.nome,'Fat. bruto':Math.round(v.bruto),'Fat. líquido':Math.round(v.liquido),'Taxa':Math.round(v.taxa)}))} margin={{top:0,right:0,left:0,bottom:30}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="nome" tick={{fontSize:10,fill:'var(--text-muted)'}} angle={-25} textAnchor="end" interval={0}/>
                <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={72}/>
                <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8}}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Fat. bruto"   fill="#1A3A8F" radius={[4,4,0,0]} opacity={0.7}/>
                <Bar dataKey="Fat. líquido" fill="#0077CC" radius={[4,4,0,0]}/>
                <Bar dataKey="Taxa"         fill="#FCA5A5" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Ranking por vendedor</CardTitle>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>{['Vendedor','Bruto','Líquido','Margem'].map((h,i)=><th key={i} style={{textAlign:i<1?'left':'right',padding:'4px 6px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>{porVendedor.map((v,i)=>(
                <tr key={i} style={{borderBottom:i<porVendedor.length-1?'1px solid var(--border)':'none'}}>
                  <td style={{padding:'7px 6px',fontWeight:500}}>{v.nome}</td>
                  <td style={{padding:'7px 6px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(v.bruto)}</td>
                  <td style={{padding:'7px 6px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(v.liquido)}</td>
                  <td style={{padding:'7px 6px',textAlign:'right'}}><Badge value={fmtPct(v.margem)} type={v.margem>=25?'ok':v.margem>=20?'warn':'err'}/></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardTitle>Lucratividade por produto (subgrupo) — período selecionado</CardTitle>
        {lsub ? <Spinner /> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>{['Subgrupo','Qtd vendida','Fat. total','Custo total','Margem R$','Margem %'].map((h,i)=><th key={i} style={{textAlign:i<1?'left':'right',padding:'5px 8px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
            <tbody>
              {topSubgrupos.map((s,i)=>(
                <tr key={i} style={{borderBottom:i<topSubgrupos.length-1?'1px solid var(--border)':'none'}}>
                  <td style={{padding:'7px 8px',fontWeight:500}}>{s.nome}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{Math.round(s.qtd)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(s.fat)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(s.custo)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(s.margem)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right'}}><Badge value={fmtPct(s.margem_pct)} type={badgeMargem(s.margem_pct)}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
