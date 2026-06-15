import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useFaturamento6Meses, useFaturamentoPeriodo, useSubgrupos, useLeads, getCanal } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { fmtBRL, fmtNum, shortName } from '../lib/fmt'
import type { Periodo } from '../types'

interface Props { periodo: Periodo }

// Retorna { label: "Jan/26", sortKey: "2026-01" }
function mesInfo(iso: string): { label: string; sortKey: string } {
  const d = new Date(iso + 'T12:00:00')
  const label = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()]
    + '/' + String(d.getFullYear()).slice(2)
  const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  return { label, sortKey }
}

export default function Home({ periodo }: Props) {
  const { data: fat6,   loading: lf6 }  = useFaturamento6Meses()
  const { data: fatP,   loading: lfp }  = useFaturamentoPeriodo(periodo)
  const { data: subs,   loading: lsub } = useSubgrupos(periodo)
  const { data: leads,  loading: ll }   = useLeads(periodo)

  const canais = useMemo(() => {
    if (!fatP) return { vendedor:0, site:0, marketplace:0 }
    let vendedor=0, site=0, marketplace=0
    fatP.forEach((r:any) => {
      const f = Number(r.faturamento_doc)
      const canal = getCanal(r.nome_vendedor||'')
      if (canal==='marketplace') marketplace+=f
      else if (canal==='site') site+=f
      else vendedor+=f
    })
    return { vendedor, site, marketplace }
  }, [fatP])

  const topSubs = useMemo(() => {
    if (!subs) return []
    const map = new Map<string,number>()
    subs.forEach(s => map.set(s.subgrupo,(map.get(s.subgrupo)||0)+s.faturamento))
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([nome,fat])=>({nome,fat}))
  }, [subs])

  const topVend = useMemo(() => {
    if (!fatP) return []
    const map = new Map<string,number>()
    fatP.forEach((r:any) => {
      if (getCanal(r.nome_vendedor||'')!=='vendedor') return
      const k = shortName(r.nome_vendedor)
      map.set(k,(map.get(k)||0)+Number(r.faturamento_doc))
    })
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([nome,fat])=>({nome,fat}))
  }, [fatP])

  // Gráfico 6 meses — ordenado cronologicamente por sortKey
  const fat6Vend = useMemo(() => {
    if (!fat6) return { chartData:[], top5:[] }
    // byMes: sortKey → { label, vendedores }
    const byMes = new Map<string,{ label:string; vend:Record<string,number> }>()
    const totais = new Map<string,number>()
    fat6.forEach((r:any) => {
      if (getCanal(r.nome_vendedor||'')!=='vendedor') return
      const { label, sortKey } = mesInfo(r.data_faturamento)
      const v = shortName(r.nome_vendedor)
      if (!byMes.has(sortKey)) byMes.set(sortKey,{label,vend:{}})
      const entry = byMes.get(sortKey)!
      entry.vend[v] = (entry.vend[v]||0) + Number(r.faturamento_doc)
      totais.set(v,(totais.get(v)||0)+Number(r.faturamento_doc))
    })
    const top5 = [...totais.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k)
    // Ordena cronologicamente pelo sortKey (yyyy-mm)
    const chartData = [...byMes.entries()]
      .sort((a,b)=>a[0]<b[0]?-1:1)
      .map(([,{label,vend}]) => ({ mes:label, ...vend }))
    return { chartData, top5 }
  }, [fat6])

  // Tabela 6 meses por departamento — ordenada cronologicamente
  const fat6Depto = useMemo(() => {
    if (!fat6) return []
    type Row = { sortKey:string; mes:string; Vendedores:number; Marketplace:number; Site:number; total:number }
    const map = new Map<string,Row>()
    fat6.forEach((r:any) => {
      const { label, sortKey } = mesInfo(r.data_faturamento)
      const f = Number(r.faturamento_doc)
      const canal = getCanal(r.nome_vendedor||'')
      if (!map.has(sortKey)) map.set(sortKey,{sortKey,mes:label,Vendedores:0,Marketplace:0,Site:0,total:0})
      const row = map.get(sortKey)!
      if (canal==='vendedor') row.Vendedores+=f
      else if (canal==='marketplace') row.Marketplace+=f
      else row.Site+=f
      row.total+=f
    })
    // Ordena cronologicamente
    return [...map.values()].sort((a,b)=>a.sortKey<b.sortKey?-1:1)
  }, [fat6])

  const COLORS = ['#1A3A8F','#0077CC','#00AAEE','#60A5FA','#93C5FD']

  return (
    <div style={{ padding:'20px 24px', maxWidth:1400 }}>
      <PageHeader title="Visão Geral" />

      <SectionLabel>Faturamento por canal — período selecionado</SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Faturamento Vendedores"  value={lfp?'…':fmtBRL(canais.vendedor)} highlight />
        <KpiCard label="Faturamento Site"         value={lfp?'…':fmtBRL(canais.site)} />
        <KpiCard label="Faturamento Marketplace"  value={lfp?'…':fmtBRL(canais.marketplace)} />
      </KpiGrid>

      <KpiGrid cols={3}>
        <KpiCard label="Total ONLINE"   value={lfp?'…':fmtBRL(canais.vendedor+canais.site+canais.marketplace)} />
        <KpiCard label="Top subgrupo"   value={lsub?'…':(topSubs[0]?.nome||'–')} sub={topSubs[0]?fmtBRL(topSubs[0].fat):''} />
        <KpiCard label="Leads (período)" value={ll?'…':fmtNum(leads?.length??0)} />
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Top subgrupos — faturamento</CardTitle>
            {lsub ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topSubs} margin={{top:0,right:0,left:0,bottom:40}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="nome" tick={{fontSize:10,fill:'var(--text-muted)'}} angle={-35} textAnchor="end" interval={0}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={70}/>
                  <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8}}/>
                  <Bar dataKey="fat" name="Faturamento" fill="var(--blue-mid)" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Top vendedores — período</CardTitle>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>{['#','Vendedor','Fat.'].map((h,i)=>(
                <th key={i} style={{textAlign:i<2?'left':'right',padding:'4px 6px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>
              ))}</tr></thead>
              <tbody>{topVend.map((v,i)=>(
                <tr key={i} style={{borderBottom:i<topVend.length-1?'1px solid var(--border)':'none'}}>
                  <td style={{padding:'6px 6px',color:'var(--text-hint)',fontSize:11}}>{i+1}</td>
                  <td style={{padding:'6px 6px',fontWeight:500}}>{v.nome}</td>
                  <td style={{padding:'6px 6px',textAlign:'right',fontFamily:'DM Mono',fontSize:12}}>{fmtBRL(v.fat)}</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        </Col>
      </Row>

      <SectionLabel>Faturamento — últimos 6 meses</SectionLabel>
      <Row>
        <Col flex={1}>
          <Card>
            <CardTitle>Por vendedor (ONLINE, excluindo marketplace e site)</CardTitle>
            {lf6 ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fat6Vend.chartData} margin={{top:0,right:0,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={72}/>
                  <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  {fat6Vend.top5.map((v,i)=>(
                    <Bar key={v} dataKey={v} stackId="a" fill={COLORS[i%COLORS.length]}
                      radius={i===fat6Vend.top5.length-1?[4,4,0,0]:undefined}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <CardTitle>Por departamento — últimos 6 meses</CardTitle>
        {lf6 ? <Spinner /> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr>
              {['Mês','Vendedores','Marketplace','Site','Total'].map((h,i)=>(
                <th key={i} style={{textAlign:i<1?'left':'right',padding:'5px 8px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {fat6Depto.map((r,i)=>(
                <tr key={i} style={{borderBottom:i<fat6Depto.length-1?'1px solid var(--border)':'none'}}>
                  <td style={{padding:'7px 8px',fontWeight:500}}>{r.mes}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.Vendedores)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.Marketplace)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.Site)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono',fontWeight:600,color:'var(--blue-dark)'}}>{fmtBRL(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
