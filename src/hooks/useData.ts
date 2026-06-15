import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  EcomVendedor, EcomCampanha, EcomSubgrupo, EcomEsperaVendedor,
  EcomUmblerVendedor, EcomMetaAds, EcomCampanhaSubgrupo, EcomOrigemLead, Periodo
} from '../types'

export function getPeriodRange(periodo: Periodo): { start: string; end: string } {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  if (periodo === 'mes_atual')    return { start: new Date(y,m,1).toISOString().slice(0,10),   end: new Date(y,m+1,0).toISOString().slice(0,10) }
  if (periodo === 'mes_anterior') return { start: new Date(y,m-1,1).toISOString().slice(0,10), end: new Date(y,m,0).toISOString().slice(0,10) }
  if (periodo === '3_meses')      return { start: new Date(y,m-2,1).toISOString().slice(0,10), end: new Date(y,m+1,0).toISOString().slice(0,10) }
  return { start: new Date(y,m-5,1).toISOString().slice(0,10), end: new Date(y,m+1,0).toISOString().slice(0,10) }
}

function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setLoading(true); setData(null)
    fn().then(d => { setData(d); setLoading(false) })
       .catch(e => { setError(String(e)); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading, error }
}

export const MKT_NAMES = new Set(['ML BATTOGO', 'ML BONONI FULL', 'ML BONONI', 'SHOPEE BRASIL'])
export const SITE_NAMES = new Set(['SITE'])

export function getCanal(nome: string): 'marketplace' | 'site' | 'vendedor' {
  const n = nome.trim().toUpperCase()
  if (MKT_NAMES.has(n) || n.startsWith('ML ') || n === 'SHOPEE BRASIL') return 'marketplace'
  if (SITE_NAMES.has(n)) return 'site'
  return 'vendedor'
}

export function useFaturamentoPeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(async () => {
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('id_vendedor,nome_vendedor,faturamento_doc,custo_doc,taxa_marketplace,faturamento_liquido,data_faturamento')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [start, end])
}

export function useFaturamento6Meses() {
  return useQuery<any[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth()-5); d.setDate(1)
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('data_faturamento,nome_vendedor,faturamento_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', d.toISOString().slice(0,10))
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [])
}

export function useVendedores() {
  return useQuery<EcomVendedor[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_vendedores').select('*').range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r,
      faturamento_erp: Number(r.faturamento_erp),
      ticket_medio: Number(r.ticket_medio),
      taxa_conversao_perc: Number(r.taxa_conversao_perc),
      tempo_medio_horas: Number(r.tempo_medio_horas),
      convertidos: Number(r.convertidos),
      qtd_docs: Number(r.qtd_docs),
    }))
  }, [])
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

export function useSubgrupos(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomSubgrupo[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_subgrupos').select('*').gte('data_ref',start).lte('data_ref',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r, faturamento: Number(r.faturamento), custo_total: Number(r.custo_total), margem_total: Number(r.margem_total), margem_perc: Number(r.margem_perc), qtd_vendida: Number(r.qtd_vendida)
    }))
  }, [start, end])
}

// Todos os subgrupos distintos que já venderam (para select de cadastro)
export function useSubgruposERP() {
  return useQuery<string[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_subgrupos')
      .select('subgrupo')
      .gte('data_ref', '2025-01-01')
      .range(0, 9999)
    if (error) throw error
    const set = new Set<string>((data||[]).map((r:any) => r.subgrupo as string).filter(Boolean))
    return [...set].sort()
  }, [])
}

export function useEsperaVendedor(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomEsperaVendedor[]>(async () => {
    const [{ data: mapa }, { data: maxDate }] = await Promise.all([
      supabase.from('ecom_umbler_vendedor').select('id_membro_umbler,nome_vendedor_erp').range(0,9999),
      supabase.from('vw_ecom_espera_vendedor').select('data_ref').order('data_ref', {ascending:false}).limit(1),
    ])
    let s = start, e = end
    if (maxDate && maxDate[0]) {
      const lastDate = maxDate[0].data_ref as string
      if (lastDate < start) {
        const d = new Date(lastDate); e = lastDate; d.setDate(d.getDate() - 60); s = d.toISOString().slice(0,10)
      }
    }
    const { data: espera, error } = await supabase
      .from('vw_ecom_espera_vendedor').select('*').gte('data_ref',s).lte('data_ref',e).range(0,9999)
    if (error) throw error
    const lookup: Record<string,string> = {}
    ;(mapa||[]).forEach((m:any) => { lookup[m.id_membro_umbler] = m.nome_vendedor_erp })
    return (espera||[])
      .filter(r => Number(r.tempo_medio_min) > 0)
      .map(r => ({
        ...r,
        nome_vendedor: lookup[r.id_vendedor] || r.nome_vendedor,
        tempo_medio_min: Number(r.tempo_medio_min),
        tempo_min_min: Math.max(0, Number(r.tempo_min_min)),
        tempo_max_min: Math.max(0, Number(r.tempo_max_min)),
      }))
  }, [start, end])
}

export function useUmblerVendedores() {
  return useQuery<EcomUmblerVendedor[]>(async () => {
    const { data, error } = await supabase.from('ecom_umbler_vendedor').select('*').range(0,9999)
    if (error) throw error
    return data || []
  }, [])
}

// IDs internos (mkt, admin) — para exclusão nas visualizações
export function useInternos() {
  return useQuery<Set<string>>(async () => {
    const { data, error } = await supabase
      .from('ecom_umbler_vendedor')
      .select('id_membro_umbler')
      .eq('interno', true)
      .range(0, 999)
    if (error) throw error
    return new Set((data||[]).map((r:any) => r.id_membro_umbler as string))
  }, [])
}

export function useCampanhaSubgrupos() {
  return useQuery<EcomCampanhaSubgrupo[]>(async () => {
    const { data, error } = await supabase.from('ecom_campanha_subgrupo').select('*').range(0,9999)
    if (error) throw error
    return data || []
  }, [])
}

export function useLeads(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('ecom_leads')
      .select('id,criado_em,nome_vendedor,id_vendedor,etapa,valor_venda')
      .gte('criado_em', start+'T00:00:00')
      .lte('criado_em', end+'T23:59:59')
      .range(0,9999)
    if (error) throw error
    return data || []
  }, [start, end])
}

// IDs Umbler que chegaram no período (com ou sem vínculo), excluindo internos
export function useLeadsUmblerIds(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<{ id_umbler: string; nome_umbler: string; leads_mes: number; ultimo_lead: string }[]>(async () => {
    // Busca internos e leads em paralelo
    const [{ data: internosData }, { data, error }] = await Promise.all([
      supabase.from('ecom_umbler_vendedor').select('id_membro_umbler').eq('interno', true).range(0,999),
      supabase.from('ecom_leads')
        .select('id_vendedor,nome_vendedor,criado_em')
        .gte('criado_em', start+'T00:00:00')
        .lte('criado_em', end+'T23:59:59')
        .not('id_vendedor', 'is', null)
        .range(0, 9999)
    ])
    if (error) throw error
    const internos = new Set((internosData||[]).map((r:any) => r.id_membro_umbler as string))
    const map = new Map<string,{nome:string; count:number; ultimo:string}>()
    ;(data||[]).forEach((r:any) => {
      if (internos.has(r.id_vendedor)) return // ignora internos
      const cur = map.get(r.id_vendedor) || { nome: r.nome_vendedor || r.id_vendedor, count: 0, ultimo: '' }
      cur.count++
      if (r.criado_em > cur.ultimo) cur.ultimo = r.criado_em
      map.set(r.id_vendedor, cur)
    })
    return [...map.entries()].map(([id, d]) => ({
      id_umbler: id, nome_umbler: d.nome, leads_mes: d.count, ultimo_lead: d.ultimo.slice(0,10)
    })).sort((a,b) => b.leads_mes - a.leads_mes)
  }, [start, end])
}

export function useOrigemLeads(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomOrigemLead[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_origem_leads')
      .select('*')
      .gte('data_lead', start)
      .lte('data_lead', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({
      ...r,
      leads: Number(r.leads),
      investimento: Number(r.investimento),
      leads_meta: Number(r.leads_meta),
      cpl: Number(r.cpl),
    }))
  }, [start, end])
}

// Campanhas ativas nos últimos 30 dias (para select de configuração)
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

