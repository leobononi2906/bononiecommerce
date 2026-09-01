import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange } from '../lib/query'
import type { Periodo } from '../types'

// custo_doc apelidado do custo pelo PREÇO DE COMPRA (custo_doc_pc) — consumidores seguem usando r.custo_doc
const FAT_COLS = 'id_vendedor,nome_vendedor,faturamento_doc,custo_doc:custo_doc_pc,taxa_marketplace,faturamento_liquido,data_faturamento'

async function fetchFaturamento(start: string, end: string) {
  const { data, error } = await supabase
    .from('vw_comercial_docs_margem')
    .select(FAT_COLS)
    .eq('tipo_saida', 'ONLINE')
    .gte('data_faturamento', start)
    .lte('data_faturamento', end)
    .range(0, 9999)
  if (error) throw error
  return data || []
}

export function useFaturamentoPeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(() => fetchFaturamento(start, end), [start, end])
}

/** Mesmo recorte, mas do período imediatamente anterior — para comparativo nos cards. */
export function useFaturamentoPeriodoAnterior(periodo: Periodo) {
  const { start, end } = getPreviousPeriodRange(periodo)
  return useQuery<any[]>(() => fetchFaturamento(start, end), [start, end])
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
