import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  EcomVendedor, EcomCampanha, EcomMarketplace,
  EcomSubgrupo, EcomEsperaVendedor, EcomUmblerVendedor,
  EcomMetaAds, EcomCampanhaSubgrupo, Periodo
} from '../types'

export function getPeriodRange(periodo: Periodo): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
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

// vw_ecom_vendedores nao tem campo de data — retorna tudo (agregado historico)
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

// Faturamento real por periodo via vw_comercial_docs_faturados
export function useFaturamentoPeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(async () => {
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('id_vendedor,nome_vendedor,tipo_saida,faturamento_doc,custo_doc,taxa_marketplace,faturamento_liquido,data_faturamento')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .range(0,9999)
    if (error) throw error
    return data || []
  }, [start, end])
}

export function useCampanhas(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomCampanha[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_campanhas').select('*').gte('data',start).lte('data',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r,
      investimento: Number(r.investimento),
      receita_gerada: Number(r.receita_gerada),
      roas: Number(r.roas),
      taxa_conversao_perc: r.taxa_conversao_perc!=null ? Number(r.taxa_conversao_perc) : null,
      custo_por_lead: r.custo_por_lead!=null ? Number(r.custo_por_lead) : null,
      custo_por_venda: r.custo_por_venda!=null ? Number(r.custo_por_venda) : null,
    }))
  }, [start, end])
}

export function useMetaAds(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomMetaAds[]>(async () => {
    const { data, error } = await supabase.from('ecom_meta_ads').select('*').gte('data',start).lte('data',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({ ...r, investimento: Number(r.investimento) }))
  }, [start, end])
}

// vw_ecom_marketplace nao filtra por data (data_inicio/fim sao range acumulado)
// Usa vw_comercial_docs_faturados com id_vendedor dos vendedores do marketplace
export function useMarketplace(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(async () => {
    // Pega lista de id_vendedor do marketplace
    const { data: mktVend } = await supabase.from('vw_ecom_marketplace').select('id_vendedor,nome_vendedor').range(0,9999)
    const ids = (mktVend||[]).map((r:any) => r.id_vendedor).filter(Boolean)
    if (ids.length === 0) return []
    // Busca faturamento por periodo
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('id_vendedor,nome_vendedor,tipo_saida,faturamento_doc,custo_doc,taxa_marketplace,faturamento_liquido')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .in('id_vendedor', ids)
      .range(0,9999)
    if (error) throw error
    // Agrupa por vendedor
    const map = new Map<number, any>()
    ;(data||[]).forEach((r:any) => {
      const id = Number(r.id_vendedor)
      const cur = map.get(id) || { id_vendedor: id, nome_vendedor: r.nome_vendedor, faturamento_bruto:0, taxa_marketplace:0, faturamento_liquido:0, custo_total:0, qtd_pedidos:0 }
      cur.faturamento_bruto += Number(r.faturamento_doc)
      cur.taxa_marketplace  += Number(r.taxa_marketplace||0)
      cur.faturamento_liquido += Number(r.faturamento_liquido||0)
      cur.custo_total       += Number(r.custo_doc||0)
      cur.qtd_pedidos++
      map.set(id, cur)
    })
    return [...map.values()].map(r => ({
      ...r,
      margem_liquida: r.faturamento_liquido - r.custo_total,
      margem_liquida_perc: r.faturamento_liquido > 0 ? ((r.faturamento_liquido - r.custo_total) / r.faturamento_liquido) * 100 : 0,
    }))
  }, [start, end])
}

// vw_ecom_subgrupos usa data_ref (nao data_faturamento)
export function useSubgrupos(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomSubgrupo[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_subgrupos').select('*').gte('data_ref',start).lte('data_ref',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r,
      faturamento: Number(r.faturamento),
      margem_total: Number(r.margem_total),
      margem_perc: Number(r.margem_perc),
    }))
  }, [start, end])
}

// vw_ecom_espera_vendedor usa data_ref
export function useEsperaVendedor(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomEsperaVendedor[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_espera_vendedor').select('*').gte('data_ref',start).lte('data_ref',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r,
      tempo_medio_min: Number(r.tempo_medio_min),
      tempo_min_min: Number(r.tempo_min_min),
      tempo_max_min: Number(r.tempo_max_min),
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

export function useFaturamento6Meses() {
  return useQuery<any[]>(async () => {
    const sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth()-5); sixAgo.setDate(1)
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('data_faturamento,nome_vendedor,id_vendedor,departamento,faturamento_doc,id_doc,tipo_saida')
      .in('tipo_saida', ['ONLINE'])
      .gte('data_faturamento', sixAgo.toISOString().slice(0,10))
      .range(0,9999)
    if (error) throw error
    return data || []
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
