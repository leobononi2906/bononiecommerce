import React, { useMemo, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useFaturamentoPeriodo, useFaturamento6Meses, useDevolucaoPorVendedorPeriodo, useLeads, useUmblerVendedores, getCanal } from '../hooks/useData'
import { KpiCard, Spinner, Card, CardTitle } from '../components/ui'
import { PageHeader, KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct, shortName } from '../lib/fmt'
import { RefreshCw } from 'lucide-react'
import { usePeriodo } from '../components/layout/AppShell'
import type { Periodo } from '../types'

const MESES_AB = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
function mesInfo(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return { label: `${MESES_AB[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, sortKey: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
}
const COR = ['#1A3A8F','#0077CC','#00AAEE','#2563EB','#3B82F6','#60A5FA','#38BDF8','#7DD3FC','#93C5FD','#BAE0FD']
const COR_OUTROS = '#CBD5E1'

export default function Vendedores() {
  const { periodo } = usePeriodo()
  const { data: fatP,    loading: lfp  } = useFaturamentoPeriodo(periodo)
  const { data: fat6,    loading: lf6  } = useFaturamento6Meses()
  const { data: devP                   } = useDevolucaoPorVendedorPeriodo(periodo)
  const { data: leads                  } = useLeads(periodo)
  const { data: umbler                 } = useUmblerVendedores()
  const [lastRefresh, setLastRefresh]    = useState(new Date())

  // Gráfico 6 meses por vendedor (canal vendedor) — top 10 nominais + Outros, inclui quem já saiu
  const fat6Vend = useMemo(() => {
    if (!fat6) return { chartData: [] as any[], series: [] as string[] }
    const byMes = new Map<string, { label: string; vend: Record<string, number> }>()
    const totais = new Map<string, number>()
    fat6.forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'vendedor') return
      const { label, sortKey } = mesInfo(r.data_faturamento)
      const v = shortName(r.nome_vendedor)
      if (!byMes.has(sortKey)) byMes.set(sortKey, { label, vend: {} })
      byMes.get(sortKey)!.vend[v] = (byMes.get(sortKey)!.vend[v] || 0) + Number(r.faturamento_doc)
      totais.set(v, (totais.get(v) || 0) + Number(r.faturamento_doc))
    })
    const TOP = 10
    const nomes = [...totais.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    const principais = nomes.slice(0, TOP)
    const temOutros = nomes.length > TOP
    const series = temOutros ? [...principais, 'Outros'] : principais
    const chartData = [...byMes.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([, { label, vend }]) => {
      const row: any = { mes: label }
      principais.forEach(n => { row[n] = vend[n] || 0 })
      if (temOutros) row['Outros'] = Object.entries(vend).reduce((s, [n, val]) => principais.includes(n) ? s : s + val, 0)
      return row
    })
    return { chartData, series }
  }, [fat6])

  useEffect(() => {
    const t = setInterval(() => { setLastRefresh(new Date()); window.location.reload() }, 5*60*1000)
    return () => clearInterval(t)
  }, [])

  // Mapa id_vendedor_erp → id_membro_umbler (para cruzar leads)
  const erpToUmbler = useMemo(() => {
    const m = new Map<string, string>()
    ;(umbler||[]).filter(u => !(u as any).interno).forEach(u => {
      m.set(String(u.id_vendedor_erp), u.id_membro_umbler)
    })
    return m
  }, [umbler])

  // Leads por id_membro_umbler no período
  const leadsPorUmbler = useMemo(() => {
    const m = new Map<string, number>()
    ;(leads||[]).forEach((l: any) => {
      if (!l.id_vendedor) return
      m.set(l.id_vendedor, (m.get(l.id_vendedor)||0) + 1)
    })
    return m
  }, [leads])

  // Devolução externa por vendedor (id_vendedor da venda de origem)
  const devPorVendedor = useMemo(() => {
    const m = new Map<string, number>()
    ;(devP||[]).forEach((r:any) => {
      if (r.id_vendedor == null) return
      const k = String(r.id_vendedor)
      m.set(k, (m.get(k)||0) + (Number(r.valor_total)||0))
    })
    return m
  }, [devP])

  // Ranking de vendedores por faturamento
  const ranked = useMemo(() => {
    if (!fatP) return []
    const map = new Map<string,{nome:string;fat:number;docs:number;id:string}>()
    fatP.forEach((r:any) => {
      if (getCanal(r.nome_vendedor||'') !== 'vendedor') return
      const k = String(r.id_vendedor)
      const c = map.get(k)||{nome:r.nome_vendedor,fat:0,docs:0,id:k}
      c.fat  += Number(r.faturamento_doc)
      c.docs++
      map.set(k,c)
    })
    return [...map.values()]
      .map(v => {
        const idUmbler = erpToUmbler.get(v.id)
        const leadsCount = idUmbler ? (leadsPorUmbler.get(idUmbler)||0) : 0
        const conversao = leadsCount > 0 ? (v.docs / leadsCount) * 100 : null
        const devolucao = devPorVendedor.get(v.id) || 0
        return { ...v, leads: leadsCount, conversao, devolucao, liquido: v.fat - devolucao }
      })
      .sort((a,b) => b.liquido - a.liquido)
  }, [fatP, erpToUmbler, leadsPorUmbler, devPorVendedor])

  const maxFat = ranked[0]?.liquido ?? 1

  const kpis = useMemo(() => {
    const total = ranked.reduce((s,v)=>s+v.fat,0)
    const devolucao = ranked.reduce((s,v)=>s+v.devolucao,0)
    const docs  = ranked.reduce((s,v)=>s+v.docs,0)
    const leadsTotal = ranked.reduce((s,v)=>s+v.leads,0)
    const conv = leadsTotal > 0 ? (docs/leadsTotal)*100 : 0
    return { total, devolucao, liquido: total-devolucao, docs, ativos: ranked.length, leadsTotal, conv }
  }, [ranked])

  const medals = ['🥇','🥈','🥉']

  if (lfp) return <Spinner />

  return (
    <div style={{padding:'20px 24px',maxWidth:1200}}>
      <PageHeader title="Vendedores">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:11,color:'var(--text-hint)'}}>
            Atualizado às {lastRefresh.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--blue-mid)',background:'#EFF6FF',padding:'4px 10px',borderRadius:20}}>
            <RefreshCw size={11}/> Auto 5min
          </span>
        </div>
      </PageHeader>

      <KpiGrid cols={4}>
        <KpiCard label="Faturamento (bruto)" value={fmtBRL(kpis.total)} />
        <KpiCard label="Devolução externa"   value={'− '+fmtBRL(kpis.devolucao)}
          sub={kpis.total>0?`${(kpis.devolucao/kpis.total*100).toFixed(1)}% do bruto`:undefined}
          trend={kpis.devolucao>0?'down':'neutral'} />
        <KpiCard label="Faturamento líquido" value={fmtBRL(kpis.liquido)} highlight />
        <KpiCard label="Pedidos (período)"    value={fmtNum(kpis.docs)} />
      </KpiGrid>

      <KpiGrid cols={2}>
        <KpiCard label="Leads Umbler"         value={fmtNum(kpis.leadsTotal)} />
        <KpiCard label="Conversão geral"      value={kpis.conv > 0 ? fmtPct(kpis.conv, 1) : '–'}
          sub={kpis.leadsTotal > 0 ? `${kpis.docs} pedidos ÷ ${kpis.leadsTotal} leads` : undefined} />
      </KpiGrid>

      <Card style={{marginBottom:16}}>
        <CardTitle>Ranking — faturamento líquido ({ranked.length} vendedores) <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— já desconta devolução externa</span></CardTitle>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
          {ranked.map((v,i) => {
            const pct   = maxFat>0 ? (v.liquido/maxFat)*100 : 0
            const isTop = i===0
            const convColor = v.conversao == null ? 'var(--text-hint)'
              : v.conversao >= 15 ? 'var(--green)'
              : v.conversao >= 7  ? 'var(--amber)'
              : 'var(--red)'
            return (
              <div key={v.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,border:`1px solid ${isTop?'var(--blue-dark)':'var(--border)'}`,background:isTop?'linear-gradient(135deg,#1A3A8F08,#0077CC10)':'var(--surface)'}}>
                <div style={{width:32,textAlign:'center'}}>
                  {i<3 ? <span style={{fontSize:18}}>{medals[i]}</span> : <span style={{fontSize:15,fontWeight:700,color:'var(--text-hint)'}}>{i+1}</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:'var(--text-primary)'}}>{shortName(v.nome)}</div>
                  <div style={{marginTop:5,height:5,background:'#F1F5F9',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:isTop?'var(--blue-dark)':'var(--blue-mid)',borderRadius:3,transition:'width 0.5s ease'}}/>
                  </div>
                </div>
                {/* Conversão */}
                <div style={{textAlign:'center',minWidth:80}}>
                  <div style={{fontSize:11,color:'var(--text-hint)',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>Conversão</div>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:'DM Mono',color:convColor}}>
                    {v.conversao != null ? fmtPct(v.conversao,1) : '–'}
                  </div>
                  {v.leads > 0 && (
                    <div style={{fontSize:10,color:'var(--text-hint)'}}>{v.docs}p ÷ {fmtNum(v.leads)}l</div>
                  )}
                </div>
                {/* Devolução */}
                <div style={{textAlign:'right',minWidth:90}}>
                  <div style={{fontSize:11,color:'var(--text-hint)',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>Devolução</div>
                  <div style={{fontSize:13,fontWeight:600,fontFamily:'DM Mono',color:v.devolucao>0?'var(--red)':'var(--text-hint)'}}>
                    {v.devolucao>0?'− '+fmtBRL(v.devolucao):'–'}
                  </div>
                </div>
                {/* Faturamento líquido */}
                <div style={{textAlign:'right',minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:'DM Mono',color:isTop?'var(--blue-dark)':'var(--text-primary)'}}>{fmtBRL(v.liquido)}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fmtNum(v.docs)} pedidos</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Faturamento por vendedor — últimos 6 meses <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— inclui vendedores que já saíram</span></CardTitle>
        {lf6 ? <Spinner /> : fat6Vend.chartData.length === 0 ? (
          <div style={{textAlign:'center',color:'var(--text-muted)',padding:24,fontSize:13}}>Sem dados no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fat6Vend.chartData} margin={{top:0,right:0,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="mes" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
              <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={72}/>
              <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              {fat6Vend.series.map((v,i)=>(
                <Bar key={v} dataKey={v} stackId="a" fill={v==='Outros'?COR_OUTROS:COR[i%COR.length]}
                  radius={i===fat6Vend.series.length-1?[4,4,0,0]:undefined}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
