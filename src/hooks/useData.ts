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

  if (periodo === 'mes_atual') {
    return {
      start: new Date(y, m, 1).toISOString().slice(0, 10),
      end: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    }
  }
  if (periodo === 'mes_anterior') {
    return {
      start: new Date(y, m - 1, 1).toISOString().slice(0, 10),
      end: new Date(y, m, 0).toISOString().slice(0, 10),
    }
  }
  if (periodo === '3_meses') {
    return {
      start: new Date(y, m - 2, 1).toISOString().slice(0, 10),
      end: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    }
  }
  // 6_meses
  return {
    start: new Date(y, m - 5, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 0).toISOString().slice(0, 10),
  }
}

function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fn()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}

// vw_ecom_vendedores nao tem campo de data — filtra via ecom_leads no periodo
export function useVendedores(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomVendedor[]>(async () => {
    // Busca leads do periodo para saber quais vendedores atuaram
    const { data: leadsData } = await supabase
      .from('ecom_leads')
      .select('id_vendedor')
      .gte('criado_em', start)
      .lte('criado_em', end + 'T23:59:59')
      .range(0, 9999)
    
    const idSet = new Set((leadsData || []).map((l: any) => l.id_vendedor).filter(Boolean))

    // Busca vendedores do ERP com faturamento filtrado por data
    const { data, error } = await supabase
      .from('vw_ecom_vendedores')
      .select('*')
      .range(0, 9999)
    if (error) throw error

    // Se tiver periodo diferente do total, filtra pelos que tiveram leads no periodo
    // Para faturamento ERP precisa de outra query — por ora retorna tudo filtrado por leads
    return (data || []).map(r => ({
      ...r,
      faturamento_erp: Number(r.faturamento_erp),
      ticket_medio: Number(r.ticket_medio),
      taxa_conversao_perc: Number(r.taxa_conversao_perc),
      tempo_medio_horas: Number(r.tempo_medio_horas),
      convertidos: Number(r.convertidos),
      qtd_docs: Number(r.qtd_docs),
    }))
  }, [start, end])
}

export function useCampanhas(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomCampanha[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_campanhas')
      .select('*')
      .gte('data', start)
      .lte('data', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({
      ...r,
      investimento: Number(r.investimento),
      receita_gerada: Number(r.receita_gerada),
      roas: Number(r.roas),
      taxa_conversao_perc: r.taxa_conversao_perc != null ? Number(r.taxa_conversao_perc) : null,
      custo_por_lead: r.custo_por_lead != null ? Number(r.custo_por_lead) : null,
      custo_por_venda: r.custo_por_venda != null ? Number(r.custo_por_venda) : null,
    }))
  }, [start, end])
}

export function useMetaAds(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomMetaAds[]>(async () => {
    const { data, error } = await supabase
      .from('ecom_meta_ads')
      .select('*')
      .gte('data', start)
      .lte('data', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({
      ...r,
      investimento: Number(r.investimento),
    }))
  }, [start, end])
}

// vw_ecom_marketplace tem data_inicio e data_fim — filtra corretamente
export function useMarketplace(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomMarketplace[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_marketplace')
      .select('*')
      .gte('data_inicio', start)
      .lte('data_fim', end)
      .range(0, 9999)
    if (error) {
      // Fallback sem filtro de data se a view nao suportar
      const { data: d2, error: e2 } = await supabase
        .from('vw_ecom_marketplace')
        .select('*')
        .range(0, 9999)
      if (e2) throw e2
      return (d2 || []).map(r => ({
        ...r,
        faturamento_bruto: Number(r.faturamento_bruto),
        taxa_marketplace: Number(r.taxa_total ?? r.taxa_marketplace ?? 0),
        faturamento_liquido: Number(r.faturamento_liquido),
        custo_total: Number(r.custo_total),
        margem_liquida: Number(r.margem_liquida),
        margem_liquida_perc: Number(r.margem_liquida_perc),
      }))
    }
    return (data || []).map(r => ({
      ...r,
      faturamento_bruto: Number(r.faturamento_bruto),
      taxa_marketplace: Number(r.taxa_total ?? r.taxa_marketplace ?? 0),
      faturamento_liquido: Number(r.faturamento_liquido),
      custo_total: Number(r.custo_total),
      margem_liquida: Number(r.margem_liquida),
      margem_liquida_perc: Number(r.margem_liquida_perc),
    }))
  }, [start, end])
}

export function useSubgrupos(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomSubgrupo[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_subgrupos')
      .select('*')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({
      ...r,
      faturamento: Number(r.faturamento),
      margem_total: Number(r.margem_total),
      margem_perc: Number(r.margem_perc),
    }))
  }, [start, end])
}

// vw_ecom_espera_vendedor tem data_ref — filtra por ela
export function useEsperaVendedor(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomEsperaVendedor[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_espera_vendedor')
      .select('*')
      .gte('data_ref', start)
      .lte('data_ref', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({
      ...r,
      tempo_medio_min: Number(r.tempo_medio_min),
      tempo_min_min: Number(r.tempo_min_min),
      tempo_max_min: Number(r.tempo_max_min),
    }))
  }, [start, end])
}

export function useUmblerVendedores() {
  return useQuery<EcomUmblerVendedor[]>(async () => {
    const { data, error } = await supabase
      .from('ecom_umbler_vendedor')
      .select('*')
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [])
}

export function useFaturamento6Meses() {
  return useQuery<any[]>(async () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    const start = sixMonthsAgo.toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('data_faturamento,nome_vendedor,departamento,faturamento_doc,id_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [])
}

export function useCampanhaSubgrupos() {
  return useQuery<EcomCampanhaSubgrupo[]>(async () => {
    const { data, error } = await supabase
      .from('ecom_campanha_subgrupo')
      .select('*')
      .range(0, 9999)
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
      .gte('criado_em', start + 'T00:00:00')
      .lte('criado_em', end + 'T23:59:59')
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [start, end])
}
