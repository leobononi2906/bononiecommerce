import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange } from '../lib/query'
import type { Periodo } from '../types'

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
