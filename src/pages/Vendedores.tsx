import React, { useMemo, useEffect, useState } from 'react'
import { useFaturamentoPeriodo, useLeads, useUmblerVendedores, getCanal } from '../hooks/useData'
import { KpiCard, Spinner, Card, CardTitle } from '../components/ui'
import { PageHeader, KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct, shortName } from '../lib/fmt'
import { RefreshCw } from 'lucide-react'
import { usePeriodo } from '../components/layout/AppShell'
import type { Periodo } from '../types'

export default function Vendedores() {
  const { periodo } = usePeriodo()
  const { data: fatP,    loading: lfp  } = useFaturamentoPeriodo(periodo)
  const { data: leads                  } = useLeads(periodo)
  const { data: umbler                 } = useUmblerVendedores()
  const [lastRefresh, setLastRefresh]    = useState(new Date())

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
        return { ...v, leads: leadsCount, conversao }
      })
      .sort((a,b) => b.fat - a.fat)
  }, [fatP, erpToUmbler, leadsPorUmbler])

  const maxFat = ranked[0]?.fat ?? 1

  const kpis = useMemo(() => {
    const total = ranked.reduce((s,v)=>s+v.fat,0)
    const docs  = ranked.reduce((s,v)=>s+v.docs,0)
    const leadsTotal = ranked.reduce((s,v)=>s+v.leads,0)
    const conv = leadsTotal > 0 ? (docs/leadsTotal)*100 : 0
    return { total, docs, ativos: ranked.length, leadsTotal, conv }
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
        <KpiCard label="Faturamento total"   value={fmtBRL(kpis.total)} highlight />
        <KpiCard label="Pedidos (período)"    value={fmtNum(kpis.docs)} />
        <KpiCard label="Leads Umbler"         value={fmtNum(kpis.leadsTotal)} />
        <KpiCard label="Conversão geral"      value={kpis.conv > 0 ? fmtPct(kpis.conv, 1) : '–'}
          sub={kpis.leadsTotal > 0 ? `${kpis.docs} pedidos ÷ ${kpis.leadsTotal} leads` : undefined} />
      </KpiGrid>

      <Card style={{marginBottom:16}}>
        <CardTitle>Ranking — faturamento ({ranked.length} vendedores)</CardTitle>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
          {ranked.map((v,i) => {
            const pct   = maxFat>0 ? (v.fat/maxFat)*100 : 0
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
                {/* Faturamento */}
                <div style={{textAlign:'right',minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:'DM Mono',color:isTop?'var(--blue-dark)':'var(--text-primary)'}}>{fmtBRL(v.fat)}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fmtNum(v.docs)} pedidos</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
