import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Calendar, Clock } from 'lucide-react'
import { useFaturamento6Meses, useFaturamentoPeriodo, useFaturamentoPeriodoAnterior,
  useFaturamentoSitePeriodo, useFaturamentoSitePeriodoAnterior,
  useMarketplaceCanais, useMktCanais,
  useDevolucao6Meses, useDevolucaoPeriodo, useDevolucaoPeriodoAnterior,
  useSubgrupos, useLeads, useMetaAds, useUmblerVendedores, getCanal, getPeriodRange, diasComPedidoRepresado } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel, AlertBanner, AvisoFalhaDeCarga, kpiValor } from '../components/ui'
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
    <div style={{background:'var(--surface-card)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px',fontSize:12,boxShadow:'0 4px 16px rgba(15,29,53,.14)',minWidth:170}}>
      <div style={{fontWeight:700,marginBottom:5}}>{label}</div>
      {itens.map((p:any)=>(
        <div key={p.dataKey} style={{display:'flex',alignItems:'center',gap:6,margin:'3px 0'}}>
          <span style={{width:9,height:9,borderRadius:2,background:p.color,display:'inline-block',flexShrink:0}}/>
          <span style={{flex:1,whiteSpace:'nowrap'}}>{p.dataKey}</span>
          <span style={{fontFamily:'var(--font-mono)',fontWeight:600,marginLeft:10}}>{fmtBRL(p.value)}</span>
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
  const { data: fat6,   loading: lf6,  error: ef6,   reload: rf6 }   = useFaturamento6Meses()
  const { data: fatP,   loading: lfp,  error: efp,   reload: rfp }   = useFaturamentoPeriodo(periodo)
  const { data: fatAnt,              error: efant, reload: rfant } = useFaturamentoPeriodoAnterior(periodo)
  // Faturamento do site pela DATA DO PEDIDO — separado de `fatP`/`fatAnt` (que contam pela
  // data de faturamento) porque o ERP fatura o site em lote, às vezes com meses de atraso.
  // Ver docs/STATUS.md (17/09/2026).
  const { data: siteP,   loading: lsp,  error: esp,   reload: rsp }   = useFaturamentoSitePeriodo(periodo)
  const { data: siteAnt,             error: esant, reload: rsant }  = useFaturamentoSitePeriodoAnterior(periodo)
  // Faturamento do marketplace, mesma lógica: pela data do PEDIDO, não pela de faturamento —
  // achado em 17/09/2026 (mesmo dia do site): 726 de 1.360 docs de set/26 eram pedido de
  // abr-ago represado, faturado em lote (229 de uma vez em 11/09). Ver docs/STATUS.md.
  const { data: mktIdsData, loading: lmkids, error: emkids } = useMktCanais()
  const mktIds = mktIdsData?.map(c => c.id) ?? null
  const { data: mkt,    loading: lmkt, error: emkt,  reload: rmkt }  = useMarketplaceCanais(periodo, mktIds)
  const lmktTotal = lmkt || lmkids || !mktIdsData
  const emktTotal = emkt || emkids
  const { data: dev6,                error: ed6,   reload: rd6 }   = useDevolucao6Meses()
  const { data: devP,   loading: ldp, error: edp,   reload: rdp }   = useDevolucaoPeriodo(periodo)
  const { data: devAnt,              error: edant, reload: rdant } = useDevolucaoPeriodoAnterior(periodo)
  const { data: subs,   loading: lsub, error: esub,  reload: rsub }  = useSubgrupos(periodo)
  const { data: leads,  loading: ll,   error: eleads, reload: rleads } = useLeads(periodo)
  const { data: metaAds, loading: lmeta, error: emeta, reload: rmeta } = useMetaAds(periodo)
  const { data: umbler } = useUmblerVendedores()

  // Um KPI que soma bruto e devolução só é confiável se todas as cargas vieram.
  const eTotal = efp || edp || esp || emktTotal
  const eTotalAnt = efant || edant || esant || emktTotal

  // Vendedores de e-commerce (varejo) de fato: vínculo Umbler↔ERP ativo e não-interno.
  // Sem isso, canal "vendedor" (default de getCanal para quem não é site/marketplace) somava
  // vendedor de ATACADO e gente que já saiu — nenhum dos dois tem vínculo aqui (achado 18/09,
  // ver docs/STATUS.md e o mesmo fix em Vendedores.tsx).
  const erpAtivos = useMemo(() => {
    const s = new Set<string>()
    ;(umbler||[]).forEach((u:any) => { if (u.ativo && !u.interno) s.add(String(u.id_vendedor_erp)) })
    return s
  }, [umbler])

  // Soma faturamento bruto por canal
  function somaCanais(rows: any[] | null) {
    let vendedor=0, site=0, marketplace=0
    ;(rows||[]).forEach((r:any) => {
      const f = Number(r.faturamento_doc) || 0
      const canal = getCanal(r.nome_vendedor||'')
      if (canal==='marketplace') marketplace+=f
      else if (canal==='site') site+=f
      else if (erpAtivos.has(String(r.id_vendedor))) vendedor+=f
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
      else if (erpAtivos.has(String(r.id_vendedor))) vendedor+=v
    })
    return { vendedor, site, marketplace, total: vendedor+site+marketplace }
  }
  const canaisBruto    = useMemo(() => somaCanais(fatP),   [fatP, erpAtivos])
  const canaisAntBruto = useMemo(() => somaCanais(fatAnt), [fatAnt, erpAtivos])
  // Site pela data do pedido substitui o site "por data de faturamento" nos dois; vendedor e
  // marketplace continuam como estavam (não fizeram parte desta correção — ver escopo em
  // docs/STATUS.md 17/09/2026).
  const siteReal    = useMemo(() => (siteP||[]).reduce((s,r:any)=>s+(Number(r.faturamento_doc)||0),0), [siteP])
  const siteRealAnt = useMemo(() => (siteAnt||[]).reduce((s,r:any)=>s+(Number(r.faturamento_doc)||0),0), [siteAnt])
  const mktReal    = mkt?.totalAtual ?? 0
  const mktRealAnt = mkt?.totalAnt ?? 0
  const canais    = { ...canaisBruto, site: siteReal, marketplace: mktReal, total: canaisBruto.vendedor + siteReal + mktReal }
  const canaisAnt = { ...canaisAntBruto, site: siteRealAnt, marketplace: mktRealAnt, total: canaisAntBruto.vendedor + siteRealAnt + mktRealAnt }
  const devol     = useMemo(() => somaDevolucao(devP),   [devP, erpAtivos])
  const devolAnt  = useMemo(() => somaDevolucao(devAnt), [devAnt, erpAtivos])
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
    let pedidos = (siteP||[]).length
    ;(fatP||[]).forEach((r:any) => {
      if (getCanal(r.nome_vendedor||'')==='vendedor' && erpAtivos.has(String(r.id_vendedor))) pedidos++
    })
    return {
      investimento, receita, pedidos,
      roas: investimento>0 ? receita/investimento : 0,
      cac: investimento>0 && pedidos>0 ? investimento/pedidos : 0,
    }
  }, [metaAds, canais.site, canais.vendedor, fatP, siteP, erpAtivos])

  // Quantos dias do período JÁ ACONTECERAM mas ainda não têm carga de Meta Ads.
  // ROAS e CAC dividem receita do período inteiro por investimento só até o último dia carregado:
  // enquanto a carga estiver atrasada os dois ficam inflados, e sem este aviso parecem resultado.
  const metaAtraso = useMemo(() => {
    const vazio = { dias: 0, ultimo: '' }
    if (emeta || lmeta) return vazio
    const fimDoPeriodo = getPeriodRange(periodo).end
    const hoje = new Date().toISOString().slice(0,10)
    const fimEsperado = fimDoPeriodo < hoje ? fimDoPeriodo : hoje
    const ultimo = (metaAds||[]).reduce<string>((max,r:any) => r.data > max ? r.data : max, '')
    if (!ultimo) return vazio
    const dias = Math.round((Date.parse(fimEsperado) - Date.parse(ultimo)) / 86400000)
    return dias > 0 ? { dias, ultimo } : vazio
  }, [metaAds, emeta, lmeta, periodo])
  const diasSemMetaAds = metaAtraso.dias
  const ultimoDiaMetaAds = metaAtraso.ultimo
    ? metaAtraso.ultimo.slice(8,10) + '/' + metaAtraso.ultimo.slice(5,7)
    : ''

  // Ticket médio do site no período selecionado (mesma base — pedido criado no período)
  const ticketSite = useMemo(() => {
    const count = (siteP||[]).length
    return count>0 ? canais.site/count : 0
  }, [siteP, canais.site])

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

  const COLORS = ['var(--blue-dark)','var(--blue-mid)','var(--cyan-500)','var(--blue-600)','var(--blue-500)','var(--blue-400)','var(--cyan-400)','var(--blue-300)']
  const COR_OUTROS = 'var(--border-strong)'

  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate()
  const mesParcial = periodo === 'mes_atual' && diaAtual < diasNoMes

  // Pedido represado: hoje (e às vezes ontem) aparecem com bem menos pedido do que o normal
  // porque o ERP ainda não terminou de faturar — não é queda de venda. Achado em 17/09/2026:
  // marketplace foi de ~40 pedidos/dia pra 4 no dia corrente. Ver docs/STATUS.md.
  const canaisRepresados = useMemo(() => {
    if (lsp || lmktTotal) return [] as string[]
    const fimPeriodo = getPeriodRange(periodo).end
    const nomes: string[] = []
    if (diasComPedidoRepresado((siteP||[]).map((r:any)=>r.data_criacao), fimPeriodo).length) nomes.push('Site')
    if (diasComPedidoRepresado(mkt?.datasCriacao||[], fimPeriodo).length) nomes.push('Marketplace')
    return nomes
  }, [siteP, mkt, lsp, lmktTotal, periodo])

  return (
    <div style={{ padding:'20px 24px', maxWidth:1400 }}>
      <PageHeader title="Visão Geral" />

      {mesParcial && !lfp && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'var(--amber-bg)', color:'var(--amber)', border:'1px solid var(--feedback-warning-border)', borderRadius:'var(--radius)', padding:'9px 14px', marginBottom:14, fontSize:12.5 }}>
          <Calendar size={14} style={{flexShrink:0, marginTop:2}} aria-hidden="true" />
          <span>Mês em andamento ({diaAtual}/{diasNoMes} dias) — a comparação "vs anterior" é com o mês passado <strong>cheio</strong>, então a queda é esperada. Escolha "Mês anterior" no filtro para comparar meses fechados.</span>
        </div>
      )}

      {canaisRepresados.length > 0 && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'var(--amber-bg)', color:'var(--amber)', border:'1px solid var(--feedback-warning-border)', borderRadius:'var(--radius)', padding:'9px 14px', marginBottom:14, fontSize:12.5 }}>
          <Clock size={14} style={{flexShrink:0, marginTop:2}} aria-hidden="true" />
          <span>
            <strong>Pedido de hoje represado no faturamento: {canaisRepresados.join(' e ')}.</strong>{' '}
            O ERP não fatura o pedido no mesmo dia — os últimos 1-2 dias deste período aparecem bem abaixo do normal
            porque o SGA ainda não terminou de processar, não porque a venda caiu. O valor deve subir sozinho nos próximos dias.
          </span>
        </div>
      )}

      <AvisoFalhaDeCarga fontes={[
        { nome: 'Faturamento do período',  error: efp,    reload: rfp },
        { nome: 'Faturamento do período anterior', error: efant, reload: rfant },
        { nome: 'Faturamento do site (data do pedido)', error: esp, reload: rsp },
        { nome: 'Faturamento do site anterior (data do pedido)', error: esant, reload: rsant },
        { nome: 'Faturamento do marketplace (data do pedido)', error: emkt, reload: rmkt },
        { nome: 'Canais de marketplace', error: emkids },
        { nome: 'Devolução do período',    error: edp,    reload: rdp },
        { nome: 'Devolução do período anterior', error: edant, reload: rdant },
        { nome: 'Faturamento 6 meses',     error: ef6,    reload: rf6 },
        { nome: 'Devolução 6 meses',       error: ed6,    reload: rd6 },
        { nome: 'Subgrupos',               error: esub,   reload: rsub },
        { nome: 'Leads',                   error: eleads, reload: rleads },
        { nome: 'Meta Ads',                error: emeta,  reload: rmeta },
      ]} />

      <SectionLabel>Faturamento por canal — período selecionado <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— valor principal bruto, líquido já desconta devolução externa</span></SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Faturamento Vendedores"  value={kpiValor(efp, lfp, fmtBRL(canais.vendedor))} highlight
          liquido={(lfp||edp)?undefined:fmtBRL(liq.vendedor)}
          {...(lfp||eTotalAnt?{}:cmp(canais.vendedor, canaisAnt.vendedor))} />
        <KpiCard label="Faturamento Site"         value={kpiValor(esp, lsp, fmtBRL(canais.site))}
          liquido={(lsp||edp)?undefined:fmtBRL(liq.site)}
          {...(lsp||eTotalAnt?{}:cmp(canais.site, canaisAnt.site))} />
        <KpiCard label="Faturamento Marketplace"  value={kpiValor(emktTotal, lmktTotal, fmtBRL(canais.marketplace))}
          liquido={(lmktTotal||edp)?undefined:fmtBRL(liq.marketplace)}
          {...(lmktTotal||eTotalAnt?{}:cmp(canais.marketplace, canaisAnt.marketplace))} />
      </KpiGrid>

      <SectionLabel>Líquido após devolução externa — período selecionado</SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Total ONLINE (bruto)"   value={kpiValor(efp||esp||emktTotal, lfp||lsp||lmktTotal, fmtBRL(canais.total))}
          {...((lfp||lsp||lmktTotal)||eTotalAnt?{}:cmp(canais.total, canaisAnt.total))} />
        <KpiCard label="Devolução externa"       value={kpiValor(edp, ldp, '− '+fmtBRL(devol.total))}
          sub={ldp||eTotal?undefined:`${taxaDev.toFixed(1)}% do bruto`} trend={devol.total>0?'down':'neutral'} />
        <KpiCard label="Total ONLINE líquido"    value={kpiValor(eTotal, lfp||lsp||lmktTotal||ldp, fmtBRL(liq.total))} highlight
          {...((lfp||lsp||lmktTotal||ldp)||eTotal||eTotalAnt?{}:cmp(liq.total, liqAnt.total))} />
      </KpiGrid>

      <SectionLabel>Tráfego — retorno sobre investimento <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— o tráfego (Meta Ads) alimenta vendas do site E dos vendedores (fechadas por WhatsApp); ROAS/CAC = (site + vendedores) ÷ investimento em tráfego, período selecionado</span></SectionLabel>

      {diasSemMetaAds > 0 && (
        <div style={{ marginBottom: 10 }}>
          <AlertBanner type="warning">
            <span>
              <strong>Investimento em tráfego incompleto: faltam {diasSemMetaAds} dia{diasSemMetaAds>1?'s':''} de carga do Meta Ads.</strong>{' '}
              A receita abaixo é do período inteiro e o investimento só vai até {ultimoDiaMetaAds} —
              então <strong>ROAS está alto demais e CAC baixo demais</strong>. Não decida por estes dois até a carga voltar.
            </span>
          </AlertBanner>
        </div>
      )}

      <KpiGrid cols={4}>
        <KpiCard label="Faturamento do site"  value={kpiValor(esp, lsp, fmtBRL(canais.site))} highlight />
        <KpiCard label="ROAS geral"           value={kpiValor(efp||esp||emeta, lfp||lsp||lmeta, roiTotais.roas.toFixed(1)+'x')}
          sub={(lfp||lsp||lmeta||efp||esp||emeta)?undefined:`(site+vend.) ÷ tráfego (${fmtBRL(roiTotais.investimento)})${diasSemMetaAds>0?' · parcial':''}`} />
        <KpiCard label="CAC"                  value={kpiValor(efp||esp||emeta, lfp||lsp||lmeta, roiTotais.pedidos>0?fmtBRL(roiTotais.cac):'–')}
          sub={(lfp||lsp||lmeta||efp||esp||emeta)?undefined:`${roiTotais.pedidos} pedidos (site+vend.)${diasSemMetaAds>0?' · parcial':''}`} />
        <KpiCard label="Ticket médio (site)"  value={kpiValor(esp, lsp, ticketSite>0?fmtBRL(ticketSite):'–')} />
      </KpiGrid>

      <KpiGrid cols={3}>
        <KpiCard label="Top subgrupo"   value={kpiValor(esub, lsub, topSubs[0]?.nome||'–')} sub={topSubs[0]&&!esub?fmtBRL(topSubs[0].fat):''} />
        <KpiCard label="Leads (período)" value={kpiValor(eleads, ll, fmtNum(leads?.length??0))} />
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Top subgrupos — faturamento</CardTitle>
            {lsub ? <Spinner /> : esub ? (
              <div style={{textAlign:'center',color:'var(--red)',padding:24,fontSize:13}}>
                Não foi possível carregar os subgrupos — veja o aviso no topo da página.
              </div>
            ) : (
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
                  <td style={{padding:'6px 6px',textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12}}>{fmtBRL(v.fat)}</td>
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
            {lf6 ? <Spinner /> : ef6 ? (
              <div style={{textAlign:'center',color:'var(--red)',padding:24,fontSize:13}}>
                Não foi possível carregar os 6 meses — veja o aviso no topo da página.
              </div>
            ) : (
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
        <CardTitle>Por departamento — últimos 6 meses <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— líquido já desconta a devolução externa{ed6 && !ef6 ? ' · devolução não carregou: a coluna Devolução e o Líquido estão incompletos' : ''}</span></CardTitle>
        {lf6 ? <Spinner /> : ef6 ? (
          <div style={{textAlign:'center',color:'var(--red)',padding:24,fontSize:13}}>
            Não foi possível carregar os 6 meses — veja o aviso no topo da página.
          </div>
        ) : (
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
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fmtBRL(r.Vendedores)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fmtBRL(r.Marketplace)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fmtBRL(r.Site)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'var(--font-mono)'}}>{fmtBRL(r.total)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'var(--font-mono)',color:r.devolucao>0?'var(--red)':'var(--text-hint)'}}>{r.devolucao>0?'− '+fmtBRL(r.devolucao):'–'}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--blue-dark)'}}>{fmtBRL(r.liquido)}</td>
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
