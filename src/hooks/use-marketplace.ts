import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange } from '../lib/query'
import type { EcomSubgrupo, Periodo } from '../types'

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
