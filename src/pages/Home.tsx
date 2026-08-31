import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useFaturamento6Meses, useFaturamentoPeriodo, useFaturamentoPeriodoAnterior,
  useDevolucao6Meses, useDevolucaoPeriodo, useDevolucaoPeriodoAnterior,
  useSubgrupos, useLeads, useMetaAds, getCanal } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { fmtBRL, fmtNum, shortName } from '../lib/fmt'
import { usePeriodo } from '../components/layout/AppShell'
import type { Periodo } from '../types'

// Tooltip do gráfico por vendedor: só mostra quem teve faturamento no mês (esconde os zerados),
// do maior pro menor.
function TooltipVendedores({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const itens = payload.filter((p:any) => (p.value||0) > 0).sort((a:any,b:any)=> b.value - a.value)
  if (!itens.length) return null
  return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px',fontSize:12,boxShadow:'0 4px 16px rgba(15,29,53,.14)',minWidth:170}}>
      <div style={{fontWeight:700,marginBottom:5}}>{label}</div>
      {itens.map((p:any)=>(
        <div key={p.dataKey} style={{display:'flex',alignItems:'center',gap:6,margin:'3px 0'}}>
          <span style={{width:9,height:9,borderRadius:2,background:p.color,display:'inline-block',flexShrink:0}}/>
          <span style={{flex:1,whiteSpace:'nowrap'}}>{p.dataKey}</span>
          <span style={{fontFamily:'DM Mono',fontWeight:600,marginLeft:10}}>{fmtBRL(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Retorna { label: "Jan/26", sortKey: "2026-01" }
function mesInfo(iso: string): { label: string; sortKey: string } {
  const d = new Date(iso + 'T12:00:00')
  const label = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()]
    + '/' + String(d.getFullYear()).slice(2)
  const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  return { label, sortKey }
}

export default function Home() {
  const { periodo } = usePeriodo()
  const { data: fat6,   loading: lf6 }  = useFaturamento6Meses()
  const { data: fatP,   loading: lfp }  = useFaturamentoPeriodo(periodo)
  const { data: fatAnt                } = useFaturamentoPeriodoAnterior(periodo)
  const { data: dev6,   loading: ld6 }  = useDevolucao6Meses()
  const { data: devP                  } = useDevolucaoPeriodo(periodo)
  const { data: devAnt                } = useDevolucaoPeriodoAnterior(periodo)
  const { data: subs,   loading: lsub } = useSubgrupos(periodo)
  const { data: leads,  loading: ll }   = useLeads(periodo)
  const { data: metaAds, loading: lmeta } = useMetaAds(periodo)

  // Soma faturamento bruto por canal
  function somaCanais(rows: any[] | null) {
    let vendedor=0, site=0, marketplace=0
    ;(rows||[]).forEach((r:any) => {
      const f = Number(r.faturamento_doc) || 0
      const canal = getCanal(r.nome_vendedor||'')
      if (canal==='marketplace') marketplace+=f
      else if (canal==='site') site+=f
      else vendedor+=f
    })
    return { vendedor, site, marketplace, total: vendedor+site+marketplace }
  }
  // Soma devolução externa por canal (mesma classificação getCanal da venda de origem)
  function somaDevolucao(rows: any[] | null) {
    let vendedor=0, site=0, marketplace=0
    ;(rows||[]).forEach((r:any) => {
      const v = Number(r.valor_total) || 0
      const canal = getCanal(r.nome_vendedor||'')
      if (canal==='marketplace') marketplace+=v
      else if (canal==='site') site+=v
      else vendedor+=v
    })
    return { vendedor, site, marketplace, total: vendedor+site+marketplace }
  }
  const canais    = useMemo(() => somaCanais(fatP),   [fatP])
  const canaisAnt = useMemo(() => somaCanais(fatAnt), [fatAnt])
  const devol     = useMemo(() => somaDevolucao(devP),   [devP])
  const devolAnt  = useMemo(() => somaDevolucao(devAnt), [devAnt])
  // Faturamento líquido = bruto − devolução externa
  const liq       = { vendedor: canais.vendedor-devol.vendedor, site: canais.site-devol.site,
                      marketplace: canais.marketplace-devol.marketplace, total: canais.total-devol.total }
  const liqAnt    = { total: canaisAnt.total-devolAnt.total }
  const taxaDev   = canais.total>0 ? (devol.total/canais.total)*100 : 0

  // "+R$ 12k (+8%) vs anterior" — para o sub dos cards
  function cmp(atual: number, ant: number): { sub: string; trend: 'up'|'down'|'neutral' } {
    const d = atual - ant
    if (ant === 0) return { sub: 'sem base anterior', trend: 'neutral' }
    const pct = (d / ant) * 100
    const sinal = d >= 0 ? '+' : '−'
    return { sub: `${sinal}${fmtBRL(Math.abs(d))} (${sinal}${Math.abs(pct).toFixed(0)}%) vs anterior`, trend: d > 0 ? 'up' : d < 0 ? 'down' : 'neutral' }
  }

  // ROAS geral / CAC — base do Leo: o tráfego (Meta Ads) alimenta vendas TANTO do site quanto dos
  // vendedores (fechadas por WhatsApp), então o retorno real do investimento é
  // (faturamento site + faturamento vendedores) ÷ investimento em tráfego — não só a receita
  // atribuída campanha a campanha (essa fica na aba "Campanhas — ROI real", é um recorte mais estreito).
  // Investimento e pedidos seguem o MESMO período selecionado na tela (não janela fixa de 60d).
  const roiTotais = useMemo(() => {
    const investimento = (metaAds||[]).reduce((s,r:any)=>s+r.investimento,0)
    const receita = canais.site + canais.vendedor
    let pedidos = 0
    ;(fatP||[]).forEach((r:any) => { const c = getCanal(r.nome_vendedor||''); if (c==='site' || c==='vendedor') pedidos++ })
    return {
      investimento, receita, pedidos,
      roas: investimento>0 ? receita/investimento : 0,
      cac: investimento>0 && pedidos>0 ? investimento/pedidos : 0,
    }
  }, [metaAds, canais.site, canais.vendedor, fatP])

  // Ticket médio do site no período selecionado
  const ticketSite = useMemo(() => {
    let count = 0
    ;(fatP||[]).forEach((r:any) => { if (getCanal(r.nome_vendedor||'')==='site') count++ })
    return count>0 ? canais.site/count : 0
  }, [fatP, canais.site])

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

  // Gráfico 6 meses — divisão mês a mês por vendedor (top 8 nominais + "Outros")
  const fat6Vend = useMemo(() => {
    if (!fat6) return { chartData:[], series:[] as string[] }
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
    const TOP = 8
    // "Principais" = vendedores que venderam no MÊS mais recente (ativos agora), ordenados
    // pelo total do período. Quem não vendeu no mês atual (ex-vendedores) cai em "Outros" —
    // assim somem os zerados e aparece quem está vendendo de fato (ex.: vendedor novo, Pedro).
    const maxKey = [...byMes.keys()].sort().pop()
    const ativosNoMes = new Set<string>()
    if (maxKey) Object.entries(byMes.get(maxKey)!.vend).forEach(([n,v]) => { if ((v as number) > 0) ativosNoMes.add(n) })
    const nomesOrd = [...totais.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>k)
    let principais = nomesOrd.filter(n => ativosNoMes.has(n)).slice(0, TOP)
    if (!principais.length) principais = nomesOrd.slice(0, TOP)  // fallback: mês sem vendas
    const temOutros = nomesOrd.some(n => !principais.includes(n))
    const series = temOutros ? [...principais, 'Outros'] : principais
    // Ordena cronologicamente pelo sortKey (yyyy-mm); cada mês soma o restante em "Outros"
    const chartData = [...byMes.entries()]
      .sort((a,b)=>a[0]<b[0]?-1:1)
      .map(([,{label,vend}]) => {
        const row:any = { mes: label }
        principais.forEach(n => { row[n] = vend[n] || 0 })
        if (temOutros) row['Outros'] = Object.entries(vend).reduce((s,[n,val])=> principais.includes(n) ? s : s+val, 0)
        return row
      })
    return { chartData, series }
  }, [fat6])

  // Tabela 6 meses por departamento — ordenada cronologicamente
  const fat6Depto = useMemo(() => {
    if (!fat6) return []
    type Row = { sortKey:string; mes:string; Vendedores:number; Marketplace:number; Site:number; total:number; devolucao:number; liquido:number }
    const map = new Map<string,Row>()
    const ensure = (iso:string) => {
      const { label, sortKey } = mesInfo(iso)
      if (!map.has(sortKey)) map.set(sortKey,{sortKey,mes:label,Vendedores:0,Marketplace:0,Site:0,total:0,devolucao:0,liquido:0})
      return map.get(sortKey)!
    }
    fat6.forEach((r:any) => {
      const f = Number(r.faturamento_doc)
      const canal = getCanal(r.nome_vendedor||'')
      const row = ensure(r.data_faturamento)
      if (canal==='vendedor') row.Vendedores+=f
      else if (canal==='marketplace') row.Marketplace+=f
      else row.Site+=f
      row.total+=f
    })
    // Devolução externa por mês (data_devolucao)
    ;(dev6||[]).forEach((r:any) => { ensure(r.data_devolucao).devolucao += Number(r.valor_total)||0 })
    // Ordena cronologicamente e calcula líquido = total − devolução
    const rows = [...map.values()].sort((a,b)=>a.sortKey<b.sortKey?-1:1)
    rows.forEach(r => { r.liquido = r.total - r.devolucao })
    return rows
  }, [fat6, dev6])

  const COLORS = ['#1A3A8F','#0077CC','#00AAEE','#2563EB','#3B82F6','#60A5FA','#38BDF8','#93C5FD']
  const COR_OUTROS = '#CBD5E1'

  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate()
  const mesParcial = periodo === 'mes_atual' && diaAtual < diasNoMes

  return (
    <div style={{ padding:'20px 24px', maxWidth:1400 }}>
      <PageHeader title="Visão Geral" />

      {mesParcial && !lfp && (
        <div style={{ background:'var(--amber-bg)', color:'var(--amber)', border:'1px solid #FCE3B0', borderRadius:'var(--radius)', padding:'9px 14px', marginBottom:14, fontSize:12.5 }}>
          📅 Mês em andamento ({diaAtual}/{diasNoMes} dias) — a comparação "vs anterior" é com o mês passado <strong>cheio</strong>, então a queda é esperada. Escolha "Mês anterior" no filtro para comparar meses fechados.
        </div>
      )}

      <SectionLabel>Faturamento por canal — período selecionado</SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Faturamento Vendedores"  value={lfp?'…':fmtBRL(canais.vendedor)} highlight
          {...(lfp?{}:cmp(canais.vendedor, canaisAnt.vendedor))} />
        <KpiCard label="Faturamento Site"         value={lfp?'…':fmtBRL(canais.site)}
          {...(lfp?{}:cmp(canais.site, canaisAnt.site))} />
        <KpiCard label="Faturamento Marketplace"  value={lfp?'…':fmtBRL(canais.marketplace)}
          {...(lfp?{}:cmp(canais.marketplace, canaisAnt.marketplace))} />
      </KpiGrid>

      <SectionLabel>Líquido após devolução externa — período selecionado</SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Total ONLINE (bruto)"   value={lfp?'…':fmtBRL(canais.total)}
          {...(lfp?{}:cmp(canais.total, canaisAnt.total))} />
        <KpiCard label="Devolução externa"       value={lfp?'…':('− '+fmtBRL(devol.total))}
          sub={lfp?undefined:`${taxaDev.toFixed(1)}% do bruto`} trend={devol.total>0?'down':'neutral'} />
        <KpiCard label="Total ONLINE líquido"    value={lfp?'…':fmtBRL(liq.total)} highlight
          {...(lfp?{}:cmp(liq.total, liqAnt.total))} />
      </KpiGrid>

      <SectionLabel>Tráfego — retorno sobre investimento <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— o tráfego (Meta Ads) alimenta vendas do site E dos vendedores (fechadas por WhatsApp); ROAS/CAC = (site + vendedores) ÷ investimento em tráfego, período selecionado</span></SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Faturamento do site"  value={lfp?'…':fmtBRL(canais.site)} highlight />
        <KpiCard label="ROAS geral"           value={(lfp||lmeta)?'…':(roiTotais.roas.toFixed(1)+'x')}
          sub={(lfp||lmeta)?undefined:`(site+vend.) ÷ tráfego (${fmtBRL(roiTotais.investimento)})`} />
        <KpiCard label="CAC"                  value={(lfp||lmeta)?'…':(roiTotais.pedidos>0?fmtBRL(roiTotais.cac):'–')}
          sub={(lfp||lmeta)?undefined:`${roiTotais.pedidos} pedidos (site+vend.)`} />
        <KpiCard label="Ticket médio (site)"  value={lfp?'…':(ticketSite>0?fmtBRL(ticketSite):'–')} />
      </KpiGrid>

      <KpiGrid cols={3}>
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
                  <Tooltip content={<TooltipVendedores/>}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  {fat6Vend.series.map((v,i)=>(
                    <Bar key={v} dataKey={v} stackId="a" fill={v==='Outros'?COR_OUTROS:COLORS[i%COLORS.length]}
                      radius={i===fat6Vend.series.length-1?[4,4,0,0]:undefined}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <CardTitle>Por departamento — últimos 6 meses <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— líquido já desconta a devolução externa</span></CardTitle>
        {lf6 ? <Spinner /> : (
          <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:640}}>
            <thead><tr>
              {['Mês','Vendedores','Marketplace','Site','Total bruto','Devolução','Líquido'].map((h,i)=>(
                <th key={i} style={{textAlign:i<1?'left':'right',padding:'5px 8px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {fat6Depto.map((r,i)=>(
                <tr key={i} style={{borderBottom:i<fat6Depto.length-1?'1px solid var(--border)':'none'}}>
                  <td style={{padding:'7px 8px',fontWeight:500}}>{r.mes}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.Vendedores)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.Marketplace)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.Site)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono'}}>{fmtBRL(r.total)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono',color:r.devolucao>0?'var(--red)':'var(--text-hint)'}}>{r.devolucao>0?'− '+fmtBRL(r.devolucao):'–'}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'DM Mono',fontWeight:600,color:'var(--blue-dark)'}}>{fmtBRL(r.liquido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  )
}
