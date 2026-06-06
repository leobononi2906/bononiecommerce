import React, { useMemo, useEffect, useState } from 'react'
import { useFaturamentoPeriodo, useEsperaVendedor, getCanal } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel, AlertBanner } from '../components/ui'
import { PageHeader, KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct, fmtMinutes, shortName } from '../lib/fmt'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import type { Periodo } from '../types'

interface Props { periodo: Periodo }

export default function Vendedores({ periodo }: Props) {
  const { data: fatP,  loading: lfp }    = useFaturamentoPeriodo(periodo)
  const { data: espera, loading: lesp }  = useEsperaVendedor(periodo)
  const [lastRefresh, setLastRefresh]    = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => { setLastRefresh(new Date()); window.location.reload() }, 5*60*1000)
    return () => clearInterval(t)
  }, [])

  // Ranking de vendedores por faturamento no periodo
  const ranked = useMemo(() => {
    if (!fatP) return []
    const map = new Map<string,{nome:string;fat:number;docs:number;id:string}>()
    fatP.forEach((r:any) => {
      const canal = getCanal(r.nome_vendedor||'')
      if (canal !== 'vendedor') return
      const k = String(r.id_vendedor)
      const c = map.get(k)||{nome:r.nome_vendedor,fat:0,docs:0,id:k}
      c.fat  += Number(r.faturamento_doc)
      c.docs++
      map.set(k,c)
    })
    return [...map.values()].sort((a,b)=>b.fat-a.fat)
  }, [fatP])

  const maxFat = ranked[0]?.fat ?? 1

  const kpis = useMemo(() => {
    const total = ranked.reduce((s,v)=>s+v.fat,0)
    const docs  = ranked.reduce((s,v)=>s+v.docs,0)
    return { total, docs, ativos: ranked.length }
  }, [ranked])

  // Tempo médio agregado por vendedor
  const tempoVend = useMemo(() => {
    if (!espera) return []
    const map = new Map<string,{total:number;count:number;min:number;max:number;a5:number;a15:number;acima:number}>()
    espera.forEach(e => {
      const nome = e.nome_vendedor
      const c = map.get(nome)||{total:0,count:0,min:Infinity,max:-Infinity,a5:0,a15:0,acima:0}
      c.total += e.tempo_medio_min * e.total_atendidos
      c.count += e.total_atendidos
      c.min    = Math.min(c.min, e.tempo_min_min)
      c.max    = Math.max(c.max, e.tempo_max_min)
      c.a5    += e.atendidos_em_5min
      c.a15   += e.atendidos_5_15min
      c.acima += e.atendidos_acima_15min
      map.set(nome,c)
    })
    return [...map.entries()].map(([nome,d])=>({
      nome, media: d.count>0 ? d.total/d.count : 0,
      min: d.min===Infinity?0:d.min, max: d.max===-Infinity?0:d.max,
      total: d.count,
      pct5: d.count>0?(d.a5/d.count)*100:0,
      pctAcima: d.count>0?(d.acima/d.count)*100:0,
    })).sort((a,b)=>a.media-b.media)
  }, [espera])

  const mediaGeral = useMemo(() => {
    const tot = tempoVend.reduce((s,v)=>s+v.media*v.total,0)
    const cnt = tempoVend.reduce((s,v)=>s+v.total,0)
    return cnt>0 ? tot/cnt : 0
  }, [tempoVend])

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

      <KpiGrid cols={3}>
        <KpiCard label="Faturamento total" value={fmtBRL(kpis.total)} highlight />
        <KpiCard label="Pedidos (período)"  value={fmtNum(kpis.docs)}/>
        <KpiCard label="Vendedores ativos"  value={String(kpis.ativos)}/>
      </KpiGrid>

      <Card style={{marginBottom:16}}>
        <CardTitle>Ranking — faturamento ({ranked.length} vendedores)</CardTitle>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
          {ranked.map((v,i)=>{
            const pct = maxFat>0 ? (v.fat/maxFat)*100 : 0
            const isTop = i===0
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
                <div style={{textAlign:'right',minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:'DM Mono',color:isTop?'var(--blue-dark)':'var(--text-primary)'}}>{fmtBRL(v.fat)}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fmtNum(v.docs)} pedidos</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Tempo médio para início do atendimento (horário comercial)</CardTitle>
        {lesp ? <Spinner /> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              {['Vendedor','Leads','Média','Mín','Máx','Até 5min','+15min'].map((h,i)=>(
                <th key={i} style={{textAlign:i<1?'left':'right',padding:'4px 8px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {tempoVend.map((v,i)=>(
                <tr key={i} style={{borderBottom:i<tempoVend.length-1?'1px solid var(--border)':'none'}}>
                  <td style={{padding:'7px 8px',fontWeight:500}}>{v.nome}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtNum(v.total)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono',fontWeight:600,color:v.media>60?'var(--red)':v.media>15?'var(--amber)':'var(--green)'}}>{fmtMinutes(v.media)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtMinutes(v.min)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtMinutes(v.max)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right'}}><Badge value={`${v.pct5.toFixed(0)}%`} type={v.pct5>=50?'ok':'warn'}/></td>
                  <td style={{padding:'7px 8px',textAlign:'right'}}><Badge value={`${v.pctAcima.toFixed(0)}%`} type={v.pctAcima>50?'err':v.pctAcima>25?'warn':'ok'}/></td>
                </tr>
              ))}
              <tr style={{background:'#F8FAFC'}}>
                <td style={{padding:'7px 8px',fontWeight:700}}>Média geral</td>
                <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtNum(tempoVend.reduce((s,v)=>s+v.total,0))}</td>
                <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono',fontWeight:700,color:'var(--blue-dark)'}}>{fmtMinutes(mediaGeral)}</td>
                <td colSpan={4}/>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
