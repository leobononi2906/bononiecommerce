import { useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange, getCanal } from '../lib/query'
import { getThresholds } from '../lib/thresholds'
import type { EcomCampanha, EcomMetaAds, EcomCampanhaSubgrupo, Periodo } from '../types'
import type { CampaignAnalysis, CampaignSignal, CampaignVerdict, SubgroupAnalysis } from '../types/campaigns'

/** Normaliza nome de campanha removendo tags de status como [PAUSADA] */
function normCamp(name: string): string {
  return name.replace(/\s*\[PAUSADA\]\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export function useCampanhas(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomCampanha[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_campanhas').select('*').gte('data',start).lte('data',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r, investimento: Number(r.investimento), receita_gerada: Number(r.receita_gerada), roas: Number(r.roas),
      taxa_conversao_perc: r.taxa_conversao_perc!=null ? Number(r.taxa_conversao_perc) : null,
      custo_por_lead: r.custo_por_lead!=null ? Number(r.custo_por_lead) : null,
    }))
  }, [start, end])
}

export function useMetaAds(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomMetaAds[]>(async () => {
    const { data, error } = await supabase.from('ecom_meta_ads').select('*').gte('data',start).lte('data',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({ ...r, investimento: Number(r.investimento), leads: Number(r.leads) }))
  }, [start, end])
}

export function useCampanhaSubgrupos() {
  return useQuery<EcomCampanhaSubgrupo[]>(async () => {
    const { data, error } = await supabase.from('ecom_campanha_subgrupo').select('*').range(0,9999)
    if (error) throw error
    return data || []
  }, [])
}

export function useMetaAdsAtivos() {
  return useQuery<string[]>(async () => {
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const { data, error } = await supabase
      .from('ecom_meta_ads')
      .select('campanha')
      .gte('data', since.toISOString().slice(0,10))
      .range(0, 9999)
    if (error) throw error
    const set = new Set<string>((data||[]).map((r:any) => r.campanha as string).filter(Boolean))
    return [...set].sort()
  }, [])
}

/** Daily data per campaign for sparklines */
export function useMetaAdsDaily(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<{ data: string; campanha: string; investimento: number; leads: number }[]>(async () => {
    const { data, error } = await supabase
      .from('ecom_meta_ads')
      .select('data,campanha,investimento,leads')
      .gte('data', start)
      .lte('data', end)
      .order('data')
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({ data: r.data, campanha: r.campanha, investimento: Number(r.investimento), leads: Number(r.leads) }))
  }, [start, end])
}

// ── Atribuição real via TikTim × Pedidos ERP ──────────────
interface ConversaoRow {
  campanha: string
  leads: number
  interessados: number
  vendas: number
  faturamento: number
  conversao_perc: number
  ticket_medio: number
}

function useConversaoReal(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<ConversaoRow[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_campanha_conversao')
      .select('*')
      .gte('mes_ref', start)
      .lte('mes_ref', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map((r: any) => ({
      ...r,
      leads: Number(r.leads),
      interessados: Number(r.interessados),
      vendas: Number(r.vendas),
      faturamento: Number(r.faturamento),
      conversao_perc: Number(r.conversao_perc),
      ticket_medio: Number(r.ticket_medio),
    }))
  }, [start, end])
}

// ── Faturamento total excl marketplace (para gauge) ────────
function useFaturamentoExclMkt(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<number>(async () => {
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('nome_vendedor,faturamento_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .range(0, 9999)
    if (error) throw error
    return (data || [])
      .filter((r: any) => getCanal(r.nome_vendedor || '') !== 'marketplace')
      .reduce((s: number, r: any) => s + Number(r.faturamento_doc), 0)
  }, [start, end])
}

// ── Hook principal: verdicts por campanha (atribuição real) ─
export function useCampaignVerdicts(periodo: Periodo) {
  const { data: metaAds, loading: l1 } = useMetaAds(periodo)
  const { data: daily, loading: l2 } = useMetaAdsDaily(periodo)
  const { data: campSub, loading: l3 } = useCampanhaSubgrupos()
  const { data: conversao, loading: l4 } = useConversaoReal(periodo)
  const { data: fatTotal, loading: l5 } = useFaturamentoExclMkt(periodo)

  const loading = l1 || l2 || l3 || l4 || l5

  const campaigns = useMemo((): CampaignAnalysis[] => {
    if (!metaAds || !daily || !campSub || !conversao) return []
    const t = getThresholds()

    // Subgrupo → campanha mapping (normalizado)
    const campToSubs = new Map<string, string[]>()
    campSub.forEach(cs => {
      const key = normCamp(cs.campanha)
      const arr = campToSubs.get(key) || []
      if (!arr.includes(cs.subgrupo_produto)) arr.push(cs.subgrupo_produto)
      campToSubs.set(key, arr)
    })

    // Conversão real indexada por campanha (normalizado)
    const convMap = new Map<string, ConversaoRow>()
    conversao.forEach(r => convMap.set(normCamp(r.campanha), r))

    // Aggregate Meta Ads by campaign (spend + impressões) — nome normalizado
    const map = new Map<string, { spend: number; leads: number; impressoes: number; cliques: number; isPaused: boolean }>()
    metaAds.forEach(r => {
      const key = normCamp(r.campanha)
      const cur = map.get(key) || { spend: 0, leads: 0, impressoes: 0, cliques: 0, isPaused: false }
      cur.spend += r.investimento
      cur.leads += r.leads || 0
      cur.impressoes += r.impressoes
      cur.cliques += r.cliques
      if (r.campanha.includes('[PAUSADA]')) cur.isPaused = true
      map.set(key, cur)
    })

    // Sparklines per campaign (normalizado)
    const sparkMap = new Map<string, number[]>()
    const allDates = [...new Set(daily.map(r => r.data))].sort()
    daily.forEach(r => {
      const key = normCamp(r.campanha)
      if (!sparkMap.has(key)) sparkMap.set(key, new Array(allDates.length).fill(0))
      const idx = allDates.indexOf(r.data)
      if (idx >= 0) sparkMap.get(key)![idx] += r.investimento
    })

    const result: CampaignAnalysis[] = []
    map.forEach((agg, campanha) => {
      if (agg.spend < t.min_spend_for_verdict) return

      // Atribuição real do TikTim × ERP
      const conv = convMap.get(campanha)
      const vendas = conv?.vendas ?? 0
      const revenue = conv?.faturamento ?? 0
      const conversaoPerc = conv?.conversao_perc ?? 0

      const roas = agg.spend > 0 ? revenue / agg.spend : 0
      const cpl = agg.leads > 0 ? agg.spend / agg.leads : 0
      const cpa = vendas > 0 ? agg.spend / vendas : 0

      // Signal
      let signal: CampaignSignal = 'red'
      if (roas >= t.roas_green) signal = 'green'
      else if (roas >= t.roas_yellow) signal = 'yellow'

      // Verdict
      let verdict: CampaignVerdict = 'MONITORAR'
      if (roas >= t.roas_green) verdict = 'ESCALAR'
      else if (roas >= t.roas_yellow) verdict = 'MANTER'
      else if (vendas === 0 && agg.leads > 20) verdict = 'PAUSAR'
      else if (roas < t.roas_yellow && roas > 0) verdict = 'MONITORAR'
      else if (vendas === 0) verdict = 'PAUSAR'

      const shortName = campanha.replace(/\[[\d\/]+\]\s*/g, '').replace(/\[PAUSADA\]\s*/g, '').trim()
      const displayName = shortName.length > 40 ? shortName.slice(0, 40) + '…' : shortName

      const pctInvest = revenue > 0 ? (agg.spend / revenue) * 100 : 0

      result.push({
        campanha,
        shortName: displayName,
        subgrupos: campToSubs.get(campanha) || [],
        spend: agg.spend,
        impressoes: agg.impressoes,
        cliques: agg.cliques,
        leads: agg.leads,
        vendas,
        revenue,
        roas,
        cpl,
        cpa,
        conversao: conversaoPerc,
        pctInvestFat: pctInvest,
        signal,
        verdict,
        sparkline: sparkMap.get(campanha) || [],
        isPaused: agg.isPaused,
      })
    })

    return result.sort((a, b) => b.spend - a.spend)
  }, [metaAds, daily, campSub, conversao])

  // Summary
  const summary = useMemo(() => {
    const total = campaigns.length
    const escalar = campaigns.filter(c => c.verdict === 'ESCALAR').length
    const manter = campaigns.filter(c => c.verdict === 'MANTER').length
    const monitorar = campaigns.filter(c => c.verdict === 'MONITORAR').length
    const pausar = campaigns.filter(c => c.verdict === 'PAUSAR').length
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0)
    const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)
    const totalVendas = campaigns.reduce((s, c) => s + c.vendas, 0)
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0
    const overallCpl = totalLeads > 0 ? totalSpend / totalLeads : 0
    const overallCpa = totalVendas > 0 ? totalSpend / totalVendas : 0
    const pctInvestFat = (fatTotal ?? 0) > 0 ? (totalSpend / fatTotal!) * 100 : 0
    return { total, escalar, manter, monitorar, pausar, totalSpend, totalRevenue, totalLeads, totalVendas, overallRoas, overallCpl, overallCpa, pctInvestFat }
  }, [campaigns, fatTotal])

  return { campaigns, summary, loading }
}

// ── Subgroup analysis with previous period comparison ──────
export function useSubgroupAnalysis(periodo: Periodo) {
  const { data: metaAds } = useMetaAds(periodo)
  const { data: campSub } = useCampanhaSubgrupos()
  const { data: subgrupos } = useQuery<any[]>(async () => {
    const { start, end } = getPeriodRange(periodo)
    const { data, error } = await supabase.from('vw_ecom_subgrupos').select('*').gte('data_ref', start).lte('data_ref', end).range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({ ...r, faturamento: Number(r.faturamento) }))
  }, [periodo])
  const { data: subgruposAnt } = useQuery<any[]>(async () => {
    const { start, end } = getPreviousPeriodRange(periodo)
    const { data, error } = await supabase.from('vw_ecom_subgrupos').select('*').gte('data_ref', start).lte('data_ref', end).range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({ ...r, faturamento: Number(r.faturamento) }))
  }, [periodo])

  return useMemo((): SubgroupAnalysis[] => {
    if (!metaAds || !campSub || !subgrupos || !subgruposAnt) return []

    // Invest per campaign (normalizado)
    const investCamp = new Map<string, number>()
    metaAds.forEach(r => {
      const key = normCamp(r.campanha)
      investCamp.set(key, (investCamp.get(key) || 0) + r.investimento)
    })

    // Fat by subgrupo (current)
    const fatMap = new Map<string, number>()
    subgrupos.forEach((r: any) => fatMap.set(r.subgrupo, (fatMap.get(r.subgrupo) || 0) + r.faturamento))

    // Fat by subgrupo (previous)
    const fatAntMap = new Map<string, number>()
    subgruposAnt.forEach((r: any) => fatAntMap.set(r.subgrupo, (fatAntMap.get(r.subgrupo) || 0) + r.faturamento))

    // Aggregate by subgrupo (normalizado)
    const map = new Map<string, { campanhas: Set<string>; investimento: number }>()
    campSub.forEach(cs => {
      const key = normCamp(cs.campanha)
      const cur = map.get(cs.subgrupo_produto) || { campanhas: new Set(), investimento: 0 }
      if (!cur.campanhas.has(key)) {
        cur.campanhas.add(key)
        cur.investimento += investCamp.get(key) || 0
      }
      map.set(cs.subgrupo_produto, cur)
    })

    const result: SubgroupAnalysis[] = []
    map.forEach((d, subgrupo) => {
      const faturamento = fatMap.get(subgrupo) || 0
      const faturamentoAnterior = fatAntMap.get(subgrupo) || 0
      const deltaPerc = faturamentoAnterior > 0 ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100 : 0
      const pctInvestFat = faturamento > 0 ? (d.investimento / faturamento) * 100 : 0
      const roas = d.investimento > 0 ? faturamento / d.investimento : 0
      if (d.investimento > 0 || faturamento > 0) {
        result.push({ subgrupo, investimento: d.investimento, faturamento, faturamentoAnterior, deltaPerc, pctInvestFat, roas, campanhas: d.campanhas.size })
      }
    })

    return result.sort((a, b) => b.faturamento - a.faturamento)
  }, [metaAds, campSub, subgrupos, subgruposAnt])
}

// ── Detalhe: conjunto + anúncio por campanha ───────────────
export interface CampaignDetail {
  campanha: string
  conjunto: string
  anuncio: string
  leads: number
  interessados: number
  vendas: number
  faturamento: number
  conversao_perc: number
}

export function useCampaignDetails(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<CampaignDetail[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_campanha_detalhe')
      .select('*')
      .gte('mes_ref', start)
      .lte('mes_ref', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map((r: any) => ({
      campanha: r.campanha,
      conjunto: r.conjunto || '(sem conjunto)',
      anuncio: r.anuncio || '(sem anúncio)',
      leads: Number(r.leads),
      interessados: Number(r.interessados),
      vendas: Number(r.vendas),
      faturamento: Number(r.faturamento),
      conversao_perc: Number(r.conversao_perc),
    }))
  }, [start, end])
}
