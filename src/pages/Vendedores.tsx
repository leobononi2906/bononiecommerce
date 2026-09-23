import React, { useMemo, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useFaturamentoPeriodo, useFaturamentoVendedorSemNotaPeriodo, useFaturamento6Meses, useDevolucaoPorVendedorPeriodo, useDevolucao6Meses, useLeads, useUmblerVendedores, getCanal } from '../hooks/useData'
import { KpiCard, Spinner, Card, CardTitle, AlertBanner, AvisoFalhaDeCarga, kpiValor } from '../components/ui'
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
const COR = ['var(--blue-dark)','var(--blue-mid)','var(--cyan-500)','var(--blue-600)','var(--blue-500)','var(--blue-400)','var(--cyan-400)','var(--cyan-300)','var(--blue-300)','var(--cyan-200)']
const COR_OUTROS = 'var(--border-strong)'

export default function Vendedores() {
  const { periodo } = usePeriodo()
  const { data: fatP,    loading: lfp,  error: efp,    reload: rfp    } = useFaturamentoPeriodo(periodo)
  const { data: vsfP,                  error: evsfp,  reload: rvsfp  } = useFaturamentoVendedorSemNotaPeriodo(periodo)
  const { data: fat6,    loading: lf6,  error: ef6,    reload: rf6    } = useFaturamento6Meses()
  const { data: dev6,                  error: edev6,  reload: rdev6  } = useDevolucao6Meses()
  const { data: devP,                 error: edp,    reload: rdp    } = useDevolucaoPorVendedorPeriodo(periodo)
  const { data: leads,                error: eleads, reload: rleads } = useLeads(periodo)
  const { data: umbler,               error: eumbler,reload: rumbler} = useUmblerVendedores()
  const [lastRefresh, setLastRefresh]    = useState(new Date())

  // Gráfico 6 meses por vendedor (canal vendedor) — top 10 nominais + Outros, inclui quem já saiu.
  // Líquido = bruto − devolução externa (mesmo critério do ranking abaixo e do card Home/Vendedores,
  // decisão do Leo em 2026-09-23: hoje ficava bruto "de propósito", agora desconta igual ao resto).
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
    ;(dev6 || []).forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'vendedor') return
      const { label, sortKey } = mesInfo(r.data_devolucao)
      const v = shortName(r.nome_vendedor)
      if (!byMes.has(sortKey)) byMes.set(sortKey, { label, vend: {} })
      byMes.get(sortKey)!.vend[v] = (byMes.get(sortKey)!.vend[v] || 0) - Number(r.valor_total)
      totais.set(v, (totais.get(v) || 0) - Number(r.valor_total))
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
  }, [fat6, dev6])

  useEffect(() => {
    const t = setInterval(() => { setLastRefresh(new Date()); rfp(); rvsfp(); rdp(); rleads(); rumbler(); rf6(); rdev6() }, 5*60*1000)
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

  // Vendedores de e-commerce (varejo) de fato: vínculo Umbler↔ERP ativo e não-interno.
  // Sem isso, faturamento_doc classificado como canal "vendedor" por getCanal() (que é o
  // default de quem não é site/marketplace) trazia vendedor de ATACADO e gente que já saiu —
  // nenhum dos dois tem vínculo aqui, e nem deveria: entram no ERP mas não são "vendedor e-commerce".
  const erpAtivos = useMemo(() => {
    const s = new Set<string>()
    ;(umbler||[]).forEach((u:any) => { if (u.ativo && !u.interno) s.add(String(u.id_vendedor_erp)) })
    return s
  }, [umbler])

  // Nome de exibição por id — `vw_vendas_sem_faturamento` às vezes traz "(sem vendedor)" mesmo
  // com vínculo Umbler↔ERP ativo (achado 21/09/2026, id 85193/MAYKELL); usa o nome cadastrado
  // no vínculo quando a linha não tem um nome de verdade. Mesmo tratamento de Home.tsx.
  const nomeAtivoPorId = useMemo(() => {
    const m = new Map<string,string>()
    ;(umbler||[]).forEach((u:any) => { if (u.ativo && !u.interno) m.set(String(u.id_vendedor_erp), u.nome_vendedor_erp) })
    return m
  }, [umbler])

  // Soma o já faturado com o finalizado no SGA que ainda não tem nota (pedido do Leo, 21/09/2026)
  // — mesmo tratamento de Home.tsx, pra Home e Vendedores não divergirem de novo (ver 18/09).
  const fatPVend = useMemo(() => [
    ...(fatP||[]),
    ...(vsfP||[]).map((r:any) => ({ ...r, nome_vendedor: nomeAtivoPorId.get(String(r.id_vendedor)) || r.nome_vendedor })),
  ], [fatP, vsfP, nomeAtivoPorId])

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
    const map = new Map<string,{nome:string;fat:number;docs:number;id:string}>()
    fatPVend.forEach((r:any) => {
      if (getCanal(r.nome_vendedor||'') !== 'vendedor') return
      const k = String(r.id_vendedor)
      if (!erpAtivos.has(k)) return
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
  }, [fatPVend, erpAtivos, erpToUmbler, leadsPorUmbler, devPorVendedor])

  const maxFat = ranked[0]?.liquido ?? 1

  const kpis = useMemo(() => {
    const total = ranked.reduce((s,v)=>s+v.fat,0)
    const devolucao = ranked.reduce((s,v)=>s+v.devolucao,0)
    const docs  = ranked.reduce((s,v)=>s+v.docs,0)
    const leadsVinculados = ranked.reduce((s,v)=>s+v.leads,0)
    // O denominador da conversão são TODOS os leads de vendedor (menos os internos), não só os
    // de quem tem vínculo Umbler↔ERP cadastrado. Contar só os vinculados enquanto o numerador
    // soma os pedidos de todo mundo inflava a taxa — o Pedro sozinho tirava ~700 leads da conta.
    const internos = new Set((umbler||[]).filter((u:any)=>u.interno).map((u:any)=>u.id_membro_umbler))
    const leadsTotal = (leads||[]).filter((l:any)=>l.id_vendedor && !internos.has(l.id_vendedor)).length
    const leadsSemVinculo = Math.max(0, leadsTotal - leadsVinculados)
    const conv = leadsTotal > 0 ? (docs/leadsTotal)*100 : 0
    return { total, devolucao, liquido: total-devolucao, docs, ativos: ranked.length,
             leadsTotal, leadsVinculados, leadsSemVinculo, conv }
  }, [ranked, leads, umbler])

  // Sem emoji (regra do design system): posição 1-3 ganha selo numerado com cor de destaque,
  // não um ícone que substitui o número — a posição continua legível sem depender só da cor.
  const medalBg = ['var(--feedback-warning-bg)', 'var(--surface-sunken)', 'var(--feedback-warning-bg)']
  const medalFg = ['var(--feedback-warning-fg)', 'var(--text-muted)', 'var(--action-primary-bg)']

  if (lfp) return <Spinner />

  return (
    <div style={{padding:'20px 24px',maxWidth:1200}}>
      <PageHeader title="Vendedores">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:11,color:'var(--text-hint)'}}>
            Atualizado às {lastRefresh.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--blue-mid)',background:'var(--feedback-info-bg)',padding:'4px 10px',borderRadius:20}}>
            <RefreshCw size={11}/> Auto 5min
          </span>
        </div>
      </PageHeader>

      <AvisoFalhaDeCarga fontes={[
        { nome: 'Faturamento',  error: efp,     reload: rfp },
        { nome: 'Vendedor finalizado sem nota', error: evsfp, reload: rvsfp },
        { nome: 'Devolução',    error: edp,     reload: rdp },
        { nome: 'Leads',        error: eleads,  reload: rleads },
        { nome: 'Vínculos Umbler', error: eumbler, reload: rumbler },
        { nome: 'Faturamento 6 meses', error: ef6, reload: rf6 },
        { nome: 'Devolução 6 meses', error: edev6, reload: rdev6 },
      ]} />

      <div style={{marginBottom:14}}>
        <AlertBanner type="warning">
          <span>
            <strong>Faturamento aqui soma nota fiscal emitida + pedido já finalizado no SGA que ainda não tem nota.</strong>{' '}
            Pedido finalizado entra pela data do próprio pedido; pedido ainda "aberto" no SGA não entra até finalizar e faturar,
            e pode aparecer em dias diferentes nos dois sistemas.
          </span>
        </AlertBanner>
      </div>

      <KpiGrid cols={4}>
        <KpiCard label="Faturamento (bruto)" value={kpiValor(efp, lfp, fmtBRL(kpis.total))} />
        <KpiCard label="Devolução externa"   value={kpiValor(edp, lfp, '− '+fmtBRL(kpis.devolucao))}
          sub={!edp&&kpis.total>0?`${(kpis.devolucao/kpis.total*100).toFixed(1)}% do bruto`:undefined}
          trend={kpis.devolucao>0?'down':'neutral'} />
        <KpiCard label="Faturamento líquido" value={kpiValor(efp||edp, lfp, fmtBRL(kpis.liquido))} highlight />
        <KpiCard label="Pedidos (período)"    value={kpiValor(efp, lfp, fmtNum(kpis.docs))} />
      </KpiGrid>

      <KpiGrid cols={2}>
        <KpiCard label="Leads Umbler"    value={kpiValor(eleads, lfp, fmtNum(kpis.leadsTotal))}
          sub={!eleads&&kpis.leadsSemVinculo>0 ? `${fmtNum(kpis.leadsSemVinculo)} sem vínculo Umbler↔ERP` : undefined} />
        <KpiCard label="Conversão geral"  value={kpiValor(eleads||efp, lfp, kpis.conv>0 ? fmtPct(kpis.conv,1) : '–')}
          sub={!eleads&&kpis.leadsTotal>0 ? `${kpis.docs} pedidos ÷ ${fmtNum(kpis.leadsTotal)} leads` : undefined} />
      </KpiGrid>

      {kpis.leadsSemVinculo > 0 && (
        <div style={{marginBottom:14}}>
          <AlertBanner type="warning">
            <span>
              <strong>{fmtNum(kpis.leadsSemVinculo)} leads do período são de atendentes sem vínculo Umbler↔ERP.</strong>{' '}
              Eles entram no total e na conversão geral, mas <strong>não aparecem por vendedor</strong> no ranking
              abaixo (linha com “–” na coluna Conversão). Cadastre o vínculo em Configurações → Umbler.
            </span>
          </AlertBanner>
        </div>
      )}

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
              <div key={v.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,border:`1px solid ${isTop?'var(--blue-dark)':'var(--border)'}`,background:isTop?'linear-gradient(135deg,var(--blue-50),var(--cyan-50))':'var(--surface)'}}>
                <div style={{width:32,textAlign:'center'}}>
                  {i<3
                    ? <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:24,height:24,borderRadius:'50%',fontSize:13,fontWeight:700,background:medalBg[i],color:medalFg[i]}}>{i+1}</span>
                    : <span style={{fontSize:15,fontWeight:700,color:'var(--text-hint)'}}>{i+1}</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:'var(--text-primary)'}}>{shortName(v.nome)}</div>
                  <div style={{marginTop:5,height:5,background:'var(--surface-sunken)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:isTop?'var(--blue-dark)':'var(--blue-mid)',borderRadius:3,transition:'width 0.5s ease'}}/>
                  </div>
                </div>
                {/* Conversão */}
                <div style={{textAlign:'center',minWidth:80}}>
                  <div style={{fontSize:11,color:'var(--text-hint)',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>Conversão</div>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:'var(--font-mono)',color:convColor}}>
                    {v.conversao != null ? fmtPct(v.conversao,1) : '–'}
                  </div>
                  {v.leads > 0 && (
                    <div style={{fontSize:10,color:'var(--text-hint)'}}>{v.docs}p ÷ {fmtNum(v.leads)}l</div>
                  )}
                </div>
                {/* Devolução */}
                <div style={{textAlign:'right',minWidth:90}}>
                  <div style={{fontSize:11,color:'var(--text-hint)',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>Devolução</div>
                  <div style={{fontSize:13,fontWeight:600,fontFamily:'var(--font-mono)',color:v.devolucao>0?'var(--red)':'var(--text-hint)'}}>
                    {v.devolucao>0?'− '+fmtBRL(v.devolucao):'–'}
                  </div>
                </div>
                {/* Faturamento líquido */}
                <div style={{textAlign:'right',minWidth:120}}>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:'var(--font-mono)',color:isTop?'var(--blue-dark)':'var(--text-primary)'}}>{fmtBRL(v.liquido)}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fmtNum(v.docs)} pedidos</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Faturamento líquido por vendedor — últimos 6 meses <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— já desconta devolução externa · inclui vendedores que já saíram</span></CardTitle>
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
